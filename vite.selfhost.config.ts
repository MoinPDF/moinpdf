import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The PDF workplace is a client application. This build needs no hosting SDK,
// Cloudflare worker, database, or ChatGPT session at runtime.
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./selfhost', import.meta.url)),
  publicDir: root + 'public',
  plugins: [react()],
  resolve: {alias: {'@': root}},
  define: {__MOINPDF_SELF_HOSTED__: true},
  css: {postcss: root},
  build: {outDir: root + 'dist/selfhost', emptyOutDir: true},
});
