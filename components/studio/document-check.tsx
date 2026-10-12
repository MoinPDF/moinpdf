'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useMemo, useState } from 'react';
import {
  Search,
  ScanText,
  Copy,
  File,
  Maximize,
  Check,
  LoaderCircle,
  FileSearch,
  Layers,
  Eye,
  SquareCheck,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { duplicateGroups, findPages, excerpt, searchTerms } from '@/lib/document-check';
import type { PageItem } from '@/lib/pdf-engine';
import type { DocumentIndex } from './use-document-index';
type Filter = 'all' | 'scan' | 'blank' | 'duplicates' | 'formats';
export function DocumentCheck({
  index,
  pages,
  locked,
  editedPageIds,
  language,
  onOpen,
  onSelect,
  onCollect,
  onTool,
}: {
  index: DocumentIndex;
  pages: PageItem[];
  locked: boolean;
  editedPageIds: string[];
  language: string;
  onOpen: (id: string) => void;
  onSelect: (ids: string[], exclude?: boolean) => void;
  onCollect: (ids: string[]) => void;
  onTool: (tool: 'ocr' | 'resize') => void;
}) {
  useLanguage();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState<Filter>('all'),
    [limit, setLimit] = useState(30);
  const { rows, checking, ocrBusy } = index,
    selected = new Set(pages.filter((p) => p.selected).map((p) => p.id)),
    edited = new Set(editedPageIds);
  const duplicates = useMemo(
    () => duplicateGroups(rows.filter((r) => !editedPageIds.includes(r.pageId))),
    [rows, editedPageIds],
  );
  const duplicateIds = new Set(duplicates.flatMap((g) => g.map((p) => p.pageId))),
    blanks = rows.filter((r) => r.blank && !edited.has(r.pageId)),
    scans = rows.filter((r) => r.needsOcr),
    pending = scans.filter((r) => !r.ocrDone && !r.error);
  const formats = [...new Set(rows.filter((r) => !r.error).map((r) => r.format))],
    matches = findPages(rows, query),
    isSearch = searchTerms(query).length > 0;
  const shown = isSearch
    ? matches
    : filter === 'scan'
      ? scans
      : filter === 'blank'
        ? blanks
        : filter === 'duplicates'
          ? rows.filter((r) => duplicateIds.has(r.pageId))
          : rows;
  const extras = duplicates
      .flatMap((group) => group.filter((p) => selected.has(p.pageId)).slice(1))
      .map((p) => p.pageId),
    errors = rows.filter((r) => r.error);
  function changeFilter(next: Filter) {
    setFilter(next);
    setQuery('');
    setLimit(30);
  }
  const filters = [
    { id: 'all', label: 'Alle Seiten', value: pages.length, icon: Layers },
    { id: 'scan', label: 'Scan-Seiten', value: scans.length, icon: ScanText },
    { id: 'blank', label: 'Möglicherweise leer', value: blanks.length, icon: File },
    {
      id: 'duplicates',
      label: 'Optisch gleiche Seiten',
      value: duplicates.reduce((n, g) => n + g.length - 1, 0),
      icon: Copy,
    },
    { id: 'formats', label: 'Seitenformate', value: formats.length, icon: Maximize },
  ] as const;
  return (
    <div className="document-check">
      <div className="check-status" role="status">
        {checking ? (
          <>
            <LoaderCircle className="spin" size={16} />
            {rows.length} {ui(' von ')}
            {pages.length} {ui(' Seiten geprüft')}
          </>
        ) : (
          <>
            <Check size={16} />
            {rows.length - errors.length} {ui(' von ')}
            {pages.length} {ui(' Seiten geprüft')}
          </>
        )}
        <span>
          <ShieldCheck size={14} />
          {ui('Auf deinem Gerät')}
        </span>
      </div>
      <section className="page-finder">
        <div className="finder-heading">
          <FileSearch size={26} strokeWidth={1.4} />
          <div>
            <h2>{ui('Fundstellen sammeln')}</h2>
            <p>
              {ui('Alle geöffneten PDFs durchsuchen. Passende Seiten als ein Dokument speichern.')}
            </p>
          </div>
        </div>
        <div className="finder-search">
          <Search size={19} />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(30);
            }}
            placeholder={ui('Wonach suchst du?')}
            aria-label={ui('Alle Dokumente durchsuchen')}
          />
          <span>{isSearch ? ui(`${matches.length} Trefferseiten`) : ''}</span>
        </div>
        <p className="finder-example">
          {ui(
            'Zum Beispiel „Rechnung“ oder „Fahrtkosten, Bewirtung“. Ein passender Begriff genügt.',
          )}
        </p>
        {pending.length > 0 && !ocrBusy && (
          <div className="scan-search-notice">
            <span>
              <ScanText size={17} />
              {pending.length} {pending.length === 1 ? ui('Seite braucht') : ui('Seiten brauchen')}{' '}
              {ui(' noch Texterkennung für die Suche.')}
            </span>
            <Button
              variant="outline"
              disabled={locked || checking}
              onClick={() => void index.recognize(language)}
            >
              {ui('Scans für die Suche erkennen')}
            </Button>
          </div>
        )}
        {ocrBusy && (
          <div className="index-progress" aria-live="polite">
            <div>
              <span>
                <LoaderCircle size={16} className="spin" />
                {ui(index.progress.label)}
              </span>
              <Button variant="ghost" onClick={index.cancel}>
                {ui('Abbrechen')}
              </Button>
            </div>
            <Progress
              value={index.progress.percent}
              aria-label={ui('Texterkennung für die Suche')}
            />
          </div>
        )}
        {index.error && (
          <p className="check-error" role="alert">
            {ui(index.error)}
          </p>
        )}
        {editedPageIds.length > 0 && (
          <p className="check-caveat">
            {ui(
              'Suche und Check beziehen sich auf die importierten Seiten. Für eine Prüfung deiner Änderungen das Ergebnis anwenden und weiterbearbeiten.',
            )}
          </p>
        )}
      </section>
      <div className="check-filters" aria-label={ui('Dokumentencheck filtern')}>
        {filters.map((f) => (
          <button
            key={f.id}
            aria-pressed={!isSearch && filter === f.id}
            onClick={() => changeFilter(f.id)}
          >
            <f.icon size={17} />
            <strong>{f.value}</strong>
            <span>{ui(f.label)}</span>
          </button>
        ))}
      </div>
      <div className="check-results-heading">
        <h3>
          {isSearch
            ? `${matches.length} ${matches.length === 1 ? ui('passende Seite') : ui('passende Seiten')}`
            : ui(filters.find((f) => f.id === filter)?.label)}
        </h3>
        {isSearch && matches.length > 0 && (
          <Button
            variant="ghost"
            disabled={locked}
            onClick={() => onSelect(matches.map((r) => r.pageId))}
          >
            <SquareCheck size={16} />
            {ui('Treffer auswählen')}
          </Button>
        )}
      </div>
      {query.trim() && !isSearch && (
        <p className="check-caveat">
          {ui('Bitte mindestens zwei Zeichen pro Suchbegriff eingeben.')}
        </p>
      )}
      {!isSearch && filter === 'blank' && (
        <div className="check-advice">
          <p>
            {ui(
              'Vermutlich leere Seiten anhand von Text und Seitenbild. Bitte vor dem Abwählen ansehen. Es wird nichts gelöscht.',
            )}
          </p>
          <Button
            variant="outline"
            disabled={locked || !blanks.some((r) => selected.has(r.pageId))}
            onClick={() =>
              onSelect(
                blanks.map((r) => r.pageId),
                true,
              )
            }
          >
            {ui('Leere Seiten abwählen')}
          </Button>
        </div>
      )}
      {!isSearch && filter === 'duplicates' && (
        <div className="check-advice">
          <p>
            {ui(
              'Gleiche Vorschau und gleiche Seitengröße. Kleine Unterschiede können in der Vorschau fehlen. Je Gruppe bleibt die erste ausgewählte Seite erhalten.',
            )}
          </p>
          <Button
            variant="outline"
            disabled={locked || !extras.length}
            onClick={() => onSelect(extras, true)}
          >
            {ui('Doppelte abwählen')}
          </Button>
        </div>
      )}
      {!isSearch && filter === 'scan' && (
        <div className="check-advice">
          <p>
            {ui(
              'Seiten mit wenig oder ohne kopierbaren Text. OCR kann sie für die Suche erschließen oder über „OCR & Text“ als durchsuchbare PDF speichern.',
            )}
          </p>
          <Button
            variant="outline"
            disabled={locked || !scans.length}
            onClick={() => onTool('ocr')}
          >
            {ui('OCR-Werkzeug öffnen')}
          </Button>
        </div>
      )}
      {!isSearch && filter === 'formats' && (
        <div className="check-advice">
          <p>
            {formats.join(' · ') || ui('Seiten werden geprüft.')}
            {formats.length > 1
              ? ui(
                  ' — Für ein einheitliches Dokument kannst du die Seiten auf ein gemeinsames Papierformat bringen.',
                )
              : ''}
          </p>
          <Button
            variant="outline"
            disabled={locked || !rows.length}
            onClick={() => onTool('resize')}
          >
            {ui('Seitenformat vereinheitlichen')}
          </Button>
        </div>
      )}
      {errors.length > 0 && (
        <p className="check-caveat">
          {errors.length} {errors.length === 1 ? ui('Seite konnte') : ui('Seiten konnten')}{' '}
          {ui(' nicht geprüft werden und sind möglicherweise nicht in den Suchtreffern enthalten.')}
        </p>
      )}
      {!shown.length && !checking ? (
        <div className="check-empty">
          <FileSearch size={34} strokeWidth={1.25} />
          <p>
            {isSearch
              ? ui('Keine passenden Textstellen gefunden.')
              : filter === 'blank'
                ? ui('Keine möglicherweise leeren Seiten gefunden.')
                : filter === 'duplicates'
                  ? ui('Keine optisch gleichen Seiten gefunden.')
                  : ui('Keine passenden Seiten.')}
          </p>
          {isSearch && pending.length > 0 && (
            <span>{ui('Erkenne die Scan-Seiten, um sie in die Suche einzubeziehen.')}</span>
          )}
        </div>
      ) : (
        <div className="check-page-list">
          {shown.slice(0, limit).map((row) => (
            <article
              className={`check-page-row ${selected.has(row.pageId) ? '' : 'excluded'}`}
              key={row.pageId}
            >
              <button
                className="check-thumbnail"
                disabled={locked}
                onClick={() => onOpen(row.pageId)}
                aria-label={ui(`Arbeitsseite ${row.position + 1} ansehen`)}
              >
                {row.preview ? <img src={row.preview} alt="" loading="lazy" /> : <File size={23} />}
              </button>
              <div className="check-page-info">
                <div>
                  <strong>
                    {ui('Seite ')}
                    {row.position + 1}
                  </strong>
                  <span>{row.format}</span>
                </div>
                <p className="check-source" title={row.name}>
                  {row.name} {ui(' · Originalseite ')}
                  {row.originalIndex + 1}
                </p>
                {isSearch ? (
                  <p className="match-excerpt">{excerpt(row.text, query)}</p>
                ) : (
                  <p className="page-index-label">
                    {row.error ||
                      (edited.has(row.pageId)
                        ? ui('Visuelle Änderungen vorgemerkt')
                        : row.blank
                          ? ui('Möglicherweise leer')
                          : row.ocrDone
                            ? row.text.trim()
                              ? ui('Scan für die Suche erkannt')
                              : ui('OCR abgeschlossen, kein Text erkannt')
                            : row.needsOcr
                              ? ui('Scan · Texterkennung möglich')
                              : ui('Text direkt durchsuchbar'))}
                    {!selected.has(row.pageId) && ui(' · Nicht ausgewählt')}
                  </p>
                )}
                {duplicateIds.has(row.pageId) && !isSearch && (
                  <small className="duplicate-note">
                    {ui('Gleiche Vorschau:')}{' '}
                    {duplicates
                      .find((g) => g.some((p) => p.pageId === row.pageId))
                      ?.filter((p) => p.pageId !== row.pageId)
                      .map((p) => `Seite ${p.position + 1}`)
                      .join(', ')}
                  </small>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpen(row.pageId)}
                disabled={locked}
                aria-label={ui(`Arbeitsseite ${row.position + 1} öffnen`)}
              >
                <Eye size={18} />
              </Button>
            </article>
          ))}
        </div>
      )}
      {shown.length > limit && (
        <Button
          className="show-more-pages"
          variant="outline"
          onClick={() => setLimit((v) => v + 30)}
        >
          {ui('Weitere Seiten anzeigen (')}
          {shown.length - limit})
        </Button>
      )}
      {isSearch && (
        <div className="collect-actions">
          <span>
            {matches.length} {ui(' Trefferseiten aus ')}
            {new Set(matches.map((r) => r.sourceId)).size} {ui('Dateien')}
            {pending.length > 0 ? ui(' · Suche noch unvollständig') : ''}
          </span>
          <Button
            disabled={locked || checking || !matches.length}
            onClick={() => onCollect(matches.map((r) => r.pageId))}
          >
            <Layers size={17} />
            {ui('Treffer-PDF erstellen')}
          </Button>
        </div>
      )}
    </div>
  );
}
