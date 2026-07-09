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
  // Mostly accent, with the odd glyph in the theme's other tones so the
  // rain reads as liquid colour rather than a single-hue matrix
  const inks = [
    styles.getPropertyValue('--accent').trim(),
    styles.getPropertyValue('--attention').trim(),
    styles.getPropertyValue('--text-muted').trim(),
  ];
  ctx.font = `13px ${termFont()}`;
  for (let i = 0; i < matrixDrops.length; i++) {
    const chr = MATRIX_CHARS[(Math.random() * MATRIX_CHARS.length) | 0];
    const r = Math.random();
    ctx.fillStyle = r < 0.72 ? inks[0] : r < 0.88 ? inks[1] : inks[2];
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
const addRecentsEl = document.getElementById('add-recents');
const ctxMenu = document.getElementById('ctx-menu');

/* ------------------------------- State ---------------------------------- */

const pens = new Map();
let order = [];
let focusedId = null;
let counter = 0;

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
    pen.term.options.lineHeight = prefs.lineHeight;
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
      <div class="pen-back" title="Back to Dashboard">←</div>
      <div class="pen-titles"><div class="pen-title">Terminal</div><div class="pen-location"></div></div>
      <div class="pen-close" title="Close (⌘W)">✕</div>
    </div>
    <div class="pen-term"></div>
    <div class="pen-status"></div>
    <div class="pen-shade">
      <button class="pen-shade-eye" title="Look back" type="button">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
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
    lineHeight: prefs.lineHeight,
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

  /* A terminal can't tell Shift+Enter from Enter, so it never makes a new
     line. Send ESC+CR instead — the sequence Claude Code and zsh both read
     as "newline, don't submit". */
  term.attachCustomKeyEventHandler((e) => {
    if (e.key === 'Enter' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.type === 'keydown') window.flock.sendInput(id, '\x1b\r');
      return false;
    }
    return true;
  });

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
    // A shaded pen is hidden behind the blur, so its bell always counts.
    if (!away && focusedId === id && !pen.shaded) return;
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

  el.querySelector('.pen-shade-eye').addEventListener('click', () => setShaded(pen, false));
  el.querySelector('.pen-back').addEventListener('mousedown', (e) => {
    e.stopPropagation();
    dashboardZoom = null;
    renderField();
  });

  applyActivityVisibility(pen);
  window.flock.createTerminal(id, term.cols || 80, term.rows || 24, cwd);
  return pen;
}

function setShaded(pen, on) {
  pen.shaded = on;
  pen.el.classList.toggle('shaded', on);
  // Looking back means you've seen whatever rang the bell
  if (!on) {
    clearAttention(pen);
    requestAnimationFrame(() => pen.term.focus());
  }
}

function addPen(opts = {}) {
  if (prefs.layout === 'fixed' && order.length >= capacity()) return;
  const pen = makePen(opts);
  order.push(pen.id);
  renderField();
  setFocused(pen.id);
  requestAnimationFrame(() => { pen.term.focus(); pen.el.scrollIntoView({ inline: 'end', behavior: 'smooth' }); });
}

function openIn(dir) {
  const name = dir.split('/').filter(Boolean).pop() || dir;
  prefs.recentFolders = [dir, ...prefs.recentFolders.filter((d) => d !== dir)].slice(0, 5);
  persist();
  addPen({ cwd: dir, title: name });
}

async function openFolder() {
  const dir = await window.flock.pickDirectory();
  if (dir) openIn(dir);
}

function setFocused(id) {
  if (focusedId === id) return;
  focusedId = id;
  for (const [pid, p] of pens) {
    p.el.classList.toggle('focused', pid === id);
    p.headerEl.classList.toggle('focused', pid === id);
  }
  const pen = pens.get(id);
  if (pen && document.hasFocus()) clearAttention(pen);
}

function markAttention(pen) {
  pen.attention = true;
  pen.el.classList.add('attention');
  pen.headerEl.classList.add('attention');
  if (pen.cardEl && pen.cardEl.isConnected) pen.cardEl.classList.add('attention');
}
function clearAttention(pen) {
  pen.attention = false;
  pen.el.classList.remove('attention');
  pen.headerEl.classList.remove('attention');
  if (pen.cardEl && pen.cardEl.isConnected) pen.cardEl.classList.remove('attention');
}
window.addEventListener('focus', () => {
  const pen = pens.get(focusedId);
  if (pen) clearAttention(pen);
});

function cycleFocus(dir) {
  if (!order.length) return;
  const i = Math.max(0, order.indexOf(focusedId));
  const next = order[(i + dir + order.length) % order.length];
  setFocused(next);
  const pen = pens.get(next);
  requestAnimationFrame(() => {
    pen.term.focus();
    if (prefs.layout === 'compact') pen.el.scrollIntoView({ inline: 'nearest' });
  });
}

/* The field's horizontal scrollbar takes real height, and pens sized with
   height: 100% slide underneath it, hiding the last terminal row. Measure the
   scrollbar and carve it out of the pens' height instead. */
/* Terminals swallow every scroll gesture that lands on them, so sideways
   swipes over a pen never reach the field. Catch them first and drive the
   field's horizontal scroll; vertical scrolling stays with the terminal. */
fieldEl.addEventListener('wheel', (e) => {
  if (prefs.layout !== 'compact') return;
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  fieldEl.scrollLeft += e.deltaX;
  e.preventDefault();
  e.stopPropagation();
}, { capture: true, passive: false });

function syncScrollbarGutter() {
  const gutter = prefs.layout === 'compact' ? Math.max(0, fieldEl.offsetHeight - fieldEl.clientHeight) : 0;
  fieldEl.style.setProperty('--scrollbar-gutter', `${gutter}px`);
}

function refit(pen) {
  syncScrollbarGutter();
  if (!pen.el.parentElement) return;
  /* Size the grid ourselves: the fit addon reads the container's computed
     height, which under border-box sizing still includes our padding, so it
     proposes one row too many and the bottom row draws off-screen. */
  const cs = getComputedStyle(pen.termEl);
  const w = pen.termEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = pen.termEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (w <= 0 || h <= 0) return;
  try {
    const cell = pen.term._core._renderService.dimensions.css.cell;
    if (cell.width && cell.height) {
      const cols = Math.max(2, Math.floor(w / cell.width));
      const rows = Math.max(1, Math.floor(h / cell.height));
      if (cols !== pen.term.cols || rows !== pen.term.rows) pen.term.resize(cols, rows);
    } else {
      pen.fit.fit();
    }
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
  pen.ro.disconnect();
  window.flock.kill(id);
  pen.term.dispose();
  pen.headerEl.remove();
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
    titleEl.title = titleEl.textContent;
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

/* ------------------------------ Dashboard -------------------------------- */

let dashboardZoom = null;
let dashTimer = null;

function makeDashCard(pen) {
  const card = document.createElement('div');
  card.className = 'cell dash-card';
  card.innerHTML = `
    <div class="dash-title"></div>
    <div class="dash-loc"></div>
    <div class="dash-status"></div>`;
  card.classList.toggle('attention', !!pen.attention);
  card.addEventListener('click', () => {
    dashboardZoom = pen.id;
    renderField();
    requestAnimationFrame(() => pen.term.focus());
  });
  card.addEventListener('contextmenu', (e) => { e.preventDefault(); openCtxMenu(pen, e.clientX, e.clientY); });
  pen.cardEl = card;
  return card;
}

function penStatus(pen) {
  if (pen.attention) return 'attention';
  return performance.now() - (pen.lastData || 0) < 1500 ? 'busy' : 'idle';
}

let kanbanCols = null;

function updateDashCards() {
  for (const pen of pens.values()) {
    if (!pen.cardEl || !pen.cardEl.isConnected) continue;
    pen.cardEl.querySelector('.dash-title').textContent = pen.titleEl.textContent;
    pen.cardEl.querySelector('.dash-loc').textContent = pen.locationEl.textContent;
    const st = penStatus(pen);
    const statusEl = pen.cardEl.querySelector('.dash-status');
    statusEl.textContent = st === 'attention' ? 'Needs you' : st === 'busy' ? 'Working…' : 'Idle';
    statusEl.className = `dash-status st-${st}`;
    pen.cardEl.classList.toggle('attention', !!pen.attention);
    // On the board, a status change carries the card to its new column
    if (kanbanCols && pen.cardEl.parentElement !== kanbanCols[st]) {
      const newCard = kanbanCols.idle.querySelector('.dash-new');
      if (st === 'idle' && newCard) kanbanCols.idle.insertBefore(pen.cardEl, newCard);
      else kanbanCols[st].appendChild(pen.cardEl);
    }
  }
}

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
  kanbanCols = null;
  fieldEl.querySelectorAll('.cell').forEach((c) => c.remove());
  for (const pen of pens.values()) if (pen.el.parentElement) pen.el.remove();
  if (addEl.parentElement) addEl.remove();
  if (tabbarEl.parentElement) tabbarEl.remove();
  // Tabs mode borrows the pen headers as its tabs — give them back first
  for (const pen of pens.values()) {
    if (pen.headerEl.parentElement !== pen.el) pen.el.prepend(pen.headerEl);
  }
  fieldEl.classList.toggle('mode-fixed', prefs.layout === 'fixed');
  fieldEl.classList.toggle('mode-tabs', prefs.layout === 'tabs');
  fieldEl.classList.toggle('mode-dash', prefs.layout === 'dashboard');
  if (dashboardZoom && (prefs.layout !== 'dashboard' || !pens.has(dashboardZoom))) dashboardZoom = null;
  fieldEl.classList.toggle('mode-dash-zoom', prefs.layout === 'dashboard' && !!dashboardZoom);
  tabbarEl.classList.toggle('hidden', prefs.layout !== 'tabs');
  fieldEl.style.gridTemplateColumns = prefs.layout === 'fixed' ? `repeat(${prefs.grid.cols}, 1fr)` : '';
  fieldEl.style.gridTemplateRows = prefs.layout === 'fixed' ? `repeat(${prefs.grid.rows}, 1fr)` : '';

  if (prefs.layout === 'compact') {
    for (const id of order) fieldEl.appendChild(pens.get(id).el);
    if (!fieldEl.contains(welcomeEl)) fieldEl.appendChild(welcomeEl);
    welcomeEl.classList.toggle('hidden', order.length > 0);
    if (order.length) fieldEl.appendChild(addEl);
  } else if (prefs.layout === 'tabs') {
    // Pinned tabs first (stable within each group), then everything else
    const tabOrder = [...order].sort((a, b) => (pens.get(b).pinned ? 1 : 0) - (pens.get(a).pinned ? 1 : 0));
    fieldEl.appendChild(tabbarEl);
    for (const id of tabOrder) {
      const pen = pens.get(id);
      pen.headerEl.classList.toggle('pinned', pen.pinned);
      tabbarEl.appendChild(pen.headerEl);
      fieldEl.appendChild(pen.el);
    }
    tabbarEl.appendChild(addEl);
    if (!fieldEl.contains(welcomeEl)) fieldEl.appendChild(welcomeEl);
    welcomeEl.classList.toggle('hidden', order.length > 0);
    if (order.length && (!focusedId || !pens.has(focusedId))) setFocused(order[order.length - 1]);
  } else if (prefs.layout === 'dashboard') {
    for (const id of order) {
      const pen = pens.get(id);
      pen.el.classList.toggle('zoomed', id === dashboardZoom);
      fieldEl.appendChild(pen.el);
    }
    const kanban = prefs.dashView === 'kanban' && !dashboardZoom;
    fieldEl.classList.toggle('kanban', kanban);
    if (dashboardZoom) {
      setFocused(dashboardZoom);
    } else if (order.length) {
      const newCard = document.createElement('div');
      newCard.className = 'cell dash-card dash-new';
      newCard.innerHTML = `
        <button class="topbar-btn dash-new-term" type="button">New</button>
        <button class="topbar-btn secondary dash-new-open" type="button">Open Folder</button>`;
      newCard.querySelector('.dash-new-term').addEventListener('click', () => addPen());
      newCard.querySelector('.dash-new-open').addEventListener('click', () => openFolder());
      if (kanban) {
        kanbanCols = {};
        for (const [st, label] of [['attention', 'Needs you'], ['busy', 'Working'], ['idle', 'Idle']]) {
          const col = document.createElement('div');
          col.className = 'cell kanban-col';
          col.innerHTML = `<div class="kanban-head st-${st}">${label}</div><div class="kanban-cards"></div>`;
          kanbanCols[st] = col.querySelector('.kanban-cards');
          fieldEl.appendChild(col);
        }
        for (const id of order) {
          const pen = pens.get(id);
          kanbanCols[penStatus(pen)].appendChild(makeDashCard(pen));
        }
        kanbanCols.idle.appendChild(newCard);
      } else {
        for (const id of order) fieldEl.appendChild(makeDashCard(pens.get(id)));
        fieldEl.appendChild(newCard);
      }
      const switchEl = document.createElement('div');
      switchEl.className = 'cell dash-switch';
      for (const [view, label] of [['cards', 'Cards'], ['kanban', 'Board']]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.classList.toggle('selected', prefs.dashView === view);
        btn.addEventListener('click', () => { prefs.dashView = view; renderField(); persist(); });
        switchEl.appendChild(btn);
      }
      fieldEl.appendChild(switchEl);
    }
    if (!fieldEl.contains(welcomeEl)) fieldEl.appendChild(welcomeEl);
    welcomeEl.classList.toggle('hidden', order.length > 0);
  } else {
    if (fieldEl.contains(welcomeEl)) welcomeEl.remove();
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
  const dashCardsVisible = prefs.layout === 'dashboard' && !dashboardZoom && order.length > 0;
  if (dashCardsVisible) { updateDashCards(); if (!dashTimer) dashTimer = setInterval(updateDashCards, 700); }
  else if (dashTimer) { clearInterval(dashTimer); dashTimer = null; }
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
  const pinBtn = ctxMenu.querySelector('[data-act="pin"]');
  pinBtn.classList.toggle('hidden', prefs.layout !== 'tabs');
  pinBtn.textContent = pen.pinned ? 'Unpin' : 'Pin';
  ctxMenu.querySelector('[data-act="shade"]').textContent = pen.shaded ? 'Look Back' : 'Look Away';
  ctxMenu.querySelector('[data-act="mute"]').textContent = pen.muted ? 'Alert Me' : "Don't Alert Me";
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
  else if (act === 'pin') { pen.pinned = !pen.pinned; renderField(); }
  else if (act === 'shade') setShaded(pen, !pen.shaded);
  else if (act === 'mute') { pen.muted = !pen.muted; if (pen.muted) clearAttention(pen); }
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

function renderRecents() {
  addRecentsEl.querySelectorAll('button').forEach((b) => b.remove());
  addRecentsEl.classList.toggle('hidden', prefs.recentFolders.length === 0);
  for (const dir of prefs.recentFolders) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-recent';
    const name = document.createElement('span');
    name.textContent = dir.split('/').filter(Boolean).pop() || dir;
    const path = document.createElement('span');
    path.className = 'recent-path';
    path.textContent = dir.replace(/^\/Users\/[^/]+/, '~');
    btn.append(name, path);
    btn.title = dir;
    btn.addEventListener('click', () => { addMenu.classList.add('hidden'); openIn(dir); });
    addRecentsEl.appendChild(btn);
  }
}

addBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderRecents();
  addMenu.classList.toggle('hidden');
  // Near the right edge the menu would run off screen — open it leftwards
  if (!addMenu.classList.contains('hidden')) {
    addMenu.classList.remove('flip');
    addMenu.classList.toggle('flip', addMenu.getBoundingClientRect().right > window.innerWidth - 8);
  }
});
addNewBtn.addEventListener('click', () => { addMenu.classList.add('hidden'); addPen(); });
addOpenBtn.addEventListener('click', () => { addMenu.classList.add('hidden'); openFolder(); });
document.addEventListener('click', (e) => { if (!addEl.contains(e.target)) addMenu.classList.add('hidden'); });

welcomeNewBtn.addEventListener('click', () => addPen());
welcomeOpenBtn.addEventListener('click', () => openFolder());

/* Focus mode: terminals that are mid-task (still streaming output) blur away;
   the ones sitting quiet or asking for approval stay crisp. */
let focusTimer = null;
function updateBusy() {
  const now = performance.now();
  for (const [pid, p] of pens) {
    const busy = !p.attention && pid !== focusedId && now - (p.lastData || 0) < 1500;
    p.el.classList.toggle('busy', busy);
    p.headerEl.classList.toggle('busy', busy);
  }
}
window.flock.onFocusMode((on) => {
  document.body.classList.toggle('focus-mode', on);
  if (focusTimer) { clearInterval(focusTimer); focusTimer = null; }
  if (on) { updateBusy(); focusTimer = setInterval(updateBusy, 500); }
  else for (const p of pens.values()) { p.el.classList.remove('busy'); p.headerEl.classList.remove('busy'); }
});

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
  // Fonts that were offered briefly and withdrawn
  if (prefs.fontFamily === '"DM Sans"' || prefs.fontFamily === '"Inter"') prefs.fontFamily = '"JetBrains Mono"';
  if (!Array.isArray(prefs.recentFolders)) prefs.recentFolders = [];
  prefs.lineHeight = Math.min(2, Math.max(1, Number(prefs.lineHeight) || 1));
  if (prefs.dashView !== 'kanban') prefs.dashView = 'cards';
}

// Changes from the Preferences window and hand-edits to the config file
// (Flock → Edit Config File…) both arrive here and apply live
window.flock.onPrefsChanged((saved) => {
  const prevLayout = prefs.layout;
  applyPrefs(saved);
  if (prefs.layout !== prevLayout) {
    dashboardZoom = null;
    if (prefs.layout === 'fixed') {
      // Grow the grid so no running terminal is left without a cell
      const before = `${prefs.grid.rows}×${prefs.grid.cols}`;
      while (order.length > capacity() && prefs.grid.cols < 5) prefs.grid.cols++;
      while (order.length > capacity() && prefs.grid.rows < 3) prefs.grid.rows++;
      if (`${prefs.grid.rows}×${prefs.grid.cols}` !== before) persist();
    } else {
      for (const pen of pens.values()) pen.el.style.width = `${DEFAULT_WIDTH}px`;
    }
  }
  applyTheme();
  renderField();
  for (const pen of pens.values()) {
    applyActivityVisibility(pen);
    if (!prefs.showActivity) pen.statusEl.textContent = '';
  }
});

window.flock.onFlushPrefs(() => window.flock.savePrefs(prefs));

window.flock.onFullScreen((on) => document.body.classList.toggle('fullscreen', on));

/* TUIs wrap their text by printing real newlines, which survive an ordinary
   copy. This flows the selection into one paragraph for pasting into chat
   or documents. */
window.flock.onCopyPlain(() => {
  const pen = pens.get(focusedId);
  if (!pen) return;
  const sel = pen.term.getSelection();
  if (sel) navigator.clipboard.writeText(sel.replace(/\s*\n\s*/g, ' ').trim());
});

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
  else if (e.metaKey && e.shiftKey && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
    e.preventDefault();
    cycleFocus(e.code === 'BracketRight' ? 1 : -1);
  }
  else if (e.key === 'Escape') {
    if (prefs.layout === 'dashboard' && dashboardZoom) { dashboardZoom = null; renderField(); }
    addMenu.classList.add('hidden');
    closeCtxMenu();
  }
});
window.addEventListener('resize', () => requestAnimationFrame(refitAll));

/* A drop that misses a terminal must never navigate the window away */
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

/* ----------------------------- Update banner ---------------------------- */

const updateBanner = document.getElementById('update-banner');
const updateText = document.getElementById('update-text');
const updateGetBtn = document.getElementById('update-get');
let updateUrl = null;
let updateHideTimer = null;

window.flock.onUpdateAvailable(({ version, url }) => {
  if (updateHideTimer) { clearTimeout(updateHideTimer); updateHideTimer = null; }
  // With a url we can only point at the release page (running from source);
  // without one the packaged app is already downloading it in the background.
  updateUrl = url || null;
  updateText.textContent = url ? `Flock ${version} is available` : `Flock ${version} is downloading`;
  updateGetBtn.textContent = 'Download';
  updateGetBtn.classList.toggle('hidden', !url);
  updateBanner.classList.remove('hidden');
});

window.flock.onUpdateDownloaded(({ version }) => {
  if (updateHideTimer) { clearTimeout(updateHideTimer); updateHideTimer = null; }
  updateUrl = null;
  updateText.textContent = `Flock ${version} is ready to install`;
  updateGetBtn.textContent = 'Restart';
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
  else window.flock.installUpdate();
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
