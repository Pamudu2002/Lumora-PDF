//! The error type returned by Tauri commands.

use lumora_engine::{EngineError, EngineErrorKind};
use serde::Serialize;

/// An error sent to the UI. The UI picks the user-facing message from `kind`; `detail` is technical
/// and only for logs and bug reports.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    /// What went wrong.
    pub kind: EngineErrorKind,
    /// Technical detail.
    pub detail: String,
}

impl AppError {
    /// An unexpected internal error.
    pub fn internal(detail: impl Into<String>) -> Self {
        Self {
            kind: EngineErrorKind::Internal,
            detail: detail.into(),
        }
    }
}

impl From<EngineError> for AppError {
    fn from(err: EngineError) -> Self {
        Self {
            kind: err.kind(),
            detail: err.to_string(),
        }
    }
}
