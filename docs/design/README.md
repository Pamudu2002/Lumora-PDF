# Lumora PDF — design handoff

> **For Claude Code:** this folder is the visual source of truth for the Lumora PDF UI.
> Build the React UI in `apps/desktop/src` to match these screens. Read this file first,
> then `design-system/brand-book.md`, then the screen you are working on (HTML + PNG).

## What's in here

| Path | What it is | How to use it |
|---|---|---|
| `screenshots/*.png` | Rendered 1440×900 images of each screen | The target look. Compare your build against these. |
| `screens/*.html` | Static HTML mockups of each screen (open in a browser) | Exact structure, spacing, copy, ARIA labels and icon SVGs. **Reference only — do not ship this HTML.** Rebuild it as React components. |
| `lumora.css` | All design tokens (CSS variables, light + dark) and the `lu-*` component classes used by the mockups | Copy the token block into `apps/desktop/src/styles/tokens.css`. Port the `lu-*` rules into components (Tailwind classes or CSS modules). |
| `design-system/tokens.json` | The same tokens as data, with a usage note for each | Source for the Tailwind theme config. |
| `design-system/brand-book.md` | Voice, color rules, type, layout, states, icons, motion, accessibility | Follow these rules for anything the screens don't show. |
| `design-system/components/*.md` | Guidelines per component (props, states, do/don't) | One React component per file. |

## Screens

| # | Screen | Files | Shows |
|---|---|---|---|
| 1 | Home | `01-home.*` | Greeting, drop zone, quick tools, recent files, library search |
| 2 | Viewer | `02-viewer.*` | Tabs, toolbar groups, View tools, thumbnails sidebar, page, find bar, zoom bar, status bar |
| 3 | Annotate | `03-annotate.*` | Annotate tools, comments sidebar, highlights/underline/note/ink on the page, selection popover, properties panel |
| 4 | Organize pages | `04-organize.*` | Page grid with multi-select, drop indicator, floating selection bar |
| 5 | Fill & sign | `05-fill-and-sign.*` | Form fields, focused field, placed signature, saved signatures panel, digital ID tip |
| 6 | Viewer, dark theme | `06-viewer-dark.*` | Same as 2 with `data-theme="dark"`; pages stay white |

## Component map (build these in `src/components/ui/` and `src/features/*`)

| Mockup class | React component | Notes |
|---|---|---|
| `lu-titlebar`, `lu-tab`, `lu-winctl` | `TitleBar`, `DocumentTab` | Custom title bar (Tauri `decorations: false`) once native works |
| `lu-toolbar`, `lu-groups`, `lu-group`, `lu-subtoolbar` | `Toolbar`, `ToolGroupTabs`, `SubToolbar` | Groups: View, Annotate, Organize, Fill & sign, Edit, Protect, Convert |
| `lu-btn` (+ `--primary`, `--ghost`, `--danger`, `--sm`) | `Button` | Radix Slot for `asChild` |
| `lu-iconbtn` (+ `is-active`, `lu-colorbar`) | `IconButton` | Always `aria-label` + Radix Tooltip with shortcut |
| `lu-badge` (+ tones) | `Badge` | `--new` only for features new in the latest release |
| `lu-notice` (+ tones) | `Notice` | Tones: info, success, warning, danger, tip |
| `lu-search` | `FindBar` | Ctrl+F; Enter / Shift+Enter |
| `lu-swatches`, `lu-swatch` | `ColorPicker` | Radix RadioGroup |
| `lu-seg` | `SegmentedControl` | Radix ToggleGroup |
| `lu-thumb` | `PageThumbnail` | Image comes from the `lumora://` thumbnail endpoint |
| `lu-zoombar` | `ZoomBar` | Floating, centered 16px above canvas bottom |
| `sidebar`, `panel`, `stage`, `statusbar` | `Sidebar`, `PropertiesPanel`, `Canvas`, `StatusBar` | Layout in `app/` |
| `lu-comment` | `CommentCard` | In the Comments sidebar tab |
| `.page` + `.mark*` | — | **Mock only.** Real pages are PDFium-rendered tiles; highlights are real PDF annotations. |

## Rules

- Use the tokens (`var(--brand)` etc.), never raw hex values in components. The only hex values in the mockups are inside `.page` mock content.
- Icons in the mockups are hand-drawn placeholders. In the app use **lucide-react** at 18px (toolbars) / 16px (buttons, menus), stroke 1.75.
- Fonts: interface = OS font (Segoe UI Variable on Windows). `Newsreader` (SIL OFL) is only for brand moments (home greeting, empty states, About) — bundle its font files in the app; don't load Google Fonts at runtime (the app must work offline).
- Mock data (file names, "Jordan Silva", dates, `[YOUR NAME]`, `[PHONE]`) is placeholder content. Never hard-code it.
- Lumora PDF is free with every feature: no Pro badges, locks, trials or upsell UI anywhere.
- Both themes must work: switch with `data-theme="light|dark"` on the root, plus a "System" option.
- Match the screenshots at 1440×900, and keep the layout usable down to 1024×700 (toolbar groups collapse into a "More" menu).
