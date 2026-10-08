import { CircleAlert, CircleCheck, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "success" | "warning" | "danger" | "tip";

export interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  /** Optional action (a small Button) shown at the end. */
  action?: ReactNode;
  className?: string;
}

const toneStyles: Record<NoticeTone, { box: string; icon: string }> = {
  info: { box: "bg-brand-soft", icon: "text-brand" },
  success: { box: "bg-success-soft", icon: "text-success" },
  warning: { box: "bg-warning-soft", icon: "text-warning" },
  danger: { box: "bg-danger-soft", icon: "text-danger" },
  tip: { box: "bg-lumen-soft", icon: "text-lumen-ink" },
};

const toneIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  tip: Lightbulb,
};

/** An inline message bar that says what happened and what to do. */
export function Notice({ tone = "info", children, action, className }: NoticeProps) {
  const Icon = toneIcons[tone];
  const styles = toneStyles[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-body text-ink",
        styles.box,
        className,
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden className={cn("flex-none", styles.icon)} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
