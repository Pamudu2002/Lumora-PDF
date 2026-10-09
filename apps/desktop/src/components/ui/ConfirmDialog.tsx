import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in a sentence or two. */
  children: ReactNode;
  /** Verb + object, e.g. "Open link". Omit for a dialog that only informs. */
  confirmLabel?: string;
  cancelLabel: string;
  onConfirm?: () => void;
  /** Called when the dialog closes without confirming (Cancel, Esc). */
  onCancel: () => void;
}

/** A modal question with Cancel and one confirming action. Focus starts on Cancel. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-line bg-surface-raised p-5 text-ink shadow-dialog">
          <AlertDialog.Title className="m-0 text-title font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-body text-ink-muted">{children}</div>
          </AlertDialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant={confirmLabel ? "secondary" : "primary"}>{cancelLabel}</Button>
            </AlertDialog.Cancel>
            {confirmLabel ? (
              <AlertDialog.Action asChild>
                <Button variant="primary" onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </AlertDialog.Action>
            ) : null}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
