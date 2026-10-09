//! Schema migrations, tracked with SQLite's `user_version`.

use rusqlite::Connection;

use crate::StoreError;

/// Each entry upgrades the schema by one version; never edit one that has shipped.
const MIGRATIONS: &[&str] = &[
    // 1: recent files with their last view.
    "CREATE TABLE recent_files (
        key          TEXT PRIMARY KEY,
        path         TEXT NOT NULL,
        file_name    TEXT NOT NULL,
        page_count   INTEGER NOT NULL,
        last_opened  INTEGER NOT NULL,
        last_page    INTEGER NOT NULL DEFAULT 0,
        zoom         REAL,
        zoom_mode    TEXT
    );
    CREATE INDEX recent_files_by_time ON recent_files (last_opened DESC);",
];

/// Applies every migration newer than the database's version, in one transaction.
pub(crate) fn migrate(conn: &mut Connection) -> Result<(), StoreError> {
    let supported = i64::try_from(MIGRATIONS.len()).unwrap_or(i64::MAX);
    let found: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if found > supported {
        return Err(StoreError::TooNew { found, supported });
    }
    let tx = conn.transaction()?;
    for (version, sql) in MIGRATIONS
        .iter()
        .enumerate()
        .skip(usize::try_from(found).unwrap_or(0))
    {
        tx.execute_batch(sql)?;
        tx.pragma_update(
            None,
            "user_version",
            i64::try_from(version + 1).unwrap_or(i64::MAX),
        )?;
        tracing::info!(version = version + 1, "database schema upgraded");
    }
    tx.commit()?;
    Ok(())
}
