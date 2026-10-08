# Button

A labelled action; use one primary button per view for the main next step.

- **Provide:** a short verb + object label ("Merge files", "Save copy"), optional leading icon (`icon-sm`), and the variant.
- **Variants:** `lu-btn--primary` (one per view, `brand` fill, `on-brand` text) · default secondary (`line-strong` border) · `lu-btn--ghost` for low-emphasis actions in toolbars and panels · `lu-btn--danger` for destructive actions, always followed by a confirm or undo.
- **Sizes:** default `control-h` (32px); `lu-btn--sm` (28px) in panels, comments and the zoom bar.
- **Do:** put the primary button last (right) in dialog footers; show a disabled button's reason in a tooltip.
- **Don't:** use "OK"; put two primary buttons side by side; use `lumen` for buttons (it is not an action color).
