import './legal-footer.css';

export function LegalFooter() {
  return <footer className="moinpdf-legal-footer">
    <nav aria-label="Rechtliche Informationen">
      <a href="/impressum.html" target="_blank" rel="noopener noreferrer">Impressum<span className="sr-only"> (neuer Tab)</span></a>
      <span aria-hidden="true">·</span>
      <a href="/datenschutz.html" target="_blank" rel="noopener noreferrer">Datenschutzerklärung<span className="sr-only"> (neuer Tab)</span></a>
    </nav>
  </footer>;
}
