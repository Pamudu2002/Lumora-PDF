//! Opening and closing documents.

use std::path::PathBuf;
use std::sync::Arc;

use lumora_core::DocSummary;
use lumora_engine::DocId;
use lumora_store::SavedView;
use serde::Serialize;
use tauri::State;

use super::blocking;
use crate::error::AppError;
use crate::state::AppState;

/// An opened document and how it was last viewed.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDocument {
    /// What the UI needs to show the document.
    pub document: DocSummary,
    /// The page and zoom it was left at (defaults for a file not opened before).
    pub view: SavedView,
}

/// Opens the PDF at `path` (with `password` for a protected file), adds it to the recent files
/// and returns what the UI needs to show it. The password is never logged or stored.
#[tauri::command]
#[specta::specta]
pub async fn open_document(
    state: State<'_, AppState>,
    path: String,
    password: Option<String>,
) -> Result<OpenedDocument, AppError> {
    let documents = Arc::clone(&state.core()?.documents);
    let store = state.store();
    blocking(move || {
        let document = documents.open(&PathBuf::from(&path), password)?;
        let view = store
            .and_then(|store| {
                store
                    .record_open(&path, &document.file_name, document.info.page_count)
                    .inspect_err(|err| tracing::warn!(%err, "could not record a recent file"))
                    .ok()
            })
            .unwrap_or_default();
        Ok(OpenedDocument { document, view })
    })
    .await
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
