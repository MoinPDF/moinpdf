import {
  createNativeEngine,
  inspectNativeObjects,
  editNativeObjects,
  removeNativeRegions,
  replaceNativeParagraph,
} from '../lib/native-pdf-core';
self.onmessage = async ({ data }) => {
  try {
    const response = await fetch('/vendor/pdfium/pdfium.wasm');
    if (!response.ok) throw new Error('Der lokale PDF-Prozessor konnte nicht geladen werden.');
    const api = await createNativeEngine(new Uint8Array(await response.arrayBuffer()));
    const value =
      data.action === 'inspect'
        ? inspectNativeObjects(api, data.bytes, data.page)
        : data.action === 'edit'
          ? editNativeObjects(api, data.bytes, data.page, data.changes)
          : data.action === 'redact'
            ? removeNativeRegions(api, data.bytes, data.removals)
            : data.action === 'paragraph'
              ? replaceNativeParagraph(api, data.bytes, data.page, data.settings)
              : null;
    if (value === null) throw new Error('Unbekannter Auftrag.');
    if (value instanceof Uint8Array) self.postMessage({ value }, { transfer: [value.buffer] });
    else if (value && typeof value === 'object' && 'bytes' in value)
      self.postMessage({ value }, { transfer: [value.bytes.buffer] });
    else self.postMessage({ value });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Die PDF konnte nicht verarbeitet werden.',
    });
  } finally {
    self.close();
  }
};
