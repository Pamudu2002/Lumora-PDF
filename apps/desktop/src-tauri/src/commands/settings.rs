//! UI settings, kept in the local database as one JSON object. They reach the page before it loads
//! (an initialization script), so the first paint already uses the right theme.

use std::sync::Arc;

use lumora_engine::EngineErrorKind;
use lumora_store::Store;
use tauri::State;

use super::blocking;
use crate::error::AppError;
use crate::state::AppState;

/// The database key of the UI settings.
const SETTINGS_KEY: &str = "ui";
/// Largest settings document accepted.
const MAX_SETTINGS_BYTES: usize = 64 * 1024;

/// Checks that `json` is a JSON object of reasonable size and returns it in canonical form.
pub fn validate_settings(json: &str) -> Option<String> {
    if json.len() > MAX_SETTINGS_BYTES {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    value.is_object().then(|| value.to_string())
}

/// JavaScript that defines `window.__LUMORA_SETTINGS__` with the saved settings (or `null`).
pub fn init_script(store: Option<&Arc<Store>>) -> String {
    let saved = store
        .and_then(|s| {
            s.setting(SETTINGS_KEY)
                .inspect_err(|err| tracing::warn!(%err, "could not read settings"))
                .ok()
                .flatten()
        })
        // Re-serialised, so the script only ever contains a valid JSON literal.
        .and_then(|json| validate_settings(&json));
    format!(
        "window.__LUMORA_SETTINGS__ = {};",
        saved.as_deref().unwrap_or("null")
    )
}

/// Saves the UI settings (a JSON object).
#[tauri::command]
#[specta::specta]
pub async fn save_settings(state: State<'_, AppState>, json: String) -> Result<(), AppError> {
    let Some(value) = validate_settings(&json) else {
        return Err(AppError {
            kind: EngineErrorKind::InvalidRequest,
            detail: "settings must be a JSON object under 64 KB".into(),
        });
    };
    let Some(store) = state.store() else {
        return Ok(());
    };
    blocking(move || {
        store
            .set_setting(SETTINGS_KEY, &value)
            .map_err(|err| AppError::internal(err.to_string()))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_json_objects() {
        assert_eq!(
            validate_settings(r#"{ "state": { "theme": "dark" } }"#).as_deref(),
            Some(r#"{"state":{"theme":"dark"}}"#)
        );
        assert_eq!(validate_settings("[1,2]"), None);
        assert_eq!(validate_settings("alert(1)"), None);
        assert_eq!(
            validate_settings(&format!("{{\"a\":\"{}\"}}", "x".repeat(70_000))),
            None
        );
    }

    #[test]
    fn injects_saved_settings_or_null() {
        let store = Arc::new(Store::open_in_memory().unwrap());
        assert_eq!(
            init_script(Some(&store)),
            "window.__LUMORA_SETTINGS__ = null;"
        );
        store
            .set_setting(SETTINGS_KEY, r#"{"theme":"dark"}"#)
            .unwrap();
        assert_eq!(
            init_script(Some(&store)),
            r#"window.__LUMORA_SETTINGS__ = {"theme":"dark"};"#
        );
        // A damaged value is ignored rather than injected.
        store.set_setting(SETTINGS_KEY, "}; evil(); {").unwrap();
        assert_eq!(
            init_script(Some(&store)),
            "window.__LUMORA_SETTINGS__ = null;"
        );
        assert_eq!(init_script(None), "window.__LUMORA_SETTINGS__ = null;");
    }
}
