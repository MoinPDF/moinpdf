'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { contentUnderNavigation } from '@/lib/ui-feedback';
import { createPortal } from 'react-dom';
import {
  Archive,
  BookOpen,
  FolderOpen,
  House,
  Images,
  Info,
  LayoutGrid,
  MoreHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from './appearance';
import { APP_VERSION } from '@/lib/version';
import type { WorkspaceTool } from '@/lib/tool-catalog';
import { MobileToolSearch } from './mobile-tool-search';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function HarborBrand({ onHome, locked }: { onHome: () => void; locked: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      className="harbor-brand text-left"
      aria-label={t('MoinPDF – zur Startseite', 'MoinPDF – go to home page')}
      disabled={locked}
      onClick={onHome}
    >
      <img className="harbor-brand-icon" src="/favicon.png" width={48} height={48} alt="" />
      <span className="harbor-wordmark">
        <img
          className="upload-entry-logo logo-light"
          src={`/branding/moinpdf-wordmark.svg?v=${APP_VERSION}`}
          width={680}
          height={170}
          alt="MoinPDF"
        />
        <img
          className="upload-entry-logo logo-dark"
          src={`/branding/moinpdf-wordmark-dark.svg?v=${APP_VERSION}`}
          width={680}
          height={170}
          alt="MoinPDF"
        />
        <span>{t('Papierkram. Läuft.')}</span>
      </span>
    </button>
  );
}

function MoreMenu() {
  const { t, language } = useLanguage();
  const entries = [
    {
      label: 'Dokumentation',
      de: '/dokumentation.html',
      en: '/en/documentation.html',
      icon: BookOpen,
    },
    { label: 'Medienbereich', de: '/medienbereich.html', en: '/en/media.html', icon: Images },
    { label: 'Impressum', de: '/impressum.html', en: '/en/legal.html', icon: Info },
    {
      label: 'Datenschutzerklärung',
      de: '/datenschutz.html',
      en: '/en/privacy.html',
      icon: ShieldCheck,
    },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="harbor-nav-item">
          <MoreHorizontal size={21} aria-hidden="true" />
          <span>{t('Mehr', 'More')}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="harbor-more-menu" align="end" sideOffset={10}>
        <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event('moinpdf-open-results'))}>
          <Archive size={18} aria-hidden="true" />
          {t('Ergebnisse und Aufträge', 'Results and jobs')}
        </DropdownMenuItem>
        {entries.map(({ label, de, en, icon: Icon }) => (
          <DropdownMenuItem key={de} asChild>
            <a href={language === 'en' ? en : de} target="_blank" rel="noopener noreferrer">
              <Icon size={18} aria-hidden="true" />
              {t(label)}
              <span className="sr-only">{t(' (neuer Tab)')}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HarborNavigation({
  home,
  creating = false,
  locked,
  onHome,
  onTools,
  onChoose,
  onProjects,
  projectsOpen,
  editorActions,
}: {
  home: boolean;
  creating?: boolean;
  locked: boolean;
  onHome: () => void;
  onTools: () => void;
  onChoose: (id: WorkspaceTool) => void;
  onProjects: () => void;
  projectsOpen: boolean;
  editorActions?: ReactNode;
}) {
  const { t } = useLanguage();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [searchHost, setSearchHost] = useState<HTMLElement | null>(null);
  const [brandHost, setBrandHost] = useState<HTMLElement | null>(null);
  const [mobileHost, setMobileHost] = useState<HTMLElement | null>(null);
  const mobileNav = useRef<HTMLElement>(null);
  const [contentUnderneath, setContentUnderneath] = useState(false);
  useEffect(() => {
    setHost(document.getElementById('moinpdf-navigation'));
    setSearchHost(document.getElementById('moinpdf-desktop-search'));
    setBrandHost(document.getElementById('moinpdf-brand'));
    setMobileHost(document.getElementById('moinpdf-mobile-navigation'));
  }, []);
  useEffect(() => {
    const nav = mobileNav.current;
    const content = document.getElementById('moinpdf-content');
    if (!nav || !content) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = nav.getBoundingClientRect();
      setContentUnderneath(
        contentUnderNavigation(
          window.scrollY,
          content.getBoundingClientRect().bottom,
          rect.top,
          rect.height,
        ),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    observer.observe(nav);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [mobileHost]);
  const items = (
    <>
      <button
        type="button"
        className="harbor-nav-item"
        aria-current={home ? 'page' : undefined}
        disabled={locked}
        onClick={onHome}
      >
        <House size={20} aria-hidden="true" />
        <span>{t('Start', 'Home')}</span>
      </button>
      <button
        type="button"
        className="harbor-nav-item"
        aria-current={!home && !creating ? 'page' : undefined}
        disabled={locked}
        onClick={onTools}
      >
        <LayoutGrid size={20} aria-hidden="true" />
        <span>{t('Werkzeuge')}</span>
      </button>
    </>
  );
  return (
    <>
      {brandHost && createPortal(<HarborBrand onHome={onHome} locked={locked} />, brandHost)}
      {host &&
        createPortal(
          <nav className="harbor-desktop-nav" aria-label={t('Hauptnavigation', 'Main navigation')}>
            {items}
            <MoreMenu />
          </nav>,
          host,
        )}
      {searchHost &&
        createPortal(
          <MobileToolSearch
            desktop
            locked={locked}
            onChoose={onChoose}
            onTools={onTools}
            onProjects={onProjects}
          />,
          searchHost,
        )}
      {mobileHost &&
        createPortal(
          <nav
            ref={mobileNav}
            className="harbor-mobile-nav"
            data-content-underneath={contentUnderneath}
            aria-label={t('Hauptnavigation', 'Main navigation')}
          >
            {editorActions || (
              <>
                {items}
                <MobileToolSearch
                  locked={locked}
                  onChoose={onChoose}
                  onTools={onTools}
                  onProjects={onProjects}
                />
                <button
                  type="button"
                  className="harbor-nav-item harbor-project-toggle"
                  aria-haspopup="dialog"
                  aria-expanded={projectsOpen}
                  disabled={locked}
                  onClick={onProjects}
                >
                  <FolderOpen size={21} aria-hidden="true" />
                  <span>{t('Projekte', 'Projects')}</span>
                </button>
                <MoreMenu />
              </>
            )}
          </nav>,
          mobileHost,
        )}
    </>
  );
}
