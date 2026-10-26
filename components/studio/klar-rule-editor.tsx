'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import type { Source } from '@/lib/pdf-engine';
import type { KlarDocument, KlarPage } from '@/lib/klar-schiff-model';
import { draftKlarRule, readKlarRule, type KlarRule } from '@/lib/klar-schiff-rules';
import { Choice, PageStage, RectFields, Text, Tick } from './advanced-shared';

export function KlarRuleEditor({
  page,
  document,
  source,
  save,
  close,
}: {
  page: KlarPage;
  document: KlarDocument;
  source: Source;
  save: (rule: KlarRule) => boolean;
  close: () => void;
}) {
  const [rule, setRule] = useState(() => draftKlarRule(page, document));
  const [field, setField] = useState<'matchArea' | 'referenceArea' | 'dateArea'>('matchArea');
  const [checked, setChecked] = useState(false);
  const change = (patch: Partial<KlarRule>) => {
    setRule((old) => ({ ...old, ...patch }));
    setChecked(false);
  };
  const value = readKlarRule(page, rule);
  const valid =
    value.match &&
    !!value.reference &&
    !!value.date &&
    !value.uncertain &&
    value.date === document.date &&
    !!rule.name.trim() &&
    !!rule.sender.trim() &&
    rule.matchText.trim().length >= 5;
  return (
    <section className="advanced-card" aria-label={ui('Erkennungsregel erstellen')}>
      <h3>{ui('Erkennungsregel aus geprüftem Dokument')}</h3>
      <p className="fine-note">
        {ui(
          'Markiere das eindeutige Absendermerkmal sowie die Bereiche für Dokumentnummer und Datum. Gespeichert werden nur diese Regel und der Absender, keine Dokumentkopie. Die Regel gilt für dasselbe Layout.',
        )}
      </p>
      <Text
        label="Regelname"
        value={rule.name}
        onChange={(name) => change({ name: name.slice(0, 80) })}
      />
      <Text
        label="Absender"
        value={rule.sender}
        onChange={(sender) => change({ sender: sender.slice(0, 100) })}
      />
      <Text
        label="Eindeutiges Absendermerkmal"
        value={rule.matchText}
        onChange={(matchText) => change({ matchText: matchText.slice(0, 100) })}
      />
      <Choice
        label="Dokumentart"
        value={rule.kind}
        onChange={(kind) => change({ kind: kind as KlarRule['kind'] })}
        items={[
          ['invoice', 'Rechnung'],
          ['letter', 'Brief'],
          ['document', 'Dokument'],
        ]}
      />
      <Choice
        label="Bereich für die Regel"
        value={field}
        onChange={(v) => setField(v as typeof field)}
        items={[
          ['matchArea', 'Absendermerkmal'],
          ['referenceArea', 'Dokumentnummer'],
          ['dateArea', 'Dokumentdatum'],
        ]}
      />
      <PageStage
        source={source}
        page={page.page}
        rects={[rule[field]]}
        onRect={(rect) => change({ [field]: rect })}
      />
      <RectFields rect={rule[field]} onChange={(rect) => change({ [field]: rect })} />
      <dl>
        <dt>{ui('Dokumentnummer')}</dt>
        <dd>{value.reference || ui('Nicht eindeutig')}</dd>
        <dt>{ui('Dokumentdatum')}</dt>
        <dd>{value.date || ui('Nicht eindeutig')}</dd>
      </dl>
      {!valid && (
        <p className="workbench-notice">
          {ui(
            'Absendermerkmal, Dokumentnummer und Datum müssen eindeutig sein. Das Datum muss dem geprüften Dokument entsprechen; unsichere OCR benötigt eine manuelle Prüfung.',
          )}
        </p>
      )}
      <Tick
        label="Geltungsbereich und erkannte Werte dieser Regel geprüft"
        value={checked}
        onChange={setChecked}
      />
      <div className="advanced-actions">
        <Button variant="outline" onClick={close}>
          {ui('Abbrechen')}
        </Button>
        <Button
          disabled={!checked || !valid}
          onClick={() => {
            if (save(rule)) close();
          }}
        >
          {ui('Erkennungsregel speichern')}
        </Button>
      </div>
    </section>
  );
}
