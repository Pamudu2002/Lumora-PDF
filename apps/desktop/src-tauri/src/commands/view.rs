//! Viewing a document: which pages are on screen.

use std::sync::Arc;

use lumora_engine::{DocId, PageIndex};
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

/// Tells the renderer which pages are mounted. Tiles already queued for other pages are skipped,
/// so fast scrolling doesn't leave a backlog of renders nobody will see.
#[tauri::command]
#[specta::specta]
pub fn set_visible_pages(
    state: State<'_, AppState>,
    doc_id: DocId,
    pages: Vec<PageIndex>,
) -> Result<(), AppError> {
    let tiles = Arc::clone(&state.core()?.tiles);
    tiles.set_visible_pages(doc_id, pages);
    Ok(())
}
