//! Document content the UI reads: text, search hits, outline, links and properties.
//!
//! All positions are in **display points**: PDF points (1/72 inch) measured from the top-left
//! corner of the page as it is shown, with the page's /Rotate already applied.

use serde::{Deserialize, Serialize};

use crate::types::PageIndex;

/// A rectangle in display points.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    /// Left edge.
    pub x: f32,
    /// Top edge.
    pub y: f32,
    /// Width.
    pub width: f32,
    /// Height.
    pub height: f32,
}

impl Rect {
    /// The smallest rectangle containing both corners.
    pub fn from_corners(x0: f32, y0: f32, x1: f32, y1: f32) -> Self {
        Self {
            x: x0.min(x1),
            y: y0.min(y1),
            width: (x1 - x0).abs(),
            height: (y1 - y0).abs(),
        }
    }

    /// True when every value is finite (hostile files can produce NaN geometry).
    pub fn is_finite(&self) -> bool {
        self.x.is_finite()
            && self.y.is_finite()
            && self.width.is_finite()
            && self.height.is_finite()
    }
}

/// A run of text on one line, as PDFium groups it.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextRun {
    /// The characters, in reading order.
    pub text: String,
    /// Where the run is drawn.
    pub rect: Rect,
}

/// The text of one page, in reading order.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageText {
    /// Text runs; consecutive runs on different lines are separated by a line break when copied.
    pub runs: Vec<TextRun>,
}

/// How to match a search query.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    /// Match upper/lower case exactly.
    pub match_case: bool,
    /// Only match whole words.
    pub whole_word: bool,
}

/// One search match.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    /// The page the match is on.
    pub page: PageIndex,
    /// Highlight rectangles (one per line the match spans).
    pub rects: Vec<Rect>,
    /// Text around the match, for the results list.
    pub snippet: String,
    /// Where the match starts in `snippet`, in characters.
    pub match_start: u32,
    /// Length of the match in `snippet`, in characters.
    pub match_len: u32,
}

/// An outline (bookmark) entry.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineItem {
    /// Entry title.
    pub title: String,
    /// Target page, if the entry points at one in this document.
    pub page: Option<PageIndex>,
    /// Nested entries.
    pub children: Vec<OutlineItem>,
}

/// Where a link goes.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LinkTarget {
    /// A page in this document.
    Page {
        /// Target page.
        page: PageIndex,
    },
    /// A web or mail address. Opened only after the user confirms.
    Uri {
        /// The address.
        uri: String,
    },
}

/// A clickable link area on a page.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageLink {
    /// The clickable area.
    pub rect: Rect,
    /// Where it goes.
    pub target: LinkTarget,
}

/// A font used by the document.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontInfo {
    /// Font name as stored in the file.
    pub name: String,
    /// True when the font is embedded in the file.
    pub embedded: bool,
}

/// Facts for the Document properties dialog.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocProperties {
    /// Title.
    pub title: Option<String>,
    /// Author.
    pub author: Option<String>,
    /// Subject.
    pub subject: Option<String>,
    /// Keywords.
    pub keywords: Option<String>,
    /// The application that created the original document.
    pub creator: Option<String>,
    /// The application that produced the PDF.
    pub producer: Option<String>,
    /// Creation date, `YYYY-MM-DD HH:MM` when it could be parsed.
    pub created: Option<String>,
    /// Modification date, `YYYY-MM-DD HH:MM` when it could be parsed.
    pub modified: Option<String>,
    /// PDF version, e.g. "1.7".
    pub pdf_version: String,
    /// Number of pages.
    pub page_count: u32,
    /// True when the file is encrypted.
    pub is_encrypted: bool,
    /// True when the document has form fields.
    pub has_forms: bool,
    /// Fonts used on the scanned pages, sorted by name.
    pub fonts: Vec<FontInfo>,
    /// How many pages were scanned for fonts (large documents are sampled).
    pub fonts_scanned_pages: u32,
}

/// Formats a PDF date string (`D:YYYYMMDDHHmmSS…`) as `YYYY-MM-DD HH:MM`. Returns the input
/// unchanged when it doesn't look like a PDF date.
pub fn format_pdf_date(raw: &str) -> String {
    let digits: String = raw
        .trim()
        .trim_start_matches("D:")
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();
    if digits.len() < 8 {
        return raw.trim().to_string();
    }
    let part = |from: usize, to: usize| digits.get(from..to).unwrap_or("00");
    let mut out = format!("{}-{}-{}", part(0, 4), part(4, 6), part(6, 8));
    if digits.len() >= 12 {
        out.push_str(&format!(" {}:{}", part(8, 10), part(10, 12)));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_pdf_dates() {
        assert_eq!(
            format_pdf_date("D:20231005143000+02'00'"),
            "2023-10-05 14:30"
        );
        assert_eq!(format_pdf_date("D:20231005"), "2023-10-05");
        assert_eq!(format_pdf_date("yesterday"), "yesterday");
    }

    #[test]
    fn rect_from_corners_normalizes() {
        let r = Rect::from_corners(10.0, 50.0, 2.0, 20.0);
        assert_eq!((r.x, r.y, r.width, r.height), (2.0, 20.0, 8.0, 30.0));
    }
}
