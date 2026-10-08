# Lumora PDF — project rules for Claude Code

Lumora PDF (brand: Lumora) is a fast, private, offline-first PDF reader and editor — an everyday alternative to Acrobat Pro. Windows first, then Linux, macOS and iPadOS/iOS from one codebase. **Every feature is free for everyone.**

## Read these first

| File | What it is |
|---|---|
| `docs/LUMORA_PDF_PLAN.md` | Master plan: phases, tasks with checkboxes, acceptance criteria, decision log. **Work from it.** |
| `docs/design/README.md` | UI handoff: screens, component map, design rules |
| `docs/design/screenshots/*.png` | The target look for each screen (1440×900) |
| `docs/design/design-system/brand-book.md` | Voice, color, type, layout, states, icons, motion, accessibility |

Before starting work: find the first unticked task in the plan's current phase. When a task is done: tick it (`- [ ]` → `- [x]`), add one line to that phase's **Progress log**, and record any decision in the plan's **Decision log**.

## Tech stack (decided — ask before changing)

- **Shell:** Tauri 2 · **UI:** React + TypeScript (strict) + Vite · Tailwind CSS + Radix UI · Zustand · lucide-react
- **Core:** Rust (Cargo workspace) · **PDF engine:** PDFium via `pdfium-render` · **Low-level PDF:** `lopdf` (qpdf only if needed later)
- **IPC types:** `tauri-specta` · **Errors:** `thiserror` in crates, `anyhow` only at the app boundary · **Logs:** `tracing`
- **Storage:** SQLite (`rusqlite`, bundled) · **Search:** Tantivy · **OCR:** Tesseract (Phase 7)
- **Tests:** `cargo test`, Vitest, Playwright, `cargo-fuzz` · **Licenses:** `cargo-deny` · **CI:** GitHub Actions
- **Package manager:** pnpm (workspace)

## Repo layout

```
apps/desktop/src/          React UI: app/, features/{viewer,sidebar,annotate,organize,forms,palette}/, components/ui/, stores/, lib/, styles/
apps/desktop/src-tauri/    Tauri app: commands/ (thin), protocol.rs (lumora://), state.rs, resources/pdfium/
crates/lumora-engine/      PdfEngine trait, types, PdfiumEngine, engine worker (actor)
crates/lumora-core/        DocSession, Command trait, undo/redo, save logic
crates/lumora-render/      tile math, LRU cache, image encoding
crates/lumora-jobs/        background jobs (progress + cancel)
crates/lumora-store/       SQLite: recents, settings, library
tests/corpus/ (Git LFS)    test PDFs · tests/golden/ render PNGs · tests/e2e/ Playwright
docs/                      plan + design handoff
```

## Commands

Run from the repo root. (Phase 0 task 0.1 creates these root scripts; keep them working.)

```
pnpm install                          # install JS deps
pnpm fetch-pdfium                     # download PDFium binaries into src-tauri/resources/pdfium/
pnpm dev                              # run the app (tauri dev)
pnpm build                            # build the Windows installer (tauri build)
pnpm lint && pnpm typecheck && pnpm test
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
```

**A task is not done until all of the checks above pass.**

## Architecture rules (must follow)

1. **Never call PDFium outside `crates/lumora-engine`.** UI and Tauri commands go through the `PdfEngine` trait only.
2. **PDFium is not thread-safe:** one engine worker thread owns `Pdfium` and all open documents; everyone else sends requests over a channel (actor) and awaits a reply.
3. **Every document change is a `Command`** with `apply` and `undo`, so undo/redo works for everything.
4. **Page images go through the `lumora://` custom protocol as tiles** (512 px, LRU-cached, keyed by doc revision), never as JSON/base64 over IPC. Build tile URLs with the TS helper, never hard-code them (Windows serves custom schemes as `http://lumora.localhost/`).
5. **Never block the UI thread.** Long work runs on the engine worker or a job thread, with progress events and cancel.
6. **Treat every PDF as hostile.** No `unwrap()`/`expect()`/panics on PDF-derived data; return errors and show a friendly message.
7. **Saving:** incremental save by default (keeps signatures valid); write to a temp file, fsync, then rename. Never truncate the original first.
8. **Annotations are standard PDF annotations** with appearance streams, so they look the same in other viewers.

## UI rules

- Match `docs/design/screenshots/`. Use `docs/design/screens/*.html` for structure, copy and ARIA labels, but **rebuild them as React components** — never ship the mockup HTML.
- Use design tokens (`var(--brand)`, Tailwind theme from `docs/design/design-system/tokens.json`). **No raw hex colors in components.**
- Light and dark themes via `data-theme` on the root, plus a System option. PDF pages stay white in dark mode (Page dark mode is a separate renderer setting).
- Icons: lucide-react, 18 px in toolbars, 16 px in buttons/menus, stroke 1.75. Every icon-only button has an `aria-label` and a tooltip with its shortcut.
- Fonts: the OS UI font. Newsreader (OFL) only for brand moments; bundle its files — **no runtime Google Fonts** (the app must work offline).
- Copy: sentence case, verb + object on buttons ("Merge files"), no exclamation marks, no emoji. Follow the brand book's voice section.
- Everything works by keyboard; visible focus ring (`--focus`); text contrast ≥ 4.5:1 in both themes.

## Product rules

- **Lumora PDF is free with every feature.** Never build a paid tier, "Pro" badges, feature locks, license keys, trials, upsell screens or ads.
- **Private by default:** no account, no telemetry unless the user opts in. The only network use: update checks, opt-in crash reports, OCR language downloads, and the "Support Lumora" link — each visible to the user.
- PDF JavaScript is off by default. Confirm before opening external links or embedded files.

## Licensing (hard rule)

- Allowed: MIT, Apache-2.0, BSD-2/3, ISC, Zlib, MPL-2.0, Unicode, CC0.
- **Forbidden: GPL, AGPL, and LGPL** (unless dynamically linked and approved). That rules out MuPDF, Poppler, Ghostscript and iText.
- Every new dependency: check its license and add it to `THIRD_PARTY_LICENSES.md`.

## Code style

- Rust: `rustfmt` defaults; clippy clean with `-D warnings`; small modules; doc comments on public items.
- TypeScript: strict mode, no `any`, function components + hooks, one component per file, Zustand store per concern.
- Names: app `Lumora PDF`, identifier `com.lumora.pdf`, URL scheme `lumora`, crate prefix `lumora-`.
- Tests next to the code they cover; add a corpus or golden test when fixing a rendering bug.
- Commits: Conventional Commits (`feat(viewer): …`, `fix(engine): …`), one logical change each, small and buildable.

## Ask me before

- Changing the tech stack or the architecture rules above
- Adding a dependency that adds more than ~1 MB to the app, or any dependency with an unclear license
- Deleting files you didn't create in this session
- Anything the plan marks as a decision to ask about
