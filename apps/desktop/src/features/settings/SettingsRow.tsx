import type { ReactNode } from "react";

export interface SettingsRowProps {
  label: string;
  hint?: string;
  /** The id of the control, when it is a native field. */
  htmlFor?: string;
  children: ReactNode;
}

/** One setting: its label (and hint) on the left, the control on the right. */
export function SettingsRow({ label, hint, htmlFor, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex min-w-0 flex-col">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-body text-ink">
            {label}
          </label>
        ) : (
          <span className="text-body text-ink">{label}</span>
        )}
        {hint ? <span className="text-label text-ink-muted">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
