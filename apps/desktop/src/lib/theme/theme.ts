import type { ThemePreference } from "@/stores/settings";

/** The theme actually applied to the UI. */
export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Resolves a preference to a concrete theme, using the OS setting for "system". */
export function resolveTheme(preference: ThemePreference, osPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return osPrefersDark ? "dark" : "light";
  }
  return preference;
}

/** True when the OS asks for a dark theme. */
export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/** Calls `onChange` whenever the OS theme changes. Returns an unsubscribe function. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/** Applies a theme by setting `data-theme` on the root element. */
export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme;
}
