//! Tile math. The TypeScript side (`src/lib/tiles.ts`) mirrors these rules; keep them in sync.

use lumora_engine::PageSize;

/// Tile edge in pixels (plan section 3.5).
pub const DEFAULT_TILE_SIZE: u32 = 512;

/// Converts a render scale to the integer "milli-scale" used in tile URLs and cache keys
/// (1.0 → 1000). Non-finite or negative scales map to 0, which the engine rejects.
pub fn scale_to_milli(scale: f32) -> u32 {
    let milli = (scale * 1000.0).round();
    if milli.is_finite() && milli > 0.0 {
        // Saturating float → int conversion; anything huge is rejected by the engine anyway.
        milli as u32
    } else {
        0
    }
}

/// Converts a milli-scale back to a render scale (1000 → 1.0).
pub fn milli_to_scale(milli: u32) -> f32 {
    milli as f32 / 1000.0
}

/// The grid of tiles covering one page at one scale.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TileGrid {
    /// Page width in pixels at this scale.
    pub page_width: u32,
    /// Page height in pixels at this scale.
    pub page_height: u32,
    /// Tile edge in pixels.
    pub tile_size: u32,
    /// Tile columns.
    pub columns: u32,
    /// Tile rows.
    pub rows: u32,
}

impl TileGrid {
    /// The grid for `page` rendered at `scale` with square tiles of `tile_size` px
    /// (a `tile_size` of 0 is treated as 1).
    pub fn new(page: PageSize, scale: f32, tile_size: u32) -> Self {
        let tile_size = tile_size.max(1);
        let (page_width, page_height) = page.pixel_size(scale);
        Self {
            page_width,
            page_height,
            tile_size,
            columns: page_width.div_ceil(tile_size),
            rows: page_height.div_ceil(tile_size),
        }
    }

    /// Total number of tiles.
    pub fn len(&self) -> u32 {
        self.columns * self.rows
    }

    /// True if the grid has no tiles (never, since pages are at least 1 px).
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// The pixel rectangle `(x, y, width, height)` of a tile, or `None` if outside the grid.
    pub fn tile_rect(&self, tile_x: u32, tile_y: u32) -> Option<(u32, u32, u32, u32)> {
        if tile_x >= self.columns || tile_y >= self.rows {
            return None;
        }
        let x = tile_x * self.tile_size;
        let y = tile_y * self.tile_size;
        Some((
            x,
            y,
            self.tile_size.min(self.page_width - x),
            self.tile_size.min(self.page_height - y),
        ))
    }

    /// Tiles intersecting the pixel rectangle `(x, y, width, height)` (page pixel coordinates;
    /// may extend past the page), as `(tile_x, tile_y)` in row-major order.
    pub fn tiles_in(&self, x: f64, y: f64, width: f64, height: f64) -> Vec<(u32, u32)> {
        if !(x.is_finite() && y.is_finite() && width.is_finite() && height.is_finite())
            || width <= 0.0
            || height <= 0.0
        {
            return Vec::new();
        }
        let ts = f64::from(self.tile_size);
        let clamp = |v: f64, max: u32| -> u32 { v.clamp(0.0, f64::from(max)) as u32 };
        let x0 = clamp((x / ts).floor(), self.columns);
        let y0 = clamp((y / ts).floor(), self.rows);
        let x1 = clamp(((x + width) / ts).ceil(), self.columns);
        let y1 = clamp(((y + height) / ts).ceil(), self.rows);
        (y0..y1)
            .flat_map(|ty| (x0..x1).map(move |tx| (tx, ty)))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn letter() -> PageSize {
        PageSize::sanitized(612.0, 792.0)
    }

    #[test]
    fn milli_scale_round_trips() {
        assert_eq!(scale_to_milli(1.0), 1000);
        assert_eq!(scale_to_milli(1.25), 1250);
        assert_eq!(scale_to_milli(0.3333), 333);
        assert_eq!(scale_to_milli(f32::NAN), 0);
        assert_eq!(scale_to_milli(-2.0), 0);
        assert_eq!(milli_to_scale(1500), 1.5);
    }

    #[test]
    fn grid_covers_the_page() {
        let g = TileGrid::new(letter(), 1.0, 512);
        assert_eq!((g.columns, g.rows, g.len()), (2, 2, 4));
        assert_eq!(g.tile_rect(1, 1), Some((512, 512, 100, 280)));
        assert_eq!(g.tile_rect(2, 0), None);

        let g = TileGrid::new(letter(), 2.0, 512);
        assert_eq!((g.page_width, g.page_height), (1224, 1584));
        assert_eq!((g.columns, g.rows), (3, 4));
    }

    #[test]
    fn finds_visible_tiles() {
        let g = TileGrid::new(letter(), 2.0, 512);
        assert_eq!(g.tiles_in(0.0, 0.0, 100.0, 100.0), vec![(0, 0)]);
        assert_eq!(
            g.tiles_in(500.0, 500.0, 100.0, 100.0),
            vec![(0, 0), (1, 0), (0, 1), (1, 1)]
        );
        // A viewport larger than the page is clamped to the grid.
        assert_eq!(g.tiles_in(-1000.0, -1000.0, 1e6, 1e6).len(), 12);
        assert!(g.tiles_in(5000.0, 0.0, 10.0, 10.0).is_empty());
        assert!(g.tiles_in(0.0, 0.0, 0.0, 10.0).is_empty());
        assert!(g.tiles_in(f64::NAN, 0.0, 10.0, 10.0).is_empty());
    }
}
