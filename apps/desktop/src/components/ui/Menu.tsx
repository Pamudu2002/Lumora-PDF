import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuProps {
  /** The element that opens the menu (rendered as the Radix trigger via `asChild`). */
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

/** A dropdown menu (Radix): keyboard navigable, closes on select or Escape. */
export function Menu({ trigger, children, align = "start", side = "bottom" }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={6}
          className="z-50 min-w-44 rounded-lg border border-line bg-surface-raised p-1 text-body text-ink shadow-popover"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect: () => void;
  /** Shows a check mark (for the current choice). */
  checked?: boolean;
  /** Keyboard shortcut shown on the right. */
  shortcut?: string;
  disabled?: boolean;
}

/** One menu entry. */
export function MenuItem({ children, onSelect, checked, shortcut, disabled }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none select-none",
        "data-highlighted:bg-surface-sunken data-disabled:pointer-events-none data-disabled:opacity-45",
      )}
    >
      <span className="grid size-4 flex-none place-items-center text-brand">
        {checked ? <Check size={16} strokeWidth={1.75} aria-hidden /> : null}
      </span>
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="font-mono text-caption text-ink-muted">{shortcut}</span> : null}
    </DropdownMenu.Item>
  );
}

/** A divider between groups of menu items. */
export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
