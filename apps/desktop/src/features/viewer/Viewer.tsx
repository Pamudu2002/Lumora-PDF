import { X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import type { OpenDocument } from "@/lib/ipc";
import { useDocumentsStore } from "@/stores/documents";
import { useViewerStore } from "@/stores/viewer";
import { DocumentView } from "./DocumentView";
import { ZoomBar } from "./ZoomBar";

export interface ViewerProps {
  doc: OpenDocument;
}

/** The document screen: toolbar, canvas with pages, and the floating zoom bar. */
export function Viewer({ doc }: ViewerProps) {
  const { t } = useTranslation();
  const close = useDocumentsStore((s) => s.close);
  const init = useViewerStore((s) => s.init);
  useEffect(() => {
    init(doc.id);
  }, [doc.id, init]);
  useViewerShortcuts(doc.id);

  const title = doc.info.title ?? doc.fileName;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-toolbar flex-none items-center gap-2 border-b border-line bg-surface px-3">
        <h1 className="m-0 min-w-0 flex-1 truncate text-body font-semibold" title={doc.path}>
          {title}
        </h1>
        <IconButton
          label={t("viewer.closeFile")}
          shortcut="Ctrl+W"
          icon={<X size={18} strokeWidth={1.75} />}
          onClick={() => void close()}
        />
      </header>
      <main className="relative min-h-0 flex-1">
        <DocumentView doc={doc} dark={false} />
        <ZoomBar docId={doc.id} pageCount={doc.info.pageCount} />
      </main>
    </div>
  );
}

/** Ctrl+= / Ctrl++ zoom in, Ctrl+- zoom out, Ctrl+0 actual size, Ctrl+W close. */
function useViewerShortcuts(docId: number) {
  const zoomStep = useViewerStore((s) => s.zoomStep);
  const setZoom = useViewerStore((s) => s.setZoom);
  const close = useDocumentsStore((s) => s.close);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const actions: Record<string, () => void> = {
        "=": () => {
          zoomStep(docId, 1);
        },
        "+": () => {
          zoomStep(docId, 1);
        },
        "-": () => {
          zoomStep(docId, -1);
        },
        "0": () => {
          setZoom(docId, 1);
        },
        w: () => void close(),
      };
      const action = actions[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [docId, zoomStep, setZoom, close]);
}
