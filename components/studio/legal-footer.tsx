import './legal-footer.css';
import {APP_VERSION} from '@/lib/version';

export function LegalFooter() {
  return <footer className="moinpdf-legal-footer">
    <nav aria-label="Rechtliche Informationen">
      <a href="/impressum.html" target="_blank" rel="noopener noreferrer">Impressum<span className="sr-only"> (neuer Tab)</span></a>
      <a href="/datenschutz.html" target="_blank" rel="noopener noreferrer">Datenschutzerklärung<span className="sr-only"> (neuer Tab)</span></a>
    </nav>
    <span className="moinpdf-version" aria-label={`MoinPDF Version ${APP_VERSION}`}>MoinPDF <span>v{APP_VERSION}</span></span>
  </footer>;
}
