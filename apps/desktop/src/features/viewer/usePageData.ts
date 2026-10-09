import { useEffect, useState } from "react";
import { getPageLinks, getPageText } from "@/lib/ipc";

/** How long a page must stay mounted before its data is fetched, so fast scrolling skips it. */
const FETCH_DELAY_MS = 120;
/** Pages whose data each hook keeps in memory. */
const CACHE_SIZE = 200;

/**
 * Makes a hook that fetches one kind of per-page data (text, links) for mounted pages, after a
 * short delay, and keeps the latest {@link CACHE_SIZE} pages cached by document revision.
 */
export function createPageDataHook<T>(fetch: (docId: number, page: number) => Promise<T>) {
  const cache = new Map<string, T>();
  const remember = (key: string, value: T) => {
    cache.delete(key);
    cache.set(key, value);
    if (cache.size > CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  };

  /** The page's data, or null until it arrives (or if it can't be read). */
  return function usePageData(docId: number, revision: number, page: number): T | null {
    const key = `${docId}:${revision}:${page}`;
    const [loaded, setLoaded] = useState<{ key: string; value: T } | null>(null);

    useEffect(() => {
      if (cache.has(key)) return undefined;
      let cancelled = false;
      const timer = setTimeout(() => {
        fetch(docId, page)
          .then((value) => {
            remember(key, value);
            if (!cancelled) setLoaded({ key, value });
          })
          .catch(() => undefined);
      }, FETCH_DELAY_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [docId, page, key]);

    return cache.get(key) ?? (loaded?.key === key ? loaded.value : null);
  };
}

/** The text runs of a page, or null until they arrive. */
export const usePageText = createPageDataHook((docId, page) =>
  getPageText(docId, page).then((text) => text.runs),
);

/** The links of a page, or null until they arrive. */
export const usePageLinks = createPageDataHook(getPageLinks);
