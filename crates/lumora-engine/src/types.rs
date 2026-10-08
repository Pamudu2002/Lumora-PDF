//! Engine types shared by the engine, the renderer and the app.

use serde::{Deserialize, Serialize};

use crate::error::EngineError;

/// Identifies an open document for the lifetime of the engine. Never reused.
///
/// `u32` (not `u64`) so it maps to a plain JavaScript number over IPC.
pub type DocId = u32;

/// Zero-based page index.
pub type PageIndex = u32;

/// Smallest render scale accepted (1.0 = 72 dpi).
pub const MIN_SCALE: f32 = 0.01;

/// Largest render scale accepted (6400% zoom on a 2× display, with headroom).
pub const MAX_SCALE: f32 = 128.0;

/// Largest tile edge in pixels.
pub const MAX_TILE_SIZE: u32 = 2048;

/// Options for opening a document.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OpenOptions {
    /// Password for encrypted documents.
    pub password: Option<String>,
}

/// Facts about an open document.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocInfo {
    /// Number of pages.
    pub page_count: u32,
    /// The Info dictionary's Title, if any.
    pub title: Option<String>,
    /// The Info dictionary's Author, if any.
    pub author: Option<String>,
    /// True when the file is encrypted (with or without a user password).
    pub is_encrypted: bool,
    /// True when the document has an AcroForm.
    pub has_forms: bool,
    /// PDF version, e.g. "1.7".
    pub pdf_version: String,
}

/// A page's display size in PDF points (1/72 inch), with the page's /Rotate already applied.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSize {
    /// Width as displayed.
    pub width_pt: f32,
    /// Height as displayed.
    pub height_pt: f32,
}

impl PageSize {
    /// Largest page edge PDF allows (200 inches); anything bigger in a file is clamped.
    pub const MAX_PT: f32 = 14_400.0;

    /// Builds a page size from untrusted values: non-finite or non-positive values become 1 pt,
    /// huge values are clamped to [`PageSize::MAX_PT`].
    pub fn sanitized(width_pt: f32, height_pt: f32) -> Self {
        let clean = |v: f32| {
            if v.is_finite() && v > 0.0 {
                v.min(Self::MAX_PT)
            } else {
                1.0
            }
        };
        Self {
            width_pt: clean(width_pt),
            height_pt: clean(height_pt),
        }
    }

    /// The page's size in whole pixels at `scale` (1.0 = 72 dpi). Each edge is at least 1 px.
    ///
    /// The renderer and the UI must use this same rounding so tiles line up.
    pub fn pixel_size(&self, scale: f32) -> (u32, u32) {
        let px = |pt: f32| {
            let v = (pt * scale).round();
            if v.is_finite() && v >= 1.0 {
                // In range: pt <= 14_400 and scale <= MAX_SCALE keep this far below u32::MAX.
                v as u32
            } else {
                1
            }
        };
        (px(self.width_pt), px(self.height_pt))
    }
}

/// One square tile of a page rendered at a scale.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TileRequest {
    /// The document.
    pub doc: DocId,
    /// The page.
    pub page: PageIndex,
    /// Render scale; 1.0 = 72 dpi. The UI uses zoom × devicePixelRatio.
    pub scale: f32,
    /// Tile column (0 = left).
    pub tile_x: u32,
    /// Tile row (0 = top).
    pub tile_y: u32,
    /// Tile edge in pixels at this scale. Edge tiles are cropped to the page.
    pub tile_size: u32,
    /// Page dark mode. Reserved: applied by the renderer in task 1.14; ignored for now.
    pub dark_mode: bool,
}

impl TileRequest {
    /// Checks the scale and tile size, then returns the tile's pixel rectangle
    /// `(x, y, width, height)` within the page rendered at `scale`.
    pub fn pixel_rect(&self, page: PageSize) -> Result<(u32, u32, u32, u32), EngineError> {
        check_scale(self.scale)?;
        if self.tile_size == 0 || self.tile_size > MAX_TILE_SIZE {
            return Err(EngineError::InvalidRequest(format!(
                "tile size {} is outside 1..={MAX_TILE_SIZE}",
                self.tile_size
            )));
        }
        let (page_w, page_h) = page.pixel_size(self.scale);
        let x = u64::from(self.tile_x) * u64::from(self.tile_size);
        let y = u64::from(self.tile_y) * u64::from(self.tile_size);
        if x >= u64::from(page_w) || y >= u64::from(page_h) {
            return Err(EngineError::InvalidRequest(format!(
                "tile ({}, {}) is outside the page",
                self.tile_x, self.tile_y
            )));
        }
        // x < page_w and y < page_h, so both fit in u32.
        let (x, y) = (x as u32, y as u32);
        let w = self.tile_size.min(page_w - x);
        let h = self.tile_size.min(page_h - y);
        Ok((x, y, w, h))
    }
}

/// Rejects scales that are not finite or outside [`MIN_SCALE`]..=[`MAX_SCALE`].
pub(crate) fn check_scale(scale: f32) -> Result<(), EngineError> {
    if scale.is_finite() && (MIN_SCALE..=MAX_SCALE).contains(&scale) {
        Ok(())
    } else {
        Err(EngineError::InvalidRequest(format!(
            "scale {scale} is outside {MIN_SCALE}..={MAX_SCALE}"
        )))
    }
}

/// An 8-bit RGBA image (not premultiplied), row-major, no padding.
#[derive(Clone, PartialEq, Eq)]
pub struct RgbaImage {
    /// Width in pixels.
    pub width: u32,
    /// Height in pixels.
    pub height: u32,
    /// `width * height * 4` bytes.
    pub pixels: Vec<u8>,
}

impl RgbaImage {
    /// Size of the pixel buffer in bytes.
    pub fn byte_len(&self) -> usize {
        self.pixels.len()
    }
}

impl std::fmt::Debug for RgbaImage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RgbaImage")
            .field("width", &self.width)
            .field("height", &self.height)
            .finish_non_exhaustive()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn letter() -> PageSize {
        PageSize::sanitized(612.0, 792.0)
    }

    #[test]
    fn sanitizes_hostile_sizes() {
        let s = PageSize::sanitized(f32::NAN, -5.0);
        assert_eq!((s.width_pt, s.height_pt), (1.0, 1.0));
        let s = PageSize::sanitized(1e9, f32::INFINITY);
        assert_eq!((s.width_pt, s.height_pt), (PageSize::MAX_PT, 1.0));
    }

    #[test]
    fn pixel_size_rounds() {
        assert_eq!(letter().pixel_size(1.0), (612, 792));
        assert_eq!(letter().pixel_size(1.5), (918, 1188));
        assert_eq!(PageSize::sanitized(0.2, 0.2).pixel_size(1.0), (1, 1));
    }

    fn tile(tile_x: u32, tile_y: u32, scale: f32) -> TileRequest {
        TileRequest {
            doc: 1,
            page: 0,
            scale,
            tile_x,
            tile_y,
            tile_size: 512,
            dark_mode: false,
        }
    }

    #[test]
    fn interior_and_edge_tiles() {
        assert_eq!(
            tile(0, 0, 1.0).pixel_rect(letter()).unwrap(),
            (0, 0, 512, 512)
        );
        // 612 - 512 = 100 px left in the last column; 792 - 512 = 280 px in the last row.
        assert_eq!(
            tile(1, 1, 1.0).pixel_rect(letter()).unwrap(),
            (512, 512, 100, 280)
        );
    }

    #[test]
    fn rejects_out_of_page_tiles_and_bad_scales() {
        assert!(tile(2, 0, 1.0).pixel_rect(letter()).is_err());
        assert!(tile(0, 0, 0.0).pixel_rect(letter()).is_err());
        assert!(tile(0, 0, f32::NAN).pixel_rect(letter()).is_err());
        assert!(tile(0, 0, 1000.0).pixel_rect(letter()).is_err());
        assert!(tile(u32::MAX, u32::MAX, 1.0).pixel_rect(letter()).is_err());
        let mut t = tile(0, 0, 1.0);
        t.tile_size = 0;
        assert!(t.pixel_rect(letter()).is_err());
    }
}
