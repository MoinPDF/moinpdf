'use client';
import { ArrowRight, FileText, FolderOpen, Minimize2, PenLine } from 'lucide-react';
import type { DownloadResult } from '@/lib/result-details';
import { useLanguage } from './appearance';

export function ResultNextSteps({
  result,
  disabled,
}: {
  result: DownloadResult;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  if (!result.blob.type.includes('pdf')) return null;
  const next = (tool: string) =>
    window.dispatchEvent(new CustomEvent('moinpdf-continue-result', { detail: { result, tool } }));
  return (
    <section className="result-next-steps" aria-label={t('Nächster Schritt', 'Next step')}>
      <span>{t('Wie möchtest du weiterarbeiten?', 'What would you like to do next?')}</span>
      <div>
        <button type="button" disabled={disabled} onClick={() => next('edit-text')}>
          <PenLine size={16} />
          {t('Text bearbeiten', 'Edit text')}
          <ArrowRight size={14} />
        </button>
        <button type="button" disabled={disabled} onClick={() => next('pdf-word')}>
          <FileText size={16} />
          {t('Als Word exportieren', 'Export to Word')}
        </button>
        <button type="button" disabled={disabled} onClick={() => next('compress')}>
          <Minimize2 size={16} />
          {t('PDF komprimieren', 'Compress PDF')}
        </button>
        <button type="button" disabled={disabled} onClick={() => next('project')}>
          <FolderOpen size={16} />
          {t('Projekt sichern', 'Save project')}
        </button>
      </div>
      <small>
        {t(
          'PDF herunterladen speichert die fertige Datei. Ein Projekt enthält auch Originale und Bearbeitungsverlauf.',
          'Downloading saves the finished PDF. A project also includes originals and editing history.',
        )}
      </small>
    </section>
  );
}
