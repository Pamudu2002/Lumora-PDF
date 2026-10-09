// Starts the E2E build of Lumora PDF and connects Playwright to its WebView2 over the Chrome
// DevTools protocol. Each test gets a fresh app process with its own WebView2 profile.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, test as base, type Browser, type Page } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, "../..");
export const CORPUS = join(REPO, "tests", "corpus", "generated");

/** The binary `pnpm build:e2e` produces. */
export const APP_EXE = join(
  REPO,
  "target",
  "e2e",
  "debug",
  process.platform === "win32" ? "lumora-pdf.exe" : "lumora-pdf",
);

/** The E2E build's data folder (recent files, settings); see tauri.e2e.json. */
export const APP_DATA = join(
  process.env.LOCALAPPDATA ?? join(process.env.HOME ?? tmpdir(), ".local", "share"),
  "com.lumora.pdf.e2e",
);

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => {
        resolvePort(port);
      });
    });
  });
}

const sleep = (ms: number) =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

export interface RunningApp {
  page: Page;
  close: () => Promise<void>;
}

/** Starts the app with `args` (PDF paths open as tabs) and returns its page once the UI is up. */
export async function launchApp(args: string[] = []): Promise<RunningApp> {
  if (!existsSync(APP_EXE)) {
    throw new Error(`${APP_EXE} not found. Build it first: pnpm build:e2e`);
  }
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "lumora-e2e-"));
  const child: ChildProcess = spawn(APP_EXE, args, {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
      WEBVIEW2_USER_DATA_FOLDER: profile,
    },
    stdio: "ignore",
  });

  let browser: Browser | undefined;
  const deadline = Date.now() + 30_000;
  while (!browser) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch (err) {
      if (Date.now() > deadline || child.exitCode !== null) {
        child.kill();
        throw new Error(`Lumora did not start: ${String(err)}`);
      }
      await sleep(250);
    }
  }
  let page: Page | undefined;
  while (!page) {
    page = browser
      .contexts()[0]
      ?.pages()
      .find((p) => /tauri\.localhost|lumora/.test(p.url()));
    if (!page) {
      if (Date.now() > deadline) throw new Error("Lumora's window did not appear");
      await sleep(100);
    }
  }
  await page.locator("#root > *").first().waitFor();

  return {
    page,
    close: async () => {
      await browser.close().catch(() => undefined);
      const exited = new Promise((done) => child.once("exit", done));
      child.kill();
      await Promise.race([exited, sleep(5000)]);
      // WebView2 helper processes may hold the profile a moment longer; a leftover temp folder
      // is harmless, so don't fail the test over it.
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch {
        // Left for the OS temp cleanup.
      }
    },
  };
}

/** Empties the E2E build's data folder (recent files, saved views, settings). */
export function resetAppData(): void {
  rmSync(APP_DATA, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

/** Waits until every tile image on screen has loaded. */
export async function waitForTiles(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll<HTMLImageElement>('[role="group"] img')];
    return tiles.length > 0 && tiles.every((img) => img.complete && img.naturalWidth > 0);
  });
}

/** A test with a running app; `open` names corpus files to start it with. */
export const test = base.extend<{ open: string[]; app: RunningApp }>({
  open: [[], { option: true }],
  app: async ({ open }, use) => {
    // No recent files or saved views from earlier tests: every test starts from a clean slate.
    resetAppData();
    const app = await launchApp(open.map((file) => join(CORPUS, file)));
    await use(app);
    await app.close();
  },
});

export { expect } from "@playwright/test";
