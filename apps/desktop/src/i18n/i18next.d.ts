import "i18next";
import type { Strings } from "./en";

// Typed keys: t("viewer.closeFile") is checked at compile time.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Strings };
  }
}
