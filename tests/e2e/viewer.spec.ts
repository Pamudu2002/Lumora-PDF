import type { Page } from "@playwright/test";
import { expect, test, waitForTiles } from "./app";

// A generated 250-page document: page N has a heading "Page N of 250" and 30 lines
// "Line i: The quick brown fox jumps over the lazy dog on page N."
test.use({ open: ["long-250-pages.pdf"] });

const pageField = (page: Page) => page.getByRole("textbox", { name: /Page number/ });
const zoomLevel = (page: Page) => page.getByRole("button", { name: /Zoom level/ });
const documentView = (page: Page) => page.locator("[data-document-view]");

test("opens a PDF passed on the command line", async ({ app: { page } }) => {
  await expect(page.getByRole("tab", { name: "long-250-pages.pdf", selected: true })).toBeVisible();
  await expect(pageField(page)).toHaveValue("1");
  await waitForTiles(page);
  await expect(page.getByRole("group", { name: "Page 1" })).toBeVisible();
});

test("scrolls through the document, mounting only the pages near the view", async ({
  app: { page },
}) => {
  await waitForTiles(page);
  await documentView(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2;
  });
  await expect.poll(async () => Number(await pageField(page).inputValue())).toBeGreaterThan(120);
  expect(Number(await pageField(page).inputValue())).toBeLessThan(130);
  expect(await page.locator('[role="group"][data-page]').count()).toBeLessThanOrEqual(6);
  await waitForTiles(page);

  await documentView(page).focus();
  await page.keyboard.press("End");
  await expect(pageField(page)).toHaveValue("250");
});

test("zooms with the keyboard and the zoom menu", async ({ app: { page } }) => {
  await waitForTiles(page);
  await documentView(page).focus();
  await page.keyboard.press("Control+0");
  await expect(zoomLevel(page)).toHaveText("100%");
  await page.keyboard.press("Control+Equal");
  await expect(zoomLevel(page)).toHaveText("125%");
  await page.keyboard.press("Control+Minus");
  await expect(zoomLevel(page)).toHaveText("100%");

  await zoomLevel(page).click();
  await page.getByRole("menuitem", { name: "200%" }).click();
  await expect(zoomLevel(page)).toHaveText("200%");
  await waitForTiles(page);
  // Tiles are rendered for the new zoom (scale 2 × 96/72 × devicePixelRatio).
  const src = await page.locator('[role="group"] img').last().getAttribute("src");
  expect(src).toMatch(/\/tile\/\d+\/\d+\/\d+\//);
});

test("finds text and goes to the match", async ({ app: { page } }) => {
  await waitForTiles(page);
  await page.keyboard.press("Control+f");
  const field = page.getByRole("textbox", { name: "Find in document" });
  await expect(field).toBeFocused();
  await field.fill("lazy dog on page 120.");
  await expect(page.locator('[role="search"] [aria-live]')).toHaveText("1 of 30");
  await expect(pageField(page)).toHaveValue("120");
  await expect(page.locator('[data-search-hit="active"]')).toBeVisible();

  await field.press("Enter");
  await expect(page.locator('[role="search"] [aria-live]')).toHaveText("2 of 30");
  await field.press("Escape");
  await expect(page.locator("[data-search-hit]")).toHaveCount(0);
});

test("selects text and copies it with line breaks", async ({ app: { page } }) => {
  await waitForTiles(page);
  const layer = page.locator('[data-text-layer="0"]');
  const heading = layer.locator("span", { hasText: "Page 1 of 250" });
  const line2 = layer.locator("span", { hasText: "Line 2:" });
  await expect(heading).toBeVisible();
  const from = await heading.boundingBox();
  const to = await line2.boundingBox();
  if (!from || !to) throw new Error("text layer not laid out");

  await page.mouse.move(from.x + 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();

  const copied = await documentView(page).evaluate((el) => {
    const data = new DataTransfer();
    el.dispatchEvent(
      new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true }),
    );
    return data.getData("text/plain");
  });
  expect(copied.split("\n")).toEqual([
    "Page 1 of 250",
    "Line 1: The quick brown fox jumps over the lazy dog on page 1.",
    expect.stringMatching(/^Line 2: The quick brown fox jumps over the lazy dog on page 1/),
  ]);
});
