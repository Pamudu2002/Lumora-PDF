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

## Rust crates (direct dependencies)

| Crate | Used for | License |
|---|---|---|
| `tauri`, `tauri-build` | App shell | MIT OR Apache-2.0 |
| `serde`, `serde_json` | Serialization | MIT OR Apache-2.0 |

## JavaScript packages (direct dependencies)

| Package | Used for | License |
|---|---|---|
| `@tauri-apps/api`, `@tauri-apps/cli` | Tauri frontend API and CLI | MIT OR Apache-2.0 |
| `react`, `react-dom` | UI | MIT |
| `vite`, `@vitejs/plugin-react` | Build tool | MIT |
| `typescript` | Type checking | Apache-2.0 |
| `@types/react`, `@types/react-dom`, `@types/node` | Type definitions | MIT |
