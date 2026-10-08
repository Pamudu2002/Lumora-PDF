import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Options for `tauri dev` / `tauri build`:
  // 1. don't hide Rust errors
  clearScreen: false,
  // 2. Tauri expects a fixed port; fail if it is taken
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    // 3. don't watch the Rust side
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
  },
});
