/** Whole days between two dates' calendar days (local time). */
function dayDiff(a: Date, b: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(b) - start(a)) / 86_400_000);
}

/** When a file was opened, relative to `now`. */
export type OpenedWhen =
  { kind: "today"; time: string } | { kind: "yesterday" } | { kind: "date"; date: string };

/**
 * Describes a past moment the way the recent files list shows it: the time for today,
 * "yesterday", or the date (with the year only when it isn't this year).
 */
export function openedWhen(ms: number, now: Date, locale: string): OpenedWhen {
  const then = new Date(ms);
  const days = dayDiff(then, now);
  if (days <= 0) {
    return {
      kind: "today",
      time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(then),
    };
  }
  if (days === 1) return { kind: "yesterday" };
  const sameYear = then.getFullYear() === now.getFullYear();
  return {
    kind: "date",
    date: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: sameYear ? undefined : "numeric",
    }).format(then),
  };
}

/** The folder a file is in, as its last two path components ("Documents › Lumora"). */
export function folderLabel(path: string): string {
  const parts = path.split(/[\\/]/).filter((p) => p !== "");
  parts.pop();
  return parts.slice(-2).join(" › ");
}

/** A file size in KB, MB or GB (1 KB = 1024 bytes, as Windows shows sizes). */
export function formatFileSize(bytes: number, locale: string): string {
  const units = ["bytes", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  return `${number} ${units[unit] ?? "bytes"}`;
}

/** Common paper sizes in points (portrait). */
const PAPER_SIZES: readonly { name: string; w: number; h: number }[] = [
  { name: "Letter", w: 612, h: 792 },
  { name: "Legal", w: 612, h: 1008 },
  { name: "Tabloid", w: 792, h: 1224 },
  { name: "A3", w: 841.89, h: 1190.55 },
  { name: "A4", w: 595.28, h: 841.89 },
  { name: "A5", w: 419.53, h: 595.28 },
];

/** The name of a standard paper size ("A4"), in either orientation, or null. */
export function paperName(widthPt: number, heightPt: number): string | null {
  const [short, long] = widthPt < heightPt ? [widthPt, heightPt] : [heightPt, widthPt];
  const match = PAPER_SIZES.find((p) => Math.abs(p.w - short) < 2 && Math.abs(p.h - long) < 2);
  return match?.name ?? null;
}

/** A page size in inches and millimetres: "8.5 × 11 in (216 × 279 mm)". */
export function formatPageSize(widthPt: number, heightPt: number, locale: string): string {
  const inches = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const mm = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return `${inches.format(widthPt / 72)} × ${inches.format(heightPt / 72)} in (${mm.format(
    (widthPt / 72) * 25.4,
  )} × ${mm.format((heightPt / 72) * 25.4)} mm)`;
}

/**
 * Formats an engine date ("YYYY-MM-DD HH:MM") for display, or returns it unchanged when it isn't
 * in that form (some files hold free text).
 */
export function formatDocDate(value: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return value;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: h === undefined ? undefined : "short",
  }).format(date);
}
