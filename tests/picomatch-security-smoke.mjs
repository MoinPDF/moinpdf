import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const matcherPath = require.resolve('picomatch');
const pm = require(matcherPath);
const pkg = require('picomatch/package.json');
assert.equal(pkg.name, '@moinpdf/picomatch');
assert.equal(pkg.moinpdfPatchLevel, 1);

for (const pattern of ['+(*)', '+(*a)', '*(a*)', '+(*?a)', '+(*a|b)', '+(@(*a))']) {
  const child = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const pm = require(${JSON.stringify(matcherPath)});
    const pattern = ${JSON.stringify(pattern)};
    const match = pm(pattern);
    // A separator forces a failed match; the old nested regex backtracks.
    assert.equal(match('a'.repeat(128) + '/!'), false);
    assert.equal(match('a'.repeat(128) + '!'), false);
    assert.equal(match(pattern), true);
  `], { timeout: 2000, encoding: 'utf8' });
  assert.equal(child.error, undefined, `${pattern}: deadline exceeded`);
  assert.equal(child.status, 0, `${pattern}: ${child.stderr}`);
}
for (const [pattern, yes, no] of [
  ['**/*.{ts,tsx}', 'components/studio/editor.tsx', 'components/editor.css'],
  ['**/*.test.js', 'lib/parser.test.js', 'lib/parser.js'],
  ['+(foo|bar).js', 'foobar.js', 'other.js'],
  ['src/@(app|lib)/*.ts', 'src/app/index.ts', 'src/test/index.ts'],
  ['+([*])', '***', 'aaa'],
  [String.raw`+(\*)`, '**', 'aaa'],
  ['+(*(a)|*(b))', 'abba', 'abc'],
]) {
  assert.equal(pm(pattern)(yes), true, `${pattern}: ${yes}`);
  assert.equal(pm(pattern)(no), false, `${pattern}: ${no}`);
}
console.log('PASS: patched transitive matcher, bounded hostile extglobs, ordinary build patterns and escaped literals.');
