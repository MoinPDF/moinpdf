'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { searchTools } from '@/lib/localized-search';
import type { WorkspaceTool } from '@/lib/tool-catalog';
import { useLanguage, useTools } from './appearance';
import { SearchHighlight } from './search-highlight';
import { useToolPreferences } from './use-tool-preferences';

export function MobileToolSearch({
  locked,
  onChoose,
  onTools,
  desktop = false,
  onProjects,
}: {
  locked: boolean;
  onChoose: (id: WorkspaceTool) => void;
  onTools: () => void;
  desktop?: boolean;
  onProjects?: () => void;
}) {
  const { t } = useLanguage();
  const { tools } = useTools();
  const { favorites, recent } = useToolPreferences();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [viewport, setViewport] = useState({ bottom: 0, height: 0 });
  const input = useRef<HTMLInputElement>(null);
  const navigating = useRef(false);
  const matches = query.trim()
    ? searchTools(query, tools)
    : (recent.length ? recent : favorites).flatMap((id) => tools.filter((tool) => tool.id === id));

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'k' ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (desktop !== window.matchMedia('(min-width: 1101px)').matches) return;
      if (document.querySelector('dialog[open], [role="dialog"][data-state="open"]') && !open)
        return;
      event.preventDefault();
      if (!locked) {
        setQuery('');
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [desktop, locked, open]);

  // The visual viewport shrinks when the native keyboard opens. Keep the input
  // and scrollable results above it, including on browsers that pan the page.
  useLayoutEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    const measure = () =>
      setViewport({
        bottom: Math.max(
          0,
          window.innerHeight - (visual?.height ?? window.innerHeight) - (visual?.offsetTop ?? 0),
        ),
        height: visual?.height ?? window.innerHeight,
      });
    measure();
    visual?.addEventListener('resize', measure);
    visual?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      visual?.removeEventListener('resize', measure);
      visual?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia('(min-width: 1101px)');
    const closeOnDesktop = () => {
      if (media.matches === desktop) return;
      navigating.current = true;
      setOpen(false);
      document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
    };
    media.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => media.removeEventListener('change', closeOnDesktop);
  }, [open, desktop]);

  const navigate = (action: () => void) => {
    if (locked) return;
    navigating.current = true;
    setOpen(false);
    action();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && locked) return;
        if (next) {
          navigating.current = false;
          setQuery('');
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={`harbor-nav-item harbor-search-toggle${desktop ? ' desktop-command-trigger' : ''}`}
          disabled={locked}
          aria-label={desktop ? t('Werkzeug suchen', 'Search tools') : undefined}
          aria-keyshortcuts="Control+k Meta+k"
        >
          <Search size={21} aria-hidden="true" />
          <span>{desktop ? t('Werkzeug suchen', 'Search tools') : t('Suche', 'Search')}</span>
          {desktop && <kbd>{t('Strg K', 'Ctrl K')}</kbd>}
        </button>
      </DialogTrigger>
      <DialogContent
        className={desktop ? 'desktop-tool-search' : 'mobile-tool-search'}
        placement={desktop ? 'center' : 'bottom'}
        aria-modal="true"
        showCloseButton={false}
        style={
          {
            '--search-keyboard-offset': `${viewport.bottom}px`,
            '--search-viewport-height': viewport.height ? `${viewport.height}px` : '100dvh',
          } as CSSProperties
        }
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          if (navigating.current) {
            event.preventDefault();
            document.getElementById('moinpdf-content')?.focus({ preventScroll: true });
          }
        }}
      >
        <div className="mobile-search-heading">
          <DialogTitle>{t('Werkzeug suchen', 'Search tools')}</DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="mobile-search-close"
              aria-label={t('Suche schließen', 'Close search')}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          {t('Werkzeug eingeben und einen Treffer auswählen.', 'Enter a tool and select a result.')}
        </DialogDescription>
        <Command
          shouldFilter={false}
          loop
          className="mobile-search-command"
          label={t('Werkzeugvorschläge', 'Tool suggestions')}
        >
          <div className="mobile-search-input">
            <CommandInput
              ref={input}
              value={query}
              onValueChange={setQuery}
              placeholder={t('Was möchtest du machen?', 'What would you like to do?')}
              aria-label={t('Werkzeug suchen', 'Search tools')}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              disabled={locked}
            />
            {query && (
              <button
                type="button"
                className="mobile-search-clear"
                aria-label={t('Suche leeren', 'Clear search')}
                onClick={() => {
                  setQuery('');
                  input.current?.focus({ preventScroll: true });
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mobile-search-status" role="status" aria-live="polite">
            {!query.trim()
              ? recent.length
                ? t('Zuletzt verwendet', 'Recently used')
                : t('Schnellzugriff', 'Quick access')
              : matches.length
                ? t('Passende Werkzeuge', 'Matching tools')
                : t('Kein passendes Werkzeug gefunden.', 'No matching tools found.')}
          </p>
          <CommandList className="mobile-search-results" aria-label={t('Werkzeuge', 'Tools')}>
            {matches.map((tool) => (
              <CommandItem
                key={tool.id}
                value={tool.id}
                data-tool-id={tool.id}
                disabled={locked}
                className="mobile-search-result"
                onSelect={() => navigate(() => onChoose(tool.id))}
              >
                <span className={`harbor-tool-icon tone-${tool.group}`} data-tool-tone={tool.group}>
                  <tool.icon size={22} aria-hidden="true" />
                </span>
                <span className="mobile-search-result-copy">
                  <strong>
                    <SearchHighlight text={tool.title} query={query} />
                  </strong>
                  <small>
                    <SearchHighlight text={tool.description} query={query} />
                  </small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </CommandItem>
            ))}
            {!query.trim() && onProjects && (
              <CommandItem value="action-projects" onSelect={() => navigate(onProjects)}>
                {t('Projekte öffnen', 'Open projects')}
              </CommandItem>
            )}
          </CommandList>
        </Command>
        <button
          type="button"
          className="mobile-search-all"
          disabled={locked}
          onClick={() => navigate(onTools)}
        >
          {t('Alle Werkzeuge', 'All tools')}
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
