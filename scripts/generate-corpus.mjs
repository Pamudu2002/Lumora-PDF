#!/usr/bin/env node
// Generates the synthetic part of the test corpus (tests/corpus/generated/). These files are made
// by Lumora and released under CC0-1.0.
//
//   node scripts/generate-corpus.mjs            # small files, committed (Git LFS)
//   node scripts/generate-corpus.mjs --large    # also tests/corpus/large/ (>100 MB, not committed)
//
// Output is deterministic: re-running produces identical bytes.
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "tests", "corpus", "generated");
const largeDir = join(root, "tests", "corpus", "large");

/** A tiny PDF writer: objects are strings or { dict, data } streams; object 1 is the catalog. */
class PdfBuilder {
  constructor() {
    this.objects = [];
  }
  /** Reserves an object number. */
  ref() {
    this.objects.push(null);
    return this.objects.length;
  }
  set(num, value) {
    this.objects[num - 1] = value;
    return num;
  }
  add(value) {
    return this.set(this.ref(), value);
  }
  stream(dict, data, { compress = true } = {}) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, "latin1");
    const body = compress ? deflateSync(raw, { level: 9 }) : raw;
    const filter = compress ? " /Filter /FlateDecode" : "";
    return this.add({ dict: `<< ${dict}${filter} /Length ${body.length} >>`, data: body });
  }
  /** Serializes with the given catalog and info object numbers. */
  toBuffer(catalog, info) {
    const chunks = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    let offset = chunks[0].length;
    const offsets = [];
    this.objects.forEach((obj, i) => {
      offsets.push(offset);
      const parts =
        typeof obj === "string"
          ? [Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, "latin1")]
          : [
              Buffer.from(`${i + 1} 0 obj\n${obj.dict}\nstream\n`, "latin1"),
              obj.data,
              Buffer.from("\nendstream\nendobj\n", "latin1"),
            ];
      for (const p of parts) {
        chunks.push(p);
        offset += p.length;
      }
    });
    const n = this.objects.length + 1;
    let xref = `xref\n0 ${n}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
    const infoRef = info ? ` /Info ${info} 0 R` : "";
    xref += `trailer\n<< /Size ${n} /Root ${catalog} 0 R${infoRef} >>\nstartxref\n${offset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, "latin1"));
    return Buffer.concat(chunks);
  }
}

/** Builds a document from page specs: { w, h, rotate?, content, xobjects? }. */
function buildDoc(title, pages) {
  const pdf = new PdfBuilder();
  const catalog = pdf.ref();
  const pagesRef = pdf.ref();
  const font = pdf.add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const info = pdf.add(`<< /Title (${title}) /Producer (Lumora corpus generator) >>`);
  const kids = pages.map((p) => {
    const content = pdf.stream("", p.content);
    const xobjects = Object.entries(p.xobjects ?? {})
      .map(([name, ref]) => `/${name} ${ref} 0 R`)
      .join(" ");
    const rotate = p.rotate ? ` /Rotate ${p.rotate}` : "";
    return pdf.add(
      `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${p.w} ${p.h}]${rotate} /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> /XObject << ${xobjects} >> >> >>`,
    );
  });
  pdf.set(
    pagesRef,
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
  );
  pdf.set(catalog, `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);
  return { pdf, catalog, info };
}

function write(dir, name, { pdf, catalog, info }) {
  mkdirSync(dir, { recursive: true });
  const buf = pdf.toBuffer(catalog, info);
  writeFileSync(join(dir, name), buf);
  console.log(`${name.padEnd(28)} ${(buf.length / 1024).toFixed(1).padStart(8)} KB`);
}

const text = (size, x, y, s) => `BT /F1 ${size} Tf ${x} ${y} Td (${s}) Tj ET\n`;

/** Deterministic pseudo-random numbers (mulberry32). */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A grayscale "scanned page": light noise with dark bars where text lines would be. */
function scanImage(width, height, seed) {
  const rand = rng(seed);
  const px = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    // Every 22 px, a 9 px band of "text".
    const lineBand = y > 80 && y < height - 80 && (y - 80) % 22 < 9;
    const lineLen = width - 120 - Math.floor(rand() * 200);
    for (let x = 0; x < width; x++) {
      let v = 235 + Math.floor(rand() * 20);
      if (lineBand && x > 60 && x < lineLen && rand() > 0.35) v = 40 + Math.floor(rand() * 40);
      px[y * width + x] = v;
    }
  }
  return px;
}

function long(pageCount) {
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    let c = text(24, 72, 720, `Page ${i} of ${pageCount}`);
    for (let l = 0; l < 30; l++) {
      c += text(
        10,
        72,
        680 - l * 18,
        `Line ${l + 1}: The quick brown fox jumps over the lazy dog on page ${i}.`,
      );
    }
    pages.push({ w: 612, h: 792, content: c });
  }
  return buildDoc(`Long document (${pageCount} pages)`, pages);
}

function rotations() {
  const pages = [0, 90, 180, 270].map((rotate) => ({
    w: 612,
    h: 792,
    rotate,
    content:
      text(36, 72, 700, `Rotate ${rotate}`) +
      text(12, 72, 660, "This text reads upright on the unrotated page.") +
      "0.8 0.1 0.1 rg 72 72 100 40 re f\n" +
      text(10, 72, 60, "Red box marks the bottom-left corner."),
  }));
  return buildDoc("Page rotations", pages);
}

function mixedSizes() {
  const sizes = [
    ["Letter", 612, 792],
    ["A4", 595.28, 841.89],
    ["A3 landscape", 1190.55, 841.89],
    ["Tiny 1 inch", 72, 72],
    ["Banner", 2000, 200],
  ];
  return buildDoc(
    "Mixed page sizes",
    sizes.map(([name, w, h]) => ({
      w,
      h,
      content:
        `0.05 0.4 0.4 RG 4 w 2 2 ${w - 4} ${h - 4} re S\n` +
        text(Math.min(24, h / 4), 10, h / 2, name),
    })),
  );
}

function scanned(pageCount) {
  // Each page is one image XObject and nothing else: no text layer.
  const fresh = new PdfBuilder();
  const cat = fresh.ref();
  const pagesRef = fresh.ref();
  const inf = fresh.add(
    "<< /Title (Scanned pages, no text layer) /Producer (Lumora corpus generator) >>",
  );
  const kids = [];
  for (let i = 0; i < pageCount; i++) {
    const [w, h] = [850, 1100];
    const img = fresh.stream(
      `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8`,
      scanImage(w, h, 1000 + i),
    );
    const content = fresh.stream("", "q 612 0 0 792 0 0 cm /Im0 Do Q\n");
    kids.push(
      fresh.add(
        `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /XObject << /Im0 ${img} 0 R >> >> >>`,
      ),
    );
  }
  fresh.set(
    pagesRef,
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
  );
  fresh.set(cat, `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);
  return { pdf: fresh, catalog: cat, info: inf };
}

function hugeMediaBox() {
  return buildDoc("Absurd MediaBox", [{ w: 1e7, h: 1e7, content: text(1000, 100, 100, "Huge") }]);
}

function zeroPages() {
  return buildDoc("No pages", []);
}

write(outDir, "long-250-pages.pdf", long(250));
write(outDir, "rotations.pdf", rotations());
write(outDir, "mixed-page-sizes.pdf", mixedSizes());
write(outDir, "scanned-image-only.pdf", scanned(3));
write(outDir, "huge-mediabox.pdf", hugeMediaBox());
write(outDir, "zero-pages.pdf", zeroPages());

if (process.argv.includes("--large")) {
  // >100 MB: 120 pages of uncompressed-looking noise (incompressible), written page by page.
  const doc = new PdfBuilder();
  const cat = doc.ref();
  const pagesRef = doc.ref();
  const kids = [];
  const rand = rng(42);
  for (let i = 0; i < 120; i++) {
    const [w, h] = [1000, 1000];
    const noise = Buffer.alloc(w * h);
    for (let j = 0; j < noise.length; j++) noise[j] = Math.floor(rand() * 256);
    const img = doc.stream(
      `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8`,
      noise,
      { compress: false },
    );
    const content = doc.stream("", `q 612 0 0 792 0 0 cm /Im0 Do Q\n`);
    kids.push(
      doc.add(
        `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /XObject << /Im0 ${img} 0 R >> >> >>`,
      ),
    );
  }
  doc.set(
    pagesRef,
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
  );
  doc.set(cat, `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);
  mkdirSync(largeDir, { recursive: true });
  const out = createWriteStream(join(largeDir, "over-100mb.pdf"));
  out.end(doc.toBuffer(cat));
  console.log("over-100mb.pdf written to tests/corpus/large/ (not committed)");
}
