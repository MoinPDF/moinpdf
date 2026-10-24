import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const workflow = (await readFile('.github/workflows/release.yml', 'utf8')).replace(/\r\n/g, '\n');
const script = workflow.match(/          script: \|\n([\s\S]*?)\n      - name:/)?.[1]
  .split('\n').map(line => line.replace(/^            /, '')).join('\n');
assert.ok(script, 'Release verification script exists');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const verify = new AsyncFunction('require', 'github', 'context', 'core', 'process', script);
const source = 'a'.repeat(40);
const image = name => ({ source, verificationRun: 456, image: `ghcr.io/moinpdf/moinpdf-${name}:0.9.2-${source.slice(0, 12)}`, digest: `sha256:${'b'.repeat(64)}`, platforms: ['linux/amd64', 'linux/arm64'] });
async function run(patch = {}) {
  const imageRun = { path: '.github/workflows/publish-images.yml', conclusion: 'success', head_branch: 'main', repository: { full_name: 'MoinPDF/moinpdf' }, event: 'workflow_run', ...patch.run };
  const images = ['web', 'documents', 'translation', 'website'].map(image);
  patch.images?.(images);
  const outputs = {}, writes = {}, messages = [], gitCalls = [];
  const fs = {
    readFileSync(file) {
      if (file === 'package.json') return JSON.stringify({ version: '0.9.2' });
      if (file === 'CHANGELOG.md') return '## 0.9.2 – 2026-10-11\n\nVerified changes\n';
      const index = ['web', 'documents', 'translation', 'website'].indexOf(path.basename(file, '.json'));
      assert.notEqual(index, -1);
      return JSON.stringify(images[index]);
    },
    writeFileSync(file, value) { writes[file] = value; },
  };
  const github = { rest: {
    actions: {
      getWorkflowRun: async ({run_id}) => {
        if (run_id === 123) return { data: imageRun };
        assert.equal(run_id, 456);
        return { data: { path: '.github/workflows/docker.yml', status: 'completed', conclusion: patch.noTests ? 'failure' : 'success', head_sha: source, head_branch: 'main', event: 'push', repository: {full_name: 'MoinPDF/moinpdf'}, head_repository: {full_name: 'MoinPDF/moinpdf'}, ...patch.docker } };
      },
    },
    repos: {
      getBranch: async () => ({ data: { commit: { sha: patch.current || source } } }),
      getReleaseByTag: async ({ tag }) => {
        assert.equal(tag, 'v0.9.2');
        patch.onReleaseLookup?.();
        if (patch.releaseError) throw patch.releaseError;
        if (!Object.hasOwn(patch, 'release')) throw Object.assign(new Error('Not Found'), { status: 404 });
        return { data: patch.release };
      },
    },
  } };
  const childProcess = { execFileSync(command, args, options) {
    assert.equal(command, 'git');
    gitCalls.push(args);
    if (patch.gitError?.[args[0]]) throw patch.gitError[args[0]];
    if (args[0] === 'rev-parse') {
      assert.deepEqual(args, ['rev-parse', '--verify', 'refs/tags/v0.9.2^{commit}']);
      assert.equal(options.encoding, 'utf8');
      return `${patch.releasedSource || source}\n`;
    }
    if (args[0] === 'merge-base') {
      assert.deepEqual(args, ['merge-base', '--is-ancestor', patch.releasedSource || source, source]);
      return '';
    }
    if (args[0] === 'diff') {
      assert.deepEqual(args, ['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', patch.releasedSource || source, source, '--']);
      assert.equal(options.encoding, 'utf8');
      return (patch.changed || []).map(file => file + '\0').join('');
    }
    throw new Error(`Unexpected git command: ${args[0]}`);
  } };
  const modules = { fs, path, child_process: childProcess };
  await verify(name => { assert.ok(Object.hasOwn(modules, name)); return modules[name]; }, github, { repo: { owner: 'MoinPDF', repo: 'moinpdf' }, sha: source }, { setOutput: (name, value) => { outputs[name] = value; }, info: message => { messages.push(message); } }, { env: { IMAGE_RUN_ID: '123', RUNNER_TEMP: '/tmp/release-test' } });
  return { outputs, writes, messages, gitCalls };
}
const good = await run();
assert.equal(good.outputs.tag, 'v0.9.2');
assert.equal(good.outputs.publish, 'true');
assert.deepEqual(good.gitCalls, [], 'A new release does not compare against a missing tag');
assert.match(Object.values(good.writes)[0], new RegExp(source));
await run({ run: { event: 'workflow_dispatch' } });
for (const runPatch of [
  { conclusion: 'failure' }, { path: '.github/workflows/untrusted.yml' },
  { head_branch: 'feature' }, { repository: { full_name: 'Other/fork' } },
  { event: 'pull_request' },
]) await assert.rejects(() => run({ run: runPatch }), /Images must come/);
await assert.rejects(() => run({ noTests: true }), /Missing successful Docker/);
await assert.rejects(() => run({ current: 'c'.repeat(40) }), /superseded/);
await assert.rejects(() => run({ images: refs => { refs[1].source = 'c'.repeat(40); } }), /Mixed image/);
await assert.rejects(() => run({ images: refs => { refs.forEach(ref => { ref.source = 'c'.repeat(40); }); } }), /exactly match/);
await assert.rejects(() => run({ images: refs => { refs[0].platforms = ['linux/amd64']; } }), /both platforms/);
await assert.rejects(() => run({ images: refs => { refs[0].image = 'ghcr.io/other/app:latest'; } }), /Image reference/);
await assert.rejects(() => run({ images: refs => { refs[0].digest = 'latest'; } }), /Image reference/);
console.log('PASS: release accepts verified images and rejects failed tests, stale or mixed commits, foreign workflows/repos, wrong tags, missing platforms and invalid digests.');

for (const docker of [{ head_sha: 'c'.repeat(40) }, { head_branch: 'feature' }, { event: 'pull_request' }, { status: 'in_progress' }, { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'Other/fork' } }]) await assert.rejects(() => run({ docker }), /Missing successful Docker/);
await assert.rejects(() => run({ images: refs => { delete refs[0].verificationRun; } }), /Mixed or missing Docker/);
await assert.rejects(() => run({ images: refs => { refs[1].verificationRun = 789; } }), /Mixed or missing Docker/);

// Reproduce README edits after a stable version has already been published.
// No Git dependency is needed inside the slim verification container: the mock
// returns Git's complete NUL-delimited path protocol, including rename targets.
const release = { tag_name: 'v0.9.2', draft: false, prerelease: false, published_at: '2026-10-11T12:00:00Z' };
const metadata = ['README.md', 'README.en.md', '.github/workflows/release.yml', 'tests/release-workflow-smoke.mjs'];
for (const changed of [[], ['README.md'], ['README.en.md'], metadata]) {
  const kept = await run({ release, releasedSource: 'c'.repeat(40), changed });
  assert.equal(kept.outputs.publish, 'false');
  assert.equal(kept.outputs.tag, 'v0.9.2');
  assert.match(kept.messages[0], /Keeping the existing release and its image references/);
  assert.equal(kept.gitCalls.length, 3);
}
assert.equal((await run({ release })).outputs.publish, 'false', 'An exact-source rerun keeps the existing release');
assert.match(workflow, /- name: Create the version tag and release\n        if: steps\.verify\.outputs\.publish == 'true'/, 'Only a verified new version enters the release mutation step');
assert.match(workflow, /if gh release view[\s\S]*?exit 1/, 'The final race check still refuses to overwrite a release');
for (const file of [
  'src/App.tsx', 'Dockerfile', 'compose.yaml', 'server/app.py', 'docker/website/Dockerfile',
  'package.json', 'pnpm-lock.yaml', 'public/branding/logo.svg', 'CHANGELOG.md',
  '.github/workflows/docker.yml', '.github/workflows/publish-images.yml', 'tests/pdf-smoke.mjs',
  'src/README.md', 'README.md.backup', 'README.md\nREADME.en.md', 'README.md\tREADME.en.md',
  'README.md ', 'README.md\\README.en.md',
]) await assert.rejects(() => run({ release, changed: ['README.md', file] }), /application changes require a new version/);
// A rename out of a permitted path includes the old and new names with --no-renames.
await assert.rejects(() => run({ release, changed: ['README.md', 'src/renamed-readme.md'] }), /new version.*src\/renamed-readme/);
await assert.rejects(() => run({ release, changed: ['README.md', ...Array.from({length: 350}, (_, index) => `src/file-${index}.js`)] }), /application changes require a new version/);
for (const existing of [
  {...release, draft: true}, {...release, prerelease: true}, {...release, published_at: null},
  {...release, draft: undefined}, {...release, prerelease: undefined},
]) await assert.rejects(() => run({ release: existing }), /published stable release/);
for (const existing of [null, {}, {...release, tag_name: 'v0.9.1'}]) {
  await assert.rejects(() => run({ release: existing }), /Invalid existing release response/);
}
for (const status of [401, 403, 429, 500, undefined]) {
  const error = Object.assign(new Error('Release lookup failed'), { status });
  await assert.rejects(() => run({ releaseError: error }), error);
}
for (const command of ['rev-parse', 'merge-base', 'diff']) {
  const error = new Error(`${command} failed`);
  await assert.rejects(() => run({ release, gitError: {[command]: error} }), command === 'merge-base' ? /ancestor/ : error);
}
await assert.rejects(() => run({ release, releasedSource: 'not-a-commit' }), /Invalid published release tag/);
let existingReleaseLookups = 0;
const existing = { release, onReleaseLookup: () => { existingReleaseLookups++; } };
await assert.rejects(() => run({...existing, run: {conclusion: 'failure'}}), /Images must come/);
await assert.rejects(() => run({...existing, noTests: true}), /Missing successful Docker/);
await assert.rejects(() => run({...existing, current: 'c'.repeat(40)}), /superseded/);
await assert.rejects(() => run({...existing, images: refs => { refs[0].platforms = ['linux/amd64']; }}), /both platforms/);
await assert.rejects(() => run({...existing, images: refs => { refs[1].source = 'c'.repeat(40); }}), /Mixed image/);
assert.equal(existingReleaseLookups, 0, 'An existing release never bypasses source, platform or Docker verification');
console.log('PASS: already released versions keep their original artifacts only after full verification and a complete metadata-only tree comparison; application changes, invalid releases, API/Git failures and unsafe rename/path cases are rejected.');

const publishWorkflow = (await readFile('.github/workflows/publish-images.yml', 'utf8')).replace(/\r\n/g, '\n');
const publishScript = publishWorkflow.match(/          script: \|\n([\s\S]*?)\n  image:/)?.[1]
  .split('\n').map(line => line.replace(/^            /, '')).join('\n');
assert.ok(publishScript);
const publishVerify = new AsyncFunction('github', 'context', 'core', 'process', publishScript);
async function publish(patch = {}, eventName = 'workflow_run', checkPatch = {}) {
  const outputs = {}, calls = [];
  const run = { id: 456, path: '.github/workflows/docker.yml', status: 'completed', conclusion: 'success', head_sha: source, head_branch: 'main', event: 'push', repository: { full_name: 'MoinPDF/moinpdf' }, head_repository: { full_name: 'MoinPDF/moinpdf' }, ...patch };
  const github = { rest: { actions: {
    getWorkflowRun: async ({ run_id }) => { calls.push('get'); assert.equal(run_id, 456); return { data: run }; },
    // Reproduce the production incident: the list index has not caught up yet.
    listWorkflowRuns: async ({workflow_id}) => {
      if (workflow_id !== 'docker.yml') {
        calls.push(workflow_id);
        return { data: {workflow_runs: checkPatch.missing ? [] : [{...run,id:789,path:`.github/workflows/${workflow_id}`,...checkPatch}]} };
      }
      calls.push('list'); return { data: { workflow_runs: eventName === 'workflow_run' ? [] : [run] } };
    },
  } } };
  await publishVerify(github, { repo: { owner: 'MoinPDF', repo: 'moinpdf' }, eventName, payload: { workflow_run: { id: 456 } } }, { setOutput: (key, value) => { outputs[key] = value; } }, { env: { SOURCE_SHA: source } });
  return { outputs, calls };
}
const published = await publish();
assert.deepEqual(published, { outputs: { source, run_id: 456 }, calls: ['get', 'editor.yml', 'browser-text.yml', 'documentation.yml'] });
assert.equal((await publish({}, 'workflow_dispatch')).outputs.source, source);
for (const patch of [
  { conclusion: 'failure' }, { status: 'in_progress' }, { head_sha: 'c'.repeat(40) },
  { path: '.github/workflows/other.yml' }, { head_branch: 'feature' }, { event: 'pull_request' },
  { repository: { full_name: 'Other/fork' } }, { head_repository: { full_name: 'Other/fork' } },
]) {
  await assert.rejects(() => publish(patch), /successful complete Docker/);
  await assert.rejects(() => publish(patch, 'workflow_dispatch'), /successful complete Docker/);
}
console.log('PASS: image publication uses the completed run directly despite a stale list index and rejects unverified sources; releases retain the same verification run.');
for (const check of [
  {missing:true}, {conclusion:'failure'}, {status:'in_progress'}, {status:'queued'},
  {head_sha:'c'.repeat(40)}, {head_branch:'feature'}, {event:'pull_request'},
  {repository:{full_name:'Other/fork'}}, {head_repository:{full_name:'Other/fork'}},
]) await assert.rejects(() => publish({}, 'workflow_run', check), /verification of this exact source/);
console.log('PASS: image publication also requires successful editor, browser compatibility and documentation checks on the exact main source.');
