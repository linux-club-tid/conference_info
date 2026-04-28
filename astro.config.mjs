// @ts-check
import { defineConfig } from 'astro/config';
import pkg from './package.json';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
});
