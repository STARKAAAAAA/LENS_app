const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 500, show: false,
    webPreferences: { nodeIntegration: false }
  });

  const testHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin:0; background:#111; height:100vh; display:flex; gap:20px; align-items:center; justify-content:center; }
    .panel { width:300px; height:300px; position:relative; border-radius:16px; overflow:hidden; }
    .bg { position:absolute; inset:0;
      background: repeating-conic-gradient(#fff 0% 1%, #222 1% 2%) 50%/50px 50px; }
    .lens { position:absolute; inset:0; border-radius:16px; border:2px solid rgba(255,255,255,0.4);
      background:rgba(255,255,255,0.05); }
    .label { position:absolute; bottom:8px; left:50%; transform:translateX(-50%);
      font:11px monospace; color:#fff; z-index:5; background:rgba(0,0,0,0.7); padding:2px 8px; border-radius:4px; }
  </style></head><body>
  <svg style="position:absolute;width:0;height:0;"><defs>
    <filter id="f-convex" color-interpolation-filters="sRGB">
      <feImage href="MAP_CONVEX" result="dm"/>
      <feDisplacementMap in="SourceGraphic" in2="dm" scale="60" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="f-concave" color-interpolation-filters="sRGB">
      <feImage href="MAP_CONCAVE" result="dm"/>
      <feDisplacementMap in="SourceGraphic" in2="dm" scale="60" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="f-neutral" color-interpolation-filters="sRGB">
      <feImage href="MAP_NEUTRAL" result="dm"/>
      <feDisplacementMap in="SourceGraphic" in2="dm" scale="60" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs></svg>

  <div class="panel"><div class="bg"></div>
    <div class="lens" id="lens-convex" style="backdrop-filter:url(#f-convex);"></div>
    <div class="label">CONVEX (should bend INWARD)</div>
  </div>
  <div class="panel"><div class="bg"></div>
    <div class="lens" id="lens-concave" style="backdrop-filter:url(#f-concave);"></div>
    <div class="label">CONCAVE (should bend OUTWARD)</div>
  </div>
  <div class="panel"><div class="bg"></div>
    <div class="lens" id="lens-neutral" style="backdrop-filter:url(#f-neutral);"></div>
    <div class="label">NEUTRAL (no displacement)</div>
  </div>
  <script>
    function makeDisplacementMap(inward) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(256, 256);
      const d = img.data;
      const cx = 128, cy = 128;
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const i = (y*256+x)*4;
          const px = x - cx, py = y - cy;
          const dist = Math.sqrt(px*px + py*py);
          const t = Math.min(1, Math.max(0, dist / 120));
          
          if (dist < 8 || dist > 125) {
            d[i]=128; d[i+1]=128; d[i+2]=128; d[i+3]=255;
            continue;
          }
          
          // Magnitude: strongest at middle of bezel
          const mag = Math.sin(t * Math.PI) * 0.8;
          // Direction: inward = -radial, outward = +radial
          const dir = inward ? -1 : 1;
          const dx = (px / (dist||1)) * mag * dir;
          const dy = (py / (dist||1)) * mag * dir;
          
          d[i]   = Math.round(128 + dx * 127);
          d[i+1] = Math.round(128 + dy * 127);
          d[i+2] = 128;
          d[i+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    }
    
    function makeNeutralMap() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i+=4) {
        img.data[i]=128; img.data[i+1]=128; img.data[i+2]=128; img.data[i+3]=255;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    }
    
    const defs = document.querySelector('svg defs');
    defs.innerHTML = defs.innerHTML
      .replace('MAP_CONVEX', makeDisplacementMap(true))
      .replace('MAP_CONCAVE', makeDisplacementMap(false))
      .replace('MAP_NEUTRAL', makeNeutralMap());
    
    console.log('Maps set');
  </script></body></html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHTML));
  await new Promise(r => setTimeout(r, 4000));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('C:/Users/STARK/.claude/projects/E--claude-test-file/direction-test.png', img.toPNG());
  
  // Check pixel data at edges
  const pixelInfo = await win.webContents.executeJavaScript(`
    (() => {
      const lenses = ['lens-convex', 'lens-concave', 'lens-neutral'];
      return lenses.map(id => {
        const el = document.getElementById(id);
        return { id, w: el.offsetWidth, h: el.offsetHeight, bf: getComputedStyle(el).backdropFilter };
      });
    })()
  `);
  console.log('Pixel info:', JSON.stringify(pixelInfo, null, 2));
  console.log('Screenshot saved');

  app.quit();
});
