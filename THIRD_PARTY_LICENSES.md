# Third-party licenses

Lumora PDF is built on the open-source projects below. Every dependency must use a license from the
allow-list in `docs/LUMORA_PDF_PLAN.md` (section 1): MIT, Apache-2.0, BSD-2/3, ISC, Zlib, MPL-2.0,
Unicode, CC0. GPL, LGPL and AGPL are not allowed.

`cargo deny check` (Rust) and `pnpm check-licenses` (JavaScript) enforce the allow-list for every
transitive dependency in CI. This file lists the **direct** dependencies and bundled binaries; update it
whenever you add one.

## Bundled binaries

| Component | Version | License | Source |
|---|---|---|---|
| PDFium (prebuilt, no V8/XFA) | `chromium/7881` (151.0.7881.0) | BSD-3-Clause AND Apache-2.0 | [bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries) build of [PDFium](https://pdfium.googlesource.com/pdfium/); build scripts MIT |

PDFium statically includes third-party code under its own permissive licenses: FreeType (FreeType
License), libjpeg-turbo (IJG + BSD-3-Clause + Zlib), OpenJPEG (BSD-2-Clause), libpng (libpng
license), zlib (Zlib), LittleCMS (MIT), libtiff (libtiff license), AGG 2.3 (BSD-style), ICU
(Unicode-3.0), Abseil (Apache-2.0), simdutf (MIT/Apache-2.0), fast_float (MIT/Apache-2.0) and
LLVM libc (Apache-2.0 WITH LLVM-exception). The full notices ship with the app in
`pdfium/licenses/` (copied by `pnpm fetch-pdfium`).

## Rust crates (direct dependencies)

| Crate | Used for | License |
|---|---|---|
| `tauri`, `tauri-build` | App shell | MIT OR Apache-2.0 |
| `serde`, `serde_json` | Serialization | MIT OR Apache-2.0 |
| `pdfium-render` | Rust bindings to PDFium | MIT OR Apache-2.0 |
| `crossbeam-channel` | Engine worker request lanes | MIT OR Apache-2.0 |
| `thiserror` | Error types | MIT OR Apache-2.0 |
| `tracing`, `tracing-subscriber`, `tracing-appender` | Logging to rotating files | MIT |
| `png` | PNG tile encoding | MIT OR Apache-2.0 |
| `image-webp` | WebP tile encoding | MIT OR Apache-2.0 |
| `lru` | Tile cache | MIT |
| `tauri-specta`, `specta`, `specta-typescript` | Typed IPC and generated TypeScript bindings | MIT |
| `tauri-plugin-dialog` | Native open-file dialog | MIT OR Apache-2.0 |

## JavaScript packages (direct dependencies)

| Package | Used for | License |
|---|---|---|
| `@tauri-apps/api`, `@tauri-apps/cli` | Tauri frontend API and CLI | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-dialog` | Native open-file dialog | MIT OR Apache-2.0 |
| `react`, `react-dom` | UI | MIT |
| `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, `@radix-ui/react-toggle-group` | Accessible UI primitives | MIT |
| `lucide-react` | Icons | ISC |
| `zustand` | UI state | MIT |
| `i18next`, `react-i18next` | UI strings (i18n layer) | MIT |
| `@fontsource/newsreader` | Newsreader font files (bundled, brand moments only) | OFL-1.1 (approved for fonts) |
| `vite`, `@vitejs/plugin-react` | Build tool | MIT |
| `typescript` | Type checking | Apache-2.0 |
| `@types/react`, `@types/react-dom`, `@types/node` | Type definitions | MIT |

## Development tools (not shipped)

| Package / tool | Used for | License |
|---|---|---|
| `tailwindcss`, `@tailwindcss/vite` | CSS utilities (build time) | MIT |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | Linting | MIT |
| `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | React lint rules | MIT |
| `prettier` | Formatting | MIT |
| `vitest`, `jsdom` | Unit tests | MIT |
| `@testing-library/react`, `@testing-library/dom` | Component tests | MIT |
| `cargo-deny` | License and advisory checks | MIT OR Apache-2.0 |
