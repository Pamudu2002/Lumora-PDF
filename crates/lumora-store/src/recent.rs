//! Recently opened files and the view each was left in.

use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};

use crate::{Store, StoreError};

/// The list keeps this many files; older ones drop off.
pub const MAX_RECENT_FILES: usize = 50;
/// Longest zoom mode name stored (they are short identifiers like "fitWidth").
const MAX_ZOOM_MODE_LEN: usize = 16;

/// How a document was last viewed, restored when it is opened again.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedView {
    /// Zero-based page the reader was on.
    pub page: u32,
    /// Zoom factor (1 = 100%), if one was saved.
    pub zoom: Option<f64>,
    /// Zoom mode ("custom", "fitWidth", "fitPage", "auto"), if one was saved.
    pub zoom_mode: Option<String>,
}

/// A recently opened file.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    /// Full path, as last opened.
    pub path: String,
    /// File name for display.
    pub file_name: String,
    /// Pages when last opened.
    pub page_count: u32,
    /// When it was last opened, in milliseconds since the Unix epoch.
    pub last_opened_ms: f64,
    /// How it was last viewed.
    pub view: SavedView,
}

/// The identity of a path in the list. Windows paths are case-insensitive and accept either slash.
fn key_of(path: &str) -> String {
    if cfg!(windows) {
        path.replace('/', "\\").to_lowercase()
    } else {
        path.to_string()
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| i64::try_from(d.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

fn to_u32(v: i64) -> u32 {
    u32::try_from(v).unwrap_or(0)
}

/// Drops values that can't be a real zoom or zoom mode, so a damaged row can't break the viewer.
fn sanitize(view: &SavedView) -> SavedView {
    SavedView {
        page: view.page,
        zoom: view
            .zoom
            .filter(|z| z.is_finite() && *z > 0.0 && *z <= 100.0),
        zoom_mode: view
            .zoom_mode
            .clone()
            .filter(|m| !m.is_empty() && m.len() <= MAX_ZOOM_MODE_LEN),
    }
}

fn view_from_row(row: &Row<'_>, page_count: u32) -> rusqlite::Result<SavedView> {
    let page = to_u32(row.get("last_page")?);
    Ok(sanitize(&SavedView {
        // The file may have fewer pages than when it was last viewed.
        page: page.min(page_count.saturating_sub(1)),
        zoom: row.get("zoom")?,
        zoom_mode: row.get("zoom_mode")?,
    }))
}

impl Store {
    /// Records that `path` was opened now and returns how it was last viewed (the default view
    /// for a file not seen before).
    pub fn record_open(
        &self,
        path: &str,
        file_name: &str,
        page_count: u32,
    ) -> Result<SavedView, StoreError> {
        let key = key_of(path);
        let conn = self.conn();
        conn.execute(
            "INSERT INTO recent_files (key, path, file_name, page_count, last_opened)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(key) DO UPDATE SET
                path = excluded.path,
                file_name = excluded.file_name,
                page_count = excluded.page_count,
                last_opened = excluded.last_opened",
            params![key, path, file_name, page_count, now_ms()],
        )?;
        conn.execute(
            "DELETE FROM recent_files WHERE key NOT IN
                (SELECT key FROM recent_files ORDER BY last_opened DESC LIMIT ?1)",
            params![i64::try_from(MAX_RECENT_FILES).unwrap_or(i64::MAX)],
        )?;
        let view = conn
            .query_row(
                "SELECT last_page, zoom, zoom_mode FROM recent_files WHERE key = ?1",
                params![key],
                |row| view_from_row(row, page_count),
            )
            .optional()?;
        Ok(view.unwrap_or_default())
    }

    /// Recent files, most recently opened first.
    pub fn recent_files(&self) -> Result<Vec<RecentFile>, StoreError> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT path, file_name, page_count, last_opened, last_page, zoom, zoom_mode
             FROM recent_files ORDER BY last_opened DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(
            params![i64::try_from(MAX_RECENT_FILES).unwrap_or(i64::MAX)],
            |row| {
                let page_count = to_u32(row.get("page_count")?);
                let last_opened: i64 = row.get("last_opened")?;
                Ok(RecentFile {
                    path: row.get("path")?,
                    file_name: row.get("file_name")?,
                    page_count,
                    #[allow(clippy::cast_precision_loss)]
                    last_opened_ms: last_opened as f64,
                    view: view_from_row(row, page_count)?,
                })
            },
        )?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Remembers how a recent file is being viewed. Does nothing for files not in the list.
    pub fn save_view(&self, path: &str, view: &SavedView) -> Result<(), StoreError> {
        let view = sanitize(view);
        self.conn().execute(
            "UPDATE recent_files SET last_page = ?2, zoom = ?3, zoom_mode = ?4 WHERE key = ?1",
            params![key_of(path), view.page, view.zoom, view.zoom_mode],
        )?;
        Ok(())
    }

    /// Takes a file off the recent list.
    pub fn remove_recent(&self, path: &str) -> Result<(), StoreError> {
        self.conn().execute(
            "DELETE FROM recent_files WHERE key = ?1",
            params![key_of(path)],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> Store {
        Store::open_in_memory().unwrap()
    }

    #[test]
    fn lists_files_most_recent_first() {
        let s = store();
        s.record_open("C:\\a.pdf", "a.pdf", 3).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        s.record_open("C:\\b.pdf", "b.pdf", 7).unwrap();
        let files = s.recent_files().unwrap();
        let names: Vec<_> = files.iter().map(|f| f.file_name.as_str()).collect();
        assert_eq!(names, ["b.pdf", "a.pdf"]);
        assert_eq!(files[0].page_count, 7);
        assert!(files[0].last_opened_ms > 0.0);
    }

    #[test]
    fn remembers_the_view_of_each_file() {
        let s = store();
        assert_eq!(
            s.record_open("/docs/a.pdf", "a.pdf", 10).unwrap(),
            SavedView::default()
        );
        let view = SavedView {
            page: 6,
            zoom: Some(1.5),
            zoom_mode: Some("custom".into()),
        };
        s.save_view("/docs/a.pdf", &view).unwrap();
        assert_eq!(s.record_open("/docs/a.pdf", "a.pdf", 10).unwrap(), view);
        // The file shrank: the page is clamped to the last one.
        assert_eq!(s.record_open("/docs/a.pdf", "a.pdf", 4).unwrap().page, 3);
        // Views of files that aren't in the list are ignored.
        s.save_view("/docs/other.pdf", &view).unwrap();
        assert_eq!(s.recent_files().unwrap().len(), 1);
    }

    #[test]
    fn ignores_impossible_zoom_values() {
        let s = store();
        s.record_open("/a.pdf", "a.pdf", 1).unwrap();
        let bad = SavedView {
            page: 0,
            zoom: Some(f64::NAN),
            zoom_mode: Some("x".repeat(100)),
        };
        s.save_view("/a.pdf", &bad).unwrap();
        assert_eq!(
            s.record_open("/a.pdf", "a.pdf", 1).unwrap(),
            SavedView::default()
        );
    }

    #[cfg(windows)]
    #[test]
    fn treats_windows_paths_case_insensitively() {
        let s = store();
        s.record_open("C:\\Docs\\A.pdf", "A.pdf", 1).unwrap();
        s.record_open("c:/docs/a.pdf", "a.pdf", 1).unwrap();
        let files = s.recent_files().unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "c:/docs/a.pdf");
        s.remove_recent("C:\\DOCS\\A.PDF").unwrap();
        assert!(s.recent_files().unwrap().is_empty());
    }

    #[test]
    fn keeps_only_the_newest_files() {
        let s = store();
        for i in 0..MAX_RECENT_FILES + 5 {
            s.record_open(&format!("/f{i}.pdf"), "f.pdf", 1).unwrap();
        }
        assert_eq!(s.recent_files().unwrap().len(), MAX_RECENT_FILES);
    }

    #[test]
    fn reopening_an_existing_database_keeps_its_data() {
        let dir = std::env::temp_dir().join(format!("lumora-store-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("lumora.db");
        let _ = std::fs::remove_file(&path);
        Store::open(&path)
            .unwrap()
            .record_open("/a.pdf", "a.pdf", 2)
            .unwrap();
        let files = Store::open(&path).unwrap().recent_files().unwrap();
        assert_eq!(files.len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_a_database_from_a_newer_version() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "user_version", 99).unwrap();
        assert!(matches!(
            Store::with_connection(conn),
            Err(StoreError::TooNew { found: 99, .. })
        ));
    }
}
