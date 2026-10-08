import type { ReactNode } from "react";

/** A keyboard shortcut key, e.g. <Kbd>Ctrl+O</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-b-2 border-line bg-surface px-[5px] font-mono text-caption text-ink-muted">
      {children}
    </kbd>
  );
}
