import { describe, expect, it } from "vitest";
import { folderLabel, openedWhen } from "./format";

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
