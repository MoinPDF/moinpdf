'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Mark, Rect } from '@/lib/studio-engine';
import type { EditorPatch } from './editor-typography';
import { editorImagePreview } from '@/lib/editor-native';
import { editorImageCropBounds } from '@/lib/editor-model';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';

export function EditorImageTools({
  mark,
  source,
  page,
  disabled,
  onPatch,
}: {
  mark: Mark;
  source: Source;
  page: PageItem;
  disabled: boolean;
  onPatch: EditorPatch;
}) {
  useLanguage();
  const [preview, setPreview] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [crop, setCrop] = useState<Rect>(mark.nativeImage?.crop || { x: 0, y: 0, w: 1, h: 1 });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!mark.nativeImage) return null;
  async function show() {
    setBusy(true);
    setError('');
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    try {
      const url =
        mark.image ||
        (await editorImagePreview(source, page, mark.nativeImage!.index, ctrl.signal));
      if (!ctrl.signal.aborted) setPreview(url);
    } catch (e) {
      if (!ctrl.signal.aborted)
        setError(e instanceof Error ? e.message : 'Das Bild konnte nicht gelesen werden.');
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  return (
    <details className="editor-image-tools" open>
      <summary>{ui('Bild auf dieser Seite bearbeiten')}</summary>
      <p>
        {ui(
          'Am Rahmen verschieben und am Eckpunkt proportional skalieren. Änderungen bleiben rückgängig machbar.',
        )}
      </p>
      <label className="field">
        <span>{ui('Bild ersetzen')}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError('');
            setBusy(true);
            try {
              if (file.size > 20 * 1024 * 1024)
                throw new Error('Das Ersatzbild darf höchstens 20 MB groß sein.');
              const data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
                reader.readAsDataURL(file);
              });
              const image = new Image();
              image.src = data;
              await image.decode();
              if (image.naturalWidth * image.naturalHeight > 4000000)
                throw new Error('Das Ersatzbild darf höchstens 4 Megapixel haben.');
              const canvas = document.createElement('canvas');
              canvas.width = image.naturalWidth;
              canvas.height = image.naturalHeight;
              try {
                canvas.getContext('2d')!.drawImage(image, 0, 0);
                const png = canvas.toDataURL('image/png');
                setPreview(png);
                setCrop(mark.nativeImage?.crop || { x: 0, y: 0, w: 1, h: 1 });
                onPatch(mark.id, {
                  image: png,
                  nativeImage: { ...mark.nativeImage! },
                });
              } finally {
                canvas.width = canvas.height = 0;
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Das Bild konnte nicht gelesen werden.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => void show()}>
        {ui('Bildinhalt zum Zuschneiden anzeigen')}
      </Button>
      {preview && (
        <>
          <div className="editor-image-crop-preview">
            <img src={preview} alt={ui('Bildinhalt vor dem Zuschneiden')} />
            <span
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
            />
          </div>
          <div className="editor-geometry">
            {(['x', 'y', 'w', 'h'] as const).map((key) => (
              <label key={key} className="field">
                <span>{ui({ x: 'Links', y: 'Oben', w: 'Breite', h: 'Höhe' }[key])} %</span>
                <input
                  type="number"
                  aria-label={ui('Bildzuschnitt') + ' ' + key}
                  min={key === 'w' || key === 'h' ? 1 : 0}
                  max={100}
                  step={1}
                  value={Math.round(crop[key] * 100)}
                  onChange={(e) => {
                    const value = Number(e.target.value) / 100;
                    if (Number.isFinite(value) && value >= 0 && value <= 1)
                      setCrop((old) => ({ ...old, [key]: value }));
                  }}
                />
              </label>
            ))}
          </div>
          <p>
            {ui(
              'Der Ausschnitt behält seine Größe und Ausrichtung. Außerhalb liegende Bildpixel werden beim Export aus diesem Bildobjekt entfernt.',
            )}
          </p>
          <Button
            size="sm"
            disabled={
              disabled || crop.w <= 0 || crop.h <= 0 || crop.x + crop.w > 1 || crop.y + crop.h > 1
            }
            onClick={() => {
              try {
                const native = mark.nativeImage!,
                  before = editorImageCropBounds(native.rect, native.corners, native.crop),
                  after = editorImageCropBounds(native.rect, native.corners, crop),
                  scale = mark.w / before.w;
                const next = {
                  x: mark.x + (after.x - before.x) * scale,
                  y: mark.y + (after.y - before.y) * scale,
                  w: after.w * scale,
                  h: after.h * scale,
                };
                if (
                  next.x < 0 ||
                  next.y < 0 ||
                  next.x + next.w > 1.00001 ||
                  next.y + next.h > 1.00001
                )
                  throw new Error(
                    'Der Bildzuschnitt ragt über den Seitenrand. Bitte das Bild zuerst verschieben.',
                  );
                onPatch(mark.id, { ...next, nativeImage: { ...native, crop } });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Ungültiger Bildzuschnitt.');
              }
            }}
          >
            {ui('Bildzuschnitt übernehmen')}
          </Button>
        </>
      )}
      {error && <p role="alert">{ui(error)}</p>}
    </details>
  );
}
