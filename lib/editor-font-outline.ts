/** Freeze CFF1, CFF2 and variable SFNT contours to unhinted quadratic TrueType.
 * Glyph IDs are retained and advance widths come from the chosen instance.
 * Unsupported metric variations fail rather than silently changing layout.
 */
type Table = { tag: string; data: Uint8Array };
type Point = { x: number; y: number; on: boolean };
type Command = { command: string; args: number[] };
type CffDictionary = {
  length?: number;
  FontMatrix?: number[];
  FDArray?: CffDictionary[];
  Private?: { Subrs: unknown[]; nominalWidthX: number; defaultWidthX: number } | null;
};
type OutlineFace = {
  numGlyphs: number;
  unitsPerEm: number;
  'CFF '?: { topDict: CffDictionary };
  CFF2?: { topDict: CffDictionary };
  getVariation: (coordinates: Record<string, number>) => OutlineFace;
  getGlyph: (id: number) => { advanceWidth: number; path: { commands: Command[] } };
};
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_GLYPHS = 8192;
const MAX_POINTS = 16384;
const MAX_TOTAL_POINTS = 1000000;
const fail = (message: string): never => {
  throw new Error(`Schriftkonturen: ${message}`);
};
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const aligned = (n: number) => Math.ceil(n / 4) * 4;

export function readOutlineTables(bytes: Uint8Array): Table[] {
  if (bytes.length < 12 || bytes.length > MAX_BYTES) fail('ungültige Dateigröße');
  const v = view(bytes),
    signature = v.getUint32(0),
    count = v.getUint16(4);
  if (![0x00010000, 0x4f54544f, 0x74727565].includes(signature)) fail('kein unterstütztes SFNT');
  if (!count || count > 200 || 12 + count * 16 > bytes.length)
    fail('ungültiges Tabellenverzeichnis');
  const result: Table[] = [],
    spans: [number, number][] = [],
    tags = new Set<string>();
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16,
      tag = String.fromCharCode(...bytes.subarray(p, p + 4));
    const start = v.getUint32(p + 8),
      length = v.getUint32(p + 12),
      end = start + length;
    if (tags.has(tag) || start < 12 + count * 16 || start % 4 || end > bytes.length)
      fail('ungültige Tabelle');
    if (length && spans.some(([a, b]) => a < end && start < b)) fail('überlappende Tabellen');
    tags.add(tag);
    if (length) spans.push([start, end]);
    result.push({ tag, data: Uint8Array.from(bytes.subarray(start, end)) });
  }
  return result;
}

export function outlineChecksum(bytes: Uint8Array) {
  let total = 0;
  for (let i = 0; i < bytes.length; i += 4)
    total =
      (total +
        (((bytes[i] || 0) << 24) |
          ((bytes[i + 1] || 0) << 16) |
          ((bytes[i + 2] || 0) << 8) |
          (bytes[i + 3] || 0))) >>>
      0;
  return total;
}

export function writeOutlineSfnt(input: Table[], signature = 0x00010000) {
  const tables = input
    .map(({ tag, data }) => ({ tag, data: Uint8Array.from(data) }))
    .sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const head = tables.find((t) => t.tag === 'head');
  if (!head || head.data.length < 54) fail('head fehlt');
  view(head!.data).setUint32(8, 0);
  const length = 12 + tables.length * 16 + tables.reduce((n, t) => n + aligned(t.data.length), 0);
  if (length > MAX_BYTES) fail('Ergebnis zu groß');
  const bytes = new Uint8Array(length),
    v = view(bytes),
    power = 2 ** Math.floor(Math.log2(tables.length));
  v.setUint32(0, signature);
  v.setUint16(4, tables.length);
  v.setUint16(6, power * 16);
  v.setUint16(8, Math.log2(power));
  v.setUint16(10, tables.length * 16 - power * 16);
  let offset = 12 + tables.length * 16,
    headOffset = 0;
  tables.forEach((t, i) => {
    const p = 12 + i * 16;
    for (let j = 0; j < 4; j++) bytes[p + j] = t.tag.charCodeAt(j);
    v.setUint32(p + 4, outlineChecksum(t.data));
    v.setUint32(p + 8, offset);
    v.setUint32(p + 12, t.data.length);
    bytes.set(t.data, offset);
    if (t.tag === 'head') headOffset = offset;
    offset += aligned(t.data.length);
  });
  v.setUint32(headOffset + 8, (0xb1b0afba - outlineChecksum(bytes)) >>> 0);
  return bytes;
}

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  on: false,
});
/** Convex-hull bound on the difference of two cubic Beziers. */
function cubic(points: Point[], a: Point, b: Point, c: Point, d: Point, depth = 0) {
  if (points.length > MAX_POINTS) fail('zu viele Kurvenpunkte');
  const q = {
    x: (-a.x + 3 * b.x + 3 * c.x - d.x) / 4,
    y: (-a.y + 3 * b.y + 3 * c.y - d.y) / 4,
    on: false,
  };
  const error = Math.max(
    Math.hypot(b.x - (a.x + 2 * q.x) / 3, b.y - (a.y + 2 * q.y) / 3),
    Math.hypot(c.x - (d.x + 2 * q.x) / 3, c.y - (d.y + 2 * q.y) / 3),
  );
  if (error <= 0.25) {
    points.push(q, { ...d, on: true });
    return;
  }
  if (depth >= 16) fail('Kurve außerhalb der Genauigkeitsgrenze');
  const ab = midpoint(a, b),
    bc = midpoint(b, c),
    cd = midpoint(c, d),
    abc = midpoint(ab, bc),
    bcd = midpoint(bc, cd),
    middle = midpoint(abc, bcd);
  cubic(points, a, ab, abc, middle, depth + 1);
  cubic(points, middle, bcd, cd, d, depth + 1);
}

function glyphData(commands: Command[]) {
  if (commands.length > MAX_POINTS) fail('zu viele Pfadbefehle');
  const points: Point[] = [],
    ends: number[] = [];
  let current: Point | undefined,
    start = 0;
  const finish = () => {
    if (points.length > start) ends.push(points.length - 1);
    start = points.length;
    current = undefined;
  };
  for (const item of commands) {
    const { command, args } = item;
    const expected: Record<string, number> = {
      moveTo: 2,
      lineTo: 2,
      quadraticCurveTo: 4,
      bezierCurveTo: 6,
      closePath: 0,
    };
    if (
      !(command in expected) ||
      args.length !== expected[command] ||
      args.some((x) => !Number.isFinite(x) || Math.abs(x) > 32767)
    )
      fail('ungültiger Pfad');
    const point = (at: number, on = true): Point => ({ x: args[at], y: args[at + 1], on });
    if (command === 'moveTo') {
      finish();
      current = point(0);
      points.push(current);
    } else if (command === 'closePath') finish();
    else {
      if (!current) fail('Pfad ohne Startpunkt');
      if (command === 'lineTo') {
        current = point(0);
        points.push(current);
      } else if (command === 'quadraticCurveTo') {
        points.push(point(0, false));
        current = point(2);
        points.push(current);
      } else {
        const end = point(4);
        cubic(points, current!, point(0), point(2), end);
        current = end;
      }
    }
    if (points.length > MAX_POINTS || ends.length > 4096) fail('zu komplexe Konturen');
  }
  finish();
  if (!points.length)
    return { bytes: new Uint8Array(), count: 0, contours: 0, bounds: [0, 0, 0, 0] };
  for (const p of points) {
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
  }
  const bounds = [
    Math.min(...points.map((p) => p.x)),
    Math.min(...points.map((p) => p.y)),
    Math.max(...points.map((p) => p.x)),
    Math.max(...points.map((p) => p.y)),
  ];
  const bytes = new Uint8Array(aligned(12 + ends.length * 2 + points.length * 5)),
    v = view(bytes);
  v.setInt16(0, ends.length);
  bounds.forEach((n, i) => v.setInt16(2 + i * 2, n));
  ends.forEach((n, i) => v.setUint16(10 + i * 2, n));
  const flags = 12 + ends.length * 2,
    xs = flags + points.length,
    ys = xs + points.length * 2;
  let lastX = 0,
    lastY = 0;
  points.forEach((p, i) => {
    const dx = p.x - lastX,
      dy = p.y - lastY;
    if (dx < -32768 || dx > 32767 || dy < -32768 || dy > 32767)
      fail('Punktabstand außerhalb TrueType-Bereich');
    bytes[flags + i] = p.on ? 1 : 0;
    v.setInt16(xs + i * 2, dx);
    v.setInt16(ys + i * 2, dy);
    lastX = p.x;
    lastY = p.y;
  });
  return { bytes, count: points.length, contours: ends.length, bounds };
}

export type EditorFontAxis = { tag: string; min: number; default: number; max: number };
export function editorFontAxes(bytes: Uint8Array): EditorFontAxis[] {
  const table = readOutlineTables(bytes).find((t) => t.tag === 'fvar')?.data;
  if (!table) return [];
  if (table.length < 16) fail('ungültige variable Schrift');
  const v = view(table),
    start = v.getUint16(4),
    count = v.getUint16(8),
    size = v.getUint16(10);
  if (
    v.getUint32(0) !== 0x10000 ||
    !count ||
    count > 16 ||
    size < 20 ||
    start < 16 ||
    start + count * size > table.length
  )
    fail('ungültige variable Achsen');
  const axes: EditorFontAxis[] = [];
  for (let i = 0; i < count; i++) {
    const offset = start + i * size,
      tag = String.fromCharCode(...table.subarray(offset, offset + 4));
    const axis = {
      tag,
      min: v.getInt32(offset + 4) / 65536,
      default: v.getInt32(offset + 8) / 65536,
      max: v.getInt32(offset + 12) / 65536,
    };
    if (
      !/^[\x20-\x7e]{4}$/.test(tag) ||
      axes.some((a) => a.tag === tag) ||
      axis.min > axis.default ||
      axis.default > axis.max
    )
      fail('ungültige variable Achse');
    axes.push(axis);
  }
  return axes;
}

export async function normalizeEditorOutline(
  bytes: Uint8Array,
  coordinates: Record<string, number> = {},
): Promise<Uint8Array> {
  const tables = readOutlineTables(bytes),
    byTag = new Map(tables.map((t) => [t.tag, t]));
  const axes = editorFontAxes(bytes),
    variable = axes.length > 0;
  const instance: Record<string, number> = {};
  for (const key of Object.keys(coordinates))
    if (!axes.some((a) => a.tag === key)) fail('unbekannte variable Achse');
  for (const axis of axes) {
    const value = coordinates[axis.tag] ?? axis.default;
    if (!Number.isFinite(value) || value < axis.min || value > axis.max)
      fail('Achsenwert außerhalb des Schriftschnitts');
    instance[axis.tag] = value;
  }
  if (byTag.has('gvar') && !variable) fail('variable Konturen ohne Achsen');
  if (axes.some((a) => instance[a.tag] !== a.default) && (byTag.has('MVAR') || byTag.has('VVAR')))
    fail(
      'dieser variable Schriftschnitt verändert nicht unterstützte globale oder vertikale Metriken',
    );
  if (!byTag.has('CFF ') && !byTag.has('CFF2') && !variable) {
    if (!byTag.has('glyf') || !byTag.has('loca')) fail('keine unterstützten Konturen');
    return Uint8Array.from(bytes);
  }
  if (
    ((byTag.has('CFF ') || byTag.has('CFF2')) && (byTag.has('glyf') || byTag.has('loca'))) ||
    (byTag.has('CFF ') && byTag.has('CFF2'))
  )
    fail('gemischte Konturformate');
  for (const tag of ['head', 'hhea', 'hmtx', 'maxp', 'cmap', 'name', 'OS/2', 'post'])
    if (!byTag.has(tag)) fail(`${tag} fehlt`);
  if (byTag.has('CFF ') && byTag.get('CFF ')!.data[0] !== 1) fail('kein CFF1');
  if (byTag.has('CFF2') && byTag.get('CFF2')!.data[0] !== 2) fail('kein CFF2');
  const head = byTag.get('head')!.data,
    hhea = byTag.get('hhea')!.data;
  if (head.length < 54 || hhea.length < 36) fail('unvollständige Metriken');
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  const original = fontkit.create(Uint8Array.from(bytes)) as unknown as OutlineFace;
  const face = variable ? original.getVariation(instance) : original;
  const count = face.numGlyphs,
    units = face.unitsPerEm;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_GLYPHS ||
    !Number.isInteger(units) ||
    units < 16 ||
    units > 16384
  )
    fail('ungültige Schriftgröße');
  const cff = face['CFF '] || face.CFF2,
    matrix =
      cff?.topDict?.FontMatrix ||
      (byTag.has('CFF2') ? [1 / units, 0, 0, 1 / units, 0, 0] : undefined);
  if (
    cff &&
    (!matrix ||
      matrix.length !== 6 ||
      matrix.some(
        (n: number, i: number) =>
          !Number.isFinite(n) || Math.abs(n - (i === 0 || i === 3 ? 1 / units : 0)) > 1e-8,
      ))
  )
    fail('nicht unterstützte Schriftmatrix');
  // A zero-sized Private DICT at offset 0 is valid CFF1, but fontkit 1.1.1
  // treats the zero pointer as null. Defaults apply only to that empty dict.
  const dicts = face['CFF '] ? face['CFF '].topDict.FDArray || [face['CFF '].topDict] : [];
  for (const dict of dicts)
    if (dict.Private == null) {
      if (dict.length !== 0) fail('fehlendes Private DICT');
      dict.Private = { Subrs: [], nominalWidthX: 0, defaultWidthX: 0 };
    }
  const metrics = view(hhea).getUint16(34);
  if (
    metrics < 1 ||
    metrics > count ||
    byTag.get('hmtx')!.data.length < metrics * 4 + (count - metrics) * 2
  )
    fail('ungültige Glyphenbreiten');
  const glyphs: ReturnType<typeof glyphData>[] = [];
  const advances: number[] = [];
  let totalPoints = 0,
    glyfSize = 0,
    maxPoints = 0,
    maxContours = 0;
  const bounds = [0, 0, 0, 0];
  for (let id = 0; id < count; id++) {
    const glyph = face.getGlyph(id);
    if (
      !glyph ||
      !Number.isFinite(glyph.advanceWidth) ||
      glyph.advanceWidth < 0 ||
      glyph.advanceWidth > 65535
    )
      fail('ungültige Glyphe');
    const converted = glyphData(glyph.path.commands);
    advances.push(Math.round(glyph.advanceWidth));
    totalPoints += converted.count;
    glyfSize += converted.bytes.length;
    if (totalPoints > MAX_TOTAL_POINTS || glyfSize > MAX_BYTES) fail('Konturgröße überschritten');
    maxPoints = Math.max(maxPoints, converted.count);
    maxContours = Math.max(maxContours, converted.contours);
    bounds[0] = Math.min(bounds[0], converted.bounds[0]);
    bounds[1] = Math.min(bounds[1], converted.bounds[1]);
    bounds[2] = Math.max(bounds[2], converted.bounds[2]);
    bounds[3] = Math.max(bounds[3], converted.bounds[3]);
    glyphs.push(converted);
  }
  const glyf = new Uint8Array(glyfSize),
    loca = new Uint8Array((count + 1) * 4),
    lv = view(loca);
  let offset = 0;
  glyphs.forEach((g, i) => {
    lv.setUint32(i * 4, offset);
    glyf.set(g.bytes, offset);
    offset += g.bytes.length;
  });
  lv.setUint32(count * 4, offset);
  const maxp = new Uint8Array(32),
    mv = view(maxp);
  mv.setUint32(0, 0x00010000);
  mv.setUint16(4, count);
  mv.setUint16(6, maxPoints);
  mv.setUint16(8, maxContours);
  mv.setUint16(14, 1);
  // CFF origin is absolute; TrueType uses hmtx.lsb - glyf.xMin to locate it.
  // Set lsb to the new control-point xMin so this format change never shifts ink.
  const hmtx = new Uint8Array(count * 4),
    hmtxView = view(hmtx);
  let minLsb = 32767,
    minRsb = 32767,
    maxExtent = -32768;
  glyphs.forEach((g, id) => {
    const advance = advances[id];
    hmtxView.setUint16(id * 4, advance);
    hmtxView.setInt16(id * 4 + 2, g.bounds[0]);
    minLsb = Math.min(minLsb, g.bounds[0]);
    minRsb = Math.min(minRsb, advance - g.bounds[2]);
    maxExtent = Math.max(maxExtent, g.bounds[2]);
  });
  if (minRsb < -32768 || minRsb > 32767) fail('Seitenabstand außerhalb TrueType-Bereich');
  const hh = view(hhea);
  hh.setUint16(10, Math.max(...advances));
  hh.setUint16(34, count);
  hh.setInt16(12, minLsb);
  hh.setInt16(14, minRsb);
  hh.setInt16(16, maxExtent);
  const hv = view(head);
  hv.setUint16(16, (hv.getUint16(16) & ~0x14) | 2);
  bounds.forEach((n, i) => hv.setInt16(36 + i * 2, n));
  hv.setInt16(50, 1);
  hv.setInt16(52, 0);
  if (variable) {
    const os = byTag.get('OS/2')!.data,
      post = byTag.get('post')!.data;
    if (os.length < 64 || post.length < 16) fail('unvollständige Stilmetriken');
    const ov = view(os);
    if (instance.wght !== undefined)
      ov.setUint16(4, Math.max(1, Math.min(1000, Math.round(instance.wght))));
    const bold = instance.wght !== undefined ? instance.wght >= 600 : !!(ov.getUint16(62) & 32);
    const italic =
      instance.ital !== undefined
        ? instance.ital >= 0.5
        : instance.slnt !== undefined
          ? instance.slnt !== 0
          : !!(ov.getUint16(62) & 1);
    ov.setUint16(
      62,
      (ov.getUint16(62) & ~97) | (bold ? 32 : 0) | (italic ? 1 : 0) | (!bold && !italic ? 64 : 0),
    );
    hv.setUint16(44, (hv.getUint16(44) & ~3) | (bold ? 1 : 0) | (italic ? 2 : 0));
    if (instance.slnt !== undefined) view(post).setInt32(4, Math.round(instance.slnt * 65536));
  }
  const removed = new Set([
    'CFF ',
    'CFF2',
    'hmtx',
    'fvar',
    'gvar',
    'avar',
    'HVAR',
    'VVAR',
    'MVAR',
    'cvar',
    'STAT',
    ...(variable ? ['GDEF', 'GPOS', 'GSUB'] : []),
    'DSIG',
    'VORG',
    'maxp',
    'glyf',
    'loca',
    'cvt ',
    'fpgm',
    'prep',
    'LTSH',
    'hdmx',
    'VDMX',
  ]);
  return writeOutlineSfnt([
    ...tables.filter((t) => !removed.has(t.tag)),
    { tag: 'hmtx', data: hmtx },
    { tag: 'maxp', data: maxp },
    { tag: 'glyf', data: glyf },
    { tag: 'loca', data: loca },
  ]);
}
