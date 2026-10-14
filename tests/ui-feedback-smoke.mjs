import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

await mkdir('.cache/ui-feedback', { recursive: true });
for (const [source, target] of [
  ['lib/ui-feedback.ts', 'state'],
  ['components/studio/ui-feedback.tsx', 'components'],
]) {
  const code = ts
    .transpileModule(await readFile(source, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    .outputText.replaceAll("'@/lib/ui-feedback'", "'./state.mjs'");
  await writeFile(`.cache/ui-feedback/${target}.mjs`, code);
}
const { createFileArrivalFeedback, FILE_ARRIVAL_MS, contentUnderNavigation } =
  await import('../.cache/ui-feedback/state.mjs');
const { FileArrivalCheck, JobStatusIcon, resultScrollBehavior } =
  await import('../.cache/ui-feedback/components.mjs');

mock.timers.enable({ apis: ['setTimeout'] });
try {
  const feedback = createFileArrivalFeedback();
  const first = { name: 'Dokument.pdf' },
    sameName = { name: 'Dokument.pdf' },
    next = { name: 'Weiteres.pdf' };
  let notifications = 0;
  const unsubscribe = feedback.subscribe(() => notifications++);
  const empty = feedback.getSnapshot();
  feedback.mark([]);
  assert.equal(feedback.getSnapshot(), empty, 'An empty/failed import does not announce success');
  assert.equal(notifications, 0);
  feedback.mark([first, sameName, first]);
  assert.equal(feedback.getSnapshot().size, 2, 'Same filenames remain distinct file identities');
  assert.ok(feedback.getSnapshot().has(first));
  assert.equal(feedback.getServerSnapshot().size, 0, 'SSR never inherits a browser import');
  mock.timers.tick(FILE_ARRIVAL_MS - 1);
  assert.ok(feedback.getSnapshot().has(first), 'Feedback remains visible for the full interval');
  feedback.mark([next]);
  mock.timers.tick(1);
  assert.ok(feedback.getSnapshot().has(next), 'An older timeout must not clear a new import');
  assert.ok(!feedback.getSnapshot().has(first), 'Previous files are released');
  unsubscribe();
  const beforeExpiry = notifications;
  mock.timers.tick(FILE_ARRIVAL_MS);
  assert.equal(feedback.getSnapshot(), empty, 'Expiry releases all file references');
  assert.equal(notifications, beforeExpiry, 'Unmounted listeners are not called');
} finally {
  mock.timers.reset();
}

assert.equal(contentUnderNavigation(0, 1200, 700, 70), false, 'No extra edge at the top');
assert.equal(contentUnderNavigation(100, 900, 700, 70), true, 'Scrolled content under the bar');
assert.equal(
  contentUnderNavigation(100, 699, 700, 70),
  false,
  'No edge once content is above the bar',
);
assert.equal(contentUnderNavigation(100, 900, 0, 0), false, 'Hidden desktop mobile navigation');

const html = (props) => renderToStaticMarkup(React.createElement(JobStatusIcon, props));
assert.match(html({ working: true }), /data-state="working"/);
assert.doesNotMatch(html({ working: true }), /data-fresh/);
assert.match(html({ fresh: true }), /data-state="done" data-fresh="true"/);
assert.doesNotMatch(html({}), /data-fresh/, 'Opening an old result does not animate completion');
assert.match(
  html({ fresh: true }),
  /aria-hidden="true"/,
  'Decorative status does not duplicate live announcements',
);
assert.doesNotMatch(
  renderToStaticMarkup(React.createElement(FileArrivalCheck, { file: {} })),
  /data-arrived/,
  'Unknown files never get a success marker',
);

globalThis.window = { matchMedia: () => ({ matches: true }) };
assert.equal(resultScrollBehavior(), 'instant');
window.matchMedia = () => ({ matches: false });
assert.equal(resultScrollBehavior(), 'smooth');
delete globalThis.window;
console.log(
  'PASS: file identity, successful-import feedback, expiry, repeated imports, listener cleanup, navigation edge, progress/completion markup and reduced-motion scrolling.',
);
