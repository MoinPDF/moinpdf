'use client';
import { ui } from '@/lib/ui-language';

import { useLanguage } from '@/components/studio/appearance';
import { AppearanceProvider, AppearanceControls, useTools } from '@/components/studio/appearance';

import { ProjectManager } from '@/components/studio/project-manager';
import { retainPageEdits } from '@/lib/local-projects';
import { ocrLayouts } from '@/lib/ocr-languages';
import { OcrLanguagePicker } from '@/components/studio/ocr-language-picker';
import {
  lazy,
  Suspense,
  useCallback,
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
import { HarborBrand, HarborNavigation } from '@/components/studio/harbor-navigation';
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
import { EditorCanvas } from '@/components/studio/editor-canvas';
import { EditorPanel, EditorToolbar } from '@/components/studio/editor-panel';
import { editorTools, fitRect, type EditorAction } from '@/lib/editor-model';
import { ExtraSettings } from '@/components/studio/extra-settings';
import { ReportView } from '@/components/studio/report-view';
import { extraDefaults, isExtraTool, sourceOnlyTools } from '@/lib/extra-options';
import { type WorkspaceTool } from '@/lib/tool-catalog';
import { searchTools } from '@/lib/localized-search';
import { DocumentCheck } from '@/components/studio/document-check';
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
type Snapshot = { pages: PageItem[]; edits: Edits };
export default function Home() {
  useLanguage();
  return (
    <AppearanceProvider>
      <WorkspaceShell />
    </AppearanceProvider>
  );
}
function WorkspaceShell() {
  const { t } = useLanguage();
  return (
    <div className="moinpdf-shell">
      <a className="harbor-skip" href="#moinpdf-content">
        {t('Zum Inhalt', 'Skip to content')}
      </a>
      <header className="app-toolbar">
        <HarborBrand />
        <div id="moinpdf-navigation" />
        <div className="harbor-header-actions">
          <div id="moinpdf-project-bar" className="project-bar" />
          <AppearanceControls />
        </div>
      </header>
      <SidebarProvider
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
  const { t } = useLanguage();
  const { tools, groups } = useTools();
  const { setOpenMobile } = useSidebar();
  const [projectIdentity, setProjectIdentity] = useState<{ id?: string; name: string }>({
    name: 'Mein PDF-Projekt',
  });
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
  const [history, setHistory] = useState<Snapshot[]>([]),
    [future, setFuture] = useState<Snapshot[]>([]);
  const [documentSessions, setDocumentSessions] = useState<DocumentSessions>({}),
    [documentBusy, setDocumentBusy] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
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
    busy: busy || loading || imageBusy || documentBusy || documentIndex.ocrBusy,
  };
  const picker = useRef<HTMLInputElement>(null),
    job = useRef<AbortController | null>(null),
    uploadLock = useRef(false),
    pageDrag = useRef<string | null>(null);
  const selected = pages.filter((p) => p.selected),
    activePage = pages.find((p) => p.id === activeId) || pages[0],
    activeSource = activePage ? sources.find((s) => s.id === activePage.sourceId) : undefined;
  const tool = tools.find((t) => t.id === toolId)!,
    locked = busy || loading || imageBusy || documentBusy || documentIndex.ocrBusy,
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
  const hasNeededEdit = isEditor
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
      refs.current.sources.forEach((s) => void s.pdf.loadingTask.destroy());
    },
    [],
  );
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (refs.current.sources.length) event.preventDefault();
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
      setView(toolId === 'inspect' ? 'check' : visualTools.includes(toolId) ? 'document' : 'pages');
  };
  const commit = (next: Snapshot) => {
    if (locked) return;
    setHistory((old) => [...old, { pages, edits }].slice(-30));
    setFuture([]);
    setPages(next.pages);
    setEdits(next.edits);
    invalidate();
  };
  function undo() {
    if (locked || !history.length) return;
    const prev = history[history.length - 1];
    setFuture((old) => [{ pages, edits }, ...old]);
    setHistory((old) => old.slice(0, -1));
    setPages(prev.pages);
    setEdits(prev.edits);
    invalidate();
  }
  function redo() {
    if (locked || !future.length) return;
    const next = future[0];
    setHistory((old) => [...old, { pages, edits }]);
    setFuture((old) => old.slice(1));
    setPages(next.pages);
    setEdits(next.edits);
    invalidate();
  }
  const callbacks = useRef({ undo, redo });
  callbacks.current = { undo, redo };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? callbacks.current.redo() : callbacks.current.undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const addFiles = useCallback(
    async (files: File[], showToolChoice = true) => {
      if (!files.length || refs.current.busy || uploadLock.current) return;
      setHomeRequested(false);
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
        setConversionInput({ tool: nextTool, file: conversionFile });
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
      let size = refs.current.sources.reduce((n, s) => n + s.size, 0),
        count = refs.current.pages.length;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setImportState({ phase: 'reading', name: file.name, completed: i, total: files.length });
          try {
            if (size + file.size > MAX_BYTES)
              throw new Error('Maximal 80 MB insgesamt. Entferne zuerst andere Dateien.');
            const source = await openSource(file, {
              requestPassword: (name, failed) =>
                new Promise((resolve) => setPasswordRequest({ name, failed, resolve })),
            });
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
                        label: 'PDF reparieren',
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
              toolId === 'inspect' ? 'check' : visualTools.includes(toolId) ? 'document' : 'pages',
            );
          }
          toast.success(
            `${added.length} ${t(added.length === 1 ? 'Datei geöffnet' : 'Dateien geöffnet')}`,
          );
        }
      } finally {
        uploadLock.current = false;
        setLoading(false);
        setImportState({ phase: 'idle', name: '', completed: 0, total: 0 });
      }
    },
    [t, toolId],
  );
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) {
        e.preventDefault();
        if (!refs.current.busy) setDragOver(true);
      }
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
      e.preventDefault();
      setDragOver(false);
      void addFiles(Array.from(e.dataTransfer?.files || []), choosingTool);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles, choosingTool]);
  function chooseTool(id: WorkspaceTool) {
    if (locked) return;
    setHomeRequested(false);
    setBrowseEmpty(true);
    setSelectedMarkId('');
    setEditorAction(id === 'erase' ? 'erase' : id === 'insert-image' ? 'image' : 'pick');
    setChoosingTool(false);
    setToolId(id);
    setView(id === 'inspect' ? 'check' : visualTools.includes(id) ? 'document' : 'pages');
    setError('');
    setOpenMobile(false);
    requestAnimationFrame(() => {
      document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  function movePage(id: string, to: number) {
    const next = [...pages],
      from = next.findIndex((p) => p.id === id);
    if (from < 0 || to < 0 || to >= next.length) return;
    const [page] = next.splice(from, 1);
    next.splice(to, 0, page);
    commit({ pages: next, edits });
  }
  function rotate(id?: string) {
    const chosen = pages.filter((p) => (id ? p.id === id : p.selected));
    if (countEdits(edits, chosen)) {
      toast.info(
        ui(
          'Bitte die visuellen Änderungen zuerst anwenden. Danach kannst du das Ergebnis weiterbearbeiten und drehen.',
        ),
      );
      return;
    }
    commit({
      pages: pages.map((p) =>
        chosen.some((c) => c.id === p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
      ),
      edits,
    });
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
    commit({ pages: next, edits: nextEdits });
    setActiveId(copy.id);
  }
  function deletePage(id: string) {
    commit({ pages: pages.filter((p) => p.id !== id), edits });
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
    setSelectedMarkId('');
    commit({
      pages,
      edits: {
        ...edits,
        marks: { ...edits.marks, [activePage.id]: pageMarks.filter((m) => m.id !== id) },
      },
    });
  }
  function patchMark(id: string, patch: Partial<Mark>) {
    if (!activePage || locked) return;
    const old = pageMarks.find((m) => m.id === id);
    if (!old) return;
    const next = { ...old, ...patch };
    if (JSON.stringify(old) === JSON.stringify(next)) return;
    commit({
      pages,
      edits: {
        ...edits,
        marks: { ...edits.marks, [activePage.id]: pageMarks.map((m) => (m.id === id ? next : m)) },
      },
    });
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
    const source = sources.find((s) => s.id === id);
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
    setTimeout(() => void source?.pdf.loadingTask.destroy(), 100);
  }
  function clear() {
    setRepairInput(null);
    setConversionInput(null);
    setDocumentSessions({});
    sources.forEach((s) => setTimeout(() => void s.pdf.loadingTask.destroy(), 100));
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
      await addFiles([await makeDemoFile()], false);
    } catch {
      toast.error(ui('Das Beispieldokument konnte nicht geöffnet werden.'));
    }
  }
  async function blank() {
    if (locked) return;
    await addFiles([await makeBlankFile()], false);
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
      setResult({ ...output, filename: 'Fundstellen.pdf' });
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
  async function useDocumentResult(output: JobResult) {
    setLoading(true);
    try {
      const next = await openSource(
        new File([output.blob], output.filename, { type: 'application/pdf' }),
      );
      const nextPages = sourcePages(next);
      sources.forEach((s) => setTimeout(() => void s.pdf.loadingTask.destroy(), 100));
      setSources([next]);
      setPages(nextPages);
      setActiveId(nextPages[0].id);
      setEdits(emptyEdits());
      setDocumentSessions({});
      setHistory([]);
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
    setLoading(true);
    try {
      const next = await openSource(
        new File([result.blob], result.filename, { type: 'application/pdf' }),
      );
      const nextPages = sourcePages(next);
      sources.forEach((s) => setTimeout(() => void s.pdf.loadingTask.destroy(), 100));
      setSources([next]);
      setPages(nextPages);
      setActiveId(nextPages[0].id);
      setEdits(emptyEdits());
      setDocumentSessions({});
      setHistory([]);
      setFuture([]);
      setResult(null);
      setToolId('organize');
      setView('pages');
      setRange('');
      toast.success(ui('Ergebnis als neues Arbeitsdokument geöffnet'));
    } catch (err) {
      toast.error(ui((err as Error).message));
    } finally {
      setLoading(false);
    }
  }
  async function word() {
    setWordBusy(true);
    try {
      await downloadWord(resultText, `${filenameStem(result!.filename)}.docx`);
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
  const homeVisible = homeRequested || (!sources.length && choosingTool && !browseEmpty);
  function showTools() {
    if (locked) return;
    setHomeRequested(false);
    setBrowseEmpty(true);
    setChoosingTool(true);
    setOpenMobile(false);
    requestAnimationFrame(() => {
      document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  const fileInput = (
    <>
      <HarborNavigation
        home={homeVisible}
        locked={locked}
        onHome={() => {
          if (locked) return;
          setHomeRequested(true);
          setChoosingTool(true);
          setOpenMobile(false);
          requestAnimationFrame(() => {
            document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: 'instant' });
          });
        }}
        onTools={showTools}
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
      <ProjectManager
        identity={projectIdentity}
        setIdentity={setProjectIdentity}
        sources={sources}
        locked={locked}
        state={{ pages, edits, options, history, future, documentSessions, activeId, toolId }}
        onRestore={(loaded, state) => {
          setHomeRequested(false);
          refs.current.sources.forEach((s) => void s.pdf.loadingTask.destroy());
          setSources(loaded);
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
          setResult(null);
          setError('');
          setChoosingTool(true);
          setSelectedMarkId('');
        }}
      />
    </>
  );
  if (homeVisible)
    return (
      <>
        <Toaster position="bottom-right" richColors closeButton />
        {fileInput}
        <UploadEntry
          dragOver={dragOver}
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
          onBack={() => setChoosingTool(true)}
          onAdd={() => picker.current?.click()}
          onBusy={setDocumentBusy}
          onUse={useDocumentResult}
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
          onBack={() => setChoosingTool(true)}
          onAdd={() => picker.current?.click()}
          onBusy={setDocumentBusy}
          onUse={useDocumentResult}
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
          onBack={() => setChoosingTool(true)}
          onAdd={() => picker.current?.click()}
          onDemo={demo}
          onBlank={blank}
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
          onBack={() => setChoosingTool(true)}
          onTool={chooseTool}
          onUse={useDocumentResult}
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
          onBack={() => setChoosingTool(true)}
          onTool={chooseTool}
          onBusy={setDocumentBusy}
          onUse={useDocumentResult}
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
          onBack={() => setChoosingTool(true)}
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
                        <span>{t.title}</span>
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
      <main className="studio-main">
        <header className="studio-topbar">
          <div className="workspace-brand">
            <SidebarTrigger aria-label={ui('Werkzeugleiste einblenden')} />
            <button
              className="back-to-tools"
              onClick={() => {
                setChoosingTool(true);
                setOpenMobile(false);
              }}
              disabled={locked}
            >
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
                  <TabsTrigger value="check">
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
                    <span>{t('Dokument')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="result" disabled={!result}>
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
                          onClick={() => commit({ pages: [...pages].reverse(), edits })}
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
                    <div className="page-grid">
                      {pages.map((page, index) => (
                        <article
                          key={page.id}
                          className={`page-tile ${page.selected ? 'selected' : ''} ${activePage?.id === page.id ? 'active' : ''}`}
                          draggable={!locked}
                          onDragStart={(e) => {
                            pageDrag.current = page.id;
                            e.dataTransfer.setData('text/plain', page.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            pageDrag.current = null;
                          }}
                          onDragOver={(e) => {
                            if (pageDrag.current) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }
                          }}
                          onDrop={(e) => {
                            if (pageDrag.current) {
                              e.preventDefault();
                              e.stopPropagation();
                              movePage(pageDrag.current, index);
                              pageDrag.current = null;
                            }
                          }}
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
                            <GripVertical size={16} />
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
                    </div>
                    <div className="stage-hint">
                      <GripVertical size={14} />
                      {t(
                        'Seiten ziehen, umsortieren, fertig. Die Pfeile funktionieren auch auf dem Handy.',
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
                              disabled={zoom <= 60}
                              onClick={() => setZoom((v) => v - 20)}
                            >
                              <ZoomOut size={16} />
                            </button>
                            <span>{zoom}%</span>
                            <button
                              aria-label={ui('Vergrößern')}
                              disabled={zoom >= 160}
                              onClick={() => setZoom((v) => v + 20)}
                            >
                              <ZoomIn size={16} />
                            </button>
                          </div>
                        </div>
                        <div className={`mode-instruction ${toolId === 'redact' ? 'redact' : ''}`}>
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
                            onAction={setEditorAction}
                            onNewText={newText}
                            onImage={() => imagePicker.current?.click()}
                            onErase={newErase}
                          />
                        )}
                        <div
                          className="document-scroll"
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
                          <div className="zoom-frame" style={{ width: `${zoom}%` }}>
                            {isEditor ? (
                              <EditorCanvas
                                source={activeSource}
                                page={activePage}
                                marks={pageMarks}
                                crop={edits.crops[activePage.id]}
                                action={editorAction}
                                selectedId={selectedMarkId}
                                disabled={locked}
                                onMark={mark}
                                onPatch={patchMark}
                                onSelect={setSelectedMarkId}
                                onDimensions={setEditorDims}
                              />
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
                            <Check size={22} />
                          </div>
                          <div>
                            <h2>{t('Erledigt.')}</h2>
                            <p>
                              {result.pages}
                              {t('Seiten ·')}
                              {formatSize(result.blob.size)}
                              {toolId === 'compress'
                                ? result.blob.size < result.inputSize
                                  ? ui(
                                      ` · ${Math.round((1 - result.blob.size / result.inputSize) * 100)} % kleiner`,
                                    )
                                  : ui(' · diesmal keine Verkleinerung')
                                : ''}
                            </p>
                          </div>
                          <Button asChild className="download-primary">
                            <a href={resultUrl || undefined} download={result.filename}>
                              <Download size={16} />
                              {result.kind === 'zip'
                                ? t('ZIP herunterladen')
                                : result.kind === 'report'
                                  ? t('Bericht herunterladen')
                                  : t('PDF herunterladen')}
                            </a>
                          </Button>
                        </div>
                        <div className="result-filename">{result.filename}</div>
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
                              {result.note ||
                                ui('Entpacke die ZIP-Datei, um die einzelnen Dateien zu öffnen.')}
                            </p>
                          </div>
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
                  ? ui(`${formatSize(sourceBytes)} · ${pages.length} Seiten`)
                  : t('Keine Dateien geöffnet')}
              </span>
              <span>
                {editCount
                  ? `${editCount} ${editCount === 1 ? ui('Änderung') : t('Änderungen')}`
                  : t('Originale bleiben erhalten')}
              </span>
            </div>
          </section>
          <aside className="inspector">
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
                  mark={selectedMark}
                  marks={pageMarks}
                  width={editorDims.width}
                  disabled={locked}
                  onPatch={patchMark}
                  onRemove={removeMark}
                  onSelect={setSelectedMarkId}
                  onDuplicate={duplicateMark}
                  onNewText={newText}
                  onImage={() => imagePicker.current?.click()}
                />
              )}
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
                  {renderChoice('quality', 'Komprimierung', [
                    ['balanced', 'Ausgewogen'],
                    ['small', 'Möglichst klein'],
                  ])}
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
                  </Tabs>
                  {noteMode === 'text' ? (
                    <>
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
                    </>
                  ) : (
                    <div className="marker-sample">{t('Wichtiges hervorheben.')}</div>
                  )}
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
            <div className="inspector-apply">
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
              {busy ? (
                <div className="job-progress" aria-live="polite">
                  <div>
                    <LoaderCircle className="spin" size={17} />
                    <strong>{Math.round(progress.percent)} %</strong>
                  </div>
                  <Progress value={progress.percent} aria-label={ui('Verarbeitungsfortschritt')} />
                  <p>{ui(progress.label)}</p>
                  <Button variant="outline" onClick={() => job.current?.abort()}>
                    {t('Abbrechen')}
                  </Button>
                </div>
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
                  {loading ? <LoaderCircle className="spin" size={17} /> : <tool.icon size={17} />}
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
                  'Ohne Speichern bleiben Dokumente und Änderungen im Arbeitsspeicher. Über „Projekte“ kannst du bis zu fünf Arbeitsstände lokal im Browser speichern und eine Projektdatei herunterladen. Diese enthält Originale und den Bearbeitungsverlauf unverschlüsselt, auch zuvor entsperrte PDFs. Projekte lassen sich in der App löschen; auch das Löschen der Browserdaten entfernt sie. Ungespeicherte Änderungen gehen beim Neuladen verloren. Die Website und Sprachpakete werden vom Hostinganbieter geladen; dabei entstehen übliche Zugriffsdaten. Es gibt keine eigenen Analyse- oder Werbetracker.',
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
                  '„Text bearbeiten“ erkennt gerade Textstellen. „Bereich ersetzen“ funktioniert auch für Scans; den Ersatztext gibst du selbst ein. Eigene Texte und Bilder lassen sich auswählen, ziehen, skalieren und per Koordinaten setzen. Ersatzschriften können vom Original abweichen. Entfernen und Ersetzen bauen betroffene Seiten neu auf: Die alte Textebene, Links und Formularfelder entfallen. Neuer Text bleibt kopierbar, solange die Seite nicht zusätzlich geschwärzt, zugeschnitten oder als Bild exportiert wird.',
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
        <div className="drop-overlay">
          <Plus size={64} strokeWidth={1} />
          <strong>{t('Einfach loslassen.')}</strong>
          <span>{t('Dein Dokument. Dein nächster Schritt.')}</span>
        </div>
      )}
    </>
  );
}
