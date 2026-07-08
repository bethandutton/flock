const { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu, net, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const pty = require('node-pty');

app.setName('Flock');

const defaultShell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'zsh');
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const prefsPath = path.join(app.getPath('userData'), 'prefs.json');

// The flock: one pty per pen, keyed by the renderer's pen id.
const pens = new Map();
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Flock',
    icon: iconPath,
    width: 1000,
    height: 680,
    minWidth: 480,
    minHeight: 320,
    // The click that activates the window also lands in the terminal under
    // the cursor, instead of needing a second click.
    acceptFirstMouse: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('page-title-updated', (e) => e.preventDefault());
  mainWindow.on('closed', () => {
    for (const term of pens.values()) term.kill();
    pens.clear();
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Flock',
      submenu: [
        { role: 'about' },
        {
          label: 'Check for Updates…',
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow && mainWindow.webContents.send('open-preferences'),
        },
        {
          label: 'Edit Config File…',
          click: () => {
            // Ask the renderer to write the full current config first, so the
            // file always opens complete and self-documenting.
            if (mainWindow) mainWindow.webContents.send('flush-prefs');
            setTimeout(() => shell.openPath(prefsPath), 250);
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' },
        {
          label: 'Copy Without Line Breaks',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => mainWindow && mainWindow.webContents.send('copy-plain'),
        },
        { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Focus Mode',
          type: 'checkbox',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: (item) => mainWindow && mainWindow.webContents.send('focus-mode', item.checked),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------- Prefs ---------------------------------- */

ipcMain.handle('get-prefs', () => {
  try {
    return JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
  } catch (_) {
    return null;
  }
});

let lastSavedPrefs = null;

ipcMain.on('save-prefs', (event, data) => {
  try {
    lastSavedPrefs = JSON.stringify(data, null, 2);
    fs.writeFileSync(prefsPath, lastSavedPrefs);
  } catch (_) {
    // best-effort; ignore write failures
  }
});

/* Hand-edits to prefs.json apply live. Writes the app itself makes are
   remembered and skipped, so saving from the UI doesn't echo back. */
function watchPrefsFile() {
  let timer = null;
  try {
    fs.watch(path.dirname(prefsPath), (_eventType, filename) => {
      if (filename !== path.basename(prefsPath) || !mainWindow) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const raw = fs.readFileSync(prefsPath, 'utf8');
          if (raw === lastSavedPrefs) return;
          lastSavedPrefs = raw;
          mainWindow.webContents.send('prefs-changed', JSON.parse(raw));
        } catch (_) {
          // mid-edit or invalid JSON — wait for the next save
        }
      }, 150);
    });
  } catch (_) {
    // watching is a nicety; the file still loads on next launch
  }
}

/* ----------------------------- Terminals -------------------------------- */

ipcMain.handle('pty-create', (event, { id, cols, rows, cwd }) => {
  const term = pty.spawn(defaultShell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Flock' },
  });

  const sender = event.sender;
  term.onData((data) => { if (!sender.isDestroyed()) sender.send('pty-data', { id, data }); });
  term.onExit(() => {
    if (!sender.isDestroyed()) sender.send('pty-exit', { id });
    pens.delete(id);
  });

  pens.set(id, term);
  setTimeout(sampleLocations, 250);
  return { id };
});

ipcMain.on('pty-input', (event, { id, data }) => {
  const term = pens.get(id);
  if (term) term.write(data);
});

ipcMain.on('pty-resize', (event, { id, cols, rows }) => {
  const term = pens.get(id);
  if (term) {
    try { term.resize(cols, rows); } catch (_) { /* hidden pane */ }
  }
});

ipcMain.on('pty-kill', (event, { id }) => {
  const term = pens.get(id);
  if (term) { term.kill(); pens.delete(id); }
});

ipcMain.on('beep', () => shell.beep());

ipcMain.on('focus-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('pick-directory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

/* --------------------------- Activity sampler --------------------------- */

function sampleStats() {
  if (!mainWindow || pens.size === 0) return;
  exec('ps -A -o pid=,ppid=,pcpu=,rss=', { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
    if (err || !mainWindow) return;
    const info = new Map();
    const children = new Map();
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const pid = +parts[0], ppid = +parts[1], cpu = parseFloat(parts[2]), rss = parseInt(parts[3], 10);
      info.set(pid, { cpu, rss });
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(pid);
    }
    for (const [id, term] of pens) {
      let cpu = 0, rss = 0;
      const seen = new Set();
      const stack = [term.pid];
      while (stack.length) {
        const p = stack.pop();
        if (seen.has(p)) continue;
        seen.add(p);
        const rec = info.get(p);
        if (rec) { cpu += rec.cpu; rss += rec.rss; }
        (children.get(p) || []).forEach((c) => stack.push(c));
      }
      mainWindow.webContents.send('pty-stats', { id, cpu: Math.round(cpu), mem: Math.round(rss / 1024) });
    }
  });
}

/* ---------------------------- Location sampler --------------------------- */

/* Reads the branch straight from .git/HEAD (walking up to the repo root, and
   following worktree pointer files) so no git process is spawned per tick. */
function gitBranch(dir) {
  try {
    let d = dir;
    while (d && d !== path.dirname(d)) {
      const dotGit = path.join(d, '.git');
      if (fs.existsSync(dotGit)) {
        let gitDir = dotGit;
        if (fs.statSync(dotGit).isFile()) {
          const m = fs.readFileSync(dotGit, 'utf8').match(/^gitdir: (.+)$/m);
          if (!m) return null;
          gitDir = path.resolve(d, m[1].trim());
        }
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        const ref = head.match(/^ref: refs\/heads\/(.+)$/);
        // Detached HEAD (e.g. a worktree parked on origin/main) has no branch,
        // only a commit — say so rather than showing a bare hash.
        return ref ? ref[1] : `${head.slice(0, 7)} (no branch)`;
      }
      d = path.dirname(d);
    }
  } catch (_) { /* not a repo, or unreadable */ }
  return null;
}

function tildify(dir) {
  const home = os.homedir();
  return dir === home || dir.startsWith(home + path.sep) ? '~' + dir.slice(home.length) : dir;
}

function sampleLocations() {
  if (!mainWindow || pens.size === 0) return;
  const pidToId = new Map();
  for (const [id, term] of pens) pidToId.set(term.pid, id);
  // lsof exits non-zero when any pid has already gone; the stdout that did
  // arrive is still valid, so ignore err and parse what we got.
  exec(`lsof -a -p ${[...pidToId.keys()].join(',')} -d cwd -Fpn`, (err, stdout) => {
    if (!mainWindow || !stdout) return;
    let pid = null;
    for (const line of stdout.split('\n')) {
      if (line[0] === 'p') pid = +line.slice(1);
      else if (line[0] === 'n' && pid !== null) {
        const id = pidToId.get(pid);
        if (!id) continue;
        const dir = line.slice(1);
        mainWindow.webContents.send('pty-location', { id, dir: tildify(dir), branch: gitBranch(dir) });
      }
    }
  });
}

/* ------------------------------- Updates -------------------------------- */

const UPDATE_REPO = 'bethandutton/flock';
let manualCheck = false;

function isNewer(a, b) {
  const x = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const y = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

/* New versions download in the background and install only when the user
   clicks Restart, or on a normal quit. Nothing is forced mid-session. */
function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    manualCheck = false;
    if (mainWindow) mainWindow.webContents.send('update-available', { version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    if (manualCheck && mainWindow) mainWindow.webContents.send('update-none', { version: app.getVersion() });
    manualCheck = false;
  });
  autoUpdater.on('error', () => {
    if (manualCheck && mainWindow) mainWindow.webContents.send('update-none', { version: app.getVersion(), offline: true });
    manualCheck = false;
  });
}

/* Automatic checks stay silent unless there's news; a manual check (from the
   menu) always answers, even when already up to date or offline. */
async function checkForUpdates(manual = false) {
  if (!mainWindow) return;
  if (app.isPackaged) {
    manualCheck = manual;
    autoUpdater.checkForUpdates().catch(() => { /* the error event answers */ });
    return;
  }
  // Running from source: fall back to comparing against the latest release
  try {
    const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const release = await res.json();
    if (release.tag_name && isNewer(release.tag_name, app.getVersion())) {
      mainWindow.webContents.send('update-available', {
        version: release.tag_name.replace(/^v/, ''),
        url: release.html_url,
      });
    } else if (manual) {
      mainWindow.webContents.send('update-none', { version: app.getVersion() });
    }
  } catch (_) {
    // offline or rate-limited — the next automatic interval will retry
    if (manual && mainWindow) mainWindow.webContents.send('update-none', { version: app.getVersion(), offline: true });
  }
}

ipcMain.on('install-update', () => {
  if (app.isPackaged) autoUpdater.quitAndInstall();
});

ipcMain.on('open-update', (event, url) => {
  if (typeof url === 'string' && url.startsWith(`https://github.com/${UPDATE_REPO}/`)) {
    shell.openExternal(url);
  }
});

/* -------------------------------- Boot ---------------------------------- */

app.whenReady().then(() => {
  if (app.dock) {
    const dockIcon = nativeImage.createFromPath(iconPath);
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
  }
  buildMenu();
  createWindow();
  watchPrefsFile();
  setupAutoUpdater();
  setInterval(sampleStats, 2000);
  setInterval(sampleLocations, 2000);
  setTimeout(checkForUpdates, 5000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
