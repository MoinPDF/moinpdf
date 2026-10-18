'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { PagePreview } from './canvas';
import type { Source } from '@/lib/pdf-engine';
import type { Rect } from '@/lib/studio-engine';
import type { ExportFile, RunContext } from '@/lib/advanced-types';
export type PanelProps = {
  source: Source;
  sources: Source[];
  busy: boolean;
  run: (job: (ctx: RunContext) => Promise<ExportFile | void>) => Promise<void>;
};
export const Field = ({ label, children }: { label: string; children: ReactNode }) => {
  useLanguage();
  return (
    <label className="advanced-field">
      <span>{ui(label)}</span>
      {children}
    </label>
  );
};
export const Text = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) => {
  useLanguage();
  return (
    <Field label={ui(label)}>
      <input
        aria-label={ui(label)}
        type={type}
        value={value}
        placeholder={ui(placeholder)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
};
export const NumberField = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) => {
  useLanguage();
  return (
    <Field label={ui(label)}>
      <input
        aria-label={ui(label)}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      />
    </Field>
  );
};
export const Choice = ({
  label,
  value,
  onChange,
  items,
  translateItems = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: [string, string][];
  translateItems?: boolean;
}) => {
  useLanguage();
  return (
    <Field label={ui(label)}>
      <select aria-label={ui(label)} value={value} onChange={(e) => onChange(e.target.value)}>
        {items.map(([v, text]) => (
          <option key={v} value={v}>
            {translateItems ? ui(text) : text}
          </option>
        ))}
      </select>
    </Field>
  );
};
export const Tick = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => {
  useLanguage();
  return (
    <label className="advanced-tick">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{ui(label)}</span>
    </label>
  );
};
export function PageSelect({
  source,
  page,
  onChange,
}: {
  source: Source;
  page: number;
  onChange: (n: number) => void;
}) {
  useLanguage();
  return (
    <Choice
      label={ui('Seite')}
      value={String(page)}
      onChange={(v) => onChange(Number(v))}
      items={Array.from({ length: source.pdf.numPages }, (_, i) => [String(i), `Seite ${i + 1}`])}
    />
  );
}
export function RectFields({ rect, onChange }: { rect: Rect; onChange: (r: Rect) => void }) {
  useLanguage();
  return (
    <div className="advanced-coordinates">
      {(['x', 'y', 'w', 'h'] as const).map((key, i) => (
        <NumberField
          key={key}
          label={['Links (%)', 'Oben (%)', 'Breite (%)', 'Höhe (%)'][i]}
          value={Math.round(rect[key] * 1000) / 10}
          min={key === 'w' || key === 'h' ? 1 : 0}
          step={0.5}
          onChange={(v) => onChange({ ...rect, [key]: v / 100 })}
        />
      ))}
    </div>
  );
}
export function PageStage({
  source,
  page = 0,
  rects = [],
  onRect,
  children,
}: {
  source: Source;
  page?: number;
  rects?: (Rect & { label?: string })[];
  onRect?: (r: Rect) => void;
  children?: ReactNode;
}) {
  useLanguage();
  const [aspect, setAspect] = useState('595 / 842');
  useEffect(() => {
    let active = true;
    source.pdf
      .getPage(page + 1)
      .then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (active) setAspect(`${v.width} / ${v.height}`);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [source, page]);
  const ref = useRef<HTMLDivElement>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    [drawing, setDrawing] = useState<Rect | null>(null);
  const point = (e: { clientX: number; clientY: number }) => {
    const b = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    };
  };
  const update = (e: { clientX: number; clientY: number }) => {
    const p = point(e),
      s = start.current!;
    return {
      x: Math.min(p.x, s.x),
      y: Math.min(p.y, s.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    };
  };
  return (
    <div className="advanced-stage">
      <div
        className={`advanced-paper ${onRect ? 'can-select' : ''}`}
        ref={ref}
        style={{ aspectRatio: aspect }}
        onPointerDown={(e) => {
          if (!onRect) return;
          e.preventDefault();
          start.current = point(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current) setDrawing(update(e));
        }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const r = update(e);
          start.current = null;
          setDrawing(null);
          if (r.w > 0.005 && r.h > 0.005) onRect?.(r);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrawing(null);
        }}
      >
        <PagePreview
          source={source}
          page={{
            id: `adv-${source.id}-${page}`,
            sourceId: source.id,
            index: page,
            rotation: 0,
            selected: true,
          }}
        />
        {[...rects, ...(drawing ? [drawing] : [])].map((r, i) => (
          <span
            key={i}
            className="advanced-rect"
            style={{
              left: r.x * 100 + '%',
              top: r.y * 100 + '%',
              width: r.w * 100 + '%',
              height: r.h * 100 + '%',
            }}
          >
            {'label' in r && typeof r.label === 'string' ? ui(r.label) : null}
          </span>
        ))}
        {children}
      </div>
      {onRect && (
        <p className="fine-note">
          {ui('Bereich auf der Seite aufziehen oder die Prozentwerte anpassen.')}
        </p>
      )}
    </div>
  );
}
export function EditTable({
  rows,
  onChange,
}: {
  rows: string[][];
  onChange: (r: string[][]) => void;
}) {
  useLanguage();
  const [offset, setOffset] = useState(0);
  const start = Math.min(offset, Math.max(0, Math.floor((rows.length - 1) / 50) * 50));
  const columns = Math.max(1, ...rows.map((r) => r.length));
  return (
    <div className="advanced-table-wrap">
      {rows.length > 50 && (
        <div className="advanced-actions">
          <Button variant="outline" disabled={!start} onClick={() => setOffset(start - 50)}>
            {ui('Zurück')}
          </Button>
          <span aria-live="polite">
            {start + 1}–{Math.min(start + 50, rows.length)} / {rows.length}
          </span>
          <Button
            variant="outline"
            disabled={start + 50 >= rows.length}
            onClick={() => setOffset(start + 50)}
          >
            {ui('Weiter')}
          </Button>
        </div>
      )}
      <table className="advanced-table">
        <tbody>
          {rows.slice(start, start + 50).map((row, index) => {
            const y = start + index;
            return (
              <tr key={y}>
                <th>{y + 1}</th>
                {Array.from({ length: columns }, (_, x) => (
                  <td key={x}>
                    <input
                      aria-label={ui(`Zeile ${y + 1}, Spalte ${x + 1}`)}
                      value={row[x] || ''}
                      onChange={(e) =>
                        onChange(
                          rows.map((r, i) =>
                            i === y
                              ? Array.from({ length: columns }, (_, j) =>
                                  j === x ? e.target.value : r[j] || '',
                                )
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={ui(`Zeile ${y + 1} löschen`)}
                    onClick={() => onChange(rows.filter((_, i) => i !== y))}
                  >
                    ×
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
