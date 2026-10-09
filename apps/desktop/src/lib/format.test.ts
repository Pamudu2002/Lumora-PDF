import { describe, expect, it } from "vitest";
import {
  folderLabel,
  formatDocDate,
  formatFileSize,
  formatPageSize,
  openedWhen,
  paperName,
} from "./format";

describe("openedWhen", () => {
  const now = new Date(2026, 9, 9, 15, 30);

  it("shows the time for today and the word for yesterday", () => {
    expect(openedWhen(new Date(2026, 9, 9, 0, 46).getTime(), now, "en-GB")).toEqual({
      kind: "today",
      time: "00:46",
    });
    expect(openedWhen(new Date(2026, 9, 8, 23, 59).getTime(), now, "en-GB")).toEqual({
      kind: "yesterday",
    });
  });

  it("shows the date, with the year only for other years", () => {
    expect(openedWhen(new Date(2026, 9, 6).getTime(), now, "en-GB")).toEqual({
      kind: "date",
      date: "6 Oct",
    });
    expect(openedWhen(new Date(2025, 8, 28).getTime(), now, "en-GB")).toEqual({
      kind: "date",
      date: "28 Sept 2025",
    });
  });
});

describe("folderLabel", () => {
  it("shows the last two folders", () => {
    expect(folderLabel("C:\\Users\\me\\Documents\\Lumora\\plan.pdf")).toBe("Documents › Lumora");
    expect(folderLabel("/home/me/plan.pdf")).toBe("home › me");
    expect(folderLabel("C:\\plan.pdf")).toBe("C:");
  });
});

describe("formatFileSize", () => {
  it("uses the largest whole unit", () => {
    expect(formatFileSize(512, "en")).toBe("512 bytes");
    expect(formatFileSize(1536, "en")).toBe("1.5 KB");
    expect(formatFileSize(1.25 * 1024 * 1024, "en")).toBe("1.3 MB");
    expect(formatFileSize(150 * 1024 * 1024, "en")).toBe("150 MB");
  });
});

describe("page sizes", () => {
  it("names standard paper sizes in either orientation", () => {
    expect(paperName(612, 792)).toBe("Letter");
    expect(paperName(842, 595)).toBe("A4");
    expect(paperName(500, 500)).toBeNull();
  });

  it("shows inches and millimetres", () => {
    expect(formatPageSize(612, 792, "en")).toBe("8.5 × 11 in (216 × 279 mm)");
  });
});

describe("formatDocDate", () => {
  it("formats engine dates and keeps anything else", () => {
    expect(formatDocDate("2024-03-05 14:07", "en-GB")).toBe("5 Mar 2024, 14:07");
    expect(formatDocDate("2024-03-05", "en-GB")).toBe("5 Mar 2024");
    expect(formatDocDate("last Tuesday", "en-GB")).toBe("last Tuesday");
  });
});
