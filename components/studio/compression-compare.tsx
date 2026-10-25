'use client';
import { useState, useRef } from 'react';
import { PagePreview } from './canvas';
import { useLanguage } from './appearance';
import type { Source, PageItem } from '@/lib/pdf-engine';
export function CompressionCompare({
  source,
  page,
  result,
  index,
}: {
  source: Source;
  page: PageItem;
  result: Source;
  index: number;
}) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(100);
  const holders = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <section
      className="compression-compare"
      aria-label={t('Original und Ergebnis vergleichen', 'Compare original and result')}
    >
      <label>
        {t('Gemeinsamer Zoom', 'Shared zoom')}{' '}
        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
          {[100, 200, 300].map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
        </select>
      </label>
      <div className="compression-compare-grid">
        {[source, result].map((s, i) => (
          <div key={i}>
            <strong>{i ? t('Ergebnis', 'Result') : t('Original', 'Original')}</strong>
            <div
              className="compression-compare-scroll"
              ref={(el) => {
                holders.current[i] = el;
              }}
              onScroll={(e) => {
                const other = holders.current[1 - i];
                if (other) {
                  other.scrollLeft = e.currentTarget.scrollLeft;
                  other.scrollTop = e.currentTarget.scrollTop;
                }
              }}
            >
              <div style={{ width: `${zoom}%` }}>
                <PagePreview
                  source={s}
                  page={i ? { ...page, sourceId: result.id, index, rotation: 0 } : page}
                  resolution={zoom * 10}
                  lossless
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
