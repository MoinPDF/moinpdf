// Exercise the real React lifecycle: startup must never leave the app covered.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

await mkdir('.cache/startup-animation', { recursive: true });
await writeFile('.cache/startup-animation/component.mjs', ts.transpileModule(
  await readFile('components/studio/startup-animation.tsx', 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://moinpdf.test' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no AnimationEvent constructor; advertise the standard event name to React.
window.AnimationEvent = window.Event;
let now = 0, nextTimer = 0, elapsed = 0, reduced = false;
const timers = new Map(), motionListeners = new Set();
window.setTimeout = (callback, delay) => {
  const id = ++nextTimer;
  timers.set(id, { callback, at: now + delay });
  return id;
};
window.clearTimeout = id => timers.delete(id);
window.matchMedia = query => {
  assert.equal(query, '(prefers-reduced-motion: reduce)');
  return {
    get matches() { return reduced; },
    addEventListener: (_, callback) => motionListeners.add(callback),
    removeEventListener: (_, callback) => motionListeners.delete(callback),
  };
};
HTMLElement.prototype.getAnimations = () => [{ animationName: 'moinpdf-startup-exit', currentTime: elapsed }];
const React = await import('react'), { act } = React;
const { createRoot } = await import('react-dom/client');
const { StartupAnimation } = await import('../.cache/startup-animation/component.mjs');
const root = createRoot(document.getElementById('root'));
const visible = () => document.querySelector('.moinpdf-startup');
let opened = 0;
const app = (label = 'Open PDF') => React.createElement(React.StrictMode, null,
  React.createElement(StartupAnimation),
  React.createElement('button', { onClick: () => opened++ }, label),
);
const advance = async ms => {
  now += ms;
  await act(async () => {
    for (const [id, timer] of [...timers]) if (timer.at <= now) {
      timers.delete(id);
      timer.callback();
    }
  });
};
const fresh = async () => {
  await act(async () => root.render(null));
  assert.equal(timers.size, 0, 'Unmount clears timers');
  assert.equal(motionListeners.size, 0, 'Unmount clears motion listeners');
  await act(async () => root.render(app()));
};
try {
  await fresh();
  assert(visible());
  assert.equal(timers.size, 1, 'StrictMode retains one timer');
  assert.equal(document.querySelector('button').textContent, 'Open PDF', 'Workspace mounts in parallel');
  await advance(2749);
  assert(visible(), 'Entrance remains until its full duration');
  await act(async () => root.render(app('Choose PDF')));
  await advance(1);
  assert.equal(Boolean(visible()), false, 'Rerender does not reset the 2.75-second deadline');
  await act(async () => root.render(app('Another tool')));
  assert.equal(Boolean(visible()), false, 'A tool/theme rerender does not replay the entrance');
  await act(async () => document.querySelector('button').click());
  assert.equal(opened, 1, 'Workspace remains usable');

  await fresh();
  await act(async () => visible().click());
  assert.equal(Boolean(visible()), false);
  assert.equal(opened, 1, 'Skipping does not click through to the workspace');
  assert.equal(timers.size, 0);
  for (const key of ['Escape', 'Tab']) {
    await fresh();
    const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => document.dispatchEvent(event));
    assert.equal(Boolean(visible()), false, key + ' skips');
    assert.equal(event.defaultPrevented, false, 'Normal keyboard navigation is retained');
  }

  reduced = true;
  await fresh();
  await advance(0);
  assert.equal(Boolean(visible()), false, 'Reduced motion adds no delay');
  reduced = false;
  await fresh();
  reduced = true;
  await act(async () => { for (const callback of [...motionListeners]) callback(); });
  assert.equal(Boolean(visible()), false, 'A live reduced-motion preference stops the entrance');
  reduced = false;

  elapsed = 2000;
  await fresh();
  await advance(749);
  assert(visible());
  await advance(1);
  assert.equal(Boolean(visible()), false, 'Hydration preserves the CSS animation deadline');
  elapsed = 4000;
  await fresh();
  await advance(0);
  assert.equal(Boolean(visible()), false, 'Late hydration never replays a completed entrance');

  elapsed = 2740;
  await fresh();
  // Let real time pass while deliberately withholding the window timer.
  await new Promise(resolve => setTimeout(resolve, 30));
  await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
  assert.equal(Boolean(visible()), false, 'Returning from a suspended tab releases the overlay');
  await fresh();
  await new Promise(resolve => setTimeout(resolve, 30));
  await act(async () => window.dispatchEvent(new window.Event('pageshow')));
  assert.equal(Boolean(visible()), false, 'Restoring an expired page releases the overlay');

  elapsed = 0;
  await fresh();
  const end = (target, name) => {
    const event = new window.Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: name });
    target.dispatchEvent(event);
  };
  await act(async () => end(document.querySelector('.startup-sailor-atlas'), 'moinpdf-startup-tear'));
  assert(visible(), 'A child animation cannot end the entrance early');
  await act(async () => end(visible(), 'moinpdf-startup-exit'));
  assert.equal(Boolean(visible()), false, 'The actual CSS end also releases the overlay');
  assert.equal(timers.size, 0);
  assert.equal(motionListeners.size, 0);
  console.log('PASS: 2.75 s entrance, parallel app mount, StrictMode, no replay, keyboard/tap skip, reduced motion, hydration and background-tab cleanup.');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
