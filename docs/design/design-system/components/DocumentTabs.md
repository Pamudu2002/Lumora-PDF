# DocumentTabs

The tabs in the title bar, one per open document; the active tab joins the toolbar below it.

- **Provide:** the file name (truncate in the middle so ".pdf" stays visible), dirty state, and close handler. The bar sits on `surface-sunken` at `titlebar-h`.
- **Active tab:** `surface` fill with a `line` outline that opens into the toolbar. Inactive tabs are `ink-muted`; hover lifts them to `surface`.
- **Unsaved:** a 6px `brand` dot before the close button (label it "Unsaved changes" for screen readers).
- **Behavior:** drag to reorder, middle-click to close, Ctrl+W closes, Ctrl+Tab cycles. Closing a dirty tab asks to save.
- The `+` icon button opens a file (Ctrl+O).
