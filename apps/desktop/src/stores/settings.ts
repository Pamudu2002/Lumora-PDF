import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The UI theme the user picked. "system" follows the OS setting. */
export type ThemePreference = "light" | "dark" | "system";

interface SettingsState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

/** User settings. Persisted to localStorage for now; moves to SQLite (`lumora-store`) in task 1.18. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => {
        set({ theme });
      },
    }),
    { name: "lumora.settings", version: 1 },
  ),
);
