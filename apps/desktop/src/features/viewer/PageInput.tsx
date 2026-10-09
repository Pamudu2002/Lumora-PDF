import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/Tooltip";
import { useDocView, useViewerStore } from "@/stores/viewer";
import { focusDocumentView } from "./focus";

export interface PageInputProps {
  docId: number;
  pageCount: number;
}

/** The page number field in the zoom bar: type a page and press Enter to go there. Ctrl+G focuses it. */
export function PageInput({ docId, pageCount }: PageInputProps) {
  const { t } = useTranslation();
  const { currentPage } = useDocView(docId);
  const goToPage = useViewerStore((s) => s.goToPage);
  const ref = useRef<HTMLInputElement>(null);
  // What the reader is typing; null shows the current page.
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "g") {
        return;
      }
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n) || pageCount === 0) return;
    goToPage(docId, Math.min(Math.max(n, 1), pageCount) - 1);
  };

  return (
    <span className="flex items-center gap-1 px-1 text-label text-ink-muted tabular-nums">
      <Tooltip label={t("viewer.goToPage")} shortcut="Ctrl+G">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("viewer.pageNumber", { count: pageCount })}
          disabled={pageCount === 0}
          value={draft ?? String(pageCount === 0 ? 0 : currentPage + 1)}
          style={{ width: `${String(pageCount).length + 2}ch` }}
          className="h-control-sm rounded-md border border-transparent bg-transparent px-1 text-center text-label text-ink tabular-nums outline-none hover:border-line focus:border-focus focus:bg-surface"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setDraft(e.target.value.replace(/\D/g, "").slice(0, 7));
          }}
          onBlur={() => {
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              const input = e.currentTarget;
              requestAnimationFrame(() => {
                input.select();
              });
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(null);
              focusDocumentView(docId);
            }
          }}
        />
      </Tooltip>
      <span aria-hidden>/ {pageCount}</span>
    </span>
  );
}
