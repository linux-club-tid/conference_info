// @ts-check
import { defineConfig } from "astro/config";
import pkg from "./package.json";

// https://astro.build/config
export default defineConfig({
  site: "https://conference-info-9m8.pages.dev",
  output: "static",
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
});
