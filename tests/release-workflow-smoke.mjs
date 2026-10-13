import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const workflow = await readFile('.github/workflows/release.yml', 'utf8');
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
  const outputs = {}, writes = {};
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
    repos: { getBranch: async () => ({ data: { commit: { sha: patch.current || source } } }) },
  } };
  await verify(name => name === 'fs' ? fs : path, github, { repo: { owner: 'MoinPDF', repo: 'moinpdf' }, sha: source }, { setOutput: (name, value) => { outputs[name] = value; } }, { env: { IMAGE_RUN_ID: '123', RUNNER_TEMP: '/tmp/release-test' } });
  return { outputs, writes };
}
const good = await run();
assert.equal(good.outputs.tag, 'v0.9.2');
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

const publishWorkflow = await readFile('.github/workflows/publish-images.yml', 'utf8');
const publishScript = publishWorkflow.match(/          script: \|\n([\s\S]*?)\n  image:/)?.[1]
  .split('\n').map(line => line.replace(/^            /, '')).join('\n');
assert.ok(publishScript);
const publishVerify = new AsyncFunction('github', 'context', 'core', 'process', publishScript);
async function publish(patch = {}, eventName = 'workflow_run') {
  const outputs = {}, calls = [];
  const run = { id: 456, path: '.github/workflows/docker.yml', status: 'completed', conclusion: 'success', head_sha: source, head_branch: 'main', event: 'push', repository: { full_name: 'MoinPDF/moinpdf' }, head_repository: { full_name: 'MoinPDF/moinpdf' }, ...patch };
  const github = { rest: { actions: {
    getWorkflowRun: async ({ run_id }) => { calls.push('get'); assert.equal(run_id, 456); return { data: run }; },
    // Reproduce the production incident: the list index has not caught up yet.
    listWorkflowRuns: async () => { calls.push('list'); return { data: { workflow_runs: eventName === 'workflow_run' ? [] : [run] } }; },
  } } };
  await publishVerify(github, { repo: { owner: 'MoinPDF', repo: 'moinpdf' }, eventName, payload: { workflow_run: { id: 456 } } }, { setOutput: (key, value) => { outputs[key] = value; } }, { env: { SOURCE_SHA: source } });
  return { outputs, calls };
}
const published = await publish();
assert.deepEqual(published, { outputs: { source, run_id: 456 }, calls: ['get'] });
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
