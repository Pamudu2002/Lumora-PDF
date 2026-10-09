import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "@/app/App";
import { useDocumentsStore } from "@/stores/documents";
import { installTauriMocks } from "@/test/tauri";

/** open_document gives each new path the next id; close_document calls are recorded. */
function mockFiles() {
  const ids = new Map<string, number>();
  const closed: number[] = [];
  installTauriMocks((cmd, args) => {
    if (cmd === "open_document") {
      const { path } = args as { path: string };
      const id = ids.get(path) ?? ids.size + 1;
      ids.set(path, id);
      return {
        id,
        path,
        fileName: path.split("\\").pop() ?? path,
        info: {
          pageCount: 2,
          title: null,
          author: null,
          isEncrypted: false,
          hasForms: false,
          pdfVersion: "1.7",
        },
        pageSizes: [{ widthPt: 612, heightPt: 792 }],
        revision: 0,
      };
    }
    if (cmd === "close_document") closed.push((args as { docId: number }).docId);
    return undefined;
  });
  return { closed };
}

/** The document tabs (the toolbar and sidebar have tabs of their own). */
const tabs = () => within(screen.getByRole("tablist", { name: "Open documents" }));
const tabNames = () =>
  tabs()
    .getAllByRole("tab")
    .map((tab) => tab.textContent);
const selected = () =>
  tabs()
    .getAllByRole("tab", { selected: true })
    .map((t) => t.textContent);

async function openFiles(...paths: string[]) {
  for (const path of paths) {
    await act(() => useDocumentsStore.getState().open(path));
  }
}

describe("TabStrip", () => {
  beforeEach(() => {
    useDocumentsStore.setState({ docs: [], activeId: null, dirty: {}, pendingClose: null });
  });
  afterEach(() => {
    useDocumentsStore.setState({ docs: [], activeId: null, dirty: {}, pendingClose: null });
  });

  it("opens each file in its own tab and reuses the tab of a file already open", async () => {
    mockFiles();
    render(<App />);
    await openFiles("C:\\a.pdf", "C:\\b.pdf");
    expect(tabNames()).toEqual(["a.pdf", "b.pdf"]);
    expect(selected()).toEqual(["b.pdf"]);

    fireEvent.pointerDown(screen.getByRole("tab", { name: "a.pdf" }).parentElement as Element);
    expect(selected()).toEqual(["a.pdf"]);

    await openFiles("c:/B.pdf");
    expect(tabNames()).toEqual(["a.pdf", "b.pdf"]);
    expect(selected()).toEqual(["b.pdf"]);
  });

  it("closes tabs with middle-click and the close button, showing a neighbour", async () => {
    const { closed } = mockFiles();
    render(<App />);
    await openFiles("C:\\a.pdf", "C:\\b.pdf", "C:\\c.pdf");
    fireEvent.pointerDown(screen.getByRole("tab", { name: "b.pdf" }).parentElement as Element);

    await act(async () => {
      fireEvent(
        screen.getByRole("tab", { name: "b.pdf" }).parentElement as Element,
        new MouseEvent("auxclick", { bubbles: true, button: 1 }),
      );
      await Promise.resolve();
    });
    expect(tabNames()).toEqual(["a.pdf", "c.pdf"]);
    expect(selected()).toEqual(["c.pdf"]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close c.pdf" }));
      await Promise.resolve();
    });
    expect(tabNames()).toEqual(["a.pdf"]);
    expect(closed).toEqual([2, 3]);
  });

  it("asks before closing a document with unsaved changes", async () => {
    const { closed } = mockFiles();
    render(<App />);
    await openFiles("C:\\a.pdf");
    act(() => {
      useDocumentsStore.getState().setDirty(1, true);
    });
    expect(screen.getByRole("img", { name: "Unsaved changes" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Close a.pdf" }));
    expect(screen.getByRole("alertdialog", { name: "Close a.pdf without saving?" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(tabNames()).toEqual(["a.pdf"]);

    fireEvent.click(screen.getByRole("button", { name: "Close a.pdf" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close without saving" }));
      await Promise.resolve();
    });
    expect(screen.queryByRole("tablist", { name: "Open documents" })).toBeNull();
    expect(closed).toEqual([1]);
    // Back on the home screen.
    expect(screen.getByRole("heading", { name: "Every page, in good light" })).toBeDefined();
  });

  it("switches and moves tabs from the keyboard", async () => {
    mockFiles();
    render(<App />);
    await openFiles("C:\\a.pdf", "C:\\b.pdf", "C:\\c.pdf");
    fireEvent.keyDown(document.body, { key: "Tab", ctrlKey: true });
    expect(selected()).toEqual(["a.pdf"]);
    fireEvent.keyDown(document.body, { key: "PageUp", ctrlKey: true });
    expect(selected()).toEqual(["c.pdf"]);

    const tab = screen.getByRole("tab", { name: "c.pdf" });
    fireEvent.keyDown(tab, { key: "PageUp", ctrlKey: true, shiftKey: true });
    expect(tabNames()).toEqual(["a.pdf", "c.pdf", "b.pdf"]);
    fireEvent.keyDown(screen.getByRole("tab", { name: "c.pdf" }), { key: "Home" });
    expect(selected()).toEqual(["a.pdf"]);
  });
});
