//! The engine worker thread: owns PDFium and every open document.

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, mpsc};

use crossbeam_channel::{Receiver, select};
use pdfium_render::prelude::{
    PdfBitmap, PdfBitmapFormat, PdfDocument, PdfDocumentMetadataTagType, PdfDocumentVersion,
    PdfPage, PdfRenderConfig, PdfSecurityHandlerRevision, Pdfium, PdfiumError, PdfiumInternalError,
};

use super::PdfiumLibrary;
use crate::error::EngineError;
use crate::types::{
    DocId, DocInfo, MAX_TILE_SIZE, OpenOptions, PageIndex, PageSize, RgbaImage, TileRequest,
    check_scale,
};

/// A unit of work sent to the worker.
pub(super) type Job = Box<dyn for<'p> FnOnce(&mut Worker<'p>) + Send>;

/// Pages kept loaded per document, so the tiles of one page don't re-parse it each time.
const PAGE_CACHE_SIZE: usize = 6;

/// US Letter, used when a broken file doesn't report a page's size.
const FALLBACK_PAGE: PageSize = PageSize {
    width_pt: 612.0,
    height_pt: 792.0,
};

/// Entry point of the worker thread.
pub(super) fn run(
    library: PdfiumLibrary,
    ready: mpsc::SyncSender<Result<(), EngineError>>,
    render_rx: Receiver<Job>,
    query_rx: Receiver<Job>,
) {
    let pdfium = match bind(&library) {
        Ok(pdfium) => pdfium,
        Err(err) => {
            tracing::error!(?library, %err, "could not load PDFium");
            let _ = ready.send(Err(err));
            return;
        }
    };
    tracing::info!(?library, "PDFium loaded");
    let _ = ready.send(Ok(()));

    // Declared after `pdfium`, so every document is dropped before PDFium.
    let mut worker = Worker::new(&pdfium);
    while let Some(job) = next_job(&render_rx, &query_rx) {
        job(&mut worker);
    }
    tracing::info!("engine worker stopped");
}

/// Takes the next job, preferring the render lane. Returns `None` once all senders are gone.
fn next_job(render_rx: &Receiver<Job>, query_rx: &Receiver<Job>) -> Option<Job> {
    if let Ok(job) = render_rx.try_recv() {
        return Some(job);
    }
    if let Ok(job) = query_rx.try_recv() {
        return Some(job);
    }
    // Both lanes are empty: block on whichever gets work first. Both senders live in the same
    // `PdfiumEngine`, so they disconnect together.
    select! {
        recv(render_rx) -> job => job.ok(),
        recv(query_rx) -> job => job.ok(),
    }
}

/// Binds PDFium. Bindings are process-wide in `pdfium-render`, so a second engine in the same
/// process (tests) reuses the first binding.
fn bind(library: &PdfiumLibrary) -> Result<Pdfium, EngineError> {
    static BIND_LOCK: Mutex<()> = Mutex::new(());
    let _guard = BIND_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    let bindings = match library {
        PdfiumLibrary::Path(path) => Pdfium::bind_to_library(path),
        PdfiumLibrary::System => Pdfium::bind_to_system_library(),
    };
    match bindings {
        Ok(bindings) => Ok(Pdfium::new(bindings)),
        // Already bound by an earlier engine: `default()` returns a handle to those bindings.
        Err(PdfiumError::PdfiumLibraryBindingsAlreadyInitialized) => Ok(Pdfium::default()),
        Err(err) => Err(EngineError::LibraryLoad(format!("{err:?}"))),
    }
}

/// An open document with its cached page sizes and recently used pages.
struct OpenDoc<'p> {
    /// Recently used pages, most recent first. Declared before `doc` so pages drop first.
    pages: Vec<(PageIndex, PdfPage<'p>)>,
    sizes: Vec<PageSize>,
    doc: PdfDocument<'p>,
}

impl<'p> OpenDoc<'p> {
    fn check_page(&self, page: PageIndex) -> Result<PageSize, EngineError> {
        self.sizes
            .get(page as usize)
            .copied()
            .ok_or(EngineError::PageOutOfRange {
                page,
                page_count: self.sizes.len() as u32,
            })
    }

    /// Returns a loaded page, from the cache when possible.
    fn page(&mut self, index: PageIndex) -> Result<&PdfPage<'p>, EngineError> {
        if let Some(pos) = self.pages.iter().position(|(i, _)| *i == index) {
            let entry = self.pages.remove(pos);
            self.pages.insert(0, entry);
        } else {
            let page_index = i32::try_from(index).map_err(|_| EngineError::PageOutOfRange {
                page: index,
                page_count: self.sizes.len() as u32,
            })?;
            let page =
                self.doc.pages().get(page_index).map_err(|e| {
                    EngineError::Render(format!("could not load page {index}: {e:?}"))
                })?;
            self.pages.insert(0, (index, page));
            self.pages.truncate(PAGE_CACHE_SIZE);
        }
        self.pages
            .first()
            .map(|(_, page)| page)
            .ok_or_else(|| EngineError::Internal("page cache is empty".into()))
    }
}

/// State owned by the worker thread.
pub(super) struct Worker<'p> {
    pdfium: &'p Pdfium,
    docs: HashMap<DocId, OpenDoc<'p>>,
    next_id: DocId,
}

impl<'p> Worker<'p> {
    fn new(pdfium: &'p Pdfium) -> Self {
        Self {
            pdfium,
            docs: HashMap::new(),
            next_id: 1,
        }
    }

    fn doc_mut(&mut self, doc: DocId) -> Result<&mut OpenDoc<'p>, EngineError> {
        self.docs
            .get_mut(&doc)
            .ok_or(EngineError::UnknownDocument(doc))
    }

    pub(super) fn open(
        &mut self,
        path: &Path,
        opts: OpenOptions,
    ) -> Result<(DocId, DocInfo), EngineError> {
        let password = opts.password.as_deref();
        let doc = self
            .pdfium
            .load_pdf_from_file(path, password)
            .map_err(|e| map_open_error(e, password.is_some()))?;

        let page_count = u32::try_from(doc.pages().len()).unwrap_or(0);
        let sizes = (0..page_count)
            .map(|i| {
                let size = i32::try_from(i)
                    .ok()
                    .and_then(|i| doc.pages().page_size(i).ok());
                match size {
                    Some(rect) => PageSize::sanitized(rect.width().value, rect.height().value),
                    None => {
                        tracing::warn!(page = i, "page size unavailable; using Letter");
                        FALLBACK_PAGE
                    }
                }
            })
            .collect::<Vec<_>>();

        let meta = |tag| {
            doc.metadata()
                .get(tag)
                .map(|t| t.value().trim().to_string())
                .filter(|v| !v.is_empty())
        };
        let info = DocInfo {
            page_count,
            title: meta(PdfDocumentMetadataTagType::Title),
            author: meta(PdfDocumentMetadataTagType::Author),
            is_encrypted: !matches!(
                doc.permissions().security_handler_revision(),
                Ok(PdfSecurityHandlerRevision::Unprotected)
            ),
            has_forms: doc.form().is_some(),
            pdf_version: version_string(doc.version()),
        };

        let id = self.allocate_id();
        self.docs.insert(
            id,
            OpenDoc {
                pages: Vec::new(),
                sizes,
                doc,
            },
        );
        tracing::debug!(doc = id, pages = page_count, "opened document");
        Ok((id, info))
    }

    fn allocate_id(&mut self) -> DocId {
        loop {
            let id = self.next_id;
            self.next_id = self.next_id.wrapping_add(1).max(1);
            if !self.docs.contains_key(&id) {
                return id;
            }
        }
    }

    pub(super) fn close(&mut self, doc: DocId) -> Result<(), EngineError> {
        self.docs
            .remove(&doc)
            .map(|_| tracing::debug!(doc, "closed document"))
            .ok_or(EngineError::UnknownDocument(doc))
    }

    pub(super) fn page_sizes(&mut self, doc: DocId) -> Result<Vec<PageSize>, EngineError> {
        Ok(self.doc_mut(doc)?.sizes.clone())
    }

    pub(super) fn render_tile(&mut self, req: TileRequest) -> Result<RgbaImage, EngineError> {
        let open = self.doc_mut(req.doc)?;
        let size = open.check_page(req.page)?;
        let (x, y, w, h) = req.pixel_rect(size)?;
        let (page_w, page_h) = size.pixel_size(req.scale);
        let page = open.page(req.page)?;
        render_region(page, (page_w, page_h), (x, y, w, h))
    }

    pub(super) fn render_thumbnail(
        &mut self,
        doc: DocId,
        page: PageIndex,
        max_px: u32,
    ) -> Result<RgbaImage, EngineError> {
        if max_px == 0 || max_px > MAX_TILE_SIZE {
            return Err(EngineError::InvalidRequest(format!(
                "thumbnail size {max_px} is outside 1..={MAX_TILE_SIZE}"
            )));
        }
        let open = self.doc_mut(doc)?;
        let size = open.check_page(page)?;
        let scale = max_px as f32 / size.width_pt.max(size.height_pt);
        check_scale(scale)?;
        let (w, h) = size.pixel_size(scale);
        let page = open.page(page)?;
        render_region(page, (w, h), (0, 0, w, h))
    }
}

/// Renders the region `(x, y, w, h)` of a page drawn at `page_px` pixels into a new image.
fn render_region(
    page: &PdfPage<'_>,
    page_px: (u32, u32),
    (x, y, w, h): (u32, u32, u32, u32),
) -> Result<RgbaImage, EngineError> {
    let to_i32 = |v: u32| {
        i32::try_from(v).map_err(|_| EngineError::InvalidRequest(format!("{v} px is too large")))
    };
    let mut bitmap = PdfBitmap::empty(to_i32(w)?, to_i32(h)?, PdfBitmapFormat::BGRA)
        .map_err(|e| EngineError::Render(format!("could not allocate bitmap: {e:?}")))?;

    // Draw the whole page at `page_px`, shifted so the region's corner lands at (0, 0); PDFium clips
    // to the bitmap. This keeps form fields rendering (a transform matrix would disable them).
    let config = PdfRenderConfig::new()
        .set_fixed_size(to_i32(page_px.0)?, to_i32(page_px.1)?)
        .set_origin(-to_i32(x)?, -to_i32(y)?)
        // FPDF_REVERSE_BYTE_ORDER: PDFium writes RGBA instead of its native BGRA.
        .set_reverse_byte_order(true);
    page.render_into_bitmap_with_config(&mut bitmap, &config)
        .map_err(|e| EngineError::Render(format!("{e:?}")))?;

    let pixels = bitmap.as_raw_bytes();
    let expected = (w as usize) * (h as usize) * 4;
    if pixels.len() != expected {
        return Err(EngineError::Render(format!(
            "unexpected bitmap size {} (expected {expected})",
            pixels.len()
        )));
    }
    Ok(RgbaImage {
        width: w,
        height: h,
        pixels,
    })
}

fn map_open_error(err: PdfiumError, had_password: bool) -> EngineError {
    match err {
        PdfiumError::IoError(e) if e.kind() == std::io::ErrorKind::NotFound => {
            EngineError::FileNotFound
        }
        PdfiumError::IoError(e) => EngineError::Io(e.to_string()),
        PdfiumError::PdfiumLibraryInternalError(internal) => match internal {
            PdfiumInternalError::PasswordError if had_password => EngineError::WrongPassword,
            PdfiumInternalError::PasswordError => EngineError::PasswordRequired,
            PdfiumInternalError::FormatError => EngineError::Malformed,
            PdfiumInternalError::SecurityError => EngineError::UnsupportedSecurity,
            PdfiumInternalError::FileError => {
                EngineError::Io("PDFium could not read the file".into())
            }
            other => {
                tracing::warn!(?other, "PDFium could not open the file");
                EngineError::Malformed
            }
        },
        other => EngineError::Internal(format!("{other:?}")),
    }
}

fn version_string(version: PdfDocumentVersion) -> String {
    match version {
        PdfDocumentVersion::Pdf1_0 => "1.0".into(),
        PdfDocumentVersion::Pdf1_1 => "1.1".into(),
        PdfDocumentVersion::Pdf1_2 => "1.2".into(),
        PdfDocumentVersion::Pdf1_3 => "1.3".into(),
        PdfDocumentVersion::Pdf1_4 => "1.4".into(),
        PdfDocumentVersion::Pdf1_5 => "1.5".into(),
        PdfDocumentVersion::Pdf1_6 => "1.6".into(),
        PdfDocumentVersion::Pdf1_7 => "1.7".into(),
        PdfDocumentVersion::Pdf2_0 => "2.0".into(),
        PdfDocumentVersion::Other(v) if (10..100).contains(&v) => format!("{}.{}", v / 10, v % 10),
        PdfDocumentVersion::Unset | PdfDocumentVersion::Other(_) => "unknown".into(),
    }
}
