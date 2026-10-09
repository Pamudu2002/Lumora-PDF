import { Plus } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { useDocumentsStore } from "@/stores/documents";
import { DocumentTab } from "./DocumentTab";

/** Pointer travel before a press on a tab becomes a drag. */
const DRAG_THRESHOLD_PX = 4;

export interface TabStripProps {
  onOpenFile: () => void;
}

/**
 * The open documents as tabs. Drag to reorder, middle-click to close; with a tab focused, the
 * arrow keys switch tabs and Ctrl+Shift+PageUp / PageDown move the tab.
 */
export function TabStrip({ onOpenFile }: TabStripProps) {
  const { t } = useTranslation();
  const docs = useDocumentsStore((s) => s.docs);
  const activeId = useDocumentsStore((s) => s.activeId);
  const dirty = useDocumentsStore((s) => s.dirty);
  const activate = useDocumentsStore((s) => s.activate);
  const close = useDocumentsStore((s) => s.close);
  const move = useDocumentsStore((s) => s.move);
  const tabEls = useRef(new Map<number, HTMLDivElement>());
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const activateNext = useDocumentsStore((s) => s.activateNext);

  // Ctrl+Tab / Ctrl+Shift+Tab and Ctrl+PageDown / Ctrl+PageUp switch tabs from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Tab") {
        e.preventDefault();
        activateNext(e.shiftKey ? -1 : 1);
      } else if (!e.shiftKey && (e.key === "PageDown" || e.key === "PageUp")) {
        e.preventDefault();
        activateNext(e.key === "PageDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [activateNext]);

  const focusTab = (docId: number) => {
    requestAnimationFrame(() => {
      tabEls.current.get(docId)?.querySelector<HTMLElement>('[role="tab"]')?.focus();
    });
  };

  // Window listeners rather than pointer capture: React moves tab nodes while reordering.
  const startDrag = (e: PointerEvent<HTMLDivElement>, docId: number) => {
    if (e.button !== 0) return;
    activate(docId);
    const startX = e.clientX;
    let dragging = false;
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
      if (!dragging) {
        dragging = true;
        setDraggingId(docId);
      }
      let index = 0;
      for (const doc of useDocumentsStore.getState().docs) {
        if (doc.id === docId) continue;
        const rect = tabEls.current.get(doc.id)?.getBoundingClientRect();
        if (rect && ev.clientX > rect.left + rect.width / 2) index += 1;
      }
      move(docId, index);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDraggingId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, docId: number) => {
    const index = docs.findIndex((d) => d.id === docId);
    if (e.ctrlKey && e.shiftKey && (e.key === "PageUp" || e.key === "PageDown")) {
      e.preventDefault();
      move(docId, index + (e.key === "PageDown" ? 1 : -1));
      focusTab(docId);
      return;
    }
    let target: number | undefined;
    if (e.key === "ArrowRight") target = docs[(index + 1) % docs.length]?.id;
    else if (e.key === "ArrowLeft") target = docs[(index - 1 + docs.length) % docs.length]?.id;
    else if (e.key === "Home") target = docs[0]?.id;
    else if (e.key === "End") target = docs[docs.length - 1]?.id;
    if (target === undefined) return;
    e.preventDefault();
    activate(target);
    focusTab(target);
  };

  return (
    <div className="flex h-10 flex-none items-end gap-1 border-b border-line bg-surface-sunken px-2">
      <span aria-hidden className="mr-2 mb-2 flex-none font-display text-title text-ink">
        {t("app.wordmark")}
        <span className="ml-1 font-ui text-caption text-ink-muted">{t("app.wordmarkSuffix")}</span>
      </span>
      <div role="tablist" aria-label={t("tabs.label")} className="flex min-w-0 items-end gap-0.5">
        {docs.map((doc) => (
          <DocumentTab
            key={doc.id}
            ref={(el) => {
              if (el) tabEls.current.set(doc.id, el);
              else tabEls.current.delete(doc.id);
            }}
            doc={doc}
            active={doc.id === activeId}
            dirty={dirty[doc.id] ?? false}
            dragging={doc.id === draggingId}
            onPointerDown={(e) => {
              startDrag(e, doc.id);
            }}
            onClose={() => void close(doc.id)}
            onKeyDown={(e) => {
              onTabKey(e, doc.id);
            }}
          />
        ))}
      </div>
      <IconButton
        size="sm"
        className="mb-1"
        label={t("home.openFile")}
        shortcut="Ctrl+O"
        icon={<Plus size={16} strokeWidth={1.75} />}
        onClick={onOpenFile}
      />
    </div>
  );
}
