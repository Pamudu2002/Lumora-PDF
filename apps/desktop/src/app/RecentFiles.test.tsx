import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentsStore } from "@/stores/documents";
import { useViewerStore } from "@/stores/viewer";
import { installTauriMocks } from "@/test/tauri";
import { App } from "./App";

const now = Date.now();
const recent = [
  {
    file: {
      path: "C:\\Users\\me\\Documents\\Study\\notes.pdf",
      fileName: "notes.pdf",
      pageCount: 32,
      lastOpenedMs: now,
      view: { page: 5, zoom: 1.5, zoomMode: "custom" },
    },
    exists: true,
  },
  {
    file: {
      path: "C:\\Users\\me\\Downloads\\gone.pdf",
      fileName: "gone.pdf",
      pageCount: 3,
      lastOpenedMs: now - 3 * 86_400_000,
      view: { page: 0, zoom: null, zoomMode: null },
    },
    exists: false,
  },
];

function mockBackend() {
  const calls: { cmd: string; args: unknown }[] = [];
  installTauriMocks((cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "list_recent_files") return recent;
    if (cmd === "open_document") {
      return {
        document: {
          id: 11,
          path: (args as { path: string }).path,
          fileName: "notes.pdf",
          info: {
            pageCount: 32,
            title: null,
            author: null,
            isEncrypted: false,
            hasForms: false,
            pdfVersion: "1.7",
          },
          pageSizes: Array.from({ length: 32 }, () => ({ widthPt: 612, heightPt: 792 })),
          revision: 0,
        },
        view: { page: 5, zoom: 1.5, zoomMode: "custom" },
      };
    }
    return undefined;
  });
  return calls;
}

afterEach(() => {
  useDocumentsStore.setState({ docs: [], activeId: null, dirty: {}, pendingClose: null });
});

describe("Recent files", () => {
  it("lists recent files on the home screen", async () => {
    mockBackend();
    render(<App />);
    const table = await screen.findByRole("table");
    expect(screen.getByRole("heading", { name: "Pick up where you left off" })).toBeDefined();
    const rows = within(table).getAllByRole("row");
    expect(rows[1]?.textContent).toContain("notes.pdf");
    expect(rows[1]?.textContent).toContain("Documents › Study");
    expect(rows[1]?.textContent).toContain("Today");
    expect(rows[1]?.textContent).toContain("32");
    expect(rows[2]?.textContent).toContain("File not found");
  });

  it("opens a recent file where it was left", async () => {
    const calls = mockBackend();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "notes.pdf" }));
    await vi.waitFor(() => {
      expect(useDocumentsStore.getState().activeId).toBe(11);
    });
    expect(calls.find((c) => c.cmd === "open_document")?.args).toMatchObject({
      path: "C:\\Users\\me\\Documents\\Study\\notes.pdf",
    });
    const view = useViewerStore.getState().views[11];
    expect(view).toMatchObject({ currentPage: 5, zoom: 1.5, zoomMode: "custom" });
  });

  it("saves the view when a document closes", async () => {
    const calls = mockBackend();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "notes.pdf" }));
    await vi.waitFor(() => {
      expect(useDocumentsStore.getState().activeId).toBe(11);
    });
    await act(() => useDocumentsStore.getState().close(11));
    expect(calls.find((c) => c.cmd === "save_view")?.args).toMatchObject({
      path: "C:\\Users\\me\\Documents\\Study\\notes.pdf",
      view: { page: 5, zoom: 1.5, zoomMode: "custom" },
    });
  });

  it("removes a file from the list", async () => {
    const calls = mockBackend();
    render(<App />);
    fireEvent.pointerDown(
      await screen.findByRole("button", { name: "More actions for gone.pdf" }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove from list" }));
    expect(screen.queryByRole("button", { name: "gone.pdf" })).toBeNull();
    expect(calls.find((c) => c.cmd === "remove_recent_file")?.args).toMatchObject({
      path: "C:\\Users\\me\\Downloads\\gone.pdf",
    });
  });
});
