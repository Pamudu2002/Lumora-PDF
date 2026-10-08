Lumora makes Lumora PDF: a fast, private, offline-first PDF reader and editor. The interface is calm and quiet so the document is the brightest thing on screen. Chrome is flat and neutral, one teal (`brand`) marks what is active, and a warm amber glow (`lumen`) is saved for brand moments, tips and what's new. Lumora PDF is free for everyone with every feature, so the interface never shows paid tiers, locks or upsell prompts.

## Content and voice

- Write like a helpful colleague: short, plain, specific. Address the reader as "you"; Lumora never says "we" inside the app.
- Use sentence case everywhere: "Merge files", "Page dark mode", never "Merge Files".
- Label buttons with a verb and its object: "Merge files", "Apply redaction", "Save copy". Avoid "OK" and "Submit"; "Cancel" is fine.
- Name consequences before destructive actions: "Delete 3 pages? You can undo this until you close the file."
- Use digits for numbers ("3 pages", "125%") and an en dash for ranges ("Pages 3–7").
- No exclamation marks, no emoji, no jokes in errors. Errors say what happened and what to do: "This file is damaged. Lumora opened the pages it could read."
- Privacy is a promise, so state it plainly where it matters: "Runs on this device. Your file is not uploaded."
- Show keyboard shortcuts in `mono` inside a `lu-kbd` key: Ctrl+K.
- Never write upsell or pricing copy ("Upgrade", "Pro", "Unlock", "Trial"). Every feature is free; when it helps, say so plainly: "Free, and runs on this device."

## Color

- Chrome surfaces: `surface-sunken` for the title bar and left sidebar, `surface` for the toolbar, right panel and home screen, `surface-raised` for anything that floats (menus, popovers, dialogs, zoom bar). Pages sit on `canvas`.
- Text is `ink`; secondary text and idle icons are `ink-muted`. Both pass 4.5:1 on every surface in both themes.
- `brand` (teal) means "active or primary": the primary button (text in `on-brand`), the active tool group (on `brand-soft`), links, the current-page outline, focus. Use at most one primary button per view.
- `lumen` (amber) is the glow of the brand. Use it as a fill only — the New badge (text `on-lumen`), illustrations, the cover. Tips and What's new notices sit on `lumen-soft` with their lead phrase in `lumen-ink`.
- Status colors (`success`, `warning`, `danger`) always come with an icon or a word; never signal state by color alone. Put their text on `surface` or the matching `-soft` background.
- Dividers are `line` (decorative). Anything a person must find to use — input and checkbox borders, secondary buttons — uses `line-strong` (3:1).
- PDF pages are always `paper` with `shadow-page`. The dark UI theme does not darken pages; Page dark mode is a separate renderer setting that keeps photos natural.

## Annotation palette

- Highlighter colors are `hl-yellow` (default), `hl-green`, `hl-blue`, `hl-pink`, `hl-orange`, `hl-purple`. Draw highlights with multiply blending on the page so text stays readable.
- Pen, shape and text-box colors are `pen-black` (default), `pen-red`, `pen-blue`, `pen-green`.
- These values are written into the PDF, so they do not change with the UI theme. Show them in a swatch row (`ColorPicker`) with the color name as the accessible label.
- Text selection on pages is `text-selection`; find results are `search-hit` and the current one `search-hit-active`.

## Typography

- The interface uses the OS face (`ui` family: Segoe UI Variable on Windows, SF on Apple, system UI on Linux). Default text is `body` (13px); dense controls use `label` (12px); metadata uses `caption` (11px).
- Headings: `title` for panels, `title-lg` for dialogs. Do not go above 20px inside working views.
- `display` and `headline` (Newsreader, serif, SIL OFL) are for brand moments only: home greeting, empty states, onboarding, About, website. Never for buttons, menus or tabs. Bundle the Newsreader font files in the app; the web can load it from Google Fonts.
- File sizes, shortcuts, Bates numbers and field names use `mono`.
- Truncate long file names in the middle ("Annual rep…2026.pdf") so the extension stays visible.

## Layout and spacing

- The desktop frame, top to bottom: title bar with document tabs (`titlebar-h`), main toolbar with tool groups (`toolbar-h`), secondary toolbar for the active group's tools (`subtoolbar-h`), then the workspace.
- Workspace: left sidebar (`sidebar-w`, toggle with the sidebar button) · canvas with pages · right properties panel (`panel-w`, only when something is selected). The floating zoom bar sits centered `space-4` above the bottom of the canvas.
- Tool groups, left to right: View, Annotate, Organize, Fill & sign, Edit, Protect, Convert. Every group and tool is available to everyone; never put badges or locks on tools.
- Space everything on the 4px grid: `space-1`–`space-3` inside toolbars and lists, `space-4`–`space-6` in panels and dialogs, `space-8`+ on the home screen. Pages are `space-4` apart on canvas.
- Controls are `control-h` (32px); compact controls in panels and the zoom bar are `control-h-sm`. On touch (iPad) every hit target grows to 44px.

## Shape, borders and elevation

- Corners: `radius-md` for buttons, inputs, icon buttons, tabs and menu items; `radius-lg` for dialogs, popovers and cards; `radius-sm` for badges and keys; `radius-pill` for the zoom bar, segmented toggles and swatches. PDF pages are square.
- Chrome is flat: separate regions with a 1px `line`, never with shadows.
- Only floating things cast shadows: `shadow-page` (pages, thumbnails), `shadow-popover` (menus, zoom bar, pickers), `shadow-dialog` (modals over `scrim`).

## States and focus

- Hover: ghost controls fill with `surface-sunken`; primary buttons move to `brand-hover`.
- Selected/on: `selected` fill with `brand` icon or text (toggle buttons, list rows, the active tool).
- Focus: a 2px solid `focus` outline with a 2px offset on every focusable control, shown on keyboard focus only (`:focus-visible`).
- Disabled: 45% opacity, no hover, and a tooltip that says why when the reason isn't obvious ("Select a page first").
- Unsaved document: a 6px `brand` dot before the tab's close button; the window title also gets "•".

## Iconography

- Use lucide-react (ISC license) for all UI icons: 18px (`icon-md`) in toolbars, 16px (`icon-sm`) in buttons, menus and lists, stroke width 1.75, color `currentColor`.
- Idle toolbar icons are `ink-muted`; hovered `ink`; active `brand` on `selected`.
- Every icon-only button has a tooltip with the action and its shortcut ("Highlight  H") and an `aria-label`.
- No emoji, no filled or multicolor icons in the UI. Annotation tool icons may show the current color as a 3px bar under the glyph.

## Motion

- Keep motion short and functional: 120ms ease-out for hover and press, 180ms for panels and popovers, 240ms for dialogs. Never animate page rendering or scrolling.
- With "reduce motion" on, swap movement for an instant change or a fade.

## Logo

Lumora has no logo mark yet. Until one exists, set the name "Lumora" in `display` (Newsreader 500) in `ink`, or "Lumora PDF" with "PDF" in `ink-muted`. Do not invent a mark in product screens.

## Accessibility

- Every text pairing above is at least 4.5:1 in both themes; borders, focus rings and meaningful icons at least 3:1.
- Everything works by keyboard: tool groups with arrow keys, tools with their letter shortcuts, Ctrl+K for every command.
- Respect the OS text size and high-contrast settings; never put text in images.
