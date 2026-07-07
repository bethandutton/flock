const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flock', {
  createTerminal: (id, cols, rows, cwd) => ipcRenderer.invoke('pty-create', { id, cols, rows, cwd }),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  sendInput: (id, data) => ipcRenderer.send('pty-input', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('pty-resize', { id, cols, rows }),
  kill: (id) => ipcRenderer.send('pty-kill', { id }),
  onData: (handler) => ipcRenderer.on('pty-data', (_e, payload) => handler(payload)),
  onExit: (handler) => ipcRenderer.on('pty-exit', (_e, payload) => handler(payload)),
  onStats: (handler) => ipcRenderer.on('pty-stats', (_e, payload) => handler(payload)),
  getPrefs: () => ipcRenderer.invoke('get-prefs'),
  savePrefs: (prefs) => ipcRenderer.send('save-prefs', prefs),
  onOpenPreferences: (handler) => ipcRenderer.on('open-preferences', () => handler()),
});
