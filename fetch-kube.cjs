const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400, height: 900, show: false,
    webPreferences: { nodeIntegration: false, webSecurity: true }
  });

  // Navigate to kube.io
  console.log('Loading kube.io...');
  await win.loadURL('https://kube.io/blog/liquid-glass-css-svg/');

  // Wait for React to render (longer wait)
  await new Promise(r => setTimeout(r, 8000));

  // Get the full rendered HTML
  const html = await win.webContents.executeJavaScript(`
    document.documentElement.outerHTML
  `);

  fs.writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-rendered.html',
    html
  );
  console.log('HTML saved:', html.length, 'bytes');

  // Extract all style elements
  const styles = await win.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n/* --- */\n')
  `);
  fs.writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-styles.css',
    styles
  );
  console.log('Styles saved:', styles.length, 'bytes');

  // Extract all inline scripts and their content
  const scripts = await win.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent.substring(0, 5000)).join('\n/* --- */\n')
  `);
  fs.writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-scripts.js',
    scripts
  );
  console.log('Scripts saved:', scripts.length, 'bytes');

  // Take screenshot
  const img = await win.webContents.capturePage();
  fs.writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-screenshot.png',
    img.toPNG()
  );
  console.log('Screenshot saved');

  // Get the main article content
  const article = await win.webContents.executeJavaScript(`
    (() => {
      const main = document.querySelector('main, article, [class*="post"], [class*="blog"]');
      if (!main) return 'NO MAIN FOUND';
      return main.outerHTML.substring(0, 100000);
    })()
  `);
  fs.writeFileSync(
    'C:/Users/STARK/.claude/projects/E--claude-test-file/kube-article.html',
    article
  );
  console.log('Article saved:', article.length, 'bytes');

  app.quit();
});
