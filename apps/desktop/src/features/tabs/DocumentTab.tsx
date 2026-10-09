import { X } from "lucide-react";
import type { KeyboardEvent, PointerEvent, Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { OpenDocument } from "@/lib/ipc";

export interface DocumentTabProps {
  doc: OpenDocument;
  active: boolean;
  dirty: boolean;
  dragging: boolean;
  ref?: Ref<HTMLDivElement>;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

/** One tab: the file name (full path on hover), an unsaved-changes dot and a close button. */
export function DocumentTab({
  doc,
  active,
  dirty,
  dragging,
  ref,
  onPointerDown,
  onClose,
  onKeyDown,
}: DocumentTabProps) {
  const { t } = useTranslation();
  const name = doc.fileName;

  return (
    <div
      ref={ref}
      role="presentation"
      title={doc.path}
      data-tab={doc.id}
      className={cn(
        "group relative flex h-8 max-w-56 min-w-28 flex-[0_1_14rem] items-center rounded-t-md border border-b-0 pr-1 select-none",
        active
          ? "border-line bg-surface text-ink"
          : "border-transparent text-ink-muted hover:bg-surface hover:text-ink",
        dragging && "z-10 shadow-popover",
      )}
      onPointerDown={onPointerDown}
      onMouseDown={(e) => {
        // Middle-click closes; stop the browser's autoscroll from starting.
        if (e.button === 1) e.preventDefault();
      }}
      onAuxClick={(e) => {
        if (e.button === 1) onClose();
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className="h-full min-w-0 flex-1 cursor-default truncate border-0 bg-transparent pl-3 text-left text-label font-medium text-current outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        onKeyDown={onKeyDown}
      >
        {name}
      </button>
      {dirty ? (
        <span
          role="img"
          aria-label={t("tabs.unsaved")}
          className="mx-1 size-2 flex-none rounded-full bg-brand"
        />
      ) : null}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("tabs.close", { name })}
        className={cn(
          "grid size-5 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-ink-muted hover:bg-surface-sunken hover:text-ink",
          !active && "opacity-0 group-hover:opacity-100",
        )}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={onClose}
      >
        <X size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
