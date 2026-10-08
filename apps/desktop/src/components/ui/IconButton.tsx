import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name and tooltip text, e.g. "Zoom in". */
  label: string;
  /** Shortcut shown in the tooltip, e.g. "Ctrl+=". */
  shortcut?: string;
  /** A lucide icon element (18 px in toolbars, 16 px for size "sm"). */
  icon: ReactNode;
  /** The current tool, or a toggle that is on. */
  active?: boolean;
  size?: "md" | "sm";
  ref?: Ref<HTMLButtonElement>;
}

/** A square, icon-only control with an aria-label and a tooltip. */
export function IconButton({
  label,
  shortcut,
  icon,
  active = false,
  size = "md",
  className,
  ref,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active || undefined}
        className={cn(
          "inline-grid flex-none cursor-pointer place-items-center rounded-md border-0 p-0 transition-colors duration-[120ms] ease-out",
          "disabled:pointer-events-none disabled:opacity-45",
          size === "md" ? "size-control" : "size-control-sm",
          active
            ? "bg-selected text-brand"
            : "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
