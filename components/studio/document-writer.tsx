'use client';
import { ResultActions, ResultSummary, useResultName, useResultAuditGate } from './result-actions';
import type { DownloadResult } from '@/lib/result-details';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Slice } from '@tiptap/pm/model';
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ImagePlus,
  Table2,
  Download,
  Save,
  FolderOpen,
  FilePlus2,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Check,
  LoaderCircle,
  Eye,
  PenLine,
  Scissors,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from './appearance';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { writerExtensions } from '@/lib/writer-extensions';
import {
  emptyWriterDocument,
  writerDocumentId,
  saveWriterDraft,
  listWriterDrafts,
  deleteWriterDraft,
  encodeWriterDocument,
  decodeWriterDocument,
  writerFilename,
  writerPageSize,
  normalizeWriterContent,
  type WriterDocument,
  type WriterSettings,
} from '@/lib/writer-model';
import { downloadBlob, openSource, renderPage, type Source } from '@/lib/pdf-engine';

function ToolButton({
  label,
  children,
  onClick,
  active,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="writer-icon-button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PdfPage({ source, index }: { source: Source; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    void renderPage(source, { index, rotation: 0 }, 1500, abort.signal)
      .then(({ canvas }) => {
        if (abort.signal.aborted || !ref.current) return;
        ref.current.width = canvas.width;
        ref.current.height = canvas.height;
        ref.current.getContext('2d')?.drawImage(canvas, 0, 0);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(error.message);
      });
    return () => abort.abort();
  }, [source, index]);
  return error ? (
    <p role="alert">
      {t(
        'Die Seitenvorschau konnte nicht angezeigt werden.',
        'The page preview could not be displayed.',
      )}
    </p>
  ) : (
    <canvas
      ref={ref}
      className="writer-pdf-page"
      aria-label={t('PDF-Seitenvorschau', 'PDF page preview')}
    />
  );
}

export function DocumentWriter({
  initial,
  onChange,
  onBack,
  onBusy,
  onSaved,
}: {
  initial: WriterDocument;
  onChange: (document: WriterDocument) => void;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
  onSaved: (revision: string) => void;
}) {
  const { t, language } = useLanguage();
  const [doc, setDoc] = useState(initial);
  const latest = useRef(doc);
  latest.current = doc;
  const notifyChange = useRef(onChange);
  notifyChange.current = onChange;
  const notifySaved = useRef(onSaved);
  notifySaved.current = onSaved;
  const [tab, setTab] = useState<'text' | 'insert' | 'page'>('text');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Source | null>(null);
  const [exported, setExported] = useState<DownloadResult | null>(null);
  const [exportUrl, setExportUrl] = useState('');
  const { onAuditState, auditBlocked } = useResultAuditGate(exported);
  const [exportName, renameExport] = useResultName(exported);
  useEffect(() => {
    setExported(null);
  }, [doc.id, doc.updated]);
  useEffect(() => {
    if (!exported) {
      setExportUrl('');
      return;
    }
    const url = URL.createObjectURL(exported.blob);
    setExportUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [exported]);
  const previewRef = useRef<Source | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [draftOpen, setDraftOpen] = useState(false);
  const [drafts, setDrafts] = useState<WriterDocument[]>([]);
  const [draftError, setDraftError] = useState('');
  const [rows, setRows] = useState(3),
    [columns, setColumns] = useState(3);
  const imageInput = useRef<HTMLInputElement>(null),
    draftInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true),
    savedRevision = useRef(''),
    saveQueue = useRef(Promise.resolve());
  const revision = (value: WriterDocument) => value.id + ':' + value.updated;
  const update = (patch: Partial<WriterDocument>) => {
    const next = {
      ...latest.current,
      ...patch,
      updated: Math.max(Date.now(), latest.current.updated + 1),
    };
    latest.current = next;
    setDoc(next);
    notifyChange.current(next);
    setSaveStatus('saving');
  };
  const persist = useCallback((value = latest.current) => {
    const task = saveQueue.current.catch(() => {}).then(() => saveWriterDraft(value));
    saveQueue.current = task;
    void task.then(
      () => {
        if (revision(latest.current) === revision(value)) {
          savedRevision.current = revision(value);
          notifySaved.current(revision(value));
          if (mounted.current) setSaveStatus('saved');
        }
      },
      () => {
        if (mounted.current) setSaveStatus('error');
      },
    );
    return task;
  }, []);
  const save = async () => {
    try {
      await persist();
      toast.success(t('Entwurf lokal gespeichert.', 'Draft saved locally.'));
    } catch {
      toast.error(
        t(
          'Speichern nicht möglich. Bitte den Entwurf als Datei sichern.',
          'Could not save. Please download the draft file.',
        ),
      );
    }
  };
  const insertImage = async (file: File) => {
    if (!editor || busy) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      toast.error(
        t(
          'Bitte ein PNG-, JPG- oder WebP-Bild bis 15 MB auswählen.',
          'Choose a PNG, JPG or WebP image up to 15 MB.',
        ),
      );
      return;
    }
    setBusy(true);
    onBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error();
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let src = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
      if (src.length > 2.8 * 1024 * 1024) {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        src = canvas.toDataURL('image/jpeg', 0.82);
      }
      const candidate = editor.getJSON();
      normalizeWriterContent({
        ...candidate,
        content: [...(candidate.content || []), { type: 'image', attrs: { src } }],
      });
      editor
        .chain()
        .focus()
        .setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') })
        .run();
      setTab('insert');
    } catch {
      toast.error(
        t(
          'Das Bild konnte nicht eingefügt werden. Bitte ein kleineres Bild versuchen.',
          'Could not insert the image. Please try a smaller image.',
        ),
      );
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
      onBusy(false);
    }
  };
  const imageHandler = useRef(insertImage);
  imageHandler.current = insertImage;
  const editor = useEditor(
    {
      extensions: writerExtensions(t('Hier schreiben …', 'Start writing …')),
      content: doc.content,
      immediatelyRender: false,
      onUpdate: ({ editor }) => update({ content: editor.getJSON() }),
      editorProps: {
        attributes: {
          class: 'writer-document',
          'aria-label': t('Dokumentinhalt', 'Document content'),
          role: 'textbox',
          'aria-multiline': 'true',
          spellcheck: 'true',
        },
        transformPastedHTML: (html) =>
          html.replace(/<(?:img|video|audio|iframe|source|link|object|embed)\b[^>]*>/gi, (tag) => {
            const src = /^<img\b/i.test(tag)
              ? tag.match(
                  /\bsrc\s*=\s*["'](data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2})["']/i,
                )?.[1]
              : undefined;
            return src ? `<img src="${src}">` : '';
          }),
        transformPasted: (slice, view) => {
          const data = slice.toJSON();
          if (!data?.content?.length) return slice;
          try {
            const clean = normalizeWriterContent({ type: 'doc', content: data.content });
            return Slice.fromJSON(view.state.schema, { ...data, content: clean.content });
          } catch {
            toast.error(
              t(
                'Der eingefügte Inhalt ist zu groß oder wird nicht unterstützt.',
                'The pasted content is too large or unsupported.',
              ),
            );
            return Slice.empty;
          }
        },
        handlePaste: (_view, event) => {
          const file = event.clipboardData?.files[0];
          if (!file) return false;
          event.preventDefault();
          void imageHandler.current(file);
          return true;
        },
        handleDrop: (_view, event) => {
          const file = event.dataTransfer?.files[0];
          if (!file) return false;
          event.preventDefault();
          event.stopPropagation();
          void imageHandler.current(file);
          return true;
        },
      },
    },
    [doc.id],
  );
  const selected = useEditorState({
    editor,
    // A document switch can briefly retain the previous editor's state snapshot.
    selector: ({ editor: e }) =>
      e && !e.isDestroyed
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            table: e.isActive('table'),
            image: e.isActive('image'),
            heading: e.isActive('heading') ? String(e.getAttributes('heading').level) : '0',
            align:
              e.getAttributes(e.isActive('heading') ? 'heading' : 'paragraph').textAlign || 'left',
            lineHeight: String(
              e.getAttributes(e.isActive('heading') ? 'heading' : 'paragraph').lineHeight || 1.4,
            ),
            font: e.getAttributes('textStyle').fontFamily || 'MoinSans',
            size: e.getAttributes('textStyle').fontSize || '11pt',
            color: e.getAttributes('textStyle').color || '#17252b',
            imageWidth: Number(e.getAttributes('image').widthPercent || 100),
            imageAlt: String(e.getAttributes('image').alt || ''),
            undo: e.can().undo(),
            redo: e.can().redo(),
            words: e.getText().trim().split(/\s+/).filter(Boolean).length,
          }
        : null,
  });

  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (savedRevision.current !== revision(latest.current)) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener('beforeunload', beforeUnload);
      void persist().catch(() => {});
      if (previewRef.current) void previewRef.current.pdf.loadingTask.destroy();
    };
  }, [persist]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void persist(doc).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [doc, persist]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    // Locking the editor for export/preview must not count as a content edit.
    editor?.setEditable(!busy && mode === 'edit', false);
    if (editor) editor.view.dom.setAttribute('aria-label', t('Dokumentinhalt', 'Document content'));
  }, [editor, busy, mode, t]);

  const settings = (patch: Partial<WriterSettings>) =>
    update({ settings: { ...latest.current.settings, ...patch } });
  const exportPdf = async (showPreview: boolean) => {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    try {
      const { createWriterPdf } = await import('@/lib/writer-pdf');
      const blob = await createWriterPdf(latest.current, language);
      const { auditPdfExport } = await import('@/lib/export-audit');
      const exportAudit = await auditPdfExport(
        blob,
        undefined,
        [],
        undefined,
        undefined,
        new AbortController().signal,
      );
      if (!mounted.current) return;
      if (showPreview) {
        const source = await openSource(
          new File([blob], writerFilename(latest.current.title, 'pdf'), {
            type: 'application/pdf',
          }),
        );
        if (!mounted.current) {
          void source.pdf.loadingTask.destroy();
          return;
        }
        const previous = previewRef.current;
        previewRef.current = source;
        setPreview(source);
        setExported({
          blob,
          filename: writerFilename(latest.current.title, 'pdf'),
          kind: 'pdf',
          pages: source.pdf.numPages,
          exportAudit,
        });
        setPreviewPage(0);
        setMode('preview');
        if (previous) void previous.pdf.loadingTask.destroy();
      } else {
        const filename = writerFilename(latest.current.title, 'pdf');
        setExported({ blob, filename, kind: 'pdf', exportAudit });
        if (exportAudit.status === 'checked') downloadBlob(blob, filename);
      }
    } catch (error) {
      toast.error(
        t(
          'PDF konnte nicht erstellt werden. Bitte Inhalt und Bilder prüfen.',
          'Could not create the PDF. Please check the content and images.',
        ),
        { description: error instanceof Error ? t(error.message) : undefined },
      );
    } finally {
      if (mounted.current) setBusy(false);
      onBusy(false);
    }
  };
  const downloadDraft = () => {
    try {
      downloadBlob(
        encodeWriterDocument(latest.current),
        writerFilename(latest.current.title, 'moindoc'),
      );
    } catch {
      toast.error(
        t(
          'Der Entwurf ist zu groß oder enthält ungültige Inhalte.',
          'The draft is too large or contains invalid content.',
        ),
      );
    }
  };
  const showDrafts = async () => {
    setDraftError('');
    setDraftOpen(true);
    try {
      await persist();
      setDrafts(await listWriterDrafts());
    } catch {
      setDraftError(
        t(
          'Lokale Entwürfe sind gerade nicht verfügbar. Du kannst deinen Entwurf als Datei sichern.',
          'Local drafts are currently unavailable. You can still download your draft file.',
        ),
      );
    }
  };
  const switchDocument = async (value: WriterDocument) => {
    try {
      await persist();
      const checked = editor?.schema.nodeFromJSON(value.content);
      checked?.check();
      latest.current = value;
      setDoc(value);
      onChange(value);
      setMode('edit');
      setSaveStatus('saving');
      setDraftOpen(false);
    } catch {
      toast.error(
        t(
          'Der Entwurf konnte nicht geöffnet werden. Bitte den aktuellen Entwurf als Datei sichern.',
          'Could not open the draft. Please download the current draft file.',
        ),
      );
    }
  };
  const [pageWidth, pageHeight] = writerPageSize(doc.settings);
  const pageStyle = {
    '--writer-page-width': `${pageWidth}mm`,
    '--writer-page-height': `${pageHeight}mm`,
    '--writer-top': `${doc.settings.top}mm`,
    '--writer-right': `${doc.settings.right}mm`,
    '--writer-bottom': `${doc.settings.bottom}mm`,
    '--writer-left': `${doc.settings.left}mm`,
    '--writer-zoom': zoom / 100,
  } as CSSProperties;
  const formatDisabled = !editor || busy || mode !== 'edit';
  const format = (action: () => void) => {
    if (!formatDisabled) action();
  };

  return (
    <main className="document-writer" aria-label={t('Dokument erstellen', 'Create a document')}>
      <div className="writer-titlebar">
        <ToolButton label={t('Zurück', 'Back')} onClick={onBack} disabled={busy}>
          <ArrowLeft size={21} />
        </ToolButton>
        <div className="writer-identity">
          <label className="sr-only" htmlFor="writer-title">
            {t('Dokumenttitel', 'Document title')}
          </label>
          <input
            id="writer-title"
            value={doc.title}
            maxLength={160}
            disabled={busy}
            onChange={(event) => update({ title: event.target.value })}
            placeholder={t('Mein Dokument', 'My document')}
          />
          <span className="writer-save-state" data-state={saveStatus} role="status">
            {saveStatus === 'saved' ? (
              <Check size={14} />
            ) : saveStatus === 'saving' ? (
              <LoaderCircle size={14} className="spin" />
            ) : null}
            {saveStatus === 'saved'
              ? t('Lokal gespeichert', 'Saved locally')
              : saveStatus === 'saving'
                ? t('Wird gespeichert …', 'Saving …')
                : t('Nicht lokal gespeichert', 'Not saved locally')}
          </span>
        </div>
        <div className="writer-document-actions">
          <button
            type="button"
            className="writer-secondary"
            aria-label={t('Entwürfe', 'Drafts')}
            title={t('Entwürfe', 'Drafts')}
            disabled={busy}
            onClick={() => void showDrafts()}
          >
            <FolderOpen size={17} />
            <span>{t('Entwürfe', 'Drafts')}</span>
          </button>
          <button
            type="button"
            className="writer-secondary writer-save-button"
            aria-label={t('Entwurf speichern', 'Save draft')}
            title={t('Entwurf speichern', 'Save draft')}
            disabled={busy}
            onClick={() => void save()}
          >
            <Save size={17} />
            <span>{t('Entwurf speichern', 'Save draft')}</span>
          </button>
          <button
            type="button"
            className="writer-download"
            disabled={busy || auditBlocked}
            onClick={() =>
              exported ? downloadBlob(exported.blob, exportName) : void exportPdf(false)
            }
          >
            {busy ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}
            <span>{t('Als PDF herunterladen', 'Download as PDF')}</span>
          </button>
        </div>
      </div>
      {exported && (
        <section className="writer-export" aria-label={t('PDF-Ergebnis', 'PDF result')}>
          <ResultSummary result={exported} />
          <ResultActions
            onAuditState={onAuditState}
            result={exported}
            url={exportUrl}
            filename={exportName}
            onRename={renameExport}
            disabled={busy}
            label={t('PDF herunterladen', 'Download PDF')}
          />
        </section>
      )}
      {saveStatus === 'error' && (
        <div className="writer-storage-error" role="alert">
          {t(
            'Deine Änderungen sind noch nicht lokal gespeichert.',
            'Your changes have not been saved locally yet.',
          )}{' '}
          <button type="button" onClick={downloadDraft}>
            {t('Entwurf als Datei sichern', 'Download draft file')}
          </button>
        </div>
      )}
      <div className="writer-ribbon">
        <div
          className="writer-tabs"
          role="tablist"
          aria-label={t('Editorbereiche', 'Editor sections')}
        >
          {(['text', 'insert', 'page'] as const).map((id, i) => (
            <button
              type="button"
              key={id}
              role="tab"
              id={`writer-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`writer-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(event) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const ids = ['text', 'insert', 'page'] as const;
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 2
                        : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                  setTab(ids[next]);
                  document.getElementById(`writer-tab-${ids[next]}`)?.focus();
                }
              }}
              onClick={() => setTab(id)}
            >
              {[t('Text', 'Text'), t('Einfügen', 'Insert'), t('Seite', 'Page')][i]}
            </button>
          ))}
          <div className="writer-view-toggle">
            <ToolButton
              label={t('Bearbeiten', 'Edit')}
              active={mode === 'edit'}
              disabled={busy}
              onClick={() => setMode('edit')}
            >
              <PenLine size={17} />
            </ToolButton>
            <button
              type="button"
              className="writer-preview-button"
              aria-pressed={mode === 'preview'}
              disabled={busy}
              onClick={() => void exportPdf(true)}
            >
              <Eye size={17} />
              <span>{t('Seitenvorschau', 'Page preview')}</span>
            </button>
          </div>
        </div>
        <div
          role="tabpanel"
          id="writer-panel-text"
          aria-labelledby="writer-tab-text"
          hidden={tab !== 'text'}
          className="writer-formatting"
        >
          <div className="writer-selects">
            <select
              aria-label={t('Absatzformat', 'Paragraph style')}
              value={selected?.heading || '0'}
              disabled={formatDisabled}
              onChange={(e) => {
                const level = +e.target.value;
                level
                  ? editor
                      ?.chain()
                      .focus()
                      .toggleHeading({ level: level as 1 | 2 | 3 })
                      .run()
                  : editor?.chain().focus().setParagraph().run();
              }}
            >
              <option value="0">{t('Normal', 'Normal')}</option>
              {[1, 2, 3].map((level) => (
                <option key={level} value={level}>
                  {t('Überschrift', 'Heading')} {level}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Schriftart', 'Font')}
              value={selected?.font || 'MoinSans'}
              disabled={formatDisabled}
              onChange={(e) => editor?.chain().focus().setFontFamily(e.target.value).run()}
            >
              {[
                ['MoinSans', 'Sans'],
                ['MoinSerif', 'Serif'],
                ['MoinMono', 'Mono'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Schriftgröße', 'Font size')}
              value={selected?.size || '11pt'}
              disabled={formatDisabled}
              onChange={(e) => editor?.chain().focus().setFontSize(e.target.value).run()}
            >
              {[8, 9, 10, 11, 12, 14, 16, 18, 24, 32, 48, 72].map((size) => (
                <option key={size} value={`${size}pt`}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="writer-format-icons">
            <ToolButton
              label={t('Fett', 'Bold')}
              active={selected?.bold}
              disabled={formatDisabled}
              onClick={() => format(() => editor?.chain().focus().toggleBold().run())}
            >
              <Bold size={18} />
            </ToolButton>
            <ToolButton
              label={t('Kursiv', 'Italic')}
              active={selected?.italic}
              disabled={formatDisabled}
              onClick={() => format(() => editor?.chain().focus().toggleItalic().run())}
            >
              <Italic size={18} />
            </ToolButton>
            <ToolButton
              label={t('Unterstrichen', 'Underline')}
              active={selected?.underline}
              disabled={formatDisabled}
              onClick={() => format(() => editor?.chain().focus().toggleUnderline().run())}
            >
              <Underline size={18} />
            </ToolButton>
            <label className="writer-color" title={t('Textfarbe', 'Text color')}>
              A
              <input
                type="color"
                aria-label={t('Textfarbe', 'Text color')}
                value={/^#[\da-f]{6}$/i.test(selected?.color || '') ? selected!.color : '#17252b'}
                disabled={formatDisabled}
                onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
              />
            </label>
            <span className="writer-separator" />
            {(
              [
                ['left', AlignLeft, t('Linksbündig', 'Align left')],
                ['center', AlignCenter, t('Zentriert', 'Center')],
                ['right', AlignRight, t('Rechtsbündig', 'Align right')],
                ['justify', AlignJustify, t('Blocksatz', 'Justify')],
              ] as const
            ).map(([align, Icon, label]) => (
              <ToolButton
                key={align}
                label={label}
                active={selected?.align === align}
                disabled={formatDisabled}
                onClick={() => format(() => editor?.chain().focus().setTextAlign(align).run())}
              >
                <Icon size={18} />
              </ToolButton>
            ))}
            <span className="writer-separator" />
            <ToolButton
              label={t('Aufzählung', 'Bullet list')}
              active={selected?.bullet}
              disabled={formatDisabled}
              onClick={() => format(() => editor?.chain().focus().toggleBulletList().run())}
            >
              <List size={18} />
            </ToolButton>
            <ToolButton
              label={t('Nummerierung', 'Numbered list')}
              active={selected?.ordered}
              disabled={formatDisabled}
              onClick={() => format(() => editor?.chain().focus().toggleOrderedList().run())}
            >
              <ListOrdered size={18} />
            </ToolButton>
            <ToolButton
              label={t('Rückgängig', 'Undo')}
              disabled={formatDisabled || !selected?.undo}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={18} />
            </ToolButton>
            <ToolButton
              label={t('Wiederholen', 'Redo')}
              disabled={formatDisabled || !selected?.redo}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 size={18} />
            </ToolButton>
            <select
              aria-label={t('Zeilenabstand', 'Line spacing')}
              title={t('Zeilenabstand', 'Line spacing')}
              value={selected?.lineHeight || '1.4'}
              disabled={formatDisabled}
              onChange={(e) =>
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', {
                    lineHeight: Number(e.target.value),
                  })
                  .run()
              }
            >
              {[1, 1.15, 1.4, 1.5, 2, 2.5].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          role="tabpanel"
          id="writer-panel-insert"
          aria-labelledby="writer-tab-insert"
          hidden={tab !== 'insert'}
          className="writer-insert"
        >
          <button
            type="button"
            className="writer-secondary"
            disabled={formatDisabled}
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus size={17} />
            {t('Bild', 'Image')}
          </button>
          <label>
            {t('Zeilen', 'Rows')}
            <input
              type="number"
              min="1"
              max="20"
              value={rows}
              disabled={formatDisabled}
              onChange={(e) => setRows(Math.min(20, Math.max(1, +e.target.value)))}
            />
          </label>
          <label>
            {t('Spalten', 'Columns')}
            <input
              type="number"
              min="1"
              max="8"
              value={columns}
              disabled={formatDisabled}
              onChange={(e) => setColumns(Math.min(8, Math.max(1, +e.target.value)))}
            />
          </label>
          <button
            type="button"
            className="writer-secondary"
            disabled={formatDisabled || selected?.table}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows, cols: columns, withHeaderRow: true })
                .run()
            }
          >
            <Table2 size={17} />
            {t('Tabelle', 'Table')}
          </button>
          <button
            type="button"
            className="writer-secondary"
            disabled={formatDisabled || selected?.table}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }])
                .run()
            }
          >
            <Scissors size={17} />
            {t('Seitenumbruch', 'Page break')}
          </button>
          <button
            type="button"
            className="writer-secondary"
            disabled={formatDisabled}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            <Minus size={17} />
            {t('Trennlinie', 'Divider')}
          </button>
          {selected?.table && (
            <div className="writer-context-actions">
              <button
                type="button"
                disabled={formatDisabled}
                onClick={() => editor?.chain().focus().addRowAfter().run()}
              >
                {t('Zeile hinzufügen', 'Add row')}
              </button>
              <button
                type="button"
                disabled={formatDisabled}
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
              >
                {t('Spalte hinzufügen', 'Add column')}
              </button>
              <button
                type="button"
                disabled={formatDisabled}
                onClick={() => editor?.chain().focus().deleteRow().run()}
              >
                {t('Zeile entfernen', 'Remove row')}
              </button>
              <button
                type="button"
                disabled={formatDisabled}
                onClick={() => editor?.chain().focus().deleteColumn().run()}
              >
                {t('Spalte entfernen', 'Remove column')}
              </button>
              <button
                type="button"
                disabled={formatDisabled}
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                {t('Tabelle entfernen', 'Remove table')}
              </button>
            </div>
          )}
          {selected?.image && (
            <div className="writer-context-actions">
              <label>
                {t('Bildbreite', 'Image width')}
                <select
                  value={selected.imageWidth}
                  disabled={formatDisabled}
                  onChange={(e) =>
                    editor
                      ?.chain()
                      .focus()
                      .updateAttributes('image', { widthPercent: +e.target.value })
                      .run()
                  }
                >
                  {[25, 50, 75, 100].map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Bildbeschreibung', 'Image description')}
                <input
                  value={selected.imageAlt}
                  maxLength={300}
                  disabled={formatDisabled}
                  onChange={(e) =>
                    editor?.commands.updateAttributes('image', { alt: e.target.value })
                  }
                />
              </label>
              <button
                type="button"
                disabled={formatDisabled}
                onClick={() => editor?.chain().focus().deleteSelection().run()}
              >
                {t('Bild entfernen', 'Remove image')}
              </button>
            </div>
          )}
        </div>
        <div
          role="tabpanel"
          id="writer-panel-page"
          aria-labelledby="writer-tab-page"
          hidden={tab !== 'page'}
          className="writer-page-intro"
        >
          {t(
            'Format, Seitenränder und wiederkehrende Kopf- und Fußzeilen einstellen. Die Seitenvorschau zeigt das fertige PDF.',
            'Set the format, margins and repeating headers and footers. Page preview shows the finished PDF.',
          )}
        </div>
      </div>
      <div className="writer-body" style={pageStyle} data-page-settings={tab === 'page'}>
        <div className="writer-workspace" data-mode={mode} aria-busy={busy}>
          <div className="writer-paper-wrap" hidden={mode !== 'edit'}>
            {doc.settings.header && (
              <div className="writer-paper-header">{doc.settings.header}</div>
            )}
            <EditorContent editor={editor} />
            {doc.settings.footer && (
              <div className="writer-paper-footer">{doc.settings.footer}</div>
            )}
          </div>
          {mode === 'preview' && preview && <PdfPage source={preview} index={previewPage} />}
        </div>
        <aside className="writer-settings" aria-label={t('Seiteneinstellungen', 'Page settings')}>
          <h2>{t('Seite', 'Page')}</h2>
          <label>
            {t('Format', 'Format')}
            <select
              value={doc.settings.paper}
              disabled={busy}
              onChange={(e) => {
                settings({ paper: e.target.value as WriterSettings['paper'] });
                setMode('edit');
              }}
            >
              <option value="A4">A4 (210 × 297 mm)</option>
              <option value="A5">A5 (148 × 210 mm)</option>
              <option value="LETTER">Letter (216 × 279 mm)</option>
            </select>
          </label>
          <span className="writer-field-label">{t('Ausrichtung', 'Orientation')}</span>
          <div className="writer-orientation">
            {[false, true].map((landscape) => (
              <button
                type="button"
                key={String(landscape)}
                disabled={busy}
                aria-pressed={doc.settings.landscape === landscape}
                onClick={() => {
                  settings({ landscape });
                  setMode('edit');
                }}
              >
                {landscape ? t('Querformat', 'Landscape') : t('Hochformat', 'Portrait')}
              </button>
            ))}
          </div>
          <h3>
            {t('Seitenränder', 'Margins')} <small>mm</small>
          </h3>
          <div className="writer-margins">
            {(['top', 'right', 'bottom', 'left'] as const).map((side, i) => (
              <label key={side}>
                {
                  [
                    t('Oben', 'Top'),
                    t('Rechts', 'Right'),
                    t('Unten', 'Bottom'),
                    t('Links', 'Left'),
                  ][i]
                }
                <input
                  type="number"
                  min="10"
                  max="45"
                  key={`${doc.id}-${side}-${doc.settings[side]}`}
                  defaultValue={doc.settings[side]}
                  disabled={busy}
                  onBlur={(e) => {
                    const value = Math.min(45, Math.max(10, Number(e.target.value) || 20));
                    e.target.value = String(value);
                    settings({ [side]: value });
                    setMode('edit');
                  }}
                />
              </label>
            ))}
          </div>
          <label>
            {t('Kopfzeile', 'Header')}
            <input
              value={doc.settings.header}
              maxLength={140}
              disabled={busy}
              onChange={(e) => {
                settings({ header: e.target.value });
                setMode('edit');
              }}
            />
          </label>
          <label>
            {t('Fußzeile', 'Footer')}
            <input
              value={doc.settings.footer}
              maxLength={140}
              disabled={busy}
              onChange={(e) => {
                settings({ footer: e.target.value });
                setMode('edit');
              }}
            />
          </label>
          <label className="writer-checkbox">
            <input
              type="checkbox"
              checked={doc.settings.pageNumbers}
              disabled={busy}
              onChange={(e) => {
                settings({ pageNumbers: e.target.checked });
                setMode('edit');
              }}
            />
            {t('Seitenzahlen', 'Page numbers')}
          </label>
        </aside>
      </div>
      <div className="writer-statusbar">
        {mode === 'preview' && preview ? (
          <div className="writer-pager">
            <ToolButton
              label={t('Vorherige Seite', 'Previous page')}
              disabled={previewPage === 0}
              onClick={() => setPreviewPage((i) => i - 1)}
            >
              <ChevronLeft size={17} />
            </ToolButton>
            <span>
              {t('Seite', 'Page')} {previewPage + 1} {t('von', 'of')} {preview.pdf.numPages}
            </span>
            <ToolButton
              label={t('Nächste Seite', 'Next page')}
              disabled={previewPage + 1 === preview.pdf.numPages}
              onClick={() => setPreviewPage((i) => i + 1)}
            >
              <ChevronRight size={17} />
            </ToolButton>
          </div>
        ) : (
          <span>
            {doc.settings.paper} · {selected?.words || 0} {t('Wörter', 'words')}
          </span>
        )}
        <span className="writer-preview-hint">
          {t('Seitenumbrüche in der Seitenvorschau prüfen', 'Check page breaks in page preview')}
        </span>
        <div className="writer-zoom">
          <ToolButton
            label={t('Verkleinern', 'Zoom out')}
            disabled={zoom <= 60}
            onClick={() => setZoom((z) => z - 10)}
          >
            <Minus size={16} />
          </ToolButton>
          <span>{zoom}%</span>
          <ToolButton
            label={t('Vergrößern', 'Zoom in')}
            disabled={zoom >= 130}
            onClick={() => setZoom((z) => z + 10)}
          >
            <Plus size={16} />
          </ToolButton>
        </div>
      </div>
      <input
        type="file"
        ref={imageInput}
        className="sr-only"
        accept="image/png,image/jpeg,image/webp"
        tabIndex={-1}
        aria-label={t('Bild auswählen', 'Choose image')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void insertImage(file);
        }}
      />
      <input
        type="file"
        ref={draftInput}
        className="sr-only"
        accept=".moindoc"
        tabIndex={-1}
        aria-label={t('Dokumententwurf öffnen', 'Open document draft')}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            const value = await decodeWriterDocument(file);
            value.id = writerDocumentId();
            value.updated = Date.now();
            await switchDocument(value);
          } catch {
            toast.error(
              t(
                'Die Datei ist kein gültiger MoinPDF-Dokumententwurf.',
                'This file is not a valid MoinPDF document draft.',
              ),
            );
          }
        }}
      />
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="writer-drafts-dialog">
          <DialogHeader>
            <DialogTitle>{t('Dokumententwürfe', 'Document drafts')}</DialogTitle>
            <DialogDescription>
              {t(
                'Entwürfe werden in diesem Browser gespeichert. Eine .moindoc-Datei sichert den bearbeitbaren Inhalt für später oder für ein anderes Gerät.',
                'Drafts are saved in this browser. A .moindoc file keeps the editable content for later or another device.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="writer-draft-actions">
            <button
              type="button"
              className="writer-secondary"
              onClick={() =>
                void switchDocument(emptyWriterDocument(t('Mein Dokument', 'My document')))
              }
            >
              <FilePlus2 size={17} />
              {t('Leeres Dokument', 'Blank document')}
            </button>
            <button type="button" className="writer-secondary" onClick={downloadDraft}>
              <Download size={17} />
              {t('Entwurf herunterladen', 'Download draft')}
            </button>
            <button
              type="button"
              className="writer-secondary"
              onClick={() => draftInput.current?.click()}
            >
              <FolderOpen size={17} />
              {t('Entwurf öffnen', 'Open draft')}
            </button>
          </div>
          {draftError && <p role="alert">{draftError}</p>}
          <ul className="writer-draft-list">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <button
                  type="button"
                  className="writer-draft-open"
                  onClick={() => void switchDocument(draft)}
                >
                  <strong>{draft.title || t('Mein Dokument', 'My document')}</strong>
                  <small>
                    {new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(draft.updated)}
                  </small>
                </button>
                <ToolButton
                  label={t('Entwurf löschen', 'Delete draft')}
                  disabled={draft.id === doc.id}
                  onClick={() => {
                    if (
                      window.confirm(
                        t('Diesen gespeicherten Entwurf löschen?', 'Delete this saved draft?'),
                      )
                    )
                      void deleteWriterDraft(draft.id)
                        .then(() => listWriterDrafts())
                        .then(setDrafts)
                        .catch(() =>
                          setDraftError(
                            t(
                              'Der Entwurf konnte nicht gelöscht werden.',
                              'Could not delete the draft.',
                            ),
                          ),
                        );
                  }}
                >
                  <Trash2 size={17} />
                </ToolButton>
              </li>
            ))}
          </ul>
          <p className="writer-drafts-note">
            {t(
              'Das Löschen der Browserdaten entfernt auch lokale Entwürfe. Sichere wichtige Dokumente zusätzlich als Datei.',
              'Clearing browser data also removes local drafts. Download important documents as a backup.',
            )}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
