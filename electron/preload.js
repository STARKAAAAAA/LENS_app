// ═══════════════════════════════════════════════
// LENS — Electron Preload Script (CJS)
// ═══════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Async invoke (mirrors Tauri invoke pattern)
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Event listener (mirrors Tauri listen pattern)
  on: (channel, callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    // Return unlisten function
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // Convert file path to lens:// URL (mirrors Tauri convertFileSrc)
  convertFileSrc: (filePath) => {
    return `lens:///${encodeURIComponent(filePath)}`;
  },

  // Platform info
  platform: process.platform,
});
