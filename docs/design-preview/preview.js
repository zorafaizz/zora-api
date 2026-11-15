const themeButton = document.querySelector('.theme');
const system = matchMedia('(prefers-color-scheme: dark)');
let preference;
try { preference = localStorage.getItem('kg-preview-theme'); } catch {}
function applyTheme() {
  const theme = preference === 'light' || preference === 'dark' ? preference : system.matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === 'dark' ? 'Light theme' : 'Dark theme';
  themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
}
applyTheme();
themeButton.addEventListener('click', () => {
  preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('kg-preview-theme', preference); } catch {}
  applyTheme();
});
system.addEventListener('change', applyTheme);
window.addEventListener('storage', (event) => { if (event.key === 'kg-preview-theme') { preference = event.newValue; applyTheme(); } });
const response = document.querySelector('.response');
document.querySelector('.sample').addEventListener('click', () => {
  response.hidden = false;
  document.querySelector('.sample-status').textContent = 'Local example shown. No network request was sent.';
});
document.querySelector('.copy').addEventListener('click', async () => {
  const status = document.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('.request').textContent);
    status.textContent = 'Request copied.';
  } catch { status.textContent = 'Clipboard unavailable. Select the request text to copy it.'; }
});
