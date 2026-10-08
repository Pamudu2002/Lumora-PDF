import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
import { applyTheme, resolveTheme, systemPrefersDark, watchSystemTheme } from "./theme";

/** Keeps `data-theme` on <html> in sync with the theme setting and, for "system", with the OS. */
export function useApplyTheme() {
  const preference = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const update = () => {
      applyTheme(resolveTheme(preference, systemPrefersDark()));
    };
    update();
    if (preference !== "system") {
      return undefined;
    }
    return watchSystemTheme(update);
  }, [preference]);
}
