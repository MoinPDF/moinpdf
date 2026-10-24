import { openSource } from './pdf-engine';
import type { ExportFile } from './advanced-types';
type Part = { path: string; bytes: number; sha256: string };
type Asset = Part & { rawBytes: number; rawSha256: string; encoding?: 'gzip'; parts?: Part[] };
export function browserOfficeUnavailable(): string | null {
  if (typeof window === 'undefined') return null;
  if (!globalThis.isSecureContext) return 'Lokales Office benötigt HTTPS oder localhost.';
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined')
    return 'Lokales Office benötigt einen Browser mit isoliertem Arbeitsspeicher. Bitte diese Seite direkt öffnen oder den eigenen Dokumentenserver wählen.';
  if (typeof DecompressionStream === 'undefined')
    return 'Dieser Browser unterstützt die lokale Office-Laufzeit nicht.';
  return null;
}
const abortCheck = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
};
const hash = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
export async function convertOfficeLocally(
  file: File,
  signal: AbortSignal,
  report?: (message: string) => void,
): Promise<ExportFile> {
  const reason = browserOfficeUnavailable();
  if (reason) throw new Error(reason);
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  if (
    !ext ||
    !['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'].includes(ext)
  )
    throw new Error('Lokales Office unterstützt Word, Excel, PowerPoint, OpenDocument und RTF.');
  if (!file.size || file.size > 40 * 1024 * 1024)
    throw new Error('Für die lokale Office-Konvertierung höchstens 40 MB verwenden.');
  abortCheck(signal);
  report?.('Office-Programmdaten werden vorbereitet …');
  const response = await fetch('/vendor/office/manifest.json', { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error('Die lokale Office-Laufzeit konnte nicht geladen werden.');
  const manifest = (await response.json()) as { version: string; files: Asset[] };
  const names = [
    'browser.worker.global.js',
    'soffice.js',
    'soffice.worker.js',
    'soffice.wasm',
    'soffice.data',
  ];
  const valid = (a: Part, max: number) =>
    typeof a.path === 'string' &&
    /^(?:chunks\/)?[a-z0-9.-]+$/.test(a.path) &&
    !a.path.includes('..') &&
    Number.isSafeInteger(a.bytes) &&
    a.bytes > 0 &&
    a.bytes <= max &&
    /^[a-f0-9]{64}$/.test(a.sha256);
  if (
    manifest.version !== '2.7.2' ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 5 ||
    !names.every((n) => manifest.files.filter((a) => a.path === n).length === 1) ||
    manifest.files.some(
      (a) =>
        !valid(a, 100 * 1024 * 1024) ||
        !Number.isSafeInteger(a.rawBytes) ||
        a.rawBytes < 1 ||
        a.rawBytes > 256 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(a.rawSha256) ||
        (/\.(wasm|data)$/.test(a.path) &&
          (a.encoding !== 'gzip' ||
            !a.parts?.length ||
            a.parts.length > 20 ||
            a.parts.some((p) => !valid(p, 8 * 1024 * 1024)) ||
            a.parts.reduce((n, p) => n + p.bytes, 0) !== a.bytes)),
    )
  )
    throw new Error('Das Office-Laufzeitmanifest ist ungültig.');
  let cache: Cache | undefined;
  try {
    cache = await caches.open('moinpdf-office-2.7.2');
  } catch {}
  const fetchAsset = async (a: Part) => {
    abortCheck(signal);
    const url = '/vendor/office/' + a.path + '?sha256=' + a.sha256;
    let bytes: Uint8Array | undefined;
    try {
      const stored = await cache?.match(url);
      if (stored) {
        const value = new Uint8Array(await stored.arrayBuffer());
        if (value.length === a.bytes && (await hash(value)) === a.sha256) bytes = value;
        else await cache?.delete(url);
      }
    } catch {}
    if (!bytes) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error('Office-Programmdaten konnten nicht geladen werden.');
      bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== a.bytes || (await hash(bytes)) !== a.sha256)
        throw new Error('Die Prüfsumme der Office-Programmdaten stimmt nicht.');
      try {
        await cache?.put(url, new Response(new Uint8Array(bytes)));
      } catch {}
    }
    abortCheck(signal);
    return bytes;
  };
  const urls: Record<string, string> = {},
    blobs: string[] = [];
  let worker: Worker | undefined;
  try {
    for (const name of names) {
      const asset = manifest.files.find((a) => a.path === name)!;
      if (!asset.parts) {
        await fetchAsset(asset);
        urls[name] = new URL(
          '/vendor/office/' + name + '?sha256=' + asset.sha256,
          location.href,
        ).href;
        continue;
      }
      const parts: Uint8Array[] = [];
      for (const part of asset.parts) parts.push(await fetchAsset(part));
      const compressed = new Uint8Array(asset.bytes);
      let offset = 0;
      for (const part of parts) {
        compressed.set(part, offset);
        offset += part.length;
      }
      if ((await hash(compressed)) !== asset.sha256)
        throw new Error('Die Office-Laufzeit ist beschädigt.');
      const raw = new Uint8Array(
        await new Response(
          new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),
        ).arrayBuffer(),
      );
      if (raw.length !== asset.rawBytes || (await hash(raw)) !== asset.rawSha256)
        throw new Error('Die entpackte Office-Laufzeit ist beschädigt.');
      abortCheck(signal);
      const url = URL.createObjectURL(
        new Blob([raw], {
          type: name === 'soffice.wasm' ? 'application/wasm' : 'application/octet-stream',
        }),
      );
      urls[name] = url;
      blobs.push(url);
    }
    const input = new Uint8Array(await file.arrayBuffer());
    abortCheck(signal);
    report?.('Dokument wird lokal konvertiert …');
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      worker = new Worker(urls['browser.worker.global.js']);
      let settled = false;
      const finish = (error?: Error, value?: Uint8Array) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        // Wait for document cleanup: a result is posted before worker-side finally.
        // The browser must terminate the whole worker tree through this owner.
        // Explicitly terminating its pthread children first can hang Chromium's
        // nested-worker shutdown; the runtime patch deliberately leaves them alive.
        const activeWorker = worker!;
        let cleaned = false;
        let gracefulTimer: ReturnType<typeof setTimeout> | undefined;
        const complete = () => {
          if (cleaned) return;
          cleaned = true;
          clearTimeout(cleanupTimer);
          clearTimeout(gracefulTimer);
          activeWorker.onmessage = null;
          activeWorker.onerror = null;
          activeWorker.terminate();
          worker = undefined;
          error ? reject(error) : resolve(value!);
        };
        // A synchronous WASM call cannot receive destroy. Cancellation must still
        // finish promptly; terminate is the bounded fallback for an unresponsive worker.
        const cleanupTimer = setTimeout(complete, 1000);
        activeWorker.onmessage = ({ data }) => {
          if (data.type === 'ready' && data.id === 3 && !gracefulTimer) {
            // The pinned runtime calls self.close() 100 ms after this acknowledgment.
            // Let that event-loop shutdown finish before the hard fallback: immediate
            // termination can race the owner and its nested pthread teardown.
            gracefulTimer = setTimeout(complete, 250);
          }
        };
        activeWorker.onerror = complete;
        try {
          activeWorker.postMessage({ type: 'destroy', id: 3 });
        } catch {
          complete();
        }
      };
      const abort = () => finish(new DOMException('Abgebrochen', 'AbortError')),
        timer = setTimeout(
          () => finish(new Error('Office-Konvertierung nach drei Minuten abgebrochen.')),
          180000,
        );
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = () =>
        finish(
          new Error(
            'Die lokale Office-Laufzeit konnte nicht gestartet werden. Freien Arbeitsspeicher und Browser prüfen.',
          ),
        );
      worker.onmessage = ({ data }) => {
        if (data.type === 'loaded')
          worker!.postMessage({
            type: 'init',
            id: 1,
            sofficeJs: urls['soffice.js'],
            sofficeWorkerJs: urls['soffice.worker.js'],
            sofficeWasm: urls['soffice.wasm'],
            sofficeData: urls['soffice.data'],
            verbose: false,
            enableProgressTracking: false,
          });
        else if (data.type === 'ready' && data.id === 1)
          worker!.postMessage(
            { type: 'convert', id: 2, inputData: input, inputExt: ext, outputFormat: 'pdf' },
            [input.buffer],
          );
        else if (data.type === 'result' && data.id === 2) {
          if (!(data.data instanceof Uint8Array) || data.data.length > 80 * 1024 * 1024)
            finish(new Error('Die Office-Ausgabe ist ungültig oder größer als 80 MB.'));
          else finish(undefined, data.data);
        } else if (data.type === 'error')
          finish(
            new Error(
              'Office konnte dieses Dokument nicht konvertieren. Bitte Dateiformat und verfügbare Speicherkapazität prüfen.',
            ),
          );
      };
    });
    abortCheck(signal);
    const filename = file.name.replace(/\.[^.]+$/, '') + '.pdf',
      source = await openSource(
        new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' }),
      );
    try {
      return {
        blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
        filename,
        kind: 'pdf',
        pages: source.pdf.numPages,
        note: 'Office-Datei lokal konvertiert. Seitenumbrüche, Schriften und Formeln im Ergebnis kontrollieren.',
      };
    } finally {
      await source.pdf.loadingTask.destroy();
    }
  } finally {
    worker?.terminate();
    for (const url of blobs) URL.revokeObjectURL(url);
  }
}
