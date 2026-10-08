# Toolbar

The main toolbar (`toolbar-h`) with centered tool groups, and the secondary toolbar (`subtoolbar-h`) holding the active group's tools.

- **Provide:** the groups in order — View, Annotate, Organize, Fill & sign, Edit, Protect, Convert — the active group, and the tools for it.
- **Groups:** `lu-group` text tabs; the active one is `brand` on `brand-soft`. All groups are open to everyone — no badges or locks. Arrow keys move between groups.
- **Left:** sidebar toggle and search. **Right:** undo, redo, and the Save button (primary, small).
- **Secondary toolbar:** `IconButton`s, split into clusters with `lu-sep`. The active tool is `is-active`; color tools show a `lu-colorbar`.
- **Narrow windows:** collapse group labels into a "More" menu from the right; never wrap to two lines.
