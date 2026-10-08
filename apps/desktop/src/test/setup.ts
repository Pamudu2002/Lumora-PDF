import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { installTauriMocks } from "./tauri";

// Tests run outside Tauri. Mocks stay installed after each test (unmount handlers may still call
// into Tauri asynchronously) and are reset before the next one.
beforeEach(() => {
  installTauriMocks();
});

afterEach(() => {
  cleanup();
});
