const { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu, net, shell } = require('electron');
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
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow && mainWindow.webContents.send('open-preferences'),
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
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
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

ipcMain.on('save-prefs', (event, data) => {
  try {
    fs.writeFileSync(prefsPath, JSON.stringify(data, null, 2));
  } catch (_) {
    // best-effort; ignore write failures
  }
});

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

/* ----------------------------- Update check ----------------------------- */

const UPDATE_REPO = 'bethandutton/flock';

function isNewer(a, b) {
  const x = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const y = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

async function checkForUpdates() {
  if (!mainWindow) return;
  try {
    const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`);
    if (!res.ok) return;
    const release = await res.json();
    if (release.tag_name && isNewer(release.tag_name, app.getVersion())) {
      mainWindow.webContents.send('update-available', {
        version: release.tag_name.replace(/^v/, ''),
        url: release.html_url,
      });
    }
  } catch (_) {
    // offline or rate-limited — try again next interval
  }
}

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
  setInterval(sampleStats, 2000);
  setTimeout(checkForUpdates, 5000);
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
