'use client';
import { convertOfficeLocally, browserOfficeUnavailable } from '@/lib/browser-office';
import { signLocally } from '@/lib/local-signature';
import { ui } from '@/lib/ui-language';

import { useLanguage, useTools } from '@/components/studio/appearance';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Check,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type WorkspaceTool } from '@/lib/tool-catalog';
import { openSource, formatSize, MAX_BYTES, type Source, type JobResult } from '@/lib/pdf-engine';
import type { ServerTool, ExportFile } from '@/lib/advanced-types';
import {
  serverCapabilities,
  runServerJob,
  serverCapabilityKey,
  integratedDocumentServer,
  type ServerCapabilities,
} from '@/lib/document-server';
import {
  ServerExtraFields,
  StructuredReport,
  initialExtraSettings,
  extraActions,
} from './server-extra-fields';
import { Text, Choice, Tick, PageStage, PageSelect } from './advanced-shared';
import './conversion-workbench.css';
import { AudioWorkbench } from './audio-workbench';
import { AccessibleEditor, initialAccessibleDocument } from './accessible-editor';
import { validateAccessibleDocument } from '@/lib/accessible-document';
import { TagRepairEditor, tagRepairRequest, type TagRepair } from './tag-repair-editor';

type Props = {
  tool: ServerTool;
  sources: Source[];
  initialFile?: File | null;
  onBack: () => void;
  onAdd: () => void;
  onBusy: (busy: boolean) => void;
  onUse: (result: JobResult) => Promise<void>;
  onChoose: (tool: WorkspaceTool) => void;
};

export function ServerWorkbench(props: Props) {
  useLanguage();
  return props.tool === 'pdf-audio' ? (
    <AudioWorkbench {...props} />
  ) : (
    <StandardServerWorkbench {...props} />
  );
}
function StandardServerWorkbench({
  tool,
  sources,
  initialFile,
  onBack,
  onAdd,
  onBusy,
  onUse,
  onChoose,
}: Props) {
  const { t } = useLanguage();
  const { tools } = useTools();
  const [processing, setProcessing] = useState('local');
  const [mode, setMode] = useState(tool === 'certificate-sign' ? 'validate' : 'create');
  const [progress, setProgress] = useState('');
  const localOffice = tool === 'office-pdf' && processing === 'local';
  const localCertificate = tool === 'certificate-sign' && mode === 'sign' && processing === 'local';
  const localWord = !integratedDocumentServer && tool === 'pdf-word';
  const localOptimize = processing === 'local' && tool === 'optimize-pdf',
    localMode = localWord || localOptimize || localOffice || localCertificate;
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>(
    localMode ? 'ready' : 'checking',
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [sourceId, setSourceId] = useState(sources[0]?.id || ''),
    [file, setFile] = useState<File | null>(initialFile || null);
  const [cert, setCert] = useState<File | null>(null),
    [password, setPassword] = useState('');
  const [profile, setProfile] = useState(tool === 'zugferd-create' ? 'E' : '2b');
  const [uaMode, setUaMode] = useState('basic'),
    [uaProfile, setUaProfile] = useState('ua1'),
    [uaDocument, setUaDocument] = useState(initialAccessibleDocument);
  const [signLevel, setSignLevel] = useState('basic');
  const [tagRepair, setTagRepair] = useState<TagRepair | null>(null);
  useEffect(() => setTagRepair(null), [sourceId, sources]);
  const [extra, setExtra] = useState(initialExtraSettings),
    [spreadsheet, setSpreadsheet] = useState<File | null>(null),
    [attachments, setAttachments] = useState(false);
  const [result, setResult] = useState<ExportFile | null>(null),
    [report, setReport] = useState(''),
    [url, setUrl] = useState(''),
    [preview, setPreview] = useState<Source | null>(null),
    [page, setPage] = useState(0);
  const resultRef = useRef<HTMLElement>(null),
    controller = useRef<AbortController | null>(null),
    connection = useRef<AbortController | null>(null);
  const previousSources = useRef(sources.map((value) => value.id));
  const info = tools.find((t) => t.id === tool)!,
    source = sources.find((s) => s.id === sourceId) || sources[0];
  const available =
    localMode ||
    capabilities?.capabilities[
      tool === 'accessibility-check' && uaMode !== 'basic'
        ? uaMode === 'create'
          ? 'pdfuaCreate'
          : uaMode === 'repair'
            ? 'pdfuaRepair'
            : 'pdfuaValidate'
        : serverCapabilityKey[tool]
    ] === true;
  const fileInputTool = [
    'office-pdf',
    'email-pdf',
    'html-pdf',
    'word-mail-merge',
    'ebook-pdf',
  ].includes(tool);
  const hasInput =
    tool === 'accessibility-check' && uaMode === 'create'
      ? true
      : fileInputTool
        ? !!file
        : tool === 'xrechnung-validate'
          ? !!(file || source?.invoiceOriginal)
          : !!source;
  const completeInput =
    hasInput &&
    (tool !== 'accessibility-check' || uaMode !== 'repair' || !!tagRepair) &&
    (tool !== 'word-mail-merge' || !!spreadsheet) &&
    (tool !== 'zugferd-create' || mode !== 'create' || !!file) &&
    (tool !== 'certificate-sign' || mode !== 'sign' || !!cert);

  const checkConnection = useCallback(async () => {
    if (localMode) {
      setStatus('ready');
      return;
    }
    if (!integratedDocumentServer) {
      setStatus(localMode ? 'ready' : 'unavailable');
      return;
    }
    connection.current?.abort();
    const abort = new AbortController();
    connection.current = abort;
    setStatus('checking');
    try {
      const value = await serverCapabilities(integratedDocumentServer, '', abort.signal);
      if (!abort.signal.aborted) {
        setCapabilities(value);
        setStatus('ready');
      }
    } catch {
      if (!abort.signal.aborted) {
        setCapabilities(null);
        setStatus('unavailable');
      }
    }
  }, [localMode]);
  useEffect(() => {
    void checkConnection();
    return () => {
      connection.current?.abort();
      controller.current?.abort();
    };
  }, [checkConnection]);
  useEffect(() => {
    if (tool !== 'translate-pdf' || capabilities?.translationStatus !== 'starting') return;
    const timer = setInterval(() => void checkConnection(), 15000);
    return () => clearInterval(timer);
  }, [tool, capabilities?.translationStatus, checkConnection]);
  useEffect(() => {
    const added = sources.filter((value) => !previousSources.current.includes(value.id));
    if (added.length) setSourceId(added[added.length - 1].id);
    previousSources.current = sources.map((value) => value.id);
  }, [sources]);
  useEffect(() => {
    if (initialFile) setFile(initialFile);
  }, [initialFile]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    setResult(null);
    setReport('');
    setError('');
  }, [
    tool,
    sourceId,
    file,
    mode,
    profile,
    processing,
    attachments,
    extra,
    spreadsheet,
    uaMode,
    uaProfile,
    uaDocument,
    tagRepair,
    signLevel,
  ]);
  useEffect(() => {
    if (!result) {
      setUrl('');
      setPreview(null);
      return;
    }
    const frame = requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
    const objectUrl = URL.createObjectURL(result.blob);
    setUrl(objectUrl);
    setPage(0);
    let active = true,
      owned: Source | undefined;
    if (result.kind === 'pdf')
      openSource(new File([result.blob], result.filename, { type: 'application/pdf' }))
        .then((value) => {
          owned = value;
          if (active) setPreview(value);
          else void value.pdf.loadingTask.destroy();
        })
        .catch(() => {});
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(objectUrl);
      if (owned) void owned.pdf.loadingTask.destroy();
    };
  }, [result]);

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      await action(abort.signal);
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  const pick = (
    label: string,
    accept: string,
    current: File | null,
    onChange: (value: File | null) => void,
  ) => (
    <div className="conversion-file-field">
      <p>{ui(label)}</p>
      <label className="conversion-file-picker">
        <FileText size={23} />
        <span>
          {current ? (
            <>
              <strong>{current.name}</strong>
              <small>
                {formatSize(current.size)} {ui(' · Datei ändern')}
              </small>
            </>
          ) : (
            <strong>{ui('Datei auswählen')}</strong>
          )}
        </span>
        <input
          className="sr-only"
          aria-label={ui(label)}
          type="file"
          accept={accept}
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (!next) return;
            if (next.size > MAX_BYTES) {
              setError('Bitte eine Datei mit höchstens 80 MB auswählen.');
              return;
            }
            setResult(null);
            onChange(next);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );

  async function process(signal: AbortSignal) {
    setResult(null);
    setReport('');
    if (localOffice) {
      if (!file) throw new Error('Bitte zuerst eine Datei auswählen.');
      const out = await convertOfficeLocally(file, signal, setProgress);
      if (!signal.aborted) setResult(out);
      return;
    }
    if (localCertificate) {
      if (!source || !cert) throw new Error('Bitte PDF und Zertifikatsdatei auswählen.');
      let p12: Uint8Array | undefined;
      try {
        if (cert.size > 5 * 1024 * 1024)
          throw new Error('Das Zertifikat darf höchstens 5 MB groß sein.');
        p12 = new Uint8Array(await cert.arrayBuffer());
        const bytes = await signLocally(source.bytes, p12, password, signal);
        if (!signal.aborted)
          setResult({
            blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
            filename: source.name.replace(/\.pdf$/i, '') + '-signiert.pdf',
            kind: 'pdf',
            pages: source.pdf.numPages,
            note: 'Lokal mit Zertifikat signiert. Ohne Zeitstempel oder Bestätigung der Zertifikatsvertrauenskette.',
          });
      } finally {
        p12?.fill(0);
        setPassword('');
        setCert(null);
      }
      return;
    }
    if (localOptimize) {
      if (!source) throw new Error('Bitte zuerst eine PDF auswählen.');
      const { optimizeBrowser } = await import('@/lib/pdf-recovery');
      const out = await optimizeBrowser(source, extra.targetMB, extra.optimizeMode === 'images', {
        signal,
        report: () => {},
      });
      if (!signal.aborted) setResult(out);
      return;
    }
    if (localWord) {
      if (!source) throw new Error('Bitte zuerst eine PDF auswählen.');
      const { createTextWordFile } = await import('@/lib/word-export');
      const out = await createTextWordFile(source, signal);
      if (!signal.aborted) setResult(out);
      return;
    }
    if (!integratedDocumentServer)
      throw new Error('Diese Funktion ist in dieser Ausgabe von MoinPDF nicht verfügbar.');
    const body = new FormData();
    let path = '';
    if (tool === 'accessibility-check' && uaMode === 'create') {
      body.append(
        'request',
        new Blob([JSON.stringify(validateAccessibleDocument(uaDocument))], {
          type: 'application/json',
        }),
        'struktur.json',
      );
      path = '/v1/pdfua/create';
    } else if (fileInputTool) {
      if (!file) throw new Error('Bitte zuerst eine Datei auswählen.');
      body.append('file', file);
      if (tool === 'office-pdf') path = '/v1/office';
      if (tool === 'email-pdf') {
        path = '/v1/email';
        body.append('include_attachments', String(attachments));
      }
      if (tool === 'html-pdf') path = '/v1/documents/html';
      if (tool === 'ebook-pdf') {
        path = '/v1/documents/ebook';
        body.append('options', JSON.stringify(extra));
      }
      if (tool === 'word-mail-merge') {
        if (!spreadsheet) throw new Error('Bitte eine Excel-Tabelle auswählen.');
        body.append('spreadsheet', spreadsheet);
        path = '/v1/word-merge';
      }
    } else if (tool === 'xrechnung-validate') {
      const xml =
        file ||
        (source?.invoiceOriginal
          ? new File([new Uint8Array(source.invoiceOriginal.bytes)], source.invoiceOriginal.name, {
              type: 'application/xml',
            })
          : null);
      if (!xml) throw new Error('Bitte Rechnungs-XML auswählen.');
      body.append('file', xml);
      path = '/v1/xrechnung/validate';
    } else {
      if (!source) throw new Error('Bitte zuerst eine PDF auswählen.');
      body.append(
        'file',
        new Blob([new Uint8Array(source.bytes)], { type: 'application/pdf' }),
        source.name,
      );
      if (tool === 'pdf-word') path = '/v1/pdf-to-word';
      else if (tool === 'accessibility-check' && uaMode === 'validate') {
        path = '/v1/pdfua/validate';
        body.append('profile', uaProfile);
      } else if (tool === 'accessibility-check' && uaMode === 'repair') {
        if (!tagRepair) throw new Error('Bitte zuerst den Strukturbaum laden und bearbeiten.');
        path = '/v1/pdfua/repair';
        body.append('changes', JSON.stringify(tagRepairRequest(tagRepair)));
        body.append('profile', uaProfile);
      } else if (extraActions[tool]) {
        path = '/v1/documents/' + extraActions[tool];
        body.append('options', JSON.stringify(extra));
      } else if (tool === 'pdfa') {
        body.append('profile', profile);
        path = `/v1/pdfa/${mode}`;
      } else if (tool === 'zugferd-create') {
        path = `/v1/zugferd/${mode}`;
        body.append('profile', profile);
        if (mode === 'create') {
          if (!file) throw new Error('Bitte die passende Rechnungs-XML auswählen.');
          body.append('invoice', file);
        }
      } else if (tool === 'certificate-sign') {
        path = `/v1/signatures/${mode}`;
        if (mode === 'sign') {
          if (!cert) throw new Error('Bitte eine Zertifikatsdatei auswählen.');
          body.append('certificate', cert);
          body.append('password', password);
          body.append('level', signLevel);
        }
      }
    }
    const limit = capabilities?.limits?.maxBytes || MAX_BYTES;
    for (const value of body.values())
      if (value instanceof Blob && value.size > limit)
        throw new Error(
          `Diese Datei ist zu groß. Erlaubt sind höchstens ${formatSize(limit)} pro Datei.`,
        );
    try {
      const out = await runServerJob(integratedDocumentServer, '', path, body, signal);
      if (signal.aborted) return;
      setResult(out);
      if (out.blob.type.includes('json'))
        setReport(JSON.stringify(JSON.parse(await out.blob.text()), null, 2));
    } finally {
      setPassword('');
    }
  }

  return (
    <main className="document-workbench advanced-workbench conversion-workbench">
      <header className="workbench-header">
        <Button variant="ghost" disabled={busy} onClick={onBack}>
          <ChevronLeft size={17} />
          {t('Alle Werkzeuge')}
        </Button>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">{ui('DATEI REIN. ERGEBNIS RAUS.')}</span>
          <h1>
            <info.icon />
            {ui(info.title)}
          </h1>
          <p>{ui(info.description)}</p>
        </div>
      </div>
      <ol className="conversion-steps" aria-label={ui('Arbeitsschritte')}>
        <li className={hasInput ? 'is-complete' : 'is-current'}>
          <span>{hasInput ? <Check size={14} /> : 1}</span>
          {tool === 'accessibility-check' && uaMode === 'create'
            ? ui('Struktur vorbereiten')
            : ui('Datei auswählen')}
        </li>
        <li className={busy ? 'is-current' : ''}>
          <span>2</span>
          {ui('Verarbeiten')}
        </li>
        <li className={result ? 'is-complete' : ''}>
          <span>3</span>
          {t('Herunterladen')}
        </li>
      </ol>
      <section className="advanced-card conversion-card" aria-label={ui(info.title)}>
        <fieldset disabled={busy} className="advanced-fields conversion-fields">
          {(['office-pdf', 'optimize-pdf'].includes(tool) ||
            (tool === 'certificate-sign' && mode === 'sign')) && (
            <Choice
              label={ui('Verarbeitung')}
              value={processing}
              onChange={setProcessing}
              items={[
                ['local', 'Lokal im Browser'],
                ...(integratedDocumentServer
                  ? [['server', 'Eigener Dokumentenserver'] as [string, string]]
                  : []),
              ]}
            />
          )}
          {localOffice && (
            <p className="fine-note">
              {ui(
                'Die Datei bleibt auf deinem Gerät. Beim ersten Start werden etwa 75 MB Programmdaten geladen. Mehr als 1 GB freier Arbeitsspeicher, HTTPS und ein aktueller Desktop-Browser werden benötigt. Höchstens 40 MB pro Office-Datei.',
              )}
            </p>
          )}
          {localOffice && browserOfficeUnavailable() && (
            <p className="notice">{ui(browserOfficeUnavailable()!)}</p>
          )}
          {tool === 'office-pdf' ? (
            pick(
              localOffice
                ? 'Word, Excel, PowerPoint, OpenDocument oder RTF'
                : 'Office, Pages, Visio oder Publisher',
              localOffice
                ? '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.odt,.ods,.odp,.rtf'
                : '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.odt,.ods,.odp,.rtf,.pages,.vsd,.vsdx,.pub',
              file,
              setFile,
            )
          ) : tool === 'ebook-pdf' ? (
            pick('E-Book (.epub)', '.epub,application/epub+zip', file, setFile)
          ) : tool === 'html-pdf' ? (
            pick('Gespeicherte Webseite (.html oder .htm)', '.html,.htm,text/html', file, setFile)
          ) : tool === 'word-mail-merge' ? (
            <>
              {pick('Word-Vorlage (.docx)', '.docx', file, setFile)}
              {pick('Excel-Datentabelle (.xlsx)', '.xlsx', spreadsheet, setSpreadsheet)}
            </>
          ) : tool === 'email-pdf' ? (
            pick('E-Mail (.eml oder .msg)', '.eml,.msg,message/rfc822', file, setFile)
          ) : tool === 'xrechnung-validate' ? (
            <>
              {pick('XRechnung als XML', '.xml,application/xml,text/xml', file, setFile)}
              {source?.invoiceOriginal && !file && (
                <p>
                  {ui('Ausgewählt: ')}
                  {source.invoiceOriginal.name}
                </p>
              )}
            </>
          ) : sources.length > 1 ? (
            <Choice
              label={ui('PDF-Dokument')}
              value={source?.id || ''}
              onChange={setSourceId}
              items={sources.map((s) => [s.id, s.name])}
            />
          ) : source ? (
            <div className="conversion-selected-file">
              <FileText size={25} />
              <div>
                <strong>{source.name}</strong>
                <span>
                  {formatSize(source.size)} · {source.pdf.numPages}{' '}
                  {source.pdf.numPages === 1 ? t('Seite') : t('Seiten')}
                </span>
              </div>
              <Button variant="ghost" onClick={onAdd}>
                {ui('Ändern')}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={onAdd}>
              <Plus size={17} />
              {ui('PDF auswählen')}
            </Button>
          )}
          {tool === 'accessibility-check' ? (
            <>
              <Choice
                label={ui('Barrierefreiheit: Aktion')}
                value={uaMode}
                onChange={setUaMode}
                items={[
                  ['basic', 'Technische Basisprüfung'],
                  ['validate', 'PDF/UA mit veraPDF prüfen'],
                  ['create', 'Strukturiertes PDF neu erstellen'],
                  ['repair', 'Vorhandene Tags bei gleichem Layout reparieren'],
                ]}
              />
              {uaMode === 'basic' && (
                <p className="fine-note">
                  {ui(
                    'Basischeck für Titel, Sprache und vorhandene Tags. Für die Normprüfung „PDF/UA mit veraPDF prüfen“ wählen.',
                  )}
                </p>
              )}
              {['validate', 'repair'].includes(uaMode) && (
                <>
                  <Choice
                    label={ui('PDF/UA-Prüfprofil')}
                    value={uaProfile}
                    onChange={setUaProfile}
                    items={[
                      ['ua1', 'PDF/UA-1'],
                      ['ua2', 'PDF/UA-2'],
                    ]}
                  />
                  <p className="fine-note">
                    {ui(
                      'Vollständiger maschineller Prüfbericht als ZIP. Lesereihenfolge, Bedeutung der Alternativtexte und Bedienbarkeit zusätzlich manuell prüfen.',
                    )}
                  </p>
                </>
              )}
              {uaMode === 'repair' && (
                <TagRepairEditor
                  source={source}
                  value={tagRepair}
                  onChange={setTagRepair}
                  run={run}
                  available={available}
                />
              )}
              {uaMode === 'create' && (
                <AccessibleEditor
                  value={uaDocument}
                  onChange={setUaDocument}
                  source={source}
                  run={run}
                />
              )}
            </>
          ) : (
            <ServerExtraFields tool={tool} value={extra} onChange={setExtra} />
          )}
          {localOptimize && (
            <p className="fine-note">
              {ui(
                'Die Verarbeitung erfolgt lokal. In dieser Ausgabe werden geeignete Bilder als JPEG komprimiert; ihre Auflösung bleibt unverändert. Mit integriertem Dokumentenserver kann MoinPDF zusätzlich die Bildauflösung reduzieren.',
              )}
            </p>
          )}
          {tool === 'pdf-word' && (
            <p className="fine-note">
              {localWord
                ? ui(
                    'Der Text wird als bearbeitbare Word-Datei gespeichert. Bilder und das ursprüngliche Seitenlayout werden dabei nicht übernommen.',
                  )
                : ui(
                    'Text, Tabellen und Bilder werden für Word übernommen. Bei komplexen Layouts kann die Anordnung abweichen.',
                  )}{' '}
              {ui('Reine Scans zuerst mit')}{' '}
              <button className="conversion-text-link" onClick={() => onChoose('ocr')}>
                {ui('OCR &amp; Text')}
              </button>{' '}
              {ui('auslesen.')}
            </p>
          )}
          {tool === 'email-pdf' && (
            <>
              <details className="conversion-options">
                <summary>{ui('Weitere Optionen')}</summary>
                <Tick
                  label={ui('Anlagen zusätzlich in einer ZIP-Datei herunterladen')}
                  value={attachments}
                  onChange={setAttachments}
                />
              </details>
              <p className="fine-note">
                {ui(
                  'Die Nachricht wird mit Absender und Betreff als PDF gespeichert. Externe Bilder werden nicht geladen.',
                )}
              </p>
            </>
          )}
          {tool === 'pdfa' && (
            <>
              <Choice
                label={ui('Aktion')}
                value={mode}
                onChange={setMode}
                items={[
                  ['create', 'Archiv-PDF erstellen und prüfen'],
                  ['validate', 'Vorhandene Archiv-PDF prüfen'],
                ]}
              />
              <details className="conversion-options">
                <summary>{ui('Weitere Optionen')}</summary>
                <Choice
                  label={ui('PDF/A-Profil')}
                  value={profile}
                  onChange={setProfile}
                  items={[
                    ['1b', 'PDF/A-1b'],
                    ['2b', 'PDF/A-2b'],
                    ['3b', 'PDF/A-3b'],
                  ]}
                />
              </details>
              <p className="fine-note">
                {ui(
                  'Du erhältst eine ZIP-Datei mit PDF und Prüfbericht. Interaktive Elemente und Anhänge können in der Archivkopie entfallen. Bitte den Bericht vor der Archivierung prüfen.',
                )}
              </p>
            </>
          )}
          {tool === 'zugferd-create' && (
            <>
              <Choice
                label={ui('Aktion')}
                value={mode}
                onChange={setMode}
                items={[
                  ['create', 'PDF und Rechnungsdaten verbinden'],
                  ['validate', 'Vorhandene Rechnung prüfen'],
                ]}
              />
              {mode === 'create' && (
                <>
                  {pick('Zur Rechnung passende CII-XML', '.xml', file, setFile)}
                  <Choice
                    label={ui('Rechnungsprofil')}
                    value={profile}
                    onChange={setProfile}
                    items={[
                      ['E', 'EN 16931'],
                      ['B', 'BASIC'],
                      ['T', 'EXTENDED'],
                      ['X', 'XRECHNUNG'],
                    ]}
                  />
                </>
              )}
              <p className="fine-note">
                {ui(
                  'Die sichtbare Rechnung und die XML müssen dieselben Rechnungsdaten enthalten. Das Ergebnis enthält einen Prüfbericht; fehlgeschlagene Prüfungen werden ausdrücklich markiert.',
                )}
              </p>
            </>
          )}
          {tool === 'certificate-sign' && (
            <>
              <Choice
                label={ui('Aktion')}
                value={mode}
                onChange={setMode}
                items={[
                  ['validate', 'Signaturen prüfen'],
                  ['sign', 'Mit Zertifikat signieren'],
                  ...(capabilities?.signatureLevels?.lta
                    ? [['renew', 'Langzeit-Zeitstempel erneuern'] as [string, string]]
                    : []),
                ]}
              />
              {mode === 'sign' && (
                <>
                  {!localCertificate && (
                    <Choice
                      label={ui('Signaturprofil')}
                      value={signLevel}
                      onChange={setSignLevel}
                      items={(['basic', 'timestamp', 'lt', 'lta'] as const)
                        .filter(
                          (level) => level === 'basic' || capabilities?.signatureLevels?.[level],
                        )
                        .map((level) => [
                          level,
                          {
                            basic: 'PAdES-B: Zertifikatssignatur',
                            timestamp: 'PAdES-T: mit geprüftem Zeitstempel',
                            lt: 'PAdES-LT: mit eingebetteten Sperrnachweisen',
                            lta: 'PAdES-LTA: mit Langzeit-Zeitstempel',
                          }[level],
                        ])}
                    />
                  )}
                  {pick('Zertifikat (.p12 oder .pfx)', '.p12,.pfx', cert, setCert)}
                  <Text
                    label={ui('Zertifikatspasswort')}
                    type="password"
                    value={password}
                    onChange={setPassword}
                  />
                  <p className="fine-note">
                    {ui(
                      localCertificate
                        ? 'Zertifikat, privater Schlüssel und Passwort bleiben auf deinem Gerät. Benötigt HTTPS und ein modernes PKCS#12-Zertifikat mit RSA ab 2048 Bit. Keine qualifizierte Signatur und kein Zeitstempel.'
                        : 'Mit „Signieren“ werden auch das ausgewählte Zertifikat samt privatem Schlüssel und das Passwort für diesen Auftrag übertragen.',
                    )}
                  </p>
                </>
              )}
              <p className="fine-note">
                {ui(
                  'Integrität, Zertifikatsvertrauen, Sperrnachweise und Zeitstempel werden getrennt geprüft. CRL-/OCSP-Nachweise werden offline aus der PDF und dem konfigurierten Nachweisspeicher gelesen; fehlende Nachweise ergeben kein Vertrauensurteil. Für neue Zeitstempel wird der konfigurierte Zeitstempeldienst kontaktiert. Langzeitprofile erscheinen nach dessen Einrichtung durch den Betreiber. Es wird keine qualifizierte Signatur bestätigt.',
                )}
              </p>
            </>
          )}
          <Button
            className="conversion-submit"
            disabled={
              busy ||
              !available ||
              !completeInput ||
              status === 'checking' ||
              (localOffice && !!browserOfficeUnavailable())
            }
            onClick={() => run(process)}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={18} />
                {ui('Wird verarbeitet …')}
              </>
            ) : tool === 'accessibility-check' ? (
              uaMode === 'create' ? (
                ui('PDF/UA erstellen und prüfen')
              ) : uaMode === 'repair' ? (
                ui('Tags reparieren und PDF/UA prüfen')
              ) : uaMode === 'validate' ? (
                ui('PDF/UA prüfen')
              ) : (
                info.action
              )
            ) : tool === 'certificate-sign' ? (
              mode === 'renew' ? (
                ui('Langzeit-Zeitstempel erneuern')
              ) : mode === 'sign' ? (
                ui('Signieren')
              ) : (
                ui('Signaturen prüfen')
              )
            ) : (
              info.action
            )}
          </Button>
          {status === 'checking' && (
            <p className="conversion-status" role="status">
              <LoaderCircle className="spin" size={15} />
              {ui('Wird vorbereitet …')}
            </p>
          )}
          {status !== 'checking' && !available && (
            <div className="conversion-unavailable" role="status">
              <p>
                {!integratedDocumentServer
                  ? ui('Diese Funktion ist in dieser Ausgabe von MoinPDF nicht verfügbar.')
                  : tool === 'translate-pdf' && capabilities?.translationStatus === 'starting'
                    ? ui(
                        'Die Übersetzung wird noch vorbereitet. Bitte versuche es in wenigen Minuten erneut.',
                      )
                    : ui(
                        'Diese Funktion ist gerade nicht verfügbar. Bitte versuche es gleich noch einmal.',
                      )}
              </p>
              {integratedDocumentServer && (
                <Button variant="outline" onClick={() => void checkConnection()}>
                  <RefreshCw size={15} />
                  {ui('Erneut versuchen')}
                </Button>
              )}
            </div>
          )}
          {available && !localMode && (
            <p className="conversion-privacy">
              {tool === 'accessibility-check' && uaMode === 'create'
                ? ui(
                    'Mit dem Start werden die Inhaltsblöcke und Bilder aus dem Struktureditor für diesen Auftrag übertragen.',
                  )
                : ui(
                    'Mit dem Start wird die ausgewählte Datei für diesen Auftrag übertragen.',
                  )}{' '}
              {ui('Die Daten werden nicht dauerhaft gespeichert.')}{' '}
              <a href="/datenschutz.html" target="_blank" rel="noopener noreferrer">
                {ui('Datenschutz')}
              </a>
            </p>
          )}
        </fieldset>
      </section>
      {busy && (
        <div className="advanced-progress" role="status">
          <LoaderCircle className="spin" size={18} />
          <span>{ui(localOffice && progress ? progress : 'Deine Datei wird verarbeitet …')}</span>
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
        <section ref={resultRef} className="advanced-result">
          <div>
            <h2>
              <Check size={22} />
              {t('Fertig.')}
            </h2>
            <p>
              {result.filename} · {formatSize(result.blob.size)}
            </p>
            {result.note && <p>{ui(result.note)}</p>}
            <Button asChild>
              <a href={url || undefined} download={result.filename}>
                <Download size={17} />
                {result.filename.toLowerCase().endsWith('.docx')
                  ? ui('Word herunterladen')
                  : result.kind === 'pdf'
                    ? t('PDF herunterladen')
                    : result.kind === 'zip'
                      ? t('ZIP herunterladen')
                      : t('Ergebnis herunterladen')}
              </a>
            </Button>
            {result.kind === 'pdf' && (
              <Button
                variant="outline"
                onClick={() =>
                  run(async () =>
                    onUse({ ...result, kind: 'pdf', inputSize: source?.size || file?.size || 0 }),
                  )
                }
              >
                {t('Ergebnis weiterbearbeiten')}
              </Button>
            )}
            {report && <StructuredReport raw={report} />}
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
