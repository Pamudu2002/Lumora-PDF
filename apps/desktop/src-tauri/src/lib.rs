//! Lumora PDF desktop app: the Tauri shell around the Lumora Rust core.

mod commands;
mod error;
mod ipc;
mod logging;
mod protocol;
mod state;

use tauri::Manager;

use crate::commands::os_files::{self, StartupFiles};
use crate::state::AppState;

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ipc = ipc::builder();

    let cwd = std::env::current_dir().unwrap_or_default();
    let startup_files = StartupFiles::from_args(std::env::args(), &cwd);

    let result = tauri::Builder::default()
        // First, so a second launch hands its files to this window and exits before doing more.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            os_files::on_second_launch(app, args, cwd);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol(protocol::SCHEME, protocol::handle)
        .invoke_handler(ipc.invoke_handler())
        .setup(move |app| {
            if let Ok(log_dir) = app.path().app_log_dir() {
                logging::init(&log_dir);
            }
            logging::install_panic_hook(app.handle().clone());
            ipc.mount_events(app);
            app.manage(AppState::new(app.handle()));
            app.manage(startup_files);
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("Lumora PDF failed to start: {err}");
        std::process::exit(1);
    }
}
