//! Lumora PDF desktop app: the Tauri shell around the Lumora Rust core.

mod commands;
mod error;
mod ipc;
mod state;

use tauri::Manager;

use crate::state::AppState;

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ipc = ipc::builder();

    let result = tauri::Builder::default()
        .invoke_handler(ipc.invoke_handler())
        .setup(move |app| {
            ipc.mount_events(app);
            app.manage(AppState::new(app.handle()));
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("Lumora PDF failed to start: {err}");
        std::process::exit(1);
    }
}
