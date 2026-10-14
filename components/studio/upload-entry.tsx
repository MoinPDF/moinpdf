'use client';

import {
  ArrowRight,
  Check,
  FileOutput,
  FileUp,
  FolderOpen,
  LoaderCircle,
  Mail,
  ScanLine,
} from 'lucide-react';
import { useLanguage } from './appearance';
import { HomeTools } from './home-tools';
import { HarborPhoto } from './harbor-photo';
import type { WorkspaceTool } from '@/lib/tool-catalog';
import { fileDropLabel } from '@/lib/interaction-feedback';

export type ImportState = {
  phase: 'idle' | 'reading' | 'done';
  name: string;
  completed: number;
  total: number;
};

export function UploadEntry({
  dragOver,
  dragFileCount = null,
  loading,
  state,
  onOpen,
  onCamera,
  onOffice,
  onEmail,
  onTools,
  onChoose,
  fileCount = 0,
}: {
  dragOver: boolean;
  dragFileCount?: number | null;
  loading: boolean;
  state: ImportState;
  onOpen: () => void;
  onCamera?: () => void;
  onOffice?: () => void;
  onEmail?: () => void;
  onTools: () => void;
  onChoose: (id: WorkspaceTool) => void;
  fileCount?: number;
}) {
  const { t, language } = useLanguage();
  const phase = state.phase === 'idle' && dragOver ? 'drag' : state.phase;
  return (
    <main className="upload-entry harbor-home">
      <h1 className="sr-only">MoinPDF</h1>
      <section className="harbor-welcome" aria-label={t('Dateien öffnen')}>
        <HarborPhoto />
        <button
          type="button"
          className={`harbor-upload is-${phase}`}
          data-harbor-light
          onClick={onOpen}
          disabled={loading}
          aria-label={t('PDF oder andere Datei auswählen')}
          aria-busy={loading}
        >
          <span className="harbor-upload-icon" aria-hidden="true">
            {state.phase === 'done' ? (
              <Check size={38} />
            ) : state.phase === 'reading' ? (
              <LoaderCircle className="spin" size={38} />
            ) : (
              <FileUp size={38} strokeWidth={1.5} />
            )}
          </span>
          <span className="harbor-upload-title">
            {state.phase === 'done'
              ? t('Alles bereit.')
              : state.phase === 'reading'
                ? t('Wird geöffnet …')
                : dragOver
                  ? fileDropLabel(dragFileCount, language)
                  : t('Datei hier ablegen.')}
          </span>
          <span className="harbor-upload-cta" data-harbor-light-surface>
            <FolderOpen size={20} aria-hidden="true" />
            {t('Dateien auswählen', 'Choose files')}
          </span>
          <span className="harbor-upload-description">
            {state.phase === 'reading'
              ? state.name
              : state.phase === 'done'
                ? `${state.completed} ${t(state.completed === 1 ? 'Datei geöffnet' : 'Dateien geöffnet')}`
                : t('PDF, Office, Bilder & E-Mails', 'PDF, Office, images & emails')}
          </span>
          {loading && (
            <span
              className="harbor-upload-progress"
              role="progressbar"
              aria-label={t('Dateien öffnen')}
              aria-valuenow={state.completed}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, state.total)}
            >
              <span
                style={{ width: `${state.total ? (state.completed / state.total) * 100 : 0}%` }}
              />
            </span>
          )}
        </button>
        <div className="upload-alternatives">
          <button type="button" className="upload-shortcut" disabled={loading} onClick={onCamera}>
            <ScanLine size={15} aria-hidden="true" />
            <span>{t('Kamera-Scanner')}</span>
          </button>
          <button type="button" className="upload-shortcut" disabled={loading} onClick={onOffice}>
            <FileOutput size={15} aria-hidden="true" />
            <span>{t('Office zu PDF')}</span>
          </button>
          <button type="button" className="upload-shortcut" disabled={loading} onClick={onEmail}>
            <Mail size={15} aria-hidden="true" />
            <span>{t('E-Mails zu PDF')}</span>
          </button>
        </div>
      </section>
      {fileCount > 0 && (
        <button type="button" className="harbor-resume" disabled={loading} onClick={onTools}>
          <FolderOpen size={18} aria-hidden="true" />
          <span>
            {t('Arbeitsbereich fortsetzen', 'Continue workspace')}
            <small>
              {fileCount} {t(fileCount === 1 ? 'Datei' : 'Dateien')}
            </small>
          </span>
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      )}
      <HomeTools locked={loading} onChoose={onChoose} onTools={onTools} />
      <span className="sr-only" role="status" aria-live="polite">
        {loading
          ? `${state.completed} ${t('von', 'of')} ${state.total} ${t('Dateien verarbeitet', 'files processed')}`
          : dragOver
            ? fileDropLabel(dragFileCount, language)
            : ''}
      </span>
    </main>
  );
}
