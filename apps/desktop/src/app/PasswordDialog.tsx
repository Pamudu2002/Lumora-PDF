import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useDocumentsStore } from "@/stores/documents";
import { PasswordForm } from "./PasswordForm";

/** Asks for the password of a protected PDF, and again after a wrong one. */
export function PasswordDialog() {
  const prompt = useDocumentsStore((s) => s.passwordPrompt);
  const cancel = useDocumentsStore((s) => s.cancelPassword);

  return (
    <AlertDialog.Root
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        {/* Keyed so each file (and each retry) starts with an empty field. */}
        {prompt ? (
          <PasswordForm
            key={`${prompt.path}|${String(prompt.wrong)}`}
            fileName={prompt.fileName}
            wrong={prompt.wrong}
          />
        ) : null}
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
