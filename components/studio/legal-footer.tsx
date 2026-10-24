import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';
import './legal-footer.css';
import { APP_RELEASE_URL, APP_VERSION } from '@/lib/version';

export function LegalFooter() {
  const { t, language } = useLanguage();
  return (
    <footer className="moinpdf-legal-footer">
      <nav aria-label={t('Informationen zu MoinPDF')}>
        <a
          href={language === 'en' ? '/en/documentation.html' : '/dokumentation.html'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Dokumentation')}
          <span className="sr-only">{t(' (neuer Tab)')}</span>
        </a>
        <a
          href={language === 'en' ? '/en/media.html' : '/medienbereich.html'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Medienbereich')}
          <span className="sr-only">{t(' (neuer Tab)')}</span>
        </a>
        <a
          href={language === 'en' ? '/en/legal.html' : '/impressum.html'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Impressum')}
          <span className="sr-only">{t(' (neuer Tab)')}</span>
        </a>
        <a
          href={language === 'en' ? '/en/privacy.html' : '/datenschutz.html'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t('Datenschutzerklärung')}${t(' (neuer Tab)')}`}
          title={t('Datenschutzerklärung')}
        >
          <span className="moinpdf-footer-label-full" aria-hidden="true">
            {t('Datenschutzerklärung')}
          </span>
          <span className="moinpdf-footer-label-compact" aria-hidden="true">
            {t('Datenschutz', 'Privacy')}
          </span>
        </a>
      </nav>
      <div className="moinpdf-footer-brand">
        <img
          className="moinpdf-footer-mascot"
          src={`/branding/moinpdf-sailor.webp?v=${APP_VERSION}`}
          width={16}
          height={16}
          alt=""
          decoding="async"
        />
        <a
          className="moinpdf-version"
          href={APP_RELEASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(`Änderungen in MoinPDF ${APP_VERSION} auf GitHub (neuer Tab)`)}
          title={t('Änderungen dieser Version auf GitHub')}
        >
          {ui('MoinPDF ')}
          <span>v{APP_VERSION}</span>
        </a>
      </div>
    </footer>
  );
}
