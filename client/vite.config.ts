import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("../shared", import.meta.url)),
      "#server": fileURLToPath(new URL("../server/src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4100",
      "/xrpc": "http://localhost:4100",
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../dist/client", import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        dashboard: fileURLToPath(new URL("dashboard.html", import.meta.url)),
      },
    },
  },
});
