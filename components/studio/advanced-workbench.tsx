'use client';
import { sourcePages } from '@/lib/pdf-engine';
import { ResultActions, ResultSummary, useResultName, useResultAuditGate } from './result-actions';
import { WorkspaceContext } from './workspace-context';
import { JobStatusIcon, resultScrollBehavior, useFreshResult } from './ui-feedback';
import { ui } from '@/lib/ui-language';

import { useLanguage, useTools } from '@/components/studio/appearance';

import { useCallback, useEffect, useRef, useState } from 'react';
import './evidence-workbench.css';
import './century-workbench.css';
import {
  FormResponsesPanel,
  ChronologyPanel,
  ArithmeticPanel,
  SanitizePanel,
  LayersPanel,
  MeasurePanel,
} from './century-panels';
import { ChevronLeft, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openSource, type Source, type JobResult } from '@/lib/pdf-engine';
import type { AdvancedTool, ExportFile, RunContext } from '@/lib/advanced-types';
import { Choice, PageStage, PageSelect } from './advanced-shared';
import { SplitSizePanel } from './expansion-panels';
import { RepairPanel, ReadingPanel, ScanSplitPanel } from './recovery-panels';
import { LocalAssistantPanel } from './local-assistant-panel';
import { FormHelperPanel, ReceiptsPanel } from './everyday-panels';
import { DocumentColorsPanel } from './document-colors-panel';
import { HeaderFooterPanel } from './header-footer-panel';
import { KlarSchiffPanel } from './klar-schiff-panel';
import { LargeDocumentPanel } from './large-document-panel';
import { NativePanel } from './native-panel';
import { ProPanel } from './pro-panels';
import { isProTool } from '@/lib/pro-tools';
import { WorkflowPanel } from './advanced-workflows';
import { RenamePanel, SplitPanel, TablePanel, RedactPanel } from './advanced-text-panels';
import { EnhancePanel, ComparePanel, BarcodePanel, CameraPanel } from './advanced-media-panels';
import {
  LinksPanel,
  AttachmentsPanel,
  CoverPanel,
  MailMergePanel,
} from './advanced-document-panels';
import {
  NumberComparePanel,
  CollectFieldsPanel,
  InvoiceEvidencePanel,
  PageGapsPanel,
  OcrReviewPanel,
  PseudonymPanel,
  AttachmentLinksPanel,
  BestScansPanel,
  ReconcilePanel,
  CommentExportPanel,
} from './evidence-panels';

export function AdvancedWorkbench({
  tool,
  sources,
  onBack,
  onAdd,
  onBusy,
  onUse,
  pending,
  initialFile,
}: {
  initialFile?: File | null;
  tool: AdvancedTool;
  sources: Source[];
  onBack: () => void;
  onAdd: () => void;
  onBusy: (busy: boolean) => void;
  onUse: (result: JobResult) => Promise<void>;
  pending: boolean;
}) {
  const { t } = useLanguage();
  const { tools } = useTools();
  const [sourceId, setSourceId] = useState(sources[0]?.id || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState({ percent: 0, label: '' }),
    [result, setResult] = useState<ExportFile | null>(null),
    [url, setUrl] = useState(''),
    [preview, setPreview] = useState<Source | null>(null),
    [page, setPage] = useState(0);
  const resultFresh = useFreshResult(result);
  const { onAuditState, auditBlocked } = useResultAuditGate(result);
  const [resultName, renameResult] = useResultName(result);
  const resultRef = useRef<HTMLElement>(null);
  const controller = useRef<AbortController | null>(null),
    info = tools.find((t) => t.id === tool)!,
    source = sources.find((s) => s.id === sourceId) || sources[0];
  const sourceIds = sources.map((s) => s.id).join(':');
  useEffect(() => {
    window.scrollTo(0, 0);
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    setResult(null);
    setError('');
  }, [source?.id, sourceIds, tool]);
  useEffect(() => {
    if (!result) {
      setUrl('');
      setPreview(null);
      return;
    }
    const frame = requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: resultScrollBehavior(), block: 'start' }),
    );
    const objectUrl = URL.createObjectURL(result.blob);
    setUrl(objectUrl);
    setPage(0);
    setPreview(null);
    let active = true,
      owned: Source | undefined;
    if (result.kind === 'pdf' && (result.pages || 0) <= 200 && result.blob.size <= 80 * 1024 * 1024)
      openSource(new File([result.blob], result.filename, { type: 'application/pdf' }))
        .then((s) => {
          owned = s;
          if (active) setPreview(s);
          else void s.pdf.loadingTask.destroy();
        })
        .catch(() => {});
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(objectUrl);
      if (owned) void owned.pdf.loadingTask.destroy();
    };
  }, [result]);
  const run = useCallback(async (job: (ctx: RunContext) => Promise<ExportFile | void>) => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setResult(null);
    setProgress({ percent: 0, label: 'Verarbeitung wird vorbereitet …' });
    try {
      const out = await job({ signal: abort.signal, report: setProgress, translate: ui });
      if (!abort.signal.aborted && out) setResult(out);
    } catch (e) {
      if (!abort.signal.aborted)
        setError((e as Error).message || 'Die Verarbeitung ist fehlgeschlagen.');
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }, []);
  const props = { source, sources, busy, run },
    newProps = { ...props, invalidate: () => setResult(null) },
    multi = (
      [
        'klar-schiff',
        'large-document',
        'receipts-a4',
        'local-assistant',
        'bates',
        'continuous-page',
        'linearize',
        'structured-export',
        'form-responses',
        'chronology',
        'batch',
        'workflows',
        'auto-rename',
        'field-collector',
        'page-gaps',
        'pseudonymize',
        'attachment-links',
        'comment-export',
      ] as string[]
    ).includes(tool);
  return (
    <main className="document-workbench advanced-workbench">
      <WorkspaceContext sources={sources} locked={busy} onAdd={onAdd} />
      <header className="workbench-header">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ChevronLeft size={17} />
          {t('Zurück zur Auswahl')}
        </Button>
        <div className="advanced-actions">
          <Button variant="outline" onClick={onAdd} disabled={busy}>
            <Plus size={16} />
            {t('Dateien hinzufügen')}
          </Button>
          <span className="device-tag">
            <ShieldCheck size={14} />
            {ui('LOKAL AUF DEINEM GERÄT')}
          </span>
        </div>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">{ui('MEHR MÖGLICHKEITEN FÜR DEINE DOKUMENTE')}</span>
          <h1>
            <info.icon />
            {ui(info.title)}
          </h1>
          <p>{ui(info.description)}</p>
        </div>
      </div>
      {pending && (
        <p className="workbench-notice">
          {ui(
            'Dieses Werkzeug verarbeitet die vollständigen geöffneten Dateien. Änderungen aus anderen Werkzeugen zuerst anwenden und als Arbeitsdokument übernehmen.',
          )}
        </p>
      )}
      {!multi && tool !== 'camera-scan' && source && (
        <fieldset disabled={busy} className="advanced-fields advanced-source">
          <Choice
            label={tool === 'visual-compare' ? ui('Erste Datei') : t('Dokument')}
            value={source.id}
            onChange={setSourceId}
            items={sources.map((s) => [s.id, s.name])}
            translateItems={false}
          />
        </fieldset>
      )}
      <fieldset
        disabled={busy}
        className="advanced-fields"
        onChangeCapture={() => setResult(null)}
        key={`${tool}-${multi ? 'all' : source?.id || 'camera'}-${sources.map((s) => s.id).join(':')}`}
      >
        {tool === 'large-document' ? (
          <LargeDocumentPanel busy={busy} run={run} initialFile={initialFile} />
        ) : tool === 'pdf-repair' ? (
          <RepairPanel source={source} busy={busy} run={run} initialFile={initialFile} />
        ) : tool === 'camera-scan' ? (
          <CameraPanel busy={busy} run={run} />
        ) : !source ? (
          <div className="advanced-empty">{ui('Bitte zuerst eine PDF öffnen.')}</div>
        ) : (
          <>
            {tool === 'document-colors' && <DocumentColorsPanel {...newProps} />}
            {tool === 'header-footer-cleanup' && <HeaderFooterPanel {...newProps} />}
            {tool === 'form-helper' && <FormHelperPanel {...newProps} />}
            {tool === 'receipts-a4' && <ReceiptsPanel {...newProps} />}
            {tool === 'klar-schiff' && <KlarSchiffPanel {...newProps} />}
            {tool === 'local-assistant' && <LocalAssistantPanel {...props} />}
            {tool === 'native-objects' && <NativePanel key={source.id} {...props} />}
            {isProTool(tool) && <ProPanel {...props} tool={tool} />}
            {tool === 'form-responses' && <FormResponsesPanel {...newProps} />}{' '}
            {tool === 'chronology' && <ChronologyPanel {...newProps} />}{' '}
            {tool === 'arithmetic-check' && <ArithmeticPanel {...newProps} />}{' '}
            {tool === 'pdf-sanitize' && <SanitizePanel {...newProps} />}{' '}
            {tool === 'pdf-layers' && <LayersPanel {...newProps} />}{' '}
            {tool === 'pdf-measure' && <MeasurePanel {...newProps} />}{' '}
            {tool === 'scan-split' && (
              <ScanSplitPanel {...props} invalidate={() => setResult(null)} />
            )}{' '}
            {(['pdf-markdown', 'pdf-html', 'pdf-epub'] as string[]).includes(tool) && (
              <ReadingPanel
                {...props}
                format={
                  tool === 'pdf-markdown' ? 'markdown' : tool === 'pdf-html' ? 'html' : 'epub'
                }
              />
            )}
            {tool === 'number-compare' && <NumberComparePanel {...props} />}{' '}
            {tool === 'field-collector' && <CollectFieldsPanel {...props} />}{' '}
            {tool === 'invoice-visual-check' && <InvoiceEvidencePanel {...props} />}{' '}
            {tool === 'page-gaps' && <PageGapsPanel {...props} />}{' '}
            {tool === 'ocr-review' && <OcrReviewPanel {...props} />}{' '}
            {tool === 'pseudonymize' && <PseudonymPanel {...props} />}{' '}
            {tool === 'attachment-links' && <AttachmentLinksPanel {...props} />}{' '}
            {tool === 'best-scans' && <BestScansPanel {...props} />}{' '}
            {tool === 'document-reconcile' && <ReconcilePanel {...props} />}{' '}
            {tool === 'comment-export' && <CommentExportPanel {...props} />}
            {(tool === 'batch' || tool === 'workflows') && (
              <WorkflowPanel {...props} batch={tool === 'batch'} />
            )}
            {tool === 'auto-rename' && <RenamePanel {...props} />}{' '}
            {tool === 'split-size' && <SplitSizePanel {...props} />}{' '}
            {tool === 'smart-split' && <SplitPanel {...props} />}{' '}
            {tool === 'table-export' && <TablePanel {...props} />}{' '}
            {tool === 'search-redact' && <RedactPanel {...props} />}{' '}
            {tool === 'visual-compare' && <ComparePanel {...props} />}{' '}
            {tool === 'scan-enhance' && <EnhancePanel {...props} />}{' '}
            {tool === 'qr-barcode' && <BarcodePanel {...props} />}{' '}
            {tool === 'link-editor' && <LinksPanel {...props} />}{' '}
            {tool === 'attachment-manager' && <AttachmentsPanel {...props} />}{' '}
            {tool === 'cover-toc' && <CoverPanel {...props} />}{' '}
            {tool === 'mail-merge' && <MailMergePanel {...props} />}
          </>
        )}
      </fieldset>
      {busy && (
        <div className="advanced-progress" role="status">
          <JobStatusIcon working size={18} />
          <span>{ui(progress.label)}</span>
          <progress max={100} value={progress.percent} />
          <Button variant="ghost" onClick={() => controller.current?.abort()}>
            {t('Abbrechen')}
          </Button>
        </div>
      )}
      {error && (
        <p className="error-box" role="alert">
          {ui(error)}
        </p>
      )}
      {result && (
        <section ref={resultRef} className="advanced-result" role="status">
          <div>
            <h2>
              <JobStatusIcon fresh={resultFresh} />
              {t('Dein Ergebnis ist bereit.')}
            </h2>
            <ResultSummary result={result} />
            {result.note && <p>{ui(result.note)}</p>}
            <div className="advanced-actions">
              <ResultActions
                onAuditState={onAuditState}
                auditSources={sources}
                auditPages={
                  tool !== 'klar-schiff' &&
                  tool !== 'large-document' &&
                  tool !== 'receipts-a4' &&
                  source &&
                  result.pages === source.pdf.numPages
                    ? sourcePages(source)
                    : undefined
                }
                auditTool={tool}
                result={result}
                url={url}
                filename={resultName}
                onRename={renameResult}
                fresh={resultFresh}
                label={t('Herunterladen')}
              />
              {result.kind === 'pdf' &&
                (result.pages || 0) <= 200 &&
                result.blob.size <= 80 * 1024 * 1024 && (
                  <Button
                    variant="outline"
                    disabled={busy || auditBlocked}
                    onClick={() =>
                      run(async () => {
                        await onUse({
                          ...result,
                          filename: resultName,
                          kind: 'pdf',
                          inputSize: sources.reduce((n, s) => n + s.size, 0),
                        });
                      })
                    }
                  >
                    {t('Ergebnis weiterbearbeiten')}
                  </Button>
                )}
            </div>
          </div>
          {preview && (
            <div className="advanced-result-preview">
              <PageSelect source={preview} page={page} onChange={setPage} />
              <PageStage source={preview} page={page} />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
