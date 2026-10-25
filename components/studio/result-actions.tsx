'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Share2, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from './appearance';
import { useWorkspaceResults } from './workspace-result-context';
import { Button } from '@/components/ui/button';
import { ResultNextSteps } from './result-next-steps';
import { useExportAudit } from './export-audit';
import type { Source, PageItem } from '@/lib/pdf-engine';
import {
  canShareResult,
  filenameParts,
  renameDownload,
  resultShareFile,
  resultSummary,
  type DownloadResult,
} from '@/lib/result-details';

// All download/adoption controls share the verification state of the exact Blob.
export function useResultAuditGate(result: DownloadResult | null) {
  const [state, setState] = useState<{ blob: Blob; blocked: boolean } | null>(null);
  const onAuditState = useCallback((blob: Blob, blocked: boolean) => {
    setState((previous) =>
      previous?.blob === blob && previous.blocked === blocked ? previous : { blob, blocked },
    );
  }, []);
  return { onAuditState, auditBlocked: !!result && (state?.blob !== result.blob || state.blocked) };
}

// Naming is independent of the output object: renaming must not reload its PDF
// preview, replay a success animation, or reset the selected preview page.
export function useResultName(result: DownloadResult | null) {
  const [edit, setEdit] = useState<{ blob: Blob; name: string } | null>(null);
  useEffect(() => setEdit(null), [result?.blob]);
  const name = result ? (edit?.blob === result.blob ? edit.name : result.filename) : '';
  const { remember } = useWorkspaceResults();
  useEffect(() => {
    if (result) remember({ ...result, filename: name });
  }, [result, name, remember]);
  const rename = (draft: string) => {
    if (result) setEdit({ blob: result.blob, name: renameDownload(draft, result.filename) });
  };
  return [name, rename] as const;
}

export function ResultSummary({
  result,
  compareSize = false,
}: {
  result: DownloadResult;
  compareSize?: boolean;
}) {
  const { language } = useLanguage();
  return <p className="export-summary">{resultSummary(result, language, compareSize)}</p>;
}

export function ResultShare({
  result,
  filename,
  disabled = false,
}: {
  result: DownloadResult;
  filename: string;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const file = useMemo(() => resultShareFile(result, filename), [result, filename]);
  const [supported, setSupported] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pending = useRef(false);
  useEffect(() => setSupported(canShareResult(file, navigator)), [file]);
  if (!supported) return null;
  return (
    <Button
      type="button"
      variant="outline"
      className="export-share"
      disabled={disabled || sharing}
      aria-label={t('Ergebnis teilen', 'Share result')}
      onClick={async () => {
        if (pending.current) return;
        pending.current = true;
        setSharing(true);
        try {
          // Call in the click gesture, before any asynchronous preparation.
          await navigator.share({ files: [file] });
        } catch (error) {
          if ((error as { name?: string } | null)?.name !== 'AbortError')
            toast.error(
              t(
                'Teilen ist gerade nicht möglich. Du kannst die Datei herunterladen.',
                'Sharing is currently unavailable. You can download the file instead.',
              ),
            );
        } finally {
          pending.current = false;
          setSharing(false);
        }
      }}
    >
      {sharing ? <LoaderCircle size={17} className="spin" /> : <Share2 size={17} />}
      <span>{t('Teilen', 'Share')}</span>
    </Button>
  );
}

export function ResultActions({
  result,
  url,
  filename,
  onRename,
  fresh = false,
  label,
  disabled = false,
  nextDisabled = disabled,
  auditSources,
  auditPages,
  auditTool,
  onAuditState,
}: {
  result: DownloadResult;
  url: string;
  filename: string;
  onRename: (name: string) => void;
  fresh?: boolean;
  label?: string;
  disabled?: boolean;
  nextDisabled?: boolean;
  auditSources?: Source[];
  auditPages?: PageItem[];
  auditTool?: string;
  onAuditState?: (blob: Blob, blocked: boolean) => void;
}) {
  const { t } = useLanguage();
  const audit = useExportAudit(result, auditSources, auditPages, auditTool);
  useEffect(
    () => onAuditState?.(result.blob, audit.blocked),
    [onAuditState, result.blob, audit.blocked],
  );
  disabled = disabled || audit.blocked;
  nextDisabled = nextDisabled || audit.blocked;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const nameButton = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const { stem, extension } = filenameParts(filename);
  useEffect(() => {
    setEditing(false);
  }, [result.blob]);
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);
  const save = () => {
    if (!cancelled.current) onRename(draft);
    setEditing(false);
  };
  return (
    <div className="export-actions">
      {audit.panel}
      <div className="export-filename">
        {editing ? (
          <div className="export-name-edit">
            <input
              ref={input}
              value={draft}
              maxLength={180}
              aria-label={t('Dateiname bearbeiten', 'Edit filename')}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={save}
              onKeyDown={(event) => {
                if (event.key === 'Escape' || event.key === 'Enter') {
                  event.preventDefault();
                  cancelled.current = event.key === 'Escape';
                  save();
                  requestAnimationFrame(() => nameButton.current?.focus({ preventScroll: true }));
                }
              }}
            />
            <span>{extension}</span>
          </div>
        ) : (
          <button
            ref={nameButton}
            className="export-name-button"
            type="button"
            disabled={disabled}
            title={t('Dateiname bearbeiten', 'Edit filename')}
            aria-label={`${t('Dateiname bearbeiten', 'Edit filename')}: ${filename}`}
            onClick={() => {
              cancelled.current = false;
              setDraft(stem);
              setEditing(true);
            }}
          >
            <span>{filename}</span>
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="export-buttons">
        <Button
          asChild
          className="result-download"
          data-fresh={fresh && !!url}
          disabled={disabled || !url}
        >
          <a
            href={!disabled && url ? url : undefined}
            download={editing ? renameDownload(draft, result.filename) : filename}
            aria-disabled={disabled || !url}
            onClick={(event) => {
              if (disabled || !url) event.preventDefault();
            }}
          >
            <Download size={17} aria-hidden="true" />
            {label ||
              (result.blob.type.includes('pdf')
                ? t('PDF herunterladen', 'Download PDF')
                : t('Herunterladen', 'Download'))}
          </a>
        </Button>
        <ResultShare
          result={result}
          filename={editing ? renameDownload(draft, result.filename) : filename}
          disabled={disabled}
        />
      </div>
      <ResultNextSteps result={{ ...result, filename }} disabled={nextDisabled} />
    </div>
  );
}
