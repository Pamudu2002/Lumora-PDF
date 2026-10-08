# IconButton

A square, icon-only control for tools in toolbars, panels and the zoom bar.

- **Provide:** one lucide icon at `icon-md` (18px) — `icon-sm` in the `--sm` size — an `aria-label`, and a tooltip with the action and its shortcut ("Highlight  H").
- **States:** idle `ink-muted` · hover `surface-sunken` fill, `ink` · `is-active` (the current tool, or a toggle that is on) `selected` fill with `brand` icon · disabled 45%.
- **Annotation tools:** add `lu-colorbar` (3px) under the glyph in the tool's current color (`hl-*` or `pen-*`).
- **Don't:** use icon buttons for actions people can't recognize from the glyph alone — use a `Button` with a label instead.
