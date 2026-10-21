export {};

// Register before loading HarfBuzz: its asynchronous WASM initialization must not
// leave the worker without a listener when the first job arrives.
self.onmessage = async ({ data }) => {
  try {
    const {
      createNativeEngine,
      groupNativeObjects,
      inspectNativeObjects,
      inspectNativeObjectTree,
      readNativeImage,
      removeNativeRegions,
      replaceNativeParagraph,
    } = await import('../lib/native-pdf-core');
    const response = await fetch('/vendor/pdfium/pdfium.wasm');
    if (!response.ok) throw new Error('Der lokale PDF-Prozessor konnte nicht geladen werden.');
    const api = await createNativeEngine(new Uint8Array(await response.arrayBuffer()));
    const value =
      data.action === 'image'
        ? readNativeImage(api, data.bytes, data.page, data.index, data.path || [], data.region)
        : data.action === 'tree'
          ? inspectNativeObjectTree(api, data.bytes, data.page)
          : data.action === 'group'
            ? groupNativeObjects(api, data.bytes, data.page, data.indices, data.duplicate)
            : data.action === 'inspect'
              ? inspectNativeObjects(api, data.bytes, data.page, data.path || [])
              : data.action === 'edit'
                ? await (
                    await import('../lib/nested-native')
                  ).editNativeDocument(api, data.bytes, data.page, data.changes, data.path || [])
                : data.action === 'redact'
                  ? removeNativeRegions(api, data.bytes, data.removals)
                  : data.action === 'paragraph'
                    ? await replaceNativeParagraph(api, data.bytes, data.page, data.settings)
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
