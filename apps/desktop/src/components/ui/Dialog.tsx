import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title, read out when the dialog opens. */
  description?: string;
  children: ReactNode;
  /** Buttons, right-aligned at the bottom. */
  footer?: ReactNode;
  /** Wider dialogs hold tables or settings. */
  size?: "md" | "lg";
}

/** A modal dialog with a title, a close button, content and an optional footer. Esc closes it. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: DialogProps) {
  const { t } = useTranslation();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RadixDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-64px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-line bg-surface-raised text-ink shadow-dialog",
            size === "md" ? "w-[min(440px,calc(100vw-32px))]" : "w-[min(640px,calc(100vw-32px))]",
          )}
          // Without a description, tell Radix there is none (it warns otherwise).
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex flex-col gap-1 pt-4 pr-14 pl-5">
            <RadixDialog.Title className="m-0 text-title font-semibold">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="m-0 text-body text-ink-muted">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          ) : null}
          {/* Last in tab order (so focus starts on the content), drawn at the top right. */}
          <RadixDialog.Close asChild>
            <IconButton
              size="sm"
              className="absolute top-3 right-3"
              label={t("dialog.close")}
              shortcut="Esc"
              icon={<X size={16} strokeWidth={1.75} />}
            />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
