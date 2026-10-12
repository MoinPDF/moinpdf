'use client';
import { useState } from 'react';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import { Button } from '@/components/ui/button';
import {
  inspectObjects,
  editObjects,
  groupObjects,
  type NativeObject,
  type NativeChange,
} from '@/lib/native-pdf';
import { alignObjects, type ObjectAlignment } from '@/lib/object-layout';
import { packagePdfs } from '@/lib/pro-tools';
import {
  Choice,
  NumberField,
  PageSelect,
  PageStage,
  Tick,
  type PanelProps,
} from './advanced-shared';
export function NativeSelectionPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [page, setPage] = useState(0),
    [objects, setObjects] = useState<NativeObject[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [alignment, setAlignment] = useState<ObjectAlignment>('left'),
    [dx, setDx] = useState(0),
    [dy, setDy] = useState(0);
  const chosen = objects.filter((o) => selected.includes(o.index));
  const save = (action: (signal: AbortSignal) => Promise<Uint8Array>) =>
    run(async (ctx) =>
      packagePdfs(
        [
          {
            name: source.name.replace(/\.pdf$/i, '') + '-Objekte.pdf',
            bytes: await action(ctx.signal),
            pages: source.pdf.numPages,
          },
        ],
        'Objekte bearbeitet. Vor der Verwendung das Ergebnis kontrollieren.',
      ),
    );
  const edit = (changes: NativeChange[]) =>
    save((signal) => editObjects(source.bytes, page, changes, signal));
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>{ui('Mehrere Objekte bearbeiten')}</h2>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            setObjects([]);
            setSelected([]);
          }}
        />
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              setObjects(await inspectObjects(source.bytes, page, ctx.signal));
              setSelected([]);
            })
          }
        >
          {ui('Seitenobjekte laden')}
        </Button>
        <fieldset disabled={busy} className="paragraph-object-list">
          <legend>{ui('Objektauswahl')}</legend>
          {objects.map((o) => (
            <Tick
              key={o.index}
              label={`${o.index + 1}: ${o.text || ui(o.type === 'image' ? 'Bild' : o.type === 'group' ? 'Objektgruppe' : 'Grafik')}`}
              value={selected.includes(o.index)}
              onChange={(v) =>
                setSelected(v ? [...selected, o.index] : selected.filter((i) => i !== o.index))
              }
            />
          ))}
        </fieldset>
        <Choice
          label={ui('Ausrichten und verteilen')}
          value={alignment}
          onChange={(v) => setAlignment(v as ObjectAlignment)}
          items={[
            ['left', 'Links'],
            ['center', 'Horizontal zentrieren'],
            ['right', 'Rechts'],
            ['top', 'Oben'],
            ['middle', 'Vertikal zentrieren'],
            ['bottom', 'Unten'],
            ['horizontal', 'Horizontal verteilen'],
            ['vertical', 'Vertikal verteilen'],
          ]}
        />
        <Button
          disabled={busy || chosen.length < 2}
          onClick={() =>
            save((signal) =>
              editObjects(source.bytes, page, alignObjects(chosen, alignment), signal),
            )
          }
        >
          {ui('Auswahl ausrichten')}
        </Button>
        <NumberField
          label={ui('Verschiebung nach rechts (%)')}
          value={dx}
          onChange={setDx}
          min={-100}
          max={100}
        />
        <NumberField
          label={ui('Verschiebung nach unten (%)')}
          value={dy}
          onChange={setDy}
          min={-100}
          max={100}
        />
        <Button
          disabled={busy || !chosen.length}
          onClick={() => edit(chosen.map((o) => ({ index: o.index, dx: dx / 100, dy: dy / 100 })))}
        >
          {ui('Auswahl verschieben')}
        </Button>
        <Button
          disabled={busy || !chosen.length}
          onClick={() => edit(chosen.map((o) => ({ index: o.index, flipX: true })))}
        >
          {ui('Horizontal spiegeln')}
        </Button>
        <Button
          disabled={busy || !chosen.length}
          onClick={() => edit(chosen.map((o) => ({ index: o.index, flipY: true })))}
        >
          {ui('Vertikal spiegeln')}
        </Button>
        <Button
          disabled={busy || !chosen.length}
          onClick={() => save((signal) => groupObjects(source.bytes, page, selected, true, signal))}
        >
          {ui('Auswahl duplizieren')}
        </Button>
        <Button
          disabled={busy || chosen.length < 2}
          onClick={() =>
            save((signal) => groupObjects(source.bytes, page, selected, false, signal))
          }
        >
          {ui('Auswahl gruppieren')}
        </Button>
        <p className="fine-note">
          {ui(
            'Gruppieren erfordert aufeinanderfolgende Objekte in der Zeichenreihenfolge. Die Gruppe bleibt eine Vektorgrafik. Duplikate werden leicht versetzt eingefügt.',
          )}
        </p>
      </section>
      <section className="advanced-card">
        <PageStage source={source} page={page}>
          {chosen.map((o) => (
            <div
              key={o.index}
              style={{
                position: 'absolute',
                left: `${o.x * 100}%`,
                top: `${o.y * 100}%`,
                width: `${o.w * 100}%`,
                height: `${o.h * 100}%`,
                border: '2px solid #008b8b',
                pointerEvents: 'none',
              }}
            />
          ))}
        </PageStage>
      </section>
    </div>
  );
}
