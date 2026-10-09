import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { OutlineItem } from "@/lib/ipc";
import { useViewerStore } from "@/stores/viewer";
import { installTauriMocks } from "@/test/tauri";
import { OutlinePanel } from "./OutlinePanel";

const outline: OutlineItem[] = [
  { title: "Introduction", page: 0, children: [] },
  {
    title: "Methods",
    page: 3,
    children: [{ title: "Sampling", page: 4, children: [] }],
  },
  { title: "Broken entry", page: null, children: [] },
];

function mockOutline(items: OutlineItem[]) {
  installTauriMocks((cmd) => (cmd === "get_outline" ? items : undefined));
}

describe("OutlinePanel", () => {
  beforeEach(() => {
    useViewerStore.setState({ views: {}, zoomAnchor: null, scrollRequest: null });
  });

  it("shows the tree, expands entries and goes to pages", async () => {
    mockOutline(outline);
    render(<OutlinePanel docId={1} />);
    expect(await screen.findByText("Introduction")).toBeDefined();
    expect(screen.queryByText("Sampling")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand Methods" }));
    fireEvent.click(screen.getByText("Sampling"));
    expect(useViewerStore.getState().scrollRequest).toMatchObject({ docId: 1, page: 4 });

    // Entries without a target can't be chosen.
    expect(screen.getByText("Broken entry").closest("button")?.disabled).toBe(true);
  });

  it("says when a document has no outline", async () => {
    mockOutline([]);
    render(<OutlinePanel docId={2} />);
    expect(await screen.findByText("This document has no outline.")).toBeDefined();
  });
});
