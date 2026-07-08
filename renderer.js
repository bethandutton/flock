/* ---------------------------------------------------------------------------
   Flock — a flock of terminals in one window.
   Vocabulary: a "pen" is one terminal; the "field" holds all the pens.
--------------------------------------------------------------------------- */

const fieldEl = document.getElementById('field');
const tabbarEl = document.getElementById('tabbar');
const welcomeEl = document.getElementById('welcome');
const welcomeVideoEl = document.getElementById('welcome-video');
const matrixCanvas = document.getElementById('welcome-matrix');

/* Matrix rain on the welcome screen, in the theme's own colours. Runs only
   while the welcome screen is visible. */
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789$+*<>#';
const MATRIX_CELL = 16;
let matrixRaf = null;
let matrixDrops = [];
let matrixLast = 0;

function matrixStep(t) {
  matrixRaf = requestAnimationFrame(matrixStep);
  if (t - matrixLast < 50) return;
  matrixLast = t;
  const ctx = matrixCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = welcomeEl.clientWidth;
  const h = welcomeEl.clientHeight;
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--bg').trim();
  if (matrixCanvas.width !== Math.round(w * dpr) || matrixCanvas.height !== Math.round(h * dpr)) {
    matrixCanvas.width = Math.round(w * dpr);
    matrixCanvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    matrixDrops = Array.from({ length: Math.ceil(w / MATRIX_CELL) }, () => Math.floor(Math.random() * (h / MATRIX_CELL)));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = alpha(bg, 0.12);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = styles.getPropertyValue('--accent').trim();
  ctx.font = `13px ${termFont()}`;
  for (let i = 0; i < matrixDrops.length; i++) {
    const chr = MATRIX_CHARS[(Math.random() * MATRIX_CHARS.length) | 0];
    ctx.fillText(chr, i * MATRIX_CELL, matrixDrops[i] * MATRIX_CELL);
    if (matrixDrops[i] * MATRIX_CELL > h && Math.random() > 0.975) matrixDrops[i] = 0;
    matrixDrops[i]++;
  }
}
function startMatrix() {
  if (!matrixRaf) matrixRaf = requestAnimationFrame(matrixStep);
}
function stopMatrix() {
  if (matrixRaf) cancelAnimationFrame(matrixRaf);
  matrixRaf = null;
  matrixCanvas.width = 0;
}
const welcomeNewBtn = document.getElementById('welcome-new');
const welcomeOpenBtn = document.getElementById('welcome-open');

const addEl = document.getElementById('add');
const addBtn = document.getElementById('add-btn');
const addMenu = document.getElementById('add-menu');
const addNewBtn = document.getElementById('add-new');
const addOpenBtn = document.getElementById('add-open');
const ctxMenu = document.getElementById('ctx-menu');

const prefsEl = document.getElementById('prefs');
const themeGridEl = document.getElementById('theme-grid');
const customFieldsEl = document.getElementById('custom-fields');
const layoutOptionsEl = document.getElementById('layout-options');
const gridSizeEl = document.getElementById('grid-size');
const gridRowsEl = document.getElementById('grid-rows');
const gridColsEl = document.getElementById('grid-cols');
const fontChoiceEl = document.getElementById('font-choice');
const showActivityEl = document.getElementById('show-activity');
const prefsDoneBtn = document.getElementById('prefs-done');

/* ---------------------------- Colour helpers ---------------------------- */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}
const lighten = (hex, t) => mix(hex, '#ffffff', t);
const darken = (hex, t) => mix(hex, '#000000', t);
function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function readableText(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#10233a' : '#ffffff';
}

/* -------------------------------- Themes -------------------------------- */

const ANSI_DARK = {
  black: '#2b2b2b', red: '#ff6b6b', green: '#7bd88f', yellow: '#f4d03f',
  blue: '#6ab0f3', magenta: '#c792ea', cyan: '#5ad4e6', white: '#e6e6e6',
  brightBlack: '#5c5c5c', brightRed: '#ff8787', brightGreen: '#95e6a8', brightYellow: '#f7dd6b',
  brightBlue: '#8cc4f7', brightMagenta: '#d6adf0', brightCyan: '#82e0ee', brightWhite: '#ffffff',
};

const THEMES = {
  meadow: {
    label: 'Meadow',
    swatch: ['#1d2725', '#26302d', '#b5bd68'],
    ui: {
      '--bg': '#1d2725', '--bar-bg': '#26302d', '--pen-header': '#26302d', '--pen-header-active': '#2f3a37',
      '--text': '#c6ccc9', '--text-muted': '#7c857f', '--border': '#131b19', '--hover': '#38423f',
      '--accent': '#b5bd68', '--accent-hover': '#c6cd82', '--accent-active': '#9aa257', '--accent-text': '#12201d',
      '--secondary-bg': '#38423f', '--secondary-hover': '#434e4a', '--secondary-active': '#2c3633',
      '--scrollbar': '#434e4a', '--panel-bg': '#26302d', '--panel-border': '#3a4441', '--input-bg': '#1d2725',
    },
    term: {
      background: '#1d2725', foreground: '#c6ccc9', cursor: '#c6ccc9', cursorAccent: '#1d2725', selectionBackground: '#37413e',
      black: '#1d2725', red: '#cc6666', green: '#b5bd68', yellow: '#f0c674', blue: '#81a2be', magenta: '#b294bb', cyan: '#8abeb7', white: '#c6ccc9',
      brightBlack: '#666666', brightRed: '#d54e53', brightGreen: '#b9ca4a', brightYellow: '#e7c547', brightBlue: '#7aa6da', brightMagenta: '#c397d8', brightCyan: '#70c0b1', brightWhite: '#eaeaea',
    },
  },
  dark: {
    label: 'Dark',
    swatch: ['#1e1e1e', '#262626', '#2f8f4f'],
    ui: {
      '--bg': '#1e1e1e', '--bar-bg': '#262626', '--pen-header': '#262626', '--pen-header-active': '#303030',
      '--text': '#e6e6e6', '--text-muted': '#8a8a8a', '--border': '#000000', '--hover': '#3a3a3a',
      '--accent': '#2f8f4f', '--accent-hover': '#38a95d', '--accent-active': '#26743f', '--accent-text': '#ffffff',
      '--secondary-bg': '#3a3a3a', '--secondary-hover': '#474747', '--secondary-active': '#2f2f2f',
      '--scrollbar': '#444444', '--panel-bg': '#2f2f2f', '--panel-border': '#555555', '--input-bg': '#1e1e1e',
    },
    term: { background: '#1e1e1e', foreground: '#e6e6e6', cursor: '#ffffff', cursorAccent: '#1e1e1e', selectionBackground: '#2f6b40', ...ANSI_DARK },
  },
  light: {
    label: 'Light',
    swatch: ['#ffffff', '#ececec', '#2f9e57'],
    ui: {
      '--bg': '#ffffff', '--bar-bg': '#ececec', '--pen-header': '#ececec', '--pen-header-active': '#e0e0e0',
      '--text': '#1e1e1e', '--text-muted': '#767676', '--border': '#d0d0d0', '--hover': '#dcdcdc',
      '--accent': '#2f9e57', '--accent-hover': '#39b365', '--accent-active': '#268a49', '--accent-text': '#ffffff',
      '--secondary-bg': '#dedede', '--secondary-hover': '#d2d2d2', '--secondary-active': '#c8c8c8',
      '--scrollbar': '#c4c4c4', '--panel-bg': '#f6f6f6', '--panel-border': '#cfcfcf', '--input-bg': '#ffffff',
    },
    term: {
      background: '#ffffff', foreground: '#1e1e1e', cursor: '#1e1e1e', cursorAccent: '#ffffff', selectionBackground: '#b8d4f5',
      black: '#3b3b3b', red: '#c0392b', green: '#1e8a4c', yellow: '#b8860b', blue: '#2f7fe0', magenta: '#8e44ad', cyan: '#0e8faf', white: '#3b3b3b',
      brightBlack: '#767676', brightRed: '#e74c3c', brightGreen: '#27ae60', brightYellow: '#d4a017', brightBlue: '#4a92e8', brightMagenta: '#a569bd', brightCyan: '#17a2b8', brightWhite: '#1e1e1e',
    },
  },
  grass: {
    label: 'Grass',
    swatch: ['#0a1a0d', '#0f2a15', '#4fe07a'],
    ui: {
      '--bg': '#0a1a0d', '--bar-bg': '#0f2a15', '--pen-header': '#0f2a15', '--pen-header-active': '#163a1f',
      '--text': '#b7f5c4', '--text-muted': '#5f9c6d', '--border': '#04120a', '--hover': '#1c4527',
      '--accent': '#4fe07a', '--accent-hover': '#6cea92', '--accent-active': '#3fc766', '--accent-text': '#062910',
      '--secondary-bg': '#1c4527', '--secondary-hover': '#245c33', '--secondary-active': '#163a1f',
      '--scrollbar': '#2a5c38', '--panel-bg': '#0f2a15', '--panel-border': '#245c33', '--input-bg': '#0a1a0d',
    },
    term: {
      background: '#0a1a0d', foreground: '#b7f5c4', cursor: '#4fe07a', cursorAccent: '#0a1a0d', selectionBackground: '#1c6b32',
      black: '#0f2a15', red: '#ff7b6b', green: '#4fe07a', yellow: '#c8e04f', blue: '#4fd0e0', magenta: '#9be04f', cyan: '#4fe0b0', white: '#b7f5c4',
      brightBlack: '#5f9c6d', brightRed: '#ff9b8b', brightGreen: '#7cea9a', brightYellow: '#d8ea7c', brightBlue: '#7ce0ea', brightMagenta: '#b7ea7c', brightCyan: '#7ceac8', brightWhite: '#e6ffe9',
    },
  },
  'high-contrast': {
    label: 'High Contrast',
    swatch: ['#000000', '#000000', '#ffff00'],
    ui: {
      '--bg': '#000000', '--bar-bg': '#000000', '--pen-header': '#000000', '--pen-header-active': '#1a1a1a',
      '--text': '#ffffff', '--text-muted': '#cccccc', '--border': '#ffffff', '--hover': '#333333',
      '--accent': '#ffff00', '--accent-hover': '#ffff66', '--accent-active': '#e6e600', '--accent-text': '#000000',
      '--secondary-bg': '#1a1a1a', '--secondary-hover': '#333333', '--secondary-active': '#000000',
      '--scrollbar': '#ffffff', '--panel-bg': '#000000', '--panel-border': '#ffffff', '--input-bg': '#000000',
    },
    term: {
      background: '#000000', foreground: '#ffffff', cursor: '#ffff00', cursorAccent: '#000000', selectionBackground: '#5555ff',
      black: '#000000', red: '#ff5555', green: '#55ff55', yellow: '#ffff55', blue: '#5555ff', magenta: '#ff55ff', cyan: '#55ffff', white: '#ffffff',
      brightBlack: '#888888', brightRed: '#ff8888', brightGreen: '#88ff88', brightYellow: '#ffff88', brightBlue: '#8888ff', brightMagenta: '#ff88ff', brightCyan: '#88ffff', brightWhite: '#ffffff',
    },
  },
};

function customTheme(c) {
  const bg = c.bg, header = c.header, text = c.text, accent = c.accent;
  return {
    label: 'Custom',
    ui: {
      '--bg': bg, '--bar-bg': header, '--pen-header': header, '--pen-header-active': lighten(header, 0.08),
      '--text': text, '--text-muted': alpha(text, 0.55), '--border': darken(header, 0.4), '--hover': lighten(header, 0.14),
      '--accent': accent, '--accent-hover': lighten(accent, 0.12), '--accent-active': darken(accent, 0.1), '--accent-text': readableText(accent),
      '--secondary-bg': lighten(header, 0.1), '--secondary-hover': lighten(header, 0.16), '--secondary-active': header,
      '--scrollbar': lighten(header, 0.2), '--panel-bg': lighten(bg, 0.06), '--panel-border': lighten(header, 0.2), '--input-bg': darken(bg, 0.06),
    },
    term: { background: bg, foreground: text, cursor: accent, cursorAccent: bg, selectionBackground: alpha(accent, 0.4), ...ANSI_DARK },
  };
}

/* ------------------------------- State ---------------------------------- */

const pens = new Map();
let order = [];
let focusedId = null;
let counter = 0;

const prefs = {
  theme: 'meadow',
  custom: { bg: '#1e1e1e', header: '#262626', text: '#e6e6e6', accent: '#2f8f4f' },
  layout: 'compact',
  grid: { rows: 1, cols: 3 },
  fontFamily: '"JetBrains Mono"',
  showActivity: false,
};

const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 240;
const BASE_FONT = 12;
const MIN_FONT = 8;
const MAX_FONT = 32;

function activeThemeObject() {
  return prefs.theme === 'custom' ? customTheme(prefs.custom) : THEMES[prefs.theme];
}
function termFont() {
  return `${prefs.fontFamily}, "SF Mono", Menlo, monospace`;
}
function capacity() {
  return prefs.grid.rows * prefs.grid.cols;
}

/* ----------------------------- Apply theme ------------------------------ */

function applyTheme() {
  const t = activeThemeObject();
  for (const [k, v] of Object.entries(t.ui)) document.documentElement.style.setProperty(k, v);
  for (const pen of pens.values()) {
    pen.term.options.theme = t.term;
    pen.term.options.fontFamily = termFont();
  }
  requestAnimationFrame(refitAll);
}

/* GPU text rendering: glyphs are sheared once, uploaded to the graphics card
   and painted from there. Falls back to the default renderer if WebGL is
   unavailable or its context is lost. */
function attachGpuRenderer(term) {
  try {
    const gpu = new WebglAddon.WebglAddon();
    gpu.onContextLoss(() => gpu.dispose());
    term.loadAddon(gpu);
  } catch (_) {
    // canvas/DOM renderer keeps working
  }
}

/* ------------------------------- Pens ----------------------------------- */

function makePen({ cwd, title } = {}) {
  const id = `p${++counter}`;

  const el = document.createElement('div');
  el.className = 'pen';
  el.dataset.id = id;
  el.innerHTML = `
    <div class="pen-header">
      <div class="pen-titles"><div class="pen-title">Terminal</div><div class="pen-location"></div></div>
      <div class="pen-close" title="Close (⌘W)">✕</div>
    </div>
    <div class="pen-term"></div>
    <div class="pen-status"></div>
    <div class="pen-resizer"></div>`;

  const headerEl = el.querySelector('.pen-header');
  const titleEl = el.querySelector('.pen-title');
  const locationEl = el.querySelector('.pen-location');
  const closeEl = el.querySelector('.pen-close');
  const termEl = el.querySelector('.pen-term');
  const statusEl = el.querySelector('.pen-status');
  const resizerEl = el.querySelector('.pen-resizer');

  const t = activeThemeObject();
  const term = new Terminal({
    fontFamily: termFont(),
    fontSize: BASE_FONT,
    fontWeight: 400,
    fontWeightBold: 700,
    lineHeight: 1.0,
    cursorBlink: true,
    cursorStyle: 'block',
    theme: t.term,
    allowProposedApi: true,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(termEl);
  attachGpuRenderer(term);

  const pen = { id, el, headerEl, titleEl, locationEl, statusEl, termEl, term, fit, customTitle: false, editing: false, pinned: false, fontSize: BASE_FONT };
  pens.set(id, pen);

  // Refit whenever the terminal's box changes for any reason — column drags,
  // the field scrollbar appearing, grid changes, or a tab becoming visible.
  pen.ro = new ResizeObserver(() => refit(pen));
  pen.ro.observe(termEl);

  if (title) { titleEl.textContent = title; pen.customTitle = true; }
  titleEl.title = titleEl.textContent;

  term.onData((data) => window.flock.sendInput(id, data));
  term.onTitleChange((tt) => {
    if (!pen.customTitle && tt) { titleEl.textContent = tt; titleEl.title = tt; }
  });

  /* CLIs ring the terminal bell when they want a human (Claude Code does this
     while waiting for input). Surface it: flashing dot on the header, and a
     notification + sound when the window isn't front-most. */
  term.onBell(() => {
    if (pen.muted) return;
    const away = !document.hasFocus();
    if (!away && focusedId === id) return;
    const firstAlert = !pen.attention;
    markAttention(pen);
    if (away && firstAlert) {
      window.flock.beep();
      const note = new Notification(titleEl.textContent, {
        body: `${locationEl.textContent || 'Terminal'} — ready for you`,
      });
      note.onclick = () => {
        window.flock.focusWindow();
        setFocused(id);
        requestAnimationFrame(() => term.focus());
      };
    }
  });
  termEl.addEventListener('mousedown', () => setFocused(id));

  /* Dropping files types their (shell-escaped) paths at the prompt, the way
     Terminal.app does — so images and files can be handed to CLIs like
     Claude Code and CodeRabbit. term.paste() respects bracketed paste. */
  termEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  termEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const paths = [...e.dataTransfer.files].map((f) => window.flock.pathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    term.paste(paths.map((p) => p.replace(/[^A-Za-z0-9,._+@%/\-]/g, '\\$&')).join(' '));
    setFocused(id);
    term.focus();
  });

  closeEl.addEventListener('mousedown', (e) => { e.stopPropagation(); closePen(id); });
  headerEl.addEventListener('mousedown', () => {
    setFocused(id);
    if (prefs.layout === 'tabs') requestAnimationFrame(() => { if (!pen.editing) term.focus(); });
  });
  titleEl.addEventListener('dblclick', () => startTitleEdit(pen));
  headerEl.addEventListener('contextmenu', (e) => { e.preventDefault(); openCtxMenu(pen, e.clientX, e.clientY); });
  resizerEl.addEventListener('mousedown', (e) => startResize(e, pen, resizerEl));

  applyActivityVisibility(pen);
  window.flock.createTerminal(id, term.cols || 80, term.rows || 24, cwd);
  return pen;
}

function addPen(opts = {}) {
  if (prefs.layout === 'fixed' && order.length >= capacity()) return;
  const pen = makePen(opts);
  order.push(pen.id);
  renderField();
  setFocused(pen.id);
  requestAnimationFrame(() => { pen.term.focus(); pen.el.scrollIntoView({ inline: 'end', behavior: 'smooth' }); });
}

async function openFolder() {
  const dir = await window.flock.pickDirectory();
  if (!dir) return;
  const name = dir.split('/').filter(Boolean).pop() || dir;
  addPen({ cwd: dir, title: name });
}

function setFocused(id) {
  if (focusedId === id) return;
  focusedId = id;
  for (const [pid, p] of pens) p.el.classList.toggle('focused', pid === id);
}

function refit(pen) {
  if (!pen.el.parentElement) return;
  try {
    pen.fit.fit();
    window.flock.resize(pen.id, pen.term.cols, pen.term.rows);
  } catch (_) { /* pane not measurable yet */ }
}
function refitAll() {
  for (const pen of pens.values()) refit(pen);
}

function adjustFont(delta) {
  const pen = pens.get(focusedId);
  if (!pen) return;
  pen.fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, pen.fontSize + delta));
  pen.term.options.fontSize = pen.fontSize;
  refit(pen);
}
function resetFont() {
  const pen = pens.get(focusedId);
  if (!pen) return;
  pen.fontSize = BASE_FONT;
  pen.term.options.fontSize = BASE_FONT;
  refit(pen);
}

function closePen(id) {
  const pen = pens.get(id);
  if (!pen) return;
  window.flock.kill(id);
  pen.term.dispose();
  pen.el.remove();
  pens.delete(id);
  order = order.filter((x) => x !== id);

  if (focusedId === id) focusedId = null;
  renderField();

  if (prefs.layout === 'compact' && order.length === 0) return; // welcome shows
  if (!focusedId && order.length) {
    const next = order[order.length - 1];
    setFocused(next);
    requestAnimationFrame(() => pens.get(next).term.focus());
  }
}

/* ------------------------------ Title edit ------------------------------ */

function startTitleEdit(pen) {
  if (pen.editing) return;
  pen.editing = true;
  const titleEl = pen.titleEl;
  const original = titleEl.textContent;
  titleEl.classList.add('editing');
  titleEl.contentEditable = 'plaintext-only';
  titleEl.focus();

  const range = document.createRange();
  range.selectNodeContents(titleEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish(commit) {
    titleEl.removeEventListener('keydown', onKey);
    titleEl.removeEventListener('blur', onBlur);
    titleEl.contentEditable = 'false';
    titleEl.classList.remove('editing');
    pen.editing = false;
    if (commit) {
      const text = titleEl.textContent.trim();
      titleEl.textContent = text || 'Terminal';
      pen.customTitle = true;
    } else {
      titleEl.textContent = original;
    }
    pen.term.focus();
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  }
  function onBlur() { finish(true); }
  titleEl.addEventListener('keydown', onKey);
  titleEl.addEventListener('blur', onBlur);
}

/* --------------------------- Field rendering ---------------------------- */

function makeEmptyCell() {
  const empty = document.createElement('div');
  empty.className = 'cell-empty';
  empty.innerHTML = `
    <button class="topbar-btn cell-new" type="button">New</button>
    <button class="topbar-btn secondary cell-open" type="button">Open</button>`;
  empty.querySelector('.cell-new').addEventListener('click', () => addPen());
  empty.querySelector('.cell-open').addEventListener('click', () => openFolder());
  return empty;
}

function renderField() {
  fieldEl.querySelectorAll('.cell').forEach((c) => c.remove());
  for (const pen of pens.values()) if (pen.el.parentElement) pen.el.remove();
  if (addEl.parentElement) addEl.remove();

  if (prefs.layout === 'compact') {
    fieldEl.classList.remove('mode-fixed');
    fieldEl.style.gridTemplateColumns = '';
    fieldEl.style.gridTemplateRows = '';
    for (const id of order) fieldEl.appendChild(pens.get(id).el);
    if (!fieldEl.contains(welcomeEl)) fieldEl.appendChild(welcomeEl);
    welcomeEl.classList.toggle('hidden', order.length > 0);
    if (order.length) fieldEl.appendChild(addEl);
  } else {
    fieldEl.classList.add('mode-fixed');
    if (fieldEl.contains(welcomeEl)) welcomeEl.remove();
    fieldEl.style.gridTemplateColumns = `repeat(${prefs.grid.cols}, 1fr)`;
    fieldEl.style.gridTemplateRows = `repeat(${prefs.grid.rows}, 1fr)`;
    const cap = capacity();
    for (let i = 0; i < cap; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const id = order[i];
      if (id) cell.appendChild(pens.get(id).el);
      else cell.appendChild(makeEmptyCell());
      fieldEl.appendChild(cell);
    }
  }
  pens.forEach((p) => p.el.classList.toggle('is-first', p.id === order[0]));
  // Don't burn CPU on the background video/animation while it's off screen
  const welcomeVisible = welcomeEl.parentElement && !welcomeEl.classList.contains('hidden');
  if (welcomeVisible) { welcomeVideoEl.play().catch(() => {}); startMatrix(); }
  else { welcomeVideoEl.pause(); stopMatrix(); }
  requestAnimationFrame(refitAll);
}

/* ------------------------- Rearrange + context menu --------------------- */

function movePen(id, dir) {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  renderField();
}

let ctxPenId = null;
function openCtxMenu(pen, x, y) {
  ctxPenId = pen.id;
  setFocused(pen.id);
  ctxMenu.classList.remove('hidden');
  const rect = ctxMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  ctxMenu.style.left = `${Math.max(8, left)}px`;
  ctxMenu.style.top = `${Math.max(8, top)}px`;
}
function closeCtxMenu() { ctxMenu.classList.add('hidden'); ctxPenId = null; }

ctxMenu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  const pen = pens.get(ctxPenId);
  const act = b.dataset.act;
  closeCtxMenu();
  if (!pen) return;
  if (act === 'rename') startTitleEdit(pen);
  else if (act === 'left') movePen(pen.id, -1);
  else if (act === 'right') movePen(pen.id, 1);
  else if (act === 'close') closePen(pen.id);
}));
document.addEventListener('mousedown', (e) => { if (!ctxMenu.contains(e.target)) closeCtxMenu(); });

/* ------------------------------ Resizing -------------------------------- */

function startResize(e, pen, resizerEl) {
  if (prefs.layout !== 'compact') return;
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = pen.el.getBoundingClientRect().width;
  resizerEl.classList.add('dragging');
  document.body.style.cursor = 'col-resize';

  let frame = null;
  function onMove(ev) {
    const next = Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX));
    pen.el.style.width = `${next}px`;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => refit(pen));
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    resizerEl.classList.remove('dragging');
    document.body.style.cursor = '';
    refit(pen);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ------------------------------ Activity -------------------------------- */

function applyActivityVisibility(pen) {
  pen.statusEl.classList.toggle('hidden', !prefs.showActivity);
}
window.flock.onStats(({ id, cpu, mem }) => {
  const pen = pens.get(id);
  if (pen && prefs.showActivity) pen.statusEl.textContent = `CPU ${cpu}%  ·  ${mem} MB`;
});

window.flock.onLocation(({ id, dir, branch }) => {
  const pen = pens.get(id);
  if (!pen) return;
  pen.locationEl.textContent = branch ? `${dir} · ${branch}` : dir;
  pen.locationEl.title = branch ? `${dir} on ${branch}` : dir;
});

/* ------------------------------ Add menu -------------------------------- */

addBtn.addEventListener('click', (e) => { e.stopPropagation(); addMenu.classList.toggle('hidden'); });
addNewBtn.addEventListener('click', () => { addMenu.classList.add('hidden'); addPen(); });
addOpenBtn.addEventListener('click', () => { addMenu.classList.add('hidden'); openFolder(); });
document.addEventListener('click', (e) => { if (!addEl.contains(e.target)) addMenu.classList.add('hidden'); });

welcomeNewBtn.addEventListener('click', () => addPen());
welcomeOpenBtn.addEventListener('click', () => openFolder());

/* ----------------------------- Preferences ------------------------------ */

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
    card.addEventListener('click', () => { prefs.theme = key; applyTheme(); syncPrefsUI(); persist(); });
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
  showActivityEl.checked = prefs.showActivity;
}

customFieldsEl.querySelectorAll('input[data-var]').forEach((inp) => {
  inp.addEventListener('input', () => {
    prefs.custom[inp.dataset.var] = inp.value;
    if (prefs.theme === 'custom') applyTheme();
    buildThemeCards();
    syncPrefsUI();
    persist();
  });
});

layoutOptionsEl.querySelectorAll('.layout-opt').forEach((b) => {
  b.addEventListener('click', () => setLayout(b.dataset.layout));
});
gridRowsEl.addEventListener('change', () => { prefs.grid.rows = +gridRowsEl.value; renderField(); persist(); });
gridColsEl.addEventListener('change', () => { prefs.grid.cols = +gridColsEl.value; renderField(); persist(); });

fontChoiceEl.addEventListener('change', () => {
  prefs.fontFamily = fontChoiceEl.value;
  for (const pen of pens.values()) pen.term.options.fontFamily = termFont();
  requestAnimationFrame(refitAll);
  persist();
});

showActivityEl.addEventListener('change', () => {
  prefs.showActivity = showActivityEl.checked;
  for (const pen of pens.values()) { applyActivityVisibility(pen); if (!prefs.showActivity) pen.statusEl.textContent = ''; }
  requestAnimationFrame(refitAll);
  persist();
});

function setLayout(next) {
  if (prefs.layout === next) return;
  prefs.layout = next;
  if (next === 'fixed') {
    while (order.length > capacity() && prefs.grid.cols < 5) prefs.grid.cols++;
    while (order.length > capacity() && prefs.grid.rows < 3) prefs.grid.rows++;
  } else {
    for (const pen of pens.values()) pen.el.style.width = `${DEFAULT_WIDTH}px`;
  }
  renderField();
  syncPrefsUI();
  persist();
}

function openPrefs() { buildThemeCards(); syncPrefsUI(); prefsEl.classList.remove('hidden'); }
function closePrefs() { prefsEl.classList.add('hidden'); }
prefsDoneBtn.addEventListener('click', closePrefs);
window.flock.onOpenPreferences(() => (prefsEl.classList.contains('hidden') ? openPrefs() : closePrefs()));

/* ---------------------------- Persistence ------------------------------- */

let persistTimer = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => window.flock.savePrefs(prefs), 200);
}

function applyPrefs(saved) {
  if (!saved || typeof saved !== 'object') return;
  Object.assign(prefs, saved);
  prefs.custom = { ...prefs.custom, ...(saved.custom || {}) };
  prefs.grid = { ...prefs.grid, ...(saved.grid || {}) };
}

// Hand-edits to the config file (Flock → Edit Config File…) apply live
window.flock.onPrefsChanged((saved) => {
  applyPrefs(saved);
  applyTheme();
  renderField();
  for (const pen of pens.values()) {
    applyActivityVisibility(pen);
    if (!prefs.showActivity) pen.statusEl.textContent = '';
  }
  if (!prefsEl.classList.contains('hidden')) { buildThemeCards(); syncPrefsUI(); }
});

window.flock.onFlushPrefs(() => window.flock.savePrefs(prefs));

/* ------------------------------ Shell I/O ------------------------------- */

window.flock.onData(({ id, data }) => {
  const pen = pens.get(id);
  if (!pen) return;
  pen.lastData = performance.now();
  pen.term.write(data);
});
window.flock.onExit(({ id }) => { if (pens.has(id)) closePen(id); });

/* ------------------------- Shortcuts + window --------------------------- */

window.addEventListener('keydown', (e) => {
  if (e.metaKey && e.key === 't') { e.preventDefault(); addPen(); }
  else if (e.metaKey && e.key === 'w') { e.preventDefault(); if (focusedId) closePen(focusedId); }
  else if (e.metaKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); adjustFont(1); }
  else if (e.metaKey && (e.key === '-' || e.key === '_')) { e.preventDefault(); adjustFont(-1); }
  else if (e.metaKey && e.key === '0') { e.preventDefault(); resetFont(); }
  else if (e.key === 'Escape') {
    if (!prefsEl.classList.contains('hidden')) closePrefs();
    addMenu.classList.add('hidden');
    closeCtxMenu();
  }
});
window.addEventListener('resize', () => requestAnimationFrame(refitAll));

/* ----------------------------- Update banner ---------------------------- */

const updateBanner = document.getElementById('update-banner');
const updateText = document.getElementById('update-text');
const updateGetBtn = document.getElementById('update-get');
let updateUrl = null;
let updateHideTimer = null;

window.flock.onUpdateAvailable(({ version, url }) => {
  if (updateHideTimer) { clearTimeout(updateHideTimer); updateHideTimer = null; }
  updateUrl = url;
  updateText.textContent = `Flock ${version} is available`;
  updateGetBtn.classList.remove('hidden');
  updateBanner.classList.remove('hidden');
});

window.flock.onUpdateNone(({ version, offline }) => {
  if (updateHideTimer) clearTimeout(updateHideTimer);
  updateText.textContent = offline ? 'Couldn’t check for updates — are you online?' : `You’re up to date (Flock ${version})`;
  updateGetBtn.classList.add('hidden');
  updateBanner.classList.remove('hidden');
  updateHideTimer = setTimeout(() => updateBanner.classList.add('hidden'), 5000);
});
document.getElementById('update-get').addEventListener('click', () => {
  if (updateUrl) window.flock.openUpdate(updateUrl);
});
document.getElementById('update-dismiss').addEventListener('click', () => {
  updateBanner.classList.add('hidden');
});

/* ------------------------------- Startup -------------------------------- */

(async function init() {
  applyPrefs(await window.flock.getPrefs());
  applyTheme();
  renderField();

  // Canvas rendering doesn't trigger @font-face loading on its own, so pull
  // the bundled font in explicitly, then re-measure any early terminals.
  Promise.all([
    document.fonts.load('400 13px "JetBrains Mono"'),
    document.fonts.load('700 13px "JetBrains Mono"'),
  ]).then(() => {
    for (const pen of pens.values()) {
      pen.term.options.fontFamily = 'monospace';
      pen.term.options.fontFamily = termFont();
    }
    refitAll();
  });
})();
