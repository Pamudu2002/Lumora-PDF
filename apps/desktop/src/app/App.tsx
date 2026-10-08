import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Viewer } from "@/features/viewer/Viewer";
import { useApplyTheme } from "@/lib/theme/useApplyTheme";
import { useDocumentsStore } from "@/stores/documents";
import { Home } from "./Home";
import { useFileDrop, useOpenFileDialog, useOpenShortcut } from "./useFileOpening";

export function App() {
  useApplyTheme();
  const current = useDocumentsStore((s) => s.current);
  const opening = useDocumentsStore((s) => s.opening);
  const failure = useDocumentsStore((s) => s.failure);
  const dismissFailure = useDocumentsStore((s) => s.dismissFailure);
  const openFileDialog = useOpenFileDialog();
  useOpenShortcut(openFileDialog);
  const dragging = useFileDrop();

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-full flex-col bg-surface text-ink">
        {failure ? (
          <Notice
            tone="danger"
            className="m-2 mb-0"
            action={
              <Button size="sm" variant="ghost" onClick={dismissFailure}>
                Dismiss
              </Button>
            }
          >
            <span className="font-semibold">{failure.fileName}</span> — {failure.message}
          </Notice>
        ) : null}
        <div className="min-h-0 flex-1">
          {current ? (
            <Viewer key={current.id} doc={current} />
          ) : (
            <Home onOpenFile={() => void openFileDialog()} dragging={dragging} opening={opening} />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
