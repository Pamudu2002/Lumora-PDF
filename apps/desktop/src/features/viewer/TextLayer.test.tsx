import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installTauriMocks } from "@/test/tauri";
import { textLayerSelection } from "./textCopy";
import { TextLayer } from "./TextLayer";

const rect = (x: number, y: number, width: number, height = 10) => ({ x, y, width, height });

/** Page 0: a heading and a two-line paragraph. Page 1: one line. */
const pages: Record<number, { text: string; rect: ReturnType<typeof rect> }[]> = {
  0: [
    { text: "Heading", rect: rect(10, 10, 70, 20) },
    { text: "First line", rect: rect(10, 50, 50) },
    { text: "of text", rect: rect(10, 62, 35) },
  ],
  1: [{ text: "Next page", rect: rect(10, 10, 45) }],
};

function textNode(text: string): Text {
  const node = screen.getByText(text).firstChild;
  if (!(node instanceof Text)) throw new Error(`no text node for ${text}`);
  return node;
}

describe("TextLayer", () => {
  beforeEach(() => {
    // jsdom has no canvas; runs then keep their natural width.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    installTauriMocks((cmd, args) =>
      cmd === "get_page_text" ? { runs: pages[(args as { page: number }).page] ?? [] } : undefined,
    );
  });

  it("lays the page text out as positioned spans", async () => {
    render(<TextLayer docId={1} page={0} revision={0} scale={2} />);
    const span = await screen.findByText("First line");
    expect(span.style.left).toBe("20px");
    expect(span.style.top).toBe("100px");
    expect(span.style.fontSize).toBe("20px");
  });

  it("copies lines and pages with breaks between them", async () => {
    const { container } = render(
      <>
        <TextLayer docId={2} page={0} revision={0} scale={1} />
        <TextLayer docId={2} page={1} revision={0} scale={1} />
      </>,
    );
    await screen.findByText("Next page");
    const range = document.createRange();
    range.setStart(textNode("Heading"), 4);
    range.setEnd(textNode("Next page"), 4);
    expect(textLayerSelection(range, container)).toBe("ing\nFirst line\nof text\n\nNext");

    range.setStart(textNode("First line"), 6);
    range.setEnd(textNode("of text"), 2);
    expect(textLayerSelection(range, container)).toBe("line\nof");
  });

  it("selects a whole paragraph on triple-click", async () => {
    render(<TextLayer docId={3} page={0} revision={0} scale={1} />);
    const span = await screen.findByText("of text");
    fireEvent.mouseDown(span, { detail: 3 });
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(textNode("First line"));
    expect(range?.endContainer).toBe(textNode("of text"));
    expect(range?.endOffset).toBe("of text".length);
  });
});
