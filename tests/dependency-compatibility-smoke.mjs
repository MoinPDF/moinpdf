import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const require = createRequire(import.meta.url);
const eslintRequire = createRequire(require.resolve('eslint'));
const parserRequire = createRequire(require.resolve('typescript-eslint'));
const estreeRequire = createRequire(
  createRequire(parserRequire.resolve('@typescript-eslint/parser')).resolve('@typescript-eslint/typescript-estree'),
);
const consumers = [
  ['eslint', eslintRequire],
  ['@eslint/config-array', createRequire(eslintRequire.resolve('@eslint/config-array'))],
  ['@typescript-eslint/typescript-estree', estreeRequire],
];
for (const [name, consumer] of consumers) {
  const { minimatch, Minimatch } = consumer('minimatch');
  const version = consumer('minimatch/package.json').version;
  assert.match(version, /^11\./, `${name} must use the reviewed, patched minimatch major`);
  assert.notEqual(version, '11.0.0', `${name} must include the globparts fix`);
  for (const [file, pattern, options, expected] of [
    ['lib/editor.ts', '**/*.{ts,tsx}', {}, true],
    ['components/nested/view.tsx', '**/*.{ts,tsx}', {}, true],
    ['lib/editor.js', '**/*.{ts,tsx}', {}, false],
    ['lib/.hidden.ts', '**/*.ts', {}, false],
    ['lib/.hidden.ts', '**/*.ts', { dot: true }, true],
    ['lib/EDITOR.TS', '**/*.ts', { nocase: true }, true],
    ['lib/editor.test.ts', '**/!(*.test).ts', {}, false],
    ['lib/editor.ts', '**/!(*.test).ts', {}, true],
  ]) {
    assert.equal(minimatch(file, pattern, options), expected, name);
    assert.equal(new Minimatch(pattern, options).match(file), expected, name);
  }
  // ESLint traverses directories using partial matches, not just complete paths.
  assert.equal(new Minimatch('src/**/*.ts').match('src/nested', true), true, name);
  assert.equal(new Minimatch('src/**/*.ts').match('other', true), false, name);
  // Bound both time and memory: the formerly amplifying pattern runs in a child.
  execFileSync(process.execPath, ['--max-old-space-size=128', '-e', `
    const { Minimatch } = require(${JSON.stringify(consumer.resolve('minimatch'))});
    const matcher = new Minimatch('a/' + '**/../'.repeat(24) + 'z', { optimizationLevel: 2 });
    if (typeof matcher.match('a/z') !== 'boolean') process.exit(1);
  `], { timeout: 5000, stdio: 'pipe' });
}

await mkdir('.cache', { recursive: true });
const directory = await mkdtemp(path.resolve('.cache/dependency-compatibility-'));
try {
  await mkdir(path.join(directory, 'src/nested'), { recursive: true });
  await mkdir(path.join(directory, 'src/generated'), { recursive: true });
  for (const file of ['src/main.ts', 'src/nested/view.tsx', 'src/.hidden.ts', 'src/generated/skip.ts']) {
    await writeFile(path.join(directory, file), 'const value: number = 1; debugger;\n');
  }
  const linter = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: ['src/generated/**'] },
      { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser }, rules: { 'no-debugger': 'error' } },
    ],
  });
  const results = await linter.lintFiles(['src/**/*.{ts,tsx}']);
  assert.deepEqual(results.map(result => path.relative(directory, result.filePath)).sort(),
    ['src/.hidden.ts', 'src/main.ts', 'src/nested/view.tsx']);
  for (const result of results) {
    assert.equal(result.errorCount, 1);
    assert.equal(result.messages[0].ruleId, 'no-debugger');
  }
  assert.equal(await linter.isPathIgnored(path.join(directory, 'src/generated/skip.ts')), true);
  // Exercise TypeScript-ESLint's minimatch() path for allowDefaultProject.
  await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({ files: ['included.ts'] }));
  await writeFile(path.join(directory, 'included.ts'), 'export {};\n');
  const parsed = tseslint.parser.parseForESLint('const value: number = 1;', {
    filePath: path.join(directory, 'single.ts'),
    tsconfigRootDir: directory,
    projectService: { allowDefaultProject: ['single.ts'] },
  });
  assert.ok(parsed.services.program, 'Default-project matching must produce type information');
} finally {
  parserRequire('@typescript-eslint/parser').clearCaches();
  await rm(directory, { recursive: true, force: true });
}
console.log('PASS: patched minimatch in all three consumers, bounded glob preprocessing, ESLint file/ignore selection and error detection, TypeScript-ESLint default-project matching.');
