//! Reading document content: outline, text, links and properties.

use std::sync::Arc;

use lumora_engine::{
    DocId, DocProperties, EngineErrorKind, OutlineItem, PageIndex, PageLink, PageText,
};
use serde::Serialize;
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

/// The links on one page: areas that go to another page or to a URL.
#[tauri::command]
#[specta::specta]
pub async fn get_page_links(
    state: State<'_, AppState>,
    doc_id: DocId,
    page: PageIndex,
) -> Result<Vec<PageLink>, AppError> {
    let engine = Arc::clone(state.core()?.tiles.engine());
    blocking(move || engine.page_links(doc_id, page).map_err(AppError::from)).await
}

/// Everything the Document properties dialog shows.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DocumentProperties {
    /// Metadata, version, encryption and fonts from the engine.
    pub properties: DocProperties,
    /// Size of the file on disk in bytes, if it could be read.
    pub file_size_bytes: Option<f64>,
}

/// Facts about a document for the Document properties dialog.
#[tauri::command]
#[specta::specta]
pub async fn get_properties(
    state: State<'_, AppState>,
    doc_id: DocId,
) -> Result<DocumentProperties, AppError> {
    let core = state.core()?;
    let engine = Arc::clone(core.tiles.engine());
    let path = core
        .documents
        .summary(doc_id)
        .map(|s| s.path)
        .ok_or_else(|| AppError {
            kind: EngineErrorKind::UnknownDocument,
            detail: format!("document {doc_id} is not open"),
        })?;
    blocking(move || {
        let properties = engine.properties(doc_id)?;
        #[allow(clippy::cast_precision_loss)]
        let file_size_bytes = std::fs::metadata(&path).ok().map(|m| m.len() as f64);
        Ok(DocumentProperties {
            properties,
            file_size_bytes,
        })
    })
    .await
}
