//! Engine errors.

use serde::Serialize;
use thiserror::Error;

use crate::types::{DocId, PageIndex};

/// Everything that can go wrong in the engine. PDFs are untrusted input, so every failure on
/// PDF-derived data is an error value, never a panic.
#[derive(Debug, Error)]
pub enum EngineError {
    /// The PDFium library could not be loaded.
    #[error("the PDF engine could not be loaded: {0}")]
    LibraryLoad(String),

    /// The file does not exist.
    #[error("file not found")]
    FileNotFound,

    /// The file could not be read.
    #[error("the file could not be read: {0}")]
    Io(String),

    /// The document is encrypted and needs a password.
    #[error("this document needs a password")]
    PasswordRequired,

    /// The supplied password is wrong.
    #[error("the password is incorrect")]
    WrongPassword,

    /// The file is not a PDF or is too damaged to open.
    #[error("the file is damaged or is not a PDF")]
    Malformed,

    /// The document uses a security handler PDFium does not support.
    #[error("this document uses unsupported security settings")]
    UnsupportedSecurity,

    /// No open document has this id.
    #[error("document {0} is not open")]
    UnknownDocument(DocId),

    /// The page index is past the end of the document.
    #[error("page {page} does not exist (document has {page_count} pages)")]
    PageOutOfRange {
        /// The requested page.
        page: PageIndex,
        /// Pages in the document.
        page_count: u32,
    },

    /// The request itself is invalid (bad scale, tile outside the page, …).
    #[error("invalid request: {0}")]
    InvalidRequest(String),

    /// PDFium failed while rendering.
    #[error("the page could not be rendered: {0}")]
    Render(String),

    /// The request was dropped because its result is no longer needed (e.g. a tile scrolled away).
    #[error("the request was cancelled")]
    Cancelled,

    /// The engine worker has stopped (shut down or crashed).
    #[error("the PDF engine has stopped")]
    WorkerStopped,

    /// An unexpected internal error (including a caught panic).
    #[error("internal engine error: {0}")]
    Internal(String),
}

/// A stable, serializable error code for the UI (which picks the user-facing message).
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EngineErrorKind {
    /// See [`EngineError::LibraryLoad`].
    LibraryLoad,
    /// See [`EngineError::FileNotFound`].
    FileNotFound,
    /// See [`EngineError::Io`].
    Io,
    /// See [`EngineError::PasswordRequired`].
    PasswordRequired,
    /// See [`EngineError::WrongPassword`].
    WrongPassword,
    /// See [`EngineError::Malformed`].
    Malformed,
    /// See [`EngineError::UnsupportedSecurity`].
    UnsupportedSecurity,
    /// See [`EngineError::UnknownDocument`].
    UnknownDocument,
    /// See [`EngineError::PageOutOfRange`].
    PageOutOfRange,
    /// See [`EngineError::InvalidRequest`].
    InvalidRequest,
    /// See [`EngineError::Render`].
    Render,
    /// See [`EngineError::Cancelled`].
    Cancelled,
    /// See [`EngineError::WorkerStopped`].
    WorkerStopped,
    /// See [`EngineError::Internal`].
    Internal,
}

impl EngineError {
    /// The error's stable code.
    pub fn kind(&self) -> EngineErrorKind {
        match self {
            Self::LibraryLoad(_) => EngineErrorKind::LibraryLoad,
            Self::FileNotFound => EngineErrorKind::FileNotFound,
            Self::Io(_) => EngineErrorKind::Io,
            Self::PasswordRequired => EngineErrorKind::PasswordRequired,
            Self::WrongPassword => EngineErrorKind::WrongPassword,
            Self::Malformed => EngineErrorKind::Malformed,
            Self::UnsupportedSecurity => EngineErrorKind::UnsupportedSecurity,
            Self::UnknownDocument(_) => EngineErrorKind::UnknownDocument,
            Self::PageOutOfRange { .. } => EngineErrorKind::PageOutOfRange,
            Self::InvalidRequest(_) => EngineErrorKind::InvalidRequest,
            Self::Render(_) => EngineErrorKind::Render,
            Self::Cancelled => EngineErrorKind::Cancelled,
            Self::WorkerStopped => EngineErrorKind::WorkerStopped,
            Self::Internal(_) => EngineErrorKind::Internal,
        }
    }
}
