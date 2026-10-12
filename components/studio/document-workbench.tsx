'use client';
import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Bookmark,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  Download,
  FileText,
  GripVertical,
  IndentIncrease,
  IndentDecrease,
  List,
  LoaderCircle,
  Plus,
  Redo2,
  ShieldCheck,
  TextCursorInput,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FormCanvas } from './form-canvas';
import { PagePreview } from './canvas';
import {
  readDocumentDraft,
  saveDocumentDraft,
  newFormField,
  fieldLabels,
  moveBookmark,
  indentBookmark,
  bookmarkSubtreeEnd,
  bookmarkSibling,
  type DocumentTool,
  type DocumentSessions,
  type DocumentDraft,
  type FormField,
  type FieldRect,
} from '@/lib/document-tools';
import { openSource, formatSize, uid, type Source, type JobResult } from '@/lib/pdf-engine';

type Props = {
  tool: DocumentTool;
  sources: Source[];
  sessions: DocumentSessions;
  onSessions: Dispatch<SetStateAction<DocumentSessions>>;
  onBack: () => void;
  onTool: (tool: DocumentTool) => void;
  onUse: (result: JobResult) => Promise<void>;
  pending: boolean;
  onBusy: (value: boolean) => void;
};
export function DocumentWorkbench({
  tool,
  sources,
  sessions,
  onSessions,
  onBack,
  onTool,
  onUse,
  pending,
  onBusy,
}: Props) {
  const { t } = useLanguage();
  const [sourceId, setSourceId] = useState(sources[0].id),
    [page, setPage] = useState(0),
    [selectedId, setSelectedId] = useState(''),
    [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [creating, setCreating] = useState<'text' | 'multiline' | 'checkbox' | 'dropdown' | null>(null),
    [flatten, setFlatten] = useState(false);
  const [output, setOutput] = useState<JobResult | null>(null),
    [outputUrl, setOutputUrl] = useState(''),
    [outputSource, setOutputSource] = useState<Source | null>(null),
    [showResult, setShowResult] = useState(false),
    [outputPage, setOutputPage] = useState(0);
  const source = sources.find((s) => s.id === sourceId) || sources[0],
    session = sessions[source.id],
    draft = session?.current,
    locked = loading || busy;
  const controller = useRef<AbortController | null>(null),
    dragIndex = useRef<number | null>(null),
    state = useRef({ session, locked });
  state.current = { session, locked };
  const isBookmarks = tool === 'bookmarks',
    design = tool === 'create-form',
    fields = draft?.fields.filter((f) => !f.deleted) || [],
    selectedField = fields.find((f) => f.id === selectedId),
    selectedBookmark = draft?.bookmarks.find((b) => b.id === selectedId);
  const title = isBookmarks
    ? 'Lesezeichen bearbeiten'
    : design
      ? 'Formular erstellen'
      : 'Formular ausfüllen';
  useEffect(() => {
    setPage(0);
    setSelectedId('');
    setOutput(null);
    setShowResult(false);
    setError('');
    setQuery('');
  }, [source.id]);
  useEffect(() => {
    setCreating(null);
    setSelectedId('');
    setQuery('');
    setShowResult(false);
    setError('');
  }, [tool]);
  useEffect(() => {
    if (sessions[source.id]) {
      setLoading(false);
      return;
    }
    let live = true;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    readDocumentDraft(source, abort.signal)
      .then((current) => {
        if (live) onSessions((old) => ({ ...old, [source.id]: { current, past: [], future: [] } }));
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      abort.abort();
    };
    // The source is immutable; subsequent changes belong to its retained draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id]);
  useEffect(() => {
    onBusy(busy || loading);
    return () => onBusy(false);
  }, [busy, loading, onBusy]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    setOutputSource(null);
    if (!output) {
      setOutputUrl('');
      return;
    }
    const url = URL.createObjectURL(output.blob);
    setOutputUrl(url);
    let live = true,
      preview: Source | undefined;
    openSource(new File([output.blob], output.filename, { type: 'application/pdf' }))
      .then((s) => {
        preview = s;
        if (live) setOutputSource(s);
        else void s.pdf.loadingTask.destroy();
      })
      .catch(() => {});
    return () => {
      live = false;
      URL.revokeObjectURL(url);
      if (preview) void preview.pdf.loadingTask.destroy();
    };
  }, [output]);
  function change(next: DocumentDraft) {
    if (locked || !session || JSON.stringify(next) === JSON.stringify(session.current)) return;
    onSessions((old) => ({
      ...old,
      [source.id]: {
        current: next,
        past: [...session.past, session.current].slice(-40),
        future: [],
      },
    }));
    setOutput(null);
    setShowResult(false);
    setError('');
  }
  function history(redo = false) {
    const current = state.current.session;
    if (state.current.locked || !current) return;
    const list = redo ? current.future : current.past;
    if (!list.length) return;
    const next = redo ? list[0] : list[list.length - 1];
    onSessions((old) => ({
      ...old,
      [source.id]: redo
        ? {
            current: next,
            past: [...current.past, current.current],
            future: current.future.slice(1),
          }
        : {
            current: next,
            past: current.past.slice(0, -1),
            future: [current.current, ...current.future],
          },
    }));
    setOutput(null);
    setShowResult(false);
    setError('');
  }
  const historyRef = useRef(history);
  historyRef.current = history;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopImmediatePropagation();
        historyRef.current(e.shiftKey);
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  function patchField(id: string, patch: Partial<FormField>) {
    if (draft)
      change({ ...draft, fields: draft.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }
  function showProperties() {
    if (window.matchMedia('(max-width:760px)').matches)
      requestAnimationFrame(() =>
        document
          .getElementById('document-properties')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
  }
  function selectField(id: string) {
    setSelectedId(id);
    setCreating(null);
    const field = fields.find((f) => f.id === id);
    if (field?.widgets.length) setPage(field.widgets[0].page);
    showProperties();
  }
  function placeField(rect: FieldRect) {
    if (!draft || !creating) return;
    if (fields.length >= 1000) {
      setError('Maximal 1.000 Felder.');
      return;
    }
    const field = newFormField(
      draft.fields,
      creating === 'multiline' ? 'text' : creating,
      page,
      rect,
      creating === 'multiline',
    );
    change({ ...draft, fields: [...draft.fields, field] });
    setSelectedId(field.id);
    setCreating(null);
    showProperties();
  }
  function patchRect(id: string, index: number, rect: FieldRect) {
    const field = fields.find((f) => f.id === id);
    if (!field || field.existing) return;
    const r = { ...rect };
    r.w = Math.max(0.01, Math.min(1, r.w));
    r.h = Math.max(0.01, Math.min(1, r.h));
    r.x = Math.max(0, Math.min(1 - r.w, r.x));
    r.y = Math.max(0, Math.min(1 - r.h, r.y));
    patchField(id, { widgets: field.widgets.map((w, i) => (i === index ? { ...w, rect: r } : w)) });
  }
  function addBookmark() {
    if (!draft) return;
    const bookmark = {
      id: uid(),
      title: `Seite ${page + 1}`,
      page,
      depth: 0,
      open: true,
      targetChanged: true,
    };
    change({ ...draft, bookmarks: [...draft.bookmarks, bookmark] });
    setSelectedId(bookmark.id);
  }
  function patchBookmark(patch: Partial<NonNullable<typeof selectedBookmark>>) {
    if (draft && selectedBookmark)
      change({
        ...draft,
        bookmarks: draft.bookmarks.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)),
      });
  }
  async function save() {
    if (!draft || locked) return;
    setBusy(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await saveDocumentDraft(source, draft, tool, flatten, abort.signal);
      setOutput(result);
      setOutputPage(0);
      setShowResult(true);
      requestAnimationFrame(() =>
        document
          .getElementById('document-preview')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      toast.success('Deine PDF ist bereit.');
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  const select = (
    label: string,
    value: string,
    items: [string, string][],
    onChange: (value: string) => void,
    disabled = false,
  ) => (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange} disabled={locked || disabled}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  function fieldValue(field: FormField) {
    const disabled = locked || field.readOnly || field.kind === 'unsupported',
      value = Array.isArray(field.value) ? field.value[0] || '' : String(field.value || '');
    if (field.kind === 'checkbox')
      return (
        <label className="form-check-value">
          <Checkbox
            checked={field.value === true}
            onCheckedChange={(v) => patchField(field.id, { value: v === true })}
            disabled={disabled}
            aria-label={`Wert für ${field.name}`}
          />
          Angekreuzt
        </label>
      );
    if (field.kind === 'text')
      return (
        <label className="field">
          <span>Inhalt{field.required ? ' · Pflichtfeld' : ''}</span>
          {field.multiline ? (
            <Textarea
              aria-label={`Wert für ${field.name}`}
              value={value}
              maxLength={field.maxLength || 20000}
              onChange={(e) => patchField(field.id, { value: e.target.value })}
              disabled={disabled}
            />
          ) : (
            <Input
              aria-label={`Wert für ${field.name}`}
              value={value}
              maxLength={field.maxLength || 10000}
              onChange={(e) => patchField(field.id, { value: e.target.value })}
              disabled={disabled}
            />
          )}
        </label>
      );
    if ((field.kind === 'list' || field.kind === 'dropdown') && field.multiple)
      return (
        <fieldset className="form-multiple">
          <legend>Ausgewählte Einträge</legend>
          {field.options.map((option) => (
            <label key={option}>
              <Checkbox
                checked={Array.isArray(field.value) && field.value.includes(option)}
                onCheckedChange={(v) =>
                  patchField(field.id, {
                    value: v
                      ? [...(Array.isArray(field.value) ? field.value : []), option]
                      : (Array.isArray(field.value) ? field.value : []).filter((o) => o !== option),
                  })
                }
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </fieldset>
      );
    if (['radio', 'dropdown', 'list'].includes(field.kind))
      return select(
        `Wert für ${field.name}`,
        field.options.includes(value) ? String(field.options.indexOf(value)) : 'none',
        [
          ['none', 'Keine Auswahl'],
          ...field.options.map((o, i) => [String(i), o || '(Leer)'] as [string, string]),
        ],
        (v) => patchField(field.id, { value: v === 'none' ? '' : field.options[Number(v)] }),
        disabled,
      );
    return <p className="fine-note">Dieses Spezialfeld bleibt unverändert erhalten.</p>;
  }
  return (
    <main className="document-workbench">
      <header className="workbench-header">
        <Button variant="ghost" onClick={onBack} disabled={locked}>
          <ChevronLeft size={17} />
          {t('Alle Werkzeuge')}
        </Button>
        <span className="device-tag">
          <ShieldCheck size={14} />
          LOKAL AUF DEINEM GERÄT
        </span>
        <div className="workbench-history">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bearbeitung rückgängig"
            disabled={locked || !session?.past.length}
            onClick={() => history()}
          >
            <Undo2 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bearbeitung wiederholen"
            disabled={locked || !session?.future.length}
            onClick={() => history(true)}
          >
            <Redo2 size={18} />
          </Button>
        </div>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">DEIN DOKUMENT. DEINE STRUKTUR.</span>
          <h1>
            {isBookmarks ? <Bookmark /> : <ClipboardPen />}
            {title}
          </h1>
        </div>
        <div className="workbench-modes">
          {(['fill-form', 'create-form', 'bookmarks'] as const).map((id) => (
            <Button
              key={id}
              variant={tool === id ? 'default' : 'ghost'}
              onClick={() => onTool(id)}
              disabled={locked}
            >
              {id === 'fill-form'
                ? 'Ausfüllen'
                : id === 'create-form'
                  ? 'Felder erstellen'
                  : 'Lesezeichen'}
            </Button>
          ))}
        </div>
      </div>
      {pending && (
        <p className="workbench-notice">
          Hier wird die vollständige Originaldatei bearbeitet. Änderungen aus anderen Werkzeugen
          zuerst dort anwenden und „Ergebnis weiterbearbeiten“ wählen.
        </p>
      )}
      <div className="workbench-layout">
        <section className="workbench-stage" id="document-preview">
          <div className="workbench-filebar">
            <div className="workbench-source">
              {select(
                t('Dokument'),
                source.id,
                sources.map((s) => [s.id, s.name]),
                (id) => setSourceId(id),
              )}
            </div>
            <span>
              {source.pdf.numPages} {t('Seiten ·')} {formatSize(source.size)}
            </span>
          </div>
          <div className="workbench-pagebar">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Vorherige Formularseite"
              disabled={locked || page === 0 || showResult}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={18} />
            </Button>
            {select(
              t('Seite'),
              String(page),
              Array.from({ length: source.pdf.numPages }, (_, i) => [
                String(i),
                `${i + 1} / ${source.pdf.numPages}`,
              ]),
              (v) => setPage(Number(v)),
              showResult,
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Nächste Formularseite"
              disabled={locked || page === source.pdf.numPages - 1 || showResult}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={18} />
            </Button>
            <div className="workbench-view-toggle">
              <Button
                size="sm"
                variant={!showResult ? 'secondary' : 'ghost'}
                onClick={() => setShowResult(false)}
              >
                {t('Bearbeiten')}
              </Button>
              <Button
                size="sm"
                variant={showResult ? 'secondary' : 'ghost'}
                disabled={!output}
                onClick={() => setShowResult(true)}
              >
                {t('Ergebnis')}
              </Button>
            </div>
          </div>
          {design && !showResult && (
            <div className="form-create-toolbar">
              {(
                [
                  ['text', 'Textfeld', TextCursorInput],
                  ['multiline', 'Textbereich', List],
                  ['checkbox', 'Checkbox', CheckSquare],
                  ['dropdown', 'Auswahlliste', List],
                ] as const
              ).map(([kind, label, Icon]) => (
                <Button
                  key={kind}
                  size="sm"
                  variant={creating === kind ? 'default' : 'outline'}
                  disabled={locked || draft?.xfa}
                  onClick={() => {
                    setCreating(creating === kind ? null : kind);
                    setSelectedId('');
                  }}
                >
                  <Icon size={16} />
                  {label}
                </Button>
              ))}
            </div>
          )}
          <div className="workbench-context">
            {showResult
              ? 'Prüfe deine gespeicherte PDF vor dem Download.'
              : creating
                ? 'Ziehe auf der Seite einen Rahmen für das neue Feld auf.'
                : isBookmarks
                  ? 'Wähle eine Seite und lege dafür ein Lesezeichen an.'
                  : design
                    ? 'Feldtyp wählen und aufziehen. Neue Felder kannst du ziehen und skalieren.'
                    : 'Ein Feld auf der Seite oder in der Liste auswählen und ausfüllen.'}
            {creating && <button onClick={() => setCreating(null)}>{t('Abbrechen')}</button>}
          </div>
          <div className="workbench-canvas">
            {showResult && output ? (
              <>
                <div className="workbench-result-banner">
                  <Check size={20} />
                  <span>{output.filename}</span>
                  <Button asChild>
                    <a href={outputUrl || undefined} download={output.filename}>
                      <Download size={16} />
                      {t('PDF herunterladen')}
                    </a>
                  </Button>
                </div>
                {outputSource ? (
                  <>
                    <div className="result-preview-pager">
                      <button
                        aria-label="Vorherige gespeicherte Seite"
                        disabled={outputPage === 0}
                        onClick={() => setOutputPage((p) => p - 1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span>
                        {outputPage + 1} / {output.pages}
                      </span>
                      <button
                        aria-label="Nächste gespeicherte Seite"
                        disabled={outputPage === output.pages - 1}
                        onClick={() => setOutputPage((p) => p + 1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <PagePreview
                      source={outputSource}
                      page={{
                        id: `saved-${outputPage}`,
                        sourceId: outputSource.id,
                        index: outputPage,
                        rotation: 0,
                        selected: true,
                      }}
                    />
                  </>
                ) : (
                  <LoaderCircle className="spin" />
                )}
              </>
            ) : (
              <FormCanvas
                source={source}
                pageIndex={page}
                fields={isBookmarks ? [] : fields}
                selectedId={selectedId}
                creating={!!creating}
                design={design}
                disabled={locked || !!draft?.xfa}
                onSelect={(id) => {
                  setSelectedId(id);
                  setCreating(null);
                  if (!design) showProperties();
                }}
                onCreate={placeField}
                onRect={patchRect}
              />
            )}
          </div>
          <div className="workbench-foot">
            <ShieldCheck size={14} />
            <span>
              {isBookmarks
                ? 'Lesezeichen und Seiten bleiben gemeinsam in einer PDF.'
                : 'Farbige Feldrahmen dienen der Bearbeitung.'}
            </span>
          </div>
        </section>
        <aside className="workbench-inspector">
          <button
            className="workbench-preview-jump"
            onClick={() =>
              document
                .getElementById('document-preview')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Zur Seitenvorschau
          </button>
          <div className="workbench-inspector-head">
            <span>{isBookmarks ? 'KAPITELSTRUKTUR' : 'FORMULARFELDER'}</span>
            <b>{isBookmarks ? draft?.bookmarks.length || 0 : fields.length}</b>
          </div>
          {loading ? (
            <div className="workbench-loading">
              <LoaderCircle className="spin" />
              Dokument wird gelesen …
            </div>
          ) : (
            draft && (
              <>
                {draft.xfa && !isBookmarks && (
                  <div className="notice">
                    Dieses Dokument verwendet XFA. Die Formularbearbeitung unterstützt gewöhnliche
                    PDF-Formulare (AcroForms).
                  </div>
                )}
                {isBookmarks ? (
                  <>
                    <Button
                      variant="outline"
                      className="add-bookmark"
                      onClick={addBookmark}
                      disabled={locked}
                    >
                      <Plus size={16} />
                      Lesezeichen für Seite {page + 1}
                    </Button>
                    <div className="bookmark-tree">
                      {draft.bookmarks.length ? (
                        draft.bookmarks.map((bookmark, index) => (
                          <button
                            key={bookmark.id}
                            className={`bookmark-row ${selectedId === bookmark.id ? 'selected' : ''}`}
                            style={{ paddingLeft: `${12 + Math.min(bookmark.depth, 8) * 14}px` }}
                            draggable={!locked}
                            onDragStart={(e) => {
                              dragIndex.current = index;
                              e.dataTransfer.setData('text/plain', bookmark.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              if (dragIndex.current !== null) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragIndex.current !== null)
                                change({
                                  ...draft,
                                  bookmarks: moveBookmark(
                                    draft.bookmarks,
                                    dragIndex.current,
                                    index,
                                  ),
                                });
                              dragIndex.current = null;
                            }}
                            onDragEnd={() => {
                              dragIndex.current = null;
                            }}
                            onClick={() => {
                              setSelectedId(bookmark.id);
                              if (bookmark.page !== null) setPage(bookmark.page);
                              setShowResult(false);
                            }}
                          >
                            <GripVertical size={13} />
                            <Bookmark size={15} />
                            <span>{bookmark.title || 'Ohne Titel'}</span>
                            <small>{bookmark.page === null ? '↗' : bookmark.page + 1}</small>
                          </button>
                        ))
                      ) : (
                        <div className="workbench-empty">
                          <Bookmark size={30} strokeWidth={1.3} />
                          <strong>Noch keine Lesezeichen</strong>
                          <p>Gib langen Dokumenten eine klare Kapitelstruktur.</p>
                        </div>
                      )}
                    </div>
                    {selectedBookmark && (
                      <div className="workbench-properties" id="document-properties">
                        <label className="field">
                          <span>Titel</span>
                          <Input
                            aria-label="Lesezeichen-Titel"
                            value={selectedBookmark.title}
                            maxLength={300}
                            disabled={locked}
                            onChange={(e) => patchBookmark({ title: e.target.value })}
                          />
                        </label>
                        {select(
                          'Zielseite',
                          selectedBookmark.page === null ? 'keep' : String(selectedBookmark.page),
                          [
                            ...(selectedBookmark.page === null
                              ? [['keep', 'Vorhandenes externes Ziel'] as [string, string]]
                              : []),
                            ...Array.from(
                              { length: source.pdf.numPages },
                              (_, i) => [String(i), `Seite ${i + 1}`] as [string, string],
                            ),
                          ],
                          (v) => {
                            if (v !== 'keep') {
                              patchBookmark({ page: Number(v), targetChanged: true });
                              setPage(Number(v));
                            }
                          },
                        )}
                        <label className="switch-field">
                          <span>Kapitel aufgeklappt</span>
                          <Switch
                            aria-label="Kapitel aufgeklappt"
                            checked={selectedBookmark.open}
                            onCheckedChange={(v) => patchBookmark({ open: v })}
                            disabled={locked}
                          />
                        </label>
                        <div className="bookmark-actions">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Lesezeichen ausrücken"
                            onClick={() =>
                              change({
                                ...draft,
                                bookmarks: indentBookmark(
                                  draft.bookmarks,
                                  draft.bookmarks.indexOf(selectedBookmark),
                                  -1,
                                ),
                              })
                            }
                            disabled={locked || selectedBookmark.depth === 0}
                          >
                            <IndentDecrease size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Lesezeichen einrücken"
                            onClick={() =>
                              change({
                                ...draft,
                                bookmarks: indentBookmark(
                                  draft.bookmarks,
                                  draft.bookmarks.indexOf(selectedBookmark),
                                  1,
                                ),
                              })
                            }
                            disabled={locked || draft.bookmarks.indexOf(selectedBookmark) === 0}
                          >
                            <IndentIncrease size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Lesezeichen nach oben"
                            disabled={
                              locked ||
                              bookmarkSibling(
                                draft.bookmarks,
                                draft.bookmarks.indexOf(selectedBookmark),
                                -1,
                              ) < 0
                            }
                            onClick={() => {
                              const i = draft.bookmarks.indexOf(selectedBookmark),
                                prev = bookmarkSibling(draft.bookmarks, i, -1);
                              change({
                                ...draft,
                                bookmarks: moveBookmark(draft.bookmarks, i, prev),
                              });
                            }}
                          >
                            Hoch
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Lesezeichen nach unten"
                            disabled={
                              locked ||
                              bookmarkSibling(
                                draft.bookmarks,
                                draft.bookmarks.indexOf(selectedBookmark),
                                1,
                              ) < 0
                            }
                            onClick={() => {
                              const i = draft.bookmarks.indexOf(selectedBookmark),
                                next = bookmarkSibling(draft.bookmarks, i, 1);
                              change({
                                ...draft,
                                bookmarks: moveBookmark(draft.bookmarks, next, i),
                              });
                            }}
                          >
                            Runter
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          className="delete-field"
                          onClick={() => {
                            const i = draft.bookmarks.indexOf(selectedBookmark),
                              end = bookmarkSubtreeEnd(draft.bookmarks, i);
                            change({
                              ...draft,
                              bookmarks: draft.bookmarks.filter((_, j) => j < i || j >= end),
                            });
                            setSelectedId('');
                          }}
                          disabled={locked}
                        >
                          <Trash2 size={15} />
                          Kapitel mit Unterpunkten entfernen
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="form-field-search">
                      <Input
                        aria-label="Formularfelder suchen"
                        placeholder="Feld suchen …"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="form-field-list">
                      {fields
                        .filter((f) =>
                          f.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
                        )
                        .map((field) => (
                          <button
                            key={field.id}
                            className={`form-field-row ${selectedId === field.id ? 'selected' : ''}`}
                            onClick={() => {
                              selectField(field.id);
                              setShowResult(false);
                            }}
                            disabled={locked}
                          >
                            <span className="field-type-icon">
                              {field.kind === 'checkbox' ? (
                                <CheckSquare size={16} />
                              ) : field.kind === 'text' ? (
                                <TextCursorInput size={16} />
                              ) : (
                                <List size={16} />
                              )}
                            </span>
                            <span>
                              <strong>{field.name}</strong>
                              <small>
                                {fieldLabels[field.kind]}
                                {field.widgets.length
                                  ? ` · Seite ${field.widgets[0].page + 1}`
                                  : ''}
                                {field.readOnly ? ' · schreibgeschützt' : ''}
                              </small>
                            </span>
                            {field.required && <b>*</b>}
                          </button>
                        ))}
                    </div>
                    {!fields.length && (
                      <div className="workbench-empty">
                        <ClipboardPen size={32} strokeWidth={1.3} />
                        <strong>Keine interaktiven Felder</strong>
                        <p>
                          Du kannst Textfelder, Checkboxen und Auswahllisten auf dieser PDF
                          ergänzen.
                        </p>
                        {!design && (
                          <Button variant="outline" onClick={() => onTool('create-form')}>
                            Formularfelder erstellen
                          </Button>
                        )}
                      </div>
                    )}
                    {creating && (
                      <div className="workbench-properties" id="document-properties">
                        <p className="fine-note">
                          Ziehe das Feld auf der Seite auf oder füge es mittig ein.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() =>
                            placeField({
                              x: 0.15,
                              y: 0.25,
                              w: creating === 'checkbox' ? 0.045 : 0.55,
                              h:
                                creating === 'multiline'
                                  ? 0.14
                                  : creating === 'checkbox'
                                    ? 0.032
                                    : 0.05,
                            })
                          }
                        >
                          Feld mittig einfügen
                        </Button>
                      </div>
                    )}
                    {selectedField && (
                      <div className="workbench-properties" id="document-properties">
                        <div className="property-heading">
                          <strong>{fieldLabels[selectedField.kind]}</strong>
                          <span>{selectedField.existing ? 'Vorhandenes Feld' : 'Neues Feld'}</span>
                        </div>
                        {design && !selectedField.existing && (
                          <label className="field">
                            <span>Feldname</span>
                            <Input
                              aria-label="Feldname"
                              value={selectedField.name}
                              maxLength={150}
                              onChange={(e) =>
                                patchField(selectedField.id, { name: e.target.value })
                              }
                              disabled={locked}
                            />
                          </label>
                        )}
                        {fieldValue(selectedField)}
                        {design && !selectedField.existing && (
                          <>
                            {selectedField.kind === 'dropdown' && (
                              <label className="field">
                                <span>Optionen · eine pro Zeile</span>
                                <Textarea
                                  aria-label="Auswahloptionen"
                                  value={selectedField.options.join('\n')}
                                  onChange={(e) =>
                                    patchField(selectedField.id, {
                                      options: e.target.value.split('\n'),
                                      value: '',
                                    })
                                  }
                                  disabled={locked}
                                />
                              </label>
                            )}
                            {selectedField.kind === 'text' && (
                              <>
                                <label className="field">
                                  <span>Schriftgröße in pt</span>
                                  <Input
                                    aria-label="Feld-Schriftgröße"
                                    type="number"
                                    min={6}
                                    max={48}
                                    value={selectedField.fontSize}
                                    onChange={(e) =>
                                      patchField(selectedField.id, {
                                        fontSize: Number(e.target.value),
                                      })
                                    }
                                    disabled={locked}
                                  />
                                </label>
                                <label className="switch-field">
                                  <span>Mehrere Zeilen</span>
                                  <Switch
                                    checked={selectedField.multiline}
                                    aria-label="Mehrzeiliges Textfeld"
                                    onCheckedChange={(v) =>
                                      patchField(selectedField.id, { multiline: v })
                                    }
                                    disabled={locked}
                                  />
                                </label>
                              </>
                            )}
                            <label className="switch-field">
                              <span>Pflichtfeld</span>
                              <Switch
                                aria-label="Pflichtfeld"
                                checked={selectedField.required}
                                onCheckedChange={(v) =>
                                  patchField(selectedField.id, { required: v })
                                }
                                disabled={locked}
                              />
                            </label>
                            <div className="position-inputs">
                              {(['x', 'y', 'w', 'h'] as const).map((key) => (
                                <label key={key}>
                                  {{ x: 'Links %', y: 'Oben %', w: 'Breite %', h: 'Höhe %' }[key]}
                                  <Input
                                    aria-label={`Feld ${{ x: 'Links', y: 'Oben', w: 'Breite', h: 'Höhe' }[key]} in Prozent`}
                                    type="number"
                                    min={key === 'x' || key === 'y' ? 0 : 1}
                                    max={100}
                                    step={0.5}
                                    value={
                                      Math.round(selectedField.widgets[0].rect[key] * 1000) / 10
                                    }
                                    disabled={locked}
                                    onChange={(e) =>
                                      patchRect(selectedField.id, 0, {
                                        ...selectedField.widgets[0].rect,
                                        [key]: Number(e.target.value) / 100,
                                      })
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                        {selectedField.readOnly && (
                          <p className="fine-note">
                            Dieses Feld ist in der Originaldatei schreibgeschützt.
                          </p>
                        )}
                        {design && selectedField.kind !== 'unsupported' && (
                          <Button
                            variant="ghost"
                            className="delete-field"
                            onClick={() => {
                              patchField(selectedField.id, { deleted: true });
                              setSelectedId('');
                            }}
                            disabled={locked}
                          >
                            <Trash2 size={15} />
                            Feld entfernen
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          )}
          <div className="workbench-save">
            {draft?.signed && (
              <p className="notice">
                Diese PDF enthält eine digitale Signatur. Änderungen können sie ungültig machen.
                Bewahre das Original auf.
              </p>
            )}
            {!isBookmarks && (
              <label className="switch-field">
                <span>
                  Felder fixieren<small>Werte als feste Inhalte speichern</small>
                </span>
                <Switch
                  checked={flatten}
                  aria-label="Formularfelder fixieren"
                  onCheckedChange={(v) => {
                    setFlatten(v);
                    setOutput(null);
                    setShowResult(false);
                  }}
                  disabled={locked}
                />
              </label>
            )}
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <Button
              className="apply-button"
              onClick={save}
              disabled={locked || !draft || (!isBookmarks && draft.xfa)}
            >
              {busy ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}
              <span>
                {busy
                  ? 'PDF wird erstellt …'
                  : isBookmarks
                    ? 'Lesezeichen speichern'
                    : 'Formular speichern'}
              </span>
            </Button>
            {busy && (
              <Button variant="ghost" onClick={() => controller.current?.abort()}>
                {t('Abbrechen')}
              </Button>
            )}
            <p className="fine-note">
              {isBookmarks
                ? 'Speichert alle Seiten mit deiner Kapitelstruktur.'
                : flatten
                  ? 'Die gespeicherten Felder sind danach nicht mehr interaktiv.'
                  : 'Die gespeicherte PDF bleibt in PDF-Readern ausfüllbar.'}
            </p>
            {output && (
              <Button
                variant="outline"
                disabled={locked}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onUse(output);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <FileText size={16} />
                {t('Ergebnis weiterbearbeiten')}
              </Button>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
