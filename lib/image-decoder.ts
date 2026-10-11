export function decodeSpecialImage(
  bytes: Uint8Array,
  kind: 'heic' | 'psd',
  signal?: AbortSignal,
): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Abgebrochen', 'AbortError'));
      return;
    }
    const worker = new Worker('/workers/image-decode.js');
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException('Abgebrochen', 'AbortError'));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          'Die Bildverarbeitung hat das Zeitlimit überschritten. Bitte eine kleinere Datei verwenden.',
        ),
      );
    }, 90000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      finish();
      reject(
        new Error('Der Bilddecoder konnte nicht ausgeführt werden. Bitte die Seite neu laden.'),
      );
    };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      const { width, height, rgba } = data;
      if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width * height > 40000000 ||
        !(rgba instanceof ArrayBuffer) ||
        rgba.byteLength !== width * height * 4
      ) {
        reject(new Error('Der Bilddecoder lieferte ungültige Daten.'));
        return;
      }
      resolve({ width, height, rgba: new Uint8ClampedArray(rgba) });
    };
    const transferred = bytes.slice();
    worker.postMessage({ kind, bytes: transferred.buffer }, [transferred.buffer]);
  });
}
