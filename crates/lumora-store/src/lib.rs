//! Local SQLite storage for Lumora PDF: recent files and how each was last viewed. Settings and
//! the library arrive in later tasks as further schema migrations.

mod recent;
mod schema;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

pub use recent::{MAX_RECENT_FILES, RecentFile, SavedView};

/// Errors reading or writing the local database.
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    /// SQLite reported an error.
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    /// The database was written by a newer Lumora PDF.
    #[error(
        "the database is from a newer version of Lumora PDF (schema {found}, supported {supported})"
    )]
    TooNew {
        /// Schema version in the file.
        found: i64,
        /// Newest schema this build understands.
        supported: i64,
    },
}

/// The local database. Cheap calls; use from a blocking thread, not the UI thread.
pub struct Store {
    conn: Mutex<Connection>,
}

impl Store {
    /// Opens (or creates) the database file and brings its schema up to date.
    pub fn open(path: &Path) -> Result<Self, StoreError> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.busy_timeout(std::time::Duration::from_secs(2))?;
        Self::with_connection(conn)
    }

    /// A database that lives only in memory (tests).
    pub fn open_in_memory() -> Result<Self, StoreError> {
        Self::with_connection(Connection::open_in_memory()?)
    }

    fn with_connection(mut conn: Connection) -> Result<Self, StoreError> {
        schema::migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn conn(&self) -> MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }
}
