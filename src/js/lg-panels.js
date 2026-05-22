/* ═══════════════════════════════════════════════════════
   液态玻璃面板 — SVG 滤镜 + CSS 变量管理
   CSS 由 colors.js generateFullCSS 输出（检查 window.__lensLiquidGlass）
   ═══════════════════════════════════════════════════════ */

const MAP_SZ = 256;
const SCALE = 150;
let _active = false;

function _createDisplacementMap() {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SZ; canvas.height = MAP_SZ;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(MAP_SZ, MAP_SZ);
  const d = img.data;
  for (let y = 0; y < MAP_SZ; y++) {
    for (let x = 0; x < MAP_SZ; x++) {
      const nx = (x / MAP_SZ - 0.5) * 2;
      const ny = (y / MAP_SZ - 0.5) * 2;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const str = Math.pow(Math.min(1, dist), 3);
      const i = (y * MAP_SZ + x) * 4;
      d[i]     = Math.max(0, Math.min(255, (nx * str * 0.5 + 0.5) * 255));
      d[i + 1] = Math.max(0, Math.min(255, (ny * str * 0.5 + 0.5) * 255));
      d[i + 2] = Math.max(0, Math.min(255, (ny * str * 0.5 + 0.5) * 255));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export function enableLiquidGlassPanels() {
  if (_active) return;
  _active = true;
  if (!document.getElementById('__lg_panel_svg')) {
    const mapUrl = _createDisplacementMap();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none;');
    svg.id = '__lg_panel_svg';
    svg.innerHTML =
      '<filter id="lg-panel-refract" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">' +
        '<feImage href="' + mapUrl + '" result="DMAP" preserveAspectRatio="xMidYMid slice"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="DMAP" scale="' + SCALE + '" xChannelSelector="R" yChannelSelector="B"/>' +
      '</filter>';
    document.body.appendChild(svg);
  }
  const root = document.documentElement.style;
  if (!root.getPropertyValue('--lg-panel-blur')) root.setProperty('--lg-panel-blur', '6px');
  if (!root.getPropertyValue('--lg-panel-saturate')) root.setProperty('--lg-panel-saturate', '1.3');
  if (!root.getPropertyValue('--lg-panel-border-alpha')) root.setProperty('--lg-panel-border-alpha', '0.12');
  if (!root.getPropertyValue('--lg-panel-shadow-alpha')) root.setProperty('--lg-panel-shadow-alpha', '0.3');
  if (!root.getPropertyValue('--lg-panel-bg-alpha')) root.setProperty('--lg-panel-bg-alpha', '0');
  if (!root.getPropertyValue('--lg-panel-highlight')) root.setProperty('--lg-panel-highlight', '0.08');
}

export function disableLiquidGlassPanels() {
  _active = false;
  const svg = document.getElementById('__lg_panel_svg');
  if (svg) svg.remove();
}

export function isLiquidGlassPanelsActive() {
  return _active && !!document.getElementById('__lg_panel_svg');
}

export function updatePanelRefraction(v) {
  const fe = document.querySelector('#__lg_panel_svg feDisplacementMap');
  if (fe) fe.setAttribute('scale', v);
}
export function updatePanelBlur(v) { document.documentElement.style.setProperty('--lg-panel-blur', v + 'px'); }
export function updatePanelSaturate(v) { document.documentElement.style.setProperty('--lg-panel-saturate', v); }
