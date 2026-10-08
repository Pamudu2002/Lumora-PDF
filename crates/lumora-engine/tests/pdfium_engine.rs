//! Integration tests for `PdfiumEngine` against the real PDFium library.

#![allow(clippy::unwrap_used)]

mod common;

use std::sync::Arc;

use common::{TestPage, engine, temp_dir, write_pdf};
use lumora_engine::{EngineError, OpenOptions, PdfEngine, PdfiumEngine, RgbaImage, TileRequest};

fn pixel(img: &RgbaImage, x: u32, y: u32) -> [u8; 4] {
    let i = ((y * img.width + x) * 4) as usize;
    [
        img.pixels[i],
        img.pixels[i + 1],
        img.pixels[i + 2],
        img.pixels[i + 3],
    ]
}

const WHITE: [u8; 4] = [255, 255, 255, 255];
const BLACK: [u8; 4] = [0, 0, 0, 255];

fn tile(doc: u32, page: u32, scale: f32, tile_x: u32, tile_y: u32) -> TileRequest {
    TileRequest {
        doc,
        page,
        scale,
        tile_x,
        tile_y,
        tile_size: 512,
        dark_mode: false,
    }
}

fn open_square_doc(engine: &PdfiumEngine, name: &str) -> u32 {
    let dir = temp_dir(name);
    let path = dir.join("square.pdf");
    write_pdf(
        &path,
        "Square test",
        &[
            TestPage::letter_with_square(),
            TestPage {
                rotate: 90,
                ..TestPage::letter_with_square()
            },
        ],
    );
    let (doc, _) = engine.open(&path, OpenOptions::default()).unwrap();
    doc
}

#[test]
fn opens_a_document_and_reports_info_and_sizes() {
    let engine = engine();
    let dir = temp_dir("open");
    let path = dir.join("doc.pdf");
    write_pdf(
        &path,
        "Annual report",
        &[
            TestPage::letter_with_square(),
            TestPage {
                rotate: 90,
                ..TestPage::letter_with_square()
            },
        ],
    );

    let (doc, info) = engine.open(&path, OpenOptions::default()).unwrap();
    assert_eq!(info.page_count, 2);
    assert_eq!(info.title.as_deref(), Some("Annual report"));
    assert_eq!(info.author.as_deref(), Some("Lumora tests"));
    assert!(!info.is_encrypted);
    assert!(!info.has_forms);
    assert_eq!(info.pdf_version, "1.7");

    let sizes = engine.page_sizes(doc).unwrap();
    assert_eq!(sizes.len(), 2);
    assert_eq!((sizes[0].width_pt, sizes[0].height_pt), (612.0, 792.0));
    // /Rotate 90 swaps the displayed width and height.
    assert_eq!((sizes[1].width_pt, sizes[1].height_pt), (792.0, 612.0));

    engine.close(doc).unwrap();
    assert!(matches!(
        engine.page_sizes(doc),
        Err(EngineError::UnknownDocument(_))
    ));
}

#[test]
fn renders_tiles_at_the_right_place() {
    let engine = engine();
    let doc = open_square_doc(&engine, "tiles");

    // The square covers x 100..300 and, from the top, y 492..692 at scale 1.
    let t00 = engine.render_tile(tile(doc, 0, 1.0, 0, 0)).unwrap();
    assert_eq!((t00.width, t00.height), (512, 512));
    assert_eq!(pixel(&t00, 10, 10), WHITE);
    assert_eq!(pixel(&t00, 200, 505), BLACK);
    assert_eq!(pixel(&t00, 200, 480), WHITE);

    // Edge tile: 612 - 512 = 100 px wide, 792 - 512 = 280 px tall.
    let t01 = engine.render_tile(tile(doc, 0, 1.0, 0, 1)).unwrap();
    assert_eq!((t01.width, t01.height), (512, 280));
    assert_eq!(pixel(&t01, 200, 100), BLACK); // page y 612
    assert_eq!(pixel(&t01, 200, 200), WHITE); // page y 712, below the square
    let t11 = engine.render_tile(tile(doc, 0, 1.0, 1, 1)).unwrap();
    assert_eq!((t11.width, t11.height), (100, 280));

    // At 2× the square doubles: x 200..600, y 984..1384.
    let t2 = engine.render_tile(tile(doc, 0, 2.0, 0, 1)).unwrap();
    assert_eq!(pixel(&t2, 400, 1000 - 512), BLACK);
    assert_eq!(pixel(&t2, 100, 1000 - 512), WHITE);
}

#[test]
fn renders_thumbnails() {
    let engine = engine();
    let doc = open_square_doc(&engine, "thumbs");
    let thumb = engine.render_thumbnail(doc, 0, 100).unwrap();
    // 612 × 792 scaled so the long edge is 100 px.
    assert_eq!((thumb.height, thumb.width), (100, 77));
    let rotated = engine.render_thumbnail(doc, 1, 100).unwrap();
    assert_eq!((rotated.width, rotated.height), (100, 77));
}

#[test]
fn rejects_bad_requests_without_panicking() {
    let engine = engine();
    let doc = open_square_doc(&engine, "bad-requests");
    assert!(matches!(
        engine.render_tile(tile(doc, 9, 1.0, 0, 0)),
        Err(EngineError::PageOutOfRange { page: 9, .. })
    ));
    assert!(matches!(
        engine.render_tile(tile(doc, 0, 1.0, 5, 0)),
        Err(EngineError::InvalidRequest(_))
    ));
    assert!(matches!(
        engine.render_tile(tile(doc, 0, f32::NAN, 0, 0)),
        Err(EngineError::InvalidRequest(_))
    ));
    assert!(matches!(
        engine.render_tile(tile(999, 0, 1.0, 0, 0)),
        Err(EngineError::UnknownDocument(999))
    ));
    assert!(matches!(
        engine.render_thumbnail(doc, 0, 0),
        Err(EngineError::InvalidRequest(_))
    ));
    assert!(matches!(
        engine.close(999),
        Err(EngineError::UnknownDocument(999))
    ));
}

#[test]
fn reports_malformed_and_missing_files() {
    let engine = engine();
    let dir = temp_dir("malformed");

    let garbage = dir.join("garbage.pdf");
    std::fs::write(&garbage, b"this is not a PDF at all").unwrap();
    assert!(matches!(
        engine.open(&garbage, OpenOptions::default()),
        Err(EngineError::Malformed)
    ));

    let empty = dir.join("empty.pdf");
    std::fs::write(&empty, b"").unwrap();
    assert!(engine.open(&empty, OpenOptions::default()).is_err());

    // A valid file cut in half: PDFium may repair it or reject it, but must not crash.
    let good = dir.join("good.pdf");
    write_pdf(&good, "Cut", &[TestPage::letter_with_square()]);
    let bytes = std::fs::read(&good).unwrap();
    let cut = dir.join("cut.pdf");
    std::fs::write(&cut, &bytes[..bytes.len() / 2]).unwrap();
    if let Ok((doc, _)) = engine.open(&cut, OpenOptions::default()) {
        let _ = engine.render_tile(tile(doc, 0, 1.0, 0, 0));
    }

    assert!(matches!(
        engine.open(&dir.join("missing.pdf"), OpenOptions::default()),
        Err(EngineError::FileNotFound)
    ));

    // The engine still works afterwards.
    let doc = open_square_doc(&engine, "malformed-after");
    assert!(engine.render_tile(tile(doc, 0, 1.0, 0, 0)).is_ok());
}

#[test]
fn serves_many_threads() {
    let engine = Arc::new(engine());
    let doc = open_square_doc(&engine, "threads");
    let handles: Vec<_> = (0..8)
        .map(|i| {
            let engine = Arc::clone(&engine);
            std::thread::spawn(move || {
                for _ in 0..5 {
                    let img = engine.render_tile(tile(doc, i % 2, 1.0, 0, 0)).unwrap();
                    assert_eq!(img.width, 512);
                }
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
}

#[test]
fn ids_are_unique_and_documents_independent() {
    let engine = engine();
    let a = open_square_doc(&engine, "ids-a");
    let b = open_square_doc(&engine, "ids-b");
    assert_ne!(a, b);
    engine.close(a).unwrap();
    assert!(engine.render_tile(tile(b, 0, 1.0, 0, 0)).is_ok());
}
