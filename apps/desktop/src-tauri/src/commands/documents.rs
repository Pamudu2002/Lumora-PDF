//! Opening and closing documents.

use std::path::PathBuf;
use std::sync::Arc;

use lumora_core::DocSummary;
use lumora_engine::DocId;
use tauri::State;

use super::blocking;
use crate::error::AppError;
use crate::state::AppState;

/// Opens the PDF at `path` and returns what the UI needs to show it.
#[tauri::command]
#[specta::specta]
pub async fn open_document(
    state: State<'_, AppState>,
    path: String,
) -> Result<DocSummary, AppError> {
    let documents = Arc::clone(&state.core()?.documents);
    let path = PathBuf::from(path);
    blocking(move || documents.open(&path, None).map_err(AppError::from)).await
}

/// Closes a document and drops its cached tiles.
#[tauri::command]
#[specta::specta]
pub async fn close_document(state: State<'_, AppState>, doc_id: DocId) -> Result<(), AppError> {
    let core = state.core()?;
    core.searches.cancel(doc_id);
    let documents = Arc::clone(&core.documents);
    let tiles = Arc::clone(&core.tiles);
    blocking(move || {
        documents.close(doc_id)?;
        tiles.forget_doc(doc_id);
        Ok(())
    })
    .await
}
