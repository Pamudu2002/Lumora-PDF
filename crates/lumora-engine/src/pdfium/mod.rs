//! [`PdfiumEngine`]: the PDFium-backed engine, running as an actor on one worker thread.

mod extract;
mod worker;

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread::JoinHandle;

use crossbeam_channel::Sender;

use crate::content::{DocProperties, OutlineItem, PageLink, PageText, SearchHit, SearchOptions};
use crate::engine::{PdfEngine, StillNeeded};
use crate::error::EngineError;
use crate::types::{DocId, DocInfo, OpenOptions, PageIndex, PageSize, RgbaImage, TileRequest};
use worker::{Job, Worker};

/// Where to load the PDFium shared library from.
#[derive(Debug, Clone)]
pub enum PdfiumLibrary {
    /// A specific file, e.g. the bundled `resources/pdfium/pdfium.dll`.
    Path(PathBuf),
    /// The platform's default library search path.
    System,
}

/// Request priority. The worker always serves a higher lane first (plan section 3.2).
#[derive(Debug, Clone, Copy)]
enum Lane {
    /// Tiles for visible pages.
    Render = 0,
    /// UI queries: open, close, sizes, thumbnails.
    Query = 1,
}

/// The PDFium engine. Cheap to share behind an `Arc`; every call is forwarded to the worker thread
/// that owns PDFium and all open documents, and blocks until it replies.
///
/// Dropping the engine stops the worker and closes every document.
pub struct PdfiumEngine {
    lanes: Option<[Sender<Job>; 2]>,
    thread: Option<JoinHandle<()>>,
}

impl PdfiumEngine {
    /// Starts the worker thread and loads PDFium on it. Fails if the library can't be loaded.
    pub fn start(library: PdfiumLibrary) -> Result<Self, EngineError> {
        let (render_tx, render_rx) = crossbeam_channel::unbounded::<Job>();
        let (query_tx, query_rx) = crossbeam_channel::unbounded::<Job>();
        let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<(), EngineError>>(1);

        let thread = std::thread::Builder::new()
            .name("lumora-engine".into())
            .spawn(move || worker::run(library, ready_tx, render_rx, query_rx))
            .map_err(|e| EngineError::Internal(format!("could not start engine thread: {e}")))?;

        match ready_rx.recv() {
            Ok(Ok(())) => Ok(Self {
                lanes: Some([render_tx, query_tx]),
                thread: Some(thread),
            }),
            Ok(Err(err)) => {
                let _ = thread.join();
                Err(err)
            }
            Err(_) => {
                let _ = thread.join();
                Err(EngineError::WorkerStopped)
            }
        }
    }

    /// Runs `f` on the worker thread and waits for its result. A panic inside `f` is caught and
    /// returned as [`EngineError::Internal`]; the worker keeps running.
    fn call<R, F>(&self, lane: Lane, f: F) -> Result<R, EngineError>
    where
        R: Send + 'static,
        F: for<'p> FnOnce(&mut Worker<'p>) -> Result<R, EngineError> + Send + 'static,
    {
        let lanes = self.lanes.as_ref().ok_or(EngineError::WorkerStopped)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel::<Result<R, EngineError>>(1);
        let job: Job = Box::new(move |worker: &mut Worker<'_>| {
            let result = catch_unwind(AssertUnwindSafe(|| f(worker))).unwrap_or_else(|panic| {
                let msg = panic_message(panic.as_ref());
                tracing::error!(%msg, "engine request panicked");
                Err(EngineError::Internal(format!(
                    "engine request panicked: {msg}"
                )))
            });
            // The caller may have given up waiting; that's fine.
            let _ = reply_tx.send(result);
        });
        lanes[lane as usize]
            .send(job)
            .map_err(|_| EngineError::WorkerStopped)?;
        reply_rx.recv().map_err(|_| EngineError::WorkerStopped)?
    }
}

impl PdfEngine for PdfiumEngine {
    fn open(&self, path: &Path, opts: OpenOptions) -> Result<(DocId, DocInfo), EngineError> {
        let path = path.to_path_buf();
        self.call(Lane::Query, move |w| w.open(&path, opts))
    }

    fn close(&self, doc: DocId) -> Result<(), EngineError> {
        self.call(Lane::Query, move |w| w.close(doc))
    }

    fn page_sizes(&self, doc: DocId) -> Result<Vec<PageSize>, EngineError> {
        self.call(Lane::Query, move |w| w.page_sizes(doc))
    }

    fn render_tile(&self, req: TileRequest) -> Result<RgbaImage, EngineError> {
        self.call(Lane::Render, move |w| w.render_tile(req))
    }

    fn render_thumbnail(
        &self,
        doc: DocId,
        page: PageIndex,
        max_px: u32,
    ) -> Result<RgbaImage, EngineError> {
        self.call(Lane::Query, move |w| w.render_thumbnail(doc, page, max_px))
    }

    fn render_page(
        &self,
        doc: DocId,
        page: PageIndex,
        scale: f32,
    ) -> Result<RgbaImage, EngineError> {
        self.call(Lane::Render, move |w| w.render_page(doc, page, scale))
    }

    fn render_tile_if(
        &self,
        req: TileRequest,
        still_needed: StillNeeded,
    ) -> Result<RgbaImage, EngineError> {
        if !still_needed() {
            return Err(EngineError::Cancelled);
        }
        // Checked again on the worker: the tile may have waited behind others while the user
        // scrolled on.
        self.call(Lane::Render, move |w| {
            if still_needed() {
                w.render_tile(req)
            } else {
                Err(EngineError::Cancelled)
            }
        })
    }

    fn page_text(&self, doc: DocId, page: PageIndex) -> Result<PageText, EngineError> {
        self.call(Lane::Query, move |w| w.page_text(doc, page))
    }

    fn search_page(
        &self,
        doc: DocId,
        page: PageIndex,
        query: &str,
        opts: SearchOptions,
    ) -> Result<Vec<SearchHit>, EngineError> {
        let query = query.to_string();
        self.call(Lane::Query, move |w| w.search_page(doc, page, &query, opts))
    }

    fn outline(&self, doc: DocId) -> Result<Vec<OutlineItem>, EngineError> {
        self.call(Lane::Query, move |w| w.outline(doc))
    }

    fn page_links(&self, doc: DocId, page: PageIndex) -> Result<Vec<PageLink>, EngineError> {
        self.call(Lane::Query, move |w| w.page_links(doc, page))
    }

    fn properties(&self, doc: DocId) -> Result<DocProperties, EngineError> {
        self.call(Lane::Query, move |w| w.properties(doc))
    }
}

impl Drop for PdfiumEngine {
    fn drop(&mut self) {
        // Closing the channels ends the worker loop; it then drops every document and PDFium.
        self.lanes = None;
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn panic_message(panic: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = panic.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = panic.downcast_ref::<String>() {
        s.clone()
    } else {
        "unknown panic".to_string()
    }
}
