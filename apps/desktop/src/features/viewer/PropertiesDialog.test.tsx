import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/app/App";
import { useDialogStore } from "@/stores/dialogs";
import { useDocumentsStore } from "@/stores/documents";
import { installTauriMocks } from "@/test/tauri";

const properties = {
  title: "Annual report",
  author: null,
  subject: null,
  keywords: null,
  creator: "Writer",
  producer: "LibreOffice 7.6",
  created: "2024-03-05 14:07",
  modified: null,
  pdfVersion: "1.7",
  pageCount: 120,
  isEncrypted: false,
  hasForms: true,
  fonts: [
    { name: "Inter", embedded: true },
    { name: "Times-Roman", embedded: false },
  ],
  fontsScannedPages: 100,
};

function mockDoc() {
  installTauriMocks((cmd) => {
    if (cmd === "get_properties") return { properties, fileSizeBytes: 1.25 * 1024 * 1024 };
    if (cmd === "open_document") {
      return {
        document: {
          id: 9,
          path: "C:\\docs\\report.pdf",
          fileName: "report.pdf",
          info: {
            pageCount: 120,
            title: "Annual report",
            author: null,
            isEncrypted: false,
            hasForms: true,
            pdfVersion: "1.7",
          },
          pageSizes: Array.from({ length: 120 }, () => ({ widthPt: 595.28, heightPt: 841.89 })),
          revision: 0,
        },
        view: { page: 0, zoom: null, zoomMode: null },
      };
    }
    return undefined;
  });
}

afterEach(() => {
  useDialogStore.setState({ open: null });
  useDocumentsStore.setState({ docs: [], activeId: null });
});

describe("PropertiesDialog", () => {
  it("shows the document's properties with Ctrl+D", async () => {
    mockDoc();
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\report.pdf"));
    fireEvent.keyDown(document.body, { key: "d", ctrlKey: true });

    const dialog = screen.getByRole("dialog", { name: "Document properties" });
    await within(dialog).findByText("Annual report");
    const value = (label: string) =>
      within(dialog).getByText(label).nextElementSibling?.textContent ?? "";
    expect(value("File size")).toBe("1.3 MB");
    expect(value("Author")).toBe("—");
    expect(value("PDF producer")).toBe("LibreOffice 7.6");
    expect(value("Form fields")).toBe("Yes");
    expect(value("Page size (page 1)")).toContain("A4");
    expect(value("Created")).toContain("2024");
    expect(within(dialog).getByText("Times-Roman").nextElementSibling?.textContent).toBe(
      "Not embedded",
    );
    expect(within(dialog).getByText("Fonts from the first 100 pages.")).toBeDefined();

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the View toolbar", async () => {
    mockDoc();
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\report.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Document properties" }));
    expect(screen.getByRole("dialog", { name: "Document properties" })).toBeDefined();
  });
});
