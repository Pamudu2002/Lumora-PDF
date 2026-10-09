import { useTranslation } from "react-i18next";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useSettingsStore, type ThemePreference } from "@/stores/settings";

/** Light / Dark / System theme picker. */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const options: { value: ThemePreference; label: string }[] = [
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
    { value: "system", label: t("theme.system") },
  ];
  return (
    <SegmentedControl
      label={t("theme.label")}
      value={theme}
      options={options}
      onValueChange={setTheme}
    />
  );
}
