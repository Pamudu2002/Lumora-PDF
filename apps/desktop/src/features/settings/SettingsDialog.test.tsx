import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/app/App";
import { useDialogStore } from "@/stores/dialogs";
import { useDocumentsStore } from "@/stores/documents";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/stores/settings";
import { useViewerStore } from "@/stores/viewer";
import { installTauriMocks } from "@/test/tauri";

/** Records save_settings calls; open_document returns a fresh document per path. */
function mockBackend() {
  const saved: string[] = [];
  let nextId = 30;
  installTauriMocks((cmd, args) => {
    if (cmd === "save_settings") saved.push((args as { json: string }).json);
    if (cmd === "open_document") {
      nextId += 1;
      return {
        document: {
          id: nextId,
          path: (args as { path: string }).path,
          fileName: "doc.pdf",
          info: {
            pageCount: 2,
            title: null,
            author: null,
            isEncrypted: false,
            hasForms: false,
            pdfVersion: "1.7",
          },
          pageSizes: [
            { widthPt: 612, heightPt: 792 },
            { widthPt: 612, heightPt: 792 },
          ],
          revision: 0,
        },
        view: { page: 0, zoom: null, zoomMode: null },
      };
    }
    return undefined;
  });
  return saved;
}

afterEach(() => {
  useDialogStore.setState({ open: null });
  useDocumentsStore.setState({ docs: [], activeId: null });
  useSettingsStore.getState().update(DEFAULT_SETTINGS);
  window.__LUMORA_SETTINGS__ = undefined;
});

describe("SettingsDialog", () => {
  it("changes the theme from the home screen and saves the settings", () => {
    const saved = mockBackend();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });

    fireEvent.click(within(dialog).getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");

    const last = JSON.parse(saved[saved.length - 1] ?? "{}") as { state: { theme: string } };
    expect(last.state.theme).toBe("light");
  });

  it("opens new documents with the default zoom and layout", async () => {
    mockBackend();
    render(<App />);
    fireEvent.keyDown(document.body, { key: ",", ctrlKey: true });
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    fireEvent.change(within(dialog).getByLabelText("Zoom for new documents"), {
      target: { value: "150" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Two-page" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "Zoom" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(useSettingsStore.getState()).toMatchObject({
      defaultZoom: "150",
      defaultLayout: "twoPage",
      wheel: "zoom",
    });

    await act(() => useDocumentsStore.getState().open("C:\\docs\\new.pdf"));
    const id = useDocumentsStore.getState().activeId ?? -1;
    expect(useViewerStore.getState().views[id]).toMatchObject({
      zoomMode: "custom",
      zoom: 1.5,
      layout: "twoPage",
    });
  });

  it("starts from the settings the Rust side injected", async () => {
    mockBackend();
    window.__LUMORA_SETTINGS__ = {
      state: { ...DEFAULT_SETTINGS, theme: "dark", pageDarkMode: true },
      version: 1,
    };
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ theme: "dark", pageDarkMode: true });
  });
});
