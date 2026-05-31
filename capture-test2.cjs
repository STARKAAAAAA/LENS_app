const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000, height: 600, show: false,
    webPreferences: { nodeIntegration: false }
  });

  const testHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: repeating-conic-gradient(#fff 0% 1%, #222 1% 2%) 50%/40px 40px; height: 100vh; display:flex; align-items:center; justify-content:center; }
    .lens { width:200px; height:200px; border-radius:32px; border:2px solid rgba(255,255,255,0.5); background:rgba(255,255,255,0.05); }
  </style></head><body>
    <svg id="svg1" style="position:absolute;width:0;height:0;"><defs id="defs1">
      <filter id="f1" color-interpolation-filters="sRGB">
        <feImage href="PLACEHOLDER" result="dm"/>
        <feDisplacementMap in="SourceGraphic" in2="dm" scale="60" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs></svg>
    <div class="lens" id="lens1" style="backdrop-filter:url(#f1);-webkit-backdrop-filter:url(#f1);"></div>
    <div style="position:fixed;top:0;left:0;color:#fff;font:12px monospace;z-index:9;" id="log"></div>
    <script>
      // Generate displacement map with STRONG values
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const i = (y*256+x)*4;
          const px = x-128, py = y-128;
          const dist = Math.sqrt(px*px+py*py);
          // Strong radial displacement from center outward
          const t = Math.min(1, dist/128);
          const mag = Math.pow(t, 0.5) * 0.8;
          const dx = dist > 1 ? (px/dist) * mag : 0;
          const dy = dist > 1 ? (py/dist) * mag : 0;
          img.data[i] = Math.round(128 + dx*127);
          img.data[i+1] = Math.round(128 + dy*127);
          img.data[i+2] = 128;
          img.data[i+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const url = c.toDataURL();
      document.getElementById('defs1').innerHTML = document.getElementById('defs1').innerHTML.replace('PLACEHOLDER', url);
      
      // Add a visible canvas showing the displacement map next to lens
      const debugCanvas = document.createElement('canvas');
      debugCanvas.width = debugCanvas.height = 200;
      debugCanvas.style.cssText = 'position:fixed;top:10px;right:10px;border:1px solid #fff;z-index:10;';
      document.body.appendChild(debugCanvas);
      const dctx = debugCanvas.getContext('2d');
      dctx.drawImage(c, 0, 0, 200, 200);
      
      document.getElementById('log').textContent = 'Map URL set, len=' + url.length;
    </script></body></html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHTML));
  await new Promise(r => setTimeout(r, 4000));

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const lens = document.getElementById('lens1');
      const cs = getComputedStyle(lens);
      return {
        backdropFilter: cs.backdropFilter,
        log: document.getElementById('log').textContent
      };
    })()
  `);
  console.log('Result:', JSON.stringify(result, null, 2));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('C:/Users/STARK/.claude/projects/E--claude-test-file/test-feimage2.png', img.toPNG());
  console.log('Screenshot saved');

  app.quit();
});
