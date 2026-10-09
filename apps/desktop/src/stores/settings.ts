import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { LayoutMode } from "@/features/viewer/layout";
import { saveSettings } from "@/lib/ipc";

/** The UI theme the user picked. "system" follows the OS setting. */
export type ThemePreference = "light" | "dark" | "system";
/** Zoom for documents opened for the first time: a fit mode or a percentage. */
export type DefaultZoom =
  "auto" | "fitWidth" | "fitPage" | "50" | "75" | "100" | "125" | "150" | "200";
/** What the mouse wheel does without Ctrl. */
export type WheelAction = "scroll" | "zoom";
/** UI languages. English only for now; adding one = a strings file plus an entry here. */
export type Language = "en";

export interface Settings {
  theme: ThemePreference;
  /** Page dark mode: the renderer shows pages light-on-dark (images keep their colours). */
  pageDarkMode: boolean;
  defaultZoom: DefaultZoom;
  defaultLayout: LayoutMode;
  wheel: WheelAction;
  language: Language;
}

interface SettingsState extends Settings {
  setTheme: (theme: ThemePreference) => void;
  setPageDarkMode: (on: boolean) => void;
  /** Changes any settings at once. */
  update: (patch: Partial<Settings>) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  pageDarkMode: false,
  defaultZoom: "auto",
  defaultLayout: "continuous",
  wheel: "scroll",
  language: "en",
};

declare global {
  interface Window {
    /** Saved settings, injected by the Rust side before the page loads (null if none). */
    __LUMORA_SETTINGS__?: unknown;
  }
}

/**
 * Settings live in the local database. Rust injects them before the page loads, so reading is
 * synchronous; writes go back through `save_settings`. localStorage is a fallback for when the
 * database is unavailable (and holds settings from before they moved to the database).
 */
const settingsStorage: StateStorage = {
  getItem: (name) => {
    const injected = window.__LUMORA_SETTINGS__;
    if (injected && typeof injected === "object") return JSON.stringify(injected);
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Storage may be unavailable; the database copy still saves.
    }
    void saveSettings(value).catch(() => undefined);
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to remove.
    }
  },
};

/** User settings, saved in the local database. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => {
        set({ theme });
      },
      setPageDarkMode: (on) => {
        set({ pageDarkMode: on });
      },
      update: (patch) => {
        set(patch);
      },
    }),
    {
      name: "lumora.settings",
      version: 1,
      storage: createJSONStorage(() => settingsStorage),
      partialize: (s): Settings => ({
        theme: s.theme,
        pageDarkMode: s.pageDarkMode,
        defaultZoom: s.defaultZoom,
        defaultLayout: s.defaultLayout,
        wheel: s.wheel,
        language: s.language,
      }),
    },
  ),
);
