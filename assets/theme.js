(() => {
  const paint = theme => {
    const next = theme === 'founders' ? 'founders' : 'senra';
    document.documentElement.setAttribute('data-theme', next);
    for (const button of document.querySelectorAll('[data-set-theme]')) {
      button.setAttribute('aria-pressed', button.getAttribute('data-set-theme') === next ? 'true' : 'false');
    }
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-set-theme]');
    if (!button) return;
    const theme = button.getAttribute('data-set-theme') === 'founders' ? 'founders' : 'senra';
    try { localStorage.setItem('senrajobs-theme', theme); } catch { /* storage can be blocked */ }
    paint(theme);
  });
  paint(document.documentElement.getAttribute('data-theme'));
})();
