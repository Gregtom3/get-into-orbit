import { defineConfig } from "vite";

// base is set at build time so the same config works locally and on GitHub Pages
// (GH Pages serves at /<repo>/, locally we want /).
export default defineConfig({
  base: process.env.GH_PAGES === "1" ? "/get-into-orbit/" : "/",
  build: {
    target: "es2020",
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
