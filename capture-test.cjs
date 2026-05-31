const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000, height: 600, show: false,
    webPreferences: { nodeIntegration: false }
  });

  // Create a minimal test HTML
  const testHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: repeating-conic-gradient(#fff 0% 1%, #222 1% 2%) 50%/40px 40px; height: 100vh; display:flex; align-items:center; justify-content:center; }
    .lens { width:200px; height:200px; border-radius:32px; border:2px solid rgba(255,255,255,0.5); background:rgba(255,255,255,0.1); }
  </style></head><body>
    <svg style="position:absolute;width:0;height:0;"><defs>
      <filter id="f1" color-interpolation-filters="sRGB">
        <feImage href="DISPMAP" result="dm"/>
        <feDisplacementMap in="SourceGraphic" in2="dm" scale="40" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs></svg>
    <div class="lens" id="lens" style="backdrop-filter:url(#f1);-webkit-backdrop-filter:url(#f1);"></div>
    <script>
      // Generate a displacement map
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const i = (y*256+x)*4;
          const px = x-128, py = y-128;
          const dist = Math.sqrt(px*px+py*py);
          const t = Math.max(0, Math.min(1, dist/128));
          // Radial displacement outward from center
          const mag = t * 0.6;
          const dx = (px/(dist||1)) * mag;
          const dy = (py/(dist||1)) * mag;
          img.data[i] = Math.round(128 + dx*127);
          img.data[i+1] = Math.round(128 + dy*127);
          img.data[i+2] = 128;
          img.data[i+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const url = c.toDataURL();
      document.querySelector('svg defs').innerHTML = document.querySelector('svg defs').innerHTML.replace('DISPMAP', url);
      console.log('Map set, URL length:', url.length);
    </script></body></html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHTML));
  await new Promise(r => setTimeout(r, 3000));

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const lens = document.getElementById('lens');
      const cs = getComputedStyle(lens);
      return {
        backdropFilter: cs.backdropFilter,
        webkitBackdropFilter: cs.webkitBackdropFilter,
        width: lens.offsetWidth,
        height: lens.offsetHeight
      };
    })()
  `);
  console.log('Result:', JSON.stringify(result, null, 2));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('C:/Users/STARK/.claude/projects/E--claude-test-file/test-feimage.png', img.toPNG());
  console.log('Screenshot saved');

  app.quit();
});
