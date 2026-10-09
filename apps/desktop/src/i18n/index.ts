import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";

// English only for now (plan task 1.18). Adding a language = a new strings file with the same keys.
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export { i18n };
