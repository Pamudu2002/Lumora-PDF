// Typed wrappers over the generated tauri-specta bindings. UI code imports from here, not from
// ./bindings directly, so results are unwrapped and IPC types are normalized in one place.
import { commands, type AppError, type DocInfo, type EngineErrorKind } from "./bindings";

export type { DocInfo, EngineErrorKind };

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
