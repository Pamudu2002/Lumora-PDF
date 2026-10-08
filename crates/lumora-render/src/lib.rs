//! Tile math, the tile LRU cache and image encoding for Lumora PDF (plan section 3.5).
//!
//! Pages reach the UI as 512 px tiles through the `lumora://` protocol. [`TileService`] answers a
//! tile request from the [`TileCache`] or renders it with the engine, encodes it and caches it.

mod cache;
mod encode;
mod error;
mod service;
mod tiles;

pub use cache::{CacheKey, EncodedImage, TileCache};
pub use encode::{ImageFormat, encode};
pub use error::RenderError;
pub use service::TileService;
pub use tiles::{DEFAULT_TILE_SIZE, TileGrid, milli_to_scale, scale_to_milli};
