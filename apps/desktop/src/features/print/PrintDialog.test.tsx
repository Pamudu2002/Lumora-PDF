import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { useDocumentsStore } from "@/stores/documents";
import { useDialogStore } from "@/stores/dialogs";
import { installTauriMocks } from "@/test/tauri";

function mockDoc() {
  installTauriMocks((cmd) =>
    cmd === "open_document"
      ? {
          document: {
            id: 4,
            path: "C:\\docs\\print.pdf",
            fileName: "print.pdf",
            info: {
              pageCount: 3,
              title: null,
              author: null,
              isEncrypted: false,
              hasForms: false,
              pdfVersion: "1.7",
            },
            pageSizes: Array.from({ length: 3 }, () => ({ widthPt: 612, heightPt: 792 })),
            revision: 0,
          },
          view: { page: 0, zoom: null, zoomMode: null },
        }
      : undefined,
  );
}

const printImages = () => [...document.querySelectorAll<HTMLImageElement>("#lumora-print img")];

afterEach(() => {
  useDialogStore.setState({ open: null });
  useDocumentsStore.setState({ docs: [], activeId: null });
  vi.restoreAllMocks();
});

describe("PrintDialog", () => {
  it("prints the chosen pages once they are rendered", async () => {
    mockDoc();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\print.pdf"));

    fireEvent.keyDown(document.body, { key: "p", ctrlKey: true });
    const dialog = screen.getByRole("dialog", { name: "Print" });
    expect(within(dialog).getByRole("radio", { name: "All pages (3)" })).toBeDefined();

    const range = within(dialog).getByRole("textbox", { name: "Pages to print" });
    fireEvent.change(range, { target: { value: "2-9" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Print" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("from 1 to 3");
    expect(printImages()).toEqual([]);

    fireEvent.change(range, { target: { value: "3, 2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Print" }));
    expect(within(dialog).getByText("Preparing page 1 of 2…")).toBeDefined();
    const images = printImages();
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      expect.stringContaining("print/4/2/4166?rev=0"),
      expect.stringContaining("print/4/1/4166?rev=0"),
    ]);
    expect(images[0]?.style.width).toBe("612pt");

    for (const img of images) fireEvent.load(img);
    await vi.waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1);
    });
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(printImages()).toEqual([]);
  });

  it("stops and explains when a page can't be rendered", async () => {
    mockDoc();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<App />);
    await act(() => useDocumentsStore.getState().open("C:\\docs\\print.pdf"));
    act(() => {
      useDialogStore.getState().show("print");
    });
    fireEvent.click(screen.getByRole("radio", { name: "Current page (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    const [img] = printImages();
    if (!img) throw new Error("no print image");
    fireEvent.error(img);
    expect(screen.getByRole("alert").textContent).toBe(
      "Lumora couldn't prepare page 1 for printing. Try again.",
    );
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(printImages()).toEqual([]);
  });

  it("keeps the browser from printing the app on the home screen", () => {
    render(<App />);
    const event = new KeyboardEvent("keydown", { key: "p", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
