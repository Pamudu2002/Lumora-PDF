import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatDocDate, formatFileSize, formatPageSize, paperName } from "@/lib/format";
import { getProperties, type DocumentProperties, type OpenDocument } from "@/lib/ipc";
import { useDialogStore } from "@/stores/dialogs";
import { useDocView } from "@/stores/viewer";

export interface PropertiesDialogProps {
  doc: OpenDocument;
}

type Loaded = { docId: number; props: DocumentProperties } | { docId: number; error: true };

/** Document properties: metadata, file facts, security and fonts (Ctrl+D). */
export function PropertiesDialog({ doc }: PropertiesDialogProps) {
  const { t, i18n } = useTranslation();
  const open = useDialogStore((s) => s.open === "properties");
  const hide = useDialogStore((s) => s.hide);
  const { currentPage } = useDocView(doc.id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    getProperties(doc.id)
      .then((props) => {
        if (!cancelled) setLoaded({ docId: doc.id, props });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ docId: doc.id, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [open, doc.id]);

  const locale = i18n.language;
  const current = loaded?.docId === doc.id ? loaded : null;
  const size = doc.pageSizes[currentPage];
  const yes = t("properties.yes");
  const no = t("properties.no");
  const none = t("properties.none");

  let body;
  if (!current) {
    body = <p className="m-0 text-body text-ink-muted">{t("properties.loading")}</p>;
  } else if ("error" in current) {
    body = <p className="m-0 text-body text-danger">{t("properties.error")}</p>;
  } else {
    const p = current.props.properties;
    const paper = size ? paperName(size.widthPt, size.heightPt) : null;
    const pageSize = size
      ? [formatPageSize(size.widthPt, size.heightPt, locale), paper].filter(Boolean).join(" · ")
      : none;
    const rows: [string, string][] = [
      [t("properties.fileName"), doc.fileName],
      [t("properties.location"), doc.path],
      [
        t("properties.fileSize"),
        current.props.fileSizeBytes === null
          ? none
          : formatFileSize(current.props.fileSizeBytes, locale),
      ],
      [t("properties.docTitle"), p.title ?? none],
      [t("properties.author"), p.author ?? none],
      [t("properties.subject"), p.subject ?? none],
      [t("properties.keywords"), p.keywords ?? none],
      [t("properties.created"), p.created ? formatDocDate(p.created, locale) : none],
      [t("properties.modified"), p.modified ? formatDocDate(p.modified, locale) : none],
      [t("properties.creator"), p.creator ?? none],
      [t("properties.producer"), p.producer ?? none],
      [t("properties.version"), p.pdfVersion],
      [t("properties.pages"), String(p.pageCount)],
      [t("properties.pageSize", { page: currentPage + 1 }), pageSize],
      [t("properties.encrypted"), p.isEncrypted ? yes : no],
      [t("properties.forms"), p.hasForms ? yes : no],
    ];
    body = (
      <div className="flex flex-col gap-5">
        <dl className="m-0 grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 text-body">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="m-0 break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="properties-fonts" className="flex flex-col gap-2">
          <h3 id="properties-fonts" className="m-0 text-body font-semibold">
            {t("properties.fonts")}
          </h3>
          {p.fonts.length === 0 ? (
            <p className="m-0 text-body text-ink-muted">{t("properties.noFonts")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
              {p.fonts.map((font) => (
                <li key={font.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{font.name}</span>
                  <span className="flex-none text-label text-ink-muted">
                    {font.embedded ? t("properties.embedded") : t("properties.notEmbedded")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.fontsScannedPages < p.pageCount ? (
            <p className="m-0 text-label text-ink-muted">
              {t("properties.fontsSampled", { count: p.fontsScannedPages })}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) hide();
      }}
      title={t("properties.title")}
      size="lg"
      footer={
        <Button variant="primary" onClick={hide}>
          {t("properties.done")}
        </Button>
      }
    >
      {body}
    </Dialog>
  );
}
