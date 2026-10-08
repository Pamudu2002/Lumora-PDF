# ColorPicker

A row of round swatches for an annotation tool's color, opened from the tool or shown in the properties panel.

- **Provide:** the palette (`hl-*` for highlighters, `pen-*` for ink, shapes and text), the selected color, and a change handler. Later: a "+" swatch for a custom color.
- It is a radio group: arrow keys move, each swatch has the color name as its label.
- Selected swatch: 2px gap in `surface-raised`, then a 2px `focus` ring.
- Annotation colors are written into the PDF and do not change with the UI theme.
