import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { TextToggle } from "@/components/ui/TextToggle";
import { useSearchStore } from "@/stores/search";
import { useViewerStore } from "@/stores/viewer";
import { focusDocumentView } from "./focus";

const ICON = { size: 16, strokeWidth: 1.75 } as const;
/** Typing pauses this long before a search starts. */
const SEARCH_DELAY_MS = 250;

export interface FindBarProps {
  docId: number;
}

/** The floating find bar: query, match count, match options and previous/next. */
export function FindBar({ docId }: FindBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const doc = useSearchStore((s) => s.searches[docId]);
  const options = useSearchStore((s) => s.options);
  const focusRequest = useSearchStore((s) => s.focusRequest);
  const setOptions = useSearchStore((s) => s.setOptions);
  const search = useSearchStore((s) => s.search);
  const clear = useSearchStore((s) => s.clear);
  const step = useSearchStore((s) => s.step);
  const closeFind = useSearchStore((s) => s.closeFind);
  const [text, setText] = useState(doc?.query ?? "");

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequest]);

  const currentPage = () => useViewerStore.getState().views[docId]?.currentPage ?? 0;
  const searched =
    doc !== undefined &&
    doc.query === text &&
    doc.options.matchCase === options.matchCase &&
    doc.options.wholeWord === options.wholeWord;

  // Search shortly after typing stops (or right away when an option changes).
  useEffect(() => {
    if (searched) return undefined;
    if (text.trim() === "") {
      clear(docId);
      return undefined;
    }
    const timer = setTimeout(() => {
      void search(docId, text, useViewerStore.getState().views[docId]?.currentPage ?? 0);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [docId, text, searched, search, clear]);

  const go = (dir: 1 | -1) => {
    if (!searched && text.trim() !== "") void search(docId, text, currentPage());
    else step(docId, dir, currentPage());
  };
  const close = () => {
    closeFind(docId);
    focusDocumentView(docId);
  };

  let count = "";
  if (doc && text.trim() !== "") {
    const total = doc.hits.length;
    const current = doc.active ? doc.hits.indexOf(doc.active) + 1 : 0;
    if (total > 0) {
      count = t(doc.truncated ? "find.countMore" : "find.count", { current, total });
    } else if (doc.status === "searching") count = t("find.searching");
    else if (doc.status === "error") count = t("find.error");
    else count = t("find.noResults");
  }

  return (
    <div
      role="search"
      className="absolute top-3 right-4 z-10 flex items-center gap-1 rounded-lg border border-line bg-surface-raised p-1 shadow-popover"
    >
      <label className="flex h-control-sm w-56 items-center gap-2 rounded-md border border-line bg-surface px-2 focus-within:border-focus">
        <Search {...ICON} aria-hidden className="flex-none text-ink-muted" />
        <input
          ref={inputRef}
          type="text"
          value={text}
          aria-label={t("find.label")}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ink outline-none"
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        />
      </label>
      <span
        aria-live="polite"
        className="min-w-16 px-1 text-center text-label whitespace-nowrap text-ink-muted tabular-nums"
      >
        {count}
      </span>
      <TextToggle
        label={t("find.matchCase")}
        pressed={options.matchCase}
        onToggle={() => {
          setOptions({ matchCase: !options.matchCase });
        }}
      >
        {t("find.matchCaseGlyph")}
      </TextToggle>
      <TextToggle
        label={t("find.wholeWords")}
        pressed={options.wholeWord}
        onToggle={() => {
          setOptions({ wholeWord: !options.wholeWord });
        }}
      >
        {t("find.wholeWordsGlyph")}
      </TextToggle>
      <IconButton
        size="sm"
        label={t("find.previous")}
        shortcut="Shift+Enter"
        icon={<ChevronUp {...ICON} />}
        disabled={!doc || doc.hits.length === 0}
        onClick={() => {
          go(-1);
        }}
      />
      <IconButton
        size="sm"
        label={t("find.next")}
        shortcut="Enter"
        icon={<ChevronDown {...ICON} />}
        disabled={!doc || doc.hits.length === 0}
        onClick={() => {
          go(1);
        }}
      />
      <IconButton
        size="sm"
        label={t("find.close")}
        shortcut="Esc"
        icon={<X {...ICON} />}
        onClick={close}
      />
    </div>
  );
}
