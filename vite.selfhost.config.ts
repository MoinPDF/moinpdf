import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The PDF workplace is a client application. This build needs no hosting SDK,
// Cloudflare worker, database, or external account session at runtime.
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  worker: {format: 'es'},
  root: fileURLToPath(new URL('./selfhost', import.meta.url)),
  publicDir: root + 'public',
  plugins: [react(), {
    name: 'moinpdf-bundle-budget',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        // These upstream modules contain embedded font/layout tables and cannot
        // be split internally. Both stay deferred; application chunks retain
        // the 500 kB cap. The PDF writer runtime loads only for preview/export.
        const limit = item.name === 'font-parser' ? 750_000 : item.name === 'document-pdf-runtime' ? 1_050_000 : 500_000;
        if (Buffer.byteLength(item.code) > limit) {
          this.error(`${item.fileName} (${Buffer.byteLength(item.code)} bytes) exceeds its ${limit / 1000} kB JavaScript budget.`);
        }
      }
    },
  }],
  resolve: {alias: {'@': root}},
  define: {__MOINPDF_SELF_HOSTED__: true},
  css: {postcss: root},
  build: {
    outDir: root + 'dist/selfhost',
    emptyOutDir: true,
    // The plugin above enforces individual budgets, including the unavoidable
    // single-module font parser, instead of relying on a global size warning.
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {name: 'document-pdf-runtime', test: /node_modules\/pdfmake\/build\//, priority: 40},
            {name: 'deflate-codec', test: /node_modules\/pako\//, priority: 40},
            {name: 'font-parser', test: /node_modules\/@pdf-lib\/fontkit\//, priority: 30},
            {name: 'pdf-core', test: /node_modules\/pdf-lib\//, priority: 20},
            {name: 'react-runtime', test: /node_modules\/(?:react|react-dom|scheduler)\//, priority: 20},
            {name: 'ui-controls', test: /node_modules\/(?:@radix-ui\/|@base-ui\/|radix-ui\/|cmdk\/)/, priority: 15},
          ],
        },
      },
    },
  },
});
