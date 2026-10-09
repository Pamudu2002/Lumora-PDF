import { useEffect, useState } from "react";
import { getPageText, type TextRun } from "@/lib/ipc";

/** How long a page must stay mounted before its text is fetched, so fast scrolling skips it. */
const FETCH_DELAY_MS = 120;
/** Pages whose text is kept in memory. */
const CACHE_SIZE = 200;

const cache = new Map<string, readonly TextRun[]>();

function remember(key: string, runs: readonly TextRun[]) {
  cache.delete(key);
  cache.set(key, runs);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** The text runs of a page, or null until they arrive (or if the page's text can't be read). */
export function usePageText(
  docId: number,
  revision: number,
  page: number,
): readonly TextRun[] | null {
  const key = `${docId}:${revision}:${page}`;
  const [loaded, setLoaded] = useState<{ key: string; runs: readonly TextRun[] } | null>(null);

  useEffect(() => {
    if (cache.has(key)) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      getPageText(docId, page)
        .then((text) => {
          remember(key, text.runs);
          if (!cancelled) setLoaded({ key, runs: text.runs });
        })
        .catch(() => undefined);
    }, FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [docId, page, key]);

  return cache.get(key) ?? (loaded?.key === key ? loaded.runs : null);
}
