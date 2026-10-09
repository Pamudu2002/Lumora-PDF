import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The UI theme the user picked. "system" follows the OS setting. */
export type ThemePreference = "light" | "dark" | "system";

interface SettingsState {
  theme: ThemePreference;
  /** Page dark mode: the renderer shows pages light-on-dark (images keep their colours). */
  pageDarkMode: boolean;
  setTheme: (theme: ThemePreference) => void;
  setPageDarkMode: (on: boolean) => void;
}

/** User settings. Persisted to localStorage for now; moves to SQLite (`lumora-store`) in task 1.18. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      pageDarkMode: false,
      setTheme: (theme) => {
        set({ theme });
      },
      setPageDarkMode: (on) => {
        set({ pageDarkMode: on });
      },
    }),
    { name: "lumora.settings", version: 1 },
  ),
);
