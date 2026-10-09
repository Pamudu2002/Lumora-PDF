// Typed wrappers over the generated tauri-specta bindings. UI code imports from here, not from
// ./bindings directly, so results are unwrapped and IPC types are normalized in one place.
import {
  commands,
  events,
  type AppError,
  type DocInfo,
  type DocumentProperties,
  type EngineErrorKind,
  type LinkTarget,
  type OutlineItem,
  type Rect as RawRect,
  type SavedView,
  type SearchOptions,
} from "./bindings";

export type {
  DocInfo,
  DocumentProperties,
  EngineErrorKind,
  LinkTarget,
  OutlineItem,
  SavedView,
  SearchOptions,
};

/** A rectangle in display points (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A run of text on one line and where it's drawn. */
export interface TextRun {
  text: string;
  rect: Rect;
}

/** The text of one page, in reading order. */
export interface PageText {
  runs: TextRun[];
}

/** A rect with every coordinate present, or null (floats that weren't finite arrive as null). */
function finiteRect(r: RawRect): Rect | null {
  const { x, y, width, height } = r;
  return x === null || y === null || width === null || height === null
    ? null
    : { x, y, width, height };
}

/** A page's display size in points. */
export interface PageSize {
  widthPt: number;
  heightPt: number;
}

/** An open document as the UI uses it. */
export interface OpenDocument {
  id: number;
  path: string;
  fileName: string;
  info: DocInfo;
  pageSizes: PageSize[];
  revision: number;
}

/** A failed command, carrying the engine's error kind. */
export class IpcError extends Error {
  readonly kind: EngineErrorKind;
  readonly detail: string;

  constructor(error: AppError) {
    super(error.detail);
    this.name = "IpcError";
    this.kind = error.kind;
    this.detail = error.detail;
  }
}

function unwrap<T>(result: { status: "ok"; data: T } | { status: "error"; error: AppError }): T {
  if (result.status === "error") {
    throw new IpcError(result.error);
  }
  return result.data;
}

/**
 * Opens a PDF (and adds it to the recent files). Pass the password for a protected file. Throws
 * {@link IpcError} on failure (kind `passwordRequired` or `wrongPassword` for protected files).
 */
export async function openDocument(
  path: string,
  password?: string,
): Promise<{ doc: OpenDocument; view: SavedView }> {
  const { document, view } = unwrap(await commands.openDocument(path, password ?? null));
  const doc = {
    ...document,
    // Rust guarantees finite sizes; specta types f32 as `number | null` because JSON can't hold NaN.
    pageSizes: document.pageSizes.map((s) => ({
      widthPt: s.widthPt ?? 0,
      heightPt: s.heightPt ?? 0,
    })),
  };
  return { doc, view };
}

/** Closes a document. Throws {@link IpcError} on failure. */
export async function closeDocument(docId: number): Promise<void> {
  unwrap(await commands.closeDocument(docId));
}

/** Tells the renderer which pages are mounted, so queued tiles of other pages are skipped. */
export async function setVisiblePages(docId: number, pages: number[]): Promise<void> {
  unwrap(await commands.setVisiblePages(docId, pages));
}

/** The document outline (bookmarks). Throws {@link IpcError} on failure. */
export async function getOutline(docId: number): Promise<OutlineItem[]> {
  return unwrap(await commands.getOutline(docId));
}

/** The text runs of one page, positioned in display points. Throws {@link IpcError} on failure. */
export async function getPageText(docId: number, page: number): Promise<PageText> {
  const raw = unwrap(await commands.getPageText(docId, page));
  const runs: TextRun[] = [];
  for (const run of raw.runs) {
    const rect = finiteRect(run.rect);
    if (rect) runs.push({ text: run.text, rect });
  }
  return { runs };
}

/** One match of a search. */
export interface SearchHit {
  page: number;
  /** The match's boxes on the page (one per line it spans), in display points. */
  rects: Rect[];
  /** Text around the match, for the results list. */
  snippet: string;
  /** Where the match sits in `snippet` (UTF-16 code units). */
  matchStart: number;
  matchLen: number;
}

/** A batch of search progress: new matches since the previous batch. */
export interface SearchProgress {
  docId: number;
  searchId: number;
  hits: SearchHit[];
  pagesSearched: number;
  pageCount: number;
  /** The last batch of this search. */
  done: boolean;
  /** The match limit cut the search short. */
  truncated: boolean;
}

/**
 * Starts finding `query` in a document from `startPage`, wrapping around, and returns the search
 * id. Results arrive through {@link onSearchProgress}. Cancels the document's previous search.
 */
export async function startSearch(
  docId: number,
  query: string,
  options: SearchOptions,
  startPage: number,
): Promise<number> {
  return unwrap(await commands.startSearch(docId, query, options, startPage));
}

/** Stops a document's running search. */
export async function cancelSearch(docId: number): Promise<void> {
  unwrap(await commands.cancelSearch(docId));
}

/** Calls `handler` with every search progress batch; resolves to an unlisten function. */
export async function onSearchProgress(
  handler: (progress: SearchProgress) => void,
): Promise<() => void> {
  return events.searchProgressEvent.listen(({ payload }) => {
    const { progress } = payload;
    const hits: SearchHit[] = [];
    for (const hit of progress.hits) {
      const rects = hit.rects.map(finiteRect).filter((r): r is Rect => r !== null);
      hits.push({ ...hit, rects });
    }
    handler({
      docId: payload.docId,
      searchId: payload.searchId,
      hits,
      pagesSearched: progress.pagesSearched,
      pageCount: progress.pageCount,
      done: progress.done,
      truncated: progress.truncated,
    });
  });
}

/** A clickable link area on a page. */
export interface PageLink {
  rect: Rect;
  target: LinkTarget;
}

/** The links on one page. Throws {@link IpcError} on failure. */
export async function getPageLinks(docId: number, page: number): Promise<PageLink[]> {
  const raw = unwrap(await commands.getPageLinks(docId, page));
  const links: PageLink[] = [];
  for (const link of raw) {
    const rect = finiteRect(link.rect);
    if (rect) links.push({ rect, target: link.target });
  }
  return links;
}

/** Opens a web or email link in the system's default app. Ask the user before calling this. */
export async function openExternalLink(url: string): Promise<void> {
  unwrap(await commands.openExternalLink(url));
}

/** A recently opened file. */
export interface RecentFile {
  path: string;
  fileName: string;
  pageCount: number;
  /** When it was last opened (ms since the Unix epoch). */
  lastOpenedMs: number;
  /** False when the file has been moved or deleted. */
  exists: boolean;
}

/** Recently opened files, newest first. */
export async function listRecentFiles(): Promise<RecentFile[]> {
  return unwrap(await commands.listRecentFiles()).map(({ file, exists }) => ({
    path: file.path,
    fileName: file.fileName,
    pageCount: file.pageCount,
    lastOpenedMs: file.lastOpenedMs ?? 0,
    exists,
  }));
}

/** Takes a file off the recent list. */
export async function removeRecentFile(path: string): Promise<void> {
  unwrap(await commands.removeRecentFile(path));
}

/** Remembers the page and zoom of an open document for next time. */
export async function saveView(path: string, view: SavedView): Promise<void> {
  unwrap(await commands.saveView(path, view));
}

/** The PDFs Lumora was started with (from "Open with" or the command line). Empty after the first call. */
export async function takeStartupFiles(): Promise<string[]> {
  return commands.takeStartupFiles();
}

/** Calls `handler` with the PDFs another launch of Lumora asks this window to open. */
export async function onOpenFiles(handler: (paths: string[]) => void): Promise<() => void> {
  return events.openFilesEvent.listen(({ payload }) => {
    handler(payload.paths);
  });
}

/** Facts for the Document properties dialog. Throws {@link IpcError} on failure. */
export async function getProperties(docId: number): Promise<DocumentProperties> {
  return unwrap(await commands.getProperties(docId));
}
