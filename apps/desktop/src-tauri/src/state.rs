//! App state shared by commands and the `lumora://` protocol.

use std::path::PathBuf;
use std::sync::Arc;

use lumora_core::{Documents, Searches};
use lumora_engine::{EngineErrorKind, PdfEngine, PdfiumEngine, PdfiumLibrary};
use lumora_render::{ImageFormat, TileCache, TileService};
use tauri::Manager;
use tauri::path::BaseDirectory;

use crate::error::AppError;

/// The Rust core, available once PDFium has loaded.
pub struct Core {
    /// Open documents.
    pub documents: Arc<Documents>,
    /// Cached, encoded tiles and thumbnails.
    pub tiles: Arc<TileService>,
    /// Running find-in-document searches.
    pub searches: Arc<Searches>,
}

/// Managed Tauri state. If PDFium failed to load, the app still starts and every document command
/// reports the error, so the UI can explain it.
pub struct AppState {
    core: Result<Core, String>,
}

impl AppState {
    /// Loads PDFium and builds the core.
    pub fn new(app: &tauri::AppHandle) -> Self {
        let library = pdfium_library(app);
        let core = PdfiumEngine::start(library.clone())
            .map(|engine| {
                let engine: Arc<dyn PdfEngine> = Arc::new(engine);
                Core {
                    documents: Arc::new(Documents::new(Arc::clone(&engine))),
                    searches: Arc::new(Searches::new(Arc::clone(&engine))),
                    tiles: Arc::new(TileService::new(
                        engine,
                        TileCache::default(),
                        ImageFormat::Png,
                    )),
                }
            })
            .map_err(|err| {
                tracing::error!(?library, %err, "PDF engine unavailable");
                err.to_string()
            });
        Self { core }
    }

    /// The core, or the reason it is unavailable.
    pub fn core(&self) -> Result<&Core, AppError> {
        self.core.as_ref().map_err(|detail| AppError {
            kind: EngineErrorKind::LibraryLoad,
            detail: detail.clone(),
        })
    }
}

/// File name of the PDFium library on this platform.
fn pdfium_file_name() -> &'static str {
    if cfg!(windows) {
        "pdfium.dll"
    } else if cfg!(target_os = "macos") {
        "libpdfium.dylib"
    } else {
        "libpdfium.so"
    }
}

/// Finds PDFium: `LUMORA_PDFIUM_PATH`, then the bundled resource, then (debug builds) the copy that
/// `pnpm fetch-pdfium` put in `src-tauri/resources/`, then the system library path.
fn pdfium_library(app: &tauri::AppHandle) -> PdfiumLibrary {
    if let Some(path) = std::env::var_os("LUMORA_PDFIUM_PATH") {
        return PdfiumLibrary::Path(PathBuf::from(path));
    }
    let name = pdfium_file_name();
    if let Ok(path) = app
        .path()
        .resolve(format!("pdfium/{name}"), BaseDirectory::Resource)
        && path.exists()
    {
        return PdfiumLibrary::Path(path);
    }
    if cfg!(debug_assertions) {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources/pdfium")
            .join(name);
        if dev.exists() {
            return PdfiumLibrary::Path(dev);
        }
    }
    PdfiumLibrary::System
}
