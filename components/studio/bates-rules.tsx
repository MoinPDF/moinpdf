'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { Button } from '@/components/ui/button';
import { Choice, Text, NumberField } from './advanced-shared';
import type { BatesRule } from '@/lib/pro-tools';
export const defaultBatesRule: BatesRule = {
  template: 'AKTE-{nummer} · {seite}/{seiten}',
  padding: 6,
  size: 10,
  position: 'bottom-right',
  from: 1,
  to: 0,
  parity: 'all',
  skipFirst: 0,
  numberOffset: 0,
  sectionStart: 1,
};
export function BatesRules({
  rules,
  onChange,
}: {
  rules: BatesRule[];
  onChange: (rules: BatesRule[]) => void;
}) {
  useLanguage();
  const patch = (index: number, change: Partial<BatesRule>) =>
    onChange(rules.map((r, i) => (i === index ? { ...r, ...change } : r)));
  return (
    <>
      <p className="fine-note">
        {ui('Platzhalter: ')}
        {ui('{nummer}')}, {ui('{seite}')}, {ui('{seiten}')}, {ui('{datei}')},{' '}
        {ui('{abschnittseite}')}, {ui('{abschnittseiten}')}
        {ui(
          '. Die globale Nummer zählt auch ausgelassene Seiten. Abschnitte zählen passende Seiten je Datei. Überlappende Beschriftungen werden abgewiesen.',
        )}
      </p>
      {rules.map((rule, i) => (
        <fieldset key={i} className="pro-rule">
          <legend>
            {ui('Beschriftung ')}
            {i + 1}
          </legend>
          <Text
            label={ui(`Vorlage ${i + 1}`)}
            value={rule.template}
            onChange={(v) => patch(i, { template: v })}
          />
          <Choice
            label={ui(`Position ${i + 1}`)}
            value={rule.position}
            onChange={(v) => patch(i, { position: v as BatesRule['position'] })}
            items={[
              ['top-left', 'Oben links'],
              ['top-center', 'Oben mittig'],
              ['top-right', 'Oben rechts'],
              ['bottom-left', 'Unten links'],
              ['bottom-center', 'Unten mittig'],
              ['bottom-right', 'Unten rechts'],
            ]}
          />
          <NumberField
            label={ui(`Ab Seite ${i + 1}`)}
            value={rule.from}
            min={1}
            max={1000}
            onChange={(v) => patch(i, { from: v })}
          />
          <NumberField
            label={ui(`Bis Seite ${i + 1} (0 = Ende)`)}
            value={rule.to}
            min={0}
            max={1000}
            onChange={(v) => patch(i, { to: v })}
          />
          <Choice
            label={ui(`Seitenauswahl ${i + 1}`)}
            value={rule.parity}
            items={[
              ['all', 'Alle'],
              ['odd', 'Ungerade'],
              ['even', 'Gerade'],
            ]}
            onChange={(v) => patch(i, { parity: v as BatesRule['parity'] })}
          />
          <NumberField
            label={ui(`Deckblätter auslassen ${i + 1}`)}
            value={rule.skipFirst}
            min={0}
            max={1000}
            onChange={(v) => patch(i, { skipFirst: v })}
          />
          <NumberField
            label={ui(`Nummernversatz ${i + 1}`)}
            value={rule.numberOffset}
            min={-999999999}
            max={999999999}
            onChange={(v) => patch(i, { numberOffset: v })}
          />
          <NumberField
            label={ui(`Abschnitt beginnt bei ${i + 1}`)}
            value={rule.sectionStart}
            min={0}
            max={999999999}
            onChange={(v) => patch(i, { sectionStart: v })}
          />
          <NumberField
            label={ui(`Ziffernstellen ${i + 1}`)}
            value={rule.padding}
            min={1}
            max={12}
            onChange={(v) => patch(i, { padding: v })}
          />
          <NumberField
            label={ui(`Schriftgröße ${i + 1} (pt)`)}
            value={rule.size}
            min={6}
            max={40}
            onChange={(v) => patch(i, { size: v })}
          />
          <Button
            variant="outline"
            disabled={rules.length === 1}
            onClick={() => onChange(rules.filter((_, n) => n !== i))}
          >
            {ui('Beschriftung ')}
            {i + 1} {ui(' entfernen')}
          </Button>
        </fieldset>
      ))}
      <Button
        variant="outline"
        disabled={rules.length >= 8}
        onClick={() =>
          onChange([...rules, { ...defaultBatesRule, template: '{datei}', position: 'top-left' }])
        }
      >
        {ui('Weitere Beschriftung')}
      </Button>
    </>
  );
}
