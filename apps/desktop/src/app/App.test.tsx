import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentsStore } from "@/stores/documents";
import { installTauriMocks } from "@/test/tauri";
import { App } from "./App";

afterEach(() => {
  useDocumentsStore.setState({ current: null, opening: false, failure: null });
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
    installTauriMocks((cmd) => {
      if (cmd === "open_document") {
        return {
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
        };
      }
      return undefined;
    });
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\report.pdf"));

    expect(screen.getByRole("heading", { name: "report.pdf" })).toBeDefined();
    expect(screen.getByText("3 pages")).toBeDefined();
    const page = screen.getByRole("img", { name: "Page 1" });
    const tiles = page.querySelectorAll("img");
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]?.getAttribute("src")).toContain("tile/7/0/");
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
});
