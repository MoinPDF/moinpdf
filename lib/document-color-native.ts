import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import { inspectNativeObjectTree, type NativeChange } from './native-pdf-core';
import { editNativeDocument } from './nested-native';

export async function recolorDocumentText(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  pages: number[],
  color: string,
) {
  if (
    !/^#[0-9a-f]{6}$/i.test(color) ||
    !pages.length ||
    pages.length > 200 ||
    new Set(pages).size !== pages.length ||
    pages.some((p) => !Number.isInteger(p) || p < 0)
  )
    throw new Error('Ungültige Farbauswahl.');
  let result: Uint8Array = bytes.slice();
  for (const page of pages) {
    const groups = new Map<string, { path: number[]; changes: NativeChange[] }>();
    for (const object of inspectNativeObjectTree(api, result, page)) {
      if (object.type !== 'text' || object.textMode === 3) continue;
      if (![0, 1, 2].includes(object.textMode ?? -1))
        throw new Error('Text mit einer Maskierungsfunktion kann nicht sicher umgefärbt werden.');
      const path = object.path || [],
        key = path.join('/');
      if (!groups.has(key)) groups.set(key, { path, changes: [] });
      groups.get(key)!.changes.push({ index: object.index, color });
    }
    for (const group of [...groups.values()].sort((a, b) => b.path.length - a.path.length))
      result = await editNativeDocument(api, result, page, group.changes, group.path);
  }
  return result;
}
