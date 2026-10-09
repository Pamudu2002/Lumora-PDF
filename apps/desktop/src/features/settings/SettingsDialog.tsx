import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { LayoutMode } from "@/features/viewer/layout";
import { useDialogStore } from "@/stores/dialogs";
import {
  useSettingsStore,
  type DefaultZoom,
  type Language,
  type ThemePreference,
  type WheelAction,
} from "@/stores/settings";
import { SettingsRow as Row } from "./SettingsRow";
import { SettingsSection as Section } from "./SettingsSection";

const ZOOM_CHOICES: readonly DefaultZoom[] = [
  "auto",
  "fitWidth",
  "fitPage",
  "50",
  "75",
  "100",
  "125",
  "150",
  "200",
];

/** Settings: appearance, how documents open and scroll, and language (Ctrl+,). */
export function SettingsDialog() {
  const { t } = useTranslation();
  const open = useDialogStore((s) => s.open === "settings");
  const hide = useDialogStore((s) => s.hide);
  const settings = useSettingsStore();
  const update = useSettingsStore((s) => s.update);
  const id = useId();

  const zoomLabel = (zoom: DefaultZoom) =>
    zoom === "auto"
      ? t("settings.zoomAuto")
      : zoom === "fitWidth"
        ? t("zoom.fitWidth")
        : zoom === "fitPage"
          ? t("zoom.fitPage")
          : t("zoom.percent", { percent: Number(zoom) });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) hide();
      }}
      title={t("settings.title")}
      description={t("settings.description")}
      size="lg"
      footer={
        <Button variant="primary" onClick={hide}>
          {t("settings.done")}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <Section title={t("settings.appearance")}>
          <Row label={t("theme.label")}>
            <SegmentedControl<ThemePreference>
              label={t("theme.label")}
              value={settings.theme}
              options={[
                { value: "light", label: t("theme.light") },
                { value: "dark", label: t("theme.dark") },
                { value: "system", label: t("theme.system") },
              ]}
              onValueChange={(theme) => {
                update({ theme });
              }}
            />
          </Row>
          <Row label={t("viewTools.pageDarkMode")} hint={t("settings.pageDarkModeHint")}>
            <input
              type="checkbox"
              aria-label={t("viewTools.pageDarkMode")}
              checked={settings.pageDarkMode}
              className="size-4 accent-brand"
              onChange={(e) => {
                update({ pageDarkMode: e.target.checked });
              }}
            />
          </Row>
        </Section>

        <Section title={t("settings.viewing")}>
          <Row label={t("settings.defaultZoom")} htmlFor={`${id}-zoom`}>
            <select
              id={`${id}-zoom`}
              value={settings.defaultZoom}
              className="h-control-sm rounded-md border border-line-strong bg-surface px-2 text-body text-ink outline-none focus:border-focus"
              onChange={(e) => {
                const zoom = ZOOM_CHOICES.find((z) => z === e.target.value);
                if (zoom) update({ defaultZoom: zoom });
              }}
            >
              {ZOOM_CHOICES.map((zoom) => (
                <option key={zoom} value={zoom}>
                  {zoomLabel(zoom)}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t("settings.defaultLayout")}>
            <SegmentedControl<LayoutMode>
              label={t("settings.defaultLayout")}
              value={settings.defaultLayout}
              options={[
                { value: "single", label: t("viewTools.single") },
                { value: "continuous", label: t("viewTools.continuous") },
                { value: "twoPage", label: t("viewTools.twoPage") },
              ]}
              onValueChange={(defaultLayout) => {
                update({ defaultLayout });
              }}
            />
          </Row>
          <Row label={t("settings.wheel")} hint={t("settings.wheelHint")}>
            <SegmentedControl<WheelAction>
              label={t("settings.wheel")}
              value={settings.wheel}
              options={[
                { value: "scroll", label: t("settings.wheelScroll") },
                { value: "zoom", label: t("settings.wheelZoom") },
              ]}
              onValueChange={(wheel) => {
                update({ wheel });
              }}
            />
          </Row>
        </Section>

        <Section title={t("settings.language")}>
          <Row label={t("settings.language")} htmlFor={`${id}-language`}>
            <select
              id={`${id}-language`}
              value={settings.language}
              className="h-control-sm rounded-md border border-line-strong bg-surface px-2 text-body text-ink outline-none focus:border-focus"
              onChange={(e) => {
                if (e.target.value === "en")
                  update({ language: e.target.value satisfies Language });
              }}
            >
              <option value="en">{t("settings.english")}</option>
            </select>
          </Row>
        </Section>
      </div>
    </Dialog>
  );
}
