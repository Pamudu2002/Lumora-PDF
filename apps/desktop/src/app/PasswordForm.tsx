import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { useDocumentsStore } from "@/stores/documents";

export interface PasswordFormProps {
  fileName: string;
  wrong: boolean;
}

/** The password dialog's content (inside {@link PasswordDialog}'s Radix root). */
export function PasswordForm({ fileName, wrong }: PasswordFormProps) {
  const { t } = useTranslation();
  const submit = useDocumentsStore((s) => s.submitPassword);
  const opening = useDocumentsStore((s) => s.opening);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Focus the field when the form appears, including after a wrong password.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <AlertDialog.Content
      className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface-raised p-5 text-ink shadow-dialog"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
      }}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (password === "") return;
          const attempt = password;
          setPassword("");
          void submit(attempt);
        }}
      >
        <AlertDialog.Title className="m-0 text-title font-semibold">
          {t("password.title")}
        </AlertDialog.Title>
        <AlertDialog.Description className="m-0 text-body text-ink-muted">
          {t("password.body", { name: fileName })}
        </AlertDialog.Description>
        <label htmlFor={id} className="text-label font-medium text-ink">
          {t("password.label")}
        </label>
        <div
          className={cn(
            "flex h-control items-center rounded-md border bg-surface pr-1 pl-3",
            wrong ? "border-danger" : "border-line-strong focus-within:border-focus",
          )}
        >
          <input
            ref={inputRef}
            id={id}
            type={visible ? "text" : "password"}
            value={password}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={wrong}
            aria-describedby={wrong ? `${id}-error` : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ink outline-none"
            onChange={(e) => {
              setPassword(e.target.value);
            }}
          />
          <IconButton
            size="sm"
            label={t("password.show")}
            active={visible}
            icon={
              visible ? (
                <EyeOff size={16} strokeWidth={1.75} />
              ) : (
                <Eye size={16} strokeWidth={1.75} />
              )
            }
            onClick={() => {
              setVisible(!visible);
            }}
          />
        </div>
        {wrong ? (
          <p id={`${id}-error`} role="alert" className="m-0 text-label text-danger">
            {t("errors.wrongPassword")}
          </p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <AlertDialog.Cancel asChild>
            <Button>{t("password.cancel")}</Button>
          </AlertDialog.Cancel>
          <Button type="submit" variant="primary" disabled={password === "" || opening}>
            {t("password.submit")}
          </Button>
        </div>
      </form>
    </AlertDialog.Content>
  );
}
