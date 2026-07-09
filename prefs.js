/* The Preferences window. It owns no terminals — it just edits the prefs
   object and saves it; main relays every save to the flock window, which
   applies the change live. Changes made elsewhere arrive back the same way. */

const themeGridEl = document.getElementById('theme-grid');
const customFieldsEl = document.getElementById('custom-fields');
const layoutOptionsEl = document.getElementById('layout-options');
const gridSizeEl = document.getElementById('grid-size');
const gridRowsEl = document.getElementById('grid-rows');
const gridColsEl = document.getElementById('grid-cols');
const fontChoiceEl = document.getElementById('font-choice');
const lineHeightEl = document.getElementById('line-height');
const showActivityEl = document.getElementById('show-activity');

const prefs = {
  theme: 'fleece',
  custom: { bg: '#1e1e1e', header: '#262626', text: '#e6e6e6', accent: '#2f8f4f' },
  layout: 'compact',
  grid: { rows: 1, cols: 3 },
  fontFamily: '"JetBrains Mono"',
  lineHeight: 1,
  dashView: 'cards',
  showActivity: false,
  recentFolders: [],
};

function applyPrefs(saved) {
  if (!saved || typeof saved !== 'object') return;
  Object.assign(prefs, saved);
  prefs.custom = { ...prefs.custom, ...(saved.custom || {}) };
  prefs.grid = { ...prefs.grid, ...(saved.grid || {}) };
  prefs.lineHeight = Math.min(2, Math.max(1, Number(prefs.lineHeight) || 1));
}

function applyThemeVars() {
  const t = prefs.theme === 'custom' ? customTheme(prefs.custom) : THEMES[prefs.theme];
  for (const [k, v] of Object.entries(t.ui)) document.documentElement.style.setProperty(k, v);
}

let persistTimer = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => window.flock.savePrefs(prefs), 200);
}

function buildThemeCards() {
  const entries = [...Object.entries(THEMES), ['custom', { label: 'Custom' }]];
  themeGridEl.innerHTML = '';
  for (const [key, t] of entries) {
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.dataset.theme = key;
    const swatch = key === 'custom' ? [prefs.custom.bg, prefs.custom.header, prefs.custom.accent] : t.swatch;
    card.innerHTML = `
      <div class="theme-swatch">${swatch.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
      <div class="theme-name">${t.label}</div>`;
    card.addEventListener('click', () => { prefs.theme = key; applyThemeVars(); syncPrefsUI(); persist(); });
    themeGridEl.appendChild(card);
  }
}

function syncPrefsUI() {
  themeGridEl.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('selected', c.dataset.theme === prefs.theme));
  customFieldsEl.classList.toggle('hidden', prefs.theme !== 'custom');
  customFieldsEl.querySelectorAll('input[data-var]').forEach((inp) => { inp.value = prefs.custom[inp.dataset.var]; });

  layoutOptionsEl.querySelectorAll('.layout-opt').forEach((b) => b.classList.toggle('selected', b.dataset.layout === prefs.layout));
  gridSizeEl.classList.toggle('hidden', prefs.layout !== 'fixed');
  gridRowsEl.value = String(prefs.grid.rows);
  gridColsEl.value = String(prefs.grid.cols);

  fontChoiceEl.value = prefs.fontFamily;
  lineHeightEl.value = String(prefs.lineHeight);
  showActivityEl.checked = prefs.showActivity;
}

customFieldsEl.querySelectorAll('input[data-var]').forEach((inp) => {
  inp.addEventListener('input', () => {
    prefs.custom[inp.dataset.var] = inp.value;
    if (prefs.theme === 'custom') applyThemeVars();
    buildThemeCards();
    syncPrefsUI();
    persist();
  });
});

layoutOptionsEl.querySelectorAll('.layout-opt').forEach((b) => {
  b.addEventListener('click', () => { prefs.layout = b.dataset.layout; syncPrefsUI(); persist(); });
});
gridRowsEl.addEventListener('change', () => { prefs.grid.rows = +gridRowsEl.value; persist(); });
gridColsEl.addEventListener('change', () => { prefs.grid.cols = +gridColsEl.value; persist(); });
fontChoiceEl.addEventListener('change', () => { prefs.fontFamily = fontChoiceEl.value; persist(); });
lineHeightEl.addEventListener('change', () => { prefs.lineHeight = Number(lineHeightEl.value); persist(); });
showActivityEl.addEventListener('change', () => { prefs.showActivity = showActivityEl.checked; persist(); });

// Changes made in the flock window or by hand-editing the config file
window.flock.onPrefsChanged((saved) => {
  applyPrefs(saved);
  applyThemeVars();
  buildThemeCards();
  syncPrefsUI();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || (e.metaKey && e.key === 'w')) window.close();
});

(async () => {
  applyPrefs(await window.flock.getPrefs());
  applyThemeVars();
  buildThemeCards();
  syncPrefsUI();
})();
