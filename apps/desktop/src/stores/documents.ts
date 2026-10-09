import { create } from "zustand";
import { openErrorMessage } from "@/lib/errors";
import {
  IpcError,
  closeDocument,
  openDocument,
  saveView,
  type OpenDocument,
  type SavedView,
} from "@/lib/ipc";
import { useSearchStore } from "./search";
import { useSettingsStore } from "./settings";
import { clampZoom, useViewerStore, type DocView, type ZoomMode } from "./viewer";

const ZOOM_MODES: readonly string[] = [
  "custom",
  "fitWidth",
  "fitPage",
  "auto",
] satisfies ZoomMode[];

/** The parts of a saved view that the viewer can use. */
/** The view a document opens with before anything was saved for it: the default settings. */
function defaultView(): Partial<DocView> {
  const { defaultZoom, defaultLayout } = useSettingsStore.getState();
  const view: Partial<DocView> = { layout: defaultLayout };
  if (defaultZoom === "auto" || defaultZoom === "fitWidth" || defaultZoom === "fitPage") {
    view.zoomMode = defaultZoom;
  } else {
    view.zoomMode = "custom";
    view.zoom = clampZoom(Number(defaultZoom) / 100);
  }
  return view;
}

function restoredView(view: SavedView, pageCount: number): Partial<DocView> {
  const restored: Partial<DocView> = defaultView();
  if (view.page > 0 && view.page < pageCount) restored.currentPage = view.page;
  if (view.zoomMode && ZOOM_MODES.includes(view.zoomMode)) {
    restored.zoomMode = view.zoomMode as ZoomMode;
  }
  if (view.zoom !== null && restored.zoomMode === "custom") restored.zoom = clampZoom(view.zoom);
  return restored;
}

/** Saves how a document is being viewed, so it reopens there. */
export function rememberView(doc: OpenDocument): void {
  const view = useViewerStore.getState().views[doc.id];
  if (!view) return;
  void saveView(doc.path, {
    page: view.currentPage,
    zoom: view.zoom,
    zoomMode: view.zoomMode,
  }).catch(() => undefined);
}

/** A file that failed to open, with a user-facing message. */
export interface OpenFailure {
  fileName: string;
  message: string;
}

interface DocumentsState {
  /** Open documents, in tab order. */
  docs: OpenDocument[];
  /** The document shown, or null on the home screen. */
  activeId: number | null;
  /** Documents with unsaved changes (editing arrives in Phase 2). */
  dirty: Record<number, boolean>;
  /** A close waiting for the user to confirm that unsaved changes may be lost. */
  pendingClose: number | null;
  /** True while a file is opening. */
  opening: boolean;
  /** The last failure, shown until dismissed or the next open. */
  failure: OpenFailure | null;
  /** A protected file waiting for its password; `wrong` after a password that didn't work. */
  passwordPrompt: { path: string; fileName: string; wrong: boolean } | null;
  /** Opens a file in a new tab, or switches to its tab if it's already open. */
  open: (path: string, password?: string) => Promise<void>;
  /** Tries the password for the file in {@link passwordPrompt}. */
  submitPassword: (password: string) => Promise<void>;
  cancelPassword: () => void;
  activate: (docId: number) => void;
  /** Activates the next (`dir` 1) or previous tab, wrapping around. */
  activateNext: (dir: 1 | -1) => void;
  /** Closes a document (the active one by default); asks first if it has unsaved changes. */
  close: (docId?: number) => Promise<void>;
  confirmClose: () => Promise<void>;
  cancelClose: () => void;
  /** Moves a tab to position `index`. */
  move: (docId: number, index: number) => void;
  setDirty: (docId: number, dirty: boolean) => void;
  dismissFailure: () => void;
}

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Paths compare equal regardless of slash direction and (as on Windows) letter case. */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\//g, "\\").toLowerCase();
  return norm(a) === norm(b);
}

/** The active document. */
export function selectActiveDoc(s: DocumentsState): OpenDocument | null {
  return s.docs.find((d) => d.id === s.activeId) ?? null;
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => {
  const closeNow = async (docId: number) => {
    const { docs, activeId } = get();
    const index = docs.findIndex((d) => d.id === docId);
    if (index < 0) return;
    const doc = docs[index];
    if (doc) rememberView(doc);
    const rest = docs.filter((d) => d.id !== docId);
    // Closing the active tab shows its right neighbour, or the left one at the end.
    const nextActive =
      activeId === docId ? (rest[Math.min(index, rest.length - 1)]?.id ?? null) : activeId;
    set((s) => ({
      docs: rest,
      activeId: nextActive,
      dirty: Object.fromEntries(Object.entries(s.dirty).filter(([id]) => Number(id) !== docId)),
    }));
    useSearchStore.getState().clear(docId);
    useViewerStore.getState().remove(docId);
    await closeDocument(docId).catch(() => undefined);
  };

  return {
    docs: [],
    activeId: null,
    dirty: {},
    pendingClose: null,
    opening: false,
    failure: null,
    passwordPrompt: null,

    open: async (path, password) => {
      const existing = get().docs.find((d) => samePath(d.path, path));
      if (existing) {
        set({ activeId: existing.id, failure: null });
        return;
      }
      set({ opening: true, failure: null });
      try {
        const { doc, view } = await openDocument(path, password);
        const restored = restoredView(view, doc.info.pageCount);
        useViewerStore.getState().init(doc.id, restored);
        if (restored.currentPage !== undefined) {
          useViewerStore.getState().goToPage(doc.id, restored.currentPage);
        }
        set((s) => ({
          docs: [...s.docs, doc],
          activeId: doc.id,
          opening: false,
          passwordPrompt: null,
        }));
      } catch (error) {
        if (
          error instanceof IpcError &&
          (error.kind === "passwordRequired" || error.kind === "wrongPassword")
        ) {
          set({
            opening: false,
            passwordPrompt: {
              path,
              fileName: fileNameOf(path),
              wrong: error.kind === "wrongPassword",
            },
          });
          return;
        }
        set({
          passwordPrompt: null,
          opening: false,
          failure: { fileName: fileNameOf(path), message: openErrorMessage(error) },
        });
      }
    },

    submitPassword: async (password) => {
      const prompt = get().passwordPrompt;
      if (prompt) await get().open(prompt.path, password);
    },

    cancelPassword: () => {
      set({ passwordPrompt: null });
    },

    activate: (docId) => {
      if (get().docs.some((d) => d.id === docId)) set({ activeId: docId });
    },

    activateNext: (dir) => {
      const { docs, activeId } = get();
      if (docs.length < 2) return;
      const index = docs.findIndex((d) => d.id === activeId);
      const next = docs[(index + dir + docs.length) % docs.length];
      if (next) set({ activeId: next.id });
    },

    close: async (docId) => {
      const id = docId ?? get().activeId;
      if (id === null) return;
      if (get().dirty[id]) {
        set({ pendingClose: id, activeId: id });
        return;
      }
      await closeNow(id);
    },

    confirmClose: async () => {
      const id = get().pendingClose;
      set({ pendingClose: null });
      if (id !== null) await closeNow(id);
    },

    cancelClose: () => {
      set({ pendingClose: null });
    },

    move: (docId, index) => {
      const { docs } = get();
      const from = docs.findIndex((d) => d.id === docId);
      const doc = docs[from];
      if (!doc) return;
      const to = Math.max(0, Math.min(docs.length - 1, index));
      if (to === from) return;
      const next = docs.filter((d) => d.id !== docId);
      next.splice(to, 0, doc);
      set({ docs: next });
    },

    setDirty: (docId, dirty) => {
      set((s) => ({ dirty: { ...s.dirty, [docId]: dirty } }));
    },

    dismissFailure: () => {
      set({ failure: null });
    },
  };
});
