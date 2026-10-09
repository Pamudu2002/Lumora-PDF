/** Separator copied between pages. */
const PAGE_SEP = "\n\n";

/**
 * The text of the part of the text layer inside `range`, with line and paragraph breaks restored
 * (the spans are positioned absolutely, so the browser's own copy would run lines together).
 * Returns null when the range holds no text-layer text.
 */
export function textLayerSelection(range: Range, root: ParentNode): string | null {
  let out: string | null = null;
  let lastPage: string | null = null;
  for (const span of root.querySelectorAll<HTMLElement>("[data-text-layer] [data-sep]")) {
    if (!range.intersectsNode(span)) continue;
    const text = span.textContent;
    let start = 0;
    let end = text.length;
    if (span.contains(range.startContainer)) {
      start = range.startContainer === span ? (range.startOffset > 0 ? end : 0) : range.startOffset;
    }
    if (span.contains(range.endContainer)) {
      end = range.endContainer === span ? (range.endOffset > 0 ? end : 0) : range.endOffset;
    }
    const piece = text.slice(start, end);
    if (piece === "") continue;
    const page = span.closest("[data-text-layer]")?.getAttribute("data-text-layer") ?? null;
    if (out === null) out = piece;
    else out += (page === lastPage ? (span.dataset.sep ?? "") : PAGE_SEP) + piece;
    lastPage = page;
  }
  return out;
}
