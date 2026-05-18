import { app, BrowserWindow } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 1200, height: 800, webPreferences: { webSecurity: false } });
  w.loadFile(join(__dirname, 'lg-react-standalone.html'));
});
