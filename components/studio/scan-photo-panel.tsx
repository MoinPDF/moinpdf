'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { useToolDraftState } from './workspace-drafts';
import { ui } from '@/lib/ui-language';
import { renderPage, sourcePages, type Source } from '@/lib/pdf-engine';
import {
  cropScanPhoto,
  exportScanRegions,
  proposeScanRegions,
  type ScanRegions,
  type ScanFormat,
} from '@/lib/scan-split';
import { photoBounds, photoCorners, validPhoto, type ScanPhoto } from '@/lib/scan-photo-detection';
import {
  Choice,
  NumberField,
  PageSelect,
  PageStage,
  RectFields,
  type PanelProps,
} from './advanced-shared';

function CropPreview({ canvas, region }: { canvas: HTMLCanvasElement | null; region: ScanPhoto }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    setPreview('');
    if (!canvas || !canvas.width || !validPhoto(region)) return;
    try {
      const crop = cropScanPhoto(canvas, region, 280);
      try {
        setPreview(crop.toDataURL('image/png'));
      } finally {
        crop.width = crop.height = 0;
      }
    } catch {
      /* Invalid corner positions remain editable; export is disabled. */
    }
  }, [canvas, region]);
  return preview ? (
    <img src={preview} alt={ui('Zugeschnittenes Foto')} />
  ) : (
    <span>{ui('Fotoecken prüfen')}</span>
  );
}

function usePreviewCanvas(source: Source, page: number) {
  const [preview, setPreview] = useState<{
    source: Source;
    page: number;
    canvas: HTMLCanvasElement;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let owned: HTMLCanvasElement | undefined;
    setError('');
    renderPage(source, sourcePages(source)[page], 1000, controller.signal)
      .then(({ canvas }) => {
        owned = canvas;
        if (controller.signal.aborted) canvas.width = canvas.height = 0;
        else setPreview({ source, page, canvas });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError((error as Error).message);
      });
    return () => {
      controller.abort();
      if (owned) owned.width = owned.height = 0;
    };
  }, [source, page]);
  return {
    canvas: preview?.source === source && preview.page === page ? preview.canvas : null,
    error,
  };
}

export function ScanSplitPanel({
  source,
  run,
  busy,
  invalidate,
}: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const [page, setPage] = useToolDraftState('ScanSplitPanel.page:' + source.id, 0);
  const [regions, setRegions] = useToolDraftState<ScanRegions>(
    'ScanSplitPanel.regions:' + source.id,
    {},
  );
  const [sensitivity, setSensitivity] = useToolDraftState(
    'ScanSplitPanel.sensitivity:' + source.id,
    18,
  );
  const [format, setFormat] = useToolDraftState<ScanFormat>(
    'ScanSplitPanel.format:' + source.id,
    'jpeg',
  );
  const [dpi, setDpi] = useToolDraftState('ScanSplitPanel.dpi:' + source.id, 300);
  const [notices, setNotices] = useToolDraftState<Record<number, string>>(
    'ScanSplitPanel.notices:' + source.id,
    {},
  );
  const [reviewed, setReviewed] = useState(false),
    [replace, setReplace] = useState(false),
    [selected, setSelected] = useState(0);
  const current = regions[page] || [],
    count = Object.values(regions).reduce((n, r) => n + r.length, 0);
  const active = Math.min(selected, Math.max(0, current.length - 1)),
    region = current[active];
  const { canvas, error } = usePreviewCanvas(source, page);
  const update = (next: ScanPhoto[]) => {
    invalidate();
    setRegions((old) => ({ ...old, [page]: next }));
    setReviewed(false);
    setReplace(false);
  };
  const change = (next: ScanPhoto) => update(current.map((r, i) => (i === active ? next : r)));
  const corner = (index: number, x: number, y: number) => {
    if (busy || !region) return;
    const points = photoCorners(region).map((p, i) =>
      i === index ? { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : p,
    );
    change({ ...region, ...photoBounds(points), corners: points });
  };
  const detect = (all: boolean) =>
    run(async (ctx) => {
      const next = { ...regions },
        messages = { ...notices };
      const indices = all ? Array.from({ length: source.pdf.numPages }, (_, i) => i) : [page];
      if (indices.length > 50)
        throw new Error('Bitte für die automatische Erkennung höchstens 50 Seiten verwenden.');
      for (const [i, p] of indices.entries()) {
        const result = await proposeScanRegions(source, p, sensitivity, ctx.signal);
        next[p] = result.regions;
        messages[p] = result.limited
          ? 'Mehr als 32 mögliche Fotos. Weitere Fotos manuell ergänzen oder die Seite aufteilen.'
          : !result.regions.length
            ? 'Keine sichere Erkennung. Kontrastschwelle senken oder einen eigenen Rahmen aufziehen.'
            : result.regions.some((r) => r.uncertain)
              ? 'Unsichere Konturen: Helle, angeschnittene oder verbundene Fotos bitte besonders sorgfältig prüfen.'
              : 'Vorschläge erkannt. Bitte jedes Foto und seine Ränder am Original prüfen.';
        if (Object.values(next).reduce((n, r) => n + r.length, 0) > 200)
          throw new Error('Bitte 1 bis 200 gültige Ausschnitte innerhalb der Seiten markieren.');
        ctx.report({
          percent: ((i + 1) / indices.length) * 100,
          label: `Ausschnitte suchen · Seite ${p + 1}`,
        });
      }
      ctx.signal.throwIfAborted();
      setRegions(next);
      setNotices(messages);
      setReviewed(false);
      setSelected(0);
      setReplace(false);
    });
  return (
    <section className="advanced-card scan-photo-panel">
      <h2>{ui('Scanfotos automatisch trennen')}</h2>
      <p>
        {ui(
          'Mehrere Fotos lokal erkennen, einzeln ausrichten und zuschneiden. Die Originaldatei bleibt unverändert.',
        )}
      </p>
      <fieldset disabled={busy} className="scan-photo-controls">
        <NumberField
          label={ui('Kontrastschwelle')}
          value={sensitivity}
          min={6}
          max={60}
          onChange={setSensitivity}
        />
        <p className="fine-note">
          {ui(
            'Kleinere Werte helfen bei blassen Fotos; größere Werte unterdrücken Staub und Schatten. Fotos mit Abstand auf einen möglichst gleichmäßigen Hintergrund legen.',
          )}
        </p>
        {count > 0 && (
          <label className="advanced-tick">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>{ui('Vorhandene Ausschnitte bei erneuter Erkennung ersetzen')}</span>
          </label>
        )}
        <div className="advanced-actions">
          <Button
            variant="outline"
            disabled={!!current.length && !replace}
            onClick={() => detect(false)}
          >
            {ui('Diese Seite erkennen')}
          </Button>
          <Button
            variant="outline"
            disabled={source.pdf.numPages > 50 || (!!count && !replace)}
            onClick={() => detect(true)}
          >
            {ui('Alle Seiten erkennen')}
          </Button>
        </div>
        <PageSelect
          source={source}
          page={page}
          onChange={(p) => {
            setPage(p);
            setSelected(0);
          }}
        />
        <p role="status">
          {ui(notices[page] || 'Erkennung starten oder einen eigenen Rahmen aufziehen.')}
        </p>
        <PageStage
          source={source}
          page={page}
          onRect={
            busy || count >= 200
              ? undefined
              : (r) => {
                  update([...current, r]);
                  setSelected(current.length);
                }
          }
        >
          <svg
            className="scan-photo-outlines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {current.map((r, i) => (
              <g key={i} className={i === active ? 'selected' : ''}>
                <polygon
                  points={photoCorners(r)
                    .map((p) => `${p.x * 100},${p.y * 100}`)
                    .join(' ')}
                />
                <text x={r.x * 100 + 1} y={r.y * 100 + 3}>
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
          {region &&
            photoCorners(region).map((p, i) => (
              <button
                type="button"
                key={i}
                className="scan-photo-corner"
                aria-label={ui('Fotoecke') + ' ' + (i + 1)}
                style={{ left: p.x * 100 + '%', top: p.y * 100 + '%' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  e.stopPropagation();
                  const b = e.currentTarget.parentElement!.getBoundingClientRect();
                  corner(i, (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onKeyDown={(e) => {
                  const delta = (
                    {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    } as Record<string, number[]>
                  )[e.key];
                  if (!delta) return;
                  e.preventDefault();
                  corner(
                    i,
                    p.x + delta[0] * (e.shiftKey ? 0.02 : 0.002),
                    p.y + delta[1] * (e.shiftKey ? 0.02 : 0.002),
                  );
                }}
              >
                {i + 1}
              </button>
            ))}
        </PageStage>
        {error && <p role="alert">{ui(error)}</p>}
        <div className="scan-photo-previews" aria-label={ui('Fotovorschau')}>
          {current.map((r, i) => (
            <button
              type="button"
              key={i}
              aria-pressed={i === active}
              aria-label={ui('Foto auswählen') + ' ' + (i + 1)}
              onClick={() => setSelected(i)}
            >
              <CropPreview canvas={canvas} region={r} />
              <span>
                {ui('Foto')} {i + 1}
                {r.uncertain ? ' · ' + ui('Prüfen') : ''}
              </span>
            </button>
          ))}
        </div>
        {region && (
          <div className="scan-photo-edit">
            <h3>
              {ui('Foto')} {active + 1}
            </h3>
            <p className="fine-note">
              {ui(
                'Die vier Ecken ziehen oder mit Pfeiltasten verschieben. Prozentwerte ermöglichen einen rechteckigen Zuschnitt. Drehung und Vorschau gelten nur für dieses Foto.',
              )}
            </p>
            {!validPhoto(region) && (
              <p role="alert">
                {ui(
                  'Die Fotoecken müssen innerhalb der Seite liegen und dürfen sich nicht kreuzen.',
                )}
              </p>
            )}
            <RectFields
              rect={region}
              onChange={(r) =>
                change({ x: r.x, y: r.y, w: r.w, h: r.h, rotation: region.rotation })
              }
            />
            <div className="advanced-actions">
              <Button
                variant="outline"
                onClick={() => change({ ...region, rotation: ((region.rotation || 0) + 90) % 360 })}
              >
                {ui('Foto um 90° drehen')}
              </Button>
              <Button
                variant="outline"
                onClick={() => update(current.filter((_, i) => i !== active))}
              >
                {ui('Ausschnitt entfernen')}
              </Button>
            </div>
          </div>
        )}
        <p>
          {count} {ui(' Ausschnitt(e) auf ')}
          {Object.values(regions).filter((r) => r.length).length} {ui(' von')} {source.pdf.numPages}{' '}
          {ui(' Seiten.')}
        </p>
        <Choice
          label={ui('Ausgabeformat')}
          value={format}
          onChange={(v) => {
            setFormat(v as ScanFormat);
            invalidate();
          }}
          items={[
            ['jpeg', 'JPG-Fotos'],
            ['png', 'PNG-Bilder'],
            ['combined-pdf', 'Alle Fotos in einer PDF'],
            ['pdf', 'Eine Bild-PDF je Ausschnitt'],
          ]}
        />
        <Choice
          label={ui('Auflösung')}
          value={String(dpi)}
          onChange={(v) => {
            setDpi(Number(v));
            invalidate();
          }}
          items={[
            ['150', '150 dpi · kleinere Dateien'],
            ['300', '300 dpi · höhere Qualität'],
          ]}
        />
        <p className="fine-note">
          {ui(
            'JPG und PNG werden als ZIP gespeichert. Bis zu 50 Seiten automatisch erkennen, 200 Fotos und 160 MB ausgeben. Die gerenderte Scan-Seite ist auf 4096 Pixel Kantenlänge und 16 Megapixel begrenzt; die tatsächliche Auflösung kann geringer sein. Weiße Fotoränder, starke Schatten und überlappende Fotos benötigen oft manuelle Korrekturen.',
          )}
        </p>
        <label className="advanced-tick">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          <span>{ui('Ich habe die Ausschnitte auf allen markierten Seiten geprüft.')}</span>
        </label>
        <Button
          disabled={
            busy ||
            !count ||
            count > 200 ||
            !reviewed ||
            Object.values(regions)
              .flat()
              .some((r) => !validPhoto(r))
          }
          onClick={() => run((ctx) => exportScanRegions(source, regions, format, dpi, ctx))}
        >
          {ui('Ausschnitte herunterladen')}
        </Button>
      </fieldset>
    </section>
  );
}
