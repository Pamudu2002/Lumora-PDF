//! Which pages are on screen, so tiles for pages the user scrolled past can be dropped.

use std::collections::{HashMap, HashSet};
use std::sync::RwLock;
use std::sync::atomic::{AtomicU64, Ordering};

use lumora_engine::{DocId, PageIndex};

/// The pages each document's view currently shows (plus a small margin), as reported by the UI.
///
/// Reports are numbered. A tile request remembers the number current when it was made, and is
/// dropped only if a *newer* report leaves its page out. That way a page that has just scrolled
/// into view (whose tiles may arrive before the UI's next report) is never dropped by mistake.
#[derive(Default)]
pub struct VisiblePages {
    pages: RwLock<HashMap<DocId, HashSet<PageIndex>>>,
    generation: AtomicU64,
}

impl VisiblePages {
    /// Replaces the visible set of a document.
    pub fn set(&self, doc: DocId, pages: impl IntoIterator<Item = PageIndex>) {
        let mut map = self.pages.write().unwrap_or_else(|e| e.into_inner());
        map.insert(doc, pages.into_iter().collect());
        self.generation.fetch_add(1, Ordering::SeqCst);
    }

    /// Forgets a document (it closed).
    pub fn remove(&self, doc: DocId) {
        let mut map = self.pages.write().unwrap_or_else(|e| e.into_inner());
        map.remove(&doc);
        self.generation.fetch_add(1, Ordering::SeqCst);
    }

    /// The number of the latest report; pass it to [`VisiblePages::still_wanted`] later.
    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }

    /// True when a tile of `page`, requested at report `since`, should still be rendered.
    pub fn still_wanted(&self, doc: DocId, page: PageIndex, since: u64) -> bool {
        if self.generation() == since {
            return true; // no newer report: keep it
        }
        self.contains(doc, page)
    }

    /// True when the latest report includes the page (or the document has no report yet).
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

    #[test]
    fn only_newer_reports_drop_a_request() {
        let v = VisiblePages::default();
        v.set(1, [3, 4]);
        // Page 5 just scrolled into view; its tile is requested before the UI reports it.
        let since = v.generation();
        assert!(v.still_wanted(1, 5, since));
        // The next report includes it: still wanted.
        v.set(1, [4, 5]);
        assert!(v.still_wanted(1, 5, since));
        // A later report leaves it out: dropped.
        v.set(1, [9]);
        assert!(!v.still_wanted(1, 5, since));
    }
}
