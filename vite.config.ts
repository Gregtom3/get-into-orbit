import { defineConfig } from "vite";

// Use a relative base so the built bundle works whether the site is served at
// "/", "/get-into-orbit/", or any other sub-path. This makes deployment
// portable across GitHub Pages (root or project), custom domains, and local
// preview without configuration changes.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
