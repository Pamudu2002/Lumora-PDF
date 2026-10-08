import { create } from "zustand";
import { openErrorMessage } from "@/lib/errors";
import { closeDocument, openDocument, type OpenDocument } from "@/lib/ipc";

/** A file that failed to open, with a user-facing message. */
export interface OpenFailure {
  fileName: string;
  message: string;
}

interface DocumentsState {
  /** The open document. Phase 0 shows one at a time; tabs arrive in task 1.11. */
  current: OpenDocument | null;
  /** True while a file is opening. */
  opening: boolean;
  /** The last failure, shown until dismissed or the next open. */
  failure: OpenFailure | null;
  open: (path: string) => Promise<void>;
  close: () => Promise<void>;
  dismissFailure: () => void;
}

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
  current: null,
  opening: false,
  failure: null,

  open: async (path) => {
    set({ opening: true, failure: null });
    try {
      const doc = await openDocument(path);
      const previous = get().current;
      set({ current: doc, opening: false });
      if (previous) {
        await closeDocument(previous.id).catch(() => undefined);
      }
    } catch (error) {
      set({
        opening: false,
        failure: { fileName: fileNameOf(path), message: openErrorMessage(error) },
      });
    }
  },

  close: async () => {
    const doc = get().current;
    if (!doc) return;
    set({ current: null });
    await closeDocument(doc.id).catch(() => undefined);
  },

  dismissFailure: () => {
    set({ failure: null });
  },
}));
