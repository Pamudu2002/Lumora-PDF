import { emit } from "@tauri-apps/api/event";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentsStore } from "@/stores/documents";
import { useSearchStore } from "@/stores/search";
import { useViewerStore } from "@/stores/viewer";
import { installTauriMocks } from "@/test/tauri";
import { App } from "./App";

function pageField(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>("textbox", { name: "Page number, 1 to 3" });
}

/** Makes open_document return a three-page "report.pdf" with id 7; `other` answers the rest. */
function mockReport(other: (cmd: string) => unknown = () => undefined) {
  installTauriMocks((cmd) => {
    if (cmd === "open_document") {
      return {
        document: {
          id: 7,
          path: "C:\\docs\\report.pdf",
          fileName: "report.pdf",
          info: {
            pageCount: 3,
            title: null,
            author: null,
            isEncrypted: false,
            hasForms: false,
            pdfVersion: "1.7",
          },
          pageSizes: [{ widthPt: 612, heightPt: 792 }],
          revision: 0,
        },
        view: { page: 0, zoom: null, zoomMode: null },
      };
    }
    return other(cmd);
  });
}

afterEach(() => {
  useDocumentsStore.setState({
    docs: [],
    activeId: null,
    dirty: {},
    pendingClose: null,
    opening: false,
    failure: null,
  });
});

describe("App", () => {
  it("shows the home screen when no document is open", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Every page, in good light" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Open file" })).toBeDefined();
  });

  it("switches the theme on the root element", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("opens a document and shows page 1 as tiles", async () => {
    mockReport();
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\report.pdf"));

    expect(screen.getByRole("tab", { name: "report.pdf", selected: true })).toBeDefined();
    // The sidebar lists page thumbnails, with the first page current.
    expect(screen.getByRole("button", { name: "Page 1" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(pageField().value).toBe("1");
    const page = screen.getByRole("group", { name: "Page 1" });
    const tiles = page.querySelectorAll("img");
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]?.getAttribute("src")).toContain("tile/7/0/");
  });

  it("goes to pages with the page field, Ctrl+G and the page keys", async () => {
    mockReport();
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\report.pdf"));
    const current = () => useViewerStore.getState().views[7]?.currentPage;

    fireEvent.keyDown(document.body, { key: "End" });
    expect(current()).toBe(2);
    expect(pageField().value).toBe("3");
    fireEvent.keyDown(document.body, { key: "PageUp" });
    expect(current()).toBe(1);
    fireEvent.keyDown(document.body, { key: "Home" });
    expect(current()).toBe(0);
    fireEvent.keyDown(document.body, { key: "PageDown" });
    expect(current()).toBe(1);
    // Arrows scroll in the continuous layout instead of turning pages.
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(current()).toBe(1);

    fireEvent.keyDown(document.body, { key: "g", ctrlKey: true });
    expect(document.activeElement).toBe(pageField());
    // Keys typed into the field don't turn pages.
    fireEvent.keyDown(pageField(), { key: "End" });
    expect(current()).toBe(1);
    fireEvent.change(pageField(), { target: { value: "9" } });
    fireEvent.keyDown(pageField(), { key: "Enter" });
    expect(current()).toBe(2);
    fireEvent.change(pageField(), { target: { value: "x1" } });
    expect(pageField().value).toBe("1");
    fireEvent.keyDown(pageField(), { key: "Enter" });
    expect(current()).toBe(0);
  });

  it("finds text with the find bar and steps through the matches", async () => {
    mockReport((cmd) => (cmd === "start_search" ? 5 : undefined));
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\report.pdf"));

    fireEvent.keyDown(document.body, { key: "f", ctrlKey: true });
    const field = screen.getByRole("textbox", { name: "Find in document" });
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "fox" } });
    // The search starts once typing pauses.
    expect(await screen.findByText("Searching…")).toBeDefined();
    await vi.waitFor(() => {
      expect(useSearchStore.getState().searches[7]?.searchId).toBe(5);
    });

    const rect = { x: 72, y: 100, width: 20, height: 10 };
    const hit = (page: number) => ({
      page,
      rects: [rect],
      snippet: "a fox",
      matchStart: 2,
      matchLen: 3,
    });
    await act(() =>
      emit("search-progress-event", {
        docId: 7,
        searchId: 5,
        progress: {
          hits: [hit(0), hit(2)],
          pagesSearched: 3,
          pageCount: 3,
          done: true,
          truncated: false,
        },
      }),
    );
    expect(screen.getByText("1 of 2")).toBeDefined();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByText("2 of 2")).toBeDefined();
    expect(useViewerStore.getState().views[7]?.currentPage).toBe(2);
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(screen.getByText("1 of 2")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Match case" }));
    expect(screen.getByRole("button", { name: "Match case" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("search")).toBeNull();
    expect(useSearchStore.getState().searches[7]).toBeUndefined();
  });

  it("explains why a file could not be opened", async () => {
    installTauriMocks((cmd) => {
      if (cmd === "open_document") {
        // Tauri rejects the invoke with the command's error value (a plain object).
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw { kind: "malformed", detail: "the file is damaged or is not a PDF" };
      }
      return undefined;
    });
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\broken.pdf"));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("broken.pdf");
    expect(alert.textContent).toContain("damaged or isn't a PDF");
  });

  it("shows a friendly notice when the Rust side reports an internal error", async () => {
    render(<App />);
    // Let the event listener register.
    await act(() => Promise.resolve());
    await act(() => emit("app-error-event", { detail: "boom" }));
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong inside Lumora");
  });
});
