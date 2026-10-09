import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { OpenDocument } from "@/lib/ipc";
import { useDialogStore } from "@/stores/dialogs";
import { useDocView } from "@/stores/viewer";
import { parsePageRange, PRINT_DPI } from "./printImages";
import { PrintPages } from "./PrintPages";

type Choice = "all" | "current" | "range";

/** A print run: the pages chosen and how many of their images have loaded. */
interface Job {
  pages: number[];
  loaded: number;
  failedPage: number | null;
}

export interface PrintDialogProps {
  doc: OpenDocument;
}

/**
 * Choose pages to print, then Lumora renders them at 300 dpi and opens the system print dialog.
 * Shows progress while the pages are prepared, with Cancel.
 */
export function PrintDialog({ doc }: PrintDialogProps) {
  const { t } = useTranslation();
  const open = useDialogStore((s) => s.open === "print");
  const hide = useDialogStore((s) => s.hide);
  const { currentPage } = useDocView(doc.id);
  const [choice, setChoice] = useState<Choice>("all");
  const [rangeText, setRangeText] = useState("");
  const [rangeError, setRangeError] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const id = useId();
  const pageCount = doc.info.pageCount;

  const close = () => {
    setJob(null);
    setRangeError(false);
    hide();
  };

  // Every page is ready: hand over to the system print dialog, then clean up.
  const ready = job !== null && job.failedPage === null && job.loaded >= job.pages.length;
  useEffect(() => {
    if (!ready) return undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setJob(null);
      hide();
    };
    window.addEventListener("afterprint", finish, { once: true });
    // Let the last image paint before printing.
    const timer = setTimeout(() => {
      window.print();
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
    };
  }, [ready, hide]);

  const start = () => {
    let pages: number[] | null;
    if (choice === "all") pages = Array.from({ length: pageCount }, (_, i) => i);
    else if (choice === "current") pages = [currentPage];
    else pages = parsePageRange(rangeText, pageCount);
    if (!pages || pages.length === 0) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    setJob({ pages, loaded: 0, failedPage: null });
  };

  const options: { value: Choice; label: string }[] = [
    { value: "all", label: t("print.all", { count: pageCount }) },
    { value: "current", label: t("print.current", { page: currentPage + 1 }) },
    { value: "range", label: t("print.range") },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={t("print.title")}
      description={t("print.quality", { dpi: PRINT_DPI })}
      footer={
        job ? (
          <Button onClick={close}>{t("print.cancel")}</Button>
        ) : (
          <>
            <Button onClick={close}>{t("print.cancel")}</Button>
            <Button variant="primary" onClick={start} disabled={pageCount === 0}>
              {t("print.print")}
            </Button>
          </>
        )
      }
    >
      {job ? (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          {job.failedPage === null ? (
            <>
              <p className="m-0 text-body">
                {t("print.preparing", {
                  done: Math.min(job.loaded + 1, job.pages.length),
                  total: job.pages.length,
                })}
              </p>
              <div className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
                <div
                  className="h-full bg-brand transition-[width] duration-[120ms]"
                  style={{ width: `${(job.loaded / job.pages.length) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className="m-0 text-body text-danger" role="alert">
              {t("print.failed", { page: job.failedPage + 1 })}
            </p>
          )}
          <PrintPages
            doc={doc}
            pages={job.pages}
            loaded={job.loaded}
            onLoad={() => {
              setJob((j) => (j ? { ...j, loaded: j.loaded + 1 } : j));
            }}
            onError={(page) => {
              setJob((j) => (j ? { ...j, failedPage: page } : j));
            }}
          />
        </div>
      ) : (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-label font-medium text-ink">{t("print.pages")}</legend>
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-body">
              <input
                type="radio"
                name={`${id}-pages`}
                value={option.value}
                checked={choice === option.value}
                className="accent-brand"
                onChange={() => {
                  setChoice(option.value);
                  setRangeError(false);
                }}
              />
              {option.label}
            </label>
          ))}
          <input
            type="text"
            aria-label={t("print.rangeLabel")}
            placeholder={t("print.rangePlaceholder")}
            value={rangeText}
            aria-invalid={rangeError}
            aria-describedby={rangeError ? `${id}-error` : undefined}
            className="ml-6 h-control rounded-md border border-line-strong bg-surface px-3 text-body text-ink outline-none focus:border-focus aria-invalid:border-danger"
            onFocus={() => {
              setChoice("range");
            }}
            onChange={(e) => {
              setRangeText(e.target.value);
              setChoice("range");
              setRangeError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") start();
            }}
          />
          {rangeError ? (
            <p id={`${id}-error`} role="alert" className="m-0 ml-6 text-label text-danger">
              {t("print.rangeInvalid", { count: pageCount })}
            </p>
          ) : null}
        </fieldset>
      )}
    </Dialog>
  );
}
