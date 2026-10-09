//! Find in document: searches run on a job thread and stream results to the UI as events.

use std::sync::Arc;

use lumora_core::{SearchId, SearchProgress, SearchRequest};
use lumora_engine::{DocId, EngineErrorKind, PageIndex, SearchOptions};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_specta::Event;

use crate::error::AppError;
use crate::state::AppState;

/// Longest query accepted, in characters.
const MAX_QUERY_CHARS: usize = 1_000;

/// Progress of a running search: new matches since the previous event.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct SearchProgressEvent {
    /// The document searched.
    pub doc_id: DocId,
    /// The search this belongs to; events of older searches can arrive after a new one starts.
    pub search_id: SearchId,
    /// Matches and counters.
    pub progress: SearchProgress,
}

/// Starts searching a document for `query`, beginning at `start_page` and wrapping around.
/// Cancels the document's previous search. Results arrive as [`SearchProgressEvent`]s.
#[tauri::command]
#[specta::specta]
pub fn start_search(
    app: AppHandle,
    state: State<'_, AppState>,
    doc_id: DocId,
    query: String,
    options: SearchOptions,
    start_page: PageIndex,
) -> Result<SearchId, AppError> {
    let core = state.core()?;
    let summary = core.documents.summary(doc_id).ok_or_else(|| AppError {
        kind: EngineErrorKind::UnknownDocument,
        detail: format!("document {doc_id} is not open"),
    })?;
    if query.trim().is_empty() || query.chars().count() > MAX_QUERY_CHARS {
        return Err(AppError {
            kind: EngineErrorKind::InvalidRequest,
            detail: "search query is empty or too long".into(),
        });
    }
    let request = SearchRequest {
        doc: doc_id,
        page_count: summary.info.page_count,
        start_page,
        query,
        opts: options,
    };
    Arc::clone(&core.searches)
        .start(request, move |search_id, progress| {
            let event = SearchProgressEvent {
                doc_id,
                search_id,
                progress,
            };
            if let Err(err) = event.emit(&app) {
                tracing::warn!(%err, "could not send search progress");
            }
        })
        .map_err(|err| AppError::internal(err.to_string()))
}

/// Stops the document's running search, if any.
#[tauri::command]
#[specta::specta]
pub fn cancel_search(state: State<'_, AppState>, doc_id: DocId) -> Result<(), AppError> {
    state.core()?.searches.cancel(doc_id);
    Ok(())
}
