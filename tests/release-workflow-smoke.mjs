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
const publishVerify = new AsyncFunction('github', 'context', 'core', 'process', 'Date', 'setTimeout', publishScript);
async function publish(patch = {}, eventName = 'workflow_run', checkPatch = {}, scenario = {}) {
  const outputs = {}, calls = [], messages = [];
  let now = 0, sleeps = 0, reads = 0;
  const run = { id: 456, path: '.github/workflows/docker.yml', status: 'completed', conclusion: 'success', head_sha: source, head_branch: 'main', event: 'push', repository: { full_name: 'MoinPDF/moinpdf' }, head_repository: { full_name: 'MoinPDF/moinpdf' }, ...patch };
  const github = { rest: { actions: {
    getWorkflowRun: async ({ run_id }) => {
      calls.push('get'); assert.equal(run_id, 456); reads++;
      return { data: reads > 1 ? {...run, ...scenario.dockerAfterWait} : run };
    },
    // The completed Docker webhook can precede the list index. The other
    // workflows can also appear late or finish after the publishing job starts.
    listWorkflowRuns: async ({workflow_id, head_sha, branch, event}) => {
      assert.equal(head_sha, source);
      if (workflow_id !== 'docker.yml') {
        assert.equal(branch, 'main'); assert.equal(event, 'push');
        calls.push(workflow_id);
        if (scenario.apiError) throw scenario.apiError;
        const state = scenario.checkAt?.({workflow: workflow_id, sleeps}) ?? checkPatch;
        const check = {...run, id:789, path:`.github/workflows/${workflow_id}`, ...state};
        return { data: {workflow_runs: scenario.candidates?.(check) ?? (state.missing ? [] : [check])} };
      }
      calls.push('list');
      return { data: { workflow_runs: scenario.dockerCandidates ?? (eventName === 'workflow_run' ? [] : [run]) } };
    },
  }, repos: {
    getBranch: async ({branch}) => {
      assert.equal(branch, 'main'); calls.push('main');
      return {data: {commit: {sha: scenario.currentAt?.(sleeps) ?? source}}};
    },
  } } };
  const core = {
    setOutput: (key, value) => { outputs[key] = value; scenario.onOutput?.(key, value); },
    info: message => messages.push(message),
  };
  await publishVerify(github, { repo: { owner: 'MoinPDF', repo: 'moinpdf' }, eventName, payload: { workflow_run: { id: 456 } } }, core, { env: { SOURCE_SHA: source } }, { now: () => now }, (callback, delay) => {
    assert.equal(delay, 30_000); sleeps++; now += delay; callback();
  });
  return { outputs, calls, messages, sleeps };
}
const published = await publish();
assert.deepEqual(published.outputs, { source, run_id: 456 });
assert.deepEqual(published.calls, ['get', 'main', 'editor.yml', 'browser-text.yml', 'documentation.yml', 'get']);
assert.equal(published.sleeps, 0);
assert.equal((await publish({}, 'workflow_dispatch')).outputs.source, source);
for (const patch of [
  { conclusion: 'failure' }, { status: 'in_progress' }, { head_sha: 'c'.repeat(40) },
  { path: '.github/workflows/other.yml' }, { head_branch: 'feature' }, { event: 'pull_request' },
  { repository: { full_name: 'Other/fork' } }, { head_repository: { full_name: 'Other/fork' } },
]) {
  await assert.rejects(() => publish(patch), /successful complete Docker/);
  await assert.rejects(() => publish(patch, 'workflow_dispatch'), /successful complete Docker/);
}
console.log('PASS: image publication uses the completed Docker run despite a stale list index and rejects unverified sources.');

for (const status of ['queued', 'in_progress', 'waiting', 'pending']) {
  const delayed = await publish({}, 'workflow_run', {}, {
    checkAt: ({workflow, sleeps}) => workflow === 'editor.yml' && sleeps < 2 ? {status, conclusion:null} : {},
  });
  assert.equal(delayed.sleeps, 2);
  assert.equal(delayed.messages.length, 2);
  assert.deepEqual(delayed.outputs, {source, run_id:456});
}
const indexedLate = await publish({}, 'workflow_run', {}, {
  checkAt: ({sleeps}) => sleeps < 2 ? {missing:true} : sleeps < 4 ? {status:'in_progress', conclusion:null} : {},
});
assert.equal(indexedLate.sleeps, 4, 'Missing and unfinished checks can settle without rejecting a valid release');
for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', null]) {
  let outputs = 0;
  await assert.rejects(() => publish({}, 'workflow_run', {conclusion}, {onOutput: () => outputs++}), /verification of this exact source/);
  assert.equal(outputs, 0, 'Failed or skipped checks never produce publication outputs');
}
for (const check of [
  {missing:true}, {status:'in_progress', conclusion:null}, {status:'queued', conclusion:null},
  {head_sha:'c'.repeat(40)}, {head_branch:'feature'}, {event:'pull_request'},
  {repository:{full_name:'Other/fork'}}, {head_repository:{full_name:'Other/fork'}},
]) {
  let outputs = 0;
  await assert.rejects(() => publish({}, 'workflow_run', check, {onOutput: () => outputs++}), /Timed out waiting for verification of this exact source/);
  assert.equal(outputs, 0, 'Missing, stalled or foreign checks remain blocked at the deadline');
}
await assert.rejects(() => publish({}, 'workflow_run', {}, {
  candidates: check => [{...check, id:10}, {...check, id:20, conclusion:'failure'}],
}), /verification of this exact source/);
await assert.rejects(() => publish({}, 'workflow_run', {}, {
  checkAt: ({sleeps}) => sleeps ? {conclusion:'failure'} : {status:'in_progress', conclusion:null},
}), /verification of this exact source/);
await assert.rejects(() => publish({}, 'workflow_run', {status:'in_progress', conclusion:null}, {
  currentAt: sleeps => sleeps ? 'c'.repeat(40) : source,
}), /superseded on main/);
await assert.rejects(() => publish({}, 'workflow_run', {}, {dockerAfterWait:{conclusion:'failure'}}), /successful complete Docker/);
const goodDocker = {id:456, path:'.github/workflows/docker.yml', status:'completed', conclusion:'success', head_sha:source, head_branch:'main', event:'push', repository:{full_name:'MoinPDF/moinpdf'}, head_repository:{full_name:'MoinPDF/moinpdf'}};
await assert.rejects(() => publish({}, 'workflow_dispatch', {}, {
  dockerCandidates:[goodDocker, {...goodDocker, id:789, conclusion:'failure'}],
}), /successful complete Docker/);
const apiError = new Error('API unavailable');
await assert.rejects(() => publish({}, 'workflow_run', {}, {apiError}), apiError);
console.log('PASS: delayed checks wait, terminal failures and newer failed runs block, changed main and failed Docker reruns block, and missing/foreign checks time out without publication.');

for (const file of ['docker.yml', 'editor.yml', 'browser-text.yml', 'documentation.yml']) {
  const yaml = await readFile(`.github/workflows/${file}`, 'utf8');
  const push = yaml.match(/\n  push:\n([\s\S]*?)(?=\n  [a-z_]+:|\npermissions:)/)?.[1];
  assert.ok(push, `${file} must start on push`);
  assert.match(push, /branches: \[[^\]\n]*\bmain\b/, `${file} must cover main`);
  assert.doesNotMatch(push, /(?:paths|paths-ignore):/, `${file} must not omit the exact release source based on changed files`);
}
assert.match(publishWorkflow, /timeout-minutes: 50/, 'The job must outlast the bounded verification wait');
console.log('PASS: all four release checks cover every main push, including lockfile-only and CI-only changes.');
