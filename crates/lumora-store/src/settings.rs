//! App settings as key/value text. The desktop app keeps its UI settings under one key as JSON.

use rusqlite::{OptionalExtension, params};

use crate::{Store, StoreError};

impl Store {
    /// The value stored under `key`, if any.
    pub fn setting(&self, key: &str) -> Result<Option<String>, StoreError> {
        Ok(self
            .conn()
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?)
    }

    /// Stores `value` under `key`, replacing any previous value.
    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), StoreError> {
        self.conn().execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::Store;

    #[test]
    fn stores_and_replaces_settings() {
        let store = Store::open_in_memory().unwrap();
        assert_eq!(store.setting("ui").unwrap(), None);
        store.set_setting("ui", r#"{"theme":"dark"}"#).unwrap();
        store.set_setting("ui", r#"{"theme":"light"}"#).unwrap();
        assert_eq!(
            store.setting("ui").unwrap().as_deref(),
            Some(r#"{"theme":"light"}"#)
        );
    }
}
