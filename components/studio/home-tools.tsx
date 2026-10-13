'use client';

import { useState } from 'react';
import { ChevronRight, LayoutGrid, X } from 'lucide-react';
import { useLanguage, useTools } from './appearance';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { searchTools } from '@/lib/localized-search';
import type { WorkspaceTool } from '@/lib/tool-catalog';

const featured = ['merge', 'compress', 'pdf-word', 'edit-text'];
const categoryNames = ['Prüfen', 'Umwandeln', 'Seiten', 'Bearbeiten', 'Stapel'];

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
  const [category, setCategory] = useState<number | null>(null);
  const categories = [
    { value: null, label: t('Empfohlen', 'Recommended') },
    ...groups.map((name, index) => ({
      value: index,
      label: t(categoryNames[index] ?? name),
    })),
  ];
  const suggestions = searchTools(query, tools)
    .filter((tool) => category === null || tool.group === category)
    .slice(0, 5);
  const cards =
    category === null
      ? featured.flatMap((id) => tools.filter((tool) => tool.id === id))
      : tools.filter((tool) => tool.group === category).slice(0, 8);
  return (
    <section className="harbor-discovery" aria-label={t('Werkzeuge entdecken', 'Discover tools')}>
      <Command shouldFilter={false} loop className="harbor-command" label={t('Werkzeugvorschläge')}>
        <div className="harbor-search">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('Was möchtest du tun?')}
            aria-label={t('Was möchtest du tun?')}
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
                <span className={`harbor-tool-icon tone-${tool.group}`}>
                  <tool.icon size={22} aria-hidden="true" />
                </span>
                <span>
                  <strong>{tool.title}</strong>
                  <small>{tool.description}</small>
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
      <div className="harbor-categories" role="group" aria-label={t('Werkzeugkategorien')}>
        {categories.map(({ value, label }) => (
          <button
            key={value ?? 'recommended'}
            type="button"
            aria-pressed={category === value}
            data-harbor-light
            disabled={locked}
            onClick={() => setCategory(value)}
          >
            <span className="harbor-category-label">{label}</span>
          </button>
        ))}
      </div>
      <h2 className="harbor-quick-heading">{t('Schnellzugriff', 'Quick access')}</h2>
      <div className="harbor-tool-grid">
        {cards.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className={`harbor-tool-card tone-${tool.group}`}
            data-harbor-light
            disabled={locked}
            onClick={() => onChoose(tool.id)}
            title={tool.description}
          >
            <span className="harbor-tool-icon">
              <tool.icon size={23} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <strong>{tool.title}</strong>
          </button>
        ))}
      </div>
      <button className="harbor-text-button" type="button" disabled={locked} onClick={onTools}>
        <LayoutGrid size={17} aria-hidden="true" />
        {t('Alle Werkzeuge anzeigen', 'View all tools')}
        <ChevronRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}
