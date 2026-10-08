import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the child element instead of a <button> (Radix Slot). */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand border-brand text-on-brand hover:bg-brand-hover hover:border-brand-hover",
  secondary: "bg-surface border-line-strong text-ink hover:bg-surface-sunken",
  ghost: "bg-transparent border-transparent text-ink hover:bg-surface-sunken",
  danger: "bg-surface border-danger text-danger hover:bg-danger-soft",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-control px-3 text-body",
  sm: "h-control-sm px-2.5 text-label",
};

/** A labelled action. Use one primary button per view. Label it with a verb + object. */
export function Button({
  variant = "secondary",
  size = "md",
  asChild = false,
  className,
  type,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap transition-colors duration-[120ms] ease-out",
        "disabled:pointer-events-none disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
