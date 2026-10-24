// Real React, Radix dialogs and cmdk in a DOM. Viewport events are simulated;
// this is deliberately not a visual-browser or native-keyboard test.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const sources = [
  'lib/utils.ts',
  'lib/tool-preferences.ts',
  'components/studio/use-tool-preferences.tsx',
  'components/studio/quick-access-settings.tsx',
  'lib/ui-language.ts',
  'lib/ui-feedback.ts',
  'lib/interaction-feedback.ts',
  'lib/tool-catalog.ts',
  'lib/tool-search.ts',
  'lib/tool-translations.ts',
  'lib/localized-search.ts',
  'components/ui/button.tsx',
  'components/ui/dialog.tsx',
  'components/ui/command.tsx',
  'components/ui/dropdown-menu.tsx',
  'components/ui/tooltip.tsx',
  'components/studio/search-highlight.tsx',
  'components/studio/mobile-tool-search.tsx',
  'components/studio/harbor-navigation.tsx',
  'components/studio/project-manager.tsx',
  'components/studio/tool-browser-memory.tsx',
  'components/studio/tool-mosaic.tsx',
  'components/studio/home-tools.tsx',
];
const folder = '.cache/mobile-navigation';
await mkdir(folder, { recursive: true });
for (const source of sources) {
  let code = ts.transpileModule(await readFile(source, 'utf8'), {
    fileName: source,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  code = code
    .replace(/(['"])(@\/[^'"]+|\.\/[^'"]+)\1/g, (all, quote, path) => {
      if (path.endsWith('.css')) return all;
      return `${quote}./${path.split('/').at(-1)}.mjs${quote}`;
    })
    .replace(/import ['"].*\.css['"];?/g, '')
    .replaceAll("from 'sonner'", "from './toast.mjs'");
  await writeFile(
    `${folder}/${source
      .split('/')
      .at(-1)
      .replace(/\.tsx?$/, '.mjs')}`,
    code,
  );
}
await writeFile(`${folder}/version.mjs`, 'export const APP_VERSION="test";');
await writeFile(`${folder}/toast.mjs`, 'export const toast={success(){}};');
await writeFile(
  `${folder}/appearance.mjs`,
  `
import {tools,groups} from './tool-catalog.mjs';
import {englishTools} from './tool-translations.mjs';
import {translate,setUiLanguage,installEnglishCatalog} from './ui-language.mjs';
export {installEnglishCatalog};
let language='de';
export function setLanguage(value){language=value;setUiLanguage(value);}
export const useLanguage=()=>({language,t:(de,en)=>translate(de,language,en)});
export const useTools=()=>({tools:language==='de'?tools:tools.map(tool=>({...tool,...englishTools[tool.id]})),groups});
`,
);
// Only disk/PDF services are replaced. The production project dialog and its
// open/close/list-refresh lifecycle are exercised with both real nav triggers.
await writeFile(
  `${folder}/local-projects.mjs`,
  `
export let reads=0; export let fail=false;
export function setFailure(value){fail=value;}
export async function listProjects(){reads++;if(fail)throw Error('Storage unavailable');return [{id:'retained',name:'Retained project',versions:[]}];}
const unused=()=>{throw Error('Project data operations are covered by project-archive-smoke');};
export const saveProject=unused,loadProject=unused,deleteProject=unused,loadProjectArchive=unused,importProjectArchive=unused;
`,
);
await writeFile(
  `${folder}/project-checkpoint.mjs`,
  `export const projectContentSignature=()=>'',matchesProjectCheckpoint=()=>false,captureProjectCheckpoint=()=>null;`,
);
await writeFile(
  `${folder}/pdf-engine.mjs`,
  `export const openSource=()=>{},filenameStem=x=>x;
export let downloads=0;
let onDownload=()=>{};
export const setOnDownload=callback=>{onDownload=callback;};
export const downloadBlob=()=>{downloads++;onDownload();};`,
);
await writeFile(
  `${folder}/project-archive.mjs`,
  `let complete;
export const encodeProjectFile=()=>new Promise(resolve=>{complete=resolve;});
export const finishDownload=()=>complete(new Blob(['synthetic project']));`,
);

const dom = new JSDOM(
  `<!doctype html><html><body><div id="moinpdf-brand"></div><div id="moinpdf-navigation"></div><div id="moinpdf-project-bar"></div><div id="moinpdf-mobile-navigation"></div><main id="moinpdf-content" tabindex="-1"><div id="root"></div></main></body></html>`,
  { url: 'http://moinpdf.test', pretendToBeVisual: true },
);
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
  'DOMParser',
  'getComputedStyle',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'window' ? dom.window : dom.window[key],
  });
}
const desktop = new dom.window.EventTarget();
desktop.matches = false;
window.matchMedia = () => desktop;
const visual = new dom.window.EventTarget();
Object.assign(visual, { height: 800, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
Object.defineProperty(window, 'visualViewport', { configurable: true, value: visual });
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
HTMLElement.prototype.scrollIntoView = () => {};
// Visibility is outside jsdom's scope; provide geometry only for focus restoration.
HTMLElement.prototype.getClientRects = function () {
  return [this.getBoundingClientRect()];
};
Object.assign(globalThis, {
  requestAnimationFrame: (cb) => setTimeout(cb, 1),
  cancelAnimationFrame: clearTimeout,
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { act, createElement: h, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const { HarborNavigation } = await import('../.cache/mobile-navigation/harbor-navigation.mjs');
const { ProjectManager } = await import('../.cache/mobile-navigation/project-manager.mjs');
const { HomeTools } = await import('../.cache/mobile-navigation/home-tools.mjs');
const { ToolBrowserMemory } = await import('../.cache/mobile-navigation/tool-browser-memory.mjs');
const appearance = await import('../.cache/mobile-navigation/appearance.mjs');
appearance.installEnglishCatalog(JSON.parse(await readFile('public/locales/en.json', 'utf8')));
const storage = await import('../.cache/mobile-navigation/local-projects.mjs');
const archive = await import('../.cache/mobile-navigation/project-archive.mjs');
const downloads = await import('../.cache/mobile-navigation/pdf-engine.mjs');
const chosen = [];
let allTools = 0,
  home = 0;
function Harness({ locked = false, hasSources = false }) {
  const [open, setOpen] = useState(false);
  const onTools = () => {
    allTools++;
    document.querySelector('#moinpdf-content').focus();
  };
  return h(
    ToolBrowserMemory,
    null,
    h(HarborNavigation, {
      home: true,
      locked,
      onHome: () => home++,
      onTools,
      onChoose: (id) => {
        chosen.push(id);
        document.querySelector('#moinpdf-content').focus();
      },
      onProjects: () => setOpen(true),
      projectsOpen: open,
    }),
    h(ProjectManager, {
      open,
      onOpenChange: setOpen,
      sources: hasSources ? [{ id: 'fixture', name: 'fixture.pdf' }] : [],
      state: { pages: [], edits: {}, options: {}, documentSessions: {} },
      identity: { name: 'Session name' },
      setIdentity() {},
      checkpoint: null,
      onCheckpoint() {},
      onBusy() {},
      locked,
      onRestore() {},
    }),
    h(HomeTools, { locked, onTools, onChoose: (id) => chosen.push(id) }),
  );
}
const errors = [];
const root = createRoot(document.querySelector('#root'), {
  onUncaughtError: (error) => errors.push(error),
});
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
const render = async (locked, hasSources = false) => {
  await act(async () => root.render(h(Harness, { locked, hasSources })));
  await flush();
};
const click = async (target) => {
  assert(target, 'Target exists');
  await act(async () => {
    target.focus();
    target.click();
  });
  await flush();
  if (errors.length) throw errors[0];
};
const nav = () => document.querySelector('.harbor-mobile-nav');
const search = () => nav().querySelector('.harbor-search-toggle');
const dialog = () => document.querySelector('[role="dialog"]');
// Use the minified production stylesheet when requested: source-only DOM tests
// missed CSS lowering removing translate:none while utility offsets survived.
let productionCss;
if (process.argv.includes('--production-css')) {
  const require = createRequire(import.meta.url);
  const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
  const directory = process.argv.includes('--selfhost')
    ? 'dist/selfhost/assets'
    : 'dist/client/_next/static/css';
  const file = (await readdir(directory)).find((name) => /^index[.-].+\.css$/.test(name));
  assert(file, 'Production app stylesheet exists');
  productionCss = postcss.parse(await readFile(`${directory}/${file}`, 'utf8'));
}
const centeringRules = (element) => {
  const offsets = [];
  productionCss?.walkRules((rule) => {
    const declarations = rule.nodes.filter(
      (node) =>
        node.type === 'decl' &&
        node.prop === 'translate' &&
        !/^(none|0(?:px)?(?: 0(?:px)?)?)$/.test(node.value),
    );
    if (!declarations.length) return;
    let matches = false;
    try {
      matches = element.matches(rule.selector);
    } catch {
      /* Unsupported pseudo-elements cannot match this dialog. */
    }
    if (matches) offsets.push(...declarations.map((node) => `${rule.selector}: ${node.value}`));
  });
  return offsets;
};
const input = () => dialog()?.querySelector('input[cmdk-input]');
const type = async (value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
  await flush();
};
const key = async (target, value) => {
  await act(async () =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })),
  );
  await flush();
};
try {
  await render(false);
  const homeInput = document.querySelector('.harbor-command input[cmdk-input]');
  const homeList = () => document.getElementById(homeInput.getAttribute('aria-controls'));
  assert.ok(homeList(), 'The home search always references an existing result list');
  assert.equal(homeInput.getAttribute('aria-expanded'), 'false');
  assert.equal(homeList().hidden, true);
  for (const value of ['zusammenfügen', '']) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
        homeInput,
        value,
      );
      homeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
    assert.equal(homeInput.getAttribute('aria-expanded'), String(Boolean(value)));
    assert.equal(homeList().hidden, !value);
    if (value) assert.ok(homeList().querySelector('[cmdk-item]'), 'Suggestions remain available');
  }
  assert.deepEqual(
    [...nav().querySelectorAll('button')].map((el) => el.textContent),
    ['Start', 'Werkzeuge', 'Suche', 'Projekte', 'Mehr'],
  );
  assert.equal(document.querySelectorAll('.harbor-desktop-nav button').length, 4);
  await click(document.querySelector('.home-all-tools'));
  assert.equal(allTools, 1, 'Desktop All tools navigates');
  await click(nav().querySelector('button'));
  assert.equal(home, 1);
  await click(search());
  assert.equal(dialog().getAttribute('aria-modal'), 'true');
  if (productionCss) {
    assert.deepEqual(
      centeringRules(dialog()),
      [],
      'Production search sheet must not inherit dialog-centering translations',
    );
  }
  assert.equal(document.activeElement === input(), true, 'Search input receives focus');
  assert.equal(
    dialog().querySelectorAll('[cmdk-item]').length,
    7,
    'Six pinned tools and projects available before typing',
  );
  await act(async () => document.querySelector('.home-all-tools').focus());
  assert.equal(document.activeElement === input(), true, 'Focus stays inside the open modal');
  await key(input(), 'ArrowDown');
  assert.equal(
    dialog().querySelector('[cmdk-item][aria-selected="true"]').dataset.toolId,
    'merge',
    'Arrow keys navigate the actual results',
  );
  await type('PDF kleiner machen');
  assert.equal(
    dialog().querySelector('[cmdk-item]').dataset.toolId,
    'compress',
    'German intent uses production matcher',
  );
  await key(input(), 'Enter');
  assert.deepEqual(chosen, ['compress']);
  assert.equal(Boolean(dialog()), false);
  assert.equal(
    document.activeElement.id,
    'moinpdf-content',
    'Navigation focus is not stolen by the search trigger',
  );
  await click(search());
  assert.equal(input().value, '', 'Fresh search on reopen');
  await type('zzzznosuchtool987');
  assert.equal(dialog().querySelectorAll('[cmdk-item]').length, 0);
  assert.match(dialog().textContent, /Kein passendes Werkzeug/);
  await click(dialog().querySelector('[aria-label="Suche leeren"]'));
  assert.equal(input().value, '');
  assert.equal(document.activeElement === input(), true);
  await act(async () => {
    visual.height = 360;
    visual.offsetTop = 20;
    visual.dispatchEvent(new Event('resize'));
  });
  assert.equal(dialog().style.getPropertyValue('--search-keyboard-offset'), '420px');
  assert.equal(dialog().style.getPropertyValue('--search-viewport-height'), '360px');
  await key(input(), 'Escape');
  assert.equal(Boolean(dialog()), false);
  assert.equal(document.activeElement === search(), true);
  await click(search());
  await click(dialog().querySelector('.mobile-search-close'));
  assert.equal(Boolean(dialog()), false);
  assert.equal(document.activeElement === search(), true);
  await click(search());
  await act(async () => {
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    overlay.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    overlay.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, button: 0 }));
    overlay.click();
  });
  await flush();
  assert.equal(Boolean(dialog()), false, 'Backdrop dismisses the search');
  await click(search());
  await click(dialog().querySelector('.mobile-search-all'));
  assert.equal(allTools, 2);
  assert.equal(Boolean(dialog()), false);
  await click(search());
  await act(async () => {
    desktop.matches = true;
    desktop.dispatchEvent(new Event('change'));
  });
  await flush();
  assert.equal(Boolean(dialog()), false);
  assert.equal(document.activeElement.id, 'moinpdf-content');
  desktop.matches = false;
  await click(nav().querySelector('.harbor-project-toggle'));
  assert.match(dialog().textContent, /Retained project/);
  if (productionCss) {
    assert(
      centeringRules(dialog()).length > 0,
      'Standard project dialogs retain their centered placement',
    );
  }
  assert.equal(storage.reads, 1, 'Mobile project trigger loads projects');
  // Radix defers outside-pointer dismissal until click. The closing content can
  // outlive its overlay, allowing a trigger click to reopen it in that window.
  // A deferred event from the same trigger must not dismiss the reopened dialog.
  for (const trigger of [
    nav().querySelector('.harbor-project-toggle'),
    document.querySelector('.project-toggle'),
  ]) {
    await act(async () => {
      trigger.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      trigger.click();
    });
    await flush();
    assert(
      dialog(),
      'A deferred outside event from either project trigger must keep the dialog open',
    );
  }
  await key(document.activeElement, 'Escape');
  assert.equal(Boolean(dialog()), false);
  assert.equal(document.activeElement === nav().querySelector('.harbor-project-toggle'), true);
  await click(document.querySelector('.project-toggle'));
  assert.match(dialog().textContent, /Retained project/);
  assert.equal(storage.reads, 2, 'Desktop project trigger refreshes the same dialog');
  await key(document.activeElement, 'Escape');
  storage.setFailure(true);
  await click(nav().querySelector('.harbor-project-toggle'));
  assert.match(dialog().textContent, /Storage unavailable/);
  await key(document.activeElement, 'Escape');
  storage.setFailure(false);
  await render(false, true);
  await click(nav().querySelector('.harbor-project-toggle'));
  const downloadButton = [...dialog().querySelectorAll('button')].find(
    (button) => button.textContent === 'Projektdatei herunterladen',
  );
  let lockedAtDownload;
  downloads.setOnDownload(() => {
    // Deliver Escape exactly when the browser download would start, before
    // job() can commit its idle state. This deterministically exposes the
    // invalid assumption that download completion means the modal can close.
    lockedAtDownload = downloadButton.disabled;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await click(downloadButton);
  assert.equal(downloads.downloads, 0, 'Encoding is still pending');
  assert(downloadButton.disabled, 'Actions stay locked during archive encoding');
  await key(document.activeElement, 'Escape');
  assert(dialog(), 'Escape cannot dismiss a project operation in progress');
  await act(async () => archive.finishDownload());
  await flush();
  assert.equal(downloads.downloads, 1, 'Exactly one project download starts');
  assert.equal(lockedAtDownload, true, 'Download starts before the idle React commit');
  assert(dialog(), 'An Escape delivered at download start is still ignored');
  assert.equal(downloadButton.disabled, false, 'The completed operation re-enables actions');
  await key(document.activeElement, 'Escape');
  assert.equal(Boolean(dialog()), false, 'One Escape closes the idle project dialog');
  assert.equal(document.activeElement, nav().querySelector('.harbor-project-toggle'));
  downloads.setOnDownload(() => {});
  await render(true);
  assert(search().disabled);
  assert(nav().querySelector('.harbor-project-toggle').disabled);
  assert(document.querySelector('.home-all-tools').disabled);
  await click(search());
  assert.equal(Boolean(dialog()), false, 'Locked search cannot open');
  appearance.setLanguage('en');
  await render(false);
  assert.deepEqual(
    [...nav().querySelectorAll('button')].map((el) => el.textContent),
    ['Home', 'Tools', 'Search', 'Projects', 'More'],
  );
  await click(search());
  assert.match(dialog().textContent, /Search tools/);
  await type('make pdf smaller');
  assert.equal(dialog().querySelector('[cmdk-item]').dataset.toolId, 'compress');
  assert.match(dialog().querySelector('[cmdk-item]').textContent, /Compress/);
  await click(dialog().querySelector('[cmdk-item]'));
  assert.deepEqual(chosen, ['compress', 'compress']);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: mobile and desktop navigation, DE/EN intent search, real Radix/cmdk focus and selection, clear/empty/close/reopen, simulated keyboard viewport, resize, locked actions, project dialog refresh/error handling and deterministic download/Escape timing.',
  );
  if (productionCss)
    console.log(
      'PASS: minified production CSS applies no centering translation to mobile search; standard dialogs remain centered.',
    );
} finally {
  await act(async () => root.unmount());
  await flush();
  dom.window.close();
}
