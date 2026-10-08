//! Golden render test: page 1 of every corpus file, rendered at scale 1.0 from 512 px tiles and
//! compared with `tests/golden/` within a small tolerance.
//!
//! ```text
//! cargo test -p lumora-engine --features golden --test golden            # compare
//! LUMORA_UPDATE_GOLDEN=1 cargo test -p lumora-engine --features golden --test golden   # (re)write
//! ```
//!
//! On a mismatch the actual image and a diff are written to `tests/golden/_diff/` (git-ignored).

#![cfg(feature = "golden")]
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod common;

use std::path::{Path, PathBuf};

use common::{engine, repo_root};
use lumora_engine::{OpenOptions, PdfEngine, RgbaImage, TileRequest};
use serde::Deserialize;

/// A channel may differ by this much before the pixel counts as different (anti-aliasing noise).
const CHANNEL_TOLERANCE: u8 = 16;
/// Share of pixels that may differ before the test fails.
const MAX_DIFF_RATIO: f64 = 0.002;
/// Pages larger than this (px at scale 1.0) are rendered as a thumbnail of this size instead.
const MAX_GOLDEN_EDGE: u32 = lumora_engine::MAX_TILE_SIZE;
const TILE: u32 = 512;

#[derive(Deserialize)]
struct Manifest {
    files: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    file: String,
    expect: String,
    password: Option<String>,
}

fn golden_path(file: &str) -> PathBuf {
    repo_root()
        .join("tests/golden")
        .join(Path::new(file).with_extension("png"))
}

/// Renders page 1 at scale 1.0 by stitching tiles (exercises tile offsets and edge tiles).
fn render_page_one(engine: &dyn PdfEngine, doc: u32) -> RgbaImage {
    let size = engine.page_sizes(doc).unwrap()[0];
    let (w, h) = size.pixel_size(1.0);
    if w.max(h) > MAX_GOLDEN_EDGE {
        return engine.render_thumbnail(doc, 0, MAX_GOLDEN_EDGE).unwrap();
    }
    let mut pixels = vec![0u8; (w * h * 4) as usize];
    for tile_y in 0..h.div_ceil(TILE) {
        for tile_x in 0..w.div_ceil(TILE) {
            let tile = engine
                .render_tile(TileRequest {
                    doc,
                    page: 0,
                    scale: 1.0,
                    tile_x,
                    tile_y,
                    tile_size: TILE,
                    dark_mode: false,
                })
                .unwrap();
            for row in 0..tile.height {
                let src = (row * tile.width * 4) as usize;
                let dst = (((tile_y * TILE + row) * w + tile_x * TILE) * 4) as usize;
                let len = (tile.width * 4) as usize;
                pixels[dst..dst + len].copy_from_slice(&tile.pixels[src..src + len]);
            }
        }
    }
    RgbaImage {
        width: w,
        height: h,
        pixels,
    }
}

fn write_png(path: &Path, img: &RgbaImage) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let file = std::fs::File::create(path).unwrap();
    let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), img.width, img.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.set_compression(png::Compression::High);
    let mut writer = encoder.write_header().unwrap();
    writer.write_image_data(&img.pixels).unwrap();
    writer.finish().unwrap();
}

fn read_png(path: &Path) -> RgbaImage {
    let decoder = png::Decoder::new(std::io::BufReader::new(std::fs::File::open(path).unwrap()));
    let mut reader = decoder.read_info().unwrap();
    let mut buf = vec![0; reader.output_buffer_size().unwrap()];
    let info = reader.next_frame(&mut buf).unwrap();
    assert_eq!(info.color_type, png::ColorType::Rgba, "{}", path.display());
    buf.truncate(info.buffer_size());
    RgbaImage {
        width: info.width,
        height: info.height,
        pixels: buf,
    }
}

/// Returns the share of differing pixels and a diff image (red where pixels differ).
fn compare(expected: &RgbaImage, actual: &RgbaImage) -> (f64, RgbaImage) {
    let mut diff = vec![255u8; expected.pixels.len()];
    let mut differing = 0usize;
    let pairs = expected
        .pixels
        .as_chunks::<4>()
        .0
        .iter()
        .zip(actual.pixels.as_chunks::<4>().0);
    for (i, (e, a)) in pairs.enumerate() {
        let off = e
            .iter()
            .zip(a)
            .any(|(x, y)| x.abs_diff(*y) > CHANNEL_TOLERANCE);
        let px = if off {
            differing += 1;
            [255, 0, 0, 255]
        } else {
            // Faded copy of the expected image for context.
            let g = 200 + (u16::from(e[0]) + u16::from(e[1]) + u16::from(e[2])) as u8 / 13;
            [g, g, g, 255]
        };
        diff[i * 4..i * 4 + 4].copy_from_slice(&px);
    }
    let total = (expected.width * expected.height).max(1) as f64;
    (
        differing as f64 / total,
        RgbaImage {
            width: expected.width,
            height: expected.height,
            pixels: diff,
        },
    )
}

#[test]
fn page_one_matches_golden_images() {
    let update = std::env::var_os("LUMORA_UPDATE_GOLDEN").is_some();
    let engine = engine();
    let manifest: Manifest = serde_json::from_str(
        &std::fs::read_to_string(repo_root().join("tests/corpus/manifest.json")).unwrap(),
    )
    .unwrap();
    let diff_dir = repo_root().join("tests/golden/_diff");
    let _ = std::fs::remove_dir_all(&diff_dir);

    let mut failures = Vec::new();
    let mut checked = 0;
    for entry in manifest.files {
        let password = match (entry.expect.as_str(), &entry.password) {
            ("open", _) => None,
            (_, Some(password)) => Some(password.clone()),
            _ => continue, // files that don't open have no golden image
        };
        let path = repo_root().join("tests/corpus").join(&entry.file);
        let (doc, info) = engine.open(&path, OpenOptions { password }).unwrap();
        if info.page_count == 0 {
            engine.close(doc).unwrap();
            continue;
        }
        let actual = render_page_one(&engine, doc);
        engine.close(doc).unwrap();

        let golden = golden_path(&entry.file);
        if update || !golden.exists() {
            if !update {
                failures.push(format!(
                    "{}: no golden image (run with LUMORA_UPDATE_GOLDEN=1)",
                    entry.file
                ));
                continue;
            }
            write_png(&golden, &actual);
            continue;
        }
        checked += 1;
        let expected = read_png(&golden);
        if (expected.width, expected.height) != (actual.width, actual.height) {
            failures.push(format!(
                "{}: size {}×{} differs from golden {}×{}",
                entry.file, actual.width, actual.height, expected.width, expected.height
            ));
            write_png(
                &diff_dir.join(Path::new(&entry.file).with_extension("actual.png")),
                &actual,
            );
            continue;
        }
        let (ratio, diff) = compare(&expected, &actual);
        if ratio > MAX_DIFF_RATIO {
            failures.push(format!(
                "{}: {:.3}% of pixels differ",
                entry.file,
                ratio * 100.0
            ));
            write_png(
                &diff_dir.join(Path::new(&entry.file).with_extension("actual.png")),
                &actual,
            );
            write_png(
                &diff_dir.join(Path::new(&entry.file).with_extension("diff.png")),
                &diff,
            );
        }
    }
    assert!(
        failures.is_empty(),
        "golden mismatches (see tests/golden/_diff/):\n{}",
        failures.join("\n")
    );
    if !update {
        assert!(checked >= 30, "only {checked} golden images were compared");
    }
}

#[test]
fn comparison_detects_differences() {
    let white = RgbaImage {
        width: 10,
        height: 10,
        pixels: vec![255; 400],
    };
    let mut changed = white.clone();
    changed.pixels[0] = 0; // one pixel very different
    changed.pixels[4] = 250; // one pixel within tolerance
    let (ratio, _) = compare(&white, &changed);
    assert!((ratio - 0.01).abs() < 1e-9);
}
