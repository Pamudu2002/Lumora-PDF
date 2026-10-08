//! Helpers shared by the engine's integration tests.

#![allow(dead_code, clippy::unwrap_used, clippy::expect_used)]

use std::path::{Path, PathBuf};

use lumora_engine::{PdfiumEngine, PdfiumLibrary};

/// Repo root (two levels above this crate).
pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// The PDFium library used by tests: `LUMORA_PDFIUM_PATH`, or the one `pnpm fetch-pdfium` installs.
pub fn pdfium_library() -> PdfiumLibrary {
    let path = std::env::var_os("LUMORA_PDFIUM_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let name = if cfg!(windows) {
                "pdfium.dll"
            } else if cfg!(target_os = "macos") {
                "libpdfium.dylib"
            } else {
                "libpdfium.so"
            };
            repo_root()
                .join("apps/desktop/src-tauri/resources/pdfium")
                .join(name)
        });
    assert!(
        path.exists(),
        "PDFium not found at {}. Run `pnpm fetch-pdfium` or set LUMORA_PDFIUM_PATH.",
        path.display()
    );
    PdfiumLibrary::Path(path)
}

/// Starts an engine with the test PDFium library.
pub fn engine() -> PdfiumEngine {
    PdfiumEngine::start(pdfium_library()).expect("PDFium should load")
}

/// One page of a hand-built test PDF.
pub struct TestPage {
    pub width: f32,
    pub height: f32,
    pub rotate: u16,
    /// Content stream, e.g. "0 0 0 rg 100 100 200 200 re f".
    pub content: String,
}

impl TestPage {
    /// A Letter page with a black 200×200 pt square whose bottom-left corner is at (100, 100).
    pub fn letter_with_square() -> Self {
        Self {
            width: 612.0,
            height: 792.0,
            rotate: 0,
            content: "0 0 0 rg 100 100 200 200 re f".into(),
        }
    }
}

/// Writes a minimal, valid PDF with the given pages and an Info dictionary with a title.
pub fn write_pdf(path: &Path, title: &str, pages: &[TestPage]) {
    let mut objects: Vec<String> = Vec::new();
    // 1: catalog, 2: pages, 3: info, then per page: page object + content stream.
    let first_page_obj = 4;
    let kids: Vec<String> = (0..pages.len())
        .map(|i| format!("{} 0 R", first_page_obj + i * 2))
        .collect();
    objects.push("<< /Type /Catalog /Pages 2 0 R >>".into());
    objects.push(format!(
        "<< /Type /Pages /Kids [{}] /Count {} >>",
        kids.join(" "),
        pages.len()
    ));
    objects.push(format!("<< /Title ({title}) /Author (Lumora tests) >>"));
    for (i, page) in pages.iter().enumerate() {
        let content_obj = first_page_obj + i * 2 + 1;
        objects.push(format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Rotate {} /Contents {} 0 R /Resources << >> >>",
            page.width, page.height, page.rotate, content_obj
        ));
        objects.push(format!(
            "<< /Length {} >>\nstream\n{}\nendstream",
            page.content.len(),
            page.content
        ));
    }

    let mut out = String::from("%PDF-1.7\n");
    let mut offsets = Vec::new();
    for (i, body) in objects.iter().enumerate() {
        offsets.push(out.len());
        out.push_str(&format!("{} 0 obj\n{body}\nendobj\n", i + 1));
    }
    let xref = out.len();
    out.push_str(&format!(
        "xref\n0 {}\n0000000000 65535 f \n",
        objects.len() + 1
    ));
    for offset in offsets {
        out.push_str(&format!("{offset:010} 00000 n \n"));
    }
    out.push_str(&format!(
        "trailer\n<< /Size {} /Root 1 0 R /Info 3 0 R >>\nstartxref\n{xref}\n%%EOF\n",
        objects.len() + 1
    ));
    std::fs::write(path, out).expect("write test PDF");
}

/// A fresh, empty temp directory for one test.
pub fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("lumora-engine-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}
