import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import 'fake-indexeddb/auto';

await mkdir('.cache/interactions', { recursive: true });
for (const [source, name] of [
  ['lib/interaction-feedback.ts', 'interactions'],
  ['lib/local-projects.ts', 'local-projects'],
  ['lib/tool-draft-schema.ts', 'tool-draft-schema'],
  ['lib/editor-project-codec.ts', 'editor-project-codec'],
  ['lib/project-checkpoint.ts', 'checkpoint'],
  ['components/studio/search-highlight.tsx', 'highlight'],
]) {
  const output = ts
    .transpileModule(await readFile(source, 'utf8'), {
      fileName: source,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    .outputText.replaceAll("'./editor-project-codec'", "'./editor-project-codec.mjs'").replaceAll("'./local-projects'", "'./local-projects.mjs'").replaceAll("'./tool-draft-schema'", "'./tool-draft-schema.mjs'")
    .replaceAll("'@/lib/interaction-feedback'", "'./interactions.mjs'");
  await writeFile(`.cache/interactions/${name}.mjs`, output);
}
const {
  fileDragInfo,
  fileDropLabel,
  pageDropDestination,
  reorderPageItems,
  highlightedSearchParts,
  createUndoFeedbackGate,
} = await import('../.cache/interactions/interactions.mjs');
const { projectContentSignature, captureProjectCheckpoint, matchesProjectCheckpoint } =
  await import('../.cache/interactions/checkpoint.mjs');
const { saveProject, listProjects, loadProject, deleteProject } =
  await import('../.cache/interactions/local-projects.mjs');
const { SearchHighlight } = await import('../.cache/interactions/highlight.mjs');

// OS file drags, protected browser lists, internal page drags and both languages.
assert.deepEqual(fileDragInfo(null), { isFiles: false, count: null });
assert.deepEqual(fileDragInfo({ types: ['text/plain'], files: [], items: [{ kind: 'string' }] }), {
  isFiles: false,
  count: null,
});
assert.deepEqual(fileDragInfo({ types: ['Files'], files: [], items: [] }), {
  isFiles: true,
  count: null,
});
assert.deepEqual(
  fileDragInfo({
    types: ['Files'],
    files: [],
    items: [{ kind: 'file' }, { kind: 'string' }, { kind: 'file' }, { kind: 'file' }],
  }),
  { isFiles: true, count: 3 },
);
assert.deepEqual(fileDragInfo({ types: ['Files'], files: [{}, {}], items: [] }), {
  isFiles: true,
  count: 2,
});
assert.equal(fileDropLabel(1, 'de'), '1 Datei hier ablegen');
assert.equal(fileDropLabel(3, 'de'), '3 Dateien hier ablegen');
assert.equal(fileDropLabel(1, 'en'), 'Drop 1 file here');
assert.equal(fileDropLabel(3, 'en'), 'Drop 3 files here');
for (const count of [null, 0, -1, 1.5, NaN])
  assert.equal(fileDropLabel(count, 'en'), 'Drop files here');

// Every possible move keeps exactly the same page objects; invalid/no-op moves
// retain identity so they cannot create a misleading undo or dirty indicator.
for (let length = 1; length <= 25; length++) {
  const pages = Array.from({ length }, (_, i) => ({ id: `p${i}`, rotation: (i % 4) * 90 }));
  for (let from = 0; from < length; from++)
    for (let to = 0; to < length; to++) {
      const result = reorderPageItems(pages, pages[from].id, to);
      assert.equal(result[to], pages[from]);
      assert.equal(new Set(result).size, length);
      assert.deepEqual(
        result.filter((page) => page !== pages[from]),
        pages.filter((page) => page !== pages[from]),
      );
      assert.equal(pages[from].id, `p${from}`);
      if (from === to) assert.equal(result, pages);
    }
  for (const to of [-1, length, 1.5, NaN]) assert.equal(reorderPageItems(pages, 'p0', to), pages);
  assert.equal(reorderPageItems(pages, 'missing', 0), pages);
}
const slots = Array.from({ length: 4 }, (_, i) => ({
  id: `p${i}`,
  left: (i % 2) * 124,
  top: Math.floor(i / 2) * 174,
  width: 100,
  height: 150,
}));
assert.equal(pageDropDestination(slots, 'p0', 220, 300), 3, 'Drop after the last page across rows');
assert.equal(pageDropDestination(slots, 'p3', 5, 20), 0, 'Move last page to the beginning');
assert.equal(pageDropDestination(slots, 'p0', 130, 30), 0, 'Before next page is a no-op');
assert.equal(pageDropDestination(slots, 'p0', 210, 30), 1, 'After next page moves one place');
assert.equal(pageDropDestination(slots, 'p3', 5, 200), 2, 'Before first page of the next row');
assert.equal(pageDropDestination(slots, 'p0', 500, 500), 3, 'Drop in empty space after all pages');
assert.equal(pageDropDestination(slots, 'missing', 50, 50), -1);
assert.equal(pageDropDestination([], 'p0', 0, 0), -1);
assert.equal(pageDropDestination(slots.slice(0, 1), 'p0', 0, 0), -1);

const gate = createUndoFeedbackGate();
const first = gate.invalidate(),
  second = gate.invalidate();
assert.equal(gate.consume(first, false), false, 'An older toast cannot undo a later edit');
assert.equal(gate.consume(second, true), false, 'A running task blocks undo');
assert.equal(gate.consume(second, false), true);
assert.equal(gate.consume(second, false), false, 'Double activation never undoes twice');
const next = gate.invalidate();
gate.invalidate();
assert.equal(
  gate.consume(next, false),
  false,
  'Undo, redo, import and reset invalidate the old action',
);

const matched = (text, query) =>
  highlightedSearchParts(text, query)
    .filter((part) => part.match)
    .map((part) => part.text);
assert.deepEqual(matched('PDF komprimieren', 'kompri'), ['kompri']);
assert.deepEqual(matched('PDF zu PDF', 'pdf PDF'), ['PDF', 'PDF']);
assert.deepEqual(matched('Schwärzen prüfen', 'schwarzen prufen'), ['Schwärzen', 'prüfen']);
assert.deepEqual(matched('Straße', 'strasse'), ['Straße']);
assert.deepEqual(matched('Pru\u0308fen', 'pruf'), ['Pru\u0308f']);
assert.deepEqual(matched('PDF bearbeiten', 'pd pdf'), ['PDF']);
assert.deepEqual(matched('Ich möchte meine PDF bearbeiten', 'ich möchte meine'), []);
for (const query of ['', '[.*+?]', '😀', 'word', 'pdf', 'PRÜFEN']) {
  const text = '😀 PDF prüfen – café 👩‍💻';
  assert.equal(
    highlightedSearchParts(text, query)
      .map((part) => part.text)
      .join(''),
    text,
  );
}
const html = renderToStaticMarkup(
  React.createElement(SearchHighlight, { text: '<img src=x onerror=alert(1)> PDF', query: 'pdf' }),
);
assert.ok(!html.includes('<img'), 'Search highlights never parse document/tool text as HTML');
assert.ok(html.includes('&lt;img'));
assert.ok(html.includes('<mark class="tool-search-match">PDF</mark>'));

// Exercise the persisted IndexedDB state, including loaded projects, a rejected
// save, source replacement and returning to the saved content with undo.
const bytes = new Uint8Array([37, 80, 68, 70]);
const source = { id: 'source', name: 'Test.pdf', size: bytes.length, kind: 'pdf', bytes, pdf: {} };
const page = { id: 'page', sourceId: 'source', index: 0, rotation: 0, selected: true };
const state = {
  pages: [page],
  edits: { marks: {}, crops: {} },
  options: { language: 'deu' },
  history: [],
  future: [],
  activeId: 'page',
  toolId: 'organize',
  documentSessions: {},
  toolDrafts: { 'CoverPanel.title:source': 'Saved title' },
};
const signature = (value = state, name = 'Test') => projectContentSignature(name, value);
assert.equal(
  signature({ ...state, toolDrafts: undefined }),
  signature({ ...state, toolDrafts: {} }),
  'Legacy projects without tool drafts match the empty defaults used after opening',
);
assert.equal(matchesProjectCheckpoint(null, undefined, [source], signature()), false);
const id = await saveProject('Test', undefined, [source], state);
const checkpoint = captureProjectCheckpoint(id, 'Test', [source], state);
assert.equal(matchesProjectCheckpoint(checkpoint, id, [source], signature()), true);
assert.equal(matchesProjectCheckpoint(checkpoint, id, [{ ...source }], signature()), true);
assert.equal(matchesProjectCheckpoint(checkpoint, undefined, [source], signature()), false);
assert.equal(matchesProjectCheckpoint(checkpoint, 'another', [source], signature()), false);
assert.equal(matchesProjectCheckpoint(checkpoint, id, [], signature()), false);
for (const changed of [
  { ...state, pages: [{ ...page, rotation: 90 }] },
  { ...state, pages: [{ ...page, selected: false }] },
  { ...state, pages: [] },
  {
    ...state,
    edits: { marks: { page: [{ id: 'mark', kind: 'text', text: 'Change' }] }, crops: {} },
  },
  { ...state, options: { language: 'eng' } },
  { ...state, toolDrafts: { 'CoverPanel.title:source': 'Changed title' } },
  { ...state, toolDrafts: {} },
  { ...state, documentSessions: { source: { current: { fields: [{ value: 'Name' }] } } } },
])
  assert.equal(matchesProjectCheckpoint(checkpoint, id, [source], signature(changed)), false);
assert.equal(
  matchesProjectCheckpoint(checkpoint, id, [source], signature(state, 'New name')),
  false,
);
assert.equal(
  matchesProjectCheckpoint(checkpoint, id, [{ ...source, bytes: bytes.slice() }], signature()),
  false,
);
assert.equal(
  matchesProjectCheckpoint(checkpoint, id, [{ ...source, name: 'Renamed.pdf' }], signature()),
  false,
);
assert.equal(
  matchesProjectCheckpoint(
    checkpoint,
    id,
    [source],
    signature({ ...state, activeId: '', toolId: 'ocr', history: [state], future: [state] }),
  ),
  true,
  'Navigation/history does not dirty identical saved content',
);
assert.equal(
  matchesProjectCheckpoint(checkpoint, id, [source], signature(state, ' Test ')),
  true,
  'Matches the trimmed persisted name',
);
const saved = await loadProject((await listProjects())[0].versions[0].id);
const restoredCheckpoint = captureProjectCheckpoint(id, 'Test', saved.sources, saved.version.state);
assert.equal(
  matchesProjectCheckpoint(restoredCheckpoint, id, saved.sources, signature(saved.version.state)),
  true,
);
await assert.rejects(() => saveProject('', id, [source], state), /Projektnamen/);
assert.equal(
  (await listProjects())[0].versions.length,
  1,
  'Rejected save creates no checkpoint/version',
);
assert.equal(
  matchesProjectCheckpoint(checkpoint, id, [source], signature()),
  true,
  'Undo back to saved content is clean again',
);
await deleteProject(id);
assert.equal((await listProjects()).length, 0);
console.log(
  'PASS: file-drag counts and fallback, DE/EN labels, 5,525 page moves, grid insertion boundaries, stale/double/locked undo protection, Unicode and safe search markup, IndexedDB save/restore/failure and content-aware project status.',
);
