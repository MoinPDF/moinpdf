'use client';
import { useToolPreferences } from '@/components/studio/use-tool-preferences';
import { ResponsiveInspector } from '@/components/studio/responsive-inspector';
import {
  CompressionPresets,
  savedCompressionQuality,
} from '@/components/studio/compression-presets';
import { reportText } from '@/lib/pdf-report';
import { ui, uiLocale } from '@/lib/ui-language';
import { EditorResultReview } from '@/components/studio/editor-result-review';
import { applyEditorPatch, type EditorSelection } from '@/lib/editor-rich-text';
import { ResultActions, ResultSummary, useResultName } from '@/components/studio/result-actions';
import { ToolBrowserMemory, useToolNavigation } from '@/components/studio/tool-browser-memory';
import { DuplicatePrompt, type DuplicateRequest } from '@/components/studio/duplicate-prompt';
import { duplicateSource, uploadFingerprint } from '@/lib/upload-duplicates';
import { completePdfSelection } from '@/lib/result-details';

import { useLanguage } from '@/components/studio/appearance';
import { AppearanceProvider, AppearanceControls, useTools } from '@/components/studio/appearance';

import {
  WorkspaceResultsProvider,
  WorkspaceTray,
  useWorkspaceResults,
} from '@/components/studio/workspace-results';
import { WorkspaceRecovery } from '@/components/studio/workspace-recovery';
import type { RecoveryStatus } from '@/lib/recovery-writer';
import { ProjectManager } from '@/components/studio/project-manager';
import { createPortal } from 'react-dom';
import { emptyWriterDocument, type WriterDocument } from '@/lib/writer-model';
const DocumentWriter = lazy(() =>
  import('@/components/studio/document-writer').then((module) => ({
    default: module.DocumentWriter,
  })),
);
import { retainPageEdits, type ProjectSnapshot, type ProjectState } from '@/lib/local-projects';
import { snapshotSourceIds, workspaceSources, boundedHistory } from '@/lib/workspace-history';
import {
  hasWorkspaceChanges,
  materializeWorkspace,
  WorkspaceReviewRequired,
} from '@/lib/workspace-document';
import { captureProjectCheckpoint, type ProjectCheckpoint } from '@/lib/project-checkpoint';
import {
  createUndoFeedbackGate,
  fileDragInfo,
  fileDropLabel,
  reorderPageItems,
} from '@/lib/interaction-feedback';
import { ocrLayouts } from '@/lib/ocr-languages';
import { OcrLanguagePicker } from '@/components/studio/ocr-language-picker';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  FileText,
  Layers,
  LayoutGrid,
  Plus,
  X,
  ShieldCheck,
  GripVertical,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  CircleHelp,
  LoaderCircle,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  PenLine,
  Type,
  Highlighter,
  Search,
  ZoomIn,
  ZoomOut,
  FilePlus2,
  MoveVertical,
  CheckCheck,
  FileSearch,
  Settings2,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { UploadEntry, type ImportState } from '@/components/studio/upload-entry';
import { ToolFileEntry } from '@/components/studio/tool-file-entry';
import { LegalFooter } from '@/components/studio/legal-footer';
import { HarborNavigation } from '@/components/studio/harbor-navigation';
import { HarborLightFeedback } from '@/components/studio/harbor-light-feedback';
import { ToolSpotlight } from '@/components/studio/tool-spotlight';
import { SearchHighlight } from '@/components/studio/search-highlight';
import { PageReorderGrid } from '@/components/studio/page-reorder-grid';
import { FileArrivalCheck, JobStatusIcon, useFreshResult } from '@/components/studio/ui-feedback';
import { fileArrivals } from '@/lib/ui-feedback';
import { WorkspaceContext } from '@/components/studio/workspace-context';
const DocumentWorkbench = lazy(() =>
  import('@/components/studio/document-workbench').then((module) => ({
    default: module.DocumentWorkbench,
  })),
);
import { PasswordPrompt, type PasswordRequest } from '@/components/studio/password-prompt';
const SecurityWorkbench = lazy(() =>
  import('@/components/studio/security-workbench').then((module) => ({
    default: module.SecurityWorkbench,
  })),
);
const InvoiceWorkbench = lazy(() =>
  import('@/components/studio/invoice-workbench').then((module) => ({
    default: module.InvoiceWorkbench,
  })),
);
const AdvancedWorkbench = lazy(() =>
  import('@/components/studio/advanced-workbench').then((module) => ({
    default: module.AdvancedWorkbench,
  })),
);
const ServerWorkbench = lazy(() =>
  import('@/components/studio/server-workbench').then((module) => ({
    default: module.ServerWorkbench,
  })),
);
import { isAdvancedTool, isServerTool, type ServerTool } from '@/lib/advanced-types';
import { conversionToolForFile, documentAccept } from '@/lib/import-routing';
import { isDocumentTool, type DocumentSessions } from '@/lib/document-tools';
import { ToolChooser } from '@/components/studio/tool-chooser';
const EditorCanvas = lazy(() =>
  import('@/components/studio/editor-canvas').then((m) => ({ default: m.EditorCanvas })),
);
import { EditorDocumentSearch } from '@/components/studio/editor-document-search';
import { editorDocumentFingerprint } from '@/lib/editor-document-search';
import { EditorPanel, EditorToolbar } from '@/components/studio/editor-panel';
const EditorWorkflowPanel = lazy(() =>
  import('@/components/studio/editor-workflow-panel').then((m) => ({
    default: m.EditorWorkflowPanel,
  })),
);
import { editorTools, fitRect, type EditorAction } from '@/lib/editor-model';
import { ExtraSettings } from '@/components/studio/extra-settings';
import { ReportView } from '@/components/studio/report-view';
import { extraDefaults, isExtraTool, sourceOnlyTools } from '@/lib/extra-options';
import { type WorkspaceTool } from '@/lib/tool-catalog';
import { searchTools } from '@/lib/localized-search';
const DocumentCheck = lazy(() =>
  import('@/components/studio/document-check').then((module) => ({
    default: module.DocumentCheck,
  })),
);
import { useDocumentIndex } from '@/components/studio/use-document-index';
import {
  PagePreview,
  PageCanvas,
  SignaturePad,
  type EditMode,
  type Signature,
} from '@/components/studio/canvas';
import {
  openSource,
  sourcePages,
  formatSize,
  selectRange,
  makeDemoFile,
  downloadBlob,
  downloadWord,
  filenameStem,
  uid,
  MAX_BYTES,
  MAX_PAGES,
  type Source,
  type PageItem,
  type JobResult,
  type ProgressUpdate,
} from '@/lib/pdf-engine';
import {
  runStudioJob,
  visualTools,
  emptyEdits,
  countEdits,
  makeBlankFile,
  normalizedRect,
  type StudioOptions,
  type Edits,
  type Mark,
  type Rect,
} from '@/lib/studio-engine';

const defaults: StudioOptions = {
  ...extraDefaults,
  language: 'deu',
  ocrLayout: '3',
  forceOcr: false,
  imageFormat: 'png',
  quality: 'balanced',
  watermark: 'ENTWURF',
  numberStart: 1,
  pageSize: 'a4',
  orientation: 'portrait',
  perSheet: '2',
};
type Snapshot = ProjectSnapshot;
export default function Home() {
  useLanguage();
  return (
    <AppearanceProvider>
      <ToolBrowserMemory>
        <WorkspaceResultsProvider>
          <WorkspaceShell />
        </WorkspaceResultsProvider>
      </ToolBrowserMemory>
    </AppearanceProvider>
  );
}
function WorkspaceShell() {
  const { t } = useLanguage();
  return (
    <div className="moinpdf-shell">
      <HarborLightFeedback />
      <ToolSpotlight />
      <a className="harbor-skip" href="#moinpdf-content">
        {t('Zum Inhalt', 'Skip to content')}
      </a>
      <header className="app-toolbar">
        <div id="moinpdf-brand" className="min-w-0" />
        <div id="moinpdf-navigation" />
        <div className="harbor-header-actions">
          <div id="moinpdf-results-bar" />
          <div id="moinpdf-document-bar" />
          <div id="moinpdf-project-bar" className="project-bar" />
          <AppearanceControls />
        </div>
      </header>
      <div id="moinpdf-desktop-search" className="desktop-search-row" />
      <div id="moinpdf-mobile-navigation" />
      <div id="moinpdf-recovery" />
      <SidebarProvider
        defaultOpen={false}
        id="moinpdf-content"
        tabIndex={-1}
        className="studio-provider"
        style={{ '--sidebar-width': '252px' } as CSSProperties}
      >
        <Suspense
          fallback={
            <div className="tool-loading" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>{t('Werkzeug wird geladen …')}</p>
            </div>
          }
        >
          <Studio />
        </Suspense>
      </SidebarProvider>
      <LegalFooter />
    </div>
  );
}
function Studio() {
  const toolPreferences = useToolPreferences();
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(false);
  const continuingResult = useRef(false);
  useEffect(() => {
    const quality = savedCompressionQuality();
    if (quality) setOptions((old) => ({ ...old, quality }));
  }, []);
  const toolNavigation = useToolNavigation();
  const { t, language } = useLanguage();
  const { tools, groups } = useTools();
  const { setOpenMobile } = useSidebar();
  const [projectIdentity, setProjectIdentity] = useState<{ id?: string; name: string }>({
    name: 'Mein PDF-Projekt',
  });
  const [projectCheckpoint, setProjectCheckpoint] = useState<ProjectCheckpoint | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({ phase: 'idle' });
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [writerDocument, setWriterDocument] = useState<WriterDocument | null>(null);
  const [writerSavedRevision, setWriterSavedRevision] = useState('');
  const writerUnsaved = useRef(false);
  writerUnsaved.current = Boolean(
    writerDocument && `${writerDocument.id}:${writerDocument.updated}` !== writerSavedRevision,
  );
  const [writerHost, setWriterHost] = useState<HTMLElement | null>(null);
  useEffect(() => setWriterHost(document.getElementById('moinpdf-document-bar')), []);
  const [dragFileCount, setDragFileCount] = useState<number | null>(null);
  const workspaceResults = useWorkspaceResults();
  const [sources, setSources] = useState<Source[]>([]),
    [pages, setPages] = useState<PageItem[]>([]),
    [edits, setEdits] = useState<Edits>(emptyEdits),
    [toolId, setToolId] = useState<WorkspaceTool>('inspect'),
    [options, setOptions] = useState<StudioOptions>(defaults);
  const [view, setView] = useState('check'),
    [activeId, setActiveId] = useState(''),
    [zoom, setZoom] = useState(100),
    [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [dragOver, setDragOver] = useState(false),
    [progress, setProgress] = useState<ProgressUpdate>({ percent: 0, label: '' }),
    [error, setError] = useState('');
  const [result, setResult] = useState<JobResult | null>(null),
    [resultUrl, setResultUrl] = useState(''),
    [resultSource, setResultSource] = useState<Source | null>(null),
    [resultPage, setResultPage] = useState(0),
    [resultText, setResultText] = useState(''),
    [resultLoading, setResultLoading] = useState(false);
  const resultFresh = useFreshResult(result);
  const [resultName, renameResult] = useResultName(result);
  const [range, setRange] = useState(''),
    [noteText, setNoteText] = useState('Hier steht meine Notiz.'),
    [fontSize, setFontSize] = useState(16),
    [noteMode, setNoteMode] = useState<'text' | 'highlight'>('text'),
    [signature, setSignature] = useState<Signature | null>(null),
    [signatureOpen, setSignatureOpen] = useState(false);
  const [manualRect, setManualRect] = useState<Rect>({ x: 0.12, y: 0.2, w: 0.62, h: 0.12 }),
    [help, setHelp] = useState<'help' | 'privacy' | null>(null),
    [wordBusy, setWordBusy] = useState(false),
    [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [selectedMarkId, setSelectedMarkId] = useState(''),
    [editorAction, setEditorAction] = useState<EditorAction>('pick'),
    [editorDims, setEditorDims] = useState({ width: 595.28, height: 841.89 }),
    [imageBusy, setImageBusy] = useState(false);
  const imagePicker = useRef<HTMLInputElement>(null);
  const [editorDocumentSearchOpen, setEditorDocumentSearchOpen] = useState(false);
  const [editorSearchHighlight, setEditorSearchHighlight] = useState<{
    pageId: string;
    rect: Rect;
  } | null>(null);
  const [pendingToolReason, setPendingToolReason] = useState('');
  const [pendingTool, setPendingTool] = useState<WorkspaceTool | null>(null);
  const [archivedSources, setArchivedSources] = useState<Source[]>([]);
  const sourcePool = useRef(new Map<string, Source>());
  const [history, setHistory] = useState<Snapshot[]>([]),
    [future, setFuture] = useState<Snapshot[]>([]);
  const [documentSessions, setDocumentSessions] = useState<DocumentSessions>({}),
    [documentBusy, setDocumentBusy] = useState(false);
  const projectSources = useMemo(
    () => workspaceSources(sources, archivedSources, history, future),
    [sources, archivedSources, history, future],
  );
  for (const source of projectSources) {
    const previous = sourcePool.current.get(source.id);
    if (previous && previous.pdf !== source.pdf)
      setTimeout(() => void previous.pdf.loadingTask.destroy(), 100);
    sourcePool.current.set(source.id, source);
  }
  const projectState = useMemo<ProjectState>(
    () => ({
      pages,
      edits,
      options,
      history,
      future,
      documentSessions,
      activeId,
      toolId,
      sourceIds: sources.map((s) => s.id),
    }),
    [pages, edits, options, history, future, documentSessions, activeId, toolId, sources],
  );
  useEffect(() => {
    const needed = new Set(projectSources.map((s) => s.id));
    for (const [id, source] of sourcePool.current)
      if (!needed.has(id)) {
        sourcePool.current.delete(id);
        setTimeout(() => void source.pdf.loadingTask.destroy(), 100);
      }
    setArchivedSources((old) =>
      old.some((s) => !needed.has(s.id)) ? old.filter((s) => needed.has(s.id)) : old,
    );
  }, [projectSources]);
  const snapshot = (): Snapshot => ({
    pages,
    edits,
    sourceIds: sources.map((s) => s.id),
    documentSessions,
    activeId,
  });
  const restoreSnapshot = (saved: Snapshot) => {
    const ids = snapshotSourceIds(saved);
    setArchivedSources(projectSources);
    setSources(ids.map((id) => sourcePool.current.get(id)!).filter(Boolean));
    setPages(saved.pages);
    setEdits(saved.edits);
    if (saved.documentSessions) setDocumentSessions(saved.documentSessions);
    setActiveId(saved.activeId || saved.pages[0]?.id || '');
  };
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const [duplicateRequest, setDuplicateRequest] = useState<DuplicateRequest | null>(null);
  const duplicateResolver = useRef<DuplicateRequest['resolve'] | null>(null);
  useEffect(() => () => duplicateResolver.current?.({ add: false, remember: true }), []);
  const [choosingTool, setChoosingTool] = useState(true),
    [browseEmpty, setBrowseEmpty] = useState(false);
  const [homeRequested, setHomeRequested] = useState(false);
  const [repairInput, setRepairInput] = useState<File | null>(null);
  const [conversionInput, setConversionInput] = useState<{ tool: ServerTool; file: File } | null>(
    null,
  );
  const [importState, setImportState] = useState<ImportState>({
    phase: 'idle',
    name: '',
    completed: 0,
    total: 0,
  });
  const documentIndex = useDocumentIndex(sources, pages);
  const refs = useRef({ sources, pages, edits, busy: false });
  refs.current = {
    sources,
    pages,
    edits,
    busy: busy || loading || imageBusy || documentBusy || projectBusy || documentIndex.ocrBusy,
  };
  const picker = useRef<HTMLInputElement>(null),
    job = useRef<AbortController | null>(null),
    uploadLock = useRef(false);
  const undoGate = useRef(createUndoFeedbackGate());
  const undoNotice = useRef<Snapshot | null>(null);
  const selected = pages.filter((p) => p.selected),
    activePage = pages.find((p) => p.id === activeId) || pages[0],
    activeSource = activePage ? sources.find((s) => s.id === activePage.sourceId) : undefined;
  const tool = tools.find((t) => t.id === toolId)!,
    locked = busy || loading || imageBusy || documentBusy || projectBusy || documentIndex.ocrBusy,
    editCount = countEdits(edits, selected),
    pageMarks = activePage ? edits.marks[activePage.id] || [] : [];
  const editMode: EditMode =
    toolId === 'redact'
      ? 'redact'
      : toolId === 'crop'
        ? 'crop'
        : toolId === 'annotate'
          ? noteMode
          : toolId === 'sign'
            ? 'signature'
            : null;
  const isEditor = editorTools.includes(toolId),
    selectedMark = pageMarks.find((m) => m.id === selectedMarkId);
  useEffect(() => setSelectedMarkId(''), [activePage?.id]);
  const sourceBytes = sources.reduce((n, s) => n + s.size, 0);
  const hasNeededEdit =
    isEditor && toolId !== 'edit-text'
      ? editCount > 0
      : toolId === 'redact'
        ? selected.some((p) => edits.marks[p.id]?.some((m) => m.kind === 'redact'))
        : toolId === 'crop'
          ? selected.some((p) => edits.crops[p.id])
          : toolId === 'sign'
            ? selected.some((p) => edits.marks[p.id]?.some((m) => m.kind === 'signature'))
            : toolId === 'annotate'
              ? selected.some((p) =>
                  edits.marks[p.id]?.some((m) => m.kind === 'text' || m.kind === 'highlight'),
                )
              : true;

  useEffect(
    () => () => {
      job.current?.abort();
      sourcePool.current.forEach((s) => void s.pdf.loadingTask.destroy());
    },
    [],
  );
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (refs.current.sources.length || writerUnsaved.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, []);
  useEffect(() => {
    if (!result) {
      setResultUrl('');
      setResultSource(null);
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setResultUrl(url);
    setResultPage(0);
    let active = true,
      preview: Source | undefined;
    if (result.kind === 'pdf') {
      setResultLoading(true);
      openSource(new File([result.blob], result.filename, { type: 'application/pdf' }))
        .then((s) => {
          preview = s;
          if (active) setResultSource(s);
          else void s.pdf.loadingTask.destroy();
        })
        .catch(() => {
          if (active) setResultSource(null);
        })
        .finally(() => {
          if (active) setResultLoading(false);
        });
    }
    return () => {
      active = false;
      URL.revokeObjectURL(url);
      if (preview) void preview.pdf.loadingTask.destroy();
    };
  }, [result]);
  useEffect(() => {
    let active = true;
    setMetadata({});
    if (toolId === 'metadata' && activeSource)
      activeSource.pdf
        .getMetadata()
        .then((data) => {
          if (active) setMetadata(data.info as Record<string, unknown>);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [toolId, activeSource]);
  const invalidate = () => {
    setResult(null);
    setError('');
    if (view === 'result')
      setView(
        toolId === 'inspect'
          ? 'check'
          : toolId === 'compress' || visualTools.includes(toolId)
            ? 'document'
            : 'pages',
      );
  };
  const dismissUndoNotice = () => {
    undoGate.current.invalidate();
    undoNotice.current = null;
    toast.dismiss('page-edit-undo');
  };
  useEffect(() => {
    const notice = undoNotice.current;
    if (notice && (locked || notice.pages !== pages || notice.edits !== edits)) dismissUndoNotice();
  }, [pages, edits, locked]);
  useEffect(
    () => () => {
      toast.dismiss('page-edit-undo');
    },
    [],
  );
  const commit = (next: Snapshot, feedback?: string) => {
    if (locked) return;
    dismissUndoNotice();
    setHistory((old) => boundedHistory([...old, snapshot()], sources, projectSources));
    setFuture([]);
    setPages(next.pages);
    setEdits(next.edits);
    invalidate();
    if (feedback) {
      const token = undoGate.current.invalidate();
      undoNotice.current = next;
      toast(feedback, {
        id: 'page-edit-undo',
        duration: 6500,
        action: {
          label: t('Rückgängig'),
          onClick: () => {
            const now = refs.current;
            if (now.pages !== next.pages || now.edits !== next.edits) return;
            if (undoGate.current.consume(token, now.busy)) callbacks.current.undo();
          },
        },
      });
    }
  };
  function undo() {
    if (locked || !history.length) return;
    typingHistory.current = null;
    dismissUndoNotice();
    const prev = history[history.length - 1];
    setFuture((old) => [snapshot(), ...old]);
    setHistory((old) => old.slice(0, -1));
    restoreSnapshot(prev);
    invalidate();
  }
  function redo() {
    if (locked || !future.length) return;
    typingHistory.current = null;
    dismissUndoNotice();
    const next = future[0];
    setHistory((old) => boundedHistory([...old, snapshot()], sources, projectSources));
    setFuture((old) => old.slice(1));
    restoreSnapshot(next);
    invalidate();
  }
  const callbacks = useRef({ undo, redo });
  callbacks.current = { undo, redo };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (writerOpen) return;
      if (e.isComposing) return;
      if (
        !(e.target instanceof HTMLElement && !!e.target.closest('[data-editor-history="true"]')) &&
        (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable))
      )
        return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        key === 'y' || e.shiftKey ? callbacks.current.redo() : callbacks.current.undo();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [writerOpen]);
  const addFiles = useCallback(
    async (files: File[], showToolChoice = true) => {
      if (!files.length || refs.current.busy || uploadLock.current) return;
      const conversionFile = files.find((file) => conversionToolForFile(file.name));
      if (conversionFile) {
        if (files.length !== 1) {
          toast.error(
            ui(
              'Bitte Office-Dateien, E-Mails, E-Books und Webseiten einzeln umwandeln. PDFs und Bilder kannst du weiterhin gemeinsam öffnen.',
            ),
          );
          return;
        }
        if (conversionFile.size > MAX_BYTES) {
          toast.error(ui('Bitte eine Datei mit höchstens 80 MB auswählen.'));
          return;
        }
        const nextTool = conversionToolForFile(conversionFile.name)!;
        setHomeRequested(false);
        setConversionInput({ tool: nextTool, file: conversionFile });
        fileArrivals.mark([conversionFile]);
        setToolId(nextTool);
        setChoosingTool(false);
        setBrowseEmpty(true);
        setDragOver(false);
        setError('');
        return;
      }
      uploadLock.current = true;
      setLoading(true);
      setDragOver(false);
      setError('');
      const initial = !refs.current.sources.length,
        started = performance.now();
      setImportState({ phase: 'reading', name: files[0].name, completed: 0, total: files.length });
      const added: Source[] = [];
      let duplicateChoice: boolean | undefined;
      let skipped = 0;
      let size = refs.current.sources.reduce((n, s) => n + s.size, 0),
        count = refs.current.pages.length;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setImportState({ phase: 'reading', name: file.name, completed: i, total: files.length });
          try {
            if (file.size > MAX_BYTES)
              throw new Error('Bitte eine Datei mit höchstens 80 MB auswählen.');
            const fingerprint = await uploadFingerprint(file);
            const existing = await duplicateSource(file, fingerprint, [
              ...refs.current.sources,
              ...added,
            ]);
            if (existing) {
              let add = duplicateChoice;
              if (add === undefined) {
                const choice = await new Promise<{ add: boolean; remember: boolean }>((resolve) => {
                  duplicateResolver.current = resolve;
                  setDuplicateRequest({
                    name: file.name,
                    existingName: existing.name,
                    remaining: files.length - i - 1,
                    resolve,
                  });
                });
                duplicateResolver.current = null;
                add = choice.add;
                if (choice.remember) duplicateChoice = add;
              }
              if (!add) {
                skipped++;
                continue;
              }
            }
            if (size + file.size > MAX_BYTES)
              throw new Error('Maximal 80 MB insgesamt. Entferne zuerst andere Dateien.');
            const source = await openSource(file, {
              requestPassword: (name, failed) =>
                new Promise((resolve) => setPasswordRequest({ name, failed, resolve })),
            });
            source.originalDigest = fingerprint;
            if (count + source.pdf.numPages > MAX_PAGES) {
              await source.pdf.loadingTask.destroy();
              throw new Error('Maximal 200 Seiten insgesamt.');
            }
            added.push(source);
            size += file.size;
            count += source.pdf.numPages;
          } catch (err) {
            if ((err as Error).name !== 'AbortError')
              toast.error(file.name, {
                description: ui((err as Error).message),
                duration: 8000,
                ...(/\.pdf$/i.test(file.name)
                  ? {
                      action: {
                        label: ui('PDF reparieren'),
                        onClick: () => {
                          setRepairInput(file);
                          setToolId('pdf-repair');
                          setChoosingTool(false);
                          setBrowseEmpty(true);
                        },
                      },
                    }
                  : {}),
              });
          }
        }
        if (added.length) {
          setHomeRequested(false);
          if (initial) {
            await new Promise((r) =>
              setTimeout(r, Math.max(0, 700 - (performance.now() - started))),
            );
            setImportState({
              phase: 'done',
              name: '',
              completed: added.length,
              total: files.length,
            });
            await new Promise((r) => setTimeout(r, 400));
          }
          const nextPages = added.flatMap(sourcePages);
          setSources((old) => [...old, ...added]);
          fileArrivals.mark(added);
          setPages((old) => [...old, ...nextPages]);
          setActiveId(nextPages[0].id);
          setResult(null);
          setRange('');
          setHistory([]);
          setFuture([]);
          if (showToolChoice) {
            setChoosingTool(true);
            setToolId('inspect');
            setView('check');
            setSearch('');
          } else {
            setView(
              toolId === 'inspect'
                ? 'check'
                : toolId === 'compress' || visualTools.includes(toolId)
                  ? 'document'
                  : 'pages',
            );
          }
          toast.success(
            `${added.length} ${t(added.length === 1 ? 'Datei geöffnet' : 'Dateien geöffnet')}`,
          );
        }
        if (skipped)
          toast.info(
            t(
              `${skipped} doppelte ${skipped === 1 ? 'Datei übersprungen' : 'Dateien übersprungen'}`,
              `${skipped} duplicate ${skipped === 1 ? 'file skipped' : 'files skipped'}`,
            ),
          );
      } finally {
        uploadLock.current = false;
        setLoading(false);
        setImportState({ phase: 'idle', name: '', completed: 0, total: 0 });
      }
    },
    [t, toolId],
  );
  useEffect(() => {
    if (writerOpen) return;
    const reset = () => {
      setDragOver(false);
      setDragFileCount(null);
    };
    const over = (e: DragEvent) => {
      const info = fileDragInfo(e.dataTransfer);
      if (info.isFiles) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = refs.current.busy ? 'none' : 'copy';
        if (!refs.current.busy) {
          setDragOver(true);
          setDragFileCount(info.count);
        } else reset();
      }
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) reset();
    };
    const drop = (e: DragEvent) => {
      if (!fileDragInfo(e.dataTransfer).isFiles) return;
      e.preventDefault();
      reset();
      if (refs.current.busy) return;
      void addFiles(Array.from(e.dataTransfer?.files || []), choosingTool);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', reset);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('blur', reset);
    };
  }, [addFiles, choosingTool, writerOpen]);
  function chooseTool(id: WorkspaceTool) {
    if (locked) return;
    if (
      (isAdvancedTool(id) ||
        isServerTool(id) ||
        isDocumentTool(id) ||
        ['protect', 'unlock', 'invoice-read', 'invoice-check'].includes(id)) &&
      sources.length &&
      hasWorkspaceChanges(sources, pages, edits, documentSessions)
    ) {
      void prepareWorkspace(id);
      return;
    }
    showTool(id);
  }
  async function prepareWorkspace(id: WorkspaceTool, allowRebuild = false) {
    setLoading(true);
    const controller = new AbortController();
    job.current = controller;
    try {
      const prepared = await materializeWorkspace(
        sources,
        pages,
        edits,
        documentSessions,
        options,
        { signal: controller.signal, report: setProgress },
        allowRebuild,
      );
      setArchivedSources(projectSources);
      prepared.sources.forEach((s) => sourcePool.current.set(s.id, s));
      setHistory(
        boundedHistory([...history, snapshot()], prepared.sources, [
          ...projectSources,
          ...prepared.sources,
        ]),
      );
      setFuture([]);
      setSources(prepared.sources);
      setPages(prepared.pages);
      setEdits(emptyEdits());
      setDocumentSessions({});
      setPendingTool(null);
      showTool(id);
    } catch (error) {
      if (error instanceof WorkspaceReviewRequired) {
        setPendingToolReason(error.message);
        setPendingTool(id);
      } else if (!controller.signal.aborted) toast.error(ui((error as Error).message));
    } finally {
      setLoading(false);
      job.current = null;
    }
  }
  function showTool(id: WorkspaceTool) {
    toolPreferences.record(id);
    setEditorSettingsOpen(false);
    if (choosingTool) toolNavigation.capture(homeVisible ? 'home' : 'all', id);
    setWriterOpen(false);
    setHomeRequested(false);
    setBrowseEmpty(true);
    setSelectedMarkId('');
    setEditorAction(id === 'erase' ? 'erase' : id === 'insert-image' ? 'image' : 'pick');
    setChoosingTool(false);
    setToolId(id);
    setView(
      id === 'inspect'
        ? 'check'
        : id === 'compress' || visualTools.includes(id)
          ? 'document'
          : 'pages',
    );
    setError('');
    setOpenMobile(false);
    requestAnimationFrame(() => {
      document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  function movePage(id: string, to: number) {
    const next = reorderPageItems(pages, id, to);
    if (next === pages) return;
    commit(
      { pages: next, edits },
      t(`Seite an Position ${to + 1} verschoben`, `Page moved to position ${to + 1}`),
    );
  }
  function rotate(id?: string) {
    const chosen = pages.filter((p) => (id ? p.id === id : p.selected));
    if (!chosen.length) return;
    if (countEdits(edits, chosen)) {
      toast.info(
        ui(
          'Bitte die visuellen Änderungen zuerst anwenden. Danach kannst du das Ergebnis weiterbearbeiten und drehen.',
        ),
      );
      return;
    }
    commit(
      {
        pages: pages.map((p) =>
          chosen.some((c) => c.id === p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
        ),
        edits,
      },
      chosen.length === 1
        ? t('Seite gedreht', 'Page rotated')
        : t(`${chosen.length} Seiten gedreht`, `${chosen.length} pages rotated`),
    );
  }
  function duplicate(id: string) {
    if (pages.length >= MAX_PAGES) {
      toast.error(ui('Maximal 200 Seiten.'));
      return;
    }
    const index = pages.findIndex((p) => p.id === id),
      copy = { ...pages[index], id: uid() };
    const next = [...pages];
    next.splice(index + 1, 0, copy);
    const nextEdits = structuredClone(edits);
    if (edits.marks[id])
      nextEdits.marks[copy.id] = edits.marks[id].map((m) => ({ ...m, id: uid() }));
    if (edits.crops[id]) nextEdits.crops[copy.id] = { ...edits.crops[id] };
    commit({ pages: next, edits: nextEdits }, t('Seite dupliziert', 'Page duplicated'));
    setActiveId(copy.id);
  }
  function deletePage(id: string) {
    if (!pages.some((page) => page.id === id)) return;
    commit({ pages: pages.filter((p) => p.id !== id), edits }, t('Seite entfernt', 'Page removed'));
  }
  function applyRange() {
    try {
      const selection = selectRange(range, pages.length);
      commit({ pages: pages.map((p, i) => ({ ...p, selected: selection.has(i) })), edits });
    } catch (err) {
      toast.error(ui((err as Error).message));
    }
  }
  function mark(mark: Mark) {
    if (!activePage) return;
    setSelectedMarkId(mark.id);
    commit({
      pages,
      edits: {
        ...edits,
        marks: { ...edits.marks, [activePage.id]: [...(edits.marks[activePage.id] || []), mark] },
      },
    });
  }
  function crop(rect: Rect) {
    if (!activePage) return;
    commit({ pages, edits: { ...edits, crops: { ...edits.crops, [activePage.id]: rect } } });
  }
  function removeMark(id: string) {
    if (!activePage) return;
    const group = pageMarks.find((m) => m.id === id)?.changeGroup;
    setSelectedMarkId('');
    commit({
      pages,
      edits: {
        ...edits,
        marks: Object.fromEntries(
          Object.entries(edits.marks).map(([pageId, marks]) => [
            pageId,
            marks.filter((m) => (group ? m.changeGroup !== group : m.id !== id)),
          ]),
        ),
      },
    });
  }
  const textSelection = useRef<EditorSelection | null>(null);
  const typingHistory = useRef<{ id: string; edits: Edits; time: number } | null>(null);
  function patchMark(id: string, patch: Partial<Mark>, mode?: 'typing') {
    if (!activePage || locked) return;
    const old = pageMarks.find((m) => m.id === id);
    if (!old) return;
    if (old.nativeTable || old.tableCell?.deleted) return;
    if (old.tableCell) {
      patch = { ...patch };
      for (const key of [
        'x',
        'y',
        'w',
        'h',
        'textRotation',
        'sourceRect',
        'sourceRects',
        'tableCell',
      ] as const)
        delete patch[key];
    }
    patch = applyEditorPatch(old, patch, textSelection.current);
    const next = { ...old, ...patch };
    if (JSON.stringify(old) === JSON.stringify(next)) return;
    const nextEdits = {
      ...edits,
      marks: { ...edits.marks, [activePage.id]: pageMarks.map((m) => (m.id === id ? next : m)) },
    };
    const now = Date.now(),
      previous = typingHistory.current;
    if (
      mode === 'typing' &&
      previous?.id === id &&
      previous.edits === edits &&
      now - previous.time < 1500
    ) {
      dismissUndoNotice();
      setEdits(nextEdits);
      setFuture([]);
      invalidate();
    } else commit({ pages, edits: nextEdits });
    typingHistory.current = mode === 'typing' ? { id, edits: nextEdits, time: now } : null;
  }

  function replacePageMarks(remove: string[], add: Mark[]) {
    if (!activePage || locked) return;
    typingHistory.current = null;
    textSelection.current = null;
    const groups = new Set(
      pageMarks.filter((m) => remove.includes(m.id) && m.changeGroup).map((m) => m.changeGroup!),
    );
    const group = groups.size ? uid() : add.find((m) => m.changeGroup)?.changeGroup;
    const linked = Object.fromEntries(
      Object.entries(edits.marks).map(([pageId, marks]) => [
        pageId,
        marks.map((m) =>
          group && m.changeGroup && groups.has(m.changeGroup) ? { ...m, changeGroup: group } : m,
        ),
      ]),
    );
    if (group) add = add.map((m) => ({ ...m, changeGroup: group }));
    commit({
      pages,
      edits: {
        ...edits,
        marks: {
          ...linked,
          [activePage.id]: [
            ...(linked[activePage.id] || []).filter((m) => !remove.includes(m.id)),
            ...add,
          ],
        },
      },
    });
    setSelectedMarkId(add[0]?.id || '');
  }

  function newText() {
    if (locked) return;
    setEditorAction('select');
    mark({
      id: uid(),
      kind: 'text',
      x: 0.12,
      y: 0.18,
      w: 0.64,
      h: 0.15,
      text: ui('Dein Text'),
      fontScale: 16 / editorDims.width,
      fontFamily: 'sans',
      fontChoice: 'auto',
      color: '#222222',
    });
    setView('document');
  }
  function newErase() {
    if (locked) return;
    setEditorAction('select');
    mark({ id: uid(), kind: 'erase', x: 0.12, y: 0.18, w: 0.4, h: 0.08, fill: '#ffffff' });
    setView('document');
  }
  function duplicateMark() {
    if (!selectedMark || locked) return;
    const copy = {
      ...selectedMark,
      ...fitRect({
        ...selectedMark,
        x: Math.min(1 - selectedMark.w, selectedMark.x + 0.02),
        y: Math.min(1 - selectedMark.h, selectedMark.y + 0.02),
      }),
      id: uid(),
    };
    delete copy.sourceRect;
    delete copy.sourceRects;
    delete copy.originalState;
    delete copy.originalText;
    delete copy.changeGroup;
    delete copy.flow;
    delete copy.nativeImage;
    mark(copy);
  }
  async function insertImage(file: File) {
    if (locked || !activePage) return;
    setImageBusy(true);
    setError('');
    let bitmap: ImageBitmap | undefined;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Bitte ein Bild mit maximal 8 MB wählen.');
      if (!/image\/(png|jpeg|webp)/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name))
        throw new Error('Bitte PNG, JPG oder WebP wählen.');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 36000000)
        throw new Error('Das Bild ist zu groß. Bitte auf höchstens 36 Megapixel verkleinern.');
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/png');
      canvas.width = canvas.height = 0;
      if (
        Object.values(edits.marks)
          .flat()
          .reduce((n, m) => n + (m.image?.length || 0), image.length) >
        32 * 1024 * 1024
      )
        throw new Error(
          'Die eingefügten Bilder sind zusammen zu groß. Bitte kleinere Bilder verwenden.',
        );
      let w = 0.45,
        h = (w * editorDims.width) / editorDims.height / (bitmap.width / bitmap.height);
      if (h > 0.6) {
        w *= 0.6 / h;
        h = 0.6;
      }
      mark({ id: uid(), kind: 'image', x: 0.12, y: 0.18, w, h, image, opacity: 1 });
      setEditorAction('select');
      setView('document');
      toast.success(ui('Bild eingefügt'));
    } catch (err) {
      toast.error(ui('Bild konnte nicht eingefügt werden'), {
        description: ui((err as Error).message),
      });
    } finally {
      bitmap?.close();
      setImageBusy(false);
    }
  }
  function clearCrop() {
    if (!activePage) return;
    const next = { ...edits.crops };
    delete next[activePage.id];
    commit({ pages, edits: { ...edits, crops: next } });
  }
  function removeFile(id: string) {
    if (locked) return;
    setDocumentSessions((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setSources((old) => old.filter((s) => s.id !== id));
    setPages((old) => old.filter((p) => p.sourceId !== id));
    setEdits(
      retainPageEdits(
        edits,
        pages.filter((p) => p.sourceId !== id),
      ),
    );
    setHistory([]);
    setFuture([]);
    invalidate();
  }
  function clear() {
    workspaceResults.clear();
    window.dispatchEvent(new Event('moinpdf-clear-workspace'));
    setProjectCheckpoint(null);
    setRepairInput(null);
    setConversionInput(null);
    setDocumentSessions({});
    setArchivedSources([]);
    setSources([]);
    setPages([]);
    setEdits(emptyEdits());
    setResult(null);
    setHistory([]);
    setFuture([]);
    setView('pages');
    setError('');
  }
  async function demo() {
    if (locked) return;
    try {
      await addFiles([await makeDemoFile(language)], false);
    } catch {
      toast.error(ui('Das Beispieldokument konnte nicht geöffnet werden.'));
    }
  }
  async function blank() {
    if (locked) return;
    await addFiles([await makeBlankFile(false, language)], false);
  }
  async function process() {
    if (locked || !selected.length || !hasNeededEdit) return;
    if (toolId === 'watermark' && !options.watermark.trim()) {
      setError('Bitte einen Text für das Wasserzeichen eingeben.');
      return;
    }
    if (
      toolId === 'numbers' &&
      (!Number.isInteger(options.numberStart) ||
        options.numberStart < 1 ||
        options.numberStart > 99999)
    ) {
      setError('Startnummer: 1 bis 99999.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    setProgress({ percent: 0, label: 'Dokument vorbereiten …' });
    const ctrl = new AbortController();
    job.current = ctrl;
    try {
      const output = await runStudioJob(
        toolId === 'inspect' ? 'organize' : toolId,
        sources,
        selected,
        options,
        edits,
        setProgress,
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      if (output.report) {
        output.text = reportText(output.report, ui);
        output.filename = ui(output.filename);
        output.blob = new Blob([output.text], { type: 'text/plain;charset=utf-8' });
      }
      setResult(output);
      setResultText(output.text || '');
      setView('result');
      toast.success(ui('Fertig. Dein Ergebnis ist bereit.'));
    } catch (err) {
      if (ctrl.signal.aborted) toast.info(ui('Abgebrochen. Deine Bearbeitung bleibt geöffnet.'));
      else {
        setError((err as Error).message);
        toast.error(ui('Verarbeitung fehlgeschlagen'), {
          description: ui((err as Error).message),
          duration: 8000,
        });
      }
    } finally {
      setBusy(false);
      job.current = null;
    }
  }
  function selectFound(ids: string[], exclude = false) {
    const found = new Set(ids);
    commit({
      pages: pages.map((p) => ({
        ...p,
        selected: exclude ? p.selected && !found.has(p.id) : found.has(p.id),
      })),
      edits,
    });
    toast.success(exclude ? ui('Seitenauswahl angepasst') : ui('Fundstellen ausgewählt'));
  }
  async function collectFound(ids: string[]) {
    const found = new Set(ids),
      items = pages.filter((p) => found.has(p.id));
    if (locked || !items.length) return;
    setBusy(true);
    setError('');
    setResult(null);
    setProgress({ percent: 0, label: 'Fundstellen sammeln …' });
    const ctrl = new AbortController();
    job.current = ctrl;
    try {
      const output = await runStudioJob(
        'organize',
        sources,
        items,
        options,
        edits,
        setProgress,
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      setResult({ ...output, filename: ui('Fundstellen.pdf') });
      setResultText('');
      setView('result');
      toast.success(ui(`${items.length} Fundstellen in einer PDF gesammelt`));
    } catch (err) {
      if (ctrl.signal.aborted) toast.info(ui('Abgebrochen. Deine Dokumente bleiben geöffnet.'));
      else setError((err as Error).message);
    } finally {
      setBusy(false);
      job.current = null;
    }
  }
  async function adoptDocumentResult(output: JobResult) {
    setLoading(true);
    try {
      const next = await openSource(
        new File([output.blob], output.filename, { type: 'application/pdf' }),
      );
      const nextPages = sourcePages(next);
      setArchivedSources(projectSources);
      sourcePool.current.set(next.id, next);
      setSources([next]);
      setPages(nextPages);
      setActiveId(nextPages[0].id);
      setEdits(emptyEdits());
      setDocumentSessions({});
      setHistory(boundedHistory([...history, snapshot()], [next], [...projectSources, next]));
      setFuture([]);
      setResult(null);
      setToolId('organize');
      setView('pages');
      setRange('');
      toast.success(ui('Ergebnis als neues Arbeitsdokument geöffnet'));
    } finally {
      setLoading(false);
    }
  }
  async function continueResult() {
    if (!result || result.kind !== 'pdf' || locked) return;
    try {
      await adoptDocumentResult({ ...result, filename: resultName });
    } catch (error) {
      toast.error(ui((error as Error).message));
    }
  }
  useEffect(() => {
    const continueFromResult = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.result?.blob?.type?.includes('pdf') || continuingResult.current) return;
      if (locked) {
        toast.info(
          t(
            'Bitte warte, bis die aktuelle Verarbeitung abgeschlossen ist.',
            'Please wait for the current operation to finish.',
          ),
        );
        return;
      }
      if (detail.tool !== 'project' && !tools.some((tool) => tool.id === detail.tool)) return;
      continuingResult.current = true;
      void (async () => {
        try {
          await adoptDocumentResult({
            ...detail.result,
            kind: 'pdf',
            pages: detail.result.pages || 0,
            inputSize: detail.result.inputSize || detail.result.blob.size,
          });
          if (detail.tool === 'project') setProjectsOpen(true);
          else showTool(detail.tool);
        } catch (error) {
          toast.error(ui((error as Error).message));
        } finally {
          continuingResult.current = false;
        }
      })();
    };
    window.addEventListener('moinpdf-continue-result', continueFromResult);
    return () => window.removeEventListener('moinpdf-continue-result', continueFromResult);
  });
  async function word() {
    setWordBusy(true);
    try {
      await downloadWord(resultText, `${filenameStem(resultName)}.docx`);
    } catch {
      toast.error(ui('Word-Export fehlgeschlagen.'));
    } finally {
      setWordBusy(false);
    }
  }
  function placeManual() {
    const r = normalizedRect(
      { x: manualRect.x, y: manualRect.y },
      { x: manualRect.x + manualRect.w, y: manualRect.y + manualRect.h },
    );
    if (r.w < 0.01 || r.h < 0.01) {
      toast.error(ui('Bitte einen größeren Bereich wählen.'));
      return;
    }
    if (editMode === 'crop') crop(r);
    else if (editMode === 'text')
      mark({ ...r, id: uid(), kind: 'text', text: noteText, fontScale: fontSize / 595.28 });
    else if (editMode === 'signature' && signature)
      mark({ ...r, id: uid(), kind: 'signature', image: signature.image });
    else if (editMode === 'redact' || editMode === 'highlight')
      mark({ ...r, id: uid(), kind: editMode });
  }
  const agentActions = useRef({
    chooseTool,
    applyRange: (value: string) => {
      const s = selectRange(value, pages.length);
      commit({ pages: pages.map((p, i) => ({ ...p, selected: s.has(i) })), edits });
    },
  });
  agentActions.current = {
    chooseTool,
    applyRange: (value: string) => {
      const s = selectRange(value, pages.length);
      commit({ pages: pages.map((p, i) => ({ ...p, selected: s.has(i) })), edits });
    },
  };
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: Record<string, unknown>,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    const register = (config: Record<string, unknown>) => {
      try {
        Promise.resolve(context.registerTool(config, { signal: life.signal })).catch(() => {});
      } catch {}
    };
    register({
      name: 'get_pdf_workspace',
      description:
        'Read filenames, page count, selection and pending edit count. Does not transmit document contents.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({
        files: refs.current.sources.map((s) => ({ name: s.name, pages: s.pdf.numPages })),
        pages: refs.current.pages.length,
        selected: refs.current.pages.flatMap((p, i) => (p.selected ? [i + 1] : [])),
        edits: countEdits(refs.current.edits, refs.current.pages),
        busy: refs.current.busy,
      }),
    });
    register({
      name: 'configure_pdf_workspace',
      description:
        'Select an existing tool and optional page range. Does not process or download files.',
      inputSchema: {
        type: 'object',
        properties: {
          tool: { type: 'string', enum: tools.map((t) => t.id) },
          pageRange: { type: 'string' },
        },
        required: ['tool'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => {
        const v = input as { tool: WorkspaceTool; pageRange?: string };
        if (!v || !tools.some((t) => t.id === v.tool)) throw new Error('Unbekanntes Werkzeug.');
        if (refs.current.busy) throw new Error('Verarbeitung läuft.');
        if (
          !refs.current.sources.length &&
          !['camera-scan', 'office-pdf', 'email-pdf', 'html-pdf', 'word-mail-merge'].includes(
            v.tool,
          )
        )
          throw new Error('Bitte zuerst ein Dokument öffnen.');
        if (v.pageRange !== undefined) {
          if (typeof v.pageRange !== 'string') throw new Error('Ungültiger Seitenbereich.');
          selectRange(v.pageRange, refs.current.pages.length);
        }
        agentActions.current.chooseTool(v.tool);
        if (v.pageRange !== undefined) agentActions.current.applyRange(v.pageRange);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return {
          tool: v.tool,
          selected: refs.current.pages.flatMap((p, i) => (p.selected ? [i + 1] : [])),
        };
      },
    });
    return () => life.abort();
  }, [tools]);
  const renderChoice = (
    key:
      | 'ocrLayout'
      | 'language'
      | 'imageFormat'
      | 'quality'
      | 'pageSize'
      | 'orientation'
      | 'perSheet',
    label: string,
    items: [string, string][],
  ) => (
    <label className="field">
      <span>{ui(label)}</span>
      <Select
        value={options[key]}
        onValueChange={(v) => setOptions({ ...options, [key]: v })}
        disabled={locked}
      >
        <SelectTrigger aria-label={ui(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {ui(text)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  const homeVisible =
    !writerOpen && (homeRequested || (!sources.length && choosingTool && !browseEmpty));
  function showTools() {
    if (locked) return;
    setWriterOpen(false);
    setHomeRequested(false);
    setBrowseEmpty(true);
    setChoosingTool(true);
    setOpenMobile(false);
    toolNavigation.restore('all');
    requestAnimationFrame(() => {
      document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
    });
  }
  function returnToTools() {
    if (locked) return;
    const surface = toolNavigation.restore();
    setHomeRequested(surface === 'home');
    setBrowseEmpty(true);
    setChoosingTool(true);
    setOpenMobile(false);
  }
  const fileInput = (
    <>
      {writerHost &&
        createPortal(
          <button
            type="button"
            className="document-create-toggle"
            disabled={locked}
            aria-pressed={writerOpen}
            aria-label={t('Neues Dokument')}
            title={t('Neues Dokument')}
            onClick={() => {
              if (!writerDocument)
                setWriterDocument(emptyWriterDocument(t('Mein Dokument', 'My document')));
              setWriterOpen(true);
              setOpenMobile(false);
              requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
            }}
          >
            <FilePlus2 size={19} aria-hidden="true" />
            <span>{t('Neues Dokument')}</span>
          </button>,
          writerHost,
        )}
      <HarborNavigation
        home={homeVisible}
        creating={writerOpen}
        locked={locked}
        onHome={() => {
          if (locked) return;
          toolNavigation.resetRestore();
          setWriterOpen(false);
          setHomeRequested(true);
          setChoosingTool(true);
          setOpenMobile(false);
          requestAnimationFrame(() => {
            document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: 'instant' });
          });
        }}
        onTools={showTools}
        onChoose={chooseTool}
        editorActions={
          isEditor && !choosingTool && sources.length > 0 ? (
            <>
              <button
                type="button"
                className="harbor-nav-item"
                disabled={locked}
                onClick={showTools}
              >
                <LayoutGrid size={21} />
                <span>{t('Werkzeuge', 'Tools')}</span>
              </button>
              <button
                type="button"
                className="harbor-nav-item"
                disabled={locked || !history.length}
                onClick={undo}
              >
                <Undo2 size={21} />
                <span>{t('Rückgängig', 'Undo')}</span>
              </button>
              <button
                id="mobile-editor-format"
                type="button"
                className="harbor-nav-item"
                disabled={locked}
                aria-haspopup="dialog"
                aria-expanded={editorSettingsOpen}
                onClick={() => setEditorSettingsOpen(true)}
              >
                <Settings2 size={21} />
                <span>{t('Format', 'Format')}</span>
              </button>
              {view === 'result' && resultUrl ? (
                <a
                  className="harbor-nav-item editor-mobile-primary"
                  href={resultUrl}
                  download={resultName}
                >
                  <Download size={21} />
                  <span>{t('PDF herunterladen', 'Download PDF')}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="harbor-nav-item editor-mobile-primary"
                  aria-label={
                    busy ? t('Abbrechen') : t('Bearbeitete PDF erstellen', 'Create edited PDF')
                  }
                  disabled={
                    !busy && (locked || !selected.length || !hasNeededEdit || documentIndex.ocrBusy)
                  }
                  onClick={() => (busy ? job.current?.abort() : void process())}
                >
                  {busy ? <X size={21} /> : <Check size={21} />}
                  <span>{busy ? t('Abbrechen', 'Cancel') : t('PDF erstellen', 'Create PDF')}</span>
                </button>
              )}
            </>
          ) : undefined
        }
        projectsOpen={projectsOpen}
        onProjects={() => {
          if (!locked) setProjectsOpen(true);
        }}
      />
      <input
        ref={picker}
        type="file"
        accept={documentAccept}
        multiple
        className="sr-only"
        aria-label={ui('PDFs, Office-Dateien, E-Mails, E-Books oder Bilder auswählen')}
        disabled={locked}
        onChange={(e) => {
          void addFiles(Array.from(e.target.files || []), choosingTool);
          e.target.value = '';
        }}
      />
      <PasswordPrompt request={passwordRequest} onClose={() => setPasswordRequest(null)} />
      <DuplicatePrompt request={duplicateRequest} onClose={() => setDuplicateRequest(null)} />
      <Dialog
        open={!!pendingTool}
        onOpenChange={(open) => {
          if (!open) setPendingTool(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Arbeitsstand übernehmen', 'Apply workspace changes')}</DialogTitle>
            <DialogDescription>
              {ui(pendingToolReason)}{' '}
              {t(
                'Der bisherige Stand bleibt über Rückgängig erreichbar.',
                'The previous state remains available through Undo.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="advanced-actions">
            <Button variant="outline" onClick={() => setPendingTool(null)}>
              {t('Zur Bearbeitung', 'Back to editing')}
            </Button>
            <Button
              disabled={locked}
              onClick={() => pendingTool && void prepareWorkspace(pendingTool, true)}
            >
              {t('Übernehmen und weiter', 'Apply and continue')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WorkspaceTray
        locked={locked}
        onUse={adoptDocumentResult}
        activeJob={busy ? progress : undefined}
      />
      <WorkspaceRecovery
        sources={projectSources}
        state={projectState}
        locked={locked}
        onStatus={setRecoveryStatus}
        onRestore={(loaded, state) => {
          setArchivedSources(loaded);
          setSources(loaded.filter((s) => !state.sourceIds || state.sourceIds.includes(s.id)));
          setPages(state.pages);
          setEdits(state.edits);
          setOptions({ ...defaults, ...state.options });
          setHistory(state.history);
          setFuture(state.future);
          setDocumentSessions(state.documentSessions);
          setActiveId(state.activeId);
          setToolId(
            tools.some((t) => t.id === state.toolId) ? (state.toolId as WorkspaceTool) : 'inspect',
          );
          setHomeRequested(false);
          setChoosingTool(true);
          setResult(null);
        }}
      />
      <ProjectManager
        open={projectsOpen}
        onOpenChange={setProjectsOpen}
        identity={projectIdentity}
        setIdentity={setProjectIdentity}
        checkpoint={projectCheckpoint}
        onCheckpoint={setProjectCheckpoint}
        onBusy={setProjectBusy}
        sources={projectSources}
        locked={locked}
        state={projectState}
        onRestore={(loaded, state, identity) => {
          setWriterOpen(false);
          const restoredState = { ...state, options: { ...defaults, ...state.options } };
          setProjectIdentity(identity);
          setProjectCheckpoint(
            captureProjectCheckpoint(identity.id, identity.name, loaded, restoredState),
          );
          setHomeRequested(false);
          setArchivedSources(loaded);
          const activeSources = state.sourceIds || loaded.map((s) => s.id);
          setSources(loaded.filter((s) => activeSources.includes(s.id)));
          setPages(state.pages);
          setEdits(state.edits);
          setOptions(restoredState.options);
          setHistory(state.history);
          setFuture(state.future);
          setDocumentSessions(state.documentSessions);
          setActiveId(state.activeId);
          setToolId(
            tools.some((t) => t.id === state.toolId) ? (state.toolId as WorkspaceTool) : 'inspect',
          );
          setResult(null);
          setError('');
          setChoosingTool(true);
          setSelectedMarkId('');
        }}
      />
    </>
  );
  if (writerOpen && writerDocument)
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <Suspense
          fallback={
            <div className="tool-loading" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>{t('Editor wird geladen …', 'Loading editor …')}</p>
            </div>
          }
        >
          <DocumentWriter
            initial={writerDocument}
            onChange={setWriterDocument}
            onBusy={setDocumentBusy}
            onSaved={setWriterSavedRevision}
            onBack={() => setWriterOpen(false)}
          />
        </Suspense>
      </>
    );
  if (homeVisible)
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <UploadEntry
          dragOver={dragOver}
          dragFileCount={dragFileCount}
          loading={locked}
          state={importState}
          onOpen={() => picker.current?.click()}
          onCamera={() => chooseTool('camera-scan')}
          onOffice={() => chooseTool('office-pdf')}
          onEmail={() => chooseTool('email-pdf')}
          onTools={showTools}
          onChoose={chooseTool}
          fileCount={sources.length}
        />
      </>
    );
  if (!choosingTool && isAdvancedTool(toolId))
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <AdvancedWorkbench
          key={toolId}
          initialFile={toolId === 'pdf-repair' ? repairInput : null}
          tool={toolId}
          sources={sources}
          onBack={returnToTools}
          onAdd={() => picker.current?.click()}
          onBusy={setDocumentBusy}
          onUse={adoptDocumentResult}
          pending={
            pages.some((p) => countEdits(edits, [p]) > 0 || p.rotation !== 0) ||
            Object.values(documentSessions).some((s) => s.past.length > 0)
          }
        />
      </>
    );
  if (!choosingTool && isServerTool(toolId))
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <ServerWorkbench
          key={toolId}
          tool={toolId}
          sources={sources}
          initialFile={conversionInput?.tool === toolId ? conversionInput.file : null}
          onChoose={chooseTool}
          onBack={returnToTools}
          onAdd={() => picker.current?.click()}
          onBusy={setDocumentBusy}
          onUse={adoptDocumentResult}
        />
      </>
    );
  if (choosingTool)
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <ToolChooser
          sources={sources}
          pageCount={pages.length}
          locked={locked}
          loading={loading}
          dragOver={dragOver}
          dragFileCount={dragFileCount}
          onChoose={chooseTool}
          onAdd={() => picker.current?.click()}
          onRemove={removeFile}
          onClear={clear}
        />
      </>
    );
  if (!pages.length)
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <ToolFileEntry
          tool={tool}
          locked={locked}
          loading={loading}
          dragOver={dragOver}
          dragFileCount={dragFileCount}
          onBack={returnToTools}
          onAdd={() => picker.current?.click()}
          onDemo={demo}
          onBlank={blank}
          onUndo={history.length ? undo : undefined}
          onRedo={future.length ? redo : undefined}
        />
      </>
    );
  if (isDocumentTool(toolId))
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <DocumentWorkbench
          tool={toolId}
          sources={sources}
          sessions={documentSessions}
          onSessions={setDocumentSessions}
          onBack={returnToTools}
          onTool={chooseTool}
          onUse={adoptDocumentResult}
          onBusy={setDocumentBusy}
          pending={pages.some((p) => countEdits(edits, [p]) > 0 || p.rotation !== 0)}
        />
      </>
    );
  if (toolId === 'protect' || toolId === 'unlock')
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <SecurityWorkbench
          tool={toolId}
          sources={sources}
          onBack={returnToTools}
          onTool={chooseTool}
          onBusy={setDocumentBusy}
          onUse={adoptDocumentResult}
          pending={
            pages.some((p) => countEdits(edits, [p]) > 0 || p.rotation !== 0) ||
            Object.values(documentSessions).some((s) => s.past.length > 0)
          }
        />
      </>
    );
  if (toolId === 'invoice-read' || toolId === 'invoice-check')
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <InvoiceWorkbench
          tool={toolId}
          sources={sources}
          onBack={returnToTools}
          onTool={chooseTool}
          onBusy={setDocumentBusy}
          onAdd={() => picker.current?.click()}
        />
      </>
    );
  const toolMatches = new Set(searchTools(search, tools).map((t) => t.id));
  return (
    <>
      <Toaster position="bottom-right" richColors closeButton />
      {fileInput}
      <input
        ref={imagePicker}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        aria-label={ui('Bild zum Einfügen auswählen')}
        disabled={locked}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void insertImage(file);
          e.target.value = '';
        }}
      />
      <Sidebar className="studio-sidebar" collapsible="offcanvas">
        <SidebarHeader className="sidebar-brand">
          <div className="sidebar-caption">
            <FileText size={21} strokeWidth={1.5} />
            <span>{t('Werkzeuge')}</span>
          </div>
          <div className="tool-search">
            <Search size={16} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Werkzeug finden')}
              aria-label={t('Werkzeuge durchsuchen')}
            />
          </div>
        </SidebarHeader>
        <SidebarContent className="tool-navigation">
          {groups.map((group, index) => {
            const items = tools.filter(
              (t) => t.group === index && (!search.trim() || toolMatches.has(t.id)),
            );
            return items.length ? (
              <SidebarGroup key={group}>
                <SidebarGroupLabel>
                  <span>0{index + 1}</span>
                  {group}
                </SidebarGroupLabel>
                <SidebarMenu>
                  {items.map((t) => (
                    <SidebarMenuItem key={t.id}>
                      <SidebarMenuButton
                        isActive={toolId === t.id}
                        disabled={locked}
                        onClick={() => chooseTool(t.id)}
                        className="tool-row"
                        title={t.title}
                      >
                        <t.icon size={18} />
                        <span>
                          <SearchHighlight text={t.title} query={search} />
                        </span>
                        {'fresh' in t && <span className="new-tick" aria-label={ui('Neu')} />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ) : null;
          })}
          {search.trim() && !toolMatches.size && (
            <p className="no-tools">{t('Kein passendes Werkzeug gefunden.')}</p>
          )}
        </SidebarContent>
        <SidebarFooter className="sidebar-bottom">
          <button onClick={() => setHelp('privacy')}>
            <ShieldCheck size={16} />
            <span>{t('Lokal. Privat. Bei dir.')}</span>
          </button>
          <button onClick={() => setHelp('help')}>
            <CircleHelp size={16} />
            <span>{t('Hilfe & Tastenkürzel')}</span>
            <small>
              {tools.length} {ui(' Tools')}
            </small>
          </button>
        </SidebarFooter>
      </Sidebar>
      <main
        className={`studio-main ${toolId === 'compress' ? 'compression-workspace' : ''} ${isEditor ? 'editor-workspace' : ''}`}
      >
        <WorkspaceContext
          sources={sources}
          pageCount={pages.length}
          locked={locked}
          onAdd={() => picker.current?.click()}
        />
        <header className="studio-topbar">
          <div className="workspace-brand">
            <SidebarTrigger aria-label={ui('Werkzeugleiste einblenden')} />
            <button className="back-to-tools" onClick={returnToTools} disabled={locked}>
              {t('Werkzeug wechseln')}
            </button>
            <span className="header-slash">/</span>
            <strong>
              {sources.length
                ? `${sources.length} ${sources.length === 1 ? t('Dokument') : ui('Dokumente')}`
                : t('Neues Dokument')}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="device-tag">
              <ShieldCheck size={14} />
              {t('OHNE DOKUMENTEN-UPLOAD')}
            </span>
            <Button
              className="open-button"
              disabled={locked}
              onClick={() => picker.current?.click()}
            >
              <Plus size={18} />
              <span>{t('Dateien öffnen')}</span>
            </Button>
          </div>
        </header>
        <div className="studio-titlebar">
          <div>
            <div className="studio-kicker">{t('DEIN ARBEITSBEREICH')}</div>
            <h1>
              <tool.icon size={29} strokeWidth={1.5} />
              {ui(tool.title)}
            </h1>
            <p className="workspace-tool-description">
              {toolId === 'compress'
                ? t('Kleiner machen. Gut lesbar bleiben.', 'Smaller files. Clear documents.')
                : ui(tool.description)}
            </p>
          </div>
          <div className="history-tools">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Rückgängig')}
              title={ui('Rückgängig · Strg+Z')}
              disabled={!history.length || locked}
              onClick={undo}
            >
              <Undo2 size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Wiederholen')}
              title={ui('Wiederholen · Strg+Umschalt+Z')}
              disabled={!future.length || locked}
              onClick={redo}
            >
              <Redo2 size={18} />
            </Button>
            <div className="history-separator" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('Arbeitsbereich leeren')}
                  disabled={!sources.length || locked}
                >
                  <Trash2 size={18} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Arbeitsbereich leeren?')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'Geöffnete Dokumente, Änderungen und Ergebnisse werden aus dieser Sitzung entfernt. Deine Originaldateien bleiben erhalten.',
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Behalten')}</AlertDialogCancel>
                  <AlertDialogAction onClick={clear}>{t('Leeren')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="studio-layout">
          <section className="workstage">
            <Tabs value={view} onValueChange={setView} className="view-tabs">
              <div className="stage-toolbar">
                <TabsList variant="line">
                  <TabsTrigger
                    value="check"
                    className={toolId === 'compress' ? 'compression-check-tab' : undefined}
                  >
                    <FileSearch size={15} />
                    <span>{ui('Check')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pages">
                    <LayoutGrid size={15} />
                    <span>{t('Seiten')}</span>
                    {pages.length > 0 && <small>{pages.length}</small>}
                  </TabsTrigger>
                  <TabsTrigger value="document" disabled={!pages.length}>
                    <FileText size={15} />
                    <span>{t('Vorschau', 'Preview')}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="result"
                    disabled={!result}
                    className={!result ? 'workspace-result-unavailable' : undefined}
                  >
                    <CheckCheck size={15} />
                    <span>{t('Ergebnis')}</span>
                  </TabsTrigger>
                </TabsList>
                <span className="stage-format">
                  {pages.length ? ui(`${selected.length} AUSGEWÄHLT`) : ui('PDF · JPG · PNG')}
                </span>
              </div>
              {sources.length > 0 && (
                <div className="file-strip">
                  {sources.map((s) => (
                    <div className="file-tab" key={s.id}>
                      <FileText size={14} />
                      <span title={s.name}>{s.name}</span>
                      <FileArrivalCheck file={s} />
                      <button
                        disabled={locked}
                        onClick={() => removeFile(s.id)}
                        aria-label={ui(`${s.name} schließen`)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="file-add"
                    onClick={() => picker.current?.click()}
                    disabled={locked}
                    aria-label={t('Dateien hinzufügen')}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              )}
              {pages.length > 0 && (
                <>
                  <TabsContent value="check" className="check-view">
                    <Suspense
                      fallback={
                        <div className="tool-loading" role="status">
                          <LoaderCircle className="spin" size={24} />
                          <p>{t('Werkzeug wird geladen …')}</p>
                        </div>
                      }
                    >
                      <DocumentCheck
                        index={documentIndex}
                        pages={pages}
                        locked={locked}
                        editedPageIds={pages
                          .filter((p) => countEdits(edits, [p]) > 0)
                          .map((p) => p.id)}
                        language={options.language}
                        onOpen={(id) => {
                          setActiveId(id);
                          setView('document');
                        }}
                        onSelect={selectFound}
                        onCollect={collectFound}
                        onTool={chooseTool}
                      />
                    </Suspense>
                  </TabsContent>
                  <TabsContent value="pages" className="page-overview">
                    <div className="selection-toolbar">
                      <label>
                        <Checkbox
                          checked={
                            selected.length === pages.length
                              ? true
                              : selected.length
                                ? 'indeterminate'
                                : false
                          }
                          disabled={locked}
                          onCheckedChange={(v) =>
                            commit({
                              pages: pages.map((p) => ({ ...p, selected: v === true })),
                              edits,
                            })
                          }
                        />
                        {t('Alle')}
                      </label>
                      <div className="selection-range">
                        <Input
                          aria-label={ui('Seitenbereich')}
                          value={range}
                          onChange={(e) => setRange(e.target.value.replace(/[–—]/g, '-'))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') applyRange();
                          }}
                          placeholder="1, 3–5"
                          disabled={locked}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={ui('Seitenbereich anwenden')}
                          disabled={locked}
                          onClick={applyRange}
                        >
                          <Check size={16} />
                        </Button>
                      </div>
                      <div className="page-batch-tools">
                        <Button
                          aria-label={ui('Ausgewählte Seiten drehen')}
                          variant="ghost"
                          size="sm"
                          disabled={!selected.length || locked}
                          onClick={() => rotate()}
                        >
                          <RotateCw size={15} />
                          <span>{t('Drehen')}</span>
                        </Button>
                        <Button
                          aria-label={ui('Seitenreihenfolge umkehren')}
                          variant="ghost"
                          size="sm"
                          disabled={locked || pages.length < 2}
                          onClick={() =>
                            commit(
                              { pages: [...pages].reverse(), edits },
                              t('Seitenreihenfolge umgekehrt', 'Page order reversed'),
                            )
                          }
                        >
                          <MoveVertical size={15} />
                          <span>{t('Umkehren')}</span>
                        </Button>
                        <Button
                          aria-label={ui('Leerseite einfügen')}
                          variant="ghost"
                          size="sm"
                          disabled={locked}
                          onClick={blank}
                        >
                          <FilePlus2 size={15} />
                          <span>{t('Leerseite')}</span>
                        </Button>
                      </div>
                    </div>
                    <PageReorderGrid pages={pages} locked={locked} onMove={movePage}>
                      {pages.map((page, index) => (
                        <article
                          key={page.id}
                          data-page-id={page.id}
                          className={`page-tile ${page.selected ? 'selected' : ''} ${activePage?.id === page.id ? 'active' : ''}`}
                          draggable={!locked && pages.length > 1}
                        >
                          <div className="tile-top">
                            <Checkbox
                              aria-label={ui(`Seite ${index + 1} auswählen`)}
                              checked={page.selected}
                              disabled={locked}
                              onCheckedChange={(v) =>
                                commit({
                                  pages: pages.map((p) =>
                                    p.id === page.id ? { ...p, selected: v === true } : p,
                                  ),
                                  edits,
                                })
                              }
                            />
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <button
                              type="button"
                              className="page-drag-handle"
                              disabled={locked || pages.length < 2}
                              aria-label={t(
                                `Seite ${index + 1} verschieben`,
                                `Move page ${index + 1}`,
                              )}
                              aria-describedby="page-reorder-hint"
                              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
                            >
                              <GripVertical size={16} aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            className="thumbnail-button"
                            aria-label={ui(`Seite ${index + 1} in Einzelansicht öffnen`)}
                            onClick={() => {
                              setActiveId(page.id);
                              setView('document');
                            }}
                          >
                            <PagePreview
                              source={sources.find((s) => s.id === page.sourceId)!}
                              page={page}
                              small
                            />
                          </button>
                          <div className="tile-caption">
                            <strong>
                              {t('Seite')}
                              {index + 1}
                            </strong>
                            {countEdits(edits, [page]) > 0 && (
                              <span>
                                {countEdits(edits, [page])}
                                {t('Änderungen')}
                              </span>
                            )}
                          </div>
                          <div className="tile-actions">
                            <button
                              aria-label={ui(`Seite ${index + 1} nach vorne`)}
                              data-page-move
                              disabled={locked || index === 0}
                              onClick={() => movePage(page.id, index - 1)}
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <button
                              aria-label={ui(`Seite ${index + 1} drehen`)}
                              disabled={locked}
                              onClick={() => rotate(page.id)}
                            >
                              <RotateCw size={15} />
                            </button>
                            <button
                              aria-label={ui(`Seite ${index + 1} duplizieren`)}
                              disabled={locked}
                              onClick={() => duplicate(page.id)}
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              aria-label={ui(`Seite ${index + 1} entfernen`)}
                              disabled={locked}
                              onClick={() => deletePage(page.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                            <button
                              aria-label={ui(`Seite ${index + 1} nach hinten`)}
                              data-page-move
                              disabled={locked || index === pages.length - 1}
                              onClick={() => movePage(page.id, index + 1)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </article>
                      ))}
                      <button
                        className="add-page-tile"
                        onClick={() => picker.current?.click()}
                        disabled={locked}
                      >
                        <Plus size={29} strokeWidth={1.1} />
                        <span>{t('Dateien hinzufügen')}</span>
                      </button>
                    </PageReorderGrid>
                    <div className="stage-hint" id="page-reorder-hint">
                      <GripVertical size={14} />
                      {t(
                        'Seiten ziehen oder mit den Pfeilen verschieben. Am Griff funktionieren auch die Pfeiltasten sowie Pos1 und Ende.',
                        'Drag pages or use the arrow buttons. On the handle, use the arrow keys, Home or End.',
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="document" className="document-view">
                    {activePage && activeSource && (
                      <>
                        <div className="document-toolbar">
                          <div className="page-pager">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={ui('Vorherige Seite')}
                              disabled={pages.indexOf(activePage) === 0 || locked}
                              onClick={() => setActiveId(pages[pages.indexOf(activePage) - 1].id)}
                            >
                              <ChevronLeft size={17} />
                            </Button>
                            <Select
                              value={activePage.id}
                              onValueChange={setActiveId}
                              disabled={locked}
                            >
                              <SelectTrigger aria-label={ui('Aktuelle Seite')}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {pages.map((p, i) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {t('Seite')}
                                    {i + 1} / {pages.length}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={ui('Nächste Seite')}
                              disabled={pages.indexOf(activePage) === pages.length - 1 || locked}
                              onClick={() => setActiveId(pages[pages.indexOf(activePage) + 1].id)}
                            >
                              <ChevronRight size={17} />
                            </Button>
                          </div>
                          <div className="zoom-controls">
                            <button
                              aria-label={ui('Verkleinern')}
                              disabled={zoom <= (isEditor ? 50 : 60)}
                              onClick={() =>
                                setZoom((v) =>
                                  isEditor
                                    ? [50, 75, 100, 125, 150, 200, 300, 400]
                                        .filter((step) => step < v)
                                        .at(-1) || 50
                                    : Math.max(60, v - 20),
                                )
                              }
                            >
                              <ZoomOut size={16} />
                            </button>
                            {isEditor ? (
                              <select
                                aria-label={ui('Zoom der PDF-Seite')}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                              >
                                {[50, 75, 100, 125, 150, 200, 300, 400].map((step) => (
                                  <option key={step} value={step}>
                                    {step === 100 ? ui('Seitenbreite') : `${step}%`}
                                  </option>
                                ))}
                                {![50, 75, 100, 125, 150, 200, 300, 400].includes(zoom) && (
                                  <option value={zoom}>{zoom}%</option>
                                )}
                              </select>
                            ) : (
                              <span>{zoom}%</span>
                            )}
                            <button
                              aria-label={ui('Vergrößern')}
                              disabled={zoom >= (isEditor ? 400 : 160)}
                              onClick={() =>
                                setZoom((v) =>
                                  isEditor
                                    ? [50, 75, 100, 125, 150, 200, 300, 400].find(
                                        (step) => step > v,
                                      ) || 400
                                    : Math.min(160, v + 20),
                                )
                              }
                            >
                              <ZoomIn size={16} />
                            </button>
                          </div>
                        </div>
                        {toolId !== 'compress' && (
                          <div
                            className={`mode-instruction ${toolId === 'redact' ? 'redact' : ''}`}
                          >
                            <tool.icon size={16} />
                            <span>
                              {isEditor
                                ? toolId === 'edit-text'
                                  ? ui('Textstelle auswählen oder einen Bereich ersetzen.')
                                  : toolId === 'erase'
                                    ? ui('Rahmen um den zu entfernenden Inhalt ziehen.')
                                    : ui('Bild auswählen oder hier auf die Seite ziehen.')
                                : editMode === 'redact'
                                  ? ui('Bereiche zum Schwärzen aufziehen.')
                                  : editMode === 'crop'
                                    ? ui('Ausschnitt auf der Seite aufziehen.')
                                    : editMode === 'text'
                                      ? ui('Auf die Seite klicken, um deine Notiz zu platzieren.')
                                      : editMode === 'highlight'
                                        ? ui('Textbereiche mit der Maus oder dem Finger markieren.')
                                        : editMode === 'signature'
                                          ? signature
                                            ? ui(
                                                'Auf die Seite klicken, um die Unterschrift zu platzieren.',
                                              )
                                            : ui('Erstelle rechts zuerst deine Unterschrift.')
                                          : ui(
                                              'Dokumentvorschau. Wähle links ein Bearbeitungswerkzeug.',
                                            )}
                            </span>
                          </div>
                        )}
                        {!activePage.selected && (
                          <div className="page-unselected">
                            {t('Diese Seite ist nicht für den Export ausgewählt.')}
                            <button
                              onClick={() =>
                                commit({
                                  pages: pages.map((p) =>
                                    p.id === activePage.id ? { ...p, selected: true } : p,
                                  ),
                                  edits,
                                })
                              }
                            >
                              {t('Auswählen')}
                            </button>
                          </div>
                        )}
                        {isEditor && (
                          <EditorToolbar
                            tool={toolId}
                            action={editorAction}
                            disabled={locked}
                            recoveryStatus={recoveryStatus}
                            onSettings={() => {
                              if (window.matchMedia('(max-width: 1100px)').matches)
                                setEditorSettingsOpen(true);
                              else
                                document
                                  .getElementById('editor-settings')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            onAction={setEditorAction}
                            onNewText={newText}
                            onImage={() => imagePicker.current?.click()}
                            onErase={newErase}
                            onSearch={() => setEditorDocumentSearchOpen((old) => !old)}
                          />
                        )}
                        {toolId === 'edit-text' && editorDocumentSearchOpen && (
                          <EditorDocumentSearch
                            sources={sources}
                            pages={pages}
                            edits={edits}
                            language={options.editorLanguage || 'deu+eng'}
                            disabled={locked}
                            onClose={() => {
                              setEditorDocumentSearchOpen(false);
                              setEditorSearchHighlight(null);
                            }}
                            onReveal={(pageId, rect) => {
                              setActiveId(pageId);
                              setSelectedMarkId('');
                              setEditorSearchHighlight({ pageId, rect });
                            }}
                            onApply={(next, fingerprint) => {
                              if (
                                locked ||
                                fingerprint !== editorDocumentFingerprint(sources, pages, edits)
                              )
                                return;
                              typingHistory.current = null;
                              textSelection.current = null;
                              setSelectedMarkId('');
                              setEditorSearchHighlight(null);
                              commit(
                                { pages, edits: next },
                                t(
                                  'Ausgewählte Treffer ersetzt. Rückgängig nimmt die gesamte Ersetzung zurück.',
                                ),
                              );
                            }}
                          />
                        )}
                        <div
                          className={`document-scroll${isEditor ? ' editor-document-scroll' : ''}`}
                          onDragOver={(e) => {
                            if (toolId === 'insert-image') {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOver(false);
                            }
                          }}
                          onDrop={(e) => {
                            if (
                              toolId === 'insert-image' &&
                              Array.from(e.dataTransfer.files).some((f) =>
                                f.type.startsWith('image/'),
                              )
                            ) {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOver(false);
                              const file = Array.from(e.dataTransfer.files).find((f) =>
                                f.type.startsWith('image/'),
                              );
                              if (file) void insertImage(file);
                            }
                          }}
                        >
                          <div
                            className="zoom-frame"
                            style={{ width: `${isEditor ? 100 : zoom}%` }}
                          >
                            {isEditor ? (
                              <Suspense
                                fallback={<p role="status">{ui('Editor wird geladen …')}</p>}
                              >
                                <EditorCanvas
                                  zoom={zoom}
                                  autoOcr={toolId === 'edit-text'}
                                  language={options.editorLanguage || 'deu+eng'}
                                  source={activeSource}
                                  page={activePage}
                                  marks={pageMarks}
                                  crop={edits.crops[activePage.id]}
                                  action={editorAction}
                                  selectedId={selectedMarkId}
                                  disabled={locked}
                                  onMark={mark}
                                  onPatch={patchMark}
                                  onReplaceMarks={replacePageMarks}
                                  onOpenObjects={() => chooseTool('native-objects')}
                                  searchHighlight={
                                    editorSearchHighlight?.pageId === activePage.id
                                      ? editorSearchHighlight.rect
                                      : undefined
                                  }
                                  onSelect={setSelectedMarkId}
                                  onTextSelection={(selection) => {
                                    textSelection.current = selection;
                                  }}
                                  onDimensions={setEditorDims}
                                />
                              </Suspense>
                            ) : (
                              <PageCanvas
                                source={activeSource}
                                page={activePage}
                                marks={pageMarks}
                                crop={edits.crops[activePage.id]}
                                mode={editMode}
                                noteText={noteText}
                                fontSize={fontSize}
                                signature={signature}
                                onMark={mark}
                                onCrop={crop}
                                disabled={locked}
                              />
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="result" className="result-view">
                    {result && (
                      <>
                        <div className="result-banner">
                          <div className="result-check">
                            <JobStatusIcon fresh={resultFresh} />
                          </div>
                          <div>
                            <h2>{t('Erledigt.')}</h2>
                            <ResultSummary
                              result={result}
                              compareSize={
                                toolId === 'compress' && completePdfSelection(sources, selected)
                              }
                            />
                          </div>
                          <ResultActions
                            result={result}
                            url={resultUrl}
                            filename={resultName}
                            onRename={renameResult}
                            fresh={resultFresh}
                            nextDisabled={locked}
                            label={
                              result.kind === 'zip'
                                ? t('ZIP herunterladen')
                                : result.kind === 'report'
                                  ? t('Bericht herunterladen')
                                  : t('PDF herunterladen')
                            }
                          />
                        </div>
                        {result.kind === 'pdf' && result.note && (
                          <div className="result-notes" role="status">
                            {result.note.split('\n').map((note, index) => (
                              <p key={index}>{ui(note)}</p>
                            ))}
                          </div>
                        )}
                        {result.kind === 'report' && result.report ? (
                          <ReportView report={result.report} />
                        ) : result.text !== undefined ? (
                          <div className="ocr-comparison">
                            <div className="ocr-original">
                              {resultSource ? (
                                <>
                                  <div className="result-preview-pager">
                                    <button
                                      disabled={resultPage === 0}
                                      onClick={() => setResultPage((p) => p - 1)}
                                      aria-label={ui('Vorherige OCR-Seite')}
                                    >
                                      <ChevronLeft size={17} />
                                    </button>
                                    <span>
                                      {ui('PDF · ')}
                                      {resultPage + 1}/{resultSource.pdf.numPages}
                                    </span>
                                    <button
                                      disabled={resultPage >= resultSource.pdf.numPages - 1}
                                      onClick={() => setResultPage((p) => p + 1)}
                                      aria-label={ui('Nächste OCR-Seite')}
                                    >
                                      <ChevronRight size={17} />
                                    </button>
                                  </div>
                                  <PagePreview
                                    source={resultSource}
                                    page={{
                                      id: `ocr-result-${resultPage}`,
                                      sourceId: resultSource.id,
                                      index: resultPage,
                                      rotation: 0,
                                      selected: true,
                                    }}
                                  />
                                </>
                              ) : (
                                <LoaderCircle className="spin" />
                              )}
                            </div>
                            <div className="ocr-result">
                              <div className="ocr-text-heading">
                                <label htmlFor="recognized-text">{t('Erkannter Text')}</label>
                                <span>{t('BEARBEITBAR')}</span>
                              </div>
                              <Textarea
                                id="recognized-text"
                                value={resultText}
                                onChange={(e) => setResultText(e.target.value)}
                                className="recognized-text"
                              />
                              <div className="text-export-actions">
                                <Button
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(resultText);
                                      toast.success(t('Text kopiert'));
                                    } catch {
                                      toast.info(t('Text markieren und manuell kopieren.'));
                                    }
                                  }}
                                >
                                  <Copy size={15} />
                                  {t('Kopieren')}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    downloadBlob(
                                      new Blob(['\ufeff' + resultText], {
                                        type: 'text/plain;charset=utf-8',
                                      }),
                                      `${filenameStem(result.filename)}.txt`,
                                    )
                                  }
                                >
                                  <FileText size={15} />
                                  {ui('TXT')}
                                </Button>
                                <Button variant="outline" disabled={wordBusy} onClick={word}>
                                  {wordBusy ? (
                                    <LoaderCircle className="spin" size={15} />
                                  ) : (
                                    <FileText size={15} />
                                  )}
                                  {ui('Word')}
                                </Button>
                              </div>
                              <p className="export-note">
                                {t(
                                  'Korrekturen gelten für Text und Word. Die PDF enthält das ursprüngliche OCR-Ergebnis. Word übernimmt den Text ohne das Original-Layout.',
                                )}
                              </p>
                            </div>
                          </div>
                        ) : result.kind === 'pdf' ? (
                          <div className="result-preview">
                            {resultSource ? (
                              <>
                                <div className="result-preview-pager">
                                  <button
                                    disabled={resultPage === 0}
                                    onClick={() => setResultPage((p) => p - 1)}
                                    aria-label={ui('Vorherige Ergebnisseite')}
                                  >
                                    <ChevronLeft size={17} />
                                  </button>
                                  <span>
                                    {t('ERGEBNISVORSCHAU ·')}
                                    {resultPage + 1}/{resultSource.pdf.numPages}
                                  </span>
                                  <button
                                    disabled={resultPage >= resultSource.pdf.numPages - 1}
                                    onClick={() => setResultPage((p) => p + 1)}
                                    aria-label={ui('Nächste Ergebnisseite')}
                                  >
                                    <ChevronRight size={17} />
                                  </button>
                                </div>
                                <PagePreview
                                  source={resultSource}
                                  page={{
                                    id: `result-${resultPage}`,
                                    sourceId: resultSource.id,
                                    index: resultPage,
                                    rotation: 0,
                                    selected: true,
                                  }}
                                />
                              </>
                            ) : resultLoading ? (
                              <LoaderCircle className="spin" />
                            ) : (
                              <p>
                                {t(
                                  'Das Ergebnis ist bereit. Eine Vorschau ist für diese Datei nicht verfügbar.',
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="zip-result">
                            <Layers size={55} strokeWidth={1} />
                            <strong>{t('Alle Dateien. Ein Download.')}</strong>
                            <p>
                              {ui(
                                result.note ||
                                  'Entpacke die ZIP-Datei, um die einzelnen Dateien zu öffnen.',
                              )}
                            </p>
                          </div>
                        )}
                        {result.editorVerification && resultSource && (
                          <EditorResultReview
                            key={result.filename}
                            verification={result.editorVerification}
                            sources={sources}
                            output={resultSource}
                          />
                        )}
                        {result.kind === 'pdf' && (
                          <div className="continue-result">
                            <span>{t('Noch etwas vor mit diesem Dokument?')}</span>
                            <Button variant="outline" onClick={continueResult} disabled={locked}>
                              <PenLine size={16} />
                              {t('Ergebnis weiterbearbeiten')}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </>
              )}
            </Tabs>
            <div className="workstage-status">
              <span>
                <ShieldCheck size={13} />
                {t('Lokale Verarbeitung')}
              </span>
              <span>
                {sources.length
                  ? ui(`${formatSize(sourceBytes, uiLocale())} · ${pages.length} Seiten`)
                  : t('Keine Dateien geöffnet')}
              </span>
              <span>
                {editCount
                  ? `${editCount} ${editCount === 1 ? ui('Änderung') : t('Änderungen')}`
                  : t('Originale bleiben erhalten')}
              </span>
            </div>
          </section>
          <ResponsiveInspector
            editor={isEditor}
            open={editorSettingsOpen}
            onOpenChange={setEditorSettingsOpen}
          >
            <aside className={`inspector${isEditor ? ' editor-inspector' : ''}`}>
              <div className="inspector-heading">
                <span>{t('EINSTELLUNGEN')}</span>
                <span className="inspector-number">
                  {String(tools.findIndex((t) => t.id === toolId) + 1).padStart(2, '0')}/
                  {tools.length}
                </span>
              </div>
              <div className="inspector-body">
                <div className="inspector-tool-icon">
                  <tool.icon size={30} strokeWidth={1.35} />
                </div>
                <h2>{ui(tool.title)}</h2>
                <p className="tool-description">{ui(tool.description)}</p>
                {isEditor && (
                  <EditorPanel
                    tool={toolId}
                    source={activeSource}
                    mark={selectedMark}
                    marks={pageMarks}
                    width={editorDims.width}
                    height={editorDims.height}
                    disabled={locked}
                    onPatch={patchMark}
                    onRemove={removeMark}
                    onSelect={setSelectedMarkId}
                    onDuplicate={duplicateMark}
                    onNewText={newText}
                    onImage={() => imagePicker.current?.click()}
                  />
                )}
                <details className="editor-advanced-workflows" hidden={toolId !== 'edit-text'}>
                  <summary>{t('Weitere Bearbeitungsoptionen', 'More editing options')}</summary>
                  {toolId === 'edit-text' && (
                    <Suspense fallback={<p role="status">{ui('Editor wird geladen …')}</p>}>
                      <EditorWorkflowPanel
                        sources={sources}
                        pages={pages}
                        edits={edits}
                        disabled={locked}
                        activePageId={activePage?.id || ''}
                        selectedMarkId={selectedMarkId}
                        onApplyFlow={async (plan) => {
                          if (locked || refs.current.busy)
                            throw new Error('Bitte die laufende Verarbeitung abwarten.');
                          const initial = refs.current,
                            page = initial.pages.find((p) => p.id === plan.originalPageId),
                            source = initial.sources.find((s) => s.id === plan.sourceId);
                          if (!page || !source)
                            throw new Error(
                              'Die Absatzvorschau gehört nicht mehr zum aktuellen Dokument.',
                            );
                          refs.current = { ...initial, busy: true };
                          setDocumentBusy(true);
                          const ctrl = new AbortController();
                          job.current = ctrl;
                          let prepared:
                            | Awaited<
                                ReturnType<
                                  typeof import('@/lib/editor-auto-workspace').materializeEditorAutoFlow
                                >
                              >
                            | undefined;
                          let adopted = false;
                          try {
                            prepared = await (
                              await import('@/lib/editor-auto-workspace')
                            ).materializeEditorAutoFlow(
                              plan,
                              source,
                              page,
                              initial.pages,
                              initial.edits,
                              ctrl.signal,
                            );
                            ctrl.signal.throwIfAborted();
                            if (
                              refs.current.pages !== initial.pages ||
                              refs.current.edits !== initial.edits ||
                              refs.current.sources !== initial.sources
                            )
                              throw new Error(
                                'Das Dokument hat sich geändert. Bitte eine neue Absatzvorschau erstellen.',
                              );
                            const nextSources = prepared.addedSource
                              ? [...initial.sources, prepared.addedSource]
                              : initial.sources;
                            if (nextSources.reduce((sum, s) => sum + s.size, 0) > 80 * 1024 * 1024)
                              throw new Error(
                                'Die Fortsetzung überschreitet die Grenze von 80 MB.',
                              );
                            typingHistory.current = null;
                            textSelection.current = null;
                            dismissUndoNotice();
                            setHistory((old) =>
                              boundedHistory([...old, snapshot()], nextSources, [
                                ...projectSources,
                                ...(prepared!.addedSource ? [prepared!.addedSource] : []),
                              ]),
                            );
                            setFuture([]);
                            if (prepared.addedSource)
                              sourcePool.current.set(prepared.addedSource.id, prepared.addedSource);
                            setSources(nextSources);
                            setPages(prepared.pages);
                            setEdits(prepared.edits);
                            setSelectedMarkId('');
                            invalidate();
                            adopted = true;
                            toast.success(
                              ui(
                                'Absatzfluss übernommen. Die gesamte Änderung lässt sich gemeinsam rückgängig machen.',
                              ),
                            );
                          } finally {
                            if (!adopted && prepared?.addedSource)
                              await prepared.addedSource.pdf.loadingTask.destroy();
                            refs.current = { ...refs.current, busy: false };
                            setDocumentBusy(false);
                            if (job.current === ctrl) job.current = null;
                          }
                        }}
                        onApply={(next) => {
                          if (locked) return;
                          typingHistory.current = null;
                          textSelection.current = null;
                          setSelectedMarkId('');
                          commit({ pages, edits: next });
                        }}
                        onReveal={(pageId, mark) => {
                          setActiveId(pageId);
                          setSelectedMarkId(mark.id);
                          setEditorSearchHighlight({ pageId, rect: mark });
                          setView('document');
                        }}
                      />
                    </Suspense>
                  )}
                  {toolId === 'edit-text' && (
                    <label className="switch-field">
                      <span>
                        {ui('Seiten als Bild neu aufbauen')}
                        <small>
                          {ui(
                            'Nur für nicht direkt bearbeitbare Seiten. Vektoren, Links und Formularfelder können entfallen. Ergebnis sorgfältig prüfen.',
                          )}
                        </small>
                      </span>
                      <Switch
                        aria-label={ui('Seiten als Bild neu aufbauen')}
                        checked={!!options.editorAllowRaster}
                        disabled={locked}
                        onCheckedChange={(value) =>
                          setOptions((old) => ({ ...old, editorAllowRaster: value }))
                        }
                      />
                    </label>
                  )}
                </details>
                {isExtraTool(toolId) && (
                  <ExtraSettings
                    tool={toolId}
                    sources={sources}
                    selectedCount={selected.length}
                    options={options}
                    locked={locked}
                    onChange={(patch) => setOptions((old) => ({ ...old, ...patch }))}
                  />
                )}
                {toolId === 'inspect' && (
                  <>
                    <OcrLanguagePicker
                      label={ui('Sprache für Scan-Suche')}
                      value={options.language}
                      disabled={locked}
                      onChange={(language) => setOptions((old) => ({ ...old, language }))}
                    />
                    <div className="check-howto">
                      <span>01</span>
                      <p>{t('Begriff eingeben und über alle geöffneten Dateien suchen.')}</p>
                      <span>02</span>
                      <p>{t('Scan-Seiten bei Bedarf lokal erkennen lassen.')}</p>
                      <span>03</span>
                      <p>{t('Treffer prüfen und als neue PDF sammeln.')}</p>
                    </div>
                    <p className="fine-note">
                      {t(
                        'Vermutete Leerseiten und doppelte Vorschauen werden angezeigt. Die Auswahl bleibt bei dir.',
                      )}
                    </p>
                  </>
                )}
                {toolId === 'edit-text' && (
                  <OcrLanguagePicker
                    label={ui('Sprache gescannter Texte')}
                    value={options.editorLanguage || 'deu+eng'}
                    disabled={locked}
                    onChange={(editorLanguage) => setOptions((old) => ({ ...old, editorLanguage }))}
                  />
                )}
                {toolId === 'ocr' && (
                  <>
                    <label className="switch-field">
                      <span>
                        {t('Sprachen automatisch ermitteln')}
                        <small>
                          {t('Pro Scan-Seite; benötigt zusätzlich etwa 600 MB Arbeitsspeicher')}
                        </small>
                      </span>
                      <Switch
                        aria-label={t('Sprachen automatisch ermitteln')}
                        checked={!!options.autoLanguage}
                        disabled={locked}
                        onCheckedChange={(v) => setOptions((old) => ({ ...old, autoLanguage: v }))}
                      />
                    </label>
                    {options.autoLanguage && (
                      <p className="fine-note">
                        {t(
                          'Eine mehrsprachige OCR-Probe und ein lokaler statistischer Sprachvergleich wählen bis zu acht Modelle. Kurze, verrauschte oder mehrdeutige Texte werden zur manuellen Auswahl zurückgewiesen.',
                        )}
                      </p>
                    )}
                    <OcrLanguagePicker
                      label={ui('Erkennungssprache')}
                      value={options.language}
                      disabled={locked || !!options.autoLanguage}
                      onChange={(language) => setOptions((old) => ({ ...old, language }))}
                    />
                    {renderChoice('ocrLayout', 'Seitenaufbau', ocrLayouts)}
                    <label className="switch-field">
                      <span>
                        {t('Alle Seiten neu erkennen')}
                        <small>{t('Auch vorhandenen Text')}</small>
                      </span>
                      <Switch
                        checked={options.forceOcr}
                        disabled={locked}
                        onCheckedChange={(v) => setOptions({ ...options, forceOcr: v })}
                      />
                    </label>
                    <p className="fine-note">
                      {t(
                        'Bildseiten werden automatisch erkannt. Bei gemischten Text- und Scanbereichen „Alle Seiten neu erkennen“ aktivieren.',
                      )}
                    </p>
                  </>
                )}
                {toolId === 'to-images' &&
                  renderChoice('imageFormat', 'Bildformat', [
                    ['png', 'PNG · scharfe Schrift'],
                    ['jpg', 'JPG · kleinere Dateien'],
                    ['webp', 'WebP · moderne Komprimierung'],
                    ['tiff', 'TIFF · verlustfrei'],
                    ['bmp', 'BMP · unkomprimiert'],
                  ])}
                {toolId === 'compress' && (
                  <>
                    <CompressionPresets
                      value={options.quality}
                      onChange={(quality) => setOptions((old) => ({ ...old, quality }))}
                      disabled={locked}
                    />
                    <div className="notice">
                      {t(
                        'Erstellt eine Bild-PDF. Kopierbare Texte, Links und Formularfunktionen gehen verloren. Eine kleinere Datei ist nicht garantiert.',
                      )}
                    </div>
                  </>
                )}
                {toolId === 'numbers' && (
                  <label className="field">
                    <span>{t('Beginnen bei')}</span>
                    <Input
                      type="number"
                      min={1}
                      max={99999}
                      value={Number.isNaN(options.numberStart) ? '' : options.numberStart}
                      onChange={(e) =>
                        setOptions({ ...options, numberStart: parseInt(e.target.value, 10) })
                      }
                      disabled={locked}
                    />
                  </label>
                )}
                {toolId === 'watermark' && (
                  <>
                    <label className="field">
                      <span>{t('Wasserzeichen')}</span>
                      <Input
                        value={options.watermark}
                        maxLength={70}
                        onChange={(e) => setOptions({ ...options, watermark: e.target.value })}
                        disabled={locked}
                      />
                    </label>
                    <div className="watermark-sample">{options.watermark || ui('DEIN TEXT')}</div>
                    <p className="fine-note">
                      {t('Transparentes Türkis, mittig auf jeder ausgewählten Seite.')}
                    </p>
                  </>
                )}
                {(toolId === 'resize' || toolId === 'nup') && (
                  <>
                    {toolId === 'nup' &&
                      renderChoice('perSheet', 'Seiten pro Blatt', [
                        ['2', '2 Seiten'],
                        ['4', '4 Seiten'],
                      ])}
                    {renderChoice('pageSize', 'Papierformat', [
                      ['a4', 'DIN A4'],
                      ['letter', 'US Letter'],
                    ])}
                    {renderChoice('orientation', 'Ausrichtung', [
                      ['portrait', 'Hochformat'],
                      ['landscape', 'Querformat'],
                    ])}
                    <p className="fine-note">
                      {t(
                        'Inhalte werden proportional verkleinert oder vergrößert. Text bleibt kopierbar, soweit er im Original vorhanden ist.',
                      )}
                    </p>
                  </>
                )}
                {toolId === 'redact' && (
                  <div className="notice strong">
                    {t(
                      'Schwärzungen werden in die Seitenbilder eingerechnet. Die betroffenen Seiten enthalten danach keine ursprüngliche Textebene. Prüfe die Ergebnisvorschau vor dem Download.',
                    )}
                  </div>
                )}
                {toolId === 'crop' && (
                  <>
                    <p className="fine-note">
                      {t(
                        'Zugeschnittene Seiten werden als neue Seitenbilder exportiert. Inhalte außerhalb des Ausschnitts werden entfernt; die Textebene entfällt.',
                      )}
                    </p>
                    {activePage && edits.crops[activePage.id] && (
                      <Button variant="outline" onClick={clearCrop} disabled={locked}>
                        <X size={15} />
                        {t('Ausschnitt zurücksetzen')}
                      </Button>
                    )}
                  </>
                )}
                {toolId === 'annotate' && (
                  <>
                    <Tabs
                      value={noteMode}
                      onValueChange={(v) => setNoteMode(v as 'text' | 'highlight')}
                    >
                      <TabsList className="annotation-tabs">
                        <TabsTrigger value="text">
                          <Type size={15} />
                          {ui('Text')}
                        </TabsTrigger>
                        <TabsTrigger value="highlight">
                          <Highlighter size={15} />
                          {t('Marker')}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="text">
                        <label className="field">
                          <span>{t('Deine Notiz')}</span>
                          <Textarea
                            value={noteText}
                            maxLength={600}
                            onChange={(e) => setNoteText(e.target.value)}
                            disabled={locked}
                          />
                        </label>
                        <label className="field">
                          <span>
                            {t('Schriftgröße')}
                            <b>
                              {fontSize} {ui(' pt')}
                            </b>
                          </span>
                          <Slider
                            value={[fontSize]}
                            min={9}
                            max={42}
                            step={1}
                            onValueChange={(v) => setFontSize(v[0])}
                            aria-label={t('Schriftgröße')}
                            disabled={locked}
                          />
                        </label>
                      </TabsContent>
                      <TabsContent value="highlight">
                        <div className="marker-sample">{t('Wichtiges hervorheben.')}</div>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
                {toolId === 'sign' && (
                  <>
                    <Button
                      className="signature-create"
                      variant="outline"
                      onClick={() => setSignatureOpen(true)}
                      disabled={locked}
                    >
                      <PenLine size={16} />
                      {signature ? ui('Unterschrift ändern') : ui('Unterschrift zeichnen')}
                    </Button>
                    {signature && (
                      <div className="signature-sample">
                        <img src={signature.image} alt={ui('Deine gezeichnete Unterschrift')} />
                      </div>
                    )}
                    <p className="fine-note">
                      {t('Wird als Bild eingefügt. Keine digitale Zertifikatssignatur.')}
                    </p>
                  </>
                )}
                {(toolId === 'grayscale' || toolId === 'flatten') && (
                  <div className="notice">
                    {t(
                      'Die Ausgabe enthält neue Seitenbilder. Textebenen, Links und interaktive Formularfelder werden nicht übernommen.',
                    )}
                  </div>
                )}
                {toolId === 'metadata' && (
                  <>
                    {activeSource && (
                      <div className="metadata-list">
                        <span>{t('DOKUMENTINFOS DER AKTUELLEN DATEI')}</span>
                        {(['Title', 'Author', 'Creator', 'Producer', 'CreationDate'] as const).map(
                          (key) => (
                            <div key={key}>
                              <b>
                                {ui(
                                  {
                                    Title: 'Titel',
                                    Author: 'Autor',
                                    Creator: 'Ersteller',
                                    Producer: 'PDF-Software',
                                    CreationDate: 'Erstellt',
                                  }[key],
                                )}
                              </b>
                              <span>{String(metadata[key] || '—')}</span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                    <p className="fine-note">
                      {t(
                        'Inhalte im Dokument, Kommentare, Bilder und eingebettete Objektdaten werden damit nicht anonymisiert.',
                      )}
                    </p>
                  </>
                )}
                {(toolId === 'merge' ||
                  toolId === 'split' ||
                  toolId === 'organize' ||
                  toolId === 'images') && (
                  <div className="mini-workflow">
                    <div>
                      <span>01</span>
                      {t('Dateien hinzufügen')}
                    </div>
                    <div>
                      <span>02</span>
                      {t('Seiten auswählen & sortieren')}
                    </div>
                    <div>
                      <span>03</span>
                      {t('Ergebnis herunterladen')}
                    </div>
                  </div>
                )}
                {visualTools.includes(toolId) && !isEditor && activePage && (
                  <>
                    <details className="manual-placement">
                      <summary>{t('Bereich per Eingabe setzen')}</summary>
                      <div className="position-inputs">
                        {(['x', 'y', 'w', 'h'] as const).map((key) => (
                          <label key={key}>
                            {ui({ x: 'Links %', y: 'Oben %', w: 'Breite %', h: 'Höhe %' }[key])}
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={Math.round(manualRect[key] * 100)}
                              onChange={(e) =>
                                setManualRect({
                                  ...manualRect,
                                  [key]: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                                })
                              }
                              disabled={locked}
                            />
                          </label>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        onClick={placeManual}
                        disabled={
                          locked ||
                          (editMode === 'signature' && !signature) ||
                          (editMode === 'text' && !noteText.trim())
                        }
                      >
                        {t('Bereich hinzufügen')}
                      </Button>
                    </details>
                    {pageMarks.length > 0 && (
                      <div className="mark-list">
                        <span>
                          {t('AUF DIESER SEITE ·')}
                          {pageMarks.length}
                        </span>
                        {pageMarks.map((m, i) => (
                          <div key={m.id}>
                            <span>
                              {String(i + 1).padStart(2, '0')} ·{' '}
                              {
                                {
                                  redact: 'Schwärzung',
                                  text: 'Textnotiz',
                                  highlight: 'Markierung',
                                  signature: 'Unterschrift',
                                  erase: 'Entfernter Bereich',
                                  image: 'Bild',
                                }[m.kind]
                              }
                            </span>
                            <button
                              aria-label={ui(`Änderung ${i + 1} entfernen`)}
                              disabled={locked}
                              onClick={() => removeMark(m.id)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="workspace-action-notices">
                {editCount > 0 && (
                  <p className="pending-note">
                    {sourceOnlyTools.includes(toolId)
                      ? ui('Visuelle Änderungen sind noch nicht im Original gespeichert.')
                      : ui(`${editCount} visuelle Änderungen werden mit übernommen.`)}
                  </p>
                )}
                {error && (
                  <p className="error-box" role="alert">
                    {ui(error)}
                  </p>
                )}
              </div>
              <div
                className="inspector-apply"
                aria-label={t('Dokumentaktionen', 'Document actions')}
              >
                <Button
                  variant="outline"
                  className="workspace-action-back"
                  onClick={returnToTools}
                  disabled={locked}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  {t('Zurück', 'Back')}
                </Button>
                {busy ? (
                  <div className="job-progress" aria-live="polite">
                    <div>
                      <JobStatusIcon working size={17} />
                      <strong>{Math.round(progress.percent)} %</strong>
                    </div>
                    <Progress
                      value={progress.percent}
                      aria-label={ui('Verarbeitungsfortschritt')}
                    />
                    <p>{ui(progress.label)}</p>
                    <Button variant="outline" onClick={() => job.current?.abort()}>
                      {t('Abbrechen')}
                    </Button>
                  </div>
                ) : view === 'result' && result && resultUrl ? (
                  <Button
                    asChild
                    className="apply-button workspace-download result-download"
                    data-fresh={resultFresh}
                  >
                    <a href={resultUrl} download={resultName}>
                      <Download size={18} aria-hidden="true" />
                      {result.kind === 'pdf'
                        ? t('PDF herunterladen', 'Download PDF')
                        : t('Herunterladen', 'Download')}
                    </a>
                  </Button>
                ) : (
                  <Button
                    className="apply-button"
                    onClick={process}
                    disabled={
                      !selected.length ||
                      !hasNeededEdit ||
                      loading ||
                      imageBusy ||
                      documentIndex.ocrBusy
                    }
                  >
                    {loading ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <tool.icon size={17} />
                    )}
                    <span>{tool.action}</span>
                  </Button>
                )}
                <div className="apply-detail">
                  {pages.length
                    ? ui(`${selected.length} von ${pages.length} Seiten ausgewählt`)
                    : ui('Öffne zuerst ein Dokument')}
                </div>
              </div>
            </aside>
          </ResponsiveInspector>
        </div>
      </main>
      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="signature-dialog">
          <DialogHeader>
            <DialogTitle>{t('Deine Unterschrift.')}</DialogTitle>
            <DialogDescription>
              {t('Mit Maus oder Finger zeichnen. Danach im Dokument platzieren.')}
            </DialogDescription>
          </DialogHeader>
          <SignaturePad
            onSave={(value) => {
              setSignature(value);
              setSignatureOpen(false);
              setView('document');
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!help}
        onOpenChange={(open) => {
          if (!open) setHelp(null);
        }}
      >
        <DialogContent className="help-dialog">
          <DialogHeader>
            <DialogTitle>
              {help === 'privacy'
                ? ui('Deine Dokumente. Deine Entscheidung.')
                : ui('So funktioniert’s.')}
            </DialogTitle>
            <DialogDescription>
              {help === 'privacy'
                ? ui('Lokale Verarbeitung und Speicherung.')
                : ui('Dateien öffnen, bearbeiten, anwenden.')}
            </DialogDescription>
          </DialogHeader>
          {help === 'privacy' ? (
            <div className="help-body">
              <h3>{ui('Verarbeitung auf deinem Gerät')}</h3>
              <p>
                {ui(
                  'PDFs, Bilder, Texterkennung und Unterschriften werden in deinem Browser verarbeitet. Die Browserwerkzeuge senden Dokumentinhalte nicht an einen Server oder KI-Dienst. Einige Funktionen, etwa Office-Konvertierungen, werden von MoinPDF verarbeitet. Erst mit dem Start der jeweiligen Verarbeitung wird die ausgewählte Datei übertragen. Beim bloßen Auswählen eines Dokuments erfolgt kein Upload.',
                )}
              </p>
              <h3>{ui('Sitzung und gespeicherte Projekte')}</h3>
              <p>
                {ui(
                  'Der Arbeitsstand wird automatisch unverschlüsselt in diesem Browser gespeichert. Zusätzlich bleiben die letzten zehn Ergebnisse mit insgesamt höchstens 160 MB in der lokalen Ergebnisablage. Über „Projekte“ kannst du zusätzlich bis zu fünf Arbeitsstände speichern und als Projektdatei herunterladen. Diese enthält Originale und den Bearbeitungsverlauf unverschlüsselt, auch zuvor entsperrte PDFs. „Arbeitsbereich leeren“ entfernt die Sicherung des aktuellen Arbeitsstands und die Ergebnisablage. Sicherungen anderer Tabs und Dokumente bleiben erhalten und lassen sich beim Wiederherstellen einzeln verwerfen. Projekte lassen sich separat in der App löschen; auch das Löschen der Browserdaten entfernt lokale Daten. Browser können gespeicherte Daten bei Speichermangel entfernen. Wichtige Ergebnisse zusätzlich herunterladen. Die Website und Sprachpakete werden vom Hostinganbieter geladen; dabei entstehen übliche Zugriffsdaten. Es gibt keine eigenen Analyse- oder Werbetracker.',
                )}
              </p>
              <h3>{ui('Vorlagen und Einstellungen')}</h3>
              <p>
                {ui(
                  'Der Browser kann Programmdaten und Sprachpakete zwischenspeichern. Gespeicherte Arbeitsabläufe bleiben als Einstellungen im Browser erhalten. Darin werden keine Dokumente oder Passwörter gespeichert. Der geöffnete Zustand der Werkzeugleiste gilt nur für die aktuelle Sitzung.',
                )}
              </p>
            </div>
          ) : (
            <div className="help-body">
              <h3>{ui('01 / Öffnen')}</h3>
              <p>
                {ui(
                  'PDFs, Rechnungs-XML, JPGs und PNGs überall ins Fenster ziehen oder auswählen. Einzelne Office-Dateien, E-Mails und HTML-Dateien öffnen direkt das passende Konvertierungswerkzeug. Bis zu 80 MB und 200 Seiten gleichzeitig.',
                )}
              </p>
              <h3>{ui('Dokumentencheck & Seitenfinder')}</h3>
              <p>
                {ui(
                  'Nach dem Import beschreibst du unter „Was möchtest du tun?“ dein Vorhaben oder wählst ein Werkzeugsymbol. Über „Werkzeug wechseln“ kommst du jederzeit zurück. Die Seiten werden nebenbei lokal geprüft. Mit der Suche findest du Begriffe über alle geöffneten Dateien. Für Scans die Texterkennung starten. „Treffer-PDF erstellen“ sammelt passende Seiten in ihrer aktuellen Reihenfolge; vorhandene visuelle Änderungen werden übernommen. Die Suche erstellt selbst keine neue Textebene im PDF. Check und Suche beziehen sich bis zur Ergebnisübernahme auf die importierten Inhalte.',
                )}
              </p>
              <p>
                {ui(
                  'Leerseiten und optisch gleiche Seiten sind Hinweise anhand der Vorschau. Vor dem Abwählen bitte ansehen. Es wird nichts automatisch gelöscht.',
                )}
              </p>
              <h3>{ui('02 / Bearbeiten')}</h3>
              <p>
                {ui(
                  'Links ein Werkzeug wählen. In der Seitenübersicht kannst du sortieren, drehen, duplizieren und entfernen. In der Einzelansicht platzierst du Notizen, Markierungen, Schwärzungen und Unterschriften. Bereiche lassen sich auch über Zahlen eingeben.',
                )}
              </p>
              <h3>{ui('03 / Anwenden')}</h3>
              <p>
                {ui(
                  'PDF-Werkzeuge verarbeiten ausgewählte Seiten. Beim Vergleich, abwechselnden Zusammenfügen und Überlagern wählst du zusätzlich zwei Dateien. Dokumentberichte und Anhänge beziehen sich auf die Originaldateien. Ausstehende visuelle Änderungen werden bei der PDF-Ausgabe übernommen. Mit „Ergebnis weiterbearbeiten“ wird die erzeugte PDF dein neues Arbeitsdokument.',
                )}
              </p>
              <h3>{ui('Passwortschutz & E-Rechnungen')}</h3>
              <p>
                {ui(
                  '„PDF schützen“ verschlüsselt das gesamte geöffnete Dokument mit AES-256. Berechtigungen hängen vom PDF-Programm ab. „E-Rechnung lesen“ unterstützt UBL und CII aus XML oder PDF-Anhängen. Der Basischeck prüft ausgewählte Angaben und Summen, ersetzt aber keine vollständige Normvalidierung. Lese-PDFs enthalten die Original-XML; sie sind keine zertifizierten PDF/A- oder ZUGFeRD-Dateien.',
                )}
              </p>
              <h3>{ui('Rückgängig und Tastatur')}</h3>
              <p>
                {ui(
                  'Strg/⌘ + Z: letzte Seiten- oder Bereichsänderung zurücknehmen. Strg/⌘ + Umschalt + Z: wiederholen. Nach dem Hinzufügen oder Schließen von Dateien beginnt der Verlauf neu.',
                )}
              </p>
              <h3>{ui('Gut zu wissen')}</h3>
              <p>
                {ui(
                  'OCR-Ergebnisse, besonders Namen und Beträge, bitte prüfen. Originale aufbewahren: Die Werkzeuge „Formular ausfüllen“, „Formular erstellen“ und „Lesezeichen bearbeiten“ speichern die vollständige Originaldatei mit ihren interaktiven Feldern und Lesezeichen. Andere Werkzeuge können diese dokumentweiten Funktionen verlieren oder Formularfelder zu festen Inhalten umwandeln. Bearbeitungen können digitale Signaturen ungültig machen. Geschützte PDFs werden nach Eingabe des Passworts lokal entsperrt. Ergebnisse anderer Werkzeuge sind ungeschützt; zum erneuten Schützen das Werkzeug „PDF schützen“ verwenden.',
                )}
              </p>
              <p>
                {ui(
                  'Klicke Text direkt auf der PDF an. Markierte Wörter lassen sich einzeln formatieren; ohne Markierung gilt die Änderung für das ganze Textfeld. Absätze und Tabellen bitte prüfen. Layoutanpassungen haben eine Vorschau. Originalschriften bleiben erhalten, soweit wiederverwendbar; Ersatzschriften und eigene statische TrueType-Schriften stehen zur Wahl. Scans werden lokal erkannt und lassen sich neben dem Original korrigieren. Der Export ersetzt vorhandenen Text tatsächlich und prüft die gespeicherte PDF erneut. Bei neu aufgebauten Scan- oder Bildseiten können Links und interaktive Felder entfallen. Der Umbruch bleibt auf das einzelne Textfeld begrenzt.',
                )}
              </p>
              <p>
                {ui(
                  'Schwärzen und Zuschneiden erzeugen auf betroffenen Seiten neue Bildinhalte. Für reine Textnotizen und Unterschriften bleibt vorhandener Text erhalten. Vor dem Drehen visuelle Änderungen anwenden.',
                )}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {dragOver && (
        <div className="drop-overlay" role="status" aria-live="polite">
          <Plus size={64} strokeWidth={1} />
          <strong>{fileDropLabel(dragFileCount, language)}</strong>
          <span>{t('Dein Dokument. Dein nächster Schritt.')}</span>
        </div>
      )}
    </>
  );
}
