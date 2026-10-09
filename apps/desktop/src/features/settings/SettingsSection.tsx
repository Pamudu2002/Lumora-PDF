import type { ReactNode } from "react";

export interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/** A titled group of settings. */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-body font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}
