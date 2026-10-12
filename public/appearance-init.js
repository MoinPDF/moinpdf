// Apply saved appearance before the first paint, also on standalone information pages.
(() => {
  const apply = () => {
    try {
      const dark = localStorage.getItem('moinpdf-theme') === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch { /* The default appearance also works without local storage. */ }
  };
  apply();
  window.addEventListener('storage', event => {
    if (event.key === 'moinpdf-theme' || event.key === null) apply();
  });
})();
