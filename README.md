# Lumora PDF

A fast, private, offline-first PDF reader and editor — an everyday alternative to Acrobat Pro.

- **Free with every feature.** No paid tier, no trial, no account, no ads.
- **Private by default.** Your files open and stay on your device. No telemetry unless you opt in.
- **Fast and small.** A native Rust core around Google's PDFium engine, with a lightweight
  [Tauri](https://tauri.app) shell.

Windows comes first, then Linux, macOS and iPadOS/iOS from the same codebase.

> **Status:** early development (Phase 0 — foundations). Lumora PDF opens a PDF and shows its first
> page. See the [build plan](docs/LUMORA_PDF_PLAN.md) for what comes next.

## Getting started (Windows)

Install once:

- [Rust](https://rustup.rs) (stable, MSVC toolchain)
- [Node.js](https://nodejs.org) 22 LTS and pnpm (`corepack enable`)
- Visual Studio Build Tools with **Desktop development with C++**
- [Git LFS](https://git-lfs.com) (`git lfs install`) — the test corpus lives in LFS
- WebView2 runtime (already on Windows 10/11)

Then, from the repo root:

```sh
pnpm install          # JavaScript dependencies
pnpm fetch-pdfium     # download the pinned PDFium build into apps/desktop/src-tauri/resources/pdfium/
pnpm dev              # run the app
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app with hot reload (`tauri dev`) |
| `pnpm build` | Build the Windows installer (`target/release/bundle/nsis/`) |
| `pnpm fetch-pdfium` | Download PDFium for this platform (checksum-verified) |
| `pnpm gen:ipc` | Regenerate the TypeScript IPC bindings after changing a Tauri command |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Prettier + ESLint, TypeScript, Vitest |
| `pnpm check-licenses` | Check JavaScript dependency licenses |
| `cargo fmt --all --check` | Rust formatting |
| `cargo clippy --workspace --all-targets -- -D warnings` | Rust lints |
| `cargo test --workspace` | Rust tests, including the PDFium engine and corpus tests |
| `cargo test -p lumora-engine --features golden --test golden` | Golden render tests (`LUMORA_UPDATE_GOLDEN=1` to update) |
| `cargo deny check` | Rust license and advisory checks |
| `node scripts/generate-corpus.mjs` | Regenerate the synthetic test PDFs |

CI (`.github/workflows/ci.yml`) runs all of these on Windows and uploads the installer.

## Repository layout

```
apps/desktop/src/          React + TypeScript UI (Vite, Tailwind, Radix, Zustand)
apps/desktop/src-tauri/    Tauri app: commands, lumora:// tile protocol, logging
crates/lumora-engine/      PdfEngine trait + PDFium engine worker (the only code that calls PDFium)
crates/lumora-core/        Document sessions (commands and undo/redo come in Phase 2)
crates/lumora-render/      Tile math, tile cache, PNG/WebP encoding
crates/lumora-jobs/        Background jobs (stub)
crates/lumora-store/       SQLite storage (stub)
tests/corpus/              Test PDFs (Git LFS) — see tests/corpus/README.md
tests/golden/              Golden render images (Git LFS)
docs/                      Build plan and design handoff
scripts/                   fetch-pdfium, corpus generator, license check
```

## How it works

PDFium is not thread-safe, so one engine worker thread owns it and every open document; the rest of
the app sends it requests and waits for replies. Pages reach the UI as 512 px PNG tiles through the
`lumora://` custom protocol (never as base64 over IPC), cached by document revision. Details are in
the [plan, section 3](docs/LUMORA_PDF_PLAN.md#3-architecture).

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) for the project rules and [`docs/LUMORA_PDF_PLAN.md`](docs/LUMORA_PDF_PLAN.md)
for the roadmap. In short: Conventional Commits, every check above passing, no GPL/LGPL/AGPL
dependencies, and every new dependency recorded in [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

## License

Third-party components and their licenses are listed in
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md). The license for Lumora PDF's own code has not
been chosen yet.
