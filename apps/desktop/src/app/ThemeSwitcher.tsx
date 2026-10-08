import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useSettingsStore, type ThemePreference } from "@/stores/settings";

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Light / Dark / System theme picker. Moves into Settings in task 1.18. */
export function ThemeSwitcher() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  return (
    <SegmentedControl
      label="Theme"
      value={theme}
      options={THEME_OPTIONS}
      onValueChange={setTheme}
    />
  );
}
