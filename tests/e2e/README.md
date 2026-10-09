# End-to-end tests

Playwright drives the real Lumora PDF app: each test starts the app with a PDF from
`tests/corpus/generated/` on its command line and connects to its WebView2 over the Chrome
DevTools protocol (no separate browser is downloaded).

```
pnpm fetch-pdfium     # once
pnpm build:e2e        # debug build with the UI embedded, in target/e2e/
pnpm test:e2e
```

The E2E build uses the identifier `com.lumora.pdf.e2e` (see `tauri.e2e.json`), so it has its own
data folder and never hands files to an installed or running Lumora PDF. Each run starts with that
data folder emptied, and each test with a fresh WebView2 profile.
