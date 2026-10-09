//! Document sessions, the `Command` trait, undo/redo and save logic for Lumora PDF.
//!
//! Phase 0 provides [`Documents`], the registry of open [`DocSession`]s. Commands and undo/redo
//! (plan section 3.4) arrive with the first editing feature in Phase 2.

mod documents;
mod search;
mod session;

pub use documents::Documents;
pub use search::{
    MAX_SEARCH_HITS, SearchId, SearchProgress, SearchRequest, Searches, search_document,
};
pub use session::{DocSession, DocSummary, Revision};
