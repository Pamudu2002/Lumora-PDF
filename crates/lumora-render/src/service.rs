//! [`TileService`]: cached, encoded tiles and thumbnails on top of a [`PdfEngine`].

use std::sync::Arc;

use lumora_engine::{DocId, PageIndex, PdfEngine, TileRequest};

use crate::cache::{CacheKey, EncodedImage, TileCache};
use crate::encode::{ImageFormat, encode};
use crate::error::RenderError;
use crate::tiles::{DEFAULT_TILE_SIZE, milli_to_scale};
use crate::visible::VisiblePages;

/// Serves encoded tiles and thumbnails, rendering and caching on a miss.
///
/// Methods block while the engine renders; call them from a blocking task.
pub struct TileService {
    engine: Arc<dyn PdfEngine>,
    cache: TileCache,
    format: ImageFormat,
    visible: Arc<VisiblePages>,
}

impl TileService {
    /// A service over `engine` with the given cache and output format.
    pub fn new(engine: Arc<dyn PdfEngine>, cache: TileCache, format: ImageFormat) -> Self {
        Self {
            engine,
            cache,
            format,
            visible: Arc::new(VisiblePages::default()),
        }
    }

    /// The engine behind this service.
    pub fn engine(&self) -> &Arc<dyn PdfEngine> {
        &self.engine
    }

    /// Records which pages of a document are on screen. Tiles already queued for other pages are
    /// skipped when the engine reaches them, so fast scrolling doesn't build a backlog.
    pub fn set_visible_pages(&self, doc: DocId, pages: impl IntoIterator<Item = PageIndex>) {
        self.visible.set(doc, pages);
    }

    /// One 512 px tile of a page at `scale_milli / 1000`. Fails with
    /// [`lumora_engine::EngineError::Cancelled`] if the page is no longer visible by the time the
    /// engine gets to it.
    #[allow(clippy::too_many_arguments)]
    pub fn tile(
        &self,
        doc: DocId,
        page: PageIndex,
        scale_milli: u32,
        tile_x: u32,
        tile_y: u32,
        rev: u64,
        dark: bool,
    ) -> Result<Arc<EncodedImage>, RenderError> {
        let key = CacheKey::Tile {
            doc,
            page,
            scale_milli,
            tile_x,
            tile_y,
            rev,
            dark,
        };
        let visible = Arc::clone(&self.visible);
        let since = visible.generation();
        self.cached_or_render(key, || {
            self.engine.render_tile_if(
                TileRequest {
                    doc,
                    page,
                    scale: milli_to_scale(scale_milli),
                    tile_x,
                    tile_y,
                    tile_size: DEFAULT_TILE_SIZE,
                    dark_mode: dark,
                },
                Arc::new(move || visible.still_wanted(doc, page, since)),
            )
        })
    }

    /// A whole-page thumbnail whose longer edge is `max_px`.
    pub fn thumbnail(
        &self,
        doc: DocId,
        page: PageIndex,
        max_px: u32,
        rev: u64,
    ) -> Result<Arc<EncodedImage>, RenderError> {
        let key = CacheKey::Thumbnail {
            doc,
            page,
            max_px,
            rev,
        };
        self.cached_or_render(key, || self.engine.render_thumbnail(doc, page, max_px))
    }

    /// A whole page at `scale_milli / 1000` in one image, for printing. Not cached: print images
    /// are large and used once.
    pub fn print_page(
        &self,
        doc: DocId,
        page: PageIndex,
        scale_milli: u32,
    ) -> Result<Arc<EncodedImage>, RenderError> {
        let image = self
            .engine
            .render_page(doc, page, milli_to_scale(scale_milli))?;
        Ok(Arc::new(EncodedImage {
            bytes: encode(&image, ImageFormat::Png)?,
            format: ImageFormat::Png,
        }))
    }

    /// Forgets every cached image of a document (call when it closes).
    pub fn forget_doc(&self, doc: DocId) {
        self.cache.remove_doc(doc);
        self.visible.remove(doc);
    }

    fn cached_or_render(
        &self,
        key: CacheKey,
        render: impl FnOnce() -> Result<lumora_engine::RgbaImage, lumora_engine::EngineError>,
    ) -> Result<Arc<EncodedImage>, RenderError> {
        if let Some(hit) = self.cache.get(&key) {
            return Ok(hit);
        }
        let image = render()?;
        let encoded = Arc::new(EncodedImage {
            bytes: encode(&image, self.format)?,
            format: self.format,
        });
        self.cache.insert(key, Arc::clone(&encoded));
        Ok(encoded)
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::atomic::{AtomicU32, Ordering};

    use lumora_engine::{DocInfo, EngineError, OpenOptions, PageSize, RgbaImage};

    use super::*;

    /// A fake engine that renders solid tiles and counts render calls.
    #[derive(Default)]
    struct FakeEngine {
        renders: AtomicU32,
    }

    impl PdfEngine for FakeEngine {
        fn open(&self, _: &Path, _: OpenOptions) -> Result<(DocId, DocInfo), EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
        fn close(&self, _: DocId) -> Result<(), EngineError> {
            Ok(())
        }
        fn page_sizes(&self, _: DocId) -> Result<Vec<PageSize>, EngineError> {
            Ok(vec![PageSize::sanitized(612.0, 792.0)])
        }
        fn render_tile(&self, req: TileRequest) -> Result<RgbaImage, EngineError> {
            self.renders.fetch_add(1, Ordering::SeqCst);
            if req.doc != 1 {
                return Err(EngineError::UnknownDocument(req.doc));
            }
            Ok(RgbaImage {
                width: 8,
                height: 8,
                pixels: vec![255; 8 * 8 * 4],
            })
        }
        fn render_thumbnail(
            &self,
            _: DocId,
            _: PageIndex,
            max_px: u32,
        ) -> Result<RgbaImage, EngineError> {
            self.renders.fetch_add(1, Ordering::SeqCst);
            Ok(RgbaImage {
                width: max_px,
                height: max_px,
                pixels: vec![255; (max_px * max_px * 4) as usize],
            })
        }

        fn page_text(
            &self,
            _: DocId,
            _: PageIndex,
        ) -> Result<lumora_engine::PageText, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
        fn search_page(
            &self,
            _: DocId,
            _: PageIndex,
            _: &str,
            _: lumora_engine::SearchOptions,
        ) -> Result<Vec<lumora_engine::SearchHit>, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
        fn outline(&self, _: DocId) -> Result<Vec<lumora_engine::OutlineItem>, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
        fn page_links(
            &self,
            _: DocId,
            _: PageIndex,
        ) -> Result<Vec<lumora_engine::PageLink>, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
        fn properties(&self, _: DocId) -> Result<lumora_engine::DocProperties, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
    }

    fn service() -> (Arc<FakeEngine>, TileService) {
        let engine = Arc::new(FakeEngine::default());
        let service = TileService::new(engine.clone(), TileCache::default(), ImageFormat::Png);
        (engine, service)
    }

    #[test]
    fn caches_tiles_by_key() {
        let (engine, service) = service();
        let a = service.tile(1, 0, 1000, 0, 0, 0, false).unwrap();
        let b = service.tile(1, 0, 1000, 0, 0, 0, false).unwrap();
        assert!(Arc::ptr_eq(&a, &b));
        assert_eq!(engine.renders.load(Ordering::SeqCst), 1);
        assert_eq!(&a.bytes[1..4], b"PNG");

        // A new revision misses the cache.
        service.tile(1, 0, 1000, 0, 0, 1, false).unwrap();
        assert_eq!(engine.renders.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn skips_tiles_only_when_a_newer_report_leaves_the_page_out() {
        let (engine, service) = service();
        service.set_visible_pages(1, [5, 6]);
        // Requested now, page 0 renders even though it wasn't reported: it may have just
        // scrolled into view, ahead of the UI's next report.
        assert!(service.tile(1, 0, 1000, 0, 0, 0, false).is_ok());
        // A request made before a newer report that leaves its page out is dropped when the
        // engine gets to it (the engine side is covered by lumora-engine's tests).
        let since = service.visible.generation();
        service.set_visible_pages(1, [5, 6]);
        assert!(!service.visible.still_wanted(1, 1, since));
        assert!(service.visible.still_wanted(1, 5, since));
        // Thumbnails are never skipped.
        assert!(service.thumbnail(1, 0, 16, 0).is_ok());
        assert_eq!(engine.renders.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn does_not_cache_errors() {
        let (engine, service) = service();
        assert!(service.tile(7, 0, 1000, 0, 0, 0, false).is_err());
        assert!(service.tile(7, 0, 1000, 0, 0, 0, false).is_err());
        assert_eq!(engine.renders.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn forgets_closed_documents() {
        let (engine, service) = service();
        service.thumbnail(1, 0, 16, 0).unwrap();
        service.forget_doc(1);
        service.thumbnail(1, 0, 16, 0).unwrap();
        assert_eq!(engine.renders.load(Ordering::SeqCst), 2);
    }
}
