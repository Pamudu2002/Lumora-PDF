//! One open document.

use std::path::{Path, PathBuf};

use lumora_engine::{DocId, DocInfo, PageSize};
use serde::Serialize;

/// A document revision. Bumped by every change, so tile URLs (which include it) change too and the
/// tile cache never serves stale pages.
pub type Revision = u32;

/// The app-side state of one open document.
#[derive(Debug, Clone)]
pub struct DocSession {
    id: DocId,
    path: PathBuf,
    info: DocInfo,
    page_sizes: Vec<PageSize>,
    revision: Revision,
}

impl DocSession {
    /// A session for a document the engine just opened.
    pub fn new(id: DocId, path: PathBuf, info: DocInfo, page_sizes: Vec<PageSize>) -> Self {
        Self {
            id,
            path,
            info,
            page_sizes,
            revision: 0,
        }
    }

    /// The engine's id for this document.
    pub fn id(&self) -> DocId {
        self.id
    }

    /// Where the document was opened from.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Facts about the document.
    pub fn info(&self) -> &DocInfo {
        &self.info
    }

    /// Display sizes of every page.
    pub fn page_sizes(&self) -> &[PageSize] {
        &self.page_sizes
    }

    /// The current revision.
    pub fn revision(&self) -> Revision {
        self.revision
    }

    /// Marks the document as changed: bumps the revision.
    pub fn bump_revision(&mut self) -> Revision {
        self.revision = self.revision.wrapping_add(1);
        self.revision
    }

    /// What the UI needs to show the document.
    pub fn summary(&self) -> DocSummary {
        DocSummary {
            id: self.id,
            path: self.path.to_string_lossy().into_owned(),
            file_name: self
                .path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| self.path.to_string_lossy().into_owned()),
            info: self.info.clone(),
            page_sizes: self.page_sizes.clone(),
            revision: self.revision,
        }
    }
}

/// An open document as the UI sees it.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocSummary {
    /// Engine document id; used in commands and tile URLs.
    pub id: DocId,
    /// Full path of the file.
    pub path: String,
    /// File name for tabs and titles.
    pub file_name: String,
    /// Facts about the document.
    pub info: DocInfo,
    /// Display size of every page, in points.
    pub page_sizes: Vec<PageSize>,
    /// Current revision (part of every tile URL).
    pub revision: Revision,
}
