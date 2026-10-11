'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Choice,
  Text,
  NumberField,
  PageSelect,
  PageStage,
  type PanelProps,
} from './advanced-shared';
import {
  inspectObjects,
  editObjects,
  type NativeObject,
  type NativeChange,
} from '@/lib/native-pdf';
import { packagePdfs } from '@/lib/pro-tools';

async function replacementImage(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error('Das Ersatzbild darf höchstens 20 MB groß sein.');
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 4000000)
      throw new Error('Das Ersatzbild darf höchstens 4 Megapixel haben.');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    try {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        rgba: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
      };
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function NativePanel({ source, busy, run }: PanelProps) {
  const [page, setPage] = useState(0),
    [objects, setObjects] = useState<NativeObject[]>([]),
    [selected, setSelected] = useState(-1),
    [loaded, setLoaded] = useState(false);
  const [text, setText] = useState(''),
    [dx, setDx] = useState(0),
    [dy, setDy] = useState(0),
    [scale, setScale] = useState(100),
    [rotation, setRotation] = useState(0),
    [image, setImage] = useState<File | null>(null);
  const [find, setFind] = useState(''),
    [replace, setReplace] = useState('');
  const object = objects.find((o) => o.index === selected),
    matches = find ? objects.filter((o) => o.type === 'text' && o.text.includes(find)) : [];
  const select = (id: number) => {
    setSelected(id);
    setText(objects.find((o) => o.index === id)?.text || '');
    setDx(0);
    setDy(0);
    setScale(100);
    setRotation(0);
    setImage(null);
  };
  const save = async (changes: NativeChange[], signal: AbortSignal) =>
    packagePdfs(
      [
        {
          name: source.name.replace(/\.pdf$/i, '') + '-Objekte.pdf',
          bytes: await editObjects(source.bytes, page, changes, signal),
          pages: source.pdf.numPages,
        },
      ],
      'Bestehende Signaturen werden durch die Bearbeitung ungültig. Vor der Verwendung das Ergebnis kontrollieren.',
    );
  const labels = {
    text: 'Text',
    image: 'Bild',
    path: 'Grafik',
    group: 'Objektgruppe',
    other: 'Sonstiges',
  };
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>Vorhandene Objekte bearbeiten</h2>
        <p>
          Text in der Originalschrift ändern. Bilder und Grafiken verschieben, drehen, skalieren
          oder löschen.
        </p>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            setObjects([]);
            setSelected(-1);
            setLoaded(false);
          }}
        />
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              const items = await inspectObjects(source.bytes, page, ctx.signal);
              if (ctx.signal.aborted) return;
              setObjects(items);
              setLoaded(true);
              setSelected(-1);
            })
          }
        >
          Seitenobjekte laden
        </Button>
        {loaded && !objects.length && (
          <p>Keine einzeln bearbeitbaren Objekte auf dieser Seite gefunden.</p>
        )}
        {!!objects.length && (
          <Choice
            label="Objekt auswählen"
            value={String(selected)}
            onChange={(v) => select(Number(v))}
            items={[
              ['-1', 'Bitte auswählen'],
              ...objects.map(
                (o) =>
                  [
                    String(o.index),
                    `${o.index + 1} · ${labels[o.type]}${o.text ? ' · ' + o.text.slice(0, 85) : ''}`,
                  ] as [string, string],
              ),
            ]}
          />
        )}
        {object && (
          <>
            {object.type === 'text' && <Text label="Textinhalt" value={text} onChange={setText} />}
            {object.type === 'image' && (
              <label className="advanced-field">
                <span>Bild ersetzen (PNG, JPG, WebP)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
                {image && (
                  <small>{image.name} · wird in die vorhandene Bildfläche eingesetzt</small>
                )}
              </label>
            )}
            <NumberField
              label="Verschiebung nach rechts (% Seitenbreite)"
              value={dx}
              onChange={setDx}
              min={-100}
              max={100}
              step={0.5}
            />
            <NumberField
              label="Verschiebung nach unten (% Seitenhöhe)"
              value={dy}
              onChange={setDy}
              min={-100}
              max={100}
              step={0.5}
            />
            <NumberField label="Größe (%)" value={scale} onChange={setScale} min={10} max={1000} />
            <NumberField
              label="Drehung im Uhrzeigersinn (Grad)"
              value={rotation}
              onChange={setRotation}
              min={-360}
              max={360}
            />
            <Button
              disabled={busy}
              onClick={() =>
                run(async (ctx) =>
                  save(
                    [
                      {
                        index: selected,
                        ...(object.type === 'text' ? { text } : {}),
                        dx: dx / 100,
                        dy: dy / 100,
                        scale: scale / 100,
                        rotation,
                        ...(image ? { image: await replacementImage(image) } : {}),
                      },
                    ],
                    ctx.signal,
                  ),
                )
              }
            >
              Objektänderung exportieren
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => run((ctx) => save([{ index: selected, remove: true }], ctx.signal))}
            >
              Objekt aus Ausgabe löschen
            </Button>
          </>
        )}
        {!!objects.length && (
          <>
            <h3>Suchen und ersetzen auf dieser Seite</h3>
            <Text
              label="Suchtext (Groß-/Kleinschreibung beachten)"
              value={find}
              onChange={setFind}
            />
            <Text label="Ersetzen durch" value={replace} onChange={setReplace} />
            <p>{matches.length} passende Textobjekte</p>
            <Button
              disabled={busy || !matches.length}
              variant="outline"
              onClick={() =>
                run((ctx) =>
                  save(
                    matches.map((o) => ({
                      index: o.index,
                      text: o.text.replaceAll(find, replace),
                    })),
                    ctx.signal,
                  ),
                )
              }
            >
              Ersetzungen exportieren
            </Button>
          </>
        )}
        <p className="fine-note">
          Die Vorschau markiert das Originalobjekt. Jede Ausgabe basiert auf der geöffneten Datei;
          für weitere Änderungen „Ergebnis übernehmen“ verwenden. Bearbeitet werden einzelne
          Textobjekte, ohne automatischen Absatzumbruch. Fehlende Zeichen in eingebetteten Schriften
          werden gemeldet. Inhalte in Objektgruppen sind hier gemeinsam bearbeitbar. Das Löschen ist
          keine Sicherheitsbereinigung.
        </p>
      </section>
      <section className="advanced-card">
        <PageStage
          source={source}
          page={page}
          rects={object ? [{ ...object, label: labels[object.type] }] : []}
        />
      </section>
    </div>
  );
}
