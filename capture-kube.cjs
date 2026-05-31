// Quick Electron script to screenshot the kube.io page
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: { nodeIntegration: false }
  });

  // First, open the kube.io article and capture its structure
  await win.loadURL('https://kube.io/blog/liquid-glass-css-svg/');

  // Wait for page to render
  await new Promise(r => setTimeout(r, 5000));

  // Extract DOM structure
  const html = await win.webContents.executeJavaScript(`
    document.documentElement.outerHTML
  `);

  // Save
  require('fs').writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-page-snapshot.html',
    html
  );

  // Take screenshot
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-page-screenshot.png',
    img.toPNG()
  );

  console.log('Captured. HTML:', html.length, 'bytes');

  app.quit();
});
