import { IpcError, type EngineErrorKind } from "@/lib/ipc";

/** What the user sees when a file can't be opened (brand voice: what happened, what to do). */
const OPEN_ERRORS: Partial<Record<EngineErrorKind, string>> = {
  malformed: "This file is damaged or isn't a PDF, so Lumora can't open it.",
  fileNotFound: "Lumora can't find this file. It may have been moved or deleted.",
  io: "Lumora couldn't read this file. Check that no other app is using it, then try again.",
  passwordRequired: "This PDF is protected with a password, which Lumora can't open yet.",
  wrongPassword: "That password is incorrect. Check it and try again.",
  unsupportedSecurity: "This PDF uses security settings that Lumora can't open yet.",
  libraryLoad: "Lumora's PDF engine didn't start. Reinstall Lumora PDF to fix this.",
};

const FALLBACK = "Something went wrong while opening this file. Try again.";

/** A friendly message for an error thrown while opening a file. */
export function openErrorMessage(error: unknown): string {
  if (error instanceof IpcError) {
    return OPEN_ERRORS[error.kind] ?? FALLBACK;
  }
  return FALLBACK;
}
