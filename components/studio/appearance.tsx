'use client';

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Language, translate } from '@/lib/ui-language';
import { tools, groups, type ToolDefinition } from '@/lib/tool-catalog';
import { englishTools } from '@/lib/tool-translations';

const LanguageContext = createContext({
  language: 'de' as Language,
  setLanguage: (_: Language) => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>('de');
  useEffect(() => {
    const read = () => {
      try {
        updateLanguage(localStorage.getItem('moinpdf-language') === 'en' ? 'en' : 'de');
      } catch {
        /* Storage is optional. */
      }
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === 'moinpdf-language' || event.key === null) read();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = (value: Language) => {
    updateLanguage(value);
    try {
      localStorage.setItem('moinpdf-language', value);
    } catch {
      /* Continue without persistence. */
    }
  };
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="moinpdf-theme"
      disableTransitionOnChange
    >
      <LanguageContext.Provider value={{ language, setLanguage }}>
        {children}
      </LanguageContext.Provider>
    </ThemeProvider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  const t = useCallback(
    (text: string, fallback?: string) => translate(text, context.language, fallback),
    [context.language],
  );
  return { ...context, t };
}

export function useTools(): { tools: ToolDefinition[]; groups: string[] } {
  const { language } = useLanguage();
  return useMemo(
    () => ({
      tools: tools.map((tool): ToolDefinition =>
        language === 'de' ? tool : { ...tool, ...englishTools[tool.id] },
      ),
      groups: groups.map((group) => translate(group, language)),
    }),
    [language],
  );
}

export function CountryFlag({ language }: { language: Language }) {
  return language === 'de' ? (
    <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
      <path fill="#17191c" d="M0 0h30v7H0z" />
      <path fill="#dd3344" d="M0 7h30v6H0z" />
      <path fill="#f8c842" d="M0 13h30v7H0z" />
    </svg>
  ) : (
    <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
      <path fill="#25456e" d="M0 0h30v20H0z" />
      <path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#d43c50" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
      <path stroke="#d43c50" strokeWidth="4" d="M15 0v20M0 10h30" />
    </svg>
  );
}

export function Lighthouse({ lit }: { lit: boolean }) {
  return (
    <svg
      className={`lighthouse ${lit ? 'is-lit' : ''}`}
      viewBox="0 0 40 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="lighthouse-beams">
        <path d="M10 11 2 7m8 8-8 2m28-6 8-4m-8 8 8 2" />
      </g>
      <path className="lighthouse-glass" d="M15 10h10v9H15z" />
      <path d="m14 10 6-5 6 5H14Zm6-5V2M13 19h14M15 19l-3 21h16l-3-21M10 40h20M14 27h12M13 34h14M20 11v7" />
      <path className="lighthouse-stripe" d="m14 27 12-5 .8 6L13 33z" stroke="none" />
      <path d="M18 40v-5a2 2 0 0 1 4 0v5" />
    </svg>
  );
}

export function AppearanceControls() {
  const { language, setLanguage, t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <div className="appearance-controls" role="group" aria-label={t('Darstellung und Sprache')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="appearance-button language-trigger"
            aria-label={t('Sprache auswählen')}
          >
            <CountryFlag language={language} />
            <span>{language.toUpperCase()}</span>
            <ChevronDown size={15} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="language-menu">
          <DropdownMenuRadioGroup
            value={language}
            onValueChange={(value) => {
              if (value === 'de' || value === 'en') setLanguage(value);
            }}
          >
            {(['de', 'en'] as const).map((value) => (
              <DropdownMenuRadioItem key={value} value={value} className="language-option">
                <CountryFlag language={value} />
                <span lang={value}>{value === 'de' ? 'Deutsch' : 'English'}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className="appearance-button theme-toggle"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={t(dark ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten')}
        title={t(dark ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten')}
        aria-pressed={dark}
      >
        <Lighthouse lit={!dark} />
      </button>
    </div>
  );
}
