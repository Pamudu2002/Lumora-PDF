#!/usr/bin/env node
// Downloads prebuilt PDFium (bblanchon/pdfium-binaries, no V8/XFA, so PDF JavaScript is not compiled in)
// for the current platform into apps/desktop/src-tauri/resources/pdfium/.
//
//   pnpm fetch-pdfium                  # current platform
//   pnpm fetch-pdfium -- --target win-arm64
//   pnpm fetch-pdfium -- --force       # re-download even if the version matches
//
// The PDFium build must match the `pdfium_XXXX` feature of `pdfium-render` (crates/lumora-engine).
// To update: bump PDFIUM_BUILD + the checksums below, the feature in lumora-engine/Cargo.toml, and
// THIRD_PARTY_LICENSES.md. See the plan, section 7 (keep PDFium updated).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PDFIUM_BUILD = "7881";

/** SHA-256 of each release asset (from the GitHub release's published digests). */
const TARGETS = {
  "win-x64": {
    sha256: "73cc0de638ac2095e7445bf56a38200a5b7c7ca0e9f4ba144598f2457377ac08",
    lib: "bin/pdfium.dll",
  },
  "win-arm64": {
    sha256: "d3035d4d2cacac6ecd1a2ece197a3d702a1b2a58466276b9f870b8cb278a9d84",
    lib: "bin/pdfium.dll",
  },
  "linux-x64": {
    sha256: "1470e21b8b4a3b4ad7f85684e2da11d94f3b69a86d81dee11b9b6709d927ac1d",
    lib: "lib/libpdfium.so",
  },
  "linux-arm64": {
    sha256: "ee7f7b7d5468958336a818c1cd580bdd20972846b7377b13f9a923d92d1d4674",
    lib: "lib/libpdfium.so",
  },
  "mac-x64": {
    sha256: "6dedf83990e0e3d6b7c93c9e7589c5a126b0ae14b7464d76120cff7a26afb18b",
    lib: "lib/libpdfium.dylib",
  },
  "mac-arm64": {
    sha256: "52e94ca5aa8847934330daf3f8150c190682c5ca93831468794f8b90d4392e40",
    lib: "lib/libpdfium.dylib",
  },
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "apps", "desktop", "src-tauri", "resources", "pdfium");

function currentTarget() {
  const os = { win32: "win", linux: "linux", darwin: "mac" }[process.platform];
  const arch = { x64: "x64", arm64: "arm64" }[process.arch];
  if (!os || !arch) {
    throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
  }
  return `${os}-${arch}`;
}

/**
 * On Windows use the built-in bsdtar: a GNU tar from Git Bash/MSYS earlier on PATH reads "C:\..." as a
 * remote host.
 */
function tarCommand() {
  if (process.platform === "win32") {
    return join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  }
  return "tar";
}

function parseArgs(argv) {
  const args = { target: undefined, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target") args.target = argv[++i];
    else if (argv[i] === "--force") args.force = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target ?? currentTarget();
  const spec = TARGETS[target];
  if (!spec) {
    throw new Error(`Unknown target "${target}". Known: ${Object.keys(TARGETS).join(", ")}`);
  }

  const versionFile = join(outDir, "VERSION.lumora");
  const libName = spec.lib.split("/").pop();
  const stamp = `chromium/${PDFIUM_BUILD} ${target}`;
  if (
    !args.force &&
    existsSync(versionFile) &&
    existsSync(join(outDir, libName)) &&
    readFileSync(versionFile, "utf8").trim() === stamp
  ) {
    console.log(`PDFium ${stamp} is already in ${outDir}`);
    return;
  }

  const asset = `pdfium-${target}.tgz`;
  const url = `https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F${PDFIUM_BUILD}/${asset}`;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  const archive = Buffer.from(await response.arrayBuffer());

  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== spec.sha256) {
    throw new Error(`Checksum mismatch for ${asset}: expected ${spec.sha256}, got ${digest}`);
  }

  // Extract into an empty temp directory with the system `tar` (built into Windows 10+, Linux, macOS).
  const work = mkdtempSync(join(tmpdir(), "lumora-pdfium-"));
  try {
    const archivePath = join(work, asset);
    const extractDir = join(work, "x");
    mkdirSync(extractDir);
    writeFileSync(archivePath, archive);
    execFileSync(tarCommand(), ["-xzf", archivePath, "-C", extractDir], { stdio: "inherit" });

    mkdirSync(outDir, { recursive: true });
    copyFileSync(join(extractDir, spec.lib), join(outDir, libName));
    // PDFium and its bundled third-party notices (FreeType, libjpeg-turbo, ICU, …) ship with the app.
    rmSync(join(outDir, "licenses"), { recursive: true, force: true });
    cpSync(join(extractDir, "licenses"), join(outDir, "licenses"), { recursive: true });
    copyFileSync(
      join(extractDir, "LICENSE"),
      join(outDir, "licenses", "pdfium-binaries-build.txt"),
    );
    if (existsSync(join(extractDir, "VERSION"))) {
      copyFileSync(join(extractDir, "VERSION"), join(outDir, "VERSION"));
    }
    writeFileSync(versionFile, `${stamp}\n`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`PDFium ${stamp} installed in ${outDir}`);
}

main().catch((err) => {
  console.error(`fetch-pdfium: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
