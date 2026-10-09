//! Reading content out of PDFium: text, search, outline, links, properties and image areas.
//!
//! Every function here runs on the engine worker thread. Positions are converted to display points
//! (top-left origin, /Rotate applied) with PDFium's own page-to-device transform, so they line up
//! with rendered tiles exactly.

use std::collections::BTreeMap;

use pdfium_render::prelude::{
    PdfBookmark, PdfDocument, PdfDocumentMetadataTagType, PdfPage, PdfPageObjectCommon,
    PdfPageObjectType, PdfPageObjectsCommon, PdfPoints, PdfRect, PdfRenderConfig, PdfSearchOptions,
};

use crate::content::{
    DocProperties, FontInfo, LinkTarget, OutlineItem, PageLink, PageText, Rect, SearchHit,
    SearchOptions, TextRun, format_pdf_date,
};
use crate::error::EngineError;
use crate::types::{PageIndex, PageSize};

/// Text runs kept per page; more than this is almost certainly a hostile or broken file.
const MAX_RUNS_PER_PAGE: usize = 20_000;
/// Matches reported per page.
const MAX_HITS_PER_PAGE: usize = 1_000;
/// Characters of context on each side of a search match.
const SNIPPET_CONTEXT: usize = 40;
/// Outline entries read in total (guards against circular outlines).
const MAX_OUTLINE_ITEMS: usize = 10_000;
/// Deepest outline nesting read.
const MAX_OUTLINE_DEPTH: usize = 32;
/// Links read per page.
const MAX_LINKS_PER_PAGE: usize = 5_000;
/// Image objects considered per page for Page dark mode.
const MAX_IMAGE_RECTS: usize = 500;
/// Pages scanned for the fonts list in Document properties.
const MAX_FONT_SCAN_PAGES: u32 = 100;

/// Converts page-space points to display points using PDFium's transform for the page.
pub(super) struct Geometry<'a, 'p> {
    page: &'a PdfPage<'p>,
    config: PdfRenderConfig,
    /// Sub-point precision: PDFium returns whole device pixels, so map to a page `K` times larger.
    k: f32,
}

impl<'a, 'p> Geometry<'a, 'p> {
    pub(super) fn new(page: &'a PdfPage<'p>, size: PageSize) -> Self {
        let k = 8.0;
        let config = PdfRenderConfig::new()
            .set_fixed_size((size.width_pt * k) as i32, (size.height_pt * k) as i32);
        Self { page, config, k }
    }

    fn point(&self, x: PdfPoints, y: PdfPoints) -> Option<(f32, f32)> {
        self.page
            .points_to_pixels(x, y, &self.config)
            .ok()
            .map(|(px, py)| (px as f32 / self.k, py as f32 / self.k))
    }

    /// A page-space rectangle in display points, or `None` if PDFium can't map it.
    pub(super) fn rect(&self, r: &PdfRect) -> Option<Rect> {
        let (x0, y0) = self.point(r.left(), r.bottom())?;
        let (x1, y1) = self.point(r.right(), r.top())?;
        let rect = Rect::from_corners(x0, y0, x1, y1);
        rect.is_finite().then_some(rect)
    }
}

fn text_err(e: impl std::fmt::Debug) -> EngineError {
    EngineError::Render(format!("could not read page text: {e:?}"))
}

/// The text runs of a page in reading order.
pub(super) fn page_text(page: &PdfPage<'_>, size: PageSize) -> Result<PageText, EngineError> {
    let text = page.text().map_err(text_err)?;
    let geom = Geometry::new(page, size);
    let mut runs = Vec::new();
    for segment in text.segments().iter() {
        if runs.len() >= MAX_RUNS_PER_PAGE {
            tracing::warn!("page text truncated at {MAX_RUNS_PER_PAGE} runs");
            break;
        }
        let run_text = clean_text(&segment.text());
        if run_text.trim().is_empty() {
            continue;
        }
        if let Some(rect) = geom.rect(&segment.bounds())
            && rect.width > 0.0
            && rect.height > 0.0
        {
            runs.push(TextRun {
                text: run_text,
                rect,
            });
        }
    }
    Ok(PageText { runs })
}

/// Replaces control characters (PDFs contain plenty) with spaces.
fn clean_text(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect()
}

/// Every match of `query` on one page.
pub(super) fn search_page(
    page: &PdfPage<'_>,
    page_index: PageIndex,
    size: PageSize,
    query: &str,
    opts: SearchOptions,
) -> Result<Vec<SearchHit>, EngineError> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let text = page.text().map_err(text_err)?;
    let options = PdfSearchOptions::new()
        .match_case(opts.match_case)
        .match_whole_word(opts.whole_word);
    let search = text.search(query, &options).map_err(text_err)?;
    let geom = Geometry::new(page, size);
    let chars = text.chars();
    let char_count = text.len().max(0) as usize;
    let char_at = |i: usize| {
        chars
            .get(i)
            .ok()
            .and_then(|c| c.unicode_char())
            .map(|c| if c.is_control() { ' ' } else { c })
            .unwrap_or(' ')
    };

    let mut hits = Vec::new();
    while let Some(segments) = search.find_next() {
        if hits.len() >= MAX_HITS_PER_PAGE {
            break;
        }
        let mut rects = Vec::new();
        let mut first = None;
        for segment in segments.iter() {
            if let Some(rect) = geom.rect(&segment.bounds()) {
                rects.push(rect);
            }
            if first.is_none() {
                first = segment.chars().ok().and_then(|c| c.first_char_index());
            }
        }
        if rects.is_empty() {
            continue;
        }
        // A match is as long as the query (PDFium matches character for character); a segment's
        // own character range can run past the match, so it isn't used for the length.
        let query_len = query.chars().count();
        let (snippet, match_start, match_len) = match first {
            Some(first) if first + query_len <= char_count => {
                let from = first.saturating_sub(SNIPPET_CONTEXT);
                let to = (first + query_len + SNIPPET_CONTEXT).min(char_count);
                let snippet: String = (from..to).map(char_at).collect();
                (snippet, (first - from) as u32, query_len as u32)
            }
            _ => (query.to_string(), 0, query_len as u32),
        };
        hits.push(SearchHit {
            page: page_index,
            rects,
            snippet,
            match_start,
            match_len,
        });
    }
    Ok(hits)
}

/// The document outline, with limits that stop circular or absurdly deep outlines.
pub(super) fn outline(doc: &PdfDocument<'_>) -> Vec<OutlineItem> {
    let page_count = u32::try_from(doc.pages().len()).unwrap_or(0);
    let mut budget = MAX_OUTLINE_ITEMS;
    collect_outline(
        doc.bookmarks().root(),
        0,
        page_count,
        &mut budget,
        &mut Vec::new(),
    )
}

/// Walks one level of the outline. Broken files can link entries in a loop (a sibling list that
/// comes back to its start, or a child that points at an ancestor); PDFium exposes no stable
/// identity for entries, so loops are detected by an entry repeating an earlier sibling or an
/// ancestor (same title and target).
fn collect_outline(
    first: Option<PdfBookmark<'_>>,
    depth: usize,
    page_count: u32,
    budget: &mut usize,
    ancestors: &mut Vec<(String, Option<PageIndex>)>,
) -> Vec<OutlineItem> {
    let mut items: Vec<OutlineItem> = Vec::new();
    let mut current = first;
    while let Some(bookmark) = current {
        if *budget == 0 || depth >= MAX_OUTLINE_DEPTH {
            break;
        }
        *budget -= 1;
        let page = bookmark
            .destination()
            .and_then(|d| d.page_index().ok())
            .or_else(|| {
                bookmark.action().and_then(|a| {
                    a.as_local_destination_action()
                        .and_then(|l| l.destination().ok())
                        .and_then(|d| d.page_index().ok())
                })
            })
            .and_then(|p| u32::try_from(p).ok())
            .filter(|p| *p < page_count);
        let title = bookmark
            .title()
            .map(|t| clean_text(&t).trim().to_string())
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| "Untitled".to_string());
        let key = (title.clone(), page);
        let repeats_sibling = items.iter().any(|i| i.title == key.0 && i.page == key.1);
        if repeats_sibling || ancestors.contains(&key) {
            break;
        }
        ancestors.push(key);
        let children = collect_outline(
            bookmark.first_child(),
            depth + 1,
            page_count,
            budget,
            ancestors,
        );
        ancestors.pop();
        items.push(OutlineItem {
            title,
            page,
            children,
        });
        current = bookmark.next_sibling();
    }
    items
}

/// The links on a page. Links to other files and launch actions are left out.
pub(super) fn page_links(page: &PdfPage<'_>, size: PageSize, page_count: u32) -> Vec<PageLink> {
    let geom = Geometry::new(page, size);
    let mut links = Vec::new();
    for link in page.links().iter().take(MAX_LINKS_PER_PAGE) {
        let Some(rect) = link.rect().ok().and_then(|r| geom.rect(&r)) else {
            continue;
        };
        let page_target = link
            .destination()
            .and_then(|d| d.page_index().ok())
            .or_else(|| {
                link.action().and_then(|a| {
                    a.as_local_destination_action()
                        .and_then(|l| l.destination().ok())
                        .and_then(|d| d.page_index().ok())
                })
            })
            .and_then(|p| u32::try_from(p).ok())
            .filter(|p| *p < page_count);
        let target = if let Some(page) = page_target {
            LinkTarget::Page { page }
        } else if let Some(uri) = link
            .action()
            .and_then(|a| a.as_uri_action().and_then(|u| u.uri().ok()))
            .map(|u| u.trim().to_string())
            .filter(|u| !u.is_empty())
        {
            LinkTarget::Uri { uri }
        } else {
            continue;
        };
        let link = PageLink { rect, target };
        // Some files define the same link several times.
        if !links.contains(&link) {
            links.push(link);
        }
    }
    links
}

/// Areas of a page covered by images, so Page dark mode can leave photos untouched.
pub(super) fn image_rects(page: &PdfPage<'_>, size: PageSize) -> Vec<Rect> {
    let geom = Geometry::new(page, size);
    page.objects()
        .iter()
        .filter(|o| o.object_type() == PdfPageObjectType::Image)
        .filter_map(|o| o.bounds().ok())
        .filter_map(|q| geom.rect(&q.to_rect()))
        .take(MAX_IMAGE_RECTS)
        .collect()
}

/// Metadata and fonts for the Document properties dialog.
pub(super) fn properties(
    doc: &PdfDocument<'_>,
    pdf_version: String,
    is_encrypted: bool,
) -> DocProperties {
    let meta = |tag| {
        doc.metadata()
            .get(tag)
            .map(|t| clean_text(t.value()).trim().to_string())
            .filter(|v| !v.is_empty())
    };
    let page_count = u32::try_from(doc.pages().len()).unwrap_or(0);
    let scan = page_count.min(MAX_FONT_SCAN_PAGES);
    let mut fonts = BTreeMap::new();
    for index in 0..scan {
        let Ok(page) = doc.pages().get(index as i32) else {
            continue;
        };
        for font in page.fonts() {
            let name = clean_text(&font.name()).trim().to_string();
            if name.is_empty() {
                continue;
            }
            let embedded = font.is_embedded().unwrap_or(false);
            fonts
                .entry(name)
                .and_modify(|e: &mut bool| *e |= embedded)
                .or_insert(embedded);
        }
    }
    DocProperties {
        title: meta(PdfDocumentMetadataTagType::Title),
        author: meta(PdfDocumentMetadataTagType::Author),
        subject: meta(PdfDocumentMetadataTagType::Subject),
        keywords: meta(PdfDocumentMetadataTagType::Keywords),
        creator: meta(PdfDocumentMetadataTagType::Creator),
        producer: meta(PdfDocumentMetadataTagType::Producer),
        created: meta(PdfDocumentMetadataTagType::CreationDate).map(|d| format_pdf_date(&d)),
        modified: meta(PdfDocumentMetadataTagType::ModificationDate).map(|d| format_pdf_date(&d)),
        pdf_version,
        page_count,
        is_encrypted,
        has_forms: doc.form().is_some(),
        fonts: fonts
            .into_iter()
            .map(|(name, embedded)| FontInfo { name, embedded })
            .collect(),
        fonts_scanned_pages: scan,
    }
}

/// Page dark mode: maps light backgrounds to dark and dark text to light, keeping hue, everywhere
/// except inside `keep` rectangles (images), given in pixels of this image.
pub(super) fn darken(pixels: &mut [u8], width: u32, height: u32, keep: &[(u32, u32, u32, u32)]) {
    let (w, h) = (width as usize, height as usize);
    if pixels.len() != w * h * 4 {
        return;
    }
    let mut skip = vec![false; w * h];
    for &(x0, y0, x1, y1) in keep {
        for y in (y0 as usize).min(h)..(y1 as usize).min(h) {
            let row = y * w;
            skip[row + (x0 as usize).min(w)..row + (x1 as usize).min(w)].fill(true);
        }
    }
    for (px, keep) in pixels.as_chunks_mut::<4>().0.iter_mut().zip(skip) {
        if keep {
            continue;
        }
        let [r, g, b, _] = *px;
        let luma = 0.2126 * f32::from(r) + 0.7152 * f32::from(g) + 0.0722 * f32::from(b);
        // White (255) → 22, black (0) → 228; colour offsets are kept so hues survive.
        let delta = (228.0 - luma * 0.807) - luma;
        let shift = |c: u8| (f32::from(c) + delta).clamp(0.0, 255.0) as u8;
        px[0] = shift(r);
        px[1] = shift(g);
        px[2] = shift(b);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn darken_inverts_brightness_outside_kept_areas() {
        // 2×1 image: a white pixel and a black pixel; keep the second one.
        let mut px = vec![255, 255, 255, 255, 0, 0, 0, 255];
        darken(&mut px, 2, 1, &[(1, 0, 2, 1)]);
        assert!(
            px[0] < 40 && px[1] < 40 && px[2] < 40,
            "white became dark: {px:?}"
        );
        assert_eq!(&px[4..8], &[0, 0, 0, 255], "kept pixel untouched");

        let mut black = vec![0, 0, 0, 255];
        darken(&mut black, 1, 1, &[]);
        assert!(black[0] > 200, "black became light: {black:?}");
    }

    #[test]
    fn darken_ignores_bad_buffers() {
        let mut px = vec![1, 2, 3];
        darken(&mut px, 5, 5, &[]);
        assert_eq!(px, vec![1, 2, 3]);
    }
}
