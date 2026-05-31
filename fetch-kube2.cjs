const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400, height: 900, show: false,
    webPreferences: { nodeIntegration: false }
  });

  try {
    console.log('Loading...');
    await win.loadURL('https://kube.io/blog/liquid-glass-css-svg/');
    await new Promise(r => setTimeout(r, 8000));

    // Extract SVG filters (the actual filter definitions being used)
    const svgContent = await win.webContents.executeJavaScript(`
      (() => {
        const svgs = document.querySelectorAll('svg');
        const results = [];
        svgs.forEach((svg, i) => {
          const clone = svg.cloneNode(true);
          results.push({ index: i, html: clone.outerHTML.substring(0, 10000) });
        });
        return JSON.stringify(results);
      })()
    `).catch(() => 'ERROR');
    
    fs.writeFileSync('C:/Users/STARK/.claude/projects/E--claude-test-file/kube-svgs.json', svgContent);
    console.log('SVGs saved');

    // Extract the main article body (HTML structure)
    const articleBody = await win.webContents.executeJavaScript(`
      (() => {
        const article = document.querySelector('article');
        if (!article) return 'NO ARTICLE';
        // Get the full HTML but limit
        return article.outerHTML.substring(0, 200000);
      })()
    `).catch(() => 'ERROR');
    
    fs.writeFileSync('C:/Users/STARK/.claude/projects/E--claude-test-file/kube-article-body.html', articleBody);
    console.log('Article body saved:', articleBody.length, 'bytes');

    // Get computed styles of key elements
    const styles = await win.webContents.executeJavaScript(`
      (() => {
        const body = getComputedStyle(document.body);
        return JSON.stringify({
          bodyBg: body.backgroundColor,
          bodyColor: body.color,
          bodyFont: body.fontFamily,
        });
      })()
    `).catch(() => 'ERROR');
    console.log('Styles:', styles);

    // Screenshot
    const img = await win.webContents.capturePage();
    fs.writeFileSync('C:/Users/STARK/.claude/projects/E--claude-test-file/kube-screenshot2.png', img.toPNG());
    console.log('Screenshot saved');

  } catch(e) {
    console.error('Error:', e.message);
  }

  app.quit();
});
