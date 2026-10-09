//! Whole-document search, page by page, with progress and cancellation.

use std::time::{Duration, Instant};

use lumora_engine::{DocId, EngineError, PdfEngine, SearchHit, SearchOptions};
use lumora_jobs::CancelToken;
use serde::Serialize;

/// Results are reported at least this often while searching.
const REPORT_EVERY: Duration = Duration::from_millis(120);
/// Search stops collecting after this many matches.
pub const MAX_SEARCH_HITS: usize = 10_000;

/// What to search for.
#[derive(Debug, Clone)]
pub struct SearchRequest {
    /// The document.
    pub doc: DocId,
    /// Pages in the document.
    pub page_count: u32,
    /// The page to start from (search wraps around to the pages before it).
    pub start_page: u32,
    /// The text to find.
    pub query: String,
    /// Match options.
    pub opts: SearchOptions,
}

/// A batch of search progress.
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProgress {
    /// New matches since the previous report.
    pub hits: Vec<SearchHit>,
    /// Pages searched so far.
    pub pages_searched: u32,
    /// Pages in the document.
    pub page_count: u32,
    /// True on the last report (finished, cancelled, or the match limit was reached).
    pub done: bool,
    /// True when the match limit cut the search short.
    pub truncated: bool,
}

/// Searches every page, starting at `req.start_page` and wrapping around, so matches near what the
/// user is reading arrive first. Calls `report` with batches of new matches, and once more with
/// `done = true`. Each page is a separate engine request, so tile renders run in between.
///
/// Returns early (still reporting `done`) when `token` is cancelled. Pages that fail to load are
/// skipped.
pub fn search_document(
    engine: &dyn PdfEngine,
    req: &SearchRequest,
    token: &CancelToken,
    mut report: impl FnMut(SearchProgress),
) -> Result<(), EngineError> {
    let mut pending = Vec::new();
    let mut total = 0usize;
    let mut last_report = Instant::now();
    let mut searched = 0u32;
    let mut truncated = false;
    let start = req.start_page.checked_rem(req.page_count).unwrap_or(0);

    for offset in 0..req.page_count {
        if token.is_cancelled() {
            break;
        }
        let page = (start + offset) % req.page_count;
        match engine.search_page(req.doc, page, &req.query, req.opts) {
            Ok(hits) => {
                total += hits.len();
                pending.extend(hits);
            }
            Err(EngineError::UnknownDocument(id)) => return Err(EngineError::UnknownDocument(id)),
            Err(err) => tracing::debug!(page, %err, "search skipped a page"),
        }
        searched += 1;
        if total >= MAX_SEARCH_HITS {
            truncated = true;
            break;
        }
        if last_report.elapsed() >= REPORT_EVERY && !pending.is_empty() {
            report(SearchProgress {
                hits: std::mem::take(&mut pending),
                pages_searched: searched,
                page_count: req.page_count,
                done: false,
                truncated: false,
            });
            last_report = Instant::now();
        }
    }
    report(SearchProgress {
        hits: pending,
        pages_searched: searched,
        page_count: req.page_count,
        done: true,
        truncated,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::Mutex;

    use lumora_engine::{
        DocInfo, DocProperties, OpenOptions, OutlineItem, PageIndex, PageLink, PageSize, PageText,
        Rect, RgbaImage, TileRequest,
    };

    use super::*;

    /// Every page has one match; records the order pages were searched in.
    #[derive(Default)]
    struct Fake {
        order: Mutex<Vec<PageIndex>>,
    }

    impl PdfEngine for Fake {
        fn open(&self, _: &Path, _: OpenOptions) -> Result<(DocId, DocInfo), EngineError> {
            unreachable!()
        }
        fn close(&self, _: DocId) -> Result<(), EngineError> {
            Ok(())
        }
        fn page_sizes(&self, _: DocId) -> Result<Vec<PageSize>, EngineError> {
            Ok(Vec::new())
        }
        fn render_tile(&self, _: TileRequest) -> Result<RgbaImage, EngineError> {
            unreachable!()
        }
        fn render_thumbnail(
            &self,
            _: DocId,
            _: PageIndex,
            _: u32,
        ) -> Result<RgbaImage, EngineError> {
            unreachable!()
        }
        fn page_text(&self, _: DocId, _: PageIndex) -> Result<PageText, EngineError> {
            unreachable!()
        }
        fn search_page(
            &self,
            _: DocId,
            page: PageIndex,
            query: &str,
            _: SearchOptions,
        ) -> Result<Vec<SearchHit>, EngineError> {
            self.order.lock().unwrap().push(page);
            Ok(vec![SearchHit {
                page,
                rects: vec![Rect::from_corners(0.0, 0.0, 1.0, 1.0)],
                snippet: query.to_string(),
                match_start: 0,
                match_len: 1,
            }])
        }
        fn outline(&self, _: DocId) -> Result<Vec<OutlineItem>, EngineError> {
            unreachable!()
        }
        fn page_links(&self, _: DocId, _: PageIndex) -> Result<Vec<PageLink>, EngineError> {
            unreachable!()
        }
        fn properties(&self, _: DocId) -> Result<DocProperties, EngineError> {
            unreachable!()
        }
    }

    fn request(page_count: u32, start_page: u32) -> SearchRequest {
        SearchRequest {
            doc: 1,
            page_count,
            start_page,
            query: "x".into(),
            opts: SearchOptions::default(),
        }
    }

    #[test]
    fn searches_every_page_starting_at_the_current_one() {
        let engine = Fake::default();
        let mut reports = Vec::new();
        search_document(&engine, &request(5, 3), &CancelToken::new(), |p| {
            reports.push(p)
        })
        .unwrap();
        assert_eq!(*engine.order.lock().unwrap(), [3, 4, 0, 1, 2]);
        let last = reports.last().unwrap();
        assert!(last.done && !last.truncated && last.pages_searched == 5);
        let total: usize = reports.iter().map(|r| r.hits.len()).sum();
        assert_eq!(total, 5);
    }

    #[test]
    fn stops_when_cancelled_and_still_reports_done() {
        let engine = Fake::default();
        let token = CancelToken::new();
        token.cancel();
        let mut reports = Vec::new();
        search_document(&engine, &request(5, 0), &token, |p| reports.push(p)).unwrap();
        assert!(engine.order.lock().unwrap().is_empty());
        assert_eq!(reports.len(), 1);
        assert!(reports[0].done);
    }

    #[test]
    fn handles_empty_documents() {
        let engine = Fake::default();
        let mut reports = Vec::new();
        search_document(&engine, &request(0, 7), &CancelToken::new(), |p| {
            reports.push(p)
        })
        .unwrap();
        assert!(reports[0].done && reports[0].hits.is_empty());
    }
}
