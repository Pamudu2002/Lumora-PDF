import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useLinkPromptStore } from "@/stores/linkPrompt";
import { useViewerStore } from "@/stores/viewer";
import { usePageLinks } from "./usePageData";

export interface LinkLayerProps {
  docId: number;
  page: number;
  revision: number;
  /** CSS px per display point. */
  scale: number;
}

/** Clickable areas for the page's links: pages in this document, or web and email addresses. */
export const LinkLayer = memo(function LinkLayer({ docId, page, revision, scale }: LinkLayerProps) {
  const { t } = useTranslation();
  const links = usePageLinks(docId, revision, page);
  const goToPage = useViewerStore((s) => s.goToPage);
  const ask = useLinkPromptStore((s) => s.ask);
  if (!links || links.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {links.map((link, i) => {
        const { target, rect } = link;
        const label =
          target.kind === "page"
            ? t("links.goToPage", { page: target.page + 1 })
            : t("links.open", { url: target.uri });
        return (
          <button
            key={i}
            type="button"
            data-link={target.kind}
            aria-label={label}
            title={label}
            className="pointer-events-auto absolute cursor-pointer rounded-[2px] border-0 bg-transparent p-0 hover:bg-brand-soft/40 focus-visible:outline-2 focus-visible:outline-focus"
            style={{
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.width * scale,
              height: rect.height * scale,
            }}
            onClick={() => {
              if (target.kind === "page") goToPage(docId, target.page);
              else ask(target.uri);
            }}
          />
        );
      })}
    </div>
  );
});
