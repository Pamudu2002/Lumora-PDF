import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { openExternalLink } from "@/lib/ipc";
import { useLinkPromptStore } from "@/stores/linkPrompt";

/** Web and email links are the only ones Lumora opens (the Rust side checks again). */
const OPENABLE = /^(https?:\/\/[^\s/?#]+\S*|mailto:\S+)$/i;

/** Asks before opening a link from a document in the browser or mail app. */
export function ExternalLinkDialog() {
  const { t } = useTranslation();
  const url = useLinkPromptStore((s) => s.url);
  const dismiss = useLinkPromptStore((s) => s.dismiss);
  const openable = url !== null && OPENABLE.test(url);
  const mail = url?.toLowerCase().startsWith("mailto:") ?? false;

  return (
    <ConfirmDialog
      open={url !== null}
      title={openable ? t("links.confirmTitle") : t("links.blockedTitle")}
      confirmLabel={openable ? t("links.confirm") : undefined}
      cancelLabel={openable ? t("links.cancel") : t("links.ok")}
      onCancel={dismiss}
      onConfirm={() => {
        if (url !== null) void openExternalLink(url).catch(() => undefined);
        dismiss();
      }}
    >
      <p className="m-0">
        {openable ? (mail ? t("links.confirmMail") : t("links.confirmWeb")) : t("links.blocked")}
      </p>
      <p className="m-0 mt-2 rounded-md bg-surface-sunken px-2 py-1.5 font-mono text-label break-all text-ink">
        {url}
      </p>
    </ConfirmDialog>
  );
}
