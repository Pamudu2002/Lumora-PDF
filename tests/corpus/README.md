# Test corpus

PDFs used by the engine's corpus test (`cargo test -p lumora-engine --test corpus`) and the golden
render test (`cargo test -p lumora-engine --features golden --test golden`). Every file is listed in
[`manifest.json`](manifest.json) with its category, source, license and expected behaviour.

PDFs here are stored with **Git LFS** (see `.gitattributes`). Run `git lfs install` once before
cloning, or `git lfs pull` after.

## Rules

- **Only redistributable files.** Every file needs a license that allows redistribution (BSD,
  Apache, MIT, CC0, CC-BY, public domain) recorded in the manifest. Never commit customer files,
  personal documents or anything you can't share.
- Private or large files go in `tests/corpus/private/` or `tests/corpus/large/`; both are ignored by
  git. Tests skip them when absent.
- When you fix a rendering bug, add the smallest file that reproduces it and a golden image
  (`LUMORA_UPDATE_GOLDEN=1 cargo test -p lumora-engine --features golden --test golden`).

## Sources

| Folder | Source | License |
|---|---|---|
| `pdfium/` | PDFium's own test files, [`testing/resources`](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/testing/resources/) at the commit in `pdfium/SOURCE_COMMIT.txt` | BSD-3-Clause (`pdfium/LICENSE.txt`) |
| `generated/` | Made by `node scripts/generate-corpus.mjs` (deterministic) | CC0-1.0 |
| `large/` | `node scripts/generate-corpus.mjs --large` (500 pages, >100 MB; not committed) | CC0-1.0 |

## Manifest fields

| Field | Meaning |
|---|---|
| `file` | Path relative to this folder |
| `category` | One of the categories below |
| `source`, `license` | Where it came from and under what license |
| `expect` | Result of opening **without** a password: `open`, or an engine error kind (`malformed`, `passwordRequired`, …) |
| `pages` | Page count once open |
| `password` | Password that opens the file (encrypted files) |
| `notes` | Why the file is interesting |

## Categories

| Category | Have | Notes |
|---|---|---|
| `text` | 7 | Plain, compressed streams, fonts, colors, render modes |
| `text-layout` | 2 | Vertical text, right-to-left (Hebrew) |
| `rotated` | 4 | Rotated text, images and /Rotate 0–270 pages |
| `page-sizes` | 1 | Mixed sizes in one file |
| `images` | 1 | Embedded images |
| `scanned` | 1 | Image-only pages, no text layer |
| `huge-page-count` | 1 | 250 pages |
| `forms` | 6 | Text, combo, list, mixed and clickable fields |
| `encrypted` | 5 | RC4 (R2, R3) and AES-256 (R5, R6) with user passwords |
| `annotations` | 7 | Highlight, ink, stamp, polygon, line, links |
| `links`, `outline`, `signatures`, `attachments`, `tagged`, `linearized`, `javascript` | 1 each | |
| `malformed` | 11 | Broken trailers, xref loops, bad dictionaries, absurd MediaBox, zero pages |

**Still missing** (add as redistributable files are found): CJK, Indic (Sinhala, Tamil, Devanagari)
and Arabic text with embedded fonts; files over 100 MB in git (use `large/`); annotations created by
Adobe Acrobat; real scanned documents. Target: 500 files over time.
