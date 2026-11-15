(() => {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'dark';
  try {
    const saved = localStorage.getItem('kg-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      preference = saved;
    }
  } catch {}

  function resolveTheme(pref) {
    if (pref === 'system') return system.matches ? 'dark' : 'light';
    return pref === 'light' ? 'light' : 'dark';
  }

  function apply() {
    const active = resolveTheme(preference);
    document.documentElement.dataset.theme = active;
    document.documentElement.dataset.themePref = preference;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', active === 'dark' ? '#09090b' : '#fafafa');
    const select = document.querySelector('#theme');
    if (select && select.value !== preference) select.value = preference;
    window.dispatchEvent(new CustomEvent('kg-theme-change', { detail: { theme: active, preference } }));
  }

  function setPreference(next) {
    preference = ['dark', 'light', 'system'].includes(next) ? next : 'dark';
    try {
      localStorage.setItem('kg-theme', preference);
    } catch {}
    apply();
  }

  window.__kgTheme = { get: () => preference, set: setPreference };
  apply();

  system.addEventListener('change', () => {
    if (preference === 'system') apply();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'kg-theme' || e.key === null) {
      preference = ['light', 'dark', 'system'].includes(e.newValue) ? e.newValue : 'dark';
      apply();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('#theme')?.addEventListener('change', (e) => {
      setPreference(e.target.value);
    });
  });
})();
