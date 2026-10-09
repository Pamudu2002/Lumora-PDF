//! Tauri commands. Keep them thin: validate input, then call `lumora-core` on a blocking thread.

pub mod documents;
pub mod view;

use crate::error::AppError;

/// Runs blocking core work off the async runtime and flattens join errors into [`AppError`].
async fn blocking<T, F>(f: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::internal(format!("background task failed: {e}")))?
}
