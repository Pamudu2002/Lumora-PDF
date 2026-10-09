//! Files handed to Lumora by the OS: "Open with", double-clicking a PDF, or the command line. A
//! second launch passes its files to the running window instead of opening another one.

use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_specta::Event;

/// Sent when another launch of Lumora asks the running window to open files.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct OpenFilesEvent {
    /// Absolute paths of the PDFs to open.
    pub paths: Vec<String>,
}

/// PDFs given on the command line when the app started, until the UI takes them.
#[derive(Default)]
pub struct StartupFiles(Mutex<Option<Vec<String>>>);

impl StartupFiles {
    /// Remembers the PDFs from this process's command line.
    pub fn from_args(args: impl IntoIterator<Item = String>, cwd: &Path) -> Self {
        Self(Mutex::new(Some(pdf_paths_from_args(args, cwd))))
    }
}

/// The PDF paths among command-line arguments (the first one is the program and is skipped),
/// made absolute against `cwd`. Flags such as `--minimized` are ignored. Files are not checked
/// here: opening a missing one shows the usual "can't find this file" message.
pub fn pdf_paths_from_args(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter(|arg| {
            Path::new(arg)
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
        })
        .map(|arg| cwd.join(arg).to_string_lossy().into_owned())
        .collect()
}

/// The PDFs Lumora was started with. Returns them once; later calls return nothing.
#[tauri::command]
#[specta::specta]
pub fn take_startup_files(state: State<'_, StartupFiles>) -> Vec<String> {
    state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .unwrap_or_default()
}

/// Called in the running instance when Lumora is launched again: brings the window forward and
/// asks the UI to open the new launch's PDFs as tabs.
pub fn on_second_launch(app: &AppHandle, args: Vec<String>, cwd: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    let paths = pdf_paths_from_args(args, Path::new(&cwd));
    if paths.is_empty() {
        return;
    }
    if let Err(err) = (OpenFilesEvent { paths }).emit(app) {
        tracing::warn!(%err, "could not pass files to the window");
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn keeps_pdf_arguments_and_makes_them_absolute() {
        let cwd = PathBuf::from(if cfg!(windows) { "C:\\work" } else { "/work" });
        let abs = if cfg!(windows) {
            "D:\\docs\\b.PDF"
        } else {
            "/docs/b.PDF"
        };
        let paths = pdf_paths_from_args(
            args(&[
                "lumora-pdf.exe",
                "a.pdf",
                "--flag",
                abs,
                "notes.txt",
                "c.pdf.bak",
            ]),
            &cwd,
        );
        assert_eq!(
            paths,
            vec![
                cwd.join("a.pdf").to_string_lossy().into_owned(),
                abs.to_string()
            ]
        );
    }

    #[test]
    fn ignores_the_program_path() {
        assert!(pdf_paths_from_args(args(&["C:\\odd\\app.pdf"]), Path::new("/")).is_empty());
        assert!(pdf_paths_from_args(Vec::new(), Path::new("/")).is_empty());
    }

    #[test]
    fn startup_files_are_taken_once() {
        let files = StartupFiles::from_args(args(&["app", "/x.pdf"]), Path::new("/"));
        let first = files.0.lock().unwrap().take();
        assert_eq!(first.map(|v| v.len()), Some(1));
        assert!(files.0.lock().unwrap().take().is_none());
    }
}
