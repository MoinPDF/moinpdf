// PDF font character codes are not necessarily Unicode. Rebuild only the cmap
// of PDF.js's validated SFNT using its observed Unicode/glyph associations.
// Outlines, metrics, hinting, and every other font table remain untouched.
export function sfntTables(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > 16 * 1024 * 1024)
    throw new Error('Ungültige Schriftdatei.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (![0x00010000, 0x4f54544f, 0x74727565].includes(view.getUint32(0)))
    throw new Error('Nicht unterstütztes Schriftformat.');
  const count = view.getUint16(4);
  if (!count || count > 200 || 12 + count * 16 > bytes.length)
    throw new Error('Ungültige Schrifttabellen.');
  return Array.from({ length: count }, (_, i) => {
    const at = 12 + i * 16,
      offset = view.getUint32(at + 8),
      length = view.getUint32(at + 12);
    if (offset + length > bytes.length) throw new Error('Unvollständige Schriftdatei.');
    return {
      tag: String.fromCharCode(...bytes.subarray(at, at + 4)),
      data: new Uint8Array(bytes.subarray(offset, offset + length)),
    };
  });
}
function checksum(bytes: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4)
    sum =
      (sum +
        ((bytes[i] || 0) * 0x1000000 +
          ((bytes[i + 1] || 0) << 16) +
          ((bytes[i + 2] || 0) << 8) +
          (bytes[i + 3] || 0))) >>>
      0;
  return sum;
}
export function unicodeFont(bytes: Uint8Array, mapping: Map<number, number>) {
  const entries = [...mapping]
    .filter(
      ([c, g]) =>
        Number.isInteger(c) &&
        c >= 0 &&
        c <= 0x10ffff &&
        !(c >= 0xd800 && c <= 0xdfff) &&
        Number.isInteger(g) &&
        g > 0 &&
        g < 65536,
    )
    .sort((a, b) => a[0] - b[0]);
  if (!entries.length || entries.length > 100000)
    throw new Error('Die Schrift enthält keine verwendbaren Zeichen.');
  const cmap = new Uint8Array(28 + entries.length * 12),
    cv = new DataView(cmap.buffer);
  cv.setUint16(2, 1);
  cv.setUint16(4, 3);
  cv.setUint16(6, 10);
  cv.setUint32(8, 12);
  cv.setUint16(12, 12);
  cv.setUint32(16, cmap.length - 12);
  cv.setUint32(24, entries.length);
  entries.forEach(([code, glyph], i) => {
    const at = 28 + i * 12;
    cv.setUint32(at, code);
    cv.setUint32(at + 4, code);
    cv.setUint32(at + 8, glyph);
  });
  const tables = [
    ...sfntTables(bytes).filter((t) => t.tag !== 'cmap' && t.tag !== 'DSIG'),
    { tag: 'cmap', data: cmap },
  ].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const head = tables.find((t) => t.tag === 'head');
  if (!head || head.data.length < 12) throw new Error('Der Schriftkopf fehlt.');
  new DataView(head.data.buffer, head.data.byteOffset, head.data.byteLength).setUint32(8, 0);
  const align = (n: number) => (n + 3) & ~3;
  const result = new Uint8Array(
      12 + tables.length * 16 + tables.reduce((n, t) => n + align(t.data.length), 0),
    ),
    view = new DataView(result.buffer);
  result.set(bytes.subarray(0, 4));
  view.setUint16(4, tables.length);
  const power = Math.floor(Math.log2(tables.length));
  view.setUint16(6, 2 ** power * 16);
  view.setUint16(8, power);
  view.setUint16(10, tables.length * 16 - 2 ** power * 16);
  let offset = 12 + tables.length * 16,
    headOffset = 0;
  tables.forEach((table, i) => {
    const at = 12 + i * 16;
    result.set(
      [...table.tag].map((c) => c.charCodeAt(0)),
      at,
    );
    view.setUint32(at + 4, checksum(table.data));
    view.setUint32(at + 8, offset);
    view.setUint32(at + 12, table.data.length);
    result.set(table.data, offset);
    if (table.tag === 'head') headOffset = offset;
    offset += align(table.data.length);
  });
  view.setUint32(headOffset + 8, (0xb1b0afba - checksum(result)) >>> 0);
  return result;
}
export function fontFingerprint(bytes: Uint8Array, tags = ['glyf', 'CFF ', 'CFF2', 'hmtx']) {
  let a = 2166136261,
    b = 0x9e3779b9;
  // PDF.js may assign a different runtime name after reopening the same PDF.
  for (const table of sfntTables(bytes).filter((t) => tags.includes(t.tag)))
    for (const c of table.data) {
      a = Math.imul(a ^ c, 16777619);
      b = Math.imul(b ^ c, 2246822519);
    }
  return (a >>> 0).toString(16) + (b >>> 0).toString(16);
}
