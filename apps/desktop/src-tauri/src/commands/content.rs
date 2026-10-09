//! Reading document content: outline, text, links and properties.

use std::sync::Arc;

use lumora_engine::{DocId, OutlineItem, PageIndex, PageText};
use tauri::State;

use super::blocking;
use crate::error::AppError;
use crate::state::AppState;

/// The document outline (bookmarks); empty when the document has none.
#[tauri::command]
#[specta::specta]
pub async fn get_outline(
    state: State<'_, AppState>,
    doc_id: DocId,
) -> Result<Vec<OutlineItem>, AppError> {
    let engine = Arc::clone(state.core()?.tiles.engine());
    blocking(move || engine.outline(doc_id).map_err(AppError::from)).await
}

/// The text runs of one page with their positions, for the selectable text layer.
#[tauri::command]
#[specta::specta]
pub async fn get_page_text(
    state: State<'_, AppState>,
    doc_id: DocId,
    page: PageIndex,
) -> Result<PageText, AppError> {
    let engine = Arc::clone(state.core()?.tiles.engine());
    blocking(move || engine.page_text(doc_id, page).map_err(AppError::from)).await
}
