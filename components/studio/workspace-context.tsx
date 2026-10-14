'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, FilePlus2, FileText } from 'lucide-react';
import { headerPhotos, type HeaderPhoto } from '@/lib/header-photos';
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
  const [photo, setPhoto] = useState<HeaderPhoto>(headerPhotos[0]);
  useEffect(() => {
    try {
      const previous = sessionStorage.getItem('moinpdf-header-photo');
      setPhoto(headerPhotos.find((item) => item.src === previous) ?? headerPhotos[0]);
    } catch {
      // The workspace remains usable when browser storage is disabled.
    }
  }, []);
  if (!sources.length) return null;
  const count = pageCount ?? sources.reduce((sum, source) => sum + source.pdf.numPages, 0);
  const size = sources.reduce((sum, source) => sum + source.size, 0);
  return (
    <div className="workspace-context">
      <details className="workspace-harbor">
        <summary>
          <img src={photo.src} alt="" width={160} height={90} decoding="async" />
          <span className="workspace-ready-icon">
            <Check size={16} aria-hidden="true" />
          </span>
          <span>
            {sources.length === 1
              ? t('Dein Dokument ist bereit', 'Your document is ready')
              : t('Deine Dokumente sind bereit', 'Your documents are ready')}
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <img
          className="workspace-harbor-expanded"
          src={photo.src}
          alt={t(photo.de, photo.en)}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
        />
      </details>
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
          <span>
            {count} {count === 1 ? t('Seite', 'page') : t('Seiten', 'pages')} · {formatSize(size)}
          </span>
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
