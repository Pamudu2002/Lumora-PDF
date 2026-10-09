//! Which pages are on screen, so tiles for pages the user scrolled past can be dropped.

use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

use lumora_engine::{DocId, PageIndex};

/// The pages each document's view currently shows (plus a small margin), as reported by the UI.
/// A document the UI hasn't reported yet counts as "everything visible".
#[derive(Default)]
pub struct VisiblePages {
    pages: RwLock<HashMap<DocId, HashSet<PageIndex>>>,
}

impl VisiblePages {
    /// Replaces the visible set of a document.
    pub fn set(&self, doc: DocId, pages: impl IntoIterator<Item = PageIndex>) {
        let mut map = self.pages.write().unwrap_or_else(|e| e.into_inner());
        map.insert(doc, pages.into_iter().collect());
    }

    /// Forgets a document (it closed).
    pub fn remove(&self, doc: DocId) {
        let mut map = self.pages.write().unwrap_or_else(|e| e.into_inner());
        map.remove(&doc);
    }

    /// True when tiles of this page are still wanted.
    pub fn contains(&self, doc: DocId, page: PageIndex) -> bool {
        let map = self.pages.read().unwrap_or_else(|e| e.into_inner());
        map.get(&doc).is_none_or(|pages| pages.contains(&page))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_documents_are_fully_visible() {
        let v = VisiblePages::default();
        assert!(v.contains(1, 99));
        v.set(1, [3, 4]);
        assert!(v.contains(1, 3));
        assert!(!v.contains(1, 99));
        assert!(v.contains(2, 99));
        v.remove(1);
        assert!(v.contains(1, 99));
    }
}
