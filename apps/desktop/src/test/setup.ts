import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { installTauriMocks } from "./tauri";
import "@/i18n";

// jsdom has no layout: give elements a desktop-sized viewport and a no-op ResizeObserver.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = NoopResizeObserver;
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get: () => 1200,
});
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get: () => 800,
});

// jsdom ignores scroll offsets; keep what code sets so scroll-driven logic can be tested.
for (const prop of ["scrollTop", "scrollLeft"] as const) {
  const values = new WeakMap<Element, number>();
  Object.defineProperty(Element.prototype, prop, {
    configurable: true,
    get(this: Element) {
      return values.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      values.set(this, Math.max(0, value));
    },
  });
}

// Tests run outside Tauri. Mocks stay installed after each test (unmount handlers may still call
// into Tauri asynchronously) and are reset before the next one.
beforeEach(() => {
  installTauriMocks();
});

afterEach(() => {
  cleanup();
});
