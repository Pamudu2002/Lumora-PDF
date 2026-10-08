# SearchField

The find bar (Ctrl+F), floating at the top-right of the canvas on `surface-raised`.

- **Provide:** the query, result position and total ("3 of 14"), match-case and whole-word toggles, previous/next and close handlers.
- Input uses `line-strong` border and a `search` icon in `ink-muted`; the count uses tabular figures.
- Enter = next, Shift+Enter = previous, Esc closes and returns focus to the page.
- Results are drawn on pages with `search-hit`; the current one with `search-hit-active`. The full list also appears in the sidebar's Search tab.
- When nothing matches, say "No results" in place of the count — not an error color.
