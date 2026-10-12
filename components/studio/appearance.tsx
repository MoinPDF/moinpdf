'use client';

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Language, translate, loadEnglishCatalog, setUiLanguage } from '@/lib/ui-language';
import { APP_VERSION } from '@/lib/version';
import { tools, groups, type ToolDefinition } from '@/lib/tool-catalog';
import { englishTools } from '@/lib/tool-translations';

const LanguageContext = createContext({
  language: 'de' as Language,
  setLanguage: (_: Language) => {},
  loadingLanguage: false,
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>('de');
  const [loadingLanguage, setLoadingLanguage] = useState(false);
  const languageRequest = useRef(0);
  const applyLanguage = useCallback(async (value: Language, persist = false) => {
    const request = ++languageRequest.current;
    setLoadingLanguage(true);
    try {
      if (value === 'en') await loadEnglishCatalog(APP_VERSION);
      if (request !== languageRequest.current) return;
      toast.dismiss();
      setUiLanguage(value);
      updateLanguage(value);
      if (persist) {
        try {
          localStorage.setItem('moinpdf-language', value);
        } catch {
          /* Persistence is optional. */
        }
      }
    } catch {
      if (request === languageRequest.current)
        toast.error('English language files could not be loaded. Please try again.');
    } finally {
      if (request === languageRequest.current) setLoadingLanguage(false);
    }
  }, []);
  useEffect(() => {
    const read = (initial = false) => {
      let preference = 'de';
      try {
        preference = localStorage.getItem('moinpdf-language') ?? 'de';
      } catch {
        /* Storage is optional. */
      }
      const explicit = new URLSearchParams(window.location.search).get('lang');
      if (initial && (explicit === 'de' || explicit === 'en')) preference = explicit;
      if (!initial && explicit) {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', preference === 'en' ? 'en' : 'de');
        window.history.replaceState(null, '', url);
      }
      void applyLanguage(preference === 'en' ? 'en' : 'de');
    };
    read(true);
    const sync = (event: StorageEvent) => {
      if (event.key === 'moinpdf-language' || event.key === null) read();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [applyLanguage]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === 'en' ? 'MoinPDF – Paperwork. Sorted.' : 'MoinPDF – Papierkram. Läuft.';
  }, [language]);
  const setLanguage = (value: Language) => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', value);
      window.history.replaceState(null, '', url);
    }
    void applyLanguage(value, true);
  };
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="moinpdf-theme"
      disableTransitionOnChange
    >
      <LanguageContext.Provider value={{ language, setLanguage, loadingLanguage }}>
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

export function Lighthouse({ lit, animate = false }: { lit: boolean; animate?: boolean }) {
  return (
    <svg
      className={`lighthouse ${lit ? 'is-lit' : ''} ${animate ? 'is-clicked' : ''}`}
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
  const { language, setLanguage, loadingLanguage, t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [lighthouseClick, setLighthouseClick] = useState(0);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <div className="appearance-controls" role="group" aria-label={t('Darstellung und Sprache')}>
      <DropdownMenu open={languageMenuOpen} onOpenChange={setLanguageMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="appearance-button language-trigger"
            aria-label={t('Sprache auswählen')}
            aria-busy={loadingLanguage}
            disabled={loadingLanguage}
          >
            <CountryFlag language={language} />
            <span>{language.toUpperCase()}</span>
            {loadingLanguage ? (
              <LoaderCircle className="spin" size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="language-menu">
          <DropdownMenuRadioGroup
            value={language}
            onValueChange={(value) => {
              if (value === 'de' || value === 'en') {
                setLanguageMenuOpen(false);
                setLanguage(value);
              }
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
        onClick={() => {
          setLighthouseClick((click) => click + 1);
          setTheme(dark ? 'light' : 'dark');
        }}
        aria-label={t(dark ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten')}
        title={t(dark ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten')}
        aria-pressed={dark}
      >
        <Lighthouse key={lighthouseClick} lit={!dark} animate={lighthouseClick > 0} />
      </button>
    </div>
  );
}
