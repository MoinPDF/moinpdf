'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { renderPage, sourcePages, selectRange } from '@/lib/pdf-engine';
import {
  enhanceCanvas,
  enhancePdf,
  compareVisual,
  barcodeCanvas,
  decodePageCodes,
  placeBarcode,
  scanDefaults,
  makeCanvas,
  perspectiveCanvas,
  photosPdf,
  type ScanSettings,
  type Point,
} from '@/lib/advanced-media';
import { csvText } from '@/lib/table-data';
import {
  Text,
  Choice,
  Tick,
  NumberField,
  PageSelect,
  PageStage,
  type PanelProps,
} from './advanced-shared';

function ScanControls({
  settings,
  onChange,
}: {
  settings: ScanSettings;
  onChange: (v: ScanSettings) => void;
}) {
  useLanguage();
  return (
    <>
      <Tick
        label={ui('Schieflage automatisch korrigieren (bis 6°)')}
        value={settings.autoDeskew}
        onChange={(v) => onChange({ ...settings, autoDeskew: v })}
      />
      <NumberField
        label={ui('Zusätzliche Drehung (°)')}
        value={settings.angle}
        min={-15}
        max={15}
        step={0.25}
        onChange={(v) => onChange({ ...settings, angle: v })}
      />
      <NumberField
        label={ui('Kontrast (%)')}
        value={settings.contrast}
        min={-50}
        max={150}
        onChange={(v) => onChange({ ...settings, contrast: v })}
      />
      <NumberField
        label={ui('Helligkeit (%)')}
        value={settings.brightness}
        min={-50}
        max={50}
        onChange={(v) => onChange({ ...settings, brightness: v })}
      />
      <NumberField
        label={ui('Hintergrund aufhellen ab Grauwert (255 = aus)')}
        value={settings.cleanup}
        min={180}
        max={255}
        onChange={(v) => onChange({ ...settings, cleanup: v })}
      />
    </>
  );
}
export function EnhancePanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [settings, setSettings] = useState(scanDefaults),
    [page, setPage] = useState(0),
    [preview, setPreview] = useState(''),
    [angle, setAngle] = useState(0);
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <PageSelect
          source={source}
          page={page}
          onChange={(n) => {
            setPage(n);
            setPreview('');
          }}
        />
        <ScanControls
          settings={settings}
          onChange={(s) => {
            setSettings(s);
            setPreview('');
          }}
        />
        <p className="fine-note">
          {ui(
            'Hintergrundbereinigung kann helle Inhalte entfernen. Automatische Schieflagenkorrektur arbeitet am besten bei Textscans. Die Ausgabe besteht aus neuen Seitenbildern.',
          )}
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async (c) => {
              const { canvas } = await renderPage(
                  source,
                  sourcePages(source)[page],
                  1200,
                  c.signal,
                ),
                out = enhanceCanvas(canvas, settings);
              try {
                setPreview(out.canvas.toDataURL('image/png'));
                setAngle(out.angle);
              } finally {
                canvas.width = canvas.height = out.canvas.width = out.canvas.height = 0;
              }
            })
          }
        >
          {ui('Vorschau berechnen')}
        </Button>
        <Button disabled={busy} onClick={() => run((c) => enhancePdf(source, settings, c))}>
          {ui('Alle Seiten verbessern')}
        </Button>
      </section>
      <section>
        {preview ? (
          <div className="advanced-image-preview">
            <img src={preview} alt={ui('Vorschau des verbesserten Scans')} />
            <p>
              {ui('Korrekturwinkel: ')}
              {angle.toFixed(2)}°
            </p>
          </div>
        ) : (
          <PageStage source={source} page={page} />
        )}
      </section>
    </div>
  );
}
export function ComparePanel({ source, sources, busy, run }: PanelProps) {
  useLanguage();
  const others = sources.filter((s) => s.id !== source.id),
    [second, setSecond] = useState(others[0]?.id || ''),
    [tolerance, setTolerance] = useState(30);
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <h2>{ui('Änderungen im Seitenbild erkennen')}</h2>
        <p>
          {ui('Erste Datei: ')}
          {source.name}
        </p>
        <Choice
          label={ui('Zweite Datei')}
          value={second || others[0]?.id || ''}
          onChange={setSecond}
          items={others.map((s) => [s.id, s.name])}
          translateItems={false}
        />
        <NumberField
          label={ui('Farbtoleranz (0–255)')}
          value={tolerance}
          max={255}
          onChange={setTolerance}
        />
        <p className="fine-note">
          {ui(
            'Die Seiten werden maßstabsgleich links oben ausgerichtet. Rot markiert dunklere Inhalte der ersten Datei, Türkis die der zweiten. Verschiebungen und Scanrauschen erscheinen ebenfalls als Unterschiede.',
          )}
        </p>
        {!others.length && <p>{ui('Bitte über „Dateien hinzufügen“ eine zweite PDF öffnen.')}</p>}
        <Button
          disabled={busy || !others.length}
          onClick={() =>
            run((c) => {
              const other = others.find((s) => s.id === second) || others[0];
              if (!other) throw new Error('Bitte eine zweite Datei auswählen.');
              return compareVisual(source, other, tolerance, c);
            })
          }
        >
          {ui('Visuellen Vergleich erstellen')}
        </Button>
      </section>
      <PageStage source={source} />
    </div>
  );
}
export function BarcodePanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [mode, setMode] = useState('create'),
    [format, setFormat] = useState<'qrcode' | 'code128' | 'ean13'>('qrcode'),
    [text, setText] = useState('https://'),
    [preview, setPreview] = useState(''),
    [range, setRange] = useState('1'),
    [x, setX] = useState(70),
    [y, setY] = useState(5),
    [width, setWidth] = useState(20),
    [codes, setCodes] = useState<{ page: number; text: string; format: string }[]>([]),
    [scanned, setScanned] = useState(false);
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <Choice
          label={ui('Aktion')}
          value={mode}
          onChange={setMode}
          items={[
            ['create', 'Code erzeugen und platzieren'],
            ['read', 'Codes aus PDF lesen'],
          ]}
        />
        {mode === 'create' ? (
          <>
            <Choice
              label={ui('Codeformat')}
              value={format}
              onChange={(v) => {
                setFormat(v as typeof format);
                setPreview('');
              }}
              items={[
                ['qrcode', 'QR-Code'],
                ['code128', 'Code 128'],
                ['ean13', 'EAN-13'],
              ]}
            />
            <Text
              label={ui('Inhalt')}
              value={text}
              onChange={(v) => {
                setText(v);
                setPreview('');
              }}
            />
            <Text
              label={ui('Seiten (z. B. 1, 3–5; leer = alle)')}
              value={range}
              onChange={setRange}
            />
            <div className="advanced-coordinates">
              <NumberField label={ui('Links (%)')} value={x} max={95} onChange={setX} />
              <NumberField label={ui('Oben (%)')} value={y} max={95} onChange={setY} />
              <NumberField
                label={ui('Breite (%)')}
                value={width}
                min={2}
                max={100 - x}
                onChange={setWidth}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const c = await barcodeCanvas(text, format);
                  setPreview(c.toDataURL('image/png'));
                  c.width = c.height = 0;
                })
              }
            >
              {ui('Code anzeigen')}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run((c) =>
                  placeBarcode(
                    source,
                    text,
                    format,
                    [...selectRange(range.replace(/–/g, '-'), source.pdf.numPages)],
                    { x: x / 100, y: y / 100, w: width / 100 },
                    c,
                  ),
                )
              }
            >
              {ui('Code in PDF einfügen')}
            </Button>
          </>
        ) : (
          <>
            <p className="fine-note">
              {ui(
                'Liest verbreitete QR- und Barcodeformate, bis zu zehn Codes pro Seite. Kleine, verdeckte oder gedrehte Codes können unerkannt bleiben.',
              )}
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                run(async (c) => {
                  const found = [];
                  for (let i = 0; i < source.pdf.numPages; i++) {
                    for (const code of await decodePageCodes(source, i, c))
                      found.push({ ...code, page: i + 1 });
                    c.report({
                      percent: ((i + 1) / source.pdf.numPages) * 100,
                      label: `Codes · Seite ${i + 1}`,
                    });
                  }
                  setCodes(found);
                  setScanned(true);
                })
              }
            >
              {ui('Alle Seiten auslesen')}
            </Button>
            {scanned && (
              <p role="status">
                {codes.length} {ui(' Codes gefunden')}
              </p>
            )}
            {codes.map((code, i) => (
              <div className="advanced-list-row" key={i}>
                <strong>
                  {ui('Seite ')}
                  {code.page} · {code.format}
                </strong>
                <code className="code-result">{code.text}</code>
              </div>
            ))}
            {!!codes.length && (
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => ({
                    blob: new Blob(
                      [
                        csvText([
                          ['Seite', 'Format', 'Inhalt'],
                          ...codes.map((c) => [String(c.page), c.format, c.text]),
                        ]),
                      ],
                      { type: 'text/csv;charset=utf-8' },
                    ),
                    filename: 'Gelesene-Codes.csv',
                    kind: 'data',
                    pages: source.pdf.numPages,
                  }))
                }
              >
                {ui('Ergebnisse als CSV')}
              </Button>
            )}
          </>
        )}
      </section>
      <section>
        {preview && mode === 'create' ? (
          <div className="advanced-code-preview">
            <img src={preview} alt={ui('Vorschau des erzeugten Codes')} />
          </div>
        ) : (
          <PageStage source={source} />
        )}
      </section>
    </div>
  );
}
const initialCorners: Point[] = [
  { x: 0.03, y: 0.03 },
  { x: 0.97, y: 0.03 },
  { x: 0.97, y: 0.97 },
  { x: 0.03, y: 0.97 },
];
export function CameraPanel({ busy, run }: Pick<PanelProps, 'busy' | 'run'>) {
  useLanguage();
  const [photo, setPhoto] = useState(''),
    [corners, setCorners] = useState(initialCorners),
    [settings, setSettings] = useState({ ...scanDefaults, autoDeskew: false }),
    [preview, setPreview] = useState(''),
    [images, setImages] = useState<string[]>([]),
    [drag, setDrag] = useState(-1);
  const input = useRef<HTMLInputElement>(null),
    sourceCanvas = useRef<HTMLCanvasElement | null>(null),
    frame = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      if (sourceCanvas.current) sourceCanvas.current.width = sourceCanvas.current.height = 0;
    },
    [],
  );
  const process = () => {
    if (!sourceCanvas.current) throw new Error('Bitte zuerst ein Foto auswählen.');
    const cropped = perspectiveCanvas(sourceCanvas.current, corners),
      out = enhanceCanvas(cropped, settings);
    try {
      return out.canvas.toDataURL('image/jpeg', 0.9);
    } finally {
      cropped.width = cropped.height = out.canvas.width = out.canvas.height = 0;
    }
  };
  return (
    <>
      <div className="advanced-grid">
        <section className="advanced-card">
          <h2>{ui('Aus Fotos werden Dokumente')}</h2>
          <p>
            {ui(
              'Auf dem Smartphone öffnet die Fotoauswahl bei unterstützten Browsern die Kamera. Auf dem Computer lassen sich vorhandene Fotos auswählen.',
            )}
          </p>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            aria-label={ui('Kamerafoto auswählen')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file)
                void run(async () => {
                  if (file.size > 20 * 1024 * 1024)
                    throw new Error('Ein Foto darf höchstens 20 MB groß sein.');
                  const bitmap = await createImageBitmap(file);
                  try {
                    if (bitmap.width * bitmap.height > 80_000_000)
                      throw new Error('Das Foto ist zu groß. Maximal 80 Megapixel.');
                    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height)),
                      c = makeCanvas(bitmap.width * scale, bitmap.height * scale);
                    c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
                    if (sourceCanvas.current)
                      sourceCanvas.current.width = sourceCanvas.current.height = 0;
                    sourceCanvas.current = c;
                    setPhoto(c.toDataURL('image/jpeg', 0.9));
                    setPreview('');
                    setCorners(initialCorners);
                  } finally {
                    bitmap.close();
                  }
                });
            }}
          />
          <Button disabled={busy} onClick={() => input.current?.click()}>
            {ui('Foto aufnehmen oder auswählen')}
          </Button>
          {photo && (
            <>
              <h3>{ui('Ausschnitt und Perspektive')}</h3>
              <p className="fine-note">
                {ui(
                  'Die vier Ecken am Dokument ausrichten. Reihenfolge: links oben, rechts oben, rechts unten, links unten.',
                )}
              </p>
              {corners.map((p, i) => (
                <div className="advanced-coordinates" key={i}>
                  <NumberField
                    label={ui(`${i + 1} · X (%)`)}
                    value={Math.round(p.x * 100)}
                    onChange={(v) => {
                      setCorners(corners.map((c, n) => (n === i ? { ...c, x: v / 100 } : c)));
                      setPreview('');
                    }}
                  />
                  <NumberField
                    label={ui(`${i + 1} · Y (%)`)}
                    value={Math.round(p.y * 100)}
                    onChange={(v) => {
                      setCorners(corners.map((c, n) => (n === i ? { ...c, y: v / 100 } : c)));
                      setPreview('');
                    }}
                  />
                </div>
              ))}
              <details>
                <summary>{ui('Scan verbessern')}</summary>
                <ScanControls
                  settings={settings}
                  onChange={(v) => {
                    setSettings(v);
                    setPreview('');
                  }}
                />
              </details>
              <div className="advanced-actions">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(async () => setPreview(process()))}
                >
                  {ui('Ausschnitt prüfen')}
                </Button>
                <Button
                  disabled={busy || images.length >= 50}
                  onClick={() =>
                    run(async () => {
                      const image = process();
                      if (
                        images.reduce((n, s) => n + s.length, 0) + image.length >
                        100 * 1024 * 1024
                      )
                        throw new Error(
                          'Das Dokument ist zu groß. Bitte zuerst die bisherigen Seiten speichern.',
                        );
                      setImages([...images, image]);
                      setPreview(image);
                    })
                  }
                >
                  {ui('Als Seite hinzufügen')}
                </Button>
              </div>
            </>
          )}
        </section>
        <section>
          {photo ? (
            <>
              <div
                ref={frame}
                className="camera-corners"
                onPointerMove={(e) => {
                  if (drag < 0) return;
                  const b = frame.current!.getBoundingClientRect(),
                    p = {
                      x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
                      y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
                    };
                  setCorners(corners.map((c, i) => (i === drag ? p : c)));
                  setPreview('');
                }}
                onPointerUp={() => setDrag(-1)}
                onPointerCancel={() => setDrag(-1)}
              >
                <img src={photo} alt={ui('Foto mit vier einstellbaren Dokumentecken')} />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} />
                </svg>
                {corners.map((p, i) => (
                  <button
                    key={i}
                    aria-label={ui(`Ecke ${i + 1} verschieben`)}
                    style={{ left: p.x * 100 + '%', top: p.y * 100 + '%' }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDrag(i);
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              {preview && (
                <div className="advanced-image-preview">
                  <h3>{ui('Entzerrte Vorschau')}</h3>
                  <img src={preview} alt={ui('Perspektivisch korrigierter Ausschnitt')} />
                </div>
              )}
            </>
          ) : (
            <div className="advanced-empty">
              {ui('Foto auswählen, Ecken setzen, Seiten sammeln.')}
            </div>
          )}
        </section>
      </div>
      {!!images.length && (
        <section className="advanced-card">
          <h2>
            {ui('Gesammelte Seiten · ')}
            {images.length}/50
          </h2>
          <div className="camera-pages">
            {images.map((img, i) => (
              <div key={i}>
                <img src={img} alt={ui(`Gesammelte Seite ${i + 1}`)} />
                <span>
                  {ui('Seite ')}
                  {i + 1}
                </span>
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={ui(`Seite ${i + 1} nach vorne`)}
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...images];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setImages(next);
                    }}
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={ui(`Seite ${i + 1} entfernen`)}
                    onClick={() => setImages(images.filter((_, n) => n !== i))}
                  >
                    {ui('Entfernen')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button disabled={busy} onClick={() => run((c) => photosPdf(images, c))}>
            {ui('Gesammelte Seiten als PDF erstellen')}
          </Button>
        </section>
      )}
    </>
  );
}
