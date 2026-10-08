#!/usr/bin/env node
// Checks that every production JavaScript dependency uses an allowed license
// (docs/LUMORA_PDF_PLAN.md section 1). Run: `pnpm check-licenses`.
import { execFileSync } from "node:child_process";

const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Zlib",
  "MPL-2.0",
  "Unicode-3.0",
  "CC0-1.0",
  "0BSD",
]);

// Font packages may use the SIL Open Font License (approved for bundled fonts such as Newsreader;
// see CLAUDE.md "UI rules"). Only packages named here get the exception.
const OFL_FONT_PACKAGES = new Set(["@fontsource/newsreader"]);

/** True when an SPDX expression is satisfied by the allow-list (simple AND/OR, no nesting). */
function isAllowed(expression, name) {
  if (expression === "OFL-1.1" && OFL_FONT_PACKAGES.has(name)) {
    return true;
  }
  const cleaned = expression.replace(/[()]/g, "").trim();
  return cleaned
    .split(/\s+OR\s+/)
    .some((alternative) => alternative.split(/\s+AND\s+/).every((id) => ALLOWED.has(id.trim())));
}

const output = execFileSync("pnpm", ["licenses", "list", "--json", "--prod"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
const byLicense = JSON.parse(output);

const violations = [];
let count = 0;
for (const [license, packages] of Object.entries(byLicense)) {
  for (const pkg of packages) {
    count += 1;
    if (!isAllowed(license, pkg.name)) {
      violations.push(`${pkg.name}@${pkg.versions.join(",")}: ${license}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Packages with licenses outside the allow-list:");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`License check passed (${count} production packages).`);
