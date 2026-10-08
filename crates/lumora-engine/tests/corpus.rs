//! Corpus smoke test: every file in `tests/corpus/manifest.json` opens (or fails) as expected, has
//! the expected page count, unlocks with its password, and renders page 1 without crashing.

#![allow(clippy::unwrap_used, clippy::expect_used)]

mod common;

use std::path::PathBuf;

use common::{engine, repo_root};
use lumora_engine::{EngineError, OpenOptions, PdfEngine};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Manifest {
    files: Vec<Entry>,
}

#[derive(Debug, Deserialize)]
struct Entry {
    file: String,
    category: String,
    expect: String,
    pages: Option<u32>,
    password: Option<String>,
}

fn corpus_dir() -> PathBuf {
    repo_root().join("tests/corpus")
}

fn manifest() -> Manifest {
    let text = std::fs::read_to_string(corpus_dir().join("manifest.json")).expect("read manifest");
    serde_json::from_str(&text).expect("parse manifest")
}

fn kind_name(err: &EngineError) -> String {
    serde_json::to_value(err.kind())
        .ok()
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_default()
}

/// Fails with a hint when the PDFs are Git LFS pointers instead of real files.
fn assert_not_lfs_pointer(path: &std::path::Path) {
    let head = std::fs::read(path).expect("read corpus file");
    assert!(
        !head.starts_with(b"version https://git-lfs"),
        "{} is a Git LFS pointer. Run `git lfs pull`.",
        path.display()
    );
}

#[test]
fn every_corpus_file_behaves_as_listed() {
    let engine = engine();
    let manifest = manifest();
    assert!(
        manifest.files.len() >= 30,
        "the corpus should have at least 30 files"
    );

    let mut failures = Vec::new();
    for entry in &manifest.files {
        let path = corpus_dir().join(&entry.file);
        assert_not_lfs_pointer(&path);
        let outcome = engine.open(&path, OpenOptions::default());
        let actual = match &outcome {
            Ok(_) => "open".to_string(),
            Err(e) => kind_name(e),
        };
        if actual != entry.expect {
            failures.push(format!(
                "{}: expected {}, got {actual}",
                entry.file, entry.expect
            ));
            continue;
        }

        let opened = match (outcome, &entry.password) {
            (Ok(opened), _) => Some(opened),
            (Err(_), Some(password)) => match engine.open(
                &path,
                OpenOptions {
                    password: Some(password.clone()),
                },
            ) {
                Ok(opened) => Some(opened),
                Err(e) => {
                    failures.push(format!("{}: password did not open it: {e}", entry.file));
                    None
                }
            },
            (Err(_), None) => None,
        };

        if let Some((doc, info)) = opened {
            if let Some(pages) = entry.pages
                && info.page_count != pages
            {
                failures.push(format!(
                    "{}: expected {pages} pages, got {}",
                    entry.file, info.page_count
                ));
            }
            if info.page_count > 0
                && let Err(e) = engine.render_thumbnail(doc, 0, 256)
            {
                failures.push(format!(
                    "{} ({}): page 1 did not render: {e}",
                    entry.file, entry.category
                ));
            }
            engine.close(doc).unwrap();
        }
    }
    assert!(
        failures.is_empty(),
        "corpus failures:\n{}",
        failures.join("\n")
    );
}

#[test]
fn every_corpus_pdf_is_in_the_manifest() {
    let listed: std::collections::HashSet<String> =
        manifest().files.into_iter().map(|e| e.file).collect();
    for dir in ["pdfium", "generated"] {
        for entry in std::fs::read_dir(corpus_dir().join(dir)).unwrap() {
            let name = entry.unwrap().file_name().to_string_lossy().into_owned();
            if name.ends_with(".pdf") {
                let rel = format!("{dir}/{name}");
                assert!(listed.contains(&rel), "{rel} is not in manifest.json");
            }
        }
    }
}
