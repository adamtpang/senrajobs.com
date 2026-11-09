(() => {
  const query = document.querySelector('#ep-q');
  const only = document.querySelector('#ep-board');
  const count = document.querySelector('#ep-count');
  const form = document.querySelector('.episode-tools');
  const rows = [...document.querySelectorAll('.episode')];
  if (!query || !only || !count || !rows.length) return;
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) query.value = initial;
  form?.addEventListener('submit', event => event.preventDefault());
  const apply = () => {
    const needle = query.value.trim().toLowerCase();
    let shown = 0;
    for (const row of rows) {
      const onBoard = row.dataset.board === '1';
      const visible = (!only.checked || onBoard) && (!needle || (row.dataset.search || '').includes(needle));
      row.hidden = !visible;
      if (visible) shown += 1;
    }
    count.textContent = `${shown.toLocaleString()} of ${rows.length.toLocaleString()} episodes`;
  };
  query.addEventListener('input', apply);
  only.addEventListener('change', apply);
  apply();
})();
