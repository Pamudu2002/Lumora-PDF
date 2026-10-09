import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/newsreader/latin-500.css";
import "@/styles/index.css";
import "@/i18n";
import { App } from "@/app/App";
import { applyTheme, resolveTheme, systemPrefersDark } from "@/lib/theme/theme";
import { useSettingsStore } from "@/stores/settings";

// Apply the saved theme before the first paint to avoid a flash of the wrong theme.
applyTheme(resolveTheme(useSettingsStore.getState().theme, systemPrefersDark()));

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
