#!/usr/bin/env node
// Builds the app for the E2E tests: a debug build with the web UI embedded, a separate identifier
// (its own data folder and single-instance lock, so it never talks to an installed Lumora) and
// its own Cargo target folder. Run: `pnpm build:e2e` from the repo root.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@lumora/desktop",
    "tauri",
    "build",
    "--debug",
    "--no-bundle",
    "--config",
    join(here, "tauri.e2e.json"),
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, CARGO_TARGET_DIR: join(root, "target", "e2e") },
  },
);
process.exit(result.status ?? 1);
