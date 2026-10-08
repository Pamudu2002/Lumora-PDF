//! The engine trait: the only API the rest of Lumora uses to reach a PDF engine.

use std::path::Path;

use crate::error::EngineError;
use crate::types::{DocId, DocInfo, OpenOptions, PageIndex, PageSize, RgbaImage, TileRequest};

/// A PDF engine. Implemented by [`crate::PdfiumEngine`]; the trait keeps the rest of the app
/// independent of PDFium (and lets tests or a future engine swap it out).
///
/// Methods block until the engine replies. Call them from a worker or blocking task, never from
/// the UI thread. More methods (outline, text, search, annotations, mutations, save) arrive with
/// the phases that need them (plan section 3.3).
pub trait PdfEngine: Send + Sync {
    /// Opens a document and returns its id and facts about it.
    fn open(&self, path: &Path, opts: OpenOptions) -> Result<(DocId, DocInfo), EngineError>;

    /// Closes a document and frees its memory.
    fn close(&self, doc: DocId) -> Result<(), EngineError>;

    /// Display sizes of every page, in order.
    fn page_sizes(&self, doc: DocId) -> Result<Vec<PageSize>, EngineError>;

    /// Renders one tile of a page.
    fn render_tile(&self, req: TileRequest) -> Result<RgbaImage, EngineError>;

    /// Renders a whole page so its longer edge is `max_px` pixels.
    fn render_thumbnail(
        &self,
        doc: DocId,
        page: PageIndex,
        max_px: u32,
    ) -> Result<RgbaImage, EngineError>;
}
