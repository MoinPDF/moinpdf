'use client';
import { useEffect, useId, useState } from 'react';
import { ui } from '@/lib/ui-language';
import { Tick } from './advanced-shared';

export function WordExportOptions({
  mode,
  local,
  disabled,
  onModeChange,
}: {
  mode: string;
  local: boolean;
  disabled: boolean;
  onModeChange: (mode: string) => void;
}) {
  const name = useId();
  const [advanced, setAdvanced] = useState(!local || mode === 'text');
  useEffect(() => {
    if (!local || mode === 'text') setAdvanced(true);
  }, [local, mode]);
  return (
    <fieldset className="word-export-options" disabled={disabled}>
      {local && (
        <fieldset className="word-output-goals" disabled={disabled}>
          <legend>{ui('Word-Ausgabe')}</legend>
          <div className="word-output-goal-list">
            {[
              {
                value: 'layout',
                title: 'Aussehen möglichst erhalten',
                description:
                  'Bilder und Seitenaufteilung beibehalten. Text in einzelnen Feldern bearbeiten.',
              },
              {
                value: 'structured',
                title: 'Text und Tabellen bearbeiten',
                description:
                  'Zusammenhängende Absätze und erkannte Tabellen bearbeiten. Seitenumbrüche können sich ändern.',
              },
            ].map((goal) => (
              <label key={goal.value} className="word-output-goal">
                <input
                  type="radio"
                  name={name}
                  value={goal.value}
                  aria-label={ui(goal.title)}
                  checked={mode === goal.value}
                  onChange={() => onModeChange(goal.value)}
                />
                <span>
                  <strong>{ui(goal.title)}</strong>
                  <small>{ui(goal.description)}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="fine-note" aria-live="polite">
        {local && mode === 'text'
          ? ui('Nur Text ist ausgewählt. Bilder und Seitenlayout werden nicht übernommen.')
          : ui(
              'Scan-Seiten werden automatisch per OCR erkannt. Erkannte Texte bitte kontrollieren.',
            )}
      </p>
      <details
        className="conversion-options"
        open={advanced}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
      >
        <summary>{ui('Weitere Optionen')}</summary>
        {local ? (
          <Tick
            label={ui('Nur Text als Absätze')}
            value={mode === 'text'}
            onChange={(checked) => onModeChange(checked ? 'text' : 'structured')}
          />
        ) : (
          <p className="fine-note">
            {ui('Text, Tabellen und Bilder werden übernommen; komplexe Layouts können abweichen.')}
          </p>
        )}
        <p className="fine-note">
          {ui(
            'Tabellenlinien bleiben bei „Aussehen möglichst erhalten“ Teil des Hintergrunds. „Text und Tabellen bearbeiten“ erzeugt unterstützte Tabellen als Word-Zellen. Nicht erkannte Tabellen bleiben Text; Schriften und Reihenfolge bitte prüfen.',
          )}
        </p>
      </details>
    </fieldset>
  );
}
