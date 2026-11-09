'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { ui } from '@/lib/ui-language';
import { Text, Choice, Tick, PageSelect, PageStage, type PanelProps } from './advanced-shared';
import { inspectObjects, assignLayer, type NativeObject } from '@/lib/native-pdf';
import { readLayers, type LayerChoice } from '@/lib/century-engine';
import { pdfBlob } from '@/lib/pdf-engine';
export function LayerObjectsPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [page, setPage] = useState(0),
    [objects, setObjects] = useState<NativeObject[]>([]),
    [layers, setLayers] = useState<LayerChoice[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [target, setTarget] = useState('new'),
    [name, setName] = useState(''),
    [limit, setLimit] = useState(40);
  return (
    <details>
      <summary>{ui('Neue Ebenen und Objektzuordnung')}</summary>
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
        variant="outline"
        disabled={busy}
        onClick={() =>
          run(async (ctx) => {
            setObjects(await inspectObjects(source.bytes, page, ctx.signal));
            setLayers(await readLayers(source));
            setSelected([]);
          })
        }
      >
        {ui('Objekte und Ebenen laden')}
      </Button>
      <Choice
        label="Zielebene"
        value={target}
        items={[
          ['new', 'Neue Ebene'],
          ['none', 'Ohne Ebene'],
          ...layers.map((l): [string, string] => [l.id, l.name]),
        ]}
        onChange={setTarget}
      />
      {target === 'new' && <Text label="Name der neuen Ebene" value={name} onChange={setName} />}
      <p className="fine-note">
        {ui(
          'Text, Bilder, Vektoren und ganze Gruppen auswählen. Die Zeichenreihenfolge bleibt erhalten; die bisherige Ebenenzuordnung der ausgewählten Objekte wird ersetzt. Inhalte innerhalb einer Gruppe behalten ihre eigenen Ebenen.',
        )}
      </p>
      <PageStage
        source={source}
        page={page}
        rects={objects
          .filter((o) => selected.includes(o.index))
          .map((o) => ({ ...o, label: String(o.index + 1) }))}
      />
      {objects.slice(0, limit).map((o) => (
        <Tick
          key={o.index}
          label={`${o.index + 1}. ${ui(o.type === 'text' ? 'Text' : o.type === 'image' ? 'Bild' : o.type === 'path' ? 'Vektor' : o.type === 'group' ? 'Gruppe' : 'Sonstiges')} ${o.text.slice(0, 80)}`}
          value={selected.includes(o.index)}
          onChange={(checked) =>
            setSelected(checked ? [...selected, o.index] : selected.filter((n) => n !== o.index))
          }
        />
      ))}
      {objects.length > limit && (
        <Button variant="outline" onClick={() => setLimit(limit + 40)}>
          {ui('Weitere Objekte anzeigen')}
        </Button>
      )}
      <Button
        disabled={busy || (target === 'new' ? !name.trim() : !selected.length)}
        onClick={() =>
          run(async (ctx) => ({
            blob: pdfBlob(
              await assignLayer(
                source.bytes,
                { page, indices: selected, target, name },
                ctx.signal,
              ),
            ),
            filename: 'Ebenen-zugeordnet.pdf',
            kind: 'pdf',
            pages: source.pdf.numPages,
            note: ui(
              'Die Zuordnung ist als echte PDF-Ebene gespeichert. Zum Fortsetzen das Ergebnis als Arbeitsdokument übernehmen. Ausgeblendete Inhalte bleiben in der Datei.',
            ),
          }))
        }
      >
        {ui('Ebene erstellen / Objekte zuordnen')}
      </Button>
    </details>
  );
}
