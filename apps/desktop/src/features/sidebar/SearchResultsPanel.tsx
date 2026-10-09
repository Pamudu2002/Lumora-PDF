import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useSearchStore } from "@/stores/search";

/** Height of one result row, CSS px. Rows have a fixed height so the list can be virtualized. */
const ROW_H = 64;
/** Rows rendered above and below the visible ones. */
const OVERSCAN = 6;

export interface SearchResultsPanelProps {
  docId: number;
}

/** The matches of the document's current search, with their context; choosing one goes there. */
export function SearchResultsPanel({ docId }: SearchResultsPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 0 });
  const doc = useSearchStore((s) => s.searches[docId]);
  const setActive = useSearchStore((s) => s.setActive);
  const hits = doc?.hits;
  const activeIndex = doc?.active && hits ? hits.indexOf(doc.active) : -1;
  const hasSearch = doc !== undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      setScroll({ top: el.scrollTop, height: el.clientHeight });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(schedule);
    read();
    el.addEventListener("scroll", schedule, { passive: true });
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [hasSearch]);

  // Keep the current match in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || activeIndex < 0) return;
    const top = activeIndex * ROW_H;
    if (top < el.scrollTop || top + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTop = top - (el.clientHeight - ROW_H) / 2;
    }
  }, [activeIndex]);

  if (!doc || !hits) {
    return <p className="m-0 px-4 py-2 text-body text-ink-muted">{t("find.hint")}</p>;
  }

  const first = Math.max(0, Math.floor(scroll.top / ROW_H) - OVERSCAN);
  const last = Math.min(hits.length, Math.ceil((scroll.top + scroll.height) / ROW_H) + OVERSCAN);
  const rows = hits.slice(first, last);

  return (
    <>
      <p className="m-0 px-4 pb-2 text-caption text-ink-muted" aria-live="polite">
        {doc.status === "searching"
          ? t("find.progress", { searched: doc.pagesSearched, total: doc.pageCount })
          : hits.length === 0
            ? t("find.noResults")
            : doc.truncated
              ? t("find.truncated", { count: hits.length })
              : t("find.results", { count: hits.length })}
      </p>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ul
          aria-label={t("sidebar.findResults")}
          className="relative m-0 list-none p-0"
          style={{ height: hits.length * ROW_H }}
        >
          {rows.map((hit, i) => {
            const index = first + i;
            const active = index === activeIndex;
            const before = hit.snippet.slice(0, hit.matchStart);
            const match = hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLen);
            const after = hit.snippet.slice(hit.matchStart + hit.matchLen);
            return (
              <li
                key={index}
                className="absolute inset-x-0"
                style={{ top: index * ROW_H, height: ROW_H }}
              >
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex size-full cursor-pointer flex-col gap-0.5 overflow-hidden rounded-md border-0 px-2 py-1.5 text-left",
                    active ? "bg-selected" : "bg-transparent hover:bg-surface",
                  )}
                  onClick={() => {
                    setActive(docId, hit);
                  }}
                >
                  <span className="text-caption text-ink-muted">
                    {t("viewer.pageLabel", { page: hit.page + 1 })}
                  </span>
                  <span className="line-clamp-2 text-label text-ink">
                    {before}
                    <mark className="rounded-[2px] bg-search-hit text-ink">{match}</mark>
                    {after}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
