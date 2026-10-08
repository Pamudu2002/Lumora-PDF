//! A byte-bounded LRU cache of encoded page images.

use std::sync::{Arc, Mutex, MutexGuard};

use lru::LruCache;
use lumora_engine::{DocId, PageIndex};

use crate::encode::ImageFormat;

/// What a cached image is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CacheKey {
    /// One tile (plan section 3.5: keyed by doc, page, scale, position, revision and dark mode).
    Tile {
        /// Document.
        doc: DocId,
        /// Page.
        page: PageIndex,
        /// Render scale × 1000.
        scale_milli: u32,
        /// Tile column.
        tile_x: u32,
        /// Tile row.
        tile_y: u32,
        /// Document revision; bumped by every edit so stale tiles are never served.
        rev: u64,
        /// Page dark mode.
        dark: bool,
    },
    /// A whole-page thumbnail.
    Thumbnail {
        /// Document.
        doc: DocId,
        /// Page.
        page: PageIndex,
        /// Longer edge in pixels.
        max_px: u32,
        /// Document revision.
        rev: u64,
    },
}

impl CacheKey {
    /// The document this entry belongs to.
    pub fn doc(&self) -> DocId {
        match *self {
            Self::Tile { doc, .. } | Self::Thumbnail { doc, .. } => doc,
        }
    }
}

/// An encoded image ready to send to the UI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodedImage {
    /// Encoded bytes.
    pub bytes: Vec<u8>,
    /// Format of `bytes`.
    pub format: ImageFormat,
}

struct Inner {
    entries: LruCache<CacheKey, Arc<EncodedImage>>,
    bytes: usize,
}

/// A thread-safe LRU cache limited by the total size of the encoded images it holds.
pub struct TileCache {
    inner: Mutex<Inner>,
    max_bytes: usize,
}

impl TileCache {
    /// Default budget: 256 MB (plan section 3.5).
    pub const DEFAULT_MAX_BYTES: usize = 256 * 1024 * 1024;

    /// A cache that holds at most `max_bytes` of encoded images.
    pub fn new(max_bytes: usize) -> Self {
        Self {
            inner: Mutex::new(Inner {
                entries: LruCache::unbounded(),
                bytes: 0,
            }),
            max_bytes,
        }
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // A panic while holding the lock can't leave the cache unsound, only stale; keep going.
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Looks up an entry and marks it most recently used.
    pub fn get(&self, key: &CacheKey) -> Option<Arc<EncodedImage>> {
        self.lock().entries.get(key).cloned()
    }

    /// Inserts an entry, evicting the least recently used ones to stay within budget.
    /// Images larger than the whole budget are not cached.
    pub fn insert(&self, key: CacheKey, image: Arc<EncodedImage>) {
        let size = image.bytes.len();
        if size > self.max_bytes {
            return;
        }
        let mut inner = self.lock();
        if let Some(old) = inner.entries.put(key, image) {
            inner.bytes -= old.bytes.len();
        }
        inner.bytes += size;
        while inner.bytes > self.max_bytes {
            match inner.entries.pop_lru() {
                Some((_, evicted)) => inner.bytes -= evicted.bytes.len(),
                None => break,
            }
        }
    }

    /// Drops every entry of a document (call when it closes).
    pub fn remove_doc(&self, doc: DocId) {
        let mut inner = self.lock();
        let mut freed = 0;
        inner.entries.retain(|key, image| {
            let keep = key.doc() != doc;
            if !keep {
                freed += image.bytes.len();
            }
            keep
        });
        inner.bytes -= freed;
    }

    /// Number of entries.
    pub fn len(&self) -> usize {
        self.lock().entries.len()
    }

    /// True when the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Total size of cached images in bytes.
    pub fn size_bytes(&self) -> usize {
        self.lock().bytes
    }
}

impl Default for TileCache {
    fn default() -> Self {
        Self::new(Self::DEFAULT_MAX_BYTES)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(doc: DocId, page: PageIndex) -> CacheKey {
        CacheKey::Tile {
            doc,
            page,
            scale_milli: 1000,
            tile_x: 0,
            tile_y: 0,
            rev: 0,
            dark: false,
        }
    }

    fn image(size: usize) -> Arc<EncodedImage> {
        Arc::new(EncodedImage {
            bytes: vec![0; size],
            format: ImageFormat::Png,
        })
    }

    #[test]
    fn evicts_least_recently_used_to_stay_within_budget() {
        let cache = TileCache::new(100);
        cache.insert(key(1, 0), image(40));
        cache.insert(key(1, 1), image(40));
        assert!(cache.get(&key(1, 0)).is_some()); // page 0 is now most recent
        cache.insert(key(1, 2), image(40)); // 120 > 100: evict page 1
        assert!(cache.get(&key(1, 1)).is_none());
        assert!(cache.get(&key(1, 0)).is_some());
        assert!(cache.get(&key(1, 2)).is_some());
        assert_eq!(cache.size_bytes(), 80);
    }

    #[test]
    fn replacing_an_entry_updates_the_size() {
        let cache = TileCache::new(100);
        cache.insert(key(1, 0), image(30));
        cache.insert(key(1, 0), image(50));
        assert_eq!((cache.len(), cache.size_bytes()), (1, 50));
    }

    #[test]
    fn skips_images_larger_than_the_budget() {
        let cache = TileCache::new(10);
        cache.insert(key(1, 0), image(11));
        assert!(cache.is_empty());
    }

    #[test]
    fn revision_is_part_of_the_key() {
        let cache = TileCache::new(100);
        cache.insert(key(1, 0), image(10));
        let mut newer = key(1, 0);
        if let CacheKey::Tile { rev, .. } = &mut newer {
            *rev = 1;
        }
        assert!(cache.get(&newer).is_none());
    }

    #[test]
    fn removes_a_documents_entries() {
        let cache = TileCache::new(1000);
        cache.insert(key(1, 0), image(10));
        cache.insert(key(1, 1), image(10));
        cache.insert(key(2, 0), image(10));
        cache.remove_doc(1);
        assert_eq!((cache.len(), cache.size_bytes()), (1, 10));
        assert!(cache.get(&key(2, 0)).is_some());
    }
}
