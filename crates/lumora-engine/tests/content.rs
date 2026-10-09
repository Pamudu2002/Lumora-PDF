//! Integration tests for text, search, outline, links, properties, Page dark mode and tile
//! cancellation against the real PDFium library.

#![allow(clippy::unwrap_used)]

mod common;

use std::sync::Arc;

use common::{TestPage, engine, repo_root, temp_dir, write_pdf};
use lumora_engine::{
    EngineError, LinkTarget, OpenOptions, PdfEngine, Rect, RgbaImage, SearchOptions, TileRequest,
};

fn corpus(engine: &impl PdfEngine, file: &str) -> u32 {
    engine
        .open(
            &repo_root().join("tests/corpus").join(file),
            OpenOptions::default(),
        )
        .unwrap()
        .0
}

fn text_page(rotate: u16) -> TestPage {
    TestPage {
        width: 612.0,
        height: 792.0,
        rotate,
        // 24 pt text whose baseline starts at (100, 700) in page space.
        content: "BT /F1 24 Tf 100 700 Td (Hello Lumora) Tj ET".into(),
    }
}

fn tile(doc: u32, page: u32, tile_x: u32, tile_y: u32) -> TileRequest {
    TileRequest {
        doc,
        page,
        scale: 1.0,
        tile_x,
        tile_y,
        tile_size: 512,
        dark_mode: false,
    }
}

/// Renders the whole page at scale 1 (pages here are at most 2×2 tiles).
fn render_page(engine: &impl PdfEngine, doc: u32, page: u32) -> RgbaImage {
    let size = engine.page_sizes(doc).unwrap()[page as usize];
    let (w, h) = size.pixel_size(1.0);
    let mut pixels = vec![255u8; (w * h * 4) as usize];
    for ty in 0..h.div_ceil(512) {
        for tx in 0..w.div_ceil(512) {
            let t = engine.render_tile(tile(doc, page, tx, ty)).unwrap();
            for row in 0..t.height {
                let src = (row * t.width * 4) as usize;
                let dst = (((ty * 512 + row) * w + tx * 512) * 4) as usize;
                let len = (t.width * 4) as usize;
                pixels[dst..dst + len].copy_from_slice(&t.pixels[src..src + len]);
            }
        }
    }
    RgbaImage {
        width: w,
        height: h,
        pixels,
    }
}

/// Number of dark pixels inside a rectangle (display points = pixels at scale 1).
fn dark_pixels_in(img: &RgbaImage, r: &Rect) -> usize {
    let mut count = 0;
    for y in (r.y as u32)..((r.y + r.height) as u32).min(img.height) {
        for x in (r.x as u32)..((r.x + r.width) as u32).min(img.width) {
            let i = ((y * img.width + x) * 4) as usize;
            if img.pixels[i] < 128 {
                count += 1;
            }
        }
    }
    count
}

#[test]
fn text_positions_line_up_with_rendered_text_on_every_rotation() {
    let engine = engine();
    let dir = temp_dir("text-rotation");
    let path = dir.join("rotations.pdf");
    write_pdf(
        &path,
        "Rotations",
        &[text_page(0), text_page(90), text_page(180), text_page(270)],
    );
    let (doc, _) = engine.open(&path, OpenOptions::default()).unwrap();

    for page in 0..4 {
        let text = engine.page_text(doc, page).unwrap();
        let joined: String = text.runs.iter().map(|r| r.text.as_str()).collect();
        assert!(joined.contains("Hello Lumora"), "page {page}: {joined:?}");

        let run = &text.runs[0];
        let img = render_page(&engine, doc, page);
        let dark = dark_pixels_in(&img, &run.rect);
        assert!(
            dark > 50,
            "page {page}: run {:?} covers only {dark} dark pixels",
            run.rect
        );
    }

    // Unrotated: text starts at x = 100 and sits near the top (baseline 92 pt from the top).
    let r0 = engine.page_text(doc, 0).unwrap().runs[0].rect;
    assert!(
        (r0.x - 100.0).abs() < 3.0 && r0.y > 60.0 && r0.y < 95.0,
        "{r0:?}"
    );
    // Rotated 90° clockwise: the line runs downwards near the right edge.
    let r90 = engine.page_text(doc, 1).unwrap().runs[0].rect;
    assert!(r90.height > r90.width && r90.x > 680.0, "{r90:?}");
}

#[test]
fn searches_with_case_and_whole_word_options() {
    let engine = engine();
    let doc = corpus(&engine, "pdfium/hello_world.pdf");

    let hits = engine
        .search_page(doc, 0, "world", SearchOptions::default())
        .unwrap();
    assert_eq!(hits.len(), 2);
    let first = &hits[0];
    let matched: String = first
        .snippet
        .chars()
        .skip(first.match_start as usize)
        .take(first.match_len as usize)
        .collect();
    assert_eq!(matched, "world");

    let case = SearchOptions {
        match_case: true,
        whole_word: false,
    };
    assert!(
        engine
            .search_page(doc, 0, "WORLD", case)
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        engine
            .search_page(doc, 0, "WORLD", SearchOptions::default())
            .unwrap()
            .len(),
        2
    );

    let word = SearchOptions {
        match_case: false,
        whole_word: true,
    };
    assert!(engine.search_page(doc, 0, "wor", word).unwrap().is_empty());
    assert!(
        engine
            .search_page(doc, 0, "   ", SearchOptions::default())
            .unwrap()
            .is_empty()
    );
}

#[test]
fn reads_outlines_and_survives_circular_ones() {
    let engine = engine();
    let doc = corpus(&engine, "pdfium/bookmarks.pdf");
    let outline = engine.outline(doc).unwrap();
    assert_eq!(outline.len(), 3);
    assert_eq!(outline[1].title, "Open Middle");
    assert_eq!(outline[1].children[0].page, Some(0));

    let circular = corpus(&engine, "pdfium/bookmarks_circular.pdf");
    assert!(engine.outline(circular).unwrap().len() < 10);

    let none = corpus(&engine, "pdfium/hello_world.pdf");
    assert!(engine.outline(none).unwrap().is_empty());
}

#[test]
fn reads_links() {
    let engine = engine();
    let doc = corpus(&engine, "pdfium/links_highlights_annots.pdf");
    let links = engine.page_links(doc, 0).unwrap();
    assert_eq!(links.len(), 1, "duplicates are merged: {links:?}");
    assert_eq!(
        links[0].target,
        LinkTarget::Uri {
            uri: "https://www.google.com/".into()
        }
    );
}

#[test]
fn reports_properties_and_fonts() {
    let engine = engine();
    let doc = corpus(&engine, "pdfium/hello_world.pdf");
    let props = engine.properties(doc).unwrap();
    assert_eq!(props.page_count, 1);
    assert_eq!(props.pdf_version, "1.7");
    let names: Vec<&str> = props.fonts.iter().map(|f| f.name.as_str()).collect();
    assert_eq!(names, ["Helvetica", "Times-Roman"]);
}

#[test]
fn page_dark_mode_darkens_pages_but_not_images() {
    let engine = engine();
    let dir = temp_dir("dark");
    let path = dir.join("square.pdf");
    write_pdf(&path, "Dark", &[TestPage::letter_with_square()]);
    let (doc, _) = engine.open(&path, OpenOptions::default()).unwrap();
    let dark = engine
        .render_tile(TileRequest {
            dark_mode: true,
            ..tile(doc, 0, 0, 0)
        })
        .unwrap();
    assert!(dark.pixels[0] < 40, "white background became dark");
    let i = ((505 * dark.width + 200) * 4) as usize; // inside the black square
    assert!(dark.pixels[i] > 200, "black square became light");

    // A scanned page is one big image: dark mode leaves it as it is.
    let scan = corpus(&engine, "generated/scanned-image-only.pdf");
    let light = engine.render_tile(tile(scan, 0, 0, 0)).unwrap();
    let dark = engine
        .render_tile(TileRequest {
            dark_mode: true,
            ..tile(scan, 0, 0, 0)
        })
        .unwrap();
    let changed = light
        .pixels
        .iter()
        .zip(&dark.pixels)
        .filter(|(a, b)| a.abs_diff(**b) > 8)
        .count();
    assert!(
        changed < light.pixels.len() / 100,
        "{changed} bytes changed on an image-only page"
    );
}

#[test]
fn skips_tiles_that_are_no_longer_needed() {
    let engine = engine();
    let doc = corpus(&engine, "pdfium/hello_world.pdf");
    let result = engine.render_tile_if(tile(doc, 0, 0, 0), Arc::new(|| false));
    assert!(matches!(result, Err(EngineError::Cancelled)));
    assert!(
        engine
            .render_tile_if(tile(doc, 0, 0, 0), Arc::new(|| true))
            .is_ok()
    );
}
