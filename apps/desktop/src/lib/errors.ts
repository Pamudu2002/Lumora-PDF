import { i18n } from "@/i18n";
import { IpcError, type EngineErrorKind } from "@/lib/ipc";

/** Error kinds with their own message when opening a file; anything else gets the fallback. */
const OPEN_ERROR_KINDS = [
  "malformed",
  "fileNotFound",
  "io",
  "passwordRequired",
  "wrongPassword",
  "unsupportedSecurity",
  "libraryLoad",
] as const satisfies readonly EngineErrorKind[];

type OpenErrorKind = (typeof OPEN_ERROR_KINDS)[number];

function isOpenErrorKind(kind: EngineErrorKind): kind is OpenErrorKind {
  return (OPEN_ERROR_KINDS as readonly EngineErrorKind[]).includes(kind);
}

/** A friendly message for an error thrown while opening a file (brand voice: what happened, what to do). */
export function openErrorMessage(error: unknown): string {
  if (error instanceof IpcError && isOpenErrorKind(error.kind)) {
    return i18n.t(`errors.${error.kind}`);
  }
  return i18n.t("errors.fallback");
}
