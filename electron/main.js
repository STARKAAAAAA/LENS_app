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

// 全屏亮度采样: 返回 step×step 降采样网格的亮度值数组
ipcMain.handle('screen:luma-grid', async (_, step = 30, offsetX = 0, offsetY = 0) => {
  if (!mainWindow) return null;
  try {
    const image = await mainWindow.webContents.capturePage();
    const size = image.getSize();
    const bitmap = image.toBitmap();
    const cols = Math.floor((size.width - offsetX) / step);
    const rows = Math.floor((size.height - offsetY) / step);
    const result = { width: size.width, height: size.height, step, cols, rows, offsetX, offsetY, data: new Array(rows * cols) };
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.min(size.width - 1, offsetX + c * step + Math.floor(step / 2));
          const y = Math.min(size.height - 1, offsetY + r * step + Math.floor(step / 2));
          const off = (y * size.width + x) * 4;
          const b = bitmap[off], g = bitmap[off + 1], r2 = bitmap[off + 2];
        result.data[i++] = 0.2126 * (r2 / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
      }
    }
    return result;
  } catch (e) { return null; }
});

// 单点亮度采样: Apple lumaSubrect 风格，返回 (x,y) CSS 坐标处的 W3C 亮度
ipcMain.handle('screen:luma-at', async (_, x, y, innerW, innerH) => {
  if (!mainWindow) return null;
  try {
    const image = await mainWindow.webContents.capturePage();
    const size = image.getSize();
    const bitmap = image.toBitmap();
    const sx = size.width / innerW;
    const sy = size.height / innerH;
    const px = Math.min(size.width - 1, Math.round(x * sx));
    const py = Math.min(size.height - 1, Math.round(y * sy));
    const off = (py * size.width + px) * 4;
    const b = bitmap[off], g = bitmap[off + 1], r = bitmap[off + 2];
    return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  } catch (e) { return null; }
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
