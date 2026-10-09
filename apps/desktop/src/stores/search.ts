import { create } from "zustand";
import {
  cancelSearch,
  startSearch,
  type SearchHit,
  type SearchOptions,
  type SearchProgress,
} from "@/lib/ipc";

export type SearchStatus = "searching" | "done" | "error";

/** The find state of one document. */
export interface DocSearch {
  /** The query searched for. */
  query: string;
  options: SearchOptions;
  /** The running or finished search; null until the Rust side has started it. */
  searchId: number | null;
  /** Every match so far, in page order. */
  hits: SearchHit[];
  /** The same matches grouped by page. */
  byPage: ReadonlyMap<number, SearchHit[]>;
  /** The match the find bar is on. */
  active: SearchHit | null;
  /** Changes whenever a match is chosen, even the same one again, so the view scrolls to it. */
  activeNonce: number;
  status: SearchStatus;
  pagesSearched: number;
  pageCount: number;
  /** The match limit cut the search short. */
  truncated: boolean;
  /** The page the search started on; its first match there (or after) becomes active. */
  startPage: number;
}

interface SearchState {
  findOpen: boolean;
  /** Bumped to move keyboard focus to the find field. */
  focusRequest: number;
  options: SearchOptions;
  searches: Record<number, DocSearch>;
  /** Progress that arrived before its search id was known. */
  early: SearchProgress[];
  openFind: () => void;
  /** Closes the find bar and clears the document's search. */
  closeFind: (docId: number) => void;
  setOptions: (options: Partial<SearchOptions>) => void;
  search: (docId: number, query: string, startPage: number) => Promise<void>;
  clear: (docId: number) => void;
  receive: (progress: SearchProgress) => void;
  setActive: (docId: number, hit: SearchHit) => void;
  /** Moves to the next (`dir` 1) or previous match; from `fromPage` when none is active yet. */
  step: (docId: number, dir: 1 | -1, fromPage: number) => void;
}

/** Most early events kept; more only arrive if the Rust side is far ahead of the UI. */
const MAX_EARLY = 500;

let nonce = 0;
let requestSeq = 0;
/** The latest search request per document, to drop replies of superseded ones. */
const latestRequest = new Map<number, number>();

/** Adds a batch of hits to the page-sorted list and the per-page index. */
function mergeHits(
  hits: SearchHit[],
  byPage: ReadonlyMap<number, SearchHit[]>,
  batch: SearchHit[],
): { hits: SearchHit[]; byPage: ReadonlyMap<number, SearchHit[]> } {
  if (batch.length === 0) return { hits, byPage };
  const merged = [...hits, ...batch].sort((a, b) => a.page - b.page);
  const index = new Map(byPage);
  for (const hit of batch) index.set(hit.page, [...(index.get(hit.page) ?? []), hit]);
  return { hits: merged, byPage: index };
}

function applyProgress(doc: DocSearch, progress: SearchProgress): DocSearch {
  const { hits, byPage } = mergeHits(doc.hits, doc.byPage, progress.hits);
  let { active, activeNonce } = doc;
  if (!active && hits.length > 0) {
    active = hits.find((h) => h.page >= doc.startPage) ?? hits[0] ?? null;
    activeNonce = ++nonce;
  }
  return {
    ...doc,
    hits,
    byPage,
    active,
    activeNonce,
    status: progress.done ? "done" : "searching",
    pagesSearched: progress.pagesSearched,
    pageCount: progress.pageCount,
    truncated: progress.truncated,
  };
}

export const useSearchStore = create<SearchState>()((set, get) => {
  const updateDoc = (docId: number, patch: (doc: DocSearch) => DocSearch) => {
    set((s) => {
      const doc = s.searches[docId];
      return doc ? { searches: { ...s.searches, [docId]: patch(doc) } } : {};
    });
  };

  return {
    findOpen: false,
    focusRequest: 0,
    options: { matchCase: false, wholeWord: false },
    searches: {},
    early: [],

    openFind: () => {
      set((s) => ({ findOpen: true, focusRequest: s.focusRequest + 1 }));
    },
    closeFind: (docId) => {
      set({ findOpen: false });
      get().clear(docId);
    },
    setOptions: (options) => {
      set((s) => ({ options: { ...s.options, ...options } }));
    },

    search: async (docId, query, startPage) => {
      const seq = ++requestSeq;
      latestRequest.set(docId, seq);
      const options = get().options;
      set((s) => ({
        early: s.early.filter((e) => e.docId !== docId),
        searches: {
          ...s.searches,
          [docId]: {
            query,
            options,
            searchId: null,
            hits: [],
            byPage: new Map(),
            active: null,
            activeNonce: 0,
            status: "searching",
            pagesSearched: 0,
            pageCount: 0,
            truncated: false,
            startPage,
          },
        },
      }));
      try {
        const searchId = await startSearch(docId, query, options, startPage);
        if (latestRequest.get(docId) !== seq || !get().searches[docId]) return;
        const early = get().early;
        const mine = early.filter((e) => e.docId === docId && e.searchId === searchId);
        set({ early: early.filter((e) => e.docId !== docId) });
        updateDoc(docId, (doc) => mine.reduce(applyProgress, { ...doc, searchId }));
      } catch {
        if (latestRequest.get(docId) === seq) {
          updateDoc(docId, (doc) => ({ ...doc, status: "error" }));
        }
      }
    },

    clear: (docId) => {
      latestRequest.delete(docId);
      const doc = get().searches[docId];
      if (doc?.status === "searching") void cancelSearch(docId).catch(() => undefined);
      set((s) => ({
        searches: Object.fromEntries(
          Object.entries(s.searches).filter(([id]) => Number(id) !== docId),
        ),
        early: s.early.filter((e) => e.docId !== docId),
      }));
    },

    receive: (progress) => {
      const doc = get().searches[progress.docId];
      if (!doc) return;
      if (doc.searchId === null) {
        set((s) => ({ early: [...s.early, progress].slice(-MAX_EARLY) }));
        return;
      }
      if (progress.searchId !== doc.searchId) return;
      updateDoc(progress.docId, (d) => applyProgress(d, progress));
    },

    setActive: (docId, hit) => {
      updateDoc(docId, (doc) => ({ ...doc, active: hit, activeNonce: ++nonce }));
    },

    step: (docId, dir, fromPage) => {
      const doc = get().searches[docId];
      if (!doc || doc.hits.length === 0) return;
      const { hits } = doc;
      const at = doc.active ? hits.indexOf(doc.active) : -1;
      let next: SearchHit | undefined;
      if (at >= 0) {
        next = hits[(at + dir + hits.length) % hits.length];
      } else if (dir === 1) {
        next = hits.find((h) => h.page >= fromPage) ?? hits[0];
      } else {
        next = [...hits].reverse().find((h) => h.page <= fromPage) ?? hits[hits.length - 1];
      }
      if (next) get().setActive(docId, next);
    },
  };
});
