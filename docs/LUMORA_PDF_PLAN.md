# Lumora PDF — Master Build Plan

> **For Claude Code:** This file is the single source of truth for building Lumora PDF.
> Read it fully before writing code. Work **one phase at a time, one task at a time**, in order.
> After finishing a task, tick its checkbox in this file (`- [ ]` → `- [x]`) and add a one-line note under
> the phase's **Progress log**. Follow the **Working rules** (section 2) at all times.

---

## 0. Product summary

| | |
|---|---|
| **Product** | Lumora PDF |
| **Brand** | Lumora |
| **What** | A fast, private, offline-first PDF reader and editor — an alternative to Adobe Acrobat Pro |
| **Platforms (order)** | Windows 10/11 (x64, then ARM64) → Linux → macOS → iPadOS/iOS → Android (maybe) |
| **Core promise** | Opens instantly, small install, no account, documents never leave the device unless the user asks |
| **Pricing** | **Free for everyone, every feature.** No paid tier, no trial, no ads, no account, no feature locks, no license keys. Optional donations never unlock anything. |

### Target users
- Students and researchers who read, highlight and organize many PDFs
- Freelancers and small businesses who fill, sign and send forms and invoices
- Office teams who merge, split, compress, redact and convert documents
- Privacy-conscious users

### Non-goals (do NOT build unless this file is updated)
- XFA forms
- A PDF parser/renderer written from scratch
- Real-time collaboration, cloud accounts, sync (later, separate "Lumora Cloud" project)
- Perfect PDF → Word conversion

---

## 1. Tech stack (decided — do not change without asking)

| Layer | Choice | Notes |
|---|---|---|
| App shell | **Tauri 2** | Windows first; same codebase for Linux/macOS/iOS/Android later |
| UI | **React + TypeScript (strict) + Vite** | |
| Styling | **Tailwind CSS** + **Radix UI** primitives | Lumora design tokens as CSS variables |
| UI state | **Zustand** | One store per concern (documents, tabs, tools, settings) |
| Icons | **lucide-react** | |
| Core | **Rust** (Cargo workspace) | |
| PDF engine | **PDFium** via the **`pdfium-render`** crate | Rendering, text, search, annotations, forms, page objects, page import |
| Low-level PDF ops | **`lopdf`** (pure Rust) | Object-level edits PDFium can't do; **qpdf** only later if needed (encryption, linearization, repair) |
| IPC types | **`tauri-specta`** + **`specta`** | Generate TypeScript bindings from Rust command signatures |
| Errors | `thiserror` in library crates, `anyhow` only at app boundary | |
| Logging | `tracing` + `tracing-subscriber` (+ file appender) | |
| Local DB | **SQLite** via `rusqlite` (bundled feature) | Recent files, library, settings, annotation index |
| Full-text search | **Tantivy** | Phase 3+ (library search) |
| OCR | **Tesseract** | Phase 7 |
| Signatures/crypto | RustCrypto crates (`rsa`, `p256`, `sha2`, `x509-cert`, `cms`) | Phase 6 |
| Local AI | `llama.cpp` via Rust bindings | Post-1.0 |
| Updates | Tauri updater plugin | Signed updates |
| Crash reports | Sentry (opt-in only) | |
| Tests | `cargo test`, **Vitest**, **Playwright**, `cargo-fuzz` | |
| License policy | **`cargo-deny`** + `license-checker` (npm) in CI | |
| CI/CD | **GitHub Actions** | |

### Licensing rules (hard rules)
- **Allowed licenses:** MIT, Apache-2.0, BSD-2/3, ISC, Zlib, MPL-2.0, Unicode, CC0.
- **Forbidden in the shipped app:** GPL, LGPL (unless dynamically linked and approved), **AGPL**. This rules out **MuPDF, Poppler, Ghostscript, iText**.
- PDFium is BSD-3/Apache-2.0 → allowed.
- Keep `THIRD_PARTY_LICENSES.md` up to date whenever a dependency is added.

---

## 2. Working rules for Claude Code

1. **Follow the phases in order.** Don't start a task whose dependencies aren't ticked.
2. **Small steps.** Each task should end with code that builds, passes tests and lints.
3. **Before adding any dependency:** check its license against section 1, prefer well-maintained crates/packages, and add it to `THIRD_PARTY_LICENSES.md`.
4. **Ask the user before:** changing the tech stack, adding a dependency over ~1 MB to the bundle, changing the architecture in section 3, or deleting files you didn't create in this session.
5. **Never call PDFium from the UI layer or from Tauri commands directly.** Everything goes through the `PdfEngine` trait (section 3.3).
6. **Every document mutation is a `Command`** (section 3.4) so undo/redo works.
7. **Treat every PDF as untrusted input.** No `unwrap()`/`expect()` on data derived from a PDF. Return errors.
8. **Never block the UI thread.** Long work runs on the engine worker or a job thread, with progress events.
9. **Run before declaring a task done:**
   - `cargo fmt --all --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
   - `pnpm lint && pnpm typecheck && pnpm test`
10. **Commit style:** Conventional Commits (`feat(viewer): continuous scroll`, `fix(engine): …`). One logical change per commit.
11. **Update this file:** tick checkboxes, add to the phase's Progress log, and record any decision in section 11 (Decision log).
12. Use the Lumora name consistently: app name `Lumora PDF`, identifier `com.lumora.pdf`, URL scheme `lumora`, crate prefix `lumora-`.
13. **Lumora PDF is free with every feature.** Never build a paid tier, feature gating, license checks, trials, "Pro" badges, upsell screens or ads.

---

## 3. Architecture

### 3.1 Layers

```
┌──────────────────────────────────────────────────────────────┐
│ UI — React + TypeScript                                      │
│ viewer, toolbars, side panels, tabs, dialogs, command palette│
└───────────────▲──────────────────────────────▲───────────────┘
                │ typed Tauri commands (JSON)  │ lumora:// tiles (binary images)
┌───────────────┴──────────────────────────────┴───────────────┐
│ Tauri 2 bridge (apps/desktop/src-tauri)                      │
│ commands, events, custom protocol handler                    │
└───────────────▲──────────────────────────────────────────────┘
┌───────────────┴──────────────────────────────────────────────┐
│ Rust core                                                    │
│  lumora-core:   document sessions, commands, undo/redo       │
│  lumora-render: tile renderer + LRU cache                    │
│  lumora-jobs:   background jobs, progress, cancel            │
│  lumora-store:  SQLite (recents, settings, library)          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ lumora-engine: PdfEngine trait  ← the ONLY engine API  │  │
│  └───────▲───────────────▲──────────────▲─────────────────┘  │
└──────────┼───────────────┼──────────────┼────────────────────┘
       PDFium (worker)   lopdf       (later) Tesseract, crypto
```

### 3.2 Threading model (important)
- **PDFium is not thread-safe.** A single **engine worker thread** owns the `Pdfium` instance and all open `PdfDocument`s.
- Other code talks to it through an **actor**: `EngineHandle` sends `EngineRequest` messages over a channel (`crossbeam-channel` or `tokio::sync::mpsc`) and awaits a `oneshot` reply.
- The worker processes requests in priority order: **visible-tile renders > UI queries > background jobs**. Renders for pages no longer visible are cancelled (generation counter per document/view).
- Later optimisation (not now): a pool of engine worker **processes** for parallel rendering and crash isolation.

### 3.3 Engine trait (sketch — refine during Phase 0)

```rust
pub type DocId = u64;
pub type PageIndex = u32;

pub struct OpenOptions { pub password: Option<String> }

pub struct DocInfo {
    pub page_count: u32,
    pub title: Option<String>,
    pub author: Option<String>,
    pub is_encrypted: bool,
    pub has_forms: bool,
    pub pdf_version: String,
}

pub struct PageSize { pub width_pt: f32, pub height_pt: f32, pub rotation: u16 }

pub struct TileRequest {
    pub doc: DocId,
    pub page: PageIndex,
    pub scale: f32,           // 1.0 = 72 dpi
    pub tile_x: u32, pub tile_y: u32, pub tile_size: u32, // pixels at that scale
    pub dark_mode: bool,
}

pub trait PdfEngine: Send + Sync {
    fn open(&self, path: &Path, opts: OpenOptions) -> Result<(DocId, DocInfo), EngineError>;
    fn close(&self, doc: DocId) -> Result<(), EngineError>;
    fn page_sizes(&self, doc: DocId) -> Result<Vec<PageSize>, EngineError>;
    fn render_tile(&self, req: TileRequest) -> Result<RgbaImage, EngineError>;
    fn render_thumbnail(&self, doc: DocId, page: PageIndex, max_px: u32) -> Result<RgbaImage, EngineError>;
    fn outline(&self, doc: DocId) -> Result<Vec<OutlineItem>, EngineError>;
    fn page_text(&self, doc: DocId, page: PageIndex) -> Result<PageText, EngineError>; // chars + boxes
    fn search(&self, doc: DocId, query: &SearchQuery) -> Result<Vec<SearchHit>, EngineError>;
    fn annotations(&self, doc: DocId, page: PageIndex) -> Result<Vec<Annotation>, EngineError>;
    fn apply(&self, doc: DocId, op: EngineOp) -> Result<EngineOpResult, EngineError>; // all mutations
    fn save(&self, doc: DocId, target: SaveTarget) -> Result<(), EngineError>;      // incremental | full | copy
}
```

- `EngineOp` is an enum of low-level mutations (AddAnnotation, UpdateAnnotation, DeleteAnnotation, InsertPages, DeletePages, MovePages, RotatePages, SetFormField, …). Each must be invertible or carry what's needed to undo.
- Implementation: `PdfiumEngine` (+ `lopdf` helpers). The trait lets us swap in a commercial SDK later.

### 3.4 Commands, undo/redo
- `trait Command { fn apply(&mut self, s: &mut DocSession) -> Result<()>; fn undo(&mut self, s: &mut DocSession) -> Result<()>; fn label(&self) -> String; }`
- `DocSession` keeps an `undo_stack`, `redo_stack`, `dirty` flag and a revision counter.
- Commands can be merged (e.g. consecutive ink strokes within 500 ms) and grouped (batch actions).
- Commands are serializable (serde) so they can be recorded into **Lumora Workflows** later.

### 3.5 Rendering pipeline
- Tile size: 512×512 px. Render at `scale = zoom × devicePixelRatio`.
- The UI computes visible tiles and requests them as images:
  - Rust registers an async URI scheme protocol **`lumora`** (`register_asynchronous_uri_scheme_protocol`).
  - The UI builds URLs with `convertFileSrc(path, 'lumora')` semantics. Note: on Windows Tauri 2 serves custom schemes as `http://lumora.localhost/...`; always build URLs via a helper, never hard-code.
  - Path format: `/tile/{docId}/{page}/{scaleMilli}/{tx}/{ty}?rev={docRevision}&dark={0|1}` → returns `image/webp` (or PNG at first).
- **Cache:** in-memory LRU keyed by `(doc, page, scaleMilli, tx, ty, rev, dark)`, size-limited (~256 MB default). Disk cache for thumbnails later.
- **Placeholders:** show a low-res (thumbnail-scale) page while full tiles load. Never show a blank white page during scroll.
- **Invalidation:** any mutation of a page bumps the doc/page revision → new URLs → automatic cache miss.
- Annotation editing overlays (selection handles, in-progress ink) are drawn in the UI on an SVG/canvas layer above the tiles; committed annotations are rendered by PDFium.

### 3.6 Saving
- **Save** = incremental update when possible (fast, keeps existing digital signatures valid). If `pdfium-render` doesn't expose the incremental flag, call `FPDF_SaveAsCopy` with `FPDF_INCREMENTAL` through `pdfium.bindings()`.
- **Save As / Save optimized** = full rewrite.
- **Atomic writes:** write to `file.pdf.lumora-tmp`, fsync, then rename over the original. Never truncate the original first.
- **Autosave/recovery:** journal unsaved commands to `%APPDATA%/Lumora/recovery/` every 30 s; offer restore on next launch after a crash.

### 3.7 Repository layout

```
lumora-pdf/
├── apps/
│   └── desktop/
│       ├── src/                    # React app
│       │   ├── app/                # shell, routing, layout
│       │   ├── features/
│       │   │   ├── viewer/         # virtualized page list, tiles, zoom
│       │   │   ├── sidebar/        # thumbnails, outline, comments, search results
│       │   │   ├── annotate/       # tools + overlays
│       │   │   ├── organize/       # page grid, merge/split dialogs
│       │   │   ├── forms/
│       │   │   └── palette/        # command palette
│       │   ├── components/ui/      # Radix-based primitives (Button, Dialog, Tooltip…)
│       │   ├── stores/             # Zustand stores
│       │   ├── lib/                # ipc bindings (generated), url helpers, utils
│       │   ├── styles/             # tailwind + tokens.css
│       │   └── main.tsx
│       ├── src-tauri/
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── commands/       # thin Tauri commands → lumora-core
│       │   │   ├── protocol.rs     # lumora:// handler
│       │   │   └── state.rs
│       │   ├── resources/pdfium/   # pdfium.dll / libpdfium.so / libpdfium.dylib
│       │   └── tauri.conf.json
│       └── package.json
├── crates/
│   ├── lumora-engine/              # PdfEngine trait, types, PdfiumEngine, worker actor
│   ├── lumora-core/                # DocSession, Command, undo/redo, save logic
│   ├── lumora-render/              # tiling, LRU cache, image encoding
│   ├── lumora-jobs/                # background jobs with progress + cancel
│   ├── lumora-store/               # SQLite: recents, settings, library
│   └── lumora-cli/                 # (Phase 7+) CLI for Workflows
├── tests/
│   ├── corpus/                     # test PDFs (Git LFS), see tests/corpus/README.md
│   ├── golden/                     # golden render PNGs
│   └── e2e/                        # Playwright tests
├── fuzz/                           # cargo-fuzz targets
├── docs/
│   └── LUMORA_PDF_PLAN.md          # this file
├── .github/workflows/              # ci.yml, release.yml
├── Cargo.toml                      # workspace
├── deny.toml                       # cargo-deny license/advisory policy
├── pnpm-workspace.yaml
├── CLAUDE.md                       # short project rules for Claude Code (see section 12)
├── THIRD_PARTY_LICENSES.md
└── README.md
```

---

## 4. UI / UX spec (desktop)

### Layout
- **Title bar:** custom (Tauri `decorations: false` later; native first), tabs for open documents, `+` to open.
- **Top toolbar:** tool groups — View · Annotate · Organize · Fill & Sign · Edit · Protect · Convert. All groups are available to everyone (no paid tier). Selecting a group swaps a secondary toolbar.
- **Left sidebar (toggle):** Thumbnails · Outline · Comments · Search results · Attachments.
- **Main area:** virtualized vertical page list, centered, with page gaps; page number + zoom in a floating bottom bar.
- **Right panel (contextual):** properties of the selected annotation/field (color, opacity, stroke, font, author).
- **Home screen** (no doc open): recent files, drag-and-drop zone, quick tools (Merge, Compress, Sign).

### Keyboard shortcuts (initial set)
| Action | Shortcut |
|---|---|
| Open | Ctrl+O |
| Save / Save As | Ctrl+S / Ctrl+Shift+S |
| Close tab | Ctrl+W |
| Find | Ctrl+F |
| Command palette | Ctrl+K |
| Zoom in/out/reset | Ctrl+= / Ctrl+- / Ctrl+0 |
| Fit width / fit page | Ctrl+2 / Ctrl+1 |
| Undo / Redo | Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) |
| Highlight / Note / Ink tools | H / N / P |
| Next/prev page | PageDown / PageUp, → / ← in single-page mode |
| Go to page | Ctrl+G |
| Print | Ctrl+P |

### Design tokens (starting point — refine with brand kit)
```css
:root {
  --lumora-brand: #4F46E5;        /* indigo — placeholder until brand kit exists */
  --lumora-brand-contrast: #FFFFFF;
  --lumora-bg: #FFFFFF;
  --lumora-surface: #F6F7F9;
  --lumora-border: #E3E5E8;
  --lumora-text: #111318;
  --lumora-text-muted: #5B616E;
  --lumora-canvas: #E9EBEF;       /* area behind pages */
  --radius: 8px;
}
:root[data-theme="dark"] {
  --lumora-bg: #15171C;
  --lumora-surface: #1C1F26;
  --lumora-border: #2A2E37;
  --lumora-text: #ECEDEF;
  --lumora-text-muted: #9AA0AB;
  --lumora-canvas: #0F1115;
}
```
- Themes: Light, Dark, System. Separate setting: **Page dark mode** (invert page colors but keep images natural — done in the renderer, not with CSS filters).
- Accessibility: all controls keyboard reachable, visible focus rings, ARIA labels, respects reduced motion.

---

## 5. Phases and tasks

Status legend: `- [ ]` todo · `- [x]` done. Each phase lists **acceptance criteria** — the phase is done only when all pass.

### Phase 0 — Foundations (target: month 1)

**Goal:** A Windows build that opens a PDF and shows rendered pages through the `lumora://` protocol, with CI.

- [x] 0.1 Create repo structure (section 3.7): pnpm workspace, Cargo workspace, `apps/desktop` via `create-tauri-app` (React + TypeScript + Vite), crates scaffolded with `lib.rs` stubs.
- [x] 0.2 Tooling: rustfmt, clippy config, ESLint (typescript-eslint, react-hooks), Prettier, Vitest, `deny.toml` (license allow-list from section 1), EditorConfig, `.gitattributes` with Git LFS for `tests/corpus/**/*.pdf`.
- [x] 0.3 Tailwind + Radix + lucide-react set up; `tokens.css` from section 4; light/dark theme switch.
- [x] 0.4 PDFium binaries: script `scripts/fetch-pdfium.(ps1|sh)` that downloads prebuilt PDFium (e.g. from the `bblanchon/pdfium-binaries` GitHub releases) for the current platform into `src-tauri/resources/pdfium/`; bundle via `tauri.conf.json > bundle > resources`; resolve the path at runtime with Tauri's resource API and bind with `Pdfium::bind_to_library(...)`. Record the PDFium version in `THIRD_PARTY_LICENSES.md`.
- [x] 0.5 `lumora-engine`: types + `PdfEngine` trait + `PdfiumEngine` running on a dedicated worker thread (actor, section 3.2). Implement `open`, `close`, `page_sizes`, `render_tile`, `render_thumbnail`.
- [x] 0.6 `lumora-render`: tile math helpers, LRU cache, PNG/WebP encoding.
- [x] 0.7 Tauri: `open_document(path) -> DocSummary`, `close_document(docId)` commands via `tauri-specta`; generated TS bindings in `src/lib/ipc/`.
- [x] 0.8 Tauri: `lumora://` async protocol handler serving tiles (section 3.5) + a TS helper `tileUrl(...)` that works on Windows/macOS/Linux.
- [x] 0.9 UI: open file via dialog (Tauri dialog plugin) and drag-and-drop; show page 1 using tiles.
- [x] 0.10 Test corpus: `tests/corpus/README.md` describing categories (text, scanned, huge >200 pages, >100 MB, forms, encrypted, broken/malformed, CJK/Indic/Arabic fonts, rotated pages, annotations from Acrobat). Start with ≥ 30 files, target ≥ 500 over time. Only include files with redistributable licenses (or keep private files out of git).
- [x] 0.11 Golden render test: render page 1 of each corpus file at scale 1.0 and compare with `tests/golden/` within a pixel tolerance (`cargo test -p lumora-engine --features golden`).
- [x] 0.12 Logging (`tracing`) to file in the app data dir; a panic hook that logs and shows a friendly error.
- [x] 0.13 GitHub Actions `ci.yml`: Windows runner — fmt, clippy, tests, cargo-deny, pnpm lint/typecheck/test, `tauri build` artifact upload.
- [x] 0.14 `README.md`, `CLAUDE.md` (section 12), `THIRD_PARTY_LICENSES.md`.

**Acceptance criteria**
- `pnpm tauri dev` on Windows opens a PDF and shows page 1 sharply at 100% and 200% zoom.
- Opening a malformed PDF shows an error message, never crashes.
- CI is green and produces a Windows installer artifact.

**Progress log**
- 2026-10-09 — 0.1: pnpm + Cargo workspaces, `apps/desktop` from create-tauri-app (React 19, Vite 8, TS 6), five `lumora-*` crate stubs; installed Rust 1.99 stable.
- 2026-10-09 — 0.2: ESLint 10 (strict type-checked) + Prettier + Vitest/jsdom, rustfmt/clippy config, `deny.toml`, `pnpm check-licenses`, EditorConfig, LF + Git LFS `.gitattributes`.
- 2026-10-09 — 0.3: Tailwind 4 theme mapped onto the design tokens (default palette removed; ESLint bans raw hex), `tokens.css` from the design handoff, Radix-based Button/IconButton/Tooltip/SegmentedControl/Notice, Light/Dark/System theme via a Zustand settings store, bundled Newsreader.
- 2026-10-09 — 0.4: `pnpm fetch-pdfium` (Node, SHA-256-pinned PDFium chromium/7881, no V8/XFA, plus its license notices), bundled via per-platform `tauri.*.conf.json` resources; binding verified by the engine tests (0.5).
- 2026-10-09 — 0.5: `PdfEngine` trait + `PdfiumEngine` actor (one worker thread owns PDFium and all docs; render lane served before query lane; per-request panic catch; 6-page cache per doc); tiles rendered with an origin offset so form fields still draw; 7 integration tests on real PDFium (tiles, thumbnails, rotation, malformed files, 8 threads).
- 2026-10-09 — 0.6: `lumora-render` — `TileGrid`/milli-scale tile math, byte-bounded LRU `TileCache` of encoded images (256 MB default, keyed with doc revision + dark mode, per-doc eviction), PNG (default, fast) and lossless WebP encoding (opaque images drop alpha), `TileService` (cache → engine → encode).
- 2026-10-09 — 0.7: `lumora-core` `Documents` registry + `DocSession` (revision counter) + `DocSummary`; thin async `open_document`/`close_document` commands on blocking threads; `AppError { kind, detail }` (UI owns the copy); bindings generated by a Rust test (`pnpm gen:ipc`) into `src/lib/ipc/bindings.ts`; app still starts if PDFium fails to load.
- 2026-10-09 — 0.8: async `lumora://` handler (`/tile/…` and `/thumb/…`, rendering on blocking threads, immutable cache headers, 400/404/503 on bad input) + TS `tileUrl`/`thumbnailUrl` built from `convertFileSrc("", "lumora")` and f32-exact `pagePixelSize` mirroring the Rust rounding.
- 2026-10-09 — 0.9: home screen (Open file, drop zone, Ctrl+O), native open dialog (`dialog:allow-open` only), window drag-and-drop, viewer showing page 1 from tiles at zoom × devicePixelRatio, zoom bar + Ctrl+=/−/0, friendly open errors. Verified in the running app over WebView2 CDP: sharp at 100%/200% on a 125% display, malformed file shows a notice. Found and fixed swapped red/blue channels (engine regression test added).
- 2026-10-09 — 0.10: 53-file corpus in Git LFS (47 PDFium test files, BSD-3, pinned commit; 6 generated CC0 files via `scripts/generate-corpus.mjs`, `--large` makes a >100 MB file outside git), `manifest.json` with measured outcomes/passwords, README with categories and gaps (CJK/Indic/Arabic, Acrobat annotations); `tests/corpus.rs` checks every entry. Found and fixed thumbnails of 14,400 pt pages (MIN_SCALE).
- 2026-10-09 — 0.11: `--features golden` test renders page 1 of all 49 openable corpus files at scale 1.0 by stitching 512 px tiles (pages >2048 px use a 2048 px thumbnail), compares with `tests/golden/**.png` (LFS) at ±16 per channel / 0.2% of pixels, writes actual + diff images to `tests/golden/_diff/` on failure; `LUMORA_UPDATE_GOLDEN=1` rewrites.
- 2026-10-09 — 0.12: `tracing` to daily-rotated files (7 kept) in the app log dir (`%LOCALAPPDATA%com.lumora.pdflogs`), `LUMORA_LOG` filter; panic hook logs, appends a synchronous `crash.log` record with backtrace, and emits a typed `AppErrorEvent` that the UI shows as a friendly notice; protocol handler always answers even if rendering panics. Verified in the running app.
- 2026-10-09 — 0.13: `.github/workflows/ci.yml` on `windows-latest`: Git LFS checkout, fetch-pdfium, fmt, clippy, tests, golden (diff artifacts on failure), bindings-drift check, cargo-deny, lint/typecheck/test, JS licenses, `tauri build` → NSIS installer artifact. Local `pnpm build` produces a 5.27 MiB installer; release exe verified with bundled PDFium and strict CSP. Not yet run on GitHub (nothing pushed).
- 2026-10-09 — 0.14: README (setup, commands, layout, architecture); CLAUDE.md already existed (fuller than section 12) — added the new commands; THIRD_PARTY_LICENSES.md kept current through Phase 0.
- 2026-10-09 — Acceptance: (1) verified — real app opens a PDF, page 1 sharp at 100% and 200% (125% display); (2) verified — malformed files show a notice, corpus test covers 11 malformed files; (3) pending — CI workflow written and every step passes locally, but it has not run on GitHub yet.

---

### Phase 1 — Viewer (target: months 2–3)

**Goal:** A daily-usable PDF viewer.

- [x] 1.1 Virtualized continuous scroll of all pages (only mount pages near the viewport); correct page gaps and scroll anchoring on zoom.
- [x] 1.2 Zoom: Ctrl+wheel, pinch on touchpads, presets (50–400%), fit width, fit page, actual size. Zoom around the cursor.
- [x] 1.3 Low-res placeholders + tile streaming; cancel stale tile requests on fast scroll.
- [x] 1.4 View modes: single page, continuous, two-page (with/without cover page); rotate view (doesn't modify file).
- [x] 1.5 Thumbnails sidebar (virtualized), click to navigate, current page highlighted.
- [x] 1.6 Outline/bookmarks panel from the PDF outline; click to navigate.
- [x] 1.7 Page navigation: page number input, Ctrl+G, PageUp/Down, Home/End.
- [x] 1.8 Text layer: `page_text` returns chars with boxes; selection by drag (line/word/paragraph with double/triple click); copy to clipboard preserving reading order.
- [x] 1.9 Find: Ctrl+F bar, match case / whole word, results list in sidebar, highlight hits on pages, next/prev.
- [x] 1.10 Links: internal links navigate; external links open in the browser **after a confirmation dialog**.
- [x] 1.11 Tabs: multiple documents, reorder tabs, middle-click close, confirm on unsaved changes.
- [x] 1.12 Recent files (SQLite via `lumora-store`), remember last page + zoom per file; home screen.
- [x] 1.13 Password-protected PDFs: password dialog, retry.
- [x] 1.14 Page dark mode (renderer-side) + UI themes.
- [x] 1.15 Print: render pages to the OS print dialog (Windows: via WebView print of rendered pages or native print API — pick the approach that keeps quality at 300 dpi; record decision).
- [ ] 1.16 Windows integration: file association for `.pdf` (installer option), "Open with Lumora PDF", single-instance (open new files as tabs in the running window) via Tauri single-instance plugin.
- [ ] 1.17 Document properties dialog (title, author, producer, version, page size, file size, encryption, fonts list).
- [ ] 1.18 Settings screen: theme, page dark mode, default zoom, default view mode, scroll behaviour, language (English only for now, but all strings go through an i18n layer, e.g. `i18next`).
- [ ] 1.19 Playwright E2E: open file, scroll, zoom, search, select text.

**Acceptance criteria**
- 500-page text PDF: first page visible < 1 s, scrolling at ~60 fps on a mid-range laptop, memory < 600 MB.
- 100 MB scanned PDF opens and scrolls without freezing the UI.
- Search across 500 pages returns first results < 1 s.
- No crash across the whole test corpus (automated "open + render all pages" test).

**Progress log**
- 2026-10-09 — Groundwork: engine gained text runs, per-page search, outline (cycle-safe), links, properties, Page dark mode and cancellable tiles (`render_tile_if`); `lumora-jobs` job runner; `lumora-core` whole-document search; i18next set up first so all new UI strings go through it (task 1.18).
- 2026-10-09 — 1.1: pure `layout.ts` (rows, spreads, rotation, binary-search visibility, fit zooms, zoom anchors); `DocumentView` mounts only pages within one screen of the viewport, keeps the centre/cursor point fixed across zoom/layout changes, and handles go-to-page requests; `PageView` draws only visible tiles (+384 px prefetch) and stretches old tiles during zoom gestures. Measured on the 250-page corpus file (debug build): first page 0.6 s, 2–3 pages mounted.
- 2026-10-09 — 1.2: Ctrl+wheel / touchpad pinch (WebView2 reports it as Ctrl+wheel) zoom around the cursor, preset menu (50–400%, fit width, fit page), fit buttons in the View toolbar, Ctrl+0/1/2. Verified in the app: point under the cursor stays put (exact vertically; horizontally while the page is wider than the window).
- 2026-10-09 — 1.3: one-tile low-res placeholder under every page; UI reports mounted pages (`set_visible_pages`) and queued tiles of other pages are skipped (204, no-store) — only when a *newer* report leaves the page out, so pages that just scrolled in are never dropped; tiles retry if skipped while visible. Measured: a fling over ~90 pages skipped 600–770 queued tiles; jumps to far pages show sharp tiles in ~0.5 s (debug build).
- 2026-10-09 — 1.4: Single / Continuous / Two-page (+ cover page on its own) in the View toolbar; single-page mode turns pages when the wheel passes the page edge; view rotation (Ctrl+Shift+= / Ctrl+Shift+-) rotates the page content with CSS in 90° steps (pixel-exact, tiles reused) without touching the file. Verified in the app incl. pages with /Rotate.
- 2026-10-09 — 1.5: left sidebar (248 px, design tokens) with tab row and "Pages" header; virtualized thumbnail column (only visible ±1 screen mounted; `lumora://thumb` at device resolution); click navigates; current page outlined in brand and followed while scrolling; main toolbar with sidebar toggle (F4), document title and the View group tab.
- 2026-10-09 — 1.6: `get_outline` command; Outline sidebar tab with a collapsible tree (role=tree, aria-level/expanded); entries go to their page, entries without a target are disabled; circular outlines are cut by the engine.
- 2026-10-09 — 1.7: page number field in the zoom bar (Enter goes, Esc returns focus, Ctrl+G focuses it); PageUp/PageDown step a page (a spread in two-page), Home/End first/last, ←/→ turn pages in single and two-page layouts; keys typed into fields, menus and lists are ignored.
- 2026-10-09 — 1.8: `get_page_text` command; transparent text layer per mounted page (runs stretched to PDFium's widths, fetched after 120 ms on screen, 200-page cache); lines and paragraphs grouped from run geometry; drag/double-click/triple-click (paragraph) selection; copy rebuilds spaces, line breaks and page breaks. Verified aligned at 0° and 90° view rotation.
- 2026-10-09 — 1.9: `start_search`/`cancel_search` commands run `lumora-core::Searches` (one job per document, new search cancels the old) and stream `SearchProgressEvent` batches; find bar (Ctrl+F, Enter/Shift+Enter, F3, Esc, match case, whole words), page highlights with a stronger current match, virtualized results tab in the sidebar. 250-page document with 7,500 matches: all found ~0.66 s after typing stops.
- 2026-10-09 — 1.10: `get_page_links` command and a link layer per page (internal links go to their page); web/email links open only after a confirmation dialog, through `open_external_link`, which allows http, https and mailto only (checked again in Rust). New deps: `tauri-plugin-opener`, `@radix-ui/react-alert-dialog` (both MIT).
- 2026-10-09 — 1.11: documents store holds every open document in tab order; tab strip with drag-to-reorder (pointer events), middle-click and button close, Ctrl+Tab / Ctrl+PageUp/PageDown, arrow keys and Ctrl+Shift+PageUp/PageDown on a focused tab; opening a file that is already open switches to its tab; each document keeps its scroll position across tab switches; closing a document with unsaved changes asks first (the dirty flag is set by Phase 2 edits).
- 2026-10-09 — 1.12: `lumora-store` (rusqlite, bundled) with `user_version` migrations; `open_document` records the file and returns its saved view (page, zoom, zoom mode), which the viewer restores; the view is saved 1 s after it changes and on close; home screen lists up to 50 recent files (name, folder, opened, pages; missing files marked; remove from list).
- 2026-10-09 — 1.13: `open_document` takes an optional password (never logged or stored); a protected file opens a password dialog instead of an error notice, a wrong password shows an inline error and clears the field, Cancel abandons the open. Checked with `encrypted.pdf` in the app.
- 2026-10-09 — 1.14: Page dark mode toggle (moon, View toolbar) stored in settings; tiles are requested with `dark=1` and recoloured in Rust with images left untouched; new `paper-dark` token for the page background while tiles load. UI themes (light/dark/system) from Phase 0 verified with the viewer: pages stay white in the dark theme.
- 2026-10-09 — 1.15: Print dialog (Ctrl+P, toolbar): all / current / page range; pages are rendered whole at 300 dpi (`render_page`, `lumora://…/print/…`, capped at 8192 px per edge), placed in a print-only container and printed through the system dialog; progress with Cancel, failure message per page. Release build: ~90 ms per Letter page (render + PNG). Ctrl+P never prints the app UI.

---

### Phase 2 — Annotate (target: months 4–5)

**Goal:** Full markup toolset saved as **standard PDF annotations** that look right in Acrobat, Edge and Chrome.

- [ ] 2.1 Annotation model in `lumora-engine` (`Annotation` enum covering types below) + read existing annotations from files.
- [ ] 2.2 Text markup: Highlight, Underline, StrikeOut, Squiggly (from text selection; quad points).
- [ ] 2.3 Sticky note (Text annotation) with popup editor.
- [ ] 2.4 FreeText (text box) with font, size, color, border.
- [ ] 2.5 Ink (freehand) with smoothing, pressure ignored for now; eraser for ink strokes.
- [ ] 2.6 Shapes: Square, Circle, Line, Arrow (Line with line endings), Polygon, PolyLine.
- [ ] 2.7 Stamps: built-in set (Approved, Draft, Confidential…) + custom image stamps.
- [ ] 2.8 Select/move/resize/delete annotations; properties panel (color, opacity, stroke width, author).
- [ ] 2.9 Every create/update/delete is a `Command` (undo/redo works for all).
- [ ] 2.10 Comments panel: list by page, author, type; replies (`IRT` replies); status (accepted/rejected); filter and search.
- [ ] 2.11 Generate appearance streams for every annotation so other viewers render them identically.
- [ ] 2.12 Save: incremental by default (section 3.6); atomic write; dirty indicator in tab.
- [ ] 2.13 Autosave journal + crash recovery prompt.
- [ ] 2.14 Export comments to Markdown and CSV; import/export XFDF.
- [ ] 2.15 Round-trip test: create each annotation type, save, re-open in Lumora and verify; render the saved file with PDFium and compare to golden images.

**Acceptance criteria**
- Every annotation type created in Lumora displays correctly in Adobe Acrobat Reader and in Chrome/Edge's PDF viewer (manual checklist in `docs/qa/annotations.md`).
- Annotations created in Acrobat are displayed and editable in Lumora (at least the types above).
- Undo/redo works across 100 mixed operations without corruption.

**Progress log**
- _(add entries here)_

---

### Phase 3 — Organize pages → **Lumora PDF 1.0** (target: month 6)

**Goal:** Page tools; then ship 1.0 for Windows.

- [ ] 3.1 Page grid view (organize mode) with multi-select (click, Shift, Ctrl, rubber band).
- [ ] 3.2 Drag-and-drop reorder; rotate left/right; delete; duplicate.
- [ ] 3.3 Insert: blank page (size options), pages from another PDF, images as pages (PNG/JPEG).
- [ ] 3.4 Extract selected pages to a new PDF.
- [ ] 3.5 Merge multiple PDFs (dialog with ordering + drag files from Explorer).
- [ ] 3.6 Split: by every N pages, by page ranges, by bookmarks, by file size.
- [ ] 3.7 Crop pages (visual crop box, apply to selected/all pages).
- [ ] 3.8 Compress/optimize: image downsampling (presets: High quality / Balanced / Smallest), remove unused objects, subset fonts where possible, show before/after size. Use `lopdf` (+ image crate) for image recompression; full rewrite save.
- [ ] 3.9 All page operations are undoable `Command`s; thumbnails and caches invalidate correctly.
- [ ] 3.10 Library search (Tantivy): index text of recently opened files locally; search across files from the home screen. (Can slip to 1.1 if needed.)
- [ ] 3.11 Command palette (Ctrl+K) listing all actions.
- [ ] 3.12 **Release prep:** app icon + branding, installer (NSIS/MSI) with file association option, code signing (Azure Trusted Signing or OV certificate), auto-updater with signed update manifest, opt-in crash reporting, About dialog with licenses, privacy policy link.
- [ ] 3.13 `release.yml`: tagged builds → signed installer → GitHub Release + update manifest.

**Acceptance criteria**
- Merge 20 files (1,000 pages total) in < 10 s; result opens correctly in Acrobat.
- Reorder/rotate/delete then save → file validates (open in Acrobat and qpdf `--check` in CI as a dev-only tool).
- Signed installer installs on a clean Windows 11 VM without SmartScreen "unknown publisher".
- **Tag `v1.0.0`.**

**Progress log**
- _(add entries here)_

---

### Phase 4 — Forms (target: months 7–8)

- [ ] 4.1 Detect AcroForms; render fields with PDFium's form-fill environment (FPDF_FORMHANDLE).
- [ ] 4.2 Fill text fields, checkboxes, radio groups, combo boxes, list boxes; tab order navigation; field highlight toggle.
- [ ] 4.3 Basic field formatting (number, date, percent) without running document JavaScript; show a notice when a form relies on JS.
- [ ] 4.4 Save filled values (incremental); regenerate appearances.
- [ ] 4.5 Form designer: add/move/resize/delete fields, field properties (name, default, required, read-only, options).
- [ ] 4.6 Auto-detect fields on flat forms (lines/boxes → suggested text fields) — heuristic first.
- [ ] 4.7 Flatten form (selected fields / all).
- [ ] 4.8 Import/export form data: FDF, XFDF, JSON, CSV (one row → one filled PDF, for batch).
- [ ] 4.9 Reset form; clear field.

**Acceptance criteria:** Government-style and invoice forms from the corpus fill, save and re-open correctly in Acrobat.

**Progress log**
- _(add entries here)_

---

### Phase 5 — Edit content (ongoing; months 11–18 in parallel with 7–8)

Do these **in this order**; editing existing text is last because it is the hardest.

- [ ] 5.1 Add text (new text objects with embedded fonts — bundle a set of open-license fonts like Noto/Inter; subset on save).
- [ ] 5.2 Add/replace/move/resize/delete images.
- [ ] 5.3 Add/edit links.
- [ ] 5.4 Watermark (text/image, opacity, rotation, page range, behind/in front).
- [ ] 5.5 Header/footer, page numbers, Bates numbering.
- [ ] 5.6 **True redaction:** mark areas/text → apply → remove underlying text glyphs, image pixels and vector content in the area; remove matching metadata; option to search-and-redact (text and regex patterns). Verify by text extraction that redacted content is gone.
- [ ] 5.7 Edit existing text — stage A: select a text run, edit in place when all needed glyphs exist in the embedded font.
- [ ] 5.8 Stage B: font substitution when glyphs are missing (match family/weight from bundled fonts; warn user).
- [ ] 5.9 Stage C: paragraph detection and reflow within a text box.
- [ ] 5.10 Edit vector objects (move/delete paths) — basic.

**Acceptance criteria:** Redaction passes an automated test: after applying, extracting text/images from the region returns nothing.

**Progress log**
- _(add entries here)_

---

### Phase 6 — Security and signatures (target: months 9–10, with Phase 4 → **Lumora PDF 1.5**)

- [ ] 6.1 Password-protect (AES-256), set permissions (print, copy, edit). Use qpdf or lopdf — record decision.
- [ ] 6.2 Remove password (when the user knows it).
- [ ] 6.3 Simple signatures: draw (mouse/pen), type (signature fonts), image; saved signature library (stored locally, encrypted with OS keychain via Tauri stronghold/keyring).
- [ ] 6.4 "Fill & Sign" flow: place signature, initials, date, text, checkmarks.
- [ ] 6.5 Digital signatures (PAdES B-B, then B-T with RFC 3161 timestamp): sign with a PKCS#12 (.pfx) file; Windows certificate store later. Signature field creation, byte-range, CMS SignedData.
- [ ] 6.6 Validate existing signatures: integrity, certificate chain (trust store), modifications after signing (incremental updates), show a signature panel.
- [ ] 6.7 Remove hidden data / metadata sanitizer.
- [ ] 6.8 "Support Lumora" link in the About dialog (opens the donation page in the browser after confirmation). It never unlocks features; there is no license check anywhere in the app.

**Acceptance criteria:** A document signed in Lumora shows as valid in Adobe Acrobat Reader (with the certificate trusted); a document signed in Acrobat validates in Lumora.

**Progress log**
- _(add entries here)_

---

### Phase 7 — Convert and OCR (months 11–14)

- [ ] 7.1 PDF → images (PNG/JPEG/WebP, DPI choice, page range).
- [ ] 7.2 Images → PDF (multiple images, page size, margins, ordering).
- [ ] 7.3 OCR with Tesseract: language packs downloaded on demand (eng, sin, tam, hin, ara, …); create an invisible text layer → searchable PDF; deskew/rotate detection; progress + cancel; runs as a background job.
- [ ] 7.4 Office → PDF via LibreOffice headless **if installed** on the user's machine (don't bundle it); show guidance otherwise.
- [ ] 7.5 PDF/A-2b export (embed fonts, color profiles, metadata); optional validation with veraPDF as an external tool.
- [ ] 7.6 PDF → text/Markdown export (reading-order text).
- [ ] 7.7 Table extraction → CSV/XLSX (heuristic on text positions + ruling lines).
- [ ] 7.8 PDF → DOCX (best effort, last).
- [ ] 7.9 **Lumora Workflows:** record a sequence of commands/jobs; run on a folder of files; `lumora-cli` for scripting.

**Progress log**
- _(add entries here)_

---

### Phase 8 — More platforms (months 11–18)

- [ ] 8.1 Linux: build AppImage, .deb, Flatpak manifest; PDFium `.so` bundling; test on Ubuntu LTS + Fedora.
- [ ] 8.2 macOS: universal build, `.dylib` bundling, notarization (Apple Developer account), macOS menu bar conventions (Cmd shortcuts).
- [ ] 8.3 iPadOS/iOS via Tauri 2 mobile: touch-first UI layer (separate layout components, shared stores and IPC), Apple Pencil ink with pressure, Files app document picker, share sheet.
- [ ] 8.4 Reader (reflow) mode for small screens.
- [ ] 8.5 Platform-specific QA checklists in `docs/qa/`.

**Progress log**
- _(add entries here)_

---

## 6. Differentiating features (post-1.0 backlog — pick 1–2 per release)

**Lumora AI (fully offline)**
- [ ] Summarize document/section; explain or translate a selection
- [ ] Chat with a PDF with answers that cite and link to pages
- [ ] Semantic search across the library (local embeddings)
- [ ] Smart redaction suggestions (emails, phone numbers, ID numbers, bank details)
- [ ] Form auto-fill from a saved profile

**Productivity**
- [ ] Compare two PDFs (visual diff + text diff)
- [ ] Version history timeline with restore
- [ ] Split view (two docs or two parts of one doc)

**Study and research**
- [ ] Export highlights to Markdown / Notion / Obsidian
- [ ] Flashcards from highlights
- [ ] Citation/reference extraction
- [ ] Read aloud (OS text-to-speech)

**Trust and polish**
- [ ] Strong support for Indic scripts, Sinhala, Tamil, Arabic in OCR and text editing
- [ ] Accessibility checker + auto-tagging
- [ ] Plugin system (later)

**Lumora Cloud (separate project, later)**
- [ ] Shared annotations in real time (Yjs CRDT)
- [ ] Send for signature + tracking
- [ ] Optional device sync

---

## 7. Security requirements

- PDF JavaScript **disabled** by default (PDFium JS/XFA not compiled in or not enabled).
- Confirm before opening external links, launching embedded files, or saving attachments.
- No network access from the core except: update checks, opt-in crash reports, OCR language downloads — each user-visible and documented.
- Tauri: strict CSP; capabilities/permissions limited to what each window needs; no `shell` open of arbitrary paths.
- Fuzz targets (`fuzz/`): open + render page 0, text extraction, annotation parsing, save round-trip. Run nightly in CI for a fixed time.
- Keep PDFium updated (track Chromium security releases); document the update procedure in `docs/maintenance.md`.
- Later: run the engine worker in a separate low-privilege process.

---

## 8. Testing strategy

| Level | Tool | What |
|---|---|---|
| Unit | `cargo test`, Vitest | Engine types, commands/undo, tile math, stores |
| Golden render | `cargo test --features golden` | Corpus pages vs `tests/golden/*.png` with tolerance |
| Corpus smoke | custom test runner | Open + render every page of every corpus file; no panic, time budget |
| Round-trip | `cargo test` | Annotate/organize → save → reopen → compare |
| E2E | Playwright (Tauri WebDriver on Windows) | Main user flows |
| Fuzz | `cargo-fuzz` | Malformed PDFs |
| Performance | criterion benches + CI budgets | Open time, first tile, search time, memory |
| Manual QA | `docs/qa/*.md` checklists | Interop with Acrobat, Chrome, Edge |

---

## 9. Performance budgets (checked in CI on reference files)

| Metric | Budget |
|---|---|
| App cold start to home screen | < 800 ms |
| Open 50 MB PDF → first page visible | < 1 s |
| Scroll | ~60 fps, no blank pages |
| First search results (500 pages) | < 1 s |
| Memory with one 500-page doc open | < 600 MB |
| Installer size (Windows, without OCR data) | < 30 MB |

---

## 10. Release and distribution checklist

- [ ] Name check: "Lumora" / "Lumora PDF" trademark search, domain, GitHub org, store names
- [ ] Brand kit: logo, app icon (all sizes via `tauri icon`), colors, typography → update `tokens.css`
- [ ] Windows code signing (Azure Trusted Signing or OV/EV certificate)
- [ ] Installer: NSIS/MSI, per-user install default, file association opt-in
- [ ] Auto-updater keys generated and stored as CI secrets (never in repo)
- [ ] Microsoft Store (MSIX) submission; winget manifest
- [ ] Website: downloads, features, changelog, "Support Lumora" donation page (e.g. GitHub Sponsors / Open Collective), privacy policy, terms, EULA
- [ ] In-app: About, licenses (`THIRD_PARTY_LICENSES.md`), privacy settings, opt-in telemetry
- [ ] Later: Apple Developer Program (macOS notarization + App Store), Flathub

**Never** use the word "Acrobat" in product naming or Adobe-like iconography. "PDF" is generic and fine.

---

## 11. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-09 | Tauri 2 + React/TS + Rust | Small, fast, cross-platform incl. iOS; web UI skills |
| 2026-10-09 | PDFium (`pdfium-render`) as core engine; `lopdf` for low-level ops | Permissive licenses; mature engine |
| 2026-10-09 | No GPL/AGPL dependencies (no MuPDF/Poppler/Ghostscript/iText) | Keep Lumora closed-source and sellable |
| 2026-10-09 | Single engine worker thread (actor) | PDFium is not thread-safe |
| 2026-10-09 | Tiles via `lumora://` custom protocol | Avoid JSON-encoding bitmaps over IPC |
| 2026-10-09 | Lumora PDF is fully free: every feature for everyone, no Pro tier | Product decision. Never add feature gating, license keys, trials, upsell UI or ads. Costs stay low because everything runs on-device. |
| 2026-10-09 | Release profile keeps `panic = "unwind"` (the Tauri template uses `abort`) | A panic on the engine worker or a command thread is caught, logged and shown as a friendly error instead of killing the app |
| 2026-10-09 | License allow-list also accepts `MIT-0`, `0BSD`, `Apache-2.0 WITH LLVM-exception` and `Unicode-DFS-2016` | Strictly more permissive variants of allowed licenses; common in the Rust/JS ecosystems |
| 2026-10-09 | Workspace `rust-version = 1.90` | The MSRV-aware resolver otherwise picks `time`/`quick-xml` versions with open advisories |
| 2026-10-09 | `cargo deny` ignores RUSTSEC-2024-0370 (`proc-macro-error`) | Build-time only, transitive via Tauri's gtk3 Linux stack; no upgrade available upstream |
| 2026-10-09 | Design tokens come from `docs/design/lumora.css` (teal brand), not the placeholder indigo block in section 4 | The design handoff is the newer source of truth for the UI |
| 2026-10-09 | Newsreader bundled via `@fontsource/newsreader` (OFL-1.1); the JS license check allows OFL only for named font packages | CLAUDE.md approves Newsreader (OFL) for brand moments, bundled for offline use |
| 2026-10-09 | `fetch-pdfium` is one Node script (`scripts/fetch-pdfium.mjs`) instead of `.ps1` + `.sh` | One source of truth for the version and checksums on every OS; Node is already required |
| 2026-10-09 | PDFium pinned to `chromium/7881`, the newest API `pdfium-render` 0.9.4 supports (`pdfium_7881` feature) | Binary and bindings must match; bump both together |
| 2026-10-09 | `DocId` is `u32` (plan sketch: `u64`) | Maps to a plain JS number over IPC; ids are never reused within a run |
| 2026-10-09 | `PageSize` has no `rotation` field yet; sizes are display sizes with /Rotate applied | PDFium reports rotation only for loaded pages, and loading every page at open is slow; add it when editing needs it |
| 2026-10-09 | TS bindings are generated by a Rust unit test (`pnpm gen:ipc`) and committed; CI fails if they drift | Deterministic, no need to launch the app to regenerate |
| 2026-10-09 | Windows app manifest embedded via linker args for all targets (`build.rs`) | tauri-build embeds it in binaries only, so test executables linking Tauri crash with STATUS_ENTRYPOINT_NOT_FOUND |
| 2026-10-09 | `cargo deny` ignores RUSTSEC-2024-0436 (`paste`) | Archived build-time macro crate pulled in by specta (required by tauri-specta); no runtime code |
| 2026-10-09 | 100% zoom = actual size at 96 dpi (1 pt = 4/3 CSS px) | Matches Acrobat and other viewers; Phase 0 used 1 pt = 1 CSS px |
| 2026-10-09 | Default zoom mode "auto" = fit width, capped at 125% | Fills small windows without giant pages on large screens (pdf.js behaviour) |
| 2026-10-09 | Page dark mode recolours tiles in Rust (luma inversion, hue kept) except image areas, instead of PDFium's colour-scheme render | That PDFium call is only reachable through raw `unsafe` bindings, which the workspace forbids; post-processing keeps images natural as required |
| 2026-10-09 | `page_text` returns PDFium text runs (segments with boxes) rather than per-character boxes | Far smaller IPC payloads; the DOM text layer needs runs, and character quads for Phase 2 markup can come from DOM ranges or a later per-char call |
| 2026-10-09 | View rotation shortcuts are Ctrl+Shift+= / Ctrl+Shift+- | Matches Acrobat; Ctrl+R would reload the WebView |
| 2026-10-09 | The text layer handles copy itself (spaces from run gaps, 
 per line, blank line per page) and triple-click selects a paragraph found from line gaps | Absolutely positioned spans make the browser run lines together and treat each run as its own paragraph |
| 2026-10-09 | Search results stream to the UI as events tagged with a search id; the UI buffers events that arrive before `start_search` returns and drops other ids | The job starts emitting before the command reply, and a cancelled search can still send its last batch |
| 2026-10-09 | External links are opened from Rust (`tauri-plugin-opener`, no JS permission) and only for http, https and mailto | Other schemes (file:, custom app protocols) could launch programs; keeping the check in Rust means the webview can't bypass it |
| 2026-10-09 | Keep the native window title bar; the tab strip is its own row above the toolbar | A custom title bar (as in the mockup) needs our own window controls, snap layouts and drag regions; it can be done later without changing the tab code |
| 2026-10-09 | Only the active tab's viewer is mounted; switching tabs saves and restores the page point at the viewport centre | Keeps memory and tile work proportional to one document; a page anchor survives zoom and window size changes, unlike a raw scroll offset |
| 2026-10-09 | The database lives at `<app local data>/lumora.db` (WAL); if it can't be opened the app runs without recents instead of failing | Remembering files is a convenience; it must never stop a PDF from opening |
| 2026-10-09 | Page dark mode is one app-wide setting (not per document), and thumbnails keep the original page colours | Readers switch it for their environment, not per file; thumbnails stay recognisable as the printed page |
| 2026-10-09 | Print by rendering each page at 300 dpi in Rust and printing the images through the WebView's print dialog | Native printing (PDFium into a printer DC, or WebView2's COM print API) needs raw FFI, which the workspace forbids (`unsafe_code = deny`); this keeps 300 dpi quality and the OS dialog. Limits: text is printed as images, and very long jobs hold all page images in memory (~1 MB per page) — revisit with a native path later |
| 2026-10-09 | PageUp/PageDown move a whole page (or spread) in every layout; Space and the arrow keys still scroll by screen/line in the continuous layout | The plan lists them as page navigation; it makes them predictable across layouts, and screen-wise scrolling stays one key away |
| _(Claude Code: add new decisions here)_ | | |

---

## 12. `CLAUDE.md` to create at repo root (Phase 0, task 0.14)

Keep `CLAUDE.md` short — it is loaded into every session. Suggested content:

```markdown
# Lumora PDF — rules for Claude Code

- Full plan: docs/LUMORA_PDF_PLAN.md. Read the current phase before working; tick tasks when done.
- Stack: Tauri 2, React + TypeScript (strict) + Vite, Tailwind + Radix, Zustand, Rust workspace, PDFium via pdfium-render, lopdf.
- Never call PDFium outside crates/lumora-engine. All engine access goes through the PdfEngine trait and the engine worker.
- Every document mutation is a Command (undo/redo).
- No unwrap/expect on PDF-derived data. Never block the UI thread.
- No GPL/AGPL dependencies. Check licenses; update THIRD_PARTY_LICENSES.md.
- Lumora PDF is free with every feature: never add a paid tier, feature gating, license checks, trials, upsell UI or ads.
- Before finishing: cargo fmt --check, cargo clippy -D warnings, cargo test, pnpm lint, pnpm typecheck, pnpm test.
- Conventional Commits. Ask before changing stack/architecture or adding large deps.
- Commands: `pnpm tauri dev` (run), `pnpm tauri build` (installer), `cargo test --workspace`.
```

---

## 13. How to start (prompt for the first Claude Code session)

> Read `docs/LUMORA_PDF_PLAN.md` fully. Then start **Phase 0**, task **0.1**. Before writing code, list the
> commands you will run and the prerequisites I need installed on Windows (Rust via rustup, Node LTS + pnpm,
> Microsoft C++ Build Tools, WebView2). Work through Phase 0 tasks in order, ticking each checkbox in the plan
> and adding a Progress log line. Stop and ask me when you reach a decision the plan says to ask about.

### Windows prerequisites (for the human)
- Rust (rustup, stable, MSVC toolchain)
- Node.js LTS + pnpm (`corepack enable`)
- Visual Studio Build Tools with "Desktop development with C++"
- WebView2 runtime (preinstalled on Windows 10/11)
- Git + Git LFS
- VS Code extensions: rust-analyzer, Tauri, ESLint, Prettier, Tailwind CSS IntelliSense, Claude Code
