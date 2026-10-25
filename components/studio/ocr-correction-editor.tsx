'use client';
import type { OcrResultPage } from '@/lib/ocr-document';
import { useLanguage } from './appearance';
export function OcrCorrectionEditor({
  pages,
  page,
  disabled,
  onChange,
}: {
  pages: OcrResultPage[];
  page: number;
  disabled: boolean;
  onChange: (pages: OcrResultPage[], text: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="ocr-correction-lines">
      <p>
        {t(
          'Erkannte Zeilen korrigieren. Sichtbarer Originaltext ist schreibgeschützt.',
          'Correct recognized lines. Visible original text is read-only.',
        )}
      </p>
      {pages[page]?.lines.map((line, index) => (
        <label key={index}>
          <span>
            {t('Zeile', 'Line')} {index + 1}
            {!line.editable ? ` · ${t('Originaltext', 'Original text')}` : ''}
          </span>
          <input
            value={line.text}
            maxLength={10000}
            readOnly={!line.editable}
            disabled={disabled}
            onChange={(event) => {
              const next = pages.map((p, i) =>
                i === page
                  ? {
                      ...p,
                      lines: p.lines.map((l, j) =>
                        j === index ? { ...l, text: event.target.value } : l,
                      ),
                    }
                  : p,
              );
              onChange(
                next,
                next
                  .map((p, i) => `— Seite ${i + 1} —\n\n${p.lines.map((l) => l.text).join('\n')}`)
                  .join('\n\n'),
              );
            }}
          />
        </label>
      ))}
    </div>
  );
}
