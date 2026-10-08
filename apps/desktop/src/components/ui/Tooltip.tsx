import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export interface TooltipProps {
  /** The action, e.g. "Zoom in". */
  label: string;
  /** Optional keyboard shortcut shown after the label, e.g. "Ctrl+=". */
  shortcut?: string | undefined;
  children: ReactNode;
}

/** A tooltip with an action name and its shortcut. Needs a `TooltipProvider` above it. */
export function Tooltip({ label, shortcut, children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 flex items-center gap-2 rounded-md border border-line bg-surface-raised px-2 py-1 text-label text-ink shadow-popover"
        >
          {label}
          {shortcut ? (
            <span className="font-mono text-caption text-ink-muted">{shortcut}</span>
          ) : null}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
