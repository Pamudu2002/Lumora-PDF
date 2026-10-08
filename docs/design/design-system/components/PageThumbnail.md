# PageThumbnail

A small rendered page in the sidebar or the organize grid.

- **Provide:** the rendered page image (from the tile cache at `thumb-w`), the page label, and whether it is the current or a selected page.
- Pages are `paper` with `shadow-page` on `surface-sunken` (sidebar) or `canvas` (organize).
- **Current page:** 2px `brand` outline with 3px offset, and the number in a `selected` chip.
- **Organize mode:** multi-select with click, Shift and Ctrl; selected pages use the same outline; drag shows an insertion line in `brand`.
- Show the page label from the PDF if it has one ("iv"), else the number.
