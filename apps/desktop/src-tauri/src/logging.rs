//! Logging and crash reporting.
//!
//! Logs go to daily files in the app log folder (`%LOCALAPPDATA%\com.lumora.pdf\logs` on Windows),
//! keeping a week. Nothing leaves the device. Set `LUMORA_LOG` (e.g. `debug`, `lumora_engine=trace`)
//! to change the level.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_specta::Event;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Keeps the background log writer alive (and flushing) for the life of the process.
static LOG_GUARD: OnceLock<WorkerGuard> = OnceLock::new();
/// Lets the panic hook notify the UI.
static APP: OnceLock<AppHandle> = OnceLock::new();
/// Where the panic hook writes crash records synchronously.
static CRASH_LOG: OnceLock<PathBuf> = OnceLock::new();

/// Sent to the UI when something failed unexpectedly (a caught panic).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorEvent {
    /// Technical summary for the log; the UI shows its own friendly text.
    pub detail: String,
}

/// Starts file + console logging in `log_dir`. Safe to call once; later calls are ignored.
pub fn init(log_dir: &Path) {
    let filter = EnvFilter::try_from_env("LUMORA_LOG").unwrap_or_else(|_| {
        EnvFilter::new(if cfg!(debug_assertions) {
            "info,lumora_desktop_lib=debug,lumora_engine=debug,lumora_core=debug,lumora_render=debug"
        } else {
            "info"
        })
    });

    let file_layer = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("lumora")
        .filename_suffix("log")
        .max_log_files(7)
        .build(log_dir)
        .map(|appender| {
            let (writer, guard) = tracing_appender::non_blocking(appender);
            let _ = LOG_GUARD.set(guard);
            tracing_subscriber::fmt::layer()
                .with_writer(writer)
                .with_ansi(false)
                .with_thread_names(true)
        })
        .map_err(|err| eprintln!("Lumora PDF: file logging is off ({err})"))
        .ok();

    let console_layer =
        cfg!(debug_assertions).then(|| tracing_subscriber::fmt::layer().with_thread_names(true));

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(file_layer)
        .with(console_layer)
        .try_init();

    let _ = CRASH_LOG.set(log_dir.join("crash.log"));
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        os = std::env::consts::OS,
        arch = std::env::consts::ARCH,
        log_dir = %log_dir.display(),
        "Lumora PDF starting"
    );
}

/// Installs the panic hook: log the panic (and write it synchronously to `crash.log`, so the record
/// survives even if the process then dies), then tell the UI so it can show a friendly message.
///
/// Panics in engine requests and blocking command tasks are caught and turned into errors, so the
/// app keeps running; this hook makes sure every one of them is recorded.
pub fn install_panic_hook(app: AppHandle) {
    let _ = APP.set(app);
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let thread = std::thread::current();
        let thread = thread.name().unwrap_or("unnamed");
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "unknown panic".into());
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_default();
        let backtrace = std::backtrace::Backtrace::force_capture();

        tracing::error!(%thread, %location, %message, "panic");
        if let Some(path) = CRASH_LOG.get() {
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .and_then(|mut f| {
                    writeln!(
                        f,
                        "--- panic in thread '{thread}' at {location}: {message}\n{backtrace}"
                    )
                });
        }
        if let Some(app) = APP.get() {
            let _ = AppErrorEvent {
                detail: format!("{message} ({location})"),
            }
            .emit(app);
        }
        if cfg!(debug_assertions) {
            default_hook(info);
        }
    }));
}
