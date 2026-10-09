import { beforeEach, describe, expect, it } from "vitest";
import type { SearchHit, SearchProgress } from "@/lib/ipc";
import { installTauriMocks } from "@/test/tauri";
import { useSearchStore } from "./search";

function hit(page: number, snippet = "match"): SearchHit {
  return {
    page,
    rects: [{ x: 0, y: 0, width: 10, height: 10 }],
    snippet,
    matchStart: 0,
    matchLen: 5,
  };
}

function progress(searchId: number, hits: SearchHit[], done = false): SearchProgress {
  return { docId: 1, searchId, hits, pagesSearched: 1, pageCount: 9, done, truncated: false };
}

describe("search store", () => {
  beforeEach(() => {
    useSearchStore.setState({ searches: {}, early: [], findOpen: false });
  });

  it("keeps progress that arrives before the search id, and drops other searches", async () => {
    let resolve: (id: number) => void = () => undefined;
    installTauriMocks((cmd) =>
      cmd === "start_search"
        ? new Promise<number>((r) => {
            resolve = r;
          })
        : undefined,
    );
    const store = useSearchStore.getState();
    const started = store.search(1, "fox", 4);
    // The old search (41) and the new one (42) report before start_search returns.
    store.receive(progress(41, [hit(0, "old")], true));
    store.receive(progress(42, [hit(6), hit(4)]));
    resolve(42);
    await started;
    store.receive(progress(41, [hit(1, "old")]));
    store.receive(progress(42, [hit(2)], true));

    const doc = useSearchStore.getState().searches[1];
    expect(doc?.hits.map((h) => h.page)).toEqual([2, 4, 6]);
    expect(doc?.status).toBe("done");
    // The first match at or after the start page becomes current.
    expect(doc?.active?.page).toBe(4);
    expect(doc?.byPage.get(4)).toHaveLength(1);
  });

  it("steps through matches and wraps around", async () => {
    installTauriMocks((cmd) => (cmd === "start_search" ? 7 : undefined));
    const store = useSearchStore.getState();
    await store.search(1, "fox", 0);
    store.receive(progress(7, [hit(0), hit(3), hit(5)], true));
    const page = () => useSearchStore.getState().searches[1]?.active?.page;
    expect(page()).toBe(0);
    store.step(1, 1, 0);
    expect(page()).toBe(3);
    store.step(1, 1, 0);
    store.step(1, 1, 0);
    expect(page()).toBe(0);
    store.step(1, -1, 0);
    expect(page()).toBe(5);
  });

  it("clears a document's search", async () => {
    installTauriMocks((cmd) => (cmd === "start_search" ? 3 : undefined));
    const store = useSearchStore.getState();
    await store.search(1, "fox", 0);
    store.clear(1);
    store.receive(progress(3, [hit(0)]));
    expect(useSearchStore.getState().searches[1]).toBeUndefined();
  });
});
