// ═══════════════════════════════════════════════
// LENS — Electron Main Process
// ═══════════════════════════════════════════════

import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import { join, resolve } from 'path';
import { readdir, stat, mkdir, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { generateThumbnails, getCacheInfo, clearCache } from './thumbnail.js';
import { getExifInfo } from './exif.js';
import { registerProtocol } from './protocol.js';

const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    center: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(app.getAppPath(), 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(join(app.getAppPath(), 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// ═══ IPC Handlers ═══

ipcMain.handle('thumbnail:generate', async (_, { paths, cacheDir }) => {
  return generateThumbnails(paths, cacheDir, (event, data) => {
    mainWindow?.webContents.send('thumbnail-progress', data);
  });
});

ipcMain.handle('exif:read', async (_, { path }) => {
  return getExifInfo(path);
});

ipcMain.handle('cache:info', async (_, { cacheDir }) => {
  return getCacheInfo(cacheDir);
});

ipcMain.handle('cache:clear', async (_, { cacheDir }) => {
  return clearCache(cacheDir);
});

ipcMain.handle('dialog:open', async (_, opts) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: opts?.directory ? ['openDirectory'] : ['openFile'],
    filters: opts?.filters || [],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
      isSymlink: e.isSymbolicLink(),
    }));
  } catch {
    return [];
  }
});

ipcMain.handle('fs:stat', async (_, filePath) => {
  const s = await stat(filePath);
  return {
    size: s.size,
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    mtimeMs: s.mtimeMs,
  };
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  return readFile(filePath);
});

ipcMain.handle('path:join', (_, ...segments) => {
  return join(...segments);
});

ipcMain.handle('path:resolve', (_, ...segments) => {
  return resolve(...segments);
});

ipcMain.handle('screen:capture', async () => {
  if (!mainWindow) return null;
  const image = await mainWindow.webContents.capturePage();
  return image.toDataURL();
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggleMaximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

// ═══ App lifecycle ═══

app.whenReady().then(() => {
  registerProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
