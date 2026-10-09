//! The engine trait: the only API the rest of Lumora uses to reach a PDF engine.

use std::path::Path;
use std::sync::Arc;

use crate::content::{DocProperties, OutlineItem, PageLink, PageText, SearchHit, SearchOptions};
use crate::error::EngineError;
use crate::types::{DocId, DocInfo, OpenOptions, PageIndex, PageSize, RgbaImage, TileRequest};

/// Asked just before a queued tile is rendered; returning `false` skips it (the page scrolled out
/// of view), and the render fails with [`EngineError::Cancelled`].
pub type StillNeeded = Arc<dyn Fn() -> bool + Send + Sync>;

/// A PDF engine. Implemented by [`crate::PdfiumEngine`]; the trait keeps the rest of the app
/// independent of PDFium (and lets tests or a future engine swap it out).
///
/// Methods block until the engine replies. Call them from a worker or blocking task, never from
/// the UI thread. More methods (annotations, mutations, save) arrive with the phases that need
/// them (plan section 3.3).
pub trait PdfEngine: Send + Sync {
    /// Opens a document and returns its id and facts about it.
    fn open(&self, path: &Path, opts: OpenOptions) -> Result<(DocId, DocInfo), EngineError>;

    /// Closes a document and frees its memory.
    fn close(&self, doc: DocId) -> Result<(), EngineError>;

    /// Display sizes of every page, in order.
    fn page_sizes(&self, doc: DocId) -> Result<Vec<PageSize>, EngineError>;

    /// Renders one tile of a page.
    fn render_tile(&self, req: TileRequest) -> Result<RgbaImage, EngineError>;

    /// Renders one tile unless `still_needed` says it is no longer wanted by the time the engine
    /// gets to it. The default implementation checks once, up front.
    fn render_tile_if(
        &self,
        req: TileRequest,
        still_needed: StillNeeded,
    ) -> Result<RgbaImage, EngineError> {
        if still_needed() {
            self.render_tile(req)
        } else {
            Err(EngineError::Cancelled)
        }
    }

    /// Renders a whole page so its longer edge is `max_px` pixels.
    fn render_thumbnail(
        &self,
        doc: DocId,
        page: PageIndex,
        max_px: u32,
    ) -> Result<RgbaImage, EngineError>;

    /// The text of a page, as positioned runs in reading order.
    fn page_text(&self, doc: DocId, page: PageIndex) -> Result<PageText, EngineError>;

    /// Searches one page. Whole-document search calls this page by page, so tile renders can run
    /// in between.
    fn search_page(
        &self,
        doc: DocId,
        page: PageIndex,
        query: &str,
        opts: SearchOptions,
    ) -> Result<Vec<SearchHit>, EngineError>;

    /// The document outline (bookmarks). Empty when the document has none.
    fn outline(&self, doc: DocId) -> Result<Vec<OutlineItem>, EngineError>;

    /// The links on a page.
    fn page_links(&self, doc: DocId, page: PageIndex) -> Result<Vec<PageLink>, EngineError>;

    /// Facts for the Document properties dialog.
    fn properties(&self, doc: DocId) -> Result<DocProperties, EngineError>;
}
