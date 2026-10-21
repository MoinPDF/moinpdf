import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';


// Compile the ACTUAL current application measurement modules into this scratch
// directory. No measurement approximation or application-file changes.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const folder = new URL('../.cache/editor-flow/', import.meta.url);
await mkdir(folder, { recursive: true });
const modules = ['editor-auto-flow', 'editor-workflow', 'editor-layout-plan', 'editor-rich-layout',
  'editor-rich-text', 'editor-model', 'editor-fonts', 'editor-font-catalog',
  'editor-font-cmap', 'editor-font-outline', 'editor-text-layer', 'local-font-bytes', 'pdf-text'];
const moduleHashes = {};
for (const name of modules) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  moduleHashes[name] = createHash('sha256').update(source).digest('hex');
  const rewritten = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
    .replace(/(['"])\.\/([a-z-]+)\1/g, (_, q, name) => `${q}./${name}.mjs${q}`)
    .replace(/(from\s*|import\s*\(\s*)(['"])([^'"]+)\2/g,
      (full, prefix, quote, specifier) => specifier.startsWith('.') ? full :
        `${prefix}${quote}${pathToFileURL(require.resolve(specifier)).href}${quote}`);
  await writeFile(new URL(`${name}.mjs`, folder), rewritten);
}
const {prepareEditorAutoFlow}=await import('../.cache/editor-flow/editor-auto-flow.mjs');
const { prepareEditorLayout } = await import('../.cache/editor-flow/editor-layout-plan.mjs');
const { distributeEditorFlow } = await import('../.cache/editor-flow/editor-workflow.mjs');
const { editorSegments } = await import('../.cache/editor-flow/editor-rich-text.mjs');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) =>
  typeof input === 'string' && input.startsWith('/vendor/')
    ? new Response(await readFile(new URL(`../public${input}`, import.meta.url)))
    : originalFetch(input, options);
const measurement = { layout: prepareEditorLayout, distribute: distributeEditorFlow };
const source = { id: 'source', name: 'test.pdf', bytes: new Uint8Array(), size: 0, kind: 'pdf' };
const region = { x: .1, y: .1, w: .6, h: .7 };
const mark = (id, text, rect, patch = {}) => ({
  id, kind: 'text', text, ...rect, sourceRect: { ...rect }, originalText: text,
  originalState: 'unchanged-input', originalFontPage: 3,
  fontScale: 12 / 400, fontChoice: 'dejavu-sans', fontFamily: 'sans', color: '#222222',
  ...patch,
});
const paragraph = (id, text, rect, patch = {}) => ({
  original: { ...rect }, mark: mark(id, text, rect, patch),
});
function input(paragraphs, patch = {}) {
  return { source, originalPageId: 'original-page', width: 400, height: 500,
    selectedId: paragraphs[0].mark.id, paragraphs, obstacles: [], region,
    groupId: 'preview', documentPageCount: 3, signal: new AbortController().signal, ...patch };
}
const chunksFor = (plan, id) => plan.pages.flatMap((p) => p.chunks)
  .filter((c) => c.paragraphId === id && !c.deletionOnly);
const joined = (plan, id) => chunksFor(plan, id).map((c) => c.mark.text).join('');
const uniqueTokens = Array.from({ length: 360 }, (_, i) => `token${String(i).padStart(3, '0')}`);
const longText = uniqueTokens.join(' ');
let checks = 0;
async function test(name, run) {
  await run(); checks++; console.log(`PASS ${name}`);
}
try {
  await test('actual font measurement expands one paragraph and shifts following paragraphs', async () => {
    const first = paragraph('first', 'A longer paragraph that needs several lines in the approved body column. '.repeat(3),
      { x: .1, y: .1, w: .6, h: .03 });
    const follower = paragraph('follower', 'Following paragraph remains whole.',
      { x: .1, y: .18, w: .6, h: .03 });
    const plan = await prepareEditorAutoFlow(input([first, follower]), measurement);
    assert.equal(plan.pages.length, 1);
    const a = chunksFor(plan, 'first')[0], b = chunksFor(plan, 'follower')[0];
    assert(a.mark.h > first.original.h);
    assert(b.mark.y > follower.original.y);
    assert(Math.abs(b.mark.y - a.mark.y - a.mark.h - .05) < 1e-10);
    assert.equal(joined(plan, 'first'), first.mark.text);
    assert.equal(joined(plan, 'follower'), follower.mark.text);
  });
  await test('360 numbered tokens survive actual multi-page flow exactly once', async () => {
    const p = paragraph('long', longText, { x: .1, y: .1, w: .6, h: .03 });
    const plan = await prepareEditorAutoFlow(input([p]), measurement);
    assert(plan.pages.length > 1);
    assert(plan.pages.length <= 21);
    assert.equal(joined(plan, 'long'), longText);
    const actual = chunksFor(plan, 'long').flatMap((c) => c.mark.text.match(/token\d{3}/gu) || []);
    assert.deepEqual(actual, uniqueTokens);
    assert.equal(new Set(actual).size, 360);
    for (const page of plan.pages) for (const c of page.chunks) if (!c.deletionOnly)
      assert.equal((await prepareEditorLayout(c.mark, 400, 500, source)).overflow, false);
  });
  await test('rich style UTF-16 ranges and point sizes survive page boundaries', async () => {
    const text = `${longText} Ende äöü 😀`;
    const cuts = [0, 99, 555, 1010, text.length];
    const runs = cuts.slice(0, -1).map((start, i) => ({ start, end: cuts[i + 1],
      style: { fontScale: (i % 2 ? 14 : 11) / 400, color: i % 2 ? '#aa0011' : '#003377',
        bold: i % 2 === 1, originalFontPage: 3, fontChoice: 'dejavu-sans' } }));
    const p = paragraph('rich', text, { x: .1, y: .1, w: .6, h: .03 }, { runs });
    const original = editorSegments(p.mark);
    const plan = await prepareEditorAutoFlow(input([p]), measurement);
    assert.equal(joined(plan, 'rich'), text);
    const chunks = chunksFor(plan, 'rich');
    let offset = 0;
    for (const c of chunks) {
      assert.equal(c.from, offset);
      assert.equal(c.to, offset + c.mark.text.length);
      for (const run of editorSegments(c.mark)) {
        const start = offset + run.start;
        const expected = original.find((r) => r.start <= start && r.end > start);
        assert.equal(run.style.fontScale, expected.style.fontScale);
        assert.equal(run.style.color, expected.style.color);
        assert.equal(run.style.bold, expected.style.bold);
        assert.equal(run.style.originalFontPage, 3);
      }
      assert(!/[\uD800-\uDBFF]$/u.test(c.mark.text));
      assert(!/^[\uDC00-\uDFFF]/u.test(c.mark.text));
      offset = c.to;
    }
  });
  await test('moved following paragraphs retain one original-page deletion owner', async () => {
    const p = paragraph('long', longText, { x: .1, y: .1, w: .6, h: .03 });
    const follower = paragraph('following', 'This moves after the expanded paragraph.',
      { x: .1, y: .2, w: .6, h: .03 });
    const plan = await prepareEditorAutoFlow(input([p, follower]), measurement);
    for (const candidate of [p, follower]) {
      const owners = plan.pages.flatMap((page) => page.chunks.map((chunk) => ({ page, chunk })))
        .filter(({ chunk }) => chunk.paragraphId === candidate.mark.id && chunk.ownsOriginal);
      assert.equal(owners.length, 1);
      assert.equal(owners[0].page.slot, 0);
      assert.deepEqual(owners[0].chunk.mark.sourceRect, candidate.mark.sourceRect);
    }
    const owner = plan.pages[0].chunks.find((c) => c.paragraphId === 'following');
    assert.equal(owner.deletionOnly, true);
    assert.equal(owner.mark.text, '');
    for (const page of plan.pages.filter((p) => p.blank)) for (const c of page.chunks) {
      assert.equal(c.mark.sourceRect, undefined);
      assert.equal(c.mark.sourceRects, undefined);
      assert.equal(c.mark.originalText, undefined);
      assert.equal(c.mark.originalState, undefined);
      assert.equal(c.mark.originalFontPage, 3);
    }
  });
  await test('a following short paragraph moves whole rather than splitting unnecessarily', async () => {
    const p = paragraph('p', 'Longer initial paragraph with several lines of content. '.repeat(4),
      { x: .1, y: .1, w: .6, h: .03 });
    const q = paragraph('q', 'A following paragraph has enough words for at least two lines of text.',
      { x: .1, y: .15, w: .6, h: .03 });
    const a = await prepareEditorLayout({ ...p.mark, h: .8 }, 400, 500, source);
    const b = await prepareEditorLayout({ ...q.mark, h: .8 }, 400, 500, source);
    const body = { ...region, h: (a.requiredHeight + 2 + 10 + b.requiredHeight / 2) / 500 };
    const plan = await prepareEditorAutoFlow(input([p, q], { region: body }), measurement);
    assert.equal(chunksFor(plan, 'q').length, 1);
    assert.equal(plan.pages[1].chunks.find((c) => c.paragraphId === 'q').mark.text, q.mark.text);
  });
  await test('footers and another column remain fixed and are not copied to blank pages', async () => {
    const p = paragraph('long', longText, { x: .1, y: .1, w: .6, h: .03 });
    const footer = { ...paragraph('footer', 'ORIGINAL FOOTER', { x: .1, y: .9, w: .6, h: .03 }), fixed: true };
    const other = paragraph('other-column', 'OTHER COLUMN', { x: .75, y: .2, w: .2, h: .03 });
    const before = JSON.stringify([p, footer, other]);
    const plan = await prepareEditorAutoFlow(input([p, footer, other]), measurement);
    assert.deepEqual(plan.untouchedParagraphIds, ['footer', 'other-column']);
    assert(plan.pages.every((p) => p.chunks.every((c) => !['footer', 'other-column'].includes(c.paragraphId))));
    assert.equal(JSON.stringify([p, footer, other]), before);
    assert.equal(plan.pages[0].pageId, 'original-page');
    assert(plan.pages.slice(1).every((p) => p.blank));
  });
  await test('fixed obstacle inside the proposed expansion rejects the entire plan', async () => {
    const p = paragraph('long', longText, { x: .1, y: .1, w: .6, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([p], {
      obstacles: [{ x: .1, y: .5, w: .6, h: .03 }],
    }), measurement), /footer|fixed content/);
  });
  await test('rejects ambiguous following paragraphs and crossing source-removal geometry', async () => {
    const p = paragraph('p', 'A text paragraph', { x: .1, y: .1, w: .6, h: .03 });
    const q = paragraph('q', 'Indented ambiguous content', { x: .15, y: .2, w: .5, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([p, q]), measurement), /Ambiguous/);
    const crosses = paragraph('crosses', 'Text', { x: .1, y: .12, w: .6, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([p, crosses]), measurement), /intersects|overlap/);
  });
  await test('rejects scan, rotation, unsupported content, existing flow and missing originals', async () => {
    for (const patch of [{ sourceIsScan: true }, { textRotation: 90 }, { flow: { id: 'old', order: 0 } },
      { sourceRect: undefined }, { fontScale: NaN }]) {
      const p = paragraph('p', 'Content', { x: .1, y: .1, w: .6, h: .03 }, patch);
      await assert.rejects(() => prepareEditorAutoFlow(input([p]), measurement), /safe|unsupported/);
    }
    const p = { ...paragraph('p', 'Content', { x: .1, y: .1, w: .6, h: .03 }), unsupportedReason: 'clip' };
    await assert.rejects(() => prepareEditorAutoFlow(input([p]), measurement), /safe/);
  });
  await test('rejects page/count/size limits before creating partial state', async () => {
    const p = paragraph('p', longText, { x: .1, y: .1, w: .6, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([p], { maximumContinuationPages: 0 }), measurement), /No continuation/);
    await assert.rejects(() => prepareEditorAutoFlow(input([p], { documentPageCount: 200 }), measurement), /No continuation/);
    await assert.rejects(() => prepareEditorAutoFlow(input([p], { maximumContinuationPages: 21 }), measurement), /Invalid/);
    await assert.rejects(() => prepareEditorAutoFlow(input([p], { maximumContinuationPages: 1 }), measurement), /passt noch nicht/);
    await assert.rejects(() => prepareEditorAutoFlow(input([p], {
      region: { ...region, h: .05 }, continuationRegion: { ...region, h: .05 },
    }), measurement), /passt noch nicht/);
    const oversized = paragraph('p', 'x'.repeat(100001), { x: .1, y: .1, w: .6, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([oversized]), measurement), /unsupported/);
  });
  await test('aborted measurements do not return a usable proposal', async () => {
    const p = paragraph('p', 'Content', { x: .1, y: .1, w: .6, h: .03 });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => prepareEditorAutoFlow(input([p], { signal: controller.signal }), measurement), /aborted/i);
    const mid = new AbortController();
    await assert.rejects(() => prepareEditorAutoFlow(input([p], { signal: mid.signal }), {
      ...measurement, layout: async (...args) => {
        const result = await prepareEditorLayout(...args); mid.abort(); return result;
      },
    }), /aborted/i);
  });
  await test('malformed rich ranges and Unicode splits are rejected', async () => {
    const p = paragraph('p', 'A🙂B', { x: .1, y: .1, w: .6, h: .03 }, {
      runs: [{ start: 0, end: 2, style: { color: '#ff0000' } }],
    });
    await assert.rejects(() => prepareEditorAutoFlow(input([p]), measurement), /Unicode/);
    const q = paragraph('p', 'Text', { x: .1, y: .1, w: .6, h: .03 }, {
      runs: [{ start: 0, end: 7, style: {} }],
    });
    await assert.rejects(() => prepareEditorAutoFlow(input([q]), measurement), /ranges/);
  });
  await test('distributor content loss or frame substitution is rejected', async () => {
    const p = paragraph('p', longText, { x: .1, y: .1, w: .6, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([p]), {
      ...measurement, distribute: async (...args) => {
        const result = await distributeEditorFlow(...args); result[0].mark.text += 'X'; return result;
      },
    }), /changed or lost/);
    await assert.rejects(() => prepareEditorAutoFlow(input([p]), {
      ...measurement, distribute: async (...args) => {
        const result = await distributeEditorFlow(...args); result[0].pageId = 'wrong'; return result;
      },
    }), /identities/);
  });
  await test('a distributor split inside a grapheme is rejected without losing content', async () => {
    const p = paragraph('p', `a\u0308${longText}`, { x: .1, y: .1, w: .6, h: .03 });
    await assert.rejects(() => prepareEditorAutoFlow(input([p]), {
      ...measurement, distribute: async (...args) => {
        const result = await distributeEditorFlow(...args);
        // Preserve exact combined text but deliberately make the first chunk
        // end between the base character and its combining mark.
        const first = result[0].mark.text;
        result[0].mark = { ...result[0].mark, text: first.slice(0, 1), runs: [] };
        result[1].mark = { ...result[1].mark, text: first.slice(1) + result[1].mark.text, runs: [] };
        return result;
      },
    }), /grapheme/);
  });
  await writeFile(new URL('../.cache/editor-flow/measurement-modules.json', import.meta.url), JSON.stringify({
    checks, source: 'actual current application modules', moduleHashes,
  }, null, 2));
  console.log(`PASS ${checks} auto-flow checks using actual application font/layout measurement.`);
} finally {
  globalThis.fetch = originalFetch;
}
