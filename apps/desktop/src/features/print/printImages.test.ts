import { describe, expect, it } from "vitest";
import { parsePageRange, printPageUrl, printScaleMilli } from "./printImages";

describe("parsePageRange", () => {
  it("reads pages and ranges, one-based, without repeats", () => {
    expect(parsePageRange("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
    expect(parsePageRange(" 8 ;2–3, 3 ", 10)).toEqual([7, 1, 2]);
    expect(parsePageRange("10", 10)).toEqual([9]);
  });

  it("rejects pages outside the document and anything that isn't a page", () => {
    for (const text of ["", " , ", "0", "11", "3-2", "1-11", "a", "1-", "-2", "1.5"]) {
      expect(parsePageRange(text, 10)).toBeNull();
    }
  });
});

describe("print images", () => {
  it("prints at 300 dpi unless the page is huge", () => {
    expect(printScaleMilli({ widthPt: 612, heightPt: 792 })).toBe(4166);
    // A 100-inch banner would be 30,000 px at 300 dpi; it is capped at 8192 px.
    expect(printScaleMilli({ widthPt: 7200, heightPt: 720 })).toBe(1137);
  });

  it("builds print URLs", () => {
    expect(
      printPageUrl({ docId: 2, page: 4, scaleMilli: 4166, rev: 1 }, "lumora://localhost/"),
    ).toBe("lumora://localhost/print/2/4/4166?rev=1");
  });
});
