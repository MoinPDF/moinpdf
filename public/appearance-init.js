// Apply the saved choice or system appearance before the first paint.
(() => {
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const apply = () => {
    let preference;
    try {
      preference = localStorage.getItem('moinpdf-theme');
    } catch { /* System appearance also works without local storage. */ }
    const dark = preference === 'dark' ||
      (preference !== 'light' && Boolean(system?.matches));
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  };
  apply();
  // The React app takes over live updates and in-memory manual choices after startup.
  if (document.currentScript?.hasAttribute('data-theme-startup-only')) return;
  if (system?.addEventListener) system.addEventListener('change', apply);
  else system?.addListener?.(apply);
  window.addEventListener('storage', event => {
    if (event.key === 'moinpdf-theme' || event.key === null) apply();
  });
  window.addEventListener('pageshow', apply);
})();
