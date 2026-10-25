/**
 * Blob workers inherit the document's embedder policy. Hosted static assets
 * currently omit COEP even when the document uses require-corp. Our active
 * offline worker supplies that policy for direct worker responses; use its
 * HTTP scope so nested workers and module imports remain controlled offline.
 */
export function createLocalModuleWorker(url: string) {
  const entry = new URL(url, location.href);
  if (!['http:', 'https:'].includes(entry.protocol) || entry.origin !== location.origin)
    throw new Error('Ungültige Adresse für den lokalen Hintergrundprozess.');

  if (
    typeof navigator !== 'undefined' &&
    navigator.serviceWorker?.controller?.scriptURL === new URL('/sw.js', location.href).href
  ) {
    const worker = new Worker(entry.href, { type: 'module' });
    let disposed = false;
    return {
      worker,
      dispose() {
        if (disposed) return;
        disposed = true;
        worker.terminate();
      },
    };
  }

  // Import the real entry rather than copying it: its own import.meta.url and
  // relative module/WASM imports retain the emitted HTTP base. Root-relative
  // fetches inside jobs also need that base, not the bootstrap's blob URL.
  const href = JSON.stringify(entry.href);
  const bootstrap = new Blob(
    [
      `import ${href};\n` +
        `const nativeFetch = self.fetch.bind(self);\n` +
        `self.fetch = (input, init) => nativeFetch(\n` +
        `  typeof input === 'string' || input instanceof URL ? new URL(input, ${href}) : input, init);\n`,
    ],
    { type: 'text/javascript' },
  );
  const objectUrl = URL.createObjectURL(bootstrap);
  let worker: Worker;
  try {
    worker = new Worker(objectUrl, { type: 'module' });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
  let disposed = false;
  return {
    worker,
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.terminate();
      URL.revokeObjectURL(objectUrl);
    },
  };
}
