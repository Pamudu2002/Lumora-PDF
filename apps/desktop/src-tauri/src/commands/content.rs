//! Reading document content: outline, text, links and properties.

use std::sync::Arc;

use lumora_engine::{DocId, OutlineItem};
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
