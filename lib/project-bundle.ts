import { z } from 'zod';
import { contentDigest } from './content-digest';
import { projectStateSchema, validateProjectReferences } from './project-archive';
import type { ProjectArchive, ProjectSource, ProjectState } from './local-projects';

const magic = new TextEncoder().encode('MOINPDF-ARCHIVE\n');
const headerSize = 64;
const maxVersionBytes = 80 * 1024 * 1024;
const maxManifest = 100 * 1024 * 1024;
export const MAX_PROJECT_ARCHIVE = headerSize + maxManifest + 5 * maxVersionBytes;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z
  .string()
  .min(1)
  .max(250)
  .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v));
const sourceSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(1000),
    size: z.number().int().min(0).max(maxVersionBytes),
    kind: z.enum(['pdf', 'image', 'invoice']),
    wasEncrypted: z.boolean().optional(),
    pdf: digest,
    invoice: z
      .object({ name: z.string().min(1).max(1000), part: digest })
      .strict()
      .optional(),
  })
  .strict();
const manifestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    updated: z.number().int().nonnegative(),
    versions: z
      .array(
        z
          .object({
            created: z.number().int().nonnegative(),
            state: projectStateSchema,
            sources: z.array(sourceSchema).min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    parts: z
      .array(z.object({ digest, length: z.number().int().min(1).max(maxVersionBytes) }).strict())
      .min(1)
      .max(2000),
  })
  .strict();
const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
};
const hashBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!, (s) => parseInt(s, 16));
export async function isProjectArchive(file: Blob) {
  const start = new Uint8Array(await file.slice(0, magic.length).arrayBuffer());
  return magic.every((value, index) => start[index] === value);
}
export async function encodeProjectArchive(archive: ProjectArchive, signal?: AbortSignal) {
  check(signal);
  const pool = new Map<string, Uint8Array>();
  const add = async (bytes: Uint8Array) => {
    const hash = await contentDigest(bytes, signal);
    if (!pool.has(hash)) pool.set(hash, bytes);
    return hash;
  };
  const versions = [];
  for (const version of archive.versions) {
    validateProjectReferences(version.state, version.sources);
    if (
      version.sources.reduce(
        (sum, s) => sum + s.bytes.length + (s.invoiceOriginal?.bytes.length || 0),
        0,
      ) > maxVersionBytes
    )
      throw new Error('Ein Arbeitsstand darf höchstens 80 MB Dokumentdaten enthalten.');
    const sources = [];
    for (const s of version.sources)
      sources.push({
        id: s.id,
        name: s.name,
        size: s.size,
        kind: s.kind,
        wasEncrypted: s.wasEncrypted,
        pdf: await add(s.bytes),
        invoice: s.invoiceOriginal
          ? { name: s.invoiceOriginal.name, part: await add(s.invoiceOriginal.bytes) }
          : undefined,
      });
    versions.push({ created: version.created, state: version.state, sources });
  }
  const parsed = manifestSchema.safeParse({
    name: archive.name,
    updated: archive.updated,
    versions,
    parts: [...pool].map(([digest, bytes]) => ({ digest, length: bytes.length })),
  });
  if (!parsed.success) throw new Error('Das Projektarchiv enthält ungültige Arbeitsstände.');
  const json = new TextEncoder().encode(JSON.stringify(parsed.data));
  const total = headerSize + json.length + [...pool.values()].reduce((n, b) => n + b.length, 0);
  if (json.length > maxManifest || total > MAX_PROJECT_ARCHIVE)
    throw new Error('Das Projektarchiv überschreitet die Grenze von 500 MB.');
  const header = new Uint8Array(headerSize),
    view = new DataView(header.buffer);
  header.set(magic);
  view.setUint32(16, 1);
  view.setUint32(20, json.length);
  view.setUint32(24, total);
  header.set(hashBytes(await contentDigest(json, signal)), 32);
  check(signal);
  // Blob parts avoid constructing a second, complete in-memory archive buffer.
  return new Blob([header, json, ...[...pool.values()].map((b) => new Blob([new Uint8Array(b)]))], {
    type: 'application/vnd.moinpdf.archive',
  });
}
export async function decodeProjectArchive(
  file: Blob,
  signal?: AbortSignal,
): Promise<ProjectArchive> {
  check(signal);
  if (file.size < headerSize || file.size > MAX_PROJECT_ARCHIVE)
    throw new Error('Das Projektarchiv ist beschädigt oder größer als 500 MB.');
  const header = new Uint8Array(await file.slice(0, headerSize).arrayBuffer()),
    view = new DataView(header.buffer);
  if (!magic.every((value, index) => header[index] === value))
    throw new Error('Das ist kein MoinPDF-Projektarchiv.');
  if (view.getUint32(16) !== 1)
    throw new Error(
      'Diese Archivversion wird noch nicht unterstützt. Bitte MoinPDF aktualisieren.',
    );
  const length = view.getUint32(20);
  if (
    length < 2 ||
    length > maxManifest ||
    headerSize + length > file.size ||
    view.getUint32(24) !== file.size ||
    view.getUint32(28) !== 0
  )
    throw new Error('Das Projektarchiv ist beschädigt oder unvollständig.');
  const json = new Uint8Array(await file.slice(headerSize, headerSize + length).arrayBuffer());
  if (
    !hashBytes(await contentDigest(json, signal)).every(
      (value, index) => header[32 + index] === value,
    )
  )
    throw new Error('Die Archivbeschreibung ist beschädigt.');
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json), (key, val) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('Ungültiger Schlüssel');
      return val;
    });
  } catch {
    throw new Error('Die Archivbeschreibung ist ungültig.');
  }
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('Das Projektarchiv enthält ungültige Daten oder Einstellungen.');
  const manifest = parsed.data,
    pool = new Map<string, Uint8Array>(),
    used = new Set<string>();
  let offset = headerSize + length;
  for (const part of manifest.parts) {
    check(signal);
    if (pool.has(part.digest) || offset + part.length > file.size)
      throw new Error('Das Archiv enthält doppelte oder fehlende Dokumentteile.');
    const bytes = new Uint8Array(await file.slice(offset, offset + part.length).arrayBuffer());
    if ((await contentDigest(bytes, signal)) !== part.digest)
      throw new Error('Eine Datei im Projektarchiv ist beschädigt.');
    pool.set(part.digest, bytes);
    offset += part.length;
  }
  if (offset !== file.size) throw new Error('Das Projektarchiv enthält unerwartete Daten.');
  const take = (hash: string) => {
    const bytes = pool.get(hash);
    if (!bytes) throw new Error('Ein Arbeitsstand verweist auf fehlende Dokumentdaten.');
    used.add(hash);
    return bytes;
  };
  const versions = manifest.versions.map((version) => {
    const sources: ProjectSource[] = version.sources.map(({ pdf, invoice, ...source }) => {
      const bytes = take(pdf);
      if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-'))
        throw new Error('Eine enthaltene Datei ist keine PDF.');
      return {
        ...source,
        bytes,
        invoiceOriginal: invoice ? { name: invoice.name, bytes: take(invoice.part) } : undefined,
      };
    });
    if (
      sources.reduce((sum, s) => sum + s.bytes.length + (s.invoiceOriginal?.bytes.length || 0), 0) >
      maxVersionBytes
    )
      throw new Error('Ein Arbeitsstand überschreitet die Grenze von 80 MB Dokumentdaten.');
    const state = version.state as ProjectState;
    validateProjectReferences(state, sources);
    return { created: version.created, state, sources };
  });
  if (used.size !== pool.size)
    throw new Error('Das Archiv enthält nicht zugeordnete Dokumentdaten.');
  check(signal);
  return { name: manifest.name, updated: manifest.updated, versions };
}
