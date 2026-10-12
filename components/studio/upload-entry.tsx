'use client';
import { ui } from '@/lib/ui-language';

import { useLanguage } from '@/components/studio/appearance';

import { useId, type CSSProperties } from 'react';
import {
  File,
  FileText,
  Plus,
  Check,
  LoaderCircle,
  ScanLine,
  FileOutput,
  Mail,
  LayoutGrid,
} from 'lucide-react';
import { APP_VERSION } from '@/lib/version';
import './upload-entry.css';

export type ImportState = {
  phase: 'idle' | 'reading' | 'done';
  name: string;
  completed: number;
  total: number;
};

export function UploadEntry({
  dragOver,
  loading,
  state,
  onOpen,
  onCamera,
  onOffice,
  onEmail,
  onTools,
}: {
  dragOver: boolean;
  loading: boolean;
  state: ImportState;
  onOpen: () => void;
  onCamera?: () => void;
  onOffice?: () => void;
  onEmail?: () => void;
  onTools?: () => void;
}) {
  const { t } = useLanguage();
  const phase = state.phase === 'idle' && dragOver ? 'drag' : state.phase;
  const id = useId().replace(/:/g, '');
  const paperId = `${id}-paper`,
    edgeId = `${id}-edge`,
    scanId = `${id}-scan`,
    maskId = `${id}-mask`;
  return (
    <main className="upload-entry upload-entry-branded">
      <div className="upload-entry-focus">
        <div className="upload-brand">
          <img
            className="upload-entry-logo logo-light"
            src={`/branding/moinpdf-wordmark.svg?v=${APP_VERSION}`}
            width={680}
            height={170}
            alt={ui('MoinPDF')}
            draggable={false}
          />
          <img
            className="upload-entry-logo logo-dark"
            src={`/branding/moinpdf-wordmark-dark.svg?v=${APP_VERSION}`}
            width={680}
            height={170}
            alt={ui('MoinPDF')}
            draggable={false}
          />
          <p className="upload-tagline">{t('Papierkram. Läuft.')}</p>
        </div>
        <button
          className={`upload-field is-${phase}`}
          onClick={onOpen}
          disabled={loading}
          aria-label={t('PDF oder andere Datei auswählen')}
          aria-busy={loading}
        >
          <span className="upload-document-stage" aria-hidden="true">
            <span className="upload-document-float">
              <FileText
                className="upload-document-icon"
                size={288}
                strokeWidth={0.17}
                style={
                  {
                    '--paper-fill': `url(#${paperId})`,
                    '--paper-edge': `url(#${edgeId})`,
                  } as CSSProperties
                }
              >
                <defs>
                  <linearGradient id={paperId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--paper-top, #f7fffd)" />
                    <stop offset="45%" stopColor="var(--paper-middle, #def4ee)" />
                    <stop offset="100%" stopColor="var(--paper-bottom, #d7edb1)" />
                  </linearGradient>
                  <linearGradient id={edgeId} x1="0%" y1="0%" x2="100%" y2="90%">
                    <stop offset="0%" stopColor="#68c2c2" />
                    <stop offset="48%" stopColor="#059a98" />
                    <stop offset="100%" stopColor="#94d33e" />
                  </linearGradient>
                  <linearGradient id={scanId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#68c2c2" stopOpacity="0" />
                    <stop offset="75%" stopColor="#68c2c2" stopOpacity=".13" />
                    <stop offset="96%" stopColor="#ffffff" stopOpacity=".65" />
                    <stop offset="100%" stopColor="#059a98" stopOpacity=".28" />
                  </linearGradient>
                  <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
                    <File size={24} stroke="none" fill="white" />
                  </mask>
                </defs>
                <g mask={`url(#${maskId})`} stroke="none">
                  <rect
                    className="upload-document-scan"
                    x="0"
                    y="-8"
                    width="24"
                    height="8"
                    fill={`url(#${scanId})`}
                  />
                </g>
              </FileText>
              <span className="upload-document-badge">
                {state.phase === 'done' ? (
                  <Check size={24} strokeWidth={1.8} />
                ) : state.phase === 'reading' ? (
                  <LoaderCircle size={23} strokeWidth={1.6} />
                ) : (
                  <Plus size={26} strokeWidth={1.6} />
                )}
              </span>
            </span>
          </span>
          <span className="upload-field-inner">
            <span className="upload-title" role="heading" aria-level={1}>
              {state.phase === 'done'
                ? t('Alles bereit.')
                : state.phase === 'reading'
                  ? t('Wird geöffnet …')
                  : dragOver
                    ? t('Hier loslassen.')
                    : t('Datei hier ablegen.')}
            </span>
            <span className="upload-description">
              {state.phase === 'done'
                ? `${state.completed} ${state.completed === 1 ? t('Datei geöffnet') : t('Dateien geöffnet')}`
                : state.phase === 'reading'
                  ? state.name
                  : dragOver
                    ? t('Eine oder mehrere Dateien')
                    : t('oder antippen · PDF, Office, Bilder & E-Mails')}
            </span>
            {loading && (
              <span
                className="upload-progress"
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
          </span>
        </button>
      </div>
      <div className="upload-alternatives">
        <button type="button" className="upload-shortcut" disabled={loading} onClick={onCamera}>
          <ScanLine size={14} strokeWidth={1.7} aria-hidden="true" focusable="false" />
          <span>{t('Kamera-Scanner')}</span>
        </button>
        <button type="button" className="upload-shortcut" disabled={loading} onClick={onOffice}>
          <FileOutput size={14} strokeWidth={1.7} aria-hidden="true" focusable="false" />
          <span>{t('Office zu PDF')}</span>
        </button>
        <button type="button" className="upload-shortcut" disabled={loading} onClick={onEmail}>
          <Mail size={14} strokeWidth={1.7} aria-hidden="true" focusable="false" />
          <span>{t('E-Mails zu PDF')}</span>
        </button>
        <button
          type="button"
          className="upload-shortcut upload-shortcut--all"
          disabled={loading}
          onClick={onTools}
        >
          <LayoutGrid size={14} strokeWidth={1.7} aria-hidden="true" focusable="false" />
          <span>{t('Alle Werkzeuge')}</span>
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {loading
          ? `${state.completed} ${t('von', 'of')} ${state.total} ${t('Dateien verarbeitet', 'files processed')}`
          : ''}
      </span>
    </main>
  );
}
