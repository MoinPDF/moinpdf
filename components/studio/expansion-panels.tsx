'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { splitBySize, sizeSplitZip, type SizePart } from '@/lib/size-split';
import { NumberField, type PanelProps } from './advanced-shared';

export function SplitSizePanel({ source, run }: PanelProps) {
  const [limit, setLimit] = useState(10),
    [parts, setParts] = useState<SizePart[]>([]);
  return (
    <section className="advanced-card">
      <h2>Passend für dein Upload-Limit</h2>
      <NumberField
        label="Maximale Größe pro PDF (MB)"
        value={limit}
        min={0.1}
        max={80}
        step={0.1}
        onChange={(value) => {
          setLimit(value);
          setParts([]);
        }}
      />
      <p className="fine-note">
        1 MB = 1.000.000 Bytes. Die tatsächliche Dateigröße wird gemessen. Seiten bleiben in ihrer
        Reihenfolge und werden nicht als Bilder neu komprimiert. Lesezeichen, Signaturen und
        interaktive Formularfunktionen werden nicht übernommen.
      </p>
      <Button
        onClick={() =>
          run(async (ctx) => {
            setParts([]);
            const next = await splitBySize(source.bytes, Math.floor(limit * 1e6), ctx);
            setParts(next);
          })
        }
      >
        Teildateien berechnen
      </Button>
      {parts.length > 0 && (
        <>
          <div className="advanced-table-wrap">
            <table className="advanced-table">
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Seiten</th>
                  <th>Größe</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      {part.first}–{part.last}
                    </td>
                    <td>{(part.bytes.length / 1e6).toFixed(3)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => run((ctx) => sizeSplitZip(source, parts, ctx))}>
            Alle Teildateien als ZIP speichern
          </Button>
        </>
      )}
    </section>
  );
}
