import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDocumentsStore } from "@/stores/documents";

/** Asks before closing a document with unsaved changes. */
export function UnsavedChangesDialog() {
  const { t } = useTranslation();
  const pendingClose = useDocumentsStore((s) => s.pendingClose);
  const name = useDocumentsStore(
    (s) => s.docs.find((d) => d.id === s.pendingClose)?.fileName ?? "",
  );
  const confirmClose = useDocumentsStore((s) => s.confirmClose);
  const cancelClose = useDocumentsStore((s) => s.cancelClose);

  return (
    <ConfirmDialog
      open={pendingClose !== null}
      title={t("tabs.confirmTitle", { name })}
      confirmLabel={t("tabs.confirm")}
      cancelLabel={t("tabs.cancel")}
      onConfirm={() => void confirmClose()}
      onCancel={cancelClose}
    >
      <p className="m-0">{t("tabs.confirmBody")}</p>
    </ConfirmDialog>
  );
}
