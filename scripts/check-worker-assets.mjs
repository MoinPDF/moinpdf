import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

// Inspect the output actually shipped to browsers: source-level tests do not
// catch an SSR transform replacing import.meta.url with a build-machine URL.
const root = path.resolve(process.argv[2] || 'dist/client');
const origin = 'https://moinpdf.test';
const expected = new Set(['native-pdf', 'pro-tools', 'local-signature', 'model-checksum', 'editor-ocr']);
const workerAsset = /^\/(?:_next\/static|assets)\/(native-pdf|pro-tools|local-signature|model-checksum|editor-ocr)-[\w-]+\.js$/;
const workerUrls = new Set();
const failures = [];
const literal = (node) => node && ts.isStringLiteralLike(node) ? node.text : undefined;
function resolveUrl(node, moduleUrl) {
  const value = literal(node);
  if (value !== undefined) return new URL(value, origin + '/');
  if (!node || !ts.isNewExpression(node) || node.expression.getText() !== 'URL') return;
  const target = literal(node.arguments?.[0]);
  if (target === undefined) return;
  const base = node.arguments?.[1];
  if (base?.getText() === 'import.meta.url') return new URL(target, moduleUrl);
  const baseValue = literal(base);
  if (baseValue !== undefined) return new URL(target, baseValue);
}
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await inspect(file); continue; }
    if (!/\.m?js$/.test(entry.name)) continue;
    const source = await readFile(file, 'utf8');
    if (!/new\s+Worker\s*\(/.test(source) && !/(native-pdf|pro-tools|local-signature|model-checksum|editor-ocr)-[\w-]+\.js/.test(source)) continue;
    const relative = path.relative(root, file).split(path.sep).join('/');
    const moduleUrl = new URL(relative, origin + '/');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
      // Explicit ?worker&url imports feed the inherited-policy bootstrap.
      // Check those emitted entries as well as direct Worker constructors.
      if (ts.isStringLiteralLike(node) && workerAsset.test(node.text)) {
        const url = new URL(node.text, origin + '/');
        if (url.protocol !== 'https:' || url.origin !== origin)
          failures.push(`${relative}: invalid worker module URL: ${url.href}`);
        else workerUrls.add(url.href);
      }
      if (ts.isNewExpression(node) && node.expression.getText() === 'Worker') {
        const url = resolveUrl(node.arguments?.[0], moduleUrl);
        // Some third-party workers use runtime blob URLs; this check covers
        // statically emitted worker entries and their real deployed assets.
        if (url) {
          if (url.protocol !== 'https:' || url.origin !== origin) {
            failures.push(`${relative}: worker URL is not same-origin HTTPS: ${url.href}`);
          } else workerUrls.add(url.href);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
}
await inspect(root);
assert.equal(failures.length, 0, failures.join('\n'));
for (const href of workerUrls) {
  const url = new URL(href);
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  assert(file.startsWith(root + path.sep), `Worker escapes output directory: ${url.pathname}`);
  await access(file);
  for (const name of expected) {
    if (new RegExp(`^${name}-[\\w-]+\\.js$`).test(path.basename(file))) expected.delete(name);
  }
}
assert.equal(expected.size, 0, `Missing bundled worker entries: ${[...expected].join(', ')}`);
console.log(`PASS: ${workerUrls.size} emitted worker URLs resolve to existing same-origin assets; all five module workers included.`);
