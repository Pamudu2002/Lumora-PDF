import { memo, useMemo, type MouseEvent } from "react";
import { TEXT_LAYER_FONT, textWidthAt100px } from "@/lib/measureText";
import { layoutText } from "./textLayout";
import { usePageText } from "./usePageText";

export interface TextLayerProps {
  docId: number;
  page: number;
  revision: number;
  /** CSS px per display point. */
  scale: number;
}

/**
 * The page's text as transparent, selectable spans laid over the rendered tiles. Each run is
 * stretched to the width PDFium measured, so selections line up with the visible glyphs.
 */
export const TextLayer = memo(function TextLayer({ docId, page, revision, scale }: TextLayerProps) {
  const runs = usePageText(docId, revision, page);
  const paragraphs = useMemo(
    () =>
      layoutText(runs ?? []).map((para) =>
        para.map((run) => {
          const natural = textWidthAt100px(run.text);
          return { ...run, stretch: natural ? run.width / ((natural * run.height) / 100) : 1 };
        }),
      ),
    [runs],
  );

  // Triple-click selects the paragraph (double-click selects a word natively).
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.detail !== 3 || !(e.target instanceof HTMLElement)) return;
    const para = e.target.closest("[data-paragraph]");
    const first = para?.firstElementChild?.firstChild;
    const last = para?.lastElementChild?.firstChild;
    const selection = window.getSelection();
    if (!first || !last || !selection) return;
    e.preventDefault();
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.textContent?.length ?? 0);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  if (paragraphs.length === 0) return null;
  return (
    <div
      data-text-layer={page}
      className="absolute inset-0 cursor-text select-text"
      style={{ fontFamily: TEXT_LAYER_FONT }}
      onMouseDown={onMouseDown}
    >
      {paragraphs.map((para, i) => (
        <div key={i} data-paragraph className="absolute top-0 left-0">
          {para.map((run, j) => (
            <span
              key={j}
              data-sep={run.sep}
              className="absolute origin-top-left leading-none whitespace-pre text-transparent"
              style={{
                left: run.x * scale,
                top: run.y * scale,
                fontSize: run.height * scale,
                transform: `scaleX(${run.stretch})`,
              }}
            >
              {run.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
});
