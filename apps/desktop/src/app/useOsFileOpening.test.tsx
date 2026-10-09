import { emit } from "@tauri-apps/api/event";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentsStore } from "@/stores/documents";
import { installTauriMocks } from "@/test/tauri";
import { App } from "./App";

/** Startup files from argv, and open_document returning a document per path. */
function mockOs(startup: string[]) {
  const opened: string[] = [];
  installTauriMocks((cmd, args) => {
    if (cmd === "take_startup_files") {
      const files = [...startup];
      startup.length = 0;
      return files;
    }
    if (cmd === "open_document") {
      const { path } = args as { path: string };
      opened.push(path);
      return {
        document: {
          id: opened.length,
          path,
          fileName: path.split("\\").pop() ?? path,
          info: {
            pageCount: 1,
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
    return undefined;
  });
  return opened;
}

afterEach(() => {
  useDocumentsStore.setState({ docs: [], activeId: null });
});

describe("useOsFileOpening", () => {
  it("opens the files Lumora was started with, each in a tab", async () => {
    const opened = mockOs(["C:\\in\\a.pdf", "C:\\in\\b.pdf"]);
    render(<App />);
    await vi.waitFor(() => {
      expect(useDocumentsStore.getState().docs.map((d) => d.fileName)).toEqual(["a.pdf", "b.pdf"]);
    });
    expect(opened).toEqual(["C:\\in\\a.pdf", "C:\\in\\b.pdf"]);
  });

  it("opens files passed on by a second launch", async () => {
    mockOs([]);
    render(<App />);
    // Let the listener register.
    await act(() => Promise.resolve());
    await act(() => emit("open-files-event", { paths: ["C:\\later\\c.pdf"] }));
    await vi.waitFor(() => {
      expect(useDocumentsStore.getState().docs.map((d) => d.fileName)).toEqual(["c.pdf"]);
    });
  });
});
