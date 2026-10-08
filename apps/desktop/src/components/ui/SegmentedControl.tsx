import * as ToggleGroup from "@radix-ui/react-toggle-group";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group, e.g. "Theme". */
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (value: T) => void;
}

/** A small single-choice toggle (Radix ToggleGroup). */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next);
        if (option) onValueChange(option.value);
      }}
      className="inline-flex gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5"
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="h-[26px] cursor-pointer rounded-sm border-0 bg-transparent px-2.5 text-label text-ink-muted data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-[0_0_0_1px_var(--line)]"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
