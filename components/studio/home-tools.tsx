'use client';

import { useState } from 'react';
import { ArrowRight, ChevronRight, Files, X } from 'lucide-react';
import { useLanguage, useTools } from './appearance';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { searchTools } from '@/lib/localized-search';
import type { WorkspaceTool } from '@/lib/tool-catalog';
import { SearchHighlight } from './search-highlight';
import {
  MosaicHomeIcon,
  mosaicCategoryIcons,
  mosaicShortcuts,
  ToolMosaicCard,
} from './tool-mosaic';
export function HomeTools({
  locked,
  onChoose,
  onTools,
}: {
  locked: boolean;
  onChoose: (id: WorkspaceTool) => void;
  onTools: () => void;
}) {
  const { t } = useLanguage();
  const { tools, groups } = useTools();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('quick');
  const categoryNames = ['Prüfen', 'Umwandeln', 'Seiten', 'Bearbeiten', 'Stapel'];
  const categories = [
    { value: 'quick', label: t('Schnellzugriff', 'Quick access'), icon: MosaicHomeIcon },
    ...groups.map((name, index) => ({
      value: String(index),
      label: t(categoryNames[index] ?? name),
      icon: mosaicCategoryIcons[index] ?? Files,
    })),
  ];
  const inCategory = (tool: (typeof tools)[number]) =>
    category === 'quick' || tool.group === Number(category);
  const suggestions = searchTools(query, tools).filter(inCategory).slice(0, 5);
  const cards =
    category === 'quick'
      ? mosaicShortcuts.flatMap(({ id }) => tools.filter((tool) => tool.id === id))
      : tools.filter(inCategory);
  return (
    <section
      className="harbor-discovery mosaic-discovery"
      aria-label={t('Werkzeuge entdecken', 'Discover tools')}
    >
      <Command shouldFilter={false} loop className="harbor-command" label={t('Werkzeugvorschläge')}>
        <div className="harbor-search">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('Werkzeug suchen', 'Search tools')}
            aria-label={t('Werkzeug suchen', 'Search tools')}
            disabled={locked}
          />
          {query && (
            <button
              className="harbor-search-clear"
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('Suche leeren')}
            >
              <X size={18} />
            </button>
          )}
        </div>
        {query.trim() && (
          <CommandList className="harbor-search-results">
            <p role="status">
              {suggestions.length ? t('Passende Werkzeuge') : t('Kein passender Vorschlag')}
            </p>
            {suggestions.map((tool) => (
              <CommandItem
                key={tool.id}
                value={tool.id}
                onSelect={() => onChoose(tool.id)}
                disabled={locked}
                className="harbor-search-result"
              >
                <span className={`harbor-tool-icon tone-${tool.group}`} data-tool-tone={tool.group}>
                  <tool.icon size={22} aria-hidden="true" />
                </span>
                <span>
                  <strong>
                    <SearchHighlight text={tool.title} query={query} />
                  </strong>
                  <small>
                    <SearchHighlight text={tool.description} query={query} />
                  </small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </CommandItem>
            ))}
            {!suggestions.length && (
              <button
                className="harbor-text-button"
                type="button"
                disabled={locked}
                onClick={onTools}
              >
                {t('Alle Werkzeuge anzeigen', 'View all tools')}
                <ChevronRight size={16} />
              </button>
            )}
          </CommandList>
        )}
      </Command>
      <div className="harbor-discovery-toolbar">
        <div
          className="harbor-categories mosaic-categories"
          role="group"
          aria-label={t('Werkzeugkategorien')}
        >
          {categories.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className="mosaic-category"
              aria-pressed={category === value}
              aria-controls="home-tool-grid"
              data-harbor-light
              data-tool-tone={value}
              disabled={locked}
              onClick={() => setCategory(value)}
            >
              <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
              <span className="harbor-category-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <h2 className="sr-only">{categories.find((item) => item.value === category)?.label}</h2>
      <div
        className="tool-mosaic-grid"
        data-mosaic-kind={category === 'quick' ? 'quick' : 'category'}
        id="home-tool-grid"
      >
        {cards.map((tool, index) => {
          const shortcut = mosaicShortcuts.find((item) => item.id === tool.id);
          const title = shortcut ? t(...shortcut.title) : tool.title;
          const description = shortcut ? t(...shortcut.description) : tool.description;
          return (
            <ToolMosaicCard
              key={tool.id}
              tool={tool}
              title={title}
              description={description}
              locked={locked}
              onChoose={onChoose}
              layout={index === 0 ? 'feature' : index % 3 === 0 ? 'wide' : 'tile'}
            />
          );
        })}
      </div>
      <button
        className="harbor-text-button mosaic-all-tools"
        type="button"
        disabled={locked}
        onClick={onTools}
      >
        {t('Alle Werkzeuge', 'All tools')}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}
