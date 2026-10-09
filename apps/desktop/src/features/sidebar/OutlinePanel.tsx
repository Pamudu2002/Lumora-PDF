import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getOutline, type OutlineItem } from "@/lib/ipc";
import { useViewerStore } from "@/stores/viewer";

/** The outline of one document, or why it couldn't be read. */
type Loaded = { docId: number; items: OutlineItem[] } | { docId: number; error: true };

export interface OutlinePanelProps {
  docId: number;
}

/** The document outline as a collapsible tree; choosing an entry goes to its page. */
export function OutlinePanel({ docId }: OutlinePanelProps) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOutline(docId)
      .then((items) => {
        if (!cancelled) setLoaded({ docId, items });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ docId, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const current = loaded?.docId === docId ? loaded : null;
  if (!current || "error" in current || current.items.length === 0) {
    const message = !current
      ? t("outline.loading")
      : "error" in current
        ? t("outline.error")
        : t("outline.empty");
    return <p className="m-0 px-4 py-2 text-body text-ink-muted">{message}</p>;
  }
  const { items } = current;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <ul role="tree" aria-label={t("sidebar.outline")} className="m-0 list-none p-0">
        {items.map((item, i) => (
          <OutlineNode key={i} docId={docId} item={item} level={1} />
        ))}
      </ul>
    </div>
  );
}

interface OutlineNodeProps {
  docId: number;
  item: OutlineItem;
  level: number;
}

function OutlineNode({ docId, item, level }: OutlineNodeProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const goToPage = useViewerStore((s) => s.goToPage);
  const hasChildren = item.children.length > 0;
  const { page } = item;

  return (
    <li
      role="treeitem"
      aria-level={level}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={false}
      className="m-0"
    >
      <div className="flex items-start" style={{ paddingLeft: (level - 1) * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={t(expanded ? "outline.collapse" : "outline.expand", { title: item.title })}
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-muted hover:bg-surface hover:text-ink"
            onClick={() => {
              setExpanded(!expanded);
            }}
          >
            <ChevronRight
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className={cn("transition-transform duration-[120ms]", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="size-7 flex-none" />
        )}
        <button
          type="button"
          disabled={page === null}
          title={page === null ? t("outline.noTarget") : undefined}
          className="min-w-0 flex-1 cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-left text-body text-ink hover:bg-surface disabled:cursor-default disabled:text-ink-muted disabled:hover:bg-transparent"
          onClick={() => {
            if (page !== null) goToPage(docId, page);
          }}
        >
          <span className="block break-words">{item.title}</span>
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul role="group" className="m-0 list-none p-0">
          {item.children.map((child, i) => (
            <OutlineNode key={i} docId={docId} item={child} level={level + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
