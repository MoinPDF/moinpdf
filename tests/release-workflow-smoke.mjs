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
const image = name => ({ source, image: `ghcr.io/moinpdf/moinpdf-${name}:0.9.2-${source.slice(0, 12)}`, digest: `sha256:${'b'.repeat(64)}`, platforms: ['linux/amd64', 'linux/arm64'] });
async function run(patch = {}) {
  const imageRun = { path: '.github/workflows/publish-images.yml', conclusion: 'success', head_branch: 'main', repository: { full_name: 'MoinPDF/moinpdf' }, event: 'workflow_run', ...patch.run };
  const images = ['web', 'documents', 'translation'].map(image);
  patch.images?.(images);
  const outputs = {}, writes = {};
  const fs = {
    readFileSync(file) {
      if (file === 'package.json') return JSON.stringify({ version: '0.9.2' });
      if (file === 'CHANGELOG.md') return '## 0.9.2 – 2026-10-11\n\nVerified changes\n';
      const index = ['web', 'documents', 'translation'].indexOf(path.basename(file, '.json'));
      assert.notEqual(index, -1);
      return JSON.stringify(images[index]);
    },
    writeFileSync(file, value) { writes[file] = value; },
  };
  const github = { rest: {
    actions: {
      getWorkflowRun: async () => ({ data: imageRun }),
      listWorkflowRuns: async args => {
        assert.equal(args.head_sha, source);
        assert.equal(args.branch, 'main');
        assert.equal(args.event, 'push');
        return { data: { workflow_runs: patch.noTests ? [] : [{ head_sha: source, conclusion: 'success' }] } };
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
