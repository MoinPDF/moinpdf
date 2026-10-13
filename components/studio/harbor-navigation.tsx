'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  House,
  Images,
  Info,
  LayoutGrid,
  MoreHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from './appearance';
import { APP_VERSION } from '@/lib/version';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function HarborBrand() {
  const { t } = useLanguage();
  return (
    <div className="harbor-brand" aria-label="MoinPDF">
      <img className="harbor-brand-icon" src="/favicon.png" width={48} height={48} alt="" />
      <div className="harbor-wordmark">
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
      </div>
    </div>
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
  locked,
  onHome,
  onTools,
}: {
  home: boolean;
  locked: boolean;
  onHome: () => void;
  onTools: () => void;
}) {
  const { t } = useLanguage();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById('moinpdf-navigation')), []);
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
        aria-current={!home ? 'page' : undefined}
        disabled={locked}
        onClick={onTools}
      >
        <LayoutGrid size={20} aria-hidden="true" />
        <span>{t('Werkzeuge')}</span>
      </button>
      <MoreMenu />
    </>
  );
  return (
    <>
      {host &&
        createPortal(
          <nav className="harbor-desktop-nav" aria-label={t('Hauptnavigation', 'Main navigation')}>
            {items}
          </nav>,
          host,
        )}
      <nav className="harbor-mobile-nav" aria-label={t('Hauptnavigation', 'Main navigation')}>
        {items}
      </nav>
    </>
  );
}
