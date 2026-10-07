(() => {
  const search = document.querySelector('#docs-search');
  const reset = document.querySelector('#docs-reset');
  const buttons = [...document.querySelectorAll('.docs-filters button')];
  const groups = [...document.querySelectorAll('.docs-tool-group')];
  const entries = [...document.querySelectorAll('.docs-tool')];
  const status = document.querySelector('#docs-search-status');
  const normalize = text => text.toLocaleLowerCase('de').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const index = new Map(entries.map(entry => [entry, normalize(entry.textContent)]));
  let category = 'all';
  let printState;

  function filter() {
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const group of groups) {
      let visible = 0;
      for (const entry of group.querySelectorAll('.docs-tool')) {
        entry.hidden = !(category === 'all' || group.dataset.group === category) || !words.every(word => index.get(entry).includes(word));
        if (!entry.hidden) visible++;
      }
      group.hidden = visible === 0;
      group.querySelector('.docs-group-count').textContent = `${visible} ${visible === 1 ? 'Werkzeug' : 'Werkzeuge'}`;
      count += visible;
    }
    status.textContent = `${count} von ${entries.length} Anleitungen`;
    document.querySelector('#docs-empty').hidden = count !== 0;
    reset.hidden = !search.value && category === 'all';
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === category)));
  }

  search.addEventListener('input', filter);
  buttons.forEach(button => button.addEventListener('click', () => {category = button.dataset.group; filter();}));
  reset.addEventListener('click', () => {search.value = ''; category = 'all'; filter(); search.focus();});

  function revealAnchor() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    if (target.matches('.docs-tool, .docs-tool-group')) {
      search.value = ''; category = 'all'; filter();
      if (target.matches('.docs-tool')) target.open = true;
      requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
    }
  }
  window.addEventListener('hashchange', revealAnchor);

  // Print the complete manual, then restore the reader's exact view.
  function preparePrint() {
    if (printState) return;
    printState = {query:search.value, category, open:[...document.querySelectorAll('details')].filter(d => d.open)};
    search.value = ''; category = 'all'; filter();
    document.querySelectorAll('details').forEach(d => {d.open = true;});
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    document.querySelectorAll('details').forEach(d => {d.open = printState.open.includes(d);});
    search.value = printState.query; category = printState.category; printState = undefined; filter();
  });
  document.querySelector('.docs-print').addEventListener('click', () => {preparePrint(); window.print();});
  document.documentElement.classList.add('docs-js');
  revealAnchor();
})();
