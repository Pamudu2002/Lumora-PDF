import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
import { i18n } from "./index";

/** Switches the UI strings to the language chosen in Settings. */
export function useApplyLanguage() {
  const language = useSettingsStore((s) => s.language);
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);
}
