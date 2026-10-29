'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

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
import { NativeSelectionPanel } from './native-selection-panel';
import { NativeParagraphPanel } from './native-paragraph-panel';
import { NativeObjectHandles } from './native-object-handles';
import { replacementImage } from '@/lib/replacement-image';
import { RepeatedImagesPanel } from './repeated-images-panel';
import { OperationPreview } from './operation-preview';

export function NativePanel(props: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const [mode, setMode] = useState('object');
  return (
    <>
      <Choice
        label={ui('Bearbeitung')}
        value={mode}
        onChange={(value) => {
          setMode(value);
          props.invalidate();
        }}
        items={[
          ['object', 'Einzelne Objekte'],
          ['selection', 'Mehrere Objekte'],
          ['repeated', 'Wiederkehrende Logos austauschen'],
          ['paragraph', 'Absatz mit automatischem Umbruch'],
        ]}
      />
      {mode === 'repeated' ? (
        <RepeatedImagesPanel {...props} />
      ) : mode === 'selection' ? (
        <NativeSelectionPanel {...props} />
      ) : mode === 'paragraph' ? (
        <NativeParagraphPanel {...props} />
      ) : (
        <SingleObjectPanel {...props} />
      )}
    </>
  );
}
function SingleObjectPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [page, setPage] = useState(0),
    [objects, setObjects] = useState<NativeObject[]>([]),
    [selected, setSelected] = useState(-1),
    [loaded, setLoaded] = useState(false);
  const [scope, setScope] = useState<number[]>([]);
  const [text, setText] = useState(''),
    [dx, setDx] = useState(0),
    [dy, setDy] = useState(0),
    [scale, setScale] = useState(100),
    [rotation, setRotation] = useState(0),
    [order, setOrder] = useState<'unchanged' | 'front' | 'back'>('unchanged'),
    [image, setImage] = useState<File | null>(null);
  const [find, setFind] = useState(''),
    [replace, setReplace] = useState('');
  const object = objects.find((o) => o.index === selected),
    matches = find
      ? objects.filter((o) => o.type === 'text' && !o.shaped && o.text.includes(find))
      : [];
  const select = (id: number) => {
    setSelected(id);
    setText(objects.find((o) => o.index === id)?.text || '');
    setDx(0);
    setDy(0);
    setScale(100);
    setRotation(0);
    setOrder('unchanged');
    setImage(null);
  };
  const save = async (changes: NativeChange[], signal: AbortSignal) =>
    packagePdfs(
      [
        {
          name: source.name.replace(/\.pdf$/i, '') + '-Objekte.pdf',
          bytes: await editObjects(source.bytes, page, changes, signal, scope),
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
  const openScope = (path: number[]) =>
    run(async (ctx) => {
      const items = await inspectObjects(source.bytes, page, ctx.signal, path);
      if (ctx.signal.aborted) return;
      setScope(path);
      setObjects(items);
      setLoaded(true);
      setSelected(-1);
    });
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>{ui('Vorhandene Objekte bearbeiten')}</h2>
        <p>
          {ui(
            'Text in der Originalschrift ändern. Bilder und Grafiken verschieben, drehen, skalieren oder löschen.',
          )}
        </p>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            setObjects([]);
            setSelected(-1);
            setLoaded(false);
            setScope([]);
          }}
        />
        <Button disabled={busy} onClick={() => openScope([])}>
          {ui('Seitenobjekte laden')}
        </Button>
        {!!scope.length && (
          <div className="advanced-card">
            <p>
              {ui('Geöffnete Gruppe')}: {scope.map((n) => n + 1).join(' / ')}
            </p>
            <Button disabled={busy} variant="outline" onClick={() => openScope(scope.slice(0, -1))}>
              {ui('Eine Ebene zurück')}
            </Button>
            <p className="fine-note">
              {ui(
                'Änderungen betreffen nur diese Gruppeninstanz. Der Beschnitt der Gruppe bleibt erhalten.',
              )}
            </p>
          </div>
        )}
        {loaded && !objects.length && (
          <p>{ui('Keine einzeln bearbeitbaren Objekte auf dieser Seite gefunden.')}</p>
        )}
        {!!objects.length && (
          <Choice
            label={ui('Objekt auswählen')}
            value={String(selected)}
            onChange={(v) => select(Number(v))}
            items={[
              ['-1', ui('Bitte auswählen')],
              ...objects.map(
                (o) =>
                  [
                    String(o.index),
                    `${o.index + 1} · ${ui(labels[o.type])}${o.text ? ' · ' + o.text.slice(0, 85) : ''}`,
                  ] as [string, string],
              ),
            ]}
            translateItems={false}
          />
        )}
        {object && (
          <>
            {object.type === 'group' && (
              <Button
                disabled={busy || scope.length >= 16}
                variant="outline"
                onClick={() => openScope([...scope, selected])}
              >
                {ui('Gruppeninhalt bearbeiten')}
              </Button>
            )}
            {object.type === 'text' && (
              <Text
                label={ui('Textinhalt')}
                value={text}
                onChange={setText}
                disabled={object.shaped}
              />
            )}
            {object.shaped && (
              <p className="fine-note">
                {ui(
                  'Diesen geformten Absatz im Absatzmodus ändern. Verschieben, Drehen und Löschen betrifft den ganzen Absatz.',
                )}
              </p>
            )}
            {object.type === 'image' && (
              <label className="advanced-field">
                <span>{ui('Bild ersetzen (PNG, JPG, WebP)')}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
                {image && (
                  <small>
                    {image.name} {ui(' · wird in die vorhandene Bildfläche eingesetzt')}
                  </small>
                )}
              </label>
            )}
            <NumberField
              label={ui('Verschiebung nach rechts (% Seitenbreite)')}
              value={dx}
              onChange={setDx}
              min={-100}
              max={100}
              step={0.5}
            />
            <NumberField
              label={ui('Verschiebung nach unten (% Seitenhöhe)')}
              value={dy}
              onChange={setDy}
              min={-100}
              max={100}
              step={0.5}
            />
            <NumberField
              label={ui('Größe (%)')}
              value={scale}
              onChange={setScale}
              min={10}
              max={1000}
            />
            <NumberField
              label={ui('Drehung im Uhrzeigersinn (Grad)')}
              value={rotation}
              onChange={setRotation}
              min={-360}
              max={360}
            />
            <Choice
              label={ui('Zeichenreihenfolge')}
              value={order}
              onChange={(v) => setOrder(v as typeof order)}
              items={[
                ['unchanged', 'Unverändert'],
                ['front', 'Ganz nach vorn'],
                ['back', 'Ganz nach hinten'],
              ]}
            />
            <Button
              disabled={busy}
              onClick={() =>
                run(async (ctx) =>
                  save(
                    [
                      {
                        index: selected,
                        ...(object.type === 'text' && text !== object.text ? { text } : {}),
                        dx: dx / 100,
                        dy: dy / 100,
                        scale: scale / 100,
                        rotation,
                        ...(order === 'unchanged' ? {} : { order }),
                        ...(image ? { image: await replacementImage(image) } : {}),
                      },
                    ],
                    ctx.signal,
                  ),
                )
              }
            >
              {ui('Objektänderung exportieren')}
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => run((ctx) => save([{ index: selected, remove: true }], ctx.signal))}
            >
              {ui('Objekt aus Ausgabe löschen')}
            </Button>
          </>
        )}
        {!!objects.length && (
          <>
            <h3>
              {ui(
                scope.length
                  ? 'Suchen und ersetzen in dieser Gruppe'
                  : 'Suchen und ersetzen auf dieser Seite',
              )}
            </h3>
            <Text
              label={ui('Suchtext (Groß-/Kleinschreibung beachten)')}
              value={find}
              onChange={setFind}
            />
            <Text label={ui('Ersetzen durch')} value={replace} onChange={setReplace} />
            <p>
              {matches.length} {ui(' passende Textobjekte')}
            </p>
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
              {ui('Ersetzungen exportieren')}
            </Button>
          </>
        )}
        <p className="fine-note">
          {ui(
            'Objekte in der Vorschau auswählen; am Rahmen verschieben, am Eckpunkt skalieren und am runden Griff drehen. Die Pfeiltasten bedienen den fokussierten Griff. Gruppen lassen sich öffnen, um einzelne Inhalte zu bearbeiten. Jede Ausgabe basiert auf der geöffneten Datei; für weitere Änderungen „Ergebnis übernehmen“ verwenden. Für automatischen Umbruch oben „Absatz“ wählen. Fehlende Zeichen werden gemeldet. Das Löschen ist keine Sicherheitsbereinigung.',
          )}
        </p>
      </section>
      <section className="advanced-card">
        <PageStage source={source} page={page}>
          <NativeObjectHandles
            objects={objects}
            object={object}
            value={{ dx, dy, scale, rotation }}
            disabled={busy}
            onSelect={select}
            onChange={(v) => {
              setDx(v.dx);
              setDy(v.dy);
              setScale(v.scale);
              setRotation(v.rotation);
            }}
          />
        </PageStage>
        {object && (
          <OperationPreview
            busy={busy}
            version={JSON.stringify({
              page,
              scope,
              selected,
              text,
              dx,
              dy,
              scale,
              rotation,
              order,
              image: image && [image.name, image.size, image.lastModified],
            })}
            build={async (signal) =>
              save(
                [
                  {
                    index: selected,
                    ...(object.type === 'text' && text !== object.text ? { text } : {}),
                    dx: dx / 100,
                    dy: dy / 100,
                    scale: scale / 100,
                    rotation,
                    ...(order === 'unchanged' ? {} : { order }),
                    ...(image ? { image: await replacementImage(image) } : {}),
                  },
                ],
                signal,
              )
            }
          />
        )}
      </section>
    </div>
  );
}
