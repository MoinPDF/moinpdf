/* Information-page language follows the app preference without changing document data. */
(() => {
  const routes = {
    '/dokumentation.html': '/en/documentation.html',
    '/medienbereich.html': '/en/media.html',
    '/impressum.html': '/en/legal.html',
    '/datenschutz.html': '/en/privacy.html',
  };
  const path = window.location.pathname;
  const original = Object.keys(routes).find((key) => key === path || routes[key] === path);
  if (!original) return;
  const apply = (language) => {
    const target = language === 'en' ? routes[original] : original;
    if (target !== path) window.location.replace(target + window.location.search + window.location.hash);
  };
  let preference;
  try { preference = localStorage.getItem('moinpdf-language'); } catch { /* Storage is optional. */ }
  const explicit = new URLSearchParams(window.location.search).get('lang');
  if (explicit === 'en' || explicit === 'de') apply(explicit);
  else if (path === original && preference === 'en') apply('en');
  window.addEventListener('storage', (event) => {
    if (event.key === 'moinpdf-language' || event.key === null) apply(event.newValue === 'en' ? 'en' : 'de');
  });
})();
