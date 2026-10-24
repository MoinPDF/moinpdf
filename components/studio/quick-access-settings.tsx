'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Pin, Plus, RotateCcw, Settings2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { defaultFavorites } from '@/lib/tool-preferences';
import type { WorkspaceTool } from '@/lib/tool-catalog';
import { searchTools } from '@/lib/localized-search';
import { useLanguage, useTools } from './appearance';

export function QuickAccessSettings({
  favorites,
  onChange,
  disabled,
}: {
  favorites: WorkspaceTool[];
  onChange: (value: WorkspaceTool[]) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const { tools } = useTools();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const move = (index: number, direction: number) => {
    const next = [...favorites];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };
  const matches = (query.trim() ? searchTools(query, tools) : tools).filter(
    (tool) => !favorites.includes(tool.id),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="quick-access-settings" disabled={disabled}>
          <Settings2 size={17} />
          {t('Anpassen', 'Customize')}
        </button>
      </DialogTrigger>
      <DialogContent className="quick-access-dialog">
        <DialogTitle>{t('Dein Schnellzugriff', 'Your quick access')}</DialogTitle>
        <DialogDescription>
          {t(
            'Bis zu sechs Werkzeuge anheften. Die Reihenfolge bestimmst du.',
            'Pin up to six tools in your preferred order.',
          )}
        </DialogDescription>
        <ol className="quick-access-order" aria-label={t('Angeheftete Werkzeuge', 'Pinned tools')}>
          {favorites.map((id, index) => {
            const tool = tools.find((item) => item.id === id);
            return (
              tool && (
                <li key={id}>
                  <Pin size={16} aria-hidden="true" />
                  <span>{tool.title}</span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`${tool.title}: ${t('Nach oben', 'Move up')}`}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    type="button"
                    disabled={index === favorites.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`${tool.title}: ${t('Nach unten', 'Move down')}`}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    type="button"
                    disabled={favorites.length <= 1}
                    onClick={() => onChange(favorites.filter((item) => item !== id))}
                    aria-label={`${tool.title}: ${t('Lösen', 'Unpin')}`}
                  >
                    <X size={17} />
                  </button>
                </li>
              )
            );
          })}
        </ol>
        <label className="field">
          <span>
            {t('Werkzeug hinzufügen', 'Add a tool')}
            <small> {favorites.length}/6</small>
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Werkzeug suchen', 'Search tools')}
          />
        </label>
        <div className="quick-access-add">
          {favorites.length >= 6 && (
            <p>
              {t(
                'Löse zuerst ein Werkzeug, um ein anderes anzuheften.',
                'Unpin a tool first to add another.',
              )}
            </p>
          )}
          {favorites.length < 6 &&
            matches.map((tool) => (
              <button
                type="button"
                key={tool.id}
                disabled={favorites.length >= 6}
                onClick={() => onChange([...favorites, tool.id])}
              >
                <tool.icon size={18} />
                <span>{tool.title}</span>
                <Plus size={16} />
              </button>
            ))}
          {!matches.length && (
            <p>{t('Kein passendes Werkzeug gefunden.', 'No matching tools found.')}</p>
          )}
        </div>
        <div className="quick-access-footer">
          <button type="button" onClick={() => onChange(defaultFavorites)}>
            <RotateCcw size={16} />
            {t('Zurücksetzen', 'Reset')}
          </button>
          <button type="button" className="quick-access-done" onClick={() => setOpen(false)}>
            {t('Fertig', 'Done')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
