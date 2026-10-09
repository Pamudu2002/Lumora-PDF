import { memo } from "react";
import { cn } from "@/lib/cn";
import { useSearchStore } from "@/stores/search";

export interface SearchHighlightsProps {
  docId: number;
  page: number;
  /** CSS px per display point. */
  scale: number;
  /** Dark page rendering: multiply blending would hide the highlight. */
  dark: boolean;
}

/** Highlights the find matches on one page; the current match is stronger. */
export const SearchHighlights = memo(function SearchHighlights({
  docId,
  page,
  scale,
  dark,
}: SearchHighlightsProps) {
  const hits = useSearchStore((s) => s.searches[docId]?.byPage.get(page));
  const active = useSearchStore((s) => s.searches[docId]?.active);
  if (!hits || hits.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {hits.map((hit, i) =>
        hit.rects.map((r, j) => (
          <div
            key={`${i}-${j}`}
            data-search-hit={hit === active ? "active" : ""}
            className={cn(
              "absolute rounded-[2px]",
              !dark && "mix-blend-multiply",
              hit === active ? "bg-search-hit-active" : "bg-search-hit",
            )}
            style={{
              left: r.x * scale - 1,
              top: r.y * scale - 1,
              width: r.width * scale + 2,
              height: r.height * scale + 2,
            }}
          />
        )),
      )}
    </div>
  );
});
