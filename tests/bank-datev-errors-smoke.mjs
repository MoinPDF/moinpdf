import assert from 'node:assert/strict';
import { extractDraft, reviewDraft } from '../lib/bank-datev/universal.mjs';
import { datevAiError } from '../lib/bank-datev/ai-errors.ts';
import { createDatevHandler } from '../docker/datev/handler.mjs';

const draft = extractDraft(
  [
    'Testbank Kontoauszug 1\nKontowährung EUR\nAnfangssaldo 10,00\nDatum Text Betrag\n01.01.2026 Einkauf -2,50\nEndsaldo 7,50',
  ],
  'Fiktiv.pdf',
  'fictional',
);
assert.deepEqual(reviewDraft(draft), { difference: 0, issues: [] });
assert.equal(reviewDraft({ ...draft, closing_balance: '7,49' }).difference, 0.01);
assert.equal(
  reviewDraft({ ...draft, opening_balance: '-10,00', closing_balance: '-12,50' }).difference,
  0,
);
const broken = reviewDraft({
  ...draft,
  opening_balance: '',
  closing_balance: 'bad',
  rows: [{ ...draft.rows[0], amount: 'bad', direction: '' }],
});
assert.equal(broken.difference, null);
assert.deepEqual(broken.issues, [
  { field: 'opening_balance', row: -1 },
  { field: 'closing_balance', row: -1 },
  { field: 'direction', row: 0 },
  { field: 'amount', row: 0 },
]);
for (const amount of ['0,00', '-2,50', '2,5', '9007199254740992,00']) {
  const checked = reviewDraft({ ...draft, rows: [{ ...draft.rows[0], amount }] });
  assert.equal(checked.difference, null);
  assert.deepEqual(checked.issues, [{ field: 'amount', row: 0 }]);
}
assert.deepEqual(
  reviewDraft({ ...draft, period_start: '2026-02-31', detected_currency: 'USD' }).issues,
  [
    { field: 'period', row: -1 },
    { field: 'unsupported_currency', row: -1 },
  ],
);
const batch = {
  framework: '03',
  accounts: [],
  rows: [{ id: 1, direction: 'debit', text: 'Fiktiver Einkauf' }],
};
const request = (personal = true) =>
  new Request('https://moinpdf.example/api/datev/' + (personal ? 'personal' : 'suggest'), {
    method: 'POST',
    headers: { 'X-MoinPDF-Client': 'web', 'Content-Type': 'application/json' },
    body: JSON.stringify(personal ? { key: 'sk-fictional-private-A', batch } : batch),
  });
for (const [upstream, expected] of [
  [{ code: 'credit_balance_exhausted' }, 'openai_credit_exhausted'],
  [{ code: 'project_spend_limit_exceeded', type: 'insufficient_quota' }, 'openai_spend_limit'],
  [{ code: 'organization_spend_limit_exceeded' }, 'openai_spend_limit'],
  [{ code: 'organization_usage_limit_exceeded' }, 'openai_usage_limit'],
  [{ code: 'insufficient_quota' }, 'openai_quota_exceeded'],
  [{ type: 'insufficient_quota' }, 'openai_quota_exceeded'],
  [{ code: 'rate_limit_exceeded' }, 'openai_rate_limit'],
  [{ code: 'slow_down' }, 'openai_rate_limit'],
  [{ type: 'rate_limit_error' }, 'openai_rate_limit'],
  [{ code: 'unknown' }, 'openai_limit_unknown'],
]) {
  const handle = createDatevHandler({}, async () =>
    Response.json(
      { error: { ...upstream, message: 'PRIVATE BANK TEXT sk-fictional-secret' } },
      { status: 429, headers: { 'Retry-After': '12' } },
    ),
  );
  const response = await handle(request());
  const body = await response.json();
  assert.equal(response.status, 429);
  assert.equal(body.error.code, expected);
  assert.equal(body.retryAfterSeconds, expected === 'openai_rate_limit' ? 12 : 0);
  assert.equal(response.headers.get('Retry-After'), expected === 'openai_rate_limit' ? '12' : null);
  assert.ok(
    !JSON.stringify(body).includes('PRIVATE') && !JSON.stringify(body).includes('sk-fictional'),
  );
  const message = datevAiError(response.status, body);
  assert.equal(message.retryAfterSeconds, body.retryAfterSeconds);
  assert.ok(message.message.every((text) => text.length > 20));
}
for (const body of ['', '<html>proxy error</html>', 'x'.repeat(66000)]) {
  const handle = createDatevHandler({}, async () => new Response(body, { status: 429 }));
  assert.deepEqual(await (await handle(request())).json(), {
    error: { code: 'openai_limit_unknown' },
    retryAfterSeconds: 0,
  });
}
for (const delay of ['-1', 'invalid', new Date(Date.now() - 10000).toUTCString()]) {
  const handle = createDatevHandler({}, async () =>
    Response.json(
      { error: { code: 'slow_down' } },
      { status: 429, headers: { 'Retry-After': delay } },
    ),
  );
  assert.equal((await (await handle(request())).json()).retryAfterSeconds, 0);
}
const dated = createDatevHandler({}, async () =>
  Response.json(
    { error: { code: 'slow_down' } },
    { status: 429, headers: { 'Retry-After': new Date(Date.now() + 30000).toUTCString() } },
  ),
);
const datedBody = await (await dated(request())).json();
assert.ok(datedBody.retryAfterSeconds > 0 && datedBody.retryAfterSeconds <= 30);
assert.match(datevAiError(429, {}).message[0], /keinen genauen Grund/);
assert.equal(
  datevAiError(429, { error: { code: 'openai_quota_exceeded' }, retryAfterSeconds: 300 })
    .retryAfterSeconds,
  0,
);
assert.equal(
  datevAiError(429, { error: { code: 'openai_rate_limit' }, retryAfterSeconds: -1 })
    .retryAfterSeconds,
  0,
);
assert.match(datevAiError(401, null).message[0], /Schlüssel/);
for (const personal of [true, false]) {
  let release, started;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  let count = 0;
  const maximum = personal ? 12 : 2;
  const handle = createDatevHandler({ ownerKey: 'fictional', authorize: () => true }, async () => {
    if (++count === maximum) started();
    await blocked;
    return new Response(null, { status: 503 });
  });
  const pending = Array.from({ length: maximum }, () => handle(request(personal)));
  await entered;
  const busy = await handle(request(personal));
  assert.equal(busy.status, 429);
  assert.deepEqual(await busy.json(), {
    error: { code: 'installation_busy' },
    retryAfterSeconds: 5,
  });
  release();
  await Promise.all(pending);
  assert.equal((await handle(request(personal))).status, 502);
}
const hourly = createDatevHandler(
  { ownerKey: 'fictional', authorize: () => true },
  async () => new Response(null, { status: 503 }),
);
for (let i = 0; i < 60; i++) assert.equal((await hourly(request(false))).status, 502);
const hourlyError = await (await hourly(request(false))).json();
assert.equal(hourlyError.error.code, 'installation_rate_limit');
assert.ok(hourlyError.retryAfterSeconds > 0 && hourlyError.retryAfterSeconds <= 3600);
assert.equal((await hourly(request())).status, 502);
console.log(
  'PASS: explicit DATEV balance diagnostics, redacted AI limit causes, cooldown hints and server concurrency/hourly limits.',
);
