import { describe, expect, it } from "vitest";
import { applyTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("returns an explicit choice unchanged", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("applyTheme", () => {
  it("sets data-theme on the root element", () => {
    const root = document.createElement("html");
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
  });
});
