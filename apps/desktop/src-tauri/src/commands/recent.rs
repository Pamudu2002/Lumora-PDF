//! Recent files on the home screen, and the view each document was left in.

use lumora_store::{RecentFile, SavedView};
use serde::Serialize;
use tauri::State;

use super::blocking;
use crate::error::AppError;
use crate::state::AppState;

/// A recent file and whether it is still there.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    /// The file as last opened.
    pub file: RecentFile,
    /// False when the file has been moved or deleted since.
    pub exists: bool,
}

/// Recently opened files, newest first. Empty when the database is unavailable.
#[tauri::command]
#[specta::specta]
pub async fn list_recent_files(state: State<'_, AppState>) -> Result<Vec<RecentEntry>, AppError> {
    let Some(store) = state.store() else {
        return Ok(Vec::new());
    };
    blocking(move || {
        let files = store
            .recent_files()
            .map_err(|err| AppError::internal(err.to_string()))?;
        Ok(files
            .into_iter()
            .map(|file| {
                let exists = std::path::Path::new(&file.path).is_file();
                RecentEntry { file, exists }
            })
            .collect())
    })
    .await
}

/// Takes a file off the recent list.
#[tauri::command]
#[specta::specta]
pub async fn remove_recent_file(state: State<'_, AppState>, path: String) -> Result<(), AppError> {
    let Some(store) = state.store() else {
        return Ok(());
    };
    blocking(move || {
        store
            .remove_recent(&path)
            .map_err(|err| AppError::internal(err.to_string()))
    })
    .await
}

/// Remembers the page and zoom of an open document, to restore them next time.
#[tauri::command]
#[specta::specta]
pub async fn save_view(
    state: State<'_, AppState>,
    path: String,
    view: SavedView,
) -> Result<(), AppError> {
    let Some(store) = state.store() else {
        return Ok(());
    };
    blocking(move || {
        store
            .save_view(&path, &view)
            .map_err(|err| AppError::internal(err.to_string()))
    })
    .await
}
