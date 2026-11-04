import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseStatement, exportFiles } from '../lib/bank-datev/converter.mjs';
import { recoverVolksbankOcrSigns } from '../lib/bank-datev/volksbank.mjs';
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
    assert.equal(headings[10], '"Belegfeld 1"');
    assert.equal(posting[10], '');
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
const yearEnd = [
  'Übungsbank Kontoauszug Nr. 12/2026',
  'Geschäftsgirokonto DE89 3704 0044 0532 0130 00 BIC: FIKTIV',
  'Auszugszeitraum vom 01.12. bis 31.01.2027',
  'Kontowährung EUR',
  'Saldo am 30.11.2026',
  '10,00',
  'Datum Text Betrag',
  '31.12. Abschluss -2,50',
  '02.01. Erstattung +1,00',
  'Saldo am 31.01.2027',
  '8,50',
].join('\n');
const extracted = extractDraft([yearEnd], 'Fiktiv.pdf', 'year-end');
assert.deepEqual(
  [
    extracted.period_start,
    extracted.period_end,
    extracted.iban,
    extracted.statement_number,
    extracted.currency,
    extracted.opening_balance,
    extracted.closing_balance,
  ],
  ['2026-12-01', '2027-01-31', 'DE89370400440532013000', '12/2026', 'EUR', '10,00', '8,50'],
);
assert.deepEqual(
  extracted.rows.map((r) => r.booking_date),
  ['2026-12-31', '2027-01-02'],
);
const unnumbered = extractDraft(
  [
    text
      .replace('Kontoauszug 15', 'Kontoauszug')
      .replace('Büromaterial -2,50', 'Büromaterial -2,50\nIBAN DE89 3704 0044 0532 0130 00'),
  ],
  'Fiktiv.pdf',
  'unnumbered',
);
assert.equal(unnumbered.iban, '');
assert.equal(unnumbered.statement_number, '');
const unnamedStatement = draftToStatement({ ...unnumbered, confirmed: true });
unnamedStatement.transactions.forEach((t) => (t.counteraccount = '54321'));
const unnamedFile = exportFiles(unnamedStatement, columns, settings)[0];
assert.ok(!unnamedFile.name.includes('_KA'));
assert.equal(decoder.decode(unnamedFile.bytes).split('\r\n')[2].split(';')[10], '');
assert.throws(
  () => draftToStatement({ ...unnumbered, opening_balance: '', confirmed: true }),
  /Saldenabgleich/,
);
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
const vrHeader = (page) =>
  'Volksbank Muster eG\nEUR-Konto   Kontonummer 111\nKontoauszug Nr. 1/2026\nerstellt am 02.01.2026   Blatt ' +
  page +
  ' von 2\nBu-Tag Wert Vorgang';
const vr = [
  vrHeader(1) +
    '\nalter Kontostand vom 30.12.2025 20,00 S\n31.12. 02.01. Musterumsatz 30,00 H\n31.12.2025 um 08:45 Uhr GA 123456\nÜbertrag auf Blatt 2 10,00 H',
  vrHeader(2) +
    '\nÜbertrag von Blatt 1 10,00 H\n02.01. 31.12. siehe Anlage 1 2,50 S\n────────────────\nneuer Kontostand vom 02.01.2026 7,50 H\nAbschluss 2,50 S',
  'Kundeninformation zum Rechnungsabschluss',
];
const geno = parseStatement(vr, 'Fiktiv.pdf', 'fictional-vr');
assert.deepEqual(
  geno.transactions.map((t) => [t.booking_date, t.value_date, t.amount]),
  [
    ['2025-12-31', '2026-01-02', '30.00'],
    ['2026-01-02', '2025-12-31', '-2.50'],
  ],
);
assert.equal(geno.check.difference, '0.00');
for (const broken of [
  [vr[0]],
  [vr[1], vr[0]],
  [vr[0], vr[1].replace('10,00 H', '11,00 H')],
  [vr[0], vr[1].replace('2,50 S', '2,SO S')],
  [vr[0], vr[1].replace('7,50 H', '7,51 H')],
])
  assert.throws(() => parseStatement(broken, 'Fiktiv.pdf', 'bad-vr'));
const printed = [
  ['Bu-Tag Wert Vorgang', 0],
  ['05.04. 05.04. Einkauf 12,00 S', 440],
  ['06.04. 06.04. Zahlung 15,00 H', 500],
  ['07.04. 07.04. Entgelt 1,50 5', 441],
  ['08.04. 08.04. Unklar 2,50 5', 500],
].map(([text, x]) => ({ text, spans: [{ x }] }));
const recovered = recoverVolksbankOcrSigns(printed);
assert.match(recovered[3].text, /1,50 S$/);
assert.match(recovered[4].text, /2,50 5$/);
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
  if (!options.headers.Authorization.startsWith('Bearer sk-'))
    assert.equal(options.headers.Authorization, 'Bearer fictional-test-only');
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
    personal: true,
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
  const personal = (key, extraHeaders = {}, data = batch) =>
    fetch(base + '/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MoinPDF-Client': 'web', ...extraHeaders },
      body: JSON.stringify({ key, batch: data }),
    });
  assert.equal((await personal('bad')).status, 401);
  assert.equal(
    (await personal('sk-fictional-sample-A', { Origin: 'https://unrelated.example' })).status,
    403,
  );
  assert.equal(
    (await personal('sk-fictional-sample-A', {}, { ...batch, iban: 'private' })).status,
    400,
  );
  const used = [];
  const independent = createDatevServer({}, async (_url, options) => {
    used.push(options.headers.Authorization);
    assert.deepEqual(JSON.parse(JSON.parse(options.body).input), batch);
    assert.ok(!options.body.includes('sk-fictional'));
    return new Response(null, { status: 401 });
  });
  const separate = await listen(independent);
  try {
    const submit = (key) =>
      fetch(separate + '/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MoinPDF-Client': 'web' },
        body: JSON.stringify({ key, batch }),
      });
    const keys = ['sk-fictional-private-A', 'sk-fictional-private-B'];
    const replies = await Promise.all(keys.map(submit));
    assert.deepEqual(
      replies.map((r) => r.status),
      [401, 401],
    );
    assert.deepEqual(
      used.sort(),
      keys.map((k) => 'Bearer ' + k),
    );
    assert.deepEqual(await replies[0].json(), {});
    assert.equal(
      (await fetch(separate + '/suggest', { method: 'POST', headers, body: JSON.stringify(batch) }))
        .status,
      503,
    );
  } finally {
    independent.close();
  }
  mode = 'ok';
  assert.equal(
    (await (await personal('sk-fictional-private-A')).json()).suggestions[0].account,
    '54321',
  );
  mode = 'unclear';
  assert.equal((await (await post(batch)).json()).suggestions[0].account, null);
} finally {
  server.close();
  off.close();
}
console.log(
  'PASS: fictional bank statements, manual accounts in both SKRs, fiscal years, DATEV fields, signed cent balance and optional authenticated OpenAI adapter with mocked responses.',
);
