import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

await mkdir('.cache/usability', { recursive: true });
const modules = {
  'lib/result-details.ts': 'details',
  'lib/content-digest.ts': 'content-digest',
  'lib/upload-duplicates.ts': 'duplicates',
  'lib/tool-catalog.ts': 'tool-catalog',
  'lib/tool-search.ts': 'tool-search',
  'lib/tool-translations.ts': 'tool-translations',
  'lib/localized-search.ts': 'localized-search',
  'lib/utils.ts': 'utils',
  'components/ui/button.tsx': 'button',
  'components/ui/dialog.tsx': 'dialog',
  'components/studio/workspace-result-context.tsx': 'workspace-result-context',
  'components/studio/result-actions.tsx': 'actions',
  'components/studio/result-next-steps.tsx': 'result-next-steps',
  'components/studio/tool-browser-memory.tsx': 'navigation',
  'components/studio/duplicate-prompt.tsx': 'prompt',
};
for (const [source, name] of Object.entries(modules)) {
  let code = ts.transpileModule(await readFile(source, 'utf8'), {
    fileName: source,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  for (const [from, to] of Object.entries({
    '@/lib/result-details': './details.mjs',
    '@/lib/utils': './utils.mjs',
    '@/components/ui/button': './button.mjs',
    '@/components/ui/dialog': './dialog.mjs',
    './workspace-result-context': './workspace-result-context.mjs',
    './result-next-steps': './result-next-steps.mjs',
    './appearance': './appearance.mjs',
    './content-digest': './content-digest.mjs',
    './tool-search': './tool-search.mjs',
    './tool-catalog': './tool-catalog.mjs',
    sonner: './toast.mjs',
  }))
    code = code.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
  await writeFile(`.cache/usability/${name}.mjs`, code);
}
await writeFile(
  '.cache/usability/appearance.mjs',
  `export let language='de'; export const setLanguage=value=>language=value; export const useLanguage=()=>({language,t:(de,en)=>language==='de'?de:en||de});`,
);
await writeFile(
  '.cache/usability/toast.mjs',
  `export const errors=[]; export const toast={error:value=>errors.push(value)};`,
);
const {
  renameDownload,
  filenameParts,
  resultSummary,
  resultShareFile,
  canShareResult,
  completePdfSelection,
} = await import('../.cache/usability/details.mjs');
const { uploadFingerprint, duplicateSource } = await import('../.cache/usability/duplicates.mjs');
const { tools } = await import('../.cache/usability/tool-catalog.mjs');
const { englishTools } = await import('../.cache/usability/tool-translations.mjs');
const { searchTools } = await import('../.cache/usability/localized-search.mjs');

// An editable filename must retain its real type and be usable across operating systems.
for (const [draft, expected] of [
  ['Rechnung Oktober', 'Rechnung Oktober.pdf'],
  ['Rechnung.PDF', 'Rechnung.pdf'],
  ['  Rechnung. ', 'Rechnung.pdf'],
  ['../Bericht/2026', '-Bericht-2026.pdf'],
  ['CON', '_CON.pdf'],
  ['..', 'Original.pdf'],
  ['', 'Original.pdf'],
  ['Jahresbericht.docx', 'Jahresbericht.docx.pdf'],
  ['Grüße', 'Grüße.pdf'],
])
  assert.equal(renameDownload(draft, 'Original.pdf'), expected);
assert.equal(renameDownload('a'.repeat(200), 'a.zip').length, 164);
assert.deepEqual(filenameParts('Archiv.tar.gz'), { stem: 'Archiv.tar', extension: '.gz' });
const pdf = {
  blob: new Blob([new Uint8Array(1024 * 1024)], { type: 'application/pdf' }),
  filename: 'Original.pdf',
  kind: 'pdf',
  pages: 2,
  inputSize: 4 * 1024 * 1024,
};
assert.equal(resultSummary(pdf, 'de', true), 'PDF · 2 Seiten · 4 MB → 1 MB · 75 % kleiner');
assert.equal(
  resultSummary({ ...pdf, pages: 1 }, 'en', true),
  'PDF · 1 page · 4 MB → 1 MB · 75 % smaller',
);
assert.match(resultSummary({ ...pdf, inputSize: 500 }, 'de', true), /Keine Verkleinerung/);
assert.equal(resultSummary({ blob: new Blob([]), filename: 'Leer.csv' }, 'en'), 'CSV · 0 B');
assert.equal(resultSummary({ ...pdf, filename: 'Export.docx', kind: 'data' }, 'en'), 'DOCX · 1 MB');
assert.doesNotMatch(resultSummary({ ...pdf, inputSize: undefined }, 'en', true), /NaN|Infinity|%/);
const inputSources = [{ id: 'one', kind: 'pdf', pdf: { numPages: 2 } }];
assert.equal(
  completePdfSelection(inputSources, [
    { sourceId: 'one', index: 0 },
    { sourceId: 'one', index: 1 },
  ]),
  true,
);
assert.equal(completePdfSelection(inputSources, [{ sourceId: 'one', index: 0 }]), false);
assert.equal(
  completePdfSelection(inputSources, [
    { sourceId: 'one', index: 0 },
    { sourceId: 'one', index: 0 },
  ]),
  false,
);
assert.equal(
  completePdfSelection(
    [{ ...inputSources[0], kind: 'image' }],
    [
      { sourceId: 'one', index: 0 },
      { sourceId: 'one', index: 1 },
    ],
  ),
  false,
);
const shareFile = resultShareFile(pdf, 'Umbenannt.pdf');
assert.equal(shareFile.name, 'Umbenannt.pdf');
assert.equal(shareFile.type, 'application/pdf');
assert.equal(shareFile.size, pdf.blob.size);
assert.equal(canShareResult(shareFile, undefined), false);
assert.equal(canShareResult(shareFile, { share() {} }), false);
assert.equal(
  canShareResult(shareFile, {
    share() {},
    canShare() {
      throw Error();
    },
  }),
  false,
);
assert.equal(
  canShareResult(shareFile, {
    share() {},
    canShare({ files }) {
      return files[0] === shareFile;
    },
  }),
  true,
);

// Content, not filenames, controls duplicate decisions, including transformed imports.
const upload = new File(['same bytes'], 'A.pdf', { type: 'application/pdf' });
const digest = await uploadFingerprint(upload);
const original = {
  id: 'a',
  name: 'A.pdf',
  size: upload.size,
  kind: 'pdf',
  bytes: new TextEncoder().encode('same bytes'),
};
assert.equal(await duplicateSource(upload, digest, [original]), original);
assert.equal(
  await duplicateSource(new File(['same bytes'], 'Renamed.pdf'), digest, [original]),
  original,
);
const changed = new File(['diff bytes'], 'A.pdf');
assert.equal(changed.size, upload.size);
assert.equal(
  await duplicateSource(changed, await uploadFingerprint(changed), [original]),
  undefined,
);
for (const kind of ['image', 'invoice', 'pdf']) {
  const converted = {
    ...original,
    kind,
    wasEncrypted: true,
    originalDigest: digest,
    bytes: new TextEncoder().encode('converted PDF'),
  };
  assert.equal(await duplicateSource(upload, digest, [converted]), converted);
}
assert.equal(await duplicateSource(upload, digest, []), undefined);
// Same-file selections in a batch see the sources accepted earlier in that batch.
const sameBatch = { ...original, originalDigest: digest };
assert.equal(await duplicateSource(upload, digest, [sameBatch]), sameBatch);
assert.equal(await duplicateSource(upload, digest, [{ ...original, kind: 'image' }]), undefined);
const originalCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
assert.equal(await uploadFingerprint(upload), digest, 'local HTTP checksum fallback');
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });

const cases = [
  ['Seite rausnehmen', 'organize'],
  ['Ich möchte eine Seite rausnehmen', 'organize'],
  ['Seite raus', 'organize'],
  ['PDF steht auf dem Kopf', 'organize'],
  ['Anhang passt nicht in die Mail', 'compress'],
  ['PDF ist zu groß für E-Mail', 'compress'],
  ['Datei kleiner bekommen', 'compress'],
  ['alles in eine Datei packen', 'merge'],
  ['meine Unterschrift draufsetzen', 'sign'],
  ['persönliche Daten verstecken', 'redact'],
  ['Text aus Foto holen', 'ocr'],
  ['weißen Rand wegmachen', 'auto-crop'],
  ['I would like to make my file smaller', 'compress'],
  ['this is too big to email', 'compress'],
  ['take a page out', 'organize'],
  ['put my pdfs together', 'merge'],
  ['add my signature', 'sign'],
  ['copy text from a scan', 'ocr'],
  ['remove white margins', 'auto-crop'],
  ['save each page separately', 'split'],
];
for (const catalogue of [tools, tools.map((tool) => ({ ...tool, ...englishTools[tool.id] }))])
  for (const [query, id] of cases) assert.equal(searchTools(query, catalogue)[0]?.id, id, query);
assert.notEqual(
  searchTools('design a spaceship', tools)[0]?.id,
  'sign',
  'aliases match whole words',
);

// Exercise actual React controls in a DOM, without treating jsdom as a visual browser.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://moinpdf.test',
  pretendToBeVisual: true,
});
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'NodeFilter',
  'HTMLInputElement',
  'HTMLButtonElement',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'FocusEvent',
  'getComputedStyle',
])
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'window' ? dom.window : dom.window[key],
  });
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 1);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let scroll = { top: 0, left: 0 };
Object.defineProperty(window, 'scrollY', { get: () => scroll.top });
Object.defineProperty(window, 'scrollX', { get: () => scroll.left });
window.scrollTo = (value) => {
  scroll = value;
};
const React = await import('react');
const { act, createElement: h, useState, StrictMode } = React;
const { createRoot } = await import('react-dom/client');
const { ResultActions, ResultSummary, useResultName } =
  await import('../.cache/usability/actions.mjs');
const { ToolBrowserMemory, useToolBrowserState, useToolNavigation } =
  await import('../.cache/usability/navigation.mjs');
const { DuplicatePrompt } = await import('../.cache/usability/prompt.mjs');
const { setLanguage } = await import('../.cache/usability/appearance.mjs');
const { errors } = await import('../.cache/usability/toast.mjs');
const root = createRoot(document.querySelector('#root'));
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
const click = async (element) => {
  assert.ok(element, 'click target exists');
  await act(async () => element.click());
};
const inputText = async (input, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const key = async (input, value) =>
  act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })));
let shares = [],
  mode = 'ok';
navigator.canShare = ({ files }) => files[0].type === 'application/pdf';
navigator.share = (data) => {
  shares.push(data);
  return mode === 'cancel'
    ? Promise.reject(new DOMException('Cancelled', 'AbortError'))
    : mode === 'fail'
      ? Promise.reject(new DOMException('Denied', 'NotAllowedError'))
      : Promise.resolve();
};
function Export({ result }) {
  const [filename, rename] = useResultName(result);
  return h(
    'div',
    null,
    h(ResultSummary, { result }),
    h(ResultActions, { result, filename, onRename: rename, url: 'blob:result' }),
  );
}
await act(async () => root.render(h(Export, { result: pdf })));
await flush();
assert.ok(document.querySelector('[aria-label="Ergebnis teilen"]'));
await click(document.querySelector('.export-name-button'));
await inputText(document.querySelector('.export-name-edit input'), 'Rechnung Oktober.pdf');
await key(document.querySelector('.export-name-edit input'), 'Enter');
await flush();
assert.equal(document.querySelector('a[download]').download, 'Rechnung Oktober.pdf');
await click(document.querySelector('.export-share'));
assert.equal(shares.at(-1).files[0].name, 'Rechnung Oktober.pdf');
assert.equal(shares.at(-1).files[0].size, pdf.blob.size);
await click(document.querySelector('.export-name-button'));
await inputText(document.querySelector('.export-name-edit input'), 'Nicht übernehmen');
await key(document.querySelector('.export-name-edit input'), 'Escape');
assert.equal(document.querySelector('a[download]').download, 'Rechnung Oktober.pdf');
mode = 'cancel';
await click(document.querySelector('.export-share'));
assert.equal(errors.length, 0);
mode = 'fail';
await click(document.querySelector('.export-share'));
assert.equal(errors.length, 1);
assert.match(errors[0], /herunterladen/);
setLanguage('en');
const next = { ...pdf, blob: new Blob(['new'], { type: 'application/pdf' }), filename: 'Next.pdf' };
await act(async () => root.render(h(Export, { result: next })));
await flush();
assert.equal(
  document.querySelector('a[download]').download,
  'Next.pdf',
  'new output resets only its name',
);
assert.equal(document.querySelector('a[download]').textContent, 'Download PDF');
assert.ok(document.querySelector('[aria-label="Share result"]'));
navigator.canShare = () => false;
await act(async () =>
  root.render(h(Export, { result: { ...next, blob: new Blob(['unsupported']) } })),
);
await flush();
assert.equal(document.querySelector('.export-share'), null);
assert.ok(document.querySelector('a[download]'));

function Browser({ surface, onChoose }) {
  const { query, setQuery, category, setCategory } = useToolBrowserState(surface);
  return h(
    'div',
    { 'data-tool-browser': surface },
    h('input', { 'aria-label': 'Query', value: query, onChange: (e) => setQuery(e.target.value) }),
    h(
      'button',
      {
        'data-browser-categories': true,
        'data-category': category,
        onClick: () => setCategory('3'),
      },
      'category',
    ),
    h('div', { 'data-tool-id': 'sign', role: 'option' }, 'Non-focusable search suggestion'),
    h('button', { 'data-tool-id': 'sign', onClick: onChoose }, 'choose'),
  );
}
let changeSurface;
function NavigationExample() {
  const [surface, setSurface] = useState('home');
  const [working, setWorking] = useState(false);
  changeSurface = setSurface;
  const nav = useToolNavigation();
  return working
    ? h(
        'button',
        {
          id: 'back',
          onClick: () => {
            setSurface(nav.restore());
            setWorking(false);
          },
        },
        'back',
      )
    : h(Browser, {
        key: surface,
        surface,
        onChoose: () => {
          nav.capture(surface, 'sign');
          setWorking(true);
          window.scrollTo({ top: 0, left: 0 });
        },
      });
}
await act(async () =>
  root.render(h(StrictMode, null, h(ToolBrowserMemory, null, h(NavigationExample)))),
);
await inputText(document.querySelector('[aria-label="Query"]'), 'unterschreiben');
await click(document.querySelector('[data-browser-categories]'));
scroll = { top: 640, left: 0 };
document.querySelector('[data-browser-categories]').scrollLeft = 84;
await click(document.querySelector('button[data-tool-id="sign"]'));
assert.equal(scroll.top, 0);
await click(document.querySelector('#back'));
await flush();
assert.equal(document.querySelector('[aria-label="Query"]').value, 'unterschreiben');
assert.equal(document.querySelector('[data-browser-categories]').dataset.category, '3');
assert.equal(document.querySelector('[data-browser-categories]').scrollLeft, 84);
assert.equal(scroll.top, 640);
assert.equal(document.activeElement.dataset.toolId, 'sign');
// All-tools navigation has independent state and also survives the round trip.
await act(async () => changeSurface('all'));
await inputText(document.querySelector('[aria-label="Query"]'), 'smaller');
scroll = { top: 1050, left: 0 };
await click(document.querySelector('button[data-tool-id="sign"]'));
await click(document.querySelector('#back'));
await flush();
assert.equal(scroll.top, 1050);
assert.equal(document.querySelector('[aria-label="Query"]').value, 'smaller');

let decision;
function PromptExample() {
  const [request, setRequest] = useState({
    name: 'Kopie.pdf',
    existingName: 'Original.pdf',
    remaining: 2,
    resolve: (value) => {
      decision = value;
    },
  });
  return h(DuplicatePrompt, { request, onClose: () => setRequest(null) });
}
setLanguage('de');
await act(async () => root.render(h(PromptExample)));
await flush();
assert.match(document.querySelector('[role="dialog"]').textContent, /Original.pdf/);
await click(document.querySelector('input[type="checkbox"]'));
await click(
  [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Trotzdem hinzufügen',
  ),
);
assert.deepEqual(decision, { add: true, remember: true });
await act(async () => root.render(h(PromptExample, { key: 'skip' })));
await flush();
await click(
  [...document.querySelectorAll('button')].find((button) => button.textContent === 'Überspringen'),
);
assert.deepEqual(decision, { add: false, remember: false });
await act(async () => root.unmount());
dom.window.close();
console.log(
  'PASS: inline rename and keyboard cancel, extension safety, output summaries, file sharing/support/cancel/failure, content duplicates and batch choices, HTTP fallback, 40 bilingual intent cases, and category/query/scroll/focus restoration in React StrictMode. DOM checks are not visual device tests.',
);
