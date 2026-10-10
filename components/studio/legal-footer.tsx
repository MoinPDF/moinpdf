import './legal-footer.css';
import { APP_VERSION } from '@/lib/version';

export function LegalFooter() {
  return (
    <footer className="moinpdf-legal-footer">
      <nav aria-label="Informationen zu MoinPDF">
        <a href="/dokumentation.html" target="_blank" rel="noopener noreferrer">
          Dokumentation<span className="sr-only"> (neuer Tab)</span>
        </a>
        <a href="/medienbereich.html" target="_blank" rel="noopener noreferrer">
          Medienbereich<span className="sr-only"> (neuer Tab)</span>
        </a>
        <a href="/impressum.html" target="_blank" rel="noopener noreferrer">
          Impressum<span className="sr-only"> (neuer Tab)</span>
        </a>
        <a href="/datenschutz.html" target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung<span className="sr-only"> (neuer Tab)</span>
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
        <span className="moinpdf-version" aria-label={`MoinPDF Version ${APP_VERSION}`}>
          MoinPDF <span>v{APP_VERSION}</span>
        </span>
      </div>
    </footer>
  );
}
