import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDocumentsStore } from "@/stores/documents";
import { installTauriMocks } from "@/test/tauri";
import { App } from "./App";

const PATH = "C:\\docs\\secret.pdf";

/** open_document needs the password "1234"; records every password tried. */
function mockProtectedFile() {
  const tried: (string | null)[] = [];
  installTauriMocks((cmd, args) => {
    if (cmd !== "open_document") return undefined;
    const { password } = args as { password: string | null };
    tried.push(password);
    if (password === null) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { kind: "passwordRequired", detail: "password required" };
    }
    if (password !== "1234") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { kind: "wrongPassword", detail: "wrong password" };
    }
    return {
      document: {
        id: 21,
        path: PATH,
        fileName: "secret.pdf",
        info: {
          pageCount: 1,
          title: null,
          author: null,
          isEncrypted: true,
          hasForms: false,
          pdfVersion: "1.7",
        },
        pageSizes: [{ widthPt: 612, heightPt: 792 }],
        revision: 0,
      },
      view: { page: 0, zoom: null, zoomMode: null },
    };
  });
  return tried;
}

afterEach(() => {
  useDocumentsStore.setState({ docs: [], activeId: null, passwordPrompt: null, failure: null });
});

describe("PasswordDialog", () => {
  it("asks for the password, says when it is wrong, and opens with the right one", async () => {
    const tried = mockProtectedFile();
    render(<App />);
    await act(() => useDocumentsStore.getState().open(PATH));

    expect(screen.getByRole("alertdialog", { name: "Enter the password" })).toBeDefined();
    expect(
      screen.getByText("secret.pdf is protected. Enter its password to open it."),
    ).toBeDefined();
    // No error notice for a file that simply needs a password.
    expect(screen.queryByText(/protected with a password/)).toBeNull();

    const field = () => screen.getByLabelText("Password");
    fireEvent.change(field(), { target: { value: "nope" } });
    await act(async () => {
      fireEvent.submit(field().closest("form") as HTMLFormElement);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "That password is incorrect. Check it and try again.",
      );
    });
    expect((field() as HTMLInputElement).value).toBe("");
    expect(field().getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(field(), { target: { value: "1234" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open file" }));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(useDocumentsStore.getState().activeId).toBe(21);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(tried).toEqual([null, "nope", "1234"]);
  });

  it("closes without opening when cancelled", async () => {
    mockProtectedFile();
    render(<App />);
    await act(() => useDocumentsStore.getState().open(PATH));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(useDocumentsStore.getState().docs).toEqual([]);
  });
});
