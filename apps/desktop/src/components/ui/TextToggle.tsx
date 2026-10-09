import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

export interface TextToggleProps {
  /** Accessible name and tooltip text, e.g. "Match case". */
  label: string;
  pressed: boolean;
  onToggle: () => void;
  /** Short visible text, e.g. "Aa". */
  children: ReactNode;
}

/** A small on/off button showing a short text glyph, such as a find option. */
export function TextToggle({ label, pressed, onToggle, children }: TextToggleProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "grid size-control-sm flex-none cursor-pointer place-items-center rounded-md border-0 text-label font-semibold transition-colors duration-[120ms] ease-out",
          pressed
            ? "bg-selected text-brand"
            : "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
        )}
        onClick={onToggle}
      >
        {children}
      </button>
    </Tooltip>
  );
}
