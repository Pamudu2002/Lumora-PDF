//! The `lumora://` protocol: serves page tiles and thumbnails as images (plan section 3.5).
//!
//! Paths (the UI builds them with `tileUrl` / `thumbnailUrl` in `src/lib/tiles.ts`):
//!
//! - `/tile/{docId}/{page}/{scaleMilli}/{tileX}/{tileY}?rev={rev}&dark={0|1}`
//! - `/thumb/{docId}/{page}/{maxPx}?rev={rev}`
//!
//! On Windows the WebView reaches custom schemes as `http://lumora.localhost/…`; elsewhere as
//! `lumora://localhost/…`. Only the path and query matter here.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::Arc;

use lumora_engine::{DocId, EngineError, PageIndex};
use lumora_render::{EncodedImage, RenderError, TileService};
use tauri::http::{Request, Response, StatusCode, header};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use crate::state::AppState;

/// The URL scheme.
pub const SCHEME: &str = "lumora";

/// A parsed image request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageRequest {
    /// One tile.
    Tile {
        /// Document.
        doc: DocId,
        /// Page.
        page: PageIndex,
        /// Scale × 1000.
        scale_milli: u32,
        /// Tile column.
        tile_x: u32,
        /// Tile row.
        tile_y: u32,
        /// Document revision the UI expects.
        rev: u32,
        /// Page dark mode.
        dark: bool,
    },
    /// A page thumbnail.
    Thumbnail {
        /// Document.
        doc: DocId,
        /// Page.
        page: PageIndex,
        /// Longer edge in pixels.
        max_px: u32,
        /// Document revision the UI expects.
        rev: u32,
    },
}

impl ImageRequest {
    /// Parses a request path and query. Returns `None` for anything malformed.
    pub fn parse(path: &str, query: Option<&str>) -> Option<Self> {
        let mut parts = path.trim_start_matches('/').split('/');
        let kind = parts.next()?;
        let mut num = || parts.next().and_then(|s| s.parse::<u32>().ok());
        let request = match kind {
            "tile" => {
                let (doc, page, scale_milli, tile_x, tile_y) =
                    (num()?, num()?, num()?, num()?, num()?);
                Self::Tile {
                    doc,
                    page,
                    scale_milli,
                    tile_x,
                    tile_y,
                    rev: query_param(query, "rev")?,
                    dark: query_param(query, "dark").unwrap_or(0) == 1,
                }
            }
            "thumb" => {
                let (doc, page, max_px) = (num()?, num()?, num()?);
                Self::Thumbnail {
                    doc,
                    page,
                    max_px,
                    rev: query_param(query, "rev")?,
                }
            }
            _ => return None,
        };
        if parts.next().is_some() {
            return None;
        }
        Some(request)
    }

    fn doc(&self) -> DocId {
        match *self {
            Self::Tile { doc, .. } | Self::Thumbnail { doc, .. } => doc,
        }
    }

    /// Renders (or fetches from cache) the image.
    fn serve(&self, tiles: &TileService) -> Result<Arc<EncodedImage>, RenderError> {
        match *self {
            Self::Tile {
                doc,
                page,
                scale_milli,
                tile_x,
                tile_y,
                rev,
                dark,
            } => tiles.tile(doc, page, scale_milli, tile_x, tile_y, u64::from(rev), dark),
            Self::Thumbnail {
                doc,
                page,
                max_px,
                rev,
            } => tiles.thumbnail(doc, page, max_px, u64::from(rev)),
        }
    }
}

fn query_param(query: Option<&str>, name: &str) -> Option<u32> {
    query?
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(k, _)| *k == name)
        .and_then(|(_, v)| v.parse().ok())
}

/// The asynchronous handler registered with `register_asynchronous_uri_scheme_protocol`.
pub fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    let uri = request.uri().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Always answer, even if rendering panics, so the image request never hangs.
        let response = catch_unwind(AssertUnwindSafe(|| {
            match ImageRequest::parse(uri.path(), uri.query()) {
                None => text_response(StatusCode::BAD_REQUEST, "malformed lumora:// path"),
                Some(req) => respond(&app, req),
            }
        }))
        .unwrap_or_else(|_| text_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error"));
        responder.respond(response);
    });
}

fn respond<R: Runtime>(app: &tauri::AppHandle<R>, req: ImageRequest) -> Response<Vec<u8>> {
    let Some(state) = app.try_state::<AppState>() else {
        return text_response(StatusCode::SERVICE_UNAVAILABLE, "starting up");
    };
    let core = match state.core() {
        Ok(core) => core,
        Err(err) => return text_response(StatusCode::SERVICE_UNAVAILABLE, &err.detail),
    };
    if core.documents.revision(req.doc()).is_none() {
        return text_response(StatusCode::NOT_FOUND, "document is not open");
    }
    match req.serve(&core.tiles) {
        Ok(image) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, image.format.content_type())
            // URLs include the document revision, so a URL's image never changes.
            .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(image.bytes.clone())
            .unwrap_or_else(|_| text_response(StatusCode::INTERNAL_SERVER_ERROR, "response")),
        Err(RenderError::Engine(EngineError::Cancelled)) => {
            // The page scrolled out of view before its turn. 204 (not an error status, so the
            // WebView doesn't log it) and not cached, so asking again later renders it.
            Response::builder()
                .status(StatusCode::NO_CONTENT)
                .header(header::CACHE_CONTROL, "no-store")
                .body(Vec::new())
                .unwrap_or_default()
        }
        Err(err) => {
            let status = match &err {
                RenderError::Engine(
                    EngineError::UnknownDocument(_) | EngineError::PageOutOfRange { .. },
                ) => StatusCode::NOT_FOUND,
                RenderError::Engine(EngineError::InvalidRequest(_)) => StatusCode::BAD_REQUEST,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            if status == StatusCode::INTERNAL_SERVER_ERROR {
                tracing::warn!(?req, %err, "tile request failed");
            }
            text_response(status, &err.to_string())
        }
    }
}

fn text_response(status: StatusCode, body: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(body.as_bytes().to_vec())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tile_paths() {
        assert_eq!(
            ImageRequest::parse("/tile/3/12/1500/1/2", Some("rev=7&dark=1")),
            Some(ImageRequest::Tile {
                doc: 3,
                page: 12,
                scale_milli: 1500,
                tile_x: 1,
                tile_y: 2,
                rev: 7,
                dark: true,
            })
        );
        assert_eq!(
            ImageRequest::parse("/tile/3/0/1000/0/0", Some("dark=0&rev=0")),
            Some(ImageRequest::Tile {
                doc: 3,
                page: 0,
                scale_milli: 1000,
                tile_x: 0,
                tile_y: 0,
                rev: 0,
                dark: false,
            })
        );
    }

    #[test]
    fn parses_thumbnail_paths() {
        assert_eq!(
            ImageRequest::parse("/thumb/1/4/240", Some("rev=2")),
            Some(ImageRequest::Thumbnail {
                doc: 1,
                page: 4,
                max_px: 240,
                rev: 2,
            })
        );
    }

    #[test]
    fn rejects_malformed_paths() {
        for (path, query) in [
            ("/tile/1/0/1000/0", Some("rev=0")),             // missing tile_y
            ("/tile/1/0/1000/0/0/9", Some("rev=0")),         // extra segment
            ("/tile/1/0/1000/0/0", None),                    // missing rev
            ("/tile/1/-1/1000/0/0", Some("rev=0")),          // negative page
            ("/tile/x/0/1000/0/0", Some("rev=0")),           // not a number
            ("/tile/1/0/1000/0/99999999999", Some("rev=0")), // overflow
            ("/thumb/1/0", Some("rev=0")),
            ("/other/1", Some("rev=0")),
            ("/", None),
            ("", None),
        ] {
            assert_eq!(ImageRequest::parse(path, query), None, "{path}");
        }
    }
}
