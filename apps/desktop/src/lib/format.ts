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
