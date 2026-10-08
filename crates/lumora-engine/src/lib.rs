//! The PDF engine for Lumora PDF: the [`PdfEngine`] trait, its types, and the PDFium-backed engine
//! worker ([`PdfiumEngine`]).
//!
//! This is the only crate that talks to PDFium. PDFium is not thread-safe, so [`PdfiumEngine`] runs
//! it on one dedicated worker thread that owns the library and every open document; callers send
//! requests over a channel and block on the reply (an actor). See the plan, sections 3.2 and 3.3.

mod engine;
mod error;
mod pdfium;
mod types;

pub use engine::PdfEngine;
pub use error::{EngineError, EngineErrorKind};
pub use pdfium::{PdfiumEngine, PdfiumLibrary};
pub use types::{
    DocId, DocInfo, MAX_SCALE, MAX_TILE_SIZE, MIN_SCALE, OpenOptions, PageIndex, PageSize,
    RgbaImage, TileRequest,
};
