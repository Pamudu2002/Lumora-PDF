//! Lumora PDF desktop app: the Tauri shell around the Lumora Rust core.

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default().run(tauri::generate_context!());
    if let Err(err) = result {
        eprintln!("Lumora PDF failed to start: {err}");
        std::process::exit(1);
    }
}
