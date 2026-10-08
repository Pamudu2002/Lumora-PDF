//! The registry of open documents.

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, RwLock, RwLockReadGuard, RwLockWriteGuard};

use lumora_engine::{DocId, EngineError, OpenOptions, PdfEngine};

use crate::session::{DocSession, DocSummary, Revision};

/// Every open document, backed by a [`PdfEngine`]. Methods block on the engine; call them from a
/// blocking task, not the UI thread.
pub struct Documents {
    engine: Arc<dyn PdfEngine>,
    sessions: RwLock<HashMap<DocId, DocSession>>,
}

impl Documents {
    /// An empty registry over `engine`.
    pub fn new(engine: Arc<dyn PdfEngine>) -> Self {
        Self {
            engine,
            sessions: RwLock::new(HashMap::new()),
        }
    }

    fn read(&self) -> RwLockReadGuard<'_, HashMap<DocId, DocSession>> {
        self.sessions.read().unwrap_or_else(|e| e.into_inner())
    }

    fn write(&self) -> RwLockWriteGuard<'_, HashMap<DocId, DocSession>> {
        self.sessions.write().unwrap_or_else(|e| e.into_inner())
    }

    /// Opens a document. The same file can be opened more than once (each gets its own id).
    pub fn open(&self, path: &Path, password: Option<String>) -> Result<DocSummary, EngineError> {
        let (id, info) = self.engine.open(path, OpenOptions { password })?;
        let page_sizes = match self.engine.page_sizes(id) {
            Ok(sizes) => sizes,
            Err(err) => {
                let _ = self.engine.close(id);
                return Err(err);
            }
        };
        let session = DocSession::new(id, path.to_path_buf(), info, page_sizes);
        let summary = session.summary();
        self.write().insert(id, session);
        tracing::info!(doc = id, pages = summary.info.page_count, "document opened");
        Ok(summary)
    }

    /// Closes a document.
    pub fn close(&self, id: DocId) -> Result<(), EngineError> {
        let removed = self.write().remove(&id);
        if removed.is_none() {
            return Err(EngineError::UnknownDocument(id));
        }
        self.engine.close(id)?;
        tracing::info!(doc = id, "document closed");
        Ok(())
    }

    /// The summary of an open document.
    pub fn summary(&self, id: DocId) -> Option<DocSummary> {
        self.read().get(&id).map(DocSession::summary)
    }

    /// The current revision of an open document.
    pub fn revision(&self, id: DocId) -> Option<Revision> {
        self.read().get(&id).map(DocSession::revision)
    }

    /// Ids of all open documents.
    pub fn ids(&self) -> Vec<DocId> {
        self.read().keys().copied().collect()
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::Mutex;

    use lumora_engine::{DocInfo, PageIndex, PageSize, RgbaImage, TileRequest};

    use super::*;

    /// A fake engine that "opens" any path and records closes.
    #[derive(Default)]
    struct FakeEngine {
        next: Mutex<DocId>,
        closed: Mutex<Vec<DocId>>,
    }

    impl PdfEngine for FakeEngine {
        fn open(&self, path: &Path, _: OpenOptions) -> Result<(DocId, DocInfo), EngineError> {
            if path.ends_with("broken.pdf") {
                return Err(EngineError::Malformed);
            }
            let mut next = self.next.lock().unwrap();
            *next += 1;
            Ok((
                *next,
                DocInfo {
                    page_count: 2,
                    title: None,
                    author: None,
                    is_encrypted: false,
                    has_forms: false,
                    pdf_version: "1.7".into(),
                },
            ))
        }
        fn close(&self, doc: DocId) -> Result<(), EngineError> {
            self.closed.lock().unwrap().push(doc);
            Ok(())
        }
        fn page_sizes(&self, _: DocId) -> Result<Vec<PageSize>, EngineError> {
            Ok(vec![PageSize::sanitized(612.0, 792.0); 2])
        }
        fn render_tile(&self, _: TileRequest) -> Result<RgbaImage, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
        fn render_thumbnail(
            &self,
            _: DocId,
            _: PageIndex,
            _: u32,
        ) -> Result<RgbaImage, EngineError> {
            Err(EngineError::Internal("not used".into()))
        }
    }

    #[test]
    fn opens_and_closes_documents() {
        let engine = Arc::new(FakeEngine::default());
        let docs = Documents::new(engine.clone());
        let path = PathBuf::from("C:/files/Annual report.pdf");

        let summary = docs.open(&path, None).unwrap();
        assert_eq!(summary.file_name, "Annual report.pdf");
        assert_eq!(summary.page_sizes.len(), 2);
        assert_eq!(summary.revision, 0);
        assert_eq!(docs.revision(summary.id), Some(0));

        let second = docs.open(&path, None).unwrap();
        assert_ne!(summary.id, second.id);

        docs.close(summary.id).unwrap();
        assert!(docs.summary(summary.id).is_none());
        assert_eq!(*engine.closed.lock().unwrap(), vec![summary.id]);
        assert!(matches!(
            docs.close(summary.id),
            Err(EngineError::UnknownDocument(_))
        ));
        assert_eq!(docs.ids(), vec![second.id]);
    }

    #[test]
    fn passes_engine_errors_through() {
        let docs = Documents::new(Arc::new(FakeEngine::default()));
        assert!(matches!(
            docs.open(Path::new("broken.pdf"), None),
            Err(EngineError::Malformed)
        ));
        assert!(docs.ids().is_empty());
    }

    #[test]
    fn revisions_bump() {
        let mut s = DocSession::new(1, PathBuf::from("a.pdf"), sample_info(), Vec::new());
        assert_eq!(s.bump_revision(), 1);
        assert_eq!(s.summary().revision, 1);
    }

    fn sample_info() -> DocInfo {
        DocInfo {
            page_count: 0,
            title: None,
            author: None,
            is_encrypted: false,
            has_forms: false,
            pdf_version: "1.7".into(),
        }
    }
}
