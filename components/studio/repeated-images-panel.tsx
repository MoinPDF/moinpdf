'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { catalogueImages, replaceRepeatedImages } from '@/lib/native-pdf';
import type { ImageCatalogue } from '@/lib/repeated-images-native';
import { replacementImage } from '@/lib/replacement-image';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import { Choice, PageStage, type PanelProps } from './advanced-shared';
export function RepeatedImagesPanel({
  source,
  busy,
  run,
  invalidate,
}: PanelProps & { invalidate: () => void }) {
  useLanguage();
  const [catalogue, setCatalogue] = useState<ImageCatalogue>(),
    [hash, setHash] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(0),
    [file, setFile] = useState<File | null>(null),
    [reviewed, setReviewed] = useState(false);
  const groups = [...new Set(catalogue?.images.map((i) => i.hash) || [])],
    matches = catalogue?.images.filter((i) => i.hash === hash) || [];
  return (
    <section className="advanced-card repeated-images-panel">
      <h2>{ui('Wiederkehrende Logos austauschen')}</h2>
      <p>
        {ui(
          'Pixelgleiche Bildobjekte im Dokument finden. Fundstellen auswählen und gemeinsam durch ein neues Bild ersetzen. Text und übrige Seiten bleiben als PDF-Objekte erhalten.',
        )}
      </p>
      <fieldset disabled={busy}>
        <Button
          onClick={() =>
            run(async (ctx) => {
              const next = await catalogueImages(source.bytes, ctx.signal);
              ctx.signal.throwIfAborted();
              setCatalogue(next);
              setHash(next.images[0]?.hash || '');
              setSelected([]);
              setReviewed(false);
              invalidate();
              setPage(next.images[0]?.page || 0);
            })
          }
        >
          {ui('Wiederkehrende Bilder suchen')}
        </Button>
        {catalogue && (
          <p role="status">
            {catalogue.images.length} {ui('Bildobjekte gefunden')} · {catalogue.skipped}{' '}
            {ui('komplexe oder zu große Bildobjekte ausgelassen')}
          </p>
        )}
        {!!groups.length && (
          <Choice
            label={ui('Bildgruppe')}
            value={hash}
            onChange={(v) => {
              setHash(v);
              setSelected([]);
              setReviewed(false);
              invalidate();
              setPage(catalogue!.images.find((i) => i.hash === v)!.page);
            }}
            items={groups.map((h, i) => [
              h,
              `${ui('Bildgruppe')} ${i + 1} · ${catalogue!.images.filter((v) => v.hash === h).length} ${ui('Fundstellen')}`,
            ])}
            translateItems={false}
          />
        )}
        {!!matches.length && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(matches.map((m) => m.id));
                setReviewed(false);
                invalidate();
              }}
            >
              {ui('Alle Fundstellen dieser Bildgruppe auswählen')}
            </Button>
            <div className="intake-rule">
              {matches.map((item, i) => (
                <div className="advanced-actions" key={item.id}>
                  <label className="advanced-tick">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(e) => {
                        setSelected(
                          e.target.checked
                            ? [...selected, item.id]
                            : selected.filter((v) => v !== item.id),
                        );
                        setReviewed(false);
                        invalidate();
                      }}
                    />
                    <span>
                      {ui('Fundstelle')} {i + 1} · {ui('Seite')} {item.page + 1}
                    </span>
                  </label>
                  <Button variant="ghost" onClick={() => setPage(item.page)}>
                    {ui('Anzeigen')}
                  </Button>
                </div>
              ))}
            </div>
            <PageStage source={source} page={page}>
              {matches
                .filter((m) => m.page === page)
                .map((m) => (
                  <span
                    key={m.id}
                    className="scan-quality-region"
                    style={{
                      left: m.rect.x * 100 + '%',
                      top: m.rect.y * 100 + '%',
                      width: m.rect.w * 100 + '%',
                      height: m.rect.h * 100 + '%',
                    }}
                  />
                ))}
            </PageStage>
            <label className="advanced-field">
              <span>{ui('Ersatzbild (PNG, JPG, WebP)')}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setReviewed(false);
                  invalidate();
                }}
              />
            </label>
            <label className="advanced-tick">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => {
                  setReviewed(e.target.checked);
                  invalidate();
                }}
              />
              <span>{ui('Fundstellen und Ersatzbild geprüft')}</span>
            </label>
            <Button
              disabled={!selected.length || selected.length > 100 || !file || !reviewed}
              onClick={() =>
                run(async (ctx) => {
                  const image = await replacementImage(file!);
                  ctx.signal.throwIfAborted();
                  const bytes = await replaceRepeatedImages(
                    source.bytes,
                    matches.filter((m) => selected.includes(m.id)),
                    image,
                    ctx.signal,
                  );
                  return {
                    blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
                    filename: source.name.replace(/\.pdf$/i, '') + '-Logos.pdf',
                    kind: 'pdf',
                    pages: source.pdf.numPages,
                    note: ui(
                      'Ausgewählte Bildobjekte ersetzt. Bildflächen und Drehungen bleiben erhalten. Bitte das Ergebnis visuell prüfen; das Original bleibt unverändert.',
                    ),
                  };
                })
              }
            >
              {ui('Ausgewählte Logos ersetzen')}
            </Button>
          </>
        )}
        <p className="fine-note">
          {ui(
            'Bis zu 50 Seiten, 80 MB Eingang, 100 Ersetzungen und 160 MB Ausgabe. Analyse bis 1.000 Bildobjekte und insgesamt 48 Megapixel; Ersatzbild bis 4 Megapixel und 20 MB. Erfasst werden pixelgleiche Rasterbilder, keine Vektorlogos oder Logos innerhalb eines Seitenscans. Beschnittene und komplex transparente Objekte werden ausgelassen. Ein abweichendes Seitenverhältnis des Ersatzbildes wird in die vorhandene Fläche eingepasst und kann verzerren. Signierte PDFs und XFA werden abgewiesen.',
          )}
        </p>
      </fieldset>
    </section>
  );
}
