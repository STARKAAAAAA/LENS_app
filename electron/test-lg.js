// ═══════════════════════════════════════════════
// 液态玻璃测试 — 独立 Electron 窗口
// npm run test:lg  或  npx electron electron/test-lg.js
// ═══════════════════════════════════════════════

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1500,
    height: 900,
    title: '液态玻璃 — feImage + feDisplacementMap 测试',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  win.loadFile(join(__dirname, '..', 'test-lg-ekino.html'));
  win.webContents.openDevTools({ mode: 'bottom' });
});

app.on('window-all-closed', () => app.quit());
