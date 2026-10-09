import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Viewer } from "@/features/viewer/Viewer";
import { useApplyLanguage } from "@/i18n/useApplyLanguage";
import { useApplyTheme } from "@/lib/theme/useApplyTheme";
import { usePrintShortcut } from "@/features/print/usePrintShortcut";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { useSettingsShortcut } from "@/features/settings/useSettingsShortcut";
import { TabStrip } from "@/features/tabs/TabStrip";
import { UnsavedChangesDialog } from "@/features/tabs/UnsavedChangesDialog";
import { selectActiveDoc, useDocumentsStore } from "@/stores/documents";
import { Home } from "./Home";
import { PasswordDialog } from "./PasswordDialog";
import { useAppErrors } from "./useAppErrors";
import { useOsFileOpening } from "./useOsFileOpening";
import { useSearchEvents } from "./useSearchEvents";
import { useFileDrop, useOpenFileDialog, useOpenShortcut } from "./useFileOpening";

export function App() {
  const { t } = useTranslation();
  useApplyTheme();
  useApplyLanguage();
  const current = useDocumentsStore(selectActiveDoc);
  const hasDocs = useDocumentsStore((s) => s.docs.length > 0);
  const opening = useDocumentsStore((s) => s.opening);
  const failure = useDocumentsStore((s) => s.failure);
  const dismissFailure = useDocumentsStore((s) => s.dismissFailure);
  const openPath = useDocumentsStore((s) => s.open);
  const openFileDialog = useOpenFileDialog();
  useOpenShortcut(openFileDialog);
  const dragging = useFileDrop();
  const [internalError, dismissInternalError] = useAppErrors();
  useSearchEvents();
  usePrintShortcut();
  useOsFileOpening();
  useSettingsShortcut();

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-full flex-col bg-surface text-ink">
        {internalError ? (
          <Notice
            tone="warning"
            className="m-2 mb-0"
            action={
              <Button size="sm" variant="ghost" onClick={dismissInternalError}>
                {t("app.dismiss")}
              </Button>
            }
          >
            {t("app.internalError")}
          </Notice>
        ) : null}
        {failure ? (
          <Notice
            tone="danger"
            className="m-2 mb-0"
            action={
              <Button size="sm" variant="ghost" onClick={dismissFailure}>
                {t("app.dismiss")}
              </Button>
            }
          >
            <span className="font-semibold">{failure.fileName}</span> — {failure.message}
          </Notice>
        ) : null}
        {hasDocs ? <TabStrip onOpenFile={() => void openFileDialog()} /> : null}
        <div className="min-h-0 flex-1">
          {current ? (
            <Viewer key={current.id} doc={current} />
          ) : (
            <Home
              onOpenFile={() => void openFileDialog()}
              onOpenPath={(path) => void openPath(path)}
              dragging={dragging}
              opening={opening}
            />
          )}
        </div>
      </div>
      <UnsavedChangesDialog />
      <PasswordDialog />
      <SettingsDialog />
    </TooltipProvider>
  );
}
