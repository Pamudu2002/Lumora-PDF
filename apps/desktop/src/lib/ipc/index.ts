// Typed wrappers over the generated tauri-specta bindings. UI code imports from here, not from
// ./bindings directly, so results are unwrapped and IPC types are normalized in one place.
import {
  commands,
  type AppError,
  type DocInfo,
  type EngineErrorKind,
  type OutlineItem,
  type Rect as RawRect,
} from "./bindings";

export type { DocInfo, EngineErrorKind, OutlineItem };

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

/** Opens a PDF. Throws {@link IpcError} on failure. */
export async function openDocument(path: string): Promise<OpenDocument> {
  const summary = unwrap(await commands.openDocument(path));
  return {
    ...summary,
    // Rust guarantees finite sizes; specta types f32 as `number | null` because JSON can't hold NaN.
    pageSizes: summary.pageSizes.map((s) => ({
      widthPt: s.widthPt ?? 0,
      heightPt: s.heightPt ?? 0,
    })),
  };
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
