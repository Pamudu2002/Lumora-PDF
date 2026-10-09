import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageLink } from "@/lib/ipc";
import { useLinkPromptStore } from "@/stores/linkPrompt";
import { useViewerStore } from "@/stores/viewer";
import { installTauriMocks } from "@/test/tauri";
import { ExternalLinkDialog } from "./ExternalLinkDialog";
import { LinkLayer } from "./LinkLayer";

const rect = { x: 10, y: 20, width: 30, height: 10 };
const links: PageLink[] = [
  { rect, target: { kind: "page", page: 4 } },
  { rect, target: { kind: "uri", uri: "https://lumora.app/help" } },
  { rect, target: { kind: "uri", uri: "file:///C:/Windows/notepad.exe" } },
];

describe("LinkLayer", () => {
  let opened: unknown[] = [];

  beforeEach(() => {
    opened = [];
    useLinkPromptStore.setState({ url: null });
    installTauriMocks((cmd, args) => {
      if (cmd === "get_page_links") return links;
      if (cmd === "open_external_link") opened.push((args as { url: string }).url);
      return undefined;
    });
  });

  function renderPage() {
    render(
      <>
        <LinkLayer docId={1} page={0} revision={0} scale={2} />
        <ExternalLinkDialog />
      </>,
    );
  }

  it("goes to the target page of internal links", async () => {
    renderPage();
    const link = await screen.findByRole("button", { name: "Go to page 5" });
    expect(link.style.left).toBe("20px");
    expect(link.style.width).toBe("60px");
    fireEvent.click(link);
    expect(useViewerStore.getState().scrollRequest).toMatchObject({ docId: 1, page: 4 });
  });

  it("opens web links only after the user confirms", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open https://lumora.app/help" }));
    expect(screen.getByRole("alertdialog", { name: "Open this link?" })).toBeDefined();
    expect(opened).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Open link" }));
    await vi.waitFor(() => {
      expect(opened).toEqual(["https://lumora.app/help"]);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("doesn't open a link when the user cancels", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open https://lumora.app/help" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(opened).toEqual([]);
  });

  it("refuses links that aren't web or email addresses", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Open file:///C:/Windows/notepad.exe" }),
    );
    expect(screen.getByRole("alertdialog", { name: "Lumora can't open this link" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Open link" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(opened).toEqual([]);
  });
});
