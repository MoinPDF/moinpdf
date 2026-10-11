'use client';
import { useEffect, useState } from 'react';
import './advanced-workbench.css';
import { Button } from '@/components/ui/button';
import { openSource, type Source } from '@/lib/pdf-engine';
import {
  inspectObjects,
  replaceParagraph,
  type NativeObject,
  type NativeParagraphStyle,
} from '@/lib/native-pdf';
import { packagePdfs } from '@/lib/pro-tools';
import {
  Choice,
  Tick,
  Field,
  NumberField,
  PageSelect,
  PageStage,
  RectFields,
  type PanelProps,
} from './advanced-shared';

export function NativeParagraphPanel({ source, busy, run }: PanelProps) {
  const [page, setPage] = useState(0),
    [objects, setObjects] = useState<NativeObject[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [loaded, setLoaded] = useState(false),
    [text, setText] = useState(''),
    [rect, setRect] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.4 });
  const [fontSize, setFontSize] = useState(12),
    [lineHeight, setLineHeight] = useState(1.4),
    [padding, setPadding] = useState(4),
    [align, setAlign] = useState<'left' | 'center' | 'right'>('left'),
    [color, setColor] = useState('#000000'),
    [fontChoice, setFontChoice] = useState('noto'),
    [fontFile, setFontFile] = useState<File | null>(null);
  const [styles, setStyles] = useState<(NativeParagraphStyle & { fontFile?: File })[]>([]),
    [selection, setSelection] = useState<[number, number]>([0, 0]),
    [flow, setFlow] = useState(false),
    [previewPage, setPreviewPage] = useState(0);
  const [preview, setPreview] = useState<{ source: Source; key: string; lines: number } | null>(
    null,
  );
  const settingsKey = JSON.stringify({
    page,
    styles: styles.map((s) => ({
      ...s,
      fontFile: s.fontFile && [s.fontFile.name, s.fontFile.size, s.fontFile.lastModified],
    })),
    flow,
    selected,
    text,
    rect,
    fontSize,
    lineHeight,
    padding,
    align,
    color,
    fontChoice,
    fontFile: fontFile && [fontFile.name, fontFile.size, fontFile.lastModified],
  });
  const currentPreview = preview?.key === settingsKey ? preview : null;
  useEffect(
    () => () => {
      if (preview) void preview.source.pdf.loadingTask.destroy();
    },
    [preview],
  );
  const selectedObjects = objects.filter((o) => selected.includes(o.index));
  const useSelection = () => {
    const ordered = [...selectedObjects].sort((a, b) =>
      Math.abs(a.y - b.y) < Math.min(a.h, b.h) / 2 ? a.x - b.x : a.y - b.y,
    );
    setStyles([]);
    setText(ordered.map((o) => o.text.trim()).join(' '));
    const x = Math.max(0, Math.min(...ordered.map((o) => o.x)) - 0.01),
      y = Math.max(0, Math.min(...ordered.map((o) => o.y)) - 0.01),
      right = Math.min(1, Math.max(...ordered.map((o) => o.x + o.w)) + 0.01),
      bottom = Math.min(1, Math.max(...ordered.map((o) => o.y + o.h)) + 0.04);
    setRect({
      x,
      y,
      w: Math.min(1 - x, Math.max(0.2, right - x)),
      h: Math.min(1 - y, Math.max(0.15, bottom - y)),
    });
  };
  const build = async (signal: AbortSignal) => {
    for (const style of styles)
      if (style.fontFile && style.fontFile.size > 10 * 1024 * 1024)
        throw new Error('Eine Bereichsschrift ist größer als 10 MB.');
    let fontBytes: Uint8Array;
    if (fontChoice === 'custom') {
      if (!fontFile || fontFile.size > 10 * 1024 * 1024)
        throw new Error('Bitte eine statische TrueType-Schrift mit höchstens 10 MB auswählen.');
      fontBytes = new Uint8Array(await fontFile.arrayBuffer());
    } else {
      const response = await fetch('/vendor/invoice-font/NotoSans-Regular.ttf', { signal });
      if (!response.ok) throw new Error('Die lokale Schrift konnte nicht geladen werden.');
      fontBytes = new Uint8Array(await response.arrayBuffer());
    }
    return replaceParagraph(
      source.bytes,
      page,
      {
        indices: selected,
        text,
        rect,
        fontBytes,
        fontSize,
        lineHeight,
        padding,
        align,
        color,
        flow,
        styles: await Promise.all(
          styles.map(async (style) => ({
            from: style.from,
            to: style.to,
            fontSize: style.fontSize,
            color: style.color,
            ...(style.fontFile
              ? { fontBytes: new Uint8Array(await style.fontFile.arrayBuffer()) }
              : {}),
          })),
        ),
      },
      signal,
    );
  };
  const ready = !busy && !!selected.length && !!text.trim();
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>Absätze neu umbrechen</h2>
        <p>
          Mehrere vorhandene Textobjekte auswählen und durch einen gemeinsam formatierten Absatz
          ersetzen. Der übrige Seiteninhalt bleibt erhalten.
        </p>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            setObjects([]);
            setSelected([]);
            setText('');
            setLoaded(false);
          }}
        />
        <Button
          disabled={busy}
          onClick={() =>
            run(async (ctx) => {
              const items = await inspectObjects(source.bytes, page, ctx.signal);
              if (ctx.signal.aborted) return;
              setObjects(items.filter((o) => o.type === 'text'));
              setLoaded(true);
              setSelected([]);
            })
          }
        >
          Textobjekte laden
        </Button>
        {loaded && !objects.length && (
          <p>
            Keine einzeln bearbeitbaren Texte. Scans zuerst mit OCR auslesen. Texte in Objektgruppen
            sind hier nicht auswählbar.
          </p>
        )}
        {!!objects.length && (
          <>
            <fieldset className="paragraph-object-list" disabled={busy}>
              <legend>Zu ersetzende Textobjekte</legend>
              {objects.map((o) => (
                <label className="advanced-tick" key={o.index}>
                  <input
                    type="checkbox"
                    checked={selected.includes(o.index)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, o.index]
                          : selected.filter((id) => id !== o.index),
                      )
                    }
                  />
                  <span>
                    {o.index + 1} · {o.text.slice(0, 160) || '(leerer Text)'}
                  </span>
                </label>
              ))}
            </fieldset>
            <p>{selected.length} Textobjekte ausgewählt</p>
            <Button variant="outline" disabled={busy || !selected.length} onClick={useSelection}>
              Auswahl als Absatz laden
            </Button>
          </>
        )}
        <Field label="Neuer Absatztext">
          <textarea
            aria-label="Neuer Absatztext"
            rows={8}
            maxLength={20000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setStyles([]);
            }}
            onSelect={(e) =>
              setSelection([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])
            }
          />
        </Field>
        <p className="fine-note">
          Textreihenfolge nach dem Übernehmen prüfen. Eingabetaste beginnt eine neue Zeile; weitere
          Umbrüche setzt MoinPDF automatisch. Unterstützt werden lateinische, griechische und
          kyrillische Schriften.
        </p>
        <Button
          variant="outline"
          disabled={busy || selection[1] <= selection[0] || styles.length >= 32}
          onClick={() =>
            setStyles((all) => [...all, { from: selection[0], to: selection[1], fontSize, color }])
          }
        >
          Markierten Text anders formatieren
        </Button>
        {styles.map((style, i) => (
          <fieldset className="pro-rule" key={i}>
            <legend>
              Formatierung {i + 1}: {text.slice(style.from, style.to).slice(0, 60)}
            </legend>
            <NumberField
              label={`Formatierung ${i + 1}: Schriftgröße`}
              value={style.fontSize}
              min={6}
              max={144}
              onChange={(v) =>
                setStyles((all) => all.map((s, n) => (n === i ? { ...s, fontSize: v } : s)))
              }
            />
            <Field label={`Formatierung ${i + 1}: Farbe`}>
              <input
                type="color"
                value={style.color}
                onChange={(e) =>
                  setStyles((all) =>
                    all.map((s, n) => (n === i ? { ...s, color: e.target.value } : s)),
                  )
                }
              />
            </Field>
            <Field label={`Formatierung ${i + 1}: eigene Schrift (.ttf)`}>
              <input
                type="file"
                accept=".ttf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    setStyles((all) => all.map((s, n) => (n === i ? { ...s, fontFile: f } : s)));
                }}
              />
              {style.fontFile && <small>{style.fontFile.name}</small>}
            </Field>
            <Button
              variant="outline"
              onClick={() => setStyles((all) => all.filter((_, n) => n !== i))}
            >
              Formatierung {i + 1} entfernen
            </Button>
          </fieldset>
        ))}
        <p className="fine-note">
          Text markieren, dann eine abweichende Größe, Farbe oder eigene Schrift festlegen. Beim
          Ändern des Absatztextes werden die Bereichsformatierungen zurückgesetzt. Überlappende
          Bereiche werden abgewiesen.
        </p>
        <Tick label="Bei Textüberlauf neue Folgeseiten einfügen" value={flow} onChange={setFlow} />
        {flow && (
          <p className="fine-note">
            Bis zu 19 zusätzliche leere Seiten werden direkt nach der bearbeiteten Seite eingefügt.
            Der Absatz fließt im gleichen relativen Textbereich weiter; vorhandene spätere Seiten
            bleiben erhalten.
          </p>
        )}
        <Choice
          label="Absatzschrift"
          value={fontChoice}
          onChange={setFontChoice}
          items={[
            ['noto', 'Noto Sans'],
            ['custom', 'Eigene TrueType-Schrift'],
          ]}
        />
        {fontChoice === 'custom' && (
          <Field label="TrueType-Schrift (.ttf)">
            <input
              aria-label="TrueType-Schrift (.ttf)"
              type="file"
              accept=".ttf,font/ttf"
              onChange={(e) => setFontFile(e.target.files?.[0] || null)}
            />
            <small>Statische Schrift, höchstens 10 MB. Sie wird in die Ausgabe eingebettet.</small>
          </Field>
        )}
        <div className="advanced-coordinates">
          <NumberField
            label="Absatzschriftgröße (pt)"
            value={fontSize}
            onChange={setFontSize}
            min={6}
            max={144}
            step={0.5}
          />
          <NumberField
            label="Zeilenabstand (Faktor)"
            value={lineHeight}
            onChange={setLineHeight}
            min={1}
            max={3}
            step={0.1}
          />
          <NumberField
            label="Innenabstand (pt)"
            value={padding}
            onChange={setPadding}
            min={0}
            max={72}
          />
          <Field label="Textfarbe">
            <input
              aria-label="Textfarbe"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </Field>
        </div>
        <Choice
          label="Absatzausrichtung"
          value={align}
          onChange={(v) => setAlign(v as typeof align)}
          items={[
            ['left', 'Linksbündig'],
            ['center', 'Zentriert'],
            ['right', 'Rechtsbündig'],
          ]}
        />
        <h3>Neuer Textbereich</h3>
        <RectFields rect={rect} onChange={setRect} />
        <Button
          disabled={!ready}
          variant="outline"
          onClick={() =>
            run(async (ctx) => {
              const out = await build(ctx.signal);
              const opened = await openSource(
                new File([new Uint8Array(out.bytes)], 'Absatz-Vorschau.pdf', {
                  type: 'application/pdf',
                }),
              );
              if (ctx.signal.aborted) {
                await opened.pdf.loadingTask.destroy();
                return;
              }
              setPreviewPage(page);
              setPreview({ source: opened, key: settingsKey, lines: out.lines });
            })
          }
        >
          Absatzvorschau berechnen
        </Button>
        <Button
          disabled={!ready}
          onClick={() =>
            run(async (ctx) => {
              const out = await build(ctx.signal);
              return packagePdfs(
                [
                  {
                    name: source.name.replace(/\.pdf$/i, '') + '-Absatz.pdf',
                    bytes: out.bytes,
                    pages: source.pdf.numPages + out.addedPages,
                  },
                ],
                `${out.lines} Zeilen. Ausgewählte Originaltexte wurden ersetzt. Für weitere Änderungen „Ergebnis übernehmen“ verwenden. Signaturen und vorhandene Barrierefreiheits-Tags müssen nach einer Textänderung erneut geprüft werden. Keine Sicherheitsbereinigung.`,
              );
            })
          }
        >
          Absatz exportieren
        </Button>
        <p className="fine-note">
          MoinPDF prüft Schriftzeichen, Formgebung und Textüberlauf vor dem Export. Formatierungen
          können Größe, Farbe und Schrift innerhalb des Absatzes ändern. Die Auswahl umfasst ganze
          Textobjekte; Bilder, ungewählte Texte und Objektgruppen werden nicht entfernt.
          Überschneidungen mit ihnen bitte in der Vorschau prüfen.
        </p>
      </section>
      <section className="advanced-card">
        <h2>
          {currentPreview
            ? `Ergebnisvorschau · ${currentPreview.lines} Zeilen`
            : 'Original und neuer Textbereich'}
        </h2>
        {currentPreview && (
          <PageSelect source={currentPreview.source} page={previewPage} onChange={setPreviewPage} />
        )}
        <PageStage
          source={currentPreview?.source || source}
          page={currentPreview ? previewPage : page}
          rects={
            currentPreview
              ? []
              : [
                  ...selectedObjects.map((o) => ({ ...o, label: String(o.index + 1) })),
                  { ...rect, label: 'Neuer Absatz' },
                ]
          }
          onRect={busy || currentPreview ? undefined : setRect}
        />
        {currentPreview && (
          <Button variant="outline" onClick={() => setPreview(null)}>
            Zur Originalansicht
          </Button>
        )}
      </section>
    </div>
  );
}
