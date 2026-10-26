'use client';
import { WorkspaceContext } from './workspace-context';
import { FileArrivalCheck } from './ui-feedback';
import { SearchHighlight } from './search-highlight';
import { fileDropLabel } from '@/lib/interaction-feedback';
import { ui } from '@/lib/ui-language';

import { useLanguage, useTools } from '@/components/studio/appearance';

import './tool-chooser.css';
import { useMemo } from 'react';
import { useToolBrowserState } from './tool-browser-memory';
import { FileText, Plus, X, Trash2, LoaderCircle, Anchor } from 'lucide-react';
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { type WorkspaceTool } from '@/lib/tool-catalog';
import { searchTools } from '@/lib/localized-search';
import type { Source } from '@/lib/pdf-engine';

type Props = {
  sources: Source[];
  pageCount: number;
  locked: boolean;
  loading: boolean;
  dragOver: boolean;
  dragFileCount?: number | null;
  onChoose: (id: WorkspaceTool) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};
const categoryNames = ['Prüfen', 'Umwandeln', 'Seiten', 'Bearbeiten', 'Stapel'];
export function ToolChooser({
  sources,
  pageCount,
  locked,
  loading,
  dragOver,
  dragFileCount = null,
  onChoose,
  onAdd,
  onRemove,
  onClear,
}: Props) {
  const { t, language } = useLanguage();
  const { tools, groups } = useTools();
  const { query, setQuery, category, setCategory } = useToolBrowserState('all');
  const activeGroup = category === 'all' ? null : Number(category);
  const setActiveGroup = (value: number | null) =>
    setCategory(value === null ? 'all' : String(value));
  const suggestions = useMemo(
    () =>
      searchTools(query, tools)
        .filter((tool) => activeGroup === null || tool.group === activeGroup)
        .slice(0, 5),
    [query, activeGroup, tools],
  );
  const visibleTools = useMemo(
    () => tools.filter((tool) => activeGroup === null || tool.group === activeGroup),
    [activeGroup, tools],
  );
  return (
    <main className="tool-chooser" data-tool-browser="all">
      <WorkspaceContext sources={sources} pageCount={pageCount} locked={locked} onAdd={onAdd} />
      <header className="chooser-header">
        <span className="chooser-document-count">
          <FileText size={17} />
          {sources.length} {sources.length === 1 ? t('Datei') : t('Dateien')}
          <span>·</span>
          {pageCount} {pageCount === 1 ? t('Seite') : t('Seiten')}
        </span>
        <div className="chooser-file-actions">
          <Button variant="ghost" onClick={onAdd} disabled={locked}>
            {loading ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />}
            {t('Dateien hinzufügen')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('Arbeitsbereich leeren')}
                disabled={locked}
              >
                <Trash2 size={17} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Arbeitsbereich leeren?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    'Geöffnete Dokumente und Änderungen werden aus dieser Sitzung entfernt. Deine Originaldateien bleiben erhalten.',
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Behalten')}</AlertDialogCancel>
                <AlertDialogAction onClick={onClear}>{t('Leeren')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      <section className="chooser-content" aria-labelledby="chooser-title">
        <div className="chooser-files" aria-label={t('Geöffnete Dateien')}>
          {sources.map((s) => (
            <span className="chooser-file" key={s.id}>
              <FileText size={13} />
              <span title={s.name}>{s.name}</span>
              <FileArrivalCheck file={s} />
              <button
                onClick={() => onRemove(s.id)}
                disabled={locked}
                aria-label={ui(`${s.name} schließen`)}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="chooser-search-dock">
          {sources.length > 1 && (
            <Button
              variant="ghost"
              className="h-auto min-h-9 max-w-full whitespace-normal text-left"
              disabled={locked}
              onClick={() => onChoose('klar-schiff')}
            >
              <Anchor size={16} />
              {ui('Mit Klar Schiff automatisch ordnen')}
            </Button>
          )}
          <h1 id="chooser-title">{t('Was möchtest du tun?')}</h1>
          <Command
            shouldFilter={false}
            className="intent-command"
            loop
            label={t('Werkzeugvorschläge')}
          >
            <div className="intent-search">
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={t('Zum Beispiel: PDF kleiner machen …')}
                aria-label={t('Was möchtest du tun?')}
                disabled={locked}
              />
              {query && (
                <button
                  className="intent-clear"
                  onClick={() => setQuery('')}
                  aria-label={t('Suche leeren')}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <CommandList className={query.trim() ? 'intent-results' : 'intent-results is-empty'}>
              {query.trim() && (
                <>
                  <p className="intent-results-label" role="status">
                    {suggestions.length ? t('Passende Werkzeuge') : t('Kein passender Vorschlag')}
                  </p>
                  {suggestions.length ? (
                    suggestions.map((tool, i) => (
                      <CommandItem
                        data-tool-id={tool.id}
                        key={tool.id}
                        value={tool.id}
                        onSelect={() => onChoose(tool.id)}
                        disabled={locked}
                        className="intent-result"
                      >
                        <span
                          className={`intent-result-icon tone-${tool.group}`}
                          data-tool-tone={tool.group}
                        >
                          <tool.icon size={22} strokeWidth={1.6} />
                        </span>
                        <span>
                          <strong>
                            <SearchHighlight text={ui(tool.title)} query={query} />
                          </strong>
                          <small>
                            <SearchHighlight text={ui(tool.description)} query={query} />
                          </small>
                        </span>
                        {i === 0 && <kbd>↵</kbd>}
                      </CommandItem>
                    ))
                  ) : (
                    <p className="intent-no-match">
                      {activeGroup === null
                        ? t(
                            'Versuche zum Beispiel „Text auslesen“, „zusammenfügen“ oder wähle unten ein Werkzeug.',
                          )
                        : t(
                            'In dieser Kategorie gibt es keinen passenden Vorschlag. Wähle „Alle“, um in allen Werkzeugen zu suchen.',
                          )}
                    </p>
                  )}
                </>
              )}
            </CommandList>
          </Command>
          <div
            className="chooser-categories"
            data-browser-categories
            role="group"
            aria-label={t('Werkzeugkategorien')}
          >
            <button
              type="button"
              className="chooser-category"
              data-harbor-light
              aria-pressed={activeGroup === null}
              aria-controls="chooser-all-tools"
              disabled={locked}
              onClick={() => setActiveGroup(null)}
            >
              {t('Alle')}
            </button>
            {groups.map((label, group) => (
              <button
                type="button"
                className={`chooser-category category-${group}`}
                data-tool-tone={group}
                data-harbor-light
                key={group}
                title={ui(label)}
                aria-pressed={activeGroup === group}
                aria-controls="chooser-all-tools"
                disabled={locked}
                onClick={() => setActiveGroup(group)}
              >
                {t(categoryNames[group] ?? label)}
              </button>
            ))}
          </div>
        </div>
        <div className="chooser-tools-heading" aria-live="polite" aria-atomic="true">
          <h2>{activeGroup === null ? t('Alle Werkzeuge') : groups[activeGroup]}</h2>
          <span>{visibleTools.length}</span>
        </div>
        <div className="chooser-all-tools" id="chooser-all-tools">
          {groups.map(
            (label, group) =>
              (activeGroup === null || activeGroup === group) && (
                <section className="chooser-tool-section" key={group} aria-label={ui(label)}>
                  <div className="chooser-section-heading">
                    <h3>{ui(label)}</h3>
                  </div>
                  <nav className="chooser-tool-grid" aria-label={ui(`Werkzeuge: ${label}`)}>
                    {visibleTools
                      .filter((tool) => tool.group === group)
                      .map((tool) => (
                        <button
                          key={tool.id}
                          disabled={locked}
                          onClick={() => onChoose(tool.id)}
                          title={ui(tool.description)}
                          className={`chooser-tool tone-${tool.group}`}
                          data-tool-tone={tool.group}
                          data-tool-id={tool.id}
                          data-harbor-light
                        >
                          <span>
                            <tool.icon size={27} strokeWidth={1.45} />
                          </span>
                          <strong>
                            <SearchHighlight text={ui(tool.title)} query={query} />
                          </strong>
                        </button>
                      ))}
                  </nav>
                </section>
              ),
          )}
        </div>
      </section>
      {dragOver && (
        <div className="drop-overlay" role="status" aria-live="polite">
          <Plus size={60} strokeWidth={1} />
          <strong>{fileDropLabel(dragFileCount, language)}</strong>
          <span>{t('Einfach hier loslassen.')}</span>
        </div>
      )}
    </main>
  );
}
