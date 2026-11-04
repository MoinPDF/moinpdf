import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseStatement, exportFiles } from '../lib/bank-datev/converter.mjs';
import { extractDraft, draftToStatement } from '../lib/bank-datev/universal.mjs';
import columns from '../lib/bank-datev/datev-columns.json' with { type: 'json' };
import { createDatevServer } from '../docker/datev/server.mjs';

const text = [
  'Übungsbank · Kontoauszug 15',
  'Kontowährung EUR',
  'Anfangssaldo 10,00',
  'Datum Text Betrag',
  '31.12.2025 Büromaterial -2,50',
  '02.01.2026 Erstattung +1,00',
  'Endsaldo 8,50',
].join('\n');
const draft = extractDraft([text], 'Fiktiv.pdf', 'test-digest');
assert.equal(draft.rows.length, 2);
assert(draft.rows.every((r) => r.counteraccount === '' && r.tax_key === ''));
assert.throws(() => draftToStatement(draft), /bestätigen/);
draft.confirmed = true;
const settings = {
  adviser: '38901',
  client: '567',
  account_length: '5',
  bank_account: '24680',
  account_framework: '04',
};
const open = draftToStatement(draft);
assert.throws(() => exportFiles(open, columns, settings), /Gegenkonto/);
draft.rows[0].counteraccount = '54321';
draft.rows[1].counteraccount = '900001';
draft.rows[0].tax_key = '9';
const statement = draftToStatement(draft),
  decoder = new TextDecoder('windows-1252');
for (const framework of ['03', '04']) {
  const files = exportFiles(statement, columns, { ...settings, account_framework: framework });
  assert.equal(files.length, 2);
  for (const [i, file] of files.entries()) {
    const [header, headings, posting] = decoder
      .decode(file.bytes)
      .trimEnd()
      .split('\r\n')
      .map((line) => line.split(';'));
    assert.equal(header[10], '38901');
    assert.equal(header[11], '567');
    assert.equal(header[13], '5');
    assert.equal(header[26], '"' + framework + '"');
    assert.equal(headings.length, 125);
    assert.equal(posting.length, 125);
    assert.equal(posting[6], '24680');
    assert.equal(posting[7], i ? '900001' : '54321');
    assert.equal(posting[8], i ? '' : '"0009"');
    assert.equal(posting[0], i ? '1,00' : '2,50');
    assert.equal(posting[1], i ? '"S"' : '"H"');
    assert.equal(posting[9], i ? '0201' : '3112');
  }
}
assert.equal(exportFiles(statement, columns, { ...settings, fiscal: '2025-07-01' }).length, 1);
for (const patch of [
  { bank_account: '' },
  { adviser: '' },
  { client: '' },
  { account_length: '4' },
  { bank_account: '54321' },
  { account_framework: '05' },
  { fiscal: '2024-01-01' },
])
  assert.throws(() => exportFiles(statement, columns, { ...settings, ...patch }));
assert.throws(() => draftToStatement({ ...draft, closing_balance: '8,49' }), /0,01/);
assert.throws(() => draftToStatement({ ...draft, detected_currency: 'USD' }), /USD/);
const specialised = parseStatement(
  [
    [
      'Die Sparkasse Bremen AG',
      'Kontoauszug 5/2026   Seite 1 von 1',
      'Geschäftsgirokonto DE89 3704 0044 0532 0130 00',
      'Datum   Erläuterung   Betrag Soll EUR   Betrag Haben EUR',
      'Kontostand am 30.04.2026, Auszug Nr. 4   1,00',
      '02.05.2026 Gutschrift   3,00',
      'Fiktive Erstattung',
      'Kontostand am 31.05.2026 um 20:00 Uhr   4,00',
    ].join('\n'),
  ],
  'Fiktive-Bank.pdf',
  'test-digest-2',
);
assert.equal(specialised.transactions[0].counteraccount, '');
const token = 'fictional-access-code-for-tests';
const env = { OPENAI_API_KEY: 'fictional-test-only', MOINPDF_DATEV_ACCESS_TOKEN: token };
const batch = {
  framework: '03',
  accounts: [{ number: '54321', label: 'Testaccount' }],
  rows: [{ id: 1, direction: 'debit', text: 'Fiktiver Einkauf' }],
};
let upstreamCalls = 0,
  mode = 'ok';
const server = createDatevServer(env, async (url, options) => {
  upstreamCalls++;
  assert.equal(url, 'https://api.openai.com/v1/responses');
  const body = JSON.parse(options.body);
  assert.equal(body.store, false);
  assert.deepEqual(JSON.parse(body.input), batch);
  const suggestions = [
    {
      id: mode === 'bad id' ? 8 : 1,
      account: mode === 'unlisted' ? '99999' : mode === 'unclear' ? null : '54321',
      reason: 'Synthetic',
    },
  ];
  return Response.json({
    status: mode === 'incomplete' ? 'incomplete' : 'completed',
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify({ suggestions }) }],
      },
    ],
  });
});
async function listen(s) {
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  return 'http://127.0.0.1:' + s.address().port + '/api/datev';
}
const headers = {
  'X-MoinPDF-Client': 'web',
  'Content-Type': 'application/json',
  'X-Datev-Access': token,
};
const base = await listen(server),
  off = createDatevServer({}),
  offBase = await listen(off);
try {
  assert.deepEqual(await (await fetch(offBase + '/status', { headers })).json(), {
    enabled: false,
  });
  const post = (data, extra = {}) =>
    fetch(base + '/suggest', {
      method: 'POST',
      headers: { ...headers, ...extra },
      body: JSON.stringify(data),
    });
  assert.equal((await post(batch, { 'X-Datev-Access': 'wrong' })).status, 403);
  assert.equal((await post(batch, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await post({ ...batch, adviser: 'private' })).status, 400);
  assert.equal(
    (await post({ ...batch, rows: [{ ...batch.rows[0], iban: 'private' }] })).status,
    400,
  );
  assert.equal(upstreamCalls, 0);
  assert.deepEqual((await (await post(batch)).json()).suggestions, [
    { id: 1, account: '54321', reason: 'Synthetic' },
  ]);
  for (mode of ['bad id', 'unlisted', 'incomplete']) assert.equal((await post(batch)).status, 502);
  mode = 'unclear';
  assert.equal((await (await post(batch)).json()).suggestions[0].account, null);
} finally {
  server.close();
  off.close();
}
console.log(
  'PASS: fictional bank statements, manual accounts in both SKRs, fiscal years, DATEV fields, signed cent balance and optional authenticated OpenAI adapter with mocked responses.',
);
