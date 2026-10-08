//! Render errors.

use lumora_engine::EngineError;
use thiserror::Error;

/// Errors from rendering or encoding a tile.
#[derive(Debug, Error)]
pub enum RenderError {
    /// The engine failed.
    #[error(transparent)]
    Engine(#[from] EngineError),

    /// The image could not be encoded.
    #[error("could not encode image: {0}")]
    Encode(String),
}
