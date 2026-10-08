# ZoomBar

The floating pill centered `space-4` above the bottom of the canvas: page position and zoom.

- **Provide:** current page, page count, zoom level and handlers for go-to-page, zoom in/out, presets, fit width/page and rotate view.
- `surface-raised` with `shadow-popover`, `radius-pill`, controls at `control-h-sm`.
- The zoom value opens a menu of presets (50–400%, Fit width, Fit page, Actual size). Ctrl+wheel zooms around the cursor.
- Fades to 60% opacity after 2s without pointer movement over the canvas; full opacity on hover or focus.
