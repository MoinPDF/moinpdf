'use client';
import { uiLocale } from '@/lib/ui-language';

import { Check, ChevronDown, FilePlus2, FileText } from 'lucide-react';
import { formatSize, type Source } from '@/lib/pdf-engine';
import { useLanguage } from './appearance';
import { FileArrivalCheck } from './ui-feedback';

/** A read-only document summary: expanding it never changes the active files. */
export function WorkspaceContext({
  sources,
  pageCount,
  locked = false,
  onAdd,
}: {
  sources: Source[];
  pageCount?: number;
  locked?: boolean;
  onAdd?: () => void;
}) {
  const { t } = useLanguage();
  if (!sources.length) return null;
  const count = pageCount ?? sources.reduce((sum, source) => sum + source.pdf.numPages, 0);
  const size = sources.reduce((sum, source) => sum + source.size, 0);
  return (
    <div className="workspace-context">
      <section className="workspace-file-card" aria-label={t('Geöffnete Dateien', 'Open files')}>
        <span className="workspace-file-icon">
          <FileText size={26} aria-hidden="true" />
        </span>
        <div className="workspace-file-copy">
          {sources.length === 1 ? (
            <strong title={sources[0].name}>
              <span className="arrival-file-name">{sources[0].name}</span>
              <FileArrivalCheck file={sources[0]} />
            </strong>
          ) : (
            <details className="workspace-file-list">
              <summary>
                {sources.length} {t('Dateien', 'files')}
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <ul>
                {sources.map((source) => (
                  <li key={source.id}>
                    <span className="arrival-file-name">{source.name}</span>
                    <FileArrivalCheck file={source} />
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="workspace-file-meta">
            <span>
              {count} {count === 1 ? t('Seite', 'page') : t('Seiten', 'pages')} ·{' '}
              {formatSize(size, uiLocale())}
            </span>
            <span className="workspace-ready" role="status" aria-live="polite" aria-atomic="true">
              <span className="workspace-ready-icon">
                <Check size={12} aria-hidden="true" />
              </span>
              <span>
                {sources.length === 1
                  ? t('Dein Dokument ist bereit', 'Your document is ready')
                  : t('Deine Dokumente sind bereit', 'Your documents are ready')}
              </span>
            </span>
          </div>
        </div>
        {onAdd && (
          <button
            type="button"
            className="workspace-add-file"
            disabled={locked}
            onClick={onAdd}
            aria-label={t('Dateien hinzufügen', 'Add files')}
            title={t('Dateien hinzufügen', 'Add files')}
          >
            <FilePlus2 size={22} aria-hidden="true" />
          </button>
        )}
      </section>
    </div>
  );
}
