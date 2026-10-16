import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';

export const WRITER_LIMIT = 12 * 1024 * 1024;
export const writerSettingsSchema = z.object({
  paper: z.enum(['A4', 'A5', 'LETTER']),
  landscape: z.boolean(),
  top: z.number().min(10).max(45),
  right: z.number().min(10).max(45),
  bottom: z.number().min(10).max(45),
  left: z.number().min(10).max(45),
  header: z.string().max(140),
  footer: z.string().max(140),
  pageNumbers: z.boolean(),
});
export type WriterSettings = z.infer<typeof writerSettingsSchema>;
export type WriterDocument = {
  kind: 'moinpdf-document';
  version: 1;
  id: string;
  title: string;
  updated: number;
  settings: WriterSettings;
  content: JSONContent;
};
export const writerDefaults: WriterSettings = {
  paper: 'A4',
  landscape: false,
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
  header: '',
  footer: '',
  pageNumbers: false,
};
// getRandomValues is available on local HTTP installations as well as HTTPS.
export function writerDocumentId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export function emptyWriterDocument(title = 'Mein Dokument'): WriterDocument {
  return {
    kind: 'moinpdf-document',
    version: 1,
    id: writerDocumentId(),
    title,
    updated: Date.now(),
    settings: { ...writerDefaults },
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}
export function writerPageSize(settings: WriterSettings) {
  const sizes = { A4: [210, 297], A5: [148, 210], LETTER: [215.9, 279.4] };
  const size = sizes[settings.paper];
  return settings.landscape ? [size[1], size[0]] : [...size];
}
export function writerFilename(title: string, extension: 'pdf' | 'moindoc') {
  return (
    (title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 140) || 'Dokument') +
    '.' +
    extension
  );
}
export function writerColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return '#' + [...value.slice(1)].map((c) => c + c).join('');
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
  if (rgb && rgb.slice(1).every((n) => +n <= 255))
    return (
      '#' +
      rgb
        .slice(1)
        .map((n) => (+n).toString(16).padStart(2, '0'))
        .join('')
    );
  return undefined;
}
export function localWriterImage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 3 * 1024 * 1024 &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

// Only the editor's document schema is persisted or exported. No executable HTML,
// remote image URLs, arbitrary CSS or links are carried into a reopened draft.
export function normalizeWriterContent(value: unknown): JSONContent {
  let nodes = 0,
    characters = 0,
    images = 0;
  const allowed = new Set([
    'doc',
    'paragraph',
    'heading',
    'text',
    'hardBreak',
    'horizontalRule',
    'blockquote',
    'bulletList',
    'orderedList',
    'listItem',
    'image',
    'table',
    'tableRow',
    'tableHeader',
    'tableCell',
    'pageBreak',
  ]);
  function visit(input: unknown, depth: number): JSONContent {
    if (
      depth > 20 ||
      ++nodes > 20000 ||
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    )
      throw new Error('Ungültiger oder zu umfangreicher Dokumentinhalt.');
    const v = input as JSONContent;
    if (!v.type || !allowed.has(v.type)) throw new Error('Unbekannter Dokumentinhalt.');
    const n: JSONContent = { type: v.type };
    const attrs = v.attrs || {};
    if (v.type === 'text') {
      if (typeof v.text !== 'string' || !v.text.length) throw new Error('Ungültiger Dokumenttext.');
      characters += v.text.length;
      if (characters > 300000)
        throw new Error('Das Dokument darf höchstens 300.000 Zeichen enthalten.');
      n.text = v.text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    }
    if (['paragraph', 'heading'].includes(v.type)) {
      n.attrs = {
        textAlign: ['left', 'center', 'right', 'justify'].includes(attrs.textAlign)
          ? attrs.textAlign
          : 'left',
      };
      const lineHeight = Number.parseFloat(attrs.lineHeight);
      if (Number.isFinite(lineHeight)) n.attrs.lineHeight = Math.min(2.5, Math.max(1, lineHeight));
      if (v.type === 'heading') n.attrs.level = [1, 2, 3].includes(attrs.level) ? attrs.level : 1;
    }
    if (v.type === 'orderedList')
      n.attrs = { start: Math.min(9999, Math.max(1, Number(attrs.start) || 1)) };
    if (v.type === 'image') {
      if (!localWriterImage(attrs.src) || ++images > 20)
        throw new Error('Bitte höchstens 20 lokale PNG- oder JPG-Bilder verwenden.');
      n.attrs = {
        src: attrs.src,
        alt: String(attrs.alt || '').slice(0, 300),
        widthPercent: Math.min(100, Math.max(10, Number(attrs.widthPercent) || 100)),
      };
    }
    if (['tableCell', 'tableHeader'].includes(v.type)) {
      const colspan = Number(attrs.colspan) || 1,
        rowspan = Number(attrs.rowspan) || 1;
      if (
        !Number.isInteger(colspan) ||
        colspan < 1 ||
        colspan > 12 ||
        !Number.isInteger(rowspan) ||
        rowspan < 1 ||
        rowspan > 100
      )
        throw new Error('Die Tabelle ist zu groß.');
      n.attrs = { colspan, rowspan, colwidth: null };
    }
    if (v.marks) {
      if (!Array.isArray(v.marks) || v.marks.length > 10)
        throw new Error('Ungültige Textformatierung.');
      n.marks = v.marks.flatMap((mark) => {
        if (['bold', 'italic', 'underline', 'strike'].includes(mark.type))
          return [{ type: mark.type }];
        if (mark.type !== 'textStyle') return [];
        const a = mark.attrs || {},
          clean: Record<string, unknown> = {};
        for (const key of ['color', 'backgroundColor']) {
          const color = writerColor(a[key]);
          if (color) clean[key] = color;
        }
        if (['MoinSans', 'MoinSerif', 'MoinMono'].includes(a.fontFamily))
          clean.fontFamily = a.fontFamily;
        if (typeof a.fontSize === 'string' && /^\d+(\.\d+)?(pt|px)$/.test(a.fontSize)) {
          const pt = parseFloat(a.fontSize) * (a.fontSize.endsWith('px') ? 0.75 : 1);
          clean.fontSize = Math.min(72, Math.max(6, pt)) + 'pt';
        }
        return Object.keys(clean).length ? [{ type: 'textStyle', attrs: clean }] : [];
      });
    }
    if (v.content) {
      if (!Array.isArray(v.content)) throw new Error('Ungültiger Dokumentinhalt.');
      n.content = v.content.map((child) => visit(child, depth + 1));
    }
    if (
      ['paragraph', 'heading'].includes(v.type) &&
      n.content?.some((c) => !['text', 'hardBreak'].includes(c.type!))
    )
      throw new Error('Ungültiger Absatz.');
    if (v.type === 'table') {
      if (
        !n.content?.length ||
        n.content.length > 100 ||
        n.content.some((row) => row.type !== 'tableRow')
      )
        throw new Error('Die Tabelle ist zu groß oder ungültig.');
      const occupied: boolean[][] = [];
      let width = 0;
      n.content.forEach((row, y) => {
        if (
          !row.content?.length ||
          row.content.some((cell) => !['tableCell', 'tableHeader'].includes(cell.type!))
        )
          throw new Error('Ungültige Tabellenzeile.');
        occupied[y] ||= [];
        let x = 0;
        for (const cell of row.content) {
          while (occupied[y][x]) x++;
          const { colspan, rowspan } = cell.attrs!;
          if (x + colspan > 12 || y + rowspan > n.content!.length)
            throw new Error('Ungültige Tabellenabmessungen.');
          for (let yy = y; yy < y + rowspan; yy++) {
            occupied[yy] ||= [];
            for (let xx = x; xx < x + colspan; xx++) {
              if (occupied[yy][xx]) throw new Error('Überlappende Tabellenzellen.');
              occupied[yy][xx] = true;
            }
          }
          x += colspan;
        }
        width = Math.max(width, occupied[y].length);
      });
      if (
        occupied.some(
          (row) =>
            row.length !== width || Array.from({ length: width }, (_, i) => row[i]).some((v) => !v),
        )
      )
        throw new Error('Unvollständige Tabelle.');
    }
    return n;
  }
  const result = visit(value, 0);
  if (result.type !== 'doc' || !result.content?.length) throw new Error('Ungültiges Dokument.');
  return result;
}

const envelope = z.object({
  kind: z.literal('moinpdf-document'),
  version: z.literal(1),
  id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
  title: z.string().max(160),
  updated: z.number().finite().nonnegative(),
  settings: writerSettingsSchema,
  content: z.unknown(),
});
export function validateWriterDocument(value: unknown): WriterDocument {
  const result = envelope.safeParse(value);
  if (!result.success) throw new Error('Diese Datei ist kein gültiger MoinPDF-Dokumententwurf.');
  if (JSON.stringify(value).length > WRITER_LIMIT)
    throw new Error('Der Entwurf darf höchstens 12 MB groß sein.');
  return { ...result.data, content: normalizeWriterContent(result.data.content) };
}
export function encodeWriterDocument(value: WriterDocument) {
  return new Blob([JSON.stringify(validateWriterDocument(value))], { type: 'application/json' });
}
export async function decodeWriterDocument(file: Blob) {
  if (file.size > WRITER_LIMIT) throw new Error('Der Entwurf darf höchstens 12 MB groß sein.');
  try {
    return validateWriterDocument(JSON.parse(await file.text()));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error('Die Entwurfsdatei konnte nicht gelesen werden.');
    throw error;
  }
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('moinpdf-document-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () =>
      reject(new Error('Der Entwurfsspeicher wird in einem anderen Tab verwendet.'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', mode),
      req = action(tx.objectStore('drafts'));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || req.error || new Error('Entwurf konnte nicht gespeichert werden.'));
    };
  });
}
export async function saveWriterDraft(value: WriterDocument) {
  await transaction('readwrite', (store) => store.put(validateWriterDocument(value)));
}
export async function listWriterDrafts() {
  const values = await transaction('readonly', (store) => store.getAll());
  return values.map(validateWriterDocument).sort((a, b) => b.updated - a.updated);
}
export async function deleteWriterDraft(id: string) {
  await transaction('readwrite', (store) => store.delete(id));
}
