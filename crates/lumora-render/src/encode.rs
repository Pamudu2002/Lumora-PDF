//! Image encoding for tiles and thumbnails.

use image_webp::{ColorType, WebPEncoder};
use lumora_engine::RgbaImage;

use crate::error::RenderError;

/// Output format for page images.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ImageFormat {
    /// PNG with fast compression. The default: quick to encode, decoded natively by every WebView.
    #[default]
    Png,
    /// Lossless WebP. Smaller, but slower to encode.
    WebP,
}

impl ImageFormat {
    /// The MIME type for HTTP responses.
    pub fn content_type(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::WebP => "image/webp",
        }
    }
}

/// Encodes an image. Fully opaque images are written without an alpha channel.
pub fn encode(image: &RgbaImage, format: ImageFormat) -> Result<Vec<u8>, RenderError> {
    let expected = (image.width as usize) * (image.height as usize) * 4;
    if image.pixels.len() != expected || image.width == 0 || image.height == 0 {
        return Err(RenderError::Encode(format!(
            "bad image buffer: {}×{} with {} bytes",
            image.width,
            image.height,
            image.pixels.len()
        )));
    }
    let opaque = image
        .pixels
        .as_chunks::<4>()
        .0
        .iter()
        .all(|px| px[3] == 255);
    let rgb;
    let (data, channels) = if opaque {
        rgb = drop_alpha(&image.pixels);
        (rgb.as_slice(), 3)
    } else {
        (image.pixels.as_slice(), 4)
    };
    match format {
        ImageFormat::Png => encode_png(data, image.width, image.height, channels),
        ImageFormat::WebP => encode_webp(data, image.width, image.height, channels),
    }
}

fn drop_alpha(rgba: &[u8]) -> Vec<u8> {
    let mut rgb = Vec::with_capacity(rgba.len() / 4 * 3);
    for px in rgba.as_chunks::<4>().0 {
        rgb.extend_from_slice(&px[..3]);
    }
    rgb
}

fn encode_png(data: &[u8], width: u32, height: u32, channels: u8) -> Result<Vec<u8>, RenderError> {
    let mut out = Vec::with_capacity(data.len() / 4);
    let mut encoder = png::Encoder::new(&mut out, width, height);
    encoder.set_color(if channels == 4 {
        png::ColorType::Rgba
    } else {
        png::ColorType::Rgb
    });
    encoder.set_depth(png::BitDepth::Eight);
    encoder.set_compression(png::Compression::Fast);
    let mut writer = encoder
        .write_header()
        .map_err(|e| RenderError::Encode(e.to_string()))?;
    writer
        .write_image_data(data)
        .map_err(|e| RenderError::Encode(e.to_string()))?;
    writer
        .finish()
        .map_err(|e| RenderError::Encode(e.to_string()))?;
    Ok(out)
}

fn encode_webp(data: &[u8], width: u32, height: u32, channels: u8) -> Result<Vec<u8>, RenderError> {
    let mut out = Vec::with_capacity(data.len() / 4);
    let color = if channels == 4 {
        ColorType::Rgba8
    } else {
        ColorType::Rgb8
    };
    WebPEncoder::new(&mut out)
        .encode(data, width, height, color)
        .map_err(|e| RenderError::Encode(e.to_string()))?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn checker(width: u32, height: u32, alpha: u8) -> RgbaImage {
        let mut pixels = Vec::new();
        for y in 0..height {
            for x in 0..width {
                let v = if (x / 8 + y / 8) % 2 == 0 { 0 } else { 255 };
                pixels.extend_from_slice(&[v, v / 2, 255 - v, alpha]);
            }
        }
        RgbaImage {
            width,
            height,
            pixels,
        }
    }

    fn decode_png(bytes: &[u8]) -> (png::OutputInfo, Vec<u8>) {
        let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut buf = vec![0; reader.output_buffer_size().unwrap()];
        let info = reader.next_frame(&mut buf).unwrap();
        buf.truncate(info.buffer_size());
        (info, buf)
    }

    #[test]
    fn png_round_trips_opaque_images_as_rgb() {
        let img = checker(40, 24, 255);
        let bytes = encode(&img, ImageFormat::Png).unwrap();
        let (info, data) = decode_png(&bytes);
        assert_eq!((info.width, info.height), (40, 24));
        assert_eq!(info.color_type, png::ColorType::Rgb);
        assert_eq!(data, drop_alpha(&img.pixels));
    }

    #[test]
    fn png_keeps_alpha_when_needed() {
        let img = checker(16, 16, 128);
        let (info, data) = decode_png(&encode(&img, ImageFormat::Png).unwrap());
        assert_eq!(info.color_type, png::ColorType::Rgba);
        assert_eq!(data, img.pixels);
    }

    #[test]
    fn webp_round_trips_losslessly() {
        let img = checker(33, 17, 255);
        let bytes = encode(&img, ImageFormat::WebP).unwrap();
        assert_eq!(&bytes[..4], b"RIFF");
        let mut decoder = image_webp::WebPDecoder::new(std::io::Cursor::new(&bytes)).unwrap();
        assert_eq!(decoder.dimensions(), (33, 17));
        let mut buf = vec![0; decoder.output_buffer_size().unwrap()];
        decoder.read_image(&mut buf).unwrap();
        assert_eq!(buf, drop_alpha(&img.pixels));
    }

    #[test]
    fn rejects_inconsistent_buffers() {
        let mut img = checker(4, 4, 255);
        img.pixels.pop();
        assert!(encode(&img, ImageFormat::Png).is_err());
    }
}
