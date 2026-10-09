//! Opening links from documents in the user's browser or mail app.

use lumora_engine::EngineErrorKind;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;

/// Longest URL Lumora will hand to the system.
const MAX_URL_LEN: usize = 2_048;

/// Whether a link from a document may be opened: an http, https or mailto URL without spaces or
/// control characters. Other schemes (file:, javascript:, custom app schemes) could run programs
/// or read local files, so they are refused.
pub fn is_openable_url(url: &str) -> bool {
    if url.is_empty() || url.len() > MAX_URL_LEN {
        return false;
    }
    if url.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return false;
    }
    let Some((scheme, rest)) = url.split_once(':') else {
        return false;
    };
    match scheme.to_ascii_lowercase().as_str() {
        "http" | "https" => rest.strip_prefix("//").is_some_and(|r| {
            r.split(['/', '?', '#'])
                .next()
                .is_some_and(|host| !host.is_empty())
        }),
        "mailto" => !rest.is_empty(),
        _ => false,
    }
}

/// Opens a link from a document in the default browser or mail app. The UI asks the user first.
#[tauri::command]
#[specta::specta]
pub fn open_external_link(app: AppHandle, url: String) -> Result<(), AppError> {
    if !is_openable_url(&url) {
        return Err(AppError {
            kind: EngineErrorKind::InvalidRequest,
            detail: "only web and email links can be opened".into(),
        });
    }
    tracing::info!("opening an external link");
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|err| AppError::internal(format!("could not open link: {err}")))
}

#[cfg(test)]
mod tests {
    use super::is_openable_url;

    #[test]
    fn allows_web_and_email_links() {
        assert!(is_openable_url("https://lumora.app/help?q=1#top"));
        assert!(is_openable_url("HTTP://example.com"));
        assert!(is_openable_url("mailto:someone@example.com"));
    }

    #[test]
    fn refuses_other_schemes_and_odd_urls() {
        for url in [
            "",
            "file:///C:/Windows/System32/calc.exe",
            "javascript:alert(1)",
            "ms-settings:privacy",
            "https://",
            "https:example.com",
            "https://exa mple.com",
            "https://example.com/\u{0007}",
            "mailto:",
            "example.com",
        ] {
            assert!(!is_openable_url(url), "{url:?} should be refused");
        }
        assert!(!is_openable_url(&format!(
            "https://e.com/{}",
            "a".repeat(3000)
        )));
    }
}
