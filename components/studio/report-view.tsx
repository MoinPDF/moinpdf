'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useState } from 'react';
import { FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PdfReport } from '@/lib/pdf-report';
export function ReportView({ report }: { report: PdfReport }) {
  useLanguage();
  const [showSame, setShowSame] = useState(false),
    [limit, setLimit] = useState(100);
  const unchanged = (s: PdfReport['sections'][number]) =>
    s.status?.startsWith('Text gleich') && !s.status.includes('verschoben');
  const hasSame = report.sections.some(unchanged);
  const sections = showSame ? report.sections : report.sections.filter((s) => !unchanged(s));
  return (
    <div className="pdf-report">
      <div className="report-heading">
        <FileSearch size={24} />
        <h2>{ui(report.title)}</h2>
      </div>
      <p className="report-description">{ui(report.description)}</p>
      <div className="report-stats">
        {report.stats.map((stat) => (
          <div key={stat.label}>
            <strong>{ui(stat.value)}</strong>
            <span>{ui(stat.label)}</span>
          </div>
        ))}
      </div>
      {hasSame && (
        <label className="report-filter">
          <input
            type="checkbox"
            checked={showSame}
            onChange={(e) => {
              setShowSame(e.target.checked);
              setLimit(100);
            }}
          />
          {ui('Unveränderte Textblöcke ebenfalls anzeigen')}
        </label>
      )}
      {hasSame && !sections.length && (
        <p>
          {ui(
            'Keine Textänderungen in den auslesbaren Inhalten gefunden. Unveränderte Texte kannst du oben einblenden.',
          )}
        </p>
      )}
      <div className="report-sections">
        {sections.slice(0, limit).map((section, index) => (
          <details
            key={index}
            open={section.status ? !section.status.startsWith('Text gleich') : index === 0}
          >
            <summary>
              <span>{ui(section.title)}</span>
              {section.status && (
                <b
                  className={
                    section.status.startsWith('Text geändert')
                      ? 'changed'
                      : section.status.startsWith('Text gleich')
                        ? 'same'
                        : 'incomplete'
                  }
                >
                  {ui(section.status)}
                </b>
              )}
            </summary>
            {section.details && (
              <dl>
                {section.details.map((detail, i) => (
                  <div key={i}>
                    <dt>{ui(detail.label)}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {section.lines && (
              <div className="report-lines">
                {section.lines.map((line, i) => (
                  <div key={i} className={`report-line ${line.kind}`}>
                    <span
                      aria-label={
                        line.kind === 'added'
                          ? ui('Hinzugefügt')
                          : line.kind === 'removed'
                            ? ui('Entfernt')
                            : undefined
                      }
                    >
                      {line.kind === 'added'
                        ? '+'
                        : line.kind === 'removed'
                          ? '−'
                          : line.kind === 'note'
                            ? '!'
                            : ''}
                    </span>
                    <p>{line.kind === 'note' ? ui(line.text) : line.text}</p>
                  </div>
                ))}
              </div>
            )}
          </details>
        ))}
      </div>
      {sections.length > limit && (
        <Button variant="outline" onClick={() => setLimit((old) => old + 100)}>
          {ui(
            `Weitere ${Math.min(100, sections.length - limit)} Einträge anzeigen (${limit} von ${sections.length})`,
          )}
        </Button>
      )}
    </div>
  );
}
