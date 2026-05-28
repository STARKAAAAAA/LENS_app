/* ═══════════════════════════════════════════════════════
   液态玻璃面板 — 共享透镜位移图 + 逐面板参数独立
   滤镜和位移图由 lg-studio.js 统一管理
   ═══════════════════════════════════════════════════════ */

import { initAdaptiveGlass, stopAdaptiveGlass } from './adaptive-glass.js';

let _active = false;

/* 面板类型定义 */
// refW/refH/refR: 面板参考尺寸，透镜切换目标时同步变换
export const PANEL_DEFS = [
  { id: 'sidebar',     label: '侧边栏',       sel: '.sidebar',                                   refW: 240, refH: 700, refR: 18 },
  { id: 'toolbar',     label: '工具栏',       sel: '.toolbar',                                   refW: 800, refH: 44,  refR: 10 },
  { id: 'titlebar',    label: '标题栏',       sel: '.titlebar__controls',                        refW: 120, refH: 32,  refR: 10 },
  { id: 'settings',    label: '设置面板',     sel: '.settings-panel',                            refW: 500, refH: 400, refR: 10 },
  { id: 'shortcuts',   label: '快捷键面板',   sel: '.shortcuts-panel',                           refW: 450, refH: 400, refR: 10 },
  { id: 'lightbox',    label: '灯箱按钮',     sel: '.lightbox__close,.lightbox__prev,.lightbox__next', refW: 40, refH: 40, refR: 10 },
  { id: 'exif',        label: 'EXIF面板',     sel: '.lightbox__exif',                             refW: 320, refH: 100, refR: 10 },
  { id: 'gallerynav',  label: '画廊导航',     sel: '.gallery__nav',                              refW: 800, refH: 50,  refR: 10 },
  { id: 'backtotop',   label: '返回顶部',     sel: '.back-to-top',                               refW: 42,  refH: 42,  refR: 21 },
  { id: 'heroscroll',  label: '滚动提示',     sel: '.hero__scroll',                              refW: 30,  refH: 52,  refR: 15 },
  { id: 'dropdown-trigger', label: '下拉按钮', sel: '.custom-dropdown__trigger', refW: 130, refH: 34, refR: 17 },
  { id: 'dropdown-menu',  label: '下拉菜单', sel: '.custom-dropdown__menu',    refW: 160, refH: 150, refR: 6 },
  { id: 'loadmore',    label: '加载更多',     sel: '.load-more-btn',                              refW: 200, refH: 44, refR: 22 },
];

/* 逐面板默认参数 — 共用同一个位移图，只调 blur/saturate/refraction */
const _defaults = { blur: 4, saturate: 1.2, refraction: 50, depth: 5, brightness: 0.7, bgAlpha: 0.04, borderAlpha: 0.15, highlight: 0.06, shadowAlpha: 0.3 };
const _panelState = {};

// 逐面板完整参数覆盖（从透镜调试得到的最佳值）
// W/H/R/Depth 决定位移图生成，blur/saturate/refraction 决定 CSS
const _panelOverrides = {
  toolbar:   { w: 800, h: 44, r: 10,  depth: 2,  blur: 3, saturate: 1.15, refraction: 150 },
  sidebar:   { w: 240, h: 0, r: 18, depth: 5,  blur: 3, saturate: 1.15, refraction: 150 },
  titlebar:  { w: 120, h: 32, r: 10,  depth: 2,  blur: 3, saturate: 1.15, refraction: 150 },
  settings:  { w: 500, h: 400, r: 10, depth: 7,  blur: 3, saturate: 1.15, refraction: 100 },
  shortcuts: { w: 450, h: 400, r: 10, depth: 7,  blur: 3, saturate: 1.15, refraction: 100 },
  lightbox:  { w: 40, h: 40, r: 20, depth: 2,  blur: 3, saturate: 1.15, refraction: 150 },
  backtotop: { w: 42, h: 42, r: 21, depth: 2,  blur: 3, saturate: 1.15, refraction: 150 },
  heroscroll:{ w: 30, h: 52, r: 15, depth: 3,  blur: 3, saturate: 1.15, refraction: 50 },
  gallerynav:{ w: 800, h: 50, r: 10,  depth: 3,  blur: 3, saturate: 1.15, refraction: 100 },
  exif:      {                           depth: 4,  blur: 3, saturate: 1.15, refraction: 100 },
  devpanel:  { w: 380, h: 600, r: 14, depth: 5,  blur: 3, saturate: 1.15, refraction: 100 },
  'dropdown-trigger': { w: 130, h: 34, r: 17, depth: 2, blur: 3, saturate: 1.15, refraction: 100 },
  'dropdown-menu':    { w: 160, h: 150, r: 6, depth: 3, blur: 3, saturate: 1.15, refraction: 100 },
  loadmore:           { w: 200, h: 44, r: 22, depth: 2, blur: 3, saturate: 1.15, refraction: 100 },
};

function _init() {
  PANEL_DEFS.forEach(p => {
    if (!_panelState[p.id]) _panelState[p.id] = { ..._defaults, ...(_panelOverrides[p.id] || {}) };
  });
}

/* ── 公开 API ── */

let _resizeTimer = null;
let _domObserver = null;
let _domObserverTimer = null;

function _onResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    Object.keys(_mapCache).forEach(k => delete _mapCache[k]);
    applyAllPanelStyles();
  }, 300);
}

function _onDOMMutation() {
  clearTimeout(_domObserverTimer);
  _domObserverTimer = setTimeout(() => {
    applyAllPanelStyles();
  }, 200);
}

export function enableLiquidGlassPanels() {
  if (_active) return;
  _active = true;
  _init();
  window.addEventListener('resize', _onResize);
  // DOM 变化时自动重试（元素延迟出现也能应用样式）
  if (!_domObserver) {
    _domObserver = new MutationObserver(() => _onDOMMutation());
    _domObserver.observe(document.body, { childList: true, subtree: true });
  }
  // 如果透镜 SVG 不存在，创建独立的面板滤镜
  if (!document.getElementById('__lg_studio_svg') && !document.getElementById('__lg_panel_svg')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none;');
    svg.id = '__lg_panel_svg';
    // 生成一张默认方形位移图
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(400, 400);
    const d = img.data;
    const ss = t => t * t * (3 - 2 * t);
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 400; x++) {
        const ex = x - 200, ey = y - 200;
        const i = (y * 400 + x) * 4;
        const nx = (ex / 200) * 0.5 + 0.5;
        const gradR = (1 - nx) * 255;
        const ny = (ey / 200) * 0.5 + 0.5;
        const gradG = (1 - ny) * 255;
        const cutSdf = (() => {
          const dx = Math.abs(ex) - 190 + 31, dy = Math.abs(ey) - 190 + 31;
          return Math.sqrt(Math.max(dx,0)**2+Math.max(dy,0)**2)+Math.min(Math.max(dx,dy),0)-31;
        })();
        const cutMask = ss(Math.max(0, Math.min(1, (-cutSdf + 5) / 10)));
        d[i]=Math.max(0,Math.min(255,gradR*(1-cutMask)+128*cutMask));
        d[i+1]=Math.max(0,Math.min(255,gradG*(1-cutMask)+128*cutMask));
        d[i+2]=128;d[i+3]=255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const mapURL = canvas.toDataURL();
    svg.innerHTML = PANEL_DEFS.map(p => {
      const s = _panelState[p.id] || _defaults;
      const m = Math.max(100, Math.ceil(s.refraction * 2));
      return `<filter id="lg-panel-refract-${p.id}" x="-${m}%" y="-${m}%" width="${100+m*2}%" height="${100+m*2}%" color-interpolation-filters="sRGB">` +
        `<feImage x="0" y="0" width="100%" height="100%" href="${mapURL}" result="DMAP" preserveAspectRatio="none"/>` +
        `<feGaussianBlur in="DMAP" stdDeviation="3" result="DMAP_SM"/>` +
        `<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="BG_BLUR"/>` +
        `<feDisplacementMap in="BG_BLUR" in2="DMAP_SM" scale="${s.refraction}" xChannelSelector="R" yChannelSelector="G"/>` +
      `</filter>`;
    }).join('');
    document.body.appendChild(svg);
  }
  const root = document.documentElement.style;
  if (!root.getPropertyValue('--lg-panel-blur')) root.setProperty('--lg-panel-blur', '6px');
  if (!root.getPropertyValue('--lg-panel-saturate')) root.setProperty('--lg-panel-saturate', '1.15');
  if (!root.getPropertyValue('--lg-panel-border-alpha')) root.setProperty('--lg-panel-border-alpha', '0.10');
  if (!root.getPropertyValue('--lg-panel-shadow-alpha')) root.setProperty('--lg-panel-shadow-alpha', '0.3');
  if (!root.getPropertyValue('--lg-panel-bg-alpha')) root.setProperty('--lg-panel-bg-alpha', '0');
  if (!root.getPropertyValue('--lg-panel-highlight')) root.setProperty('--lg-panel-highlight', '0.05');
  applyAllPanelStyles();
  initAdaptiveGlass();

  // 强制下拉元素玻璃样式（优先级最高，确保与画廊导航一致）
  const ddStyle = document.createElement('style');
  ddStyle.id = '__lg_dropdown_glass';
  ddStyle.textContent = `.custom-dropdown__trigger,.custom-dropdown__menu{background:rgba(255,255,255,0.04)!important;backdrop-filter:blur(6px) brightness(0.7) saturate(1.15)!important;-webkit-backdrop-filter:blur(6px) brightness(0.7) saturate(1.15)!important;border:0.5px solid rgba(255,255,255,0.12)!important;box-shadow:0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.06)!important;}`;
  document.head.appendChild(ddStyle);
}

export function disableLiquidGlassPanels() {
  _active = false;
  stopAdaptiveGlass();
  window.removeEventListener('resize', _onResize);
  clearTimeout(_resizeTimer);
  clearTimeout(_domObserverTimer);
  if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }
  // 清除下拉玻璃专用样式表
  const ddStyle = document.getElementById('__lg_dropdown_glass');
  if (ddStyle) ddStyle.remove();
  // 清除面板内联 backdrop-filter
  PANEL_DEFS.forEach(p => {
    document.querySelectorAll(p.sel).forEach(el => {
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('-webkit-backdrop-filter');
      el.style.removeProperty('--lg-brightness');
      el.style.removeProperty('--lg-bg-alpha');
    });
  });
}

export function isLiquidGlassPanelsActive() { return _active; }

export function getPanelState(id) { _init(); return { ...(_panelState[id] || _defaults) }; }
export function getPanelMapURL(id) {
  if (id && _mapCache[id]) return _mapCache[id].url;
  return null;
}

export function setPanelBlur(id, v)       { _init(); if (_panelState[id]) { _panelState[id].blur = v; _apply(id); } }
export function setPanelSaturate(id, v)   { _init(); if (_panelState[id]) { _panelState[id].saturate = v; _apply(id); } }
export function setPanelBrightness(id, v) { _init(); if (_panelState[id]) { _panelState[id].brightness = v; _apply(id); } }
export function setPanelBgAlpha(id, v)    { _init(); if (_panelState[id]) { _panelState[id].bgAlpha = v; _apply(id); } }
export function setPanelBorderAlpha(id, v){ _init(); if (_panelState[id]) { _panelState[id].borderAlpha = v; _apply(id); } }
export function setPanelHighlight(id, v)   { _init(); if (_panelState[id]) { _panelState[id].highlight = v; _apply(id); } }
export function setPanelShadowAlpha(id, v) { _init(); if (_panelState[id]) { _panelState[id].shadowAlpha = v; _apply(id); } }
export function setPanelRefraction(id, v) {
  _init();
  if (!_panelState[id]) return;
  _panelState[id].refraction = v;
  _apply(id); // _apply 内部已处理滤镜 scale 更新
}
export function setPanelDepth(id, v) {
  _init();
  if (!_panelState[id]) return;
  _panelState[id].depth = v;
  // 清除缓存让下次 _apply 以新 depth 重建位移图
  delete _mapCache[id];
  _apply(id);
}

export function setAllPanelParams(id, blur, saturate, refraction) {
  _init();
  if (!_panelState[id]) return;
  _panelState[id].blur = blur;
  _panelState[id].saturate = saturate;
  _panelState[id].refraction = refraction;
  _apply(id);
}

function _sdBox(px, py, hw, hh, r) {
  const dx = Math.abs(px) - hw + r, dy = Math.abs(py) - hh + r;
  return Math.sqrt(Math.max(dx,0)**2+Math.max(dy,0)**2)+Math.min(Math.max(dx,dy),0)-r;
}

function _sdCircle(px, py, radius) {
  return Math.sqrt(px * px + py * py) - radius;
}

// 为面板生成精确尺寸的位移图
// isCircle: 用真正的圆形 SDF 而非圆角矩形
function _genMap(w, h, r, depth, isCircle) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const ss = t => t*t*(3-2*t), hw = w/2, hh = h/2;
  const gsx = Math.ceil((r/w)*15)/100, gex = 1-gsx;
  const gsy = Math.ceil((r/h)*15)/100, gey = 1-gsy;
  const cutR = isCircle ? Math.max(0, Math.min(w, h) / 2 - depth) : Math.max(0, r - depth);
  const cutHw = isCircle ? 0 : (w - 2 * depth) / 2;
  const cutHh = isCircle ? 0 : (h - 2 * depth) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = x - hw, ey = y - hh, i = (y*w+x)*4;
      const nx = (ex/hw)*0.5+0.5;
      const tx = Math.max(0,Math.min(1,(nx-gsx)/(gex-gsx||0.01)));
      const gradR = (1-tx)*255;
      const ny = (ey/hh)*0.5+0.5;
      const ty = Math.max(0,Math.min(1,(ny-gsy)/(gey-gsy||0.01)));
      const gradG = (1-ty)*255;
      const cutSdf = isCircle ? _sdCircle(ex, ey, cutR) : _sdBox(ex, ey, cutHw, cutHh, cutR);
      const cutMask = ss(Math.max(0,Math.min(1,(-cutSdf+depth)/(depth*2||1))));
      d[i]=Math.max(0,Math.min(255,gradR*(1-cutMask)+128*cutMask));
      d[i+1]=Math.max(0,Math.min(255,gradG*(1-cutMask)+128*cutMask));
      d[i+2]=128;d[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  return c.toDataURL();
}

const _mapCache = {};

function _apply(id) {
  const def = PANEL_DEFS.find(p => p.id === id);
  if (!def) return;
  const s = _panelState[id];
  if (!s) return;

  const ov = _panelOverrides[id] || {};
  const isCircle = id === 'lightbox' || id === 'backtotop';
  const isCapsule = id === 'toolbar' || id === 'heroscroll' || id === 'loadmore' || id === 'dropdown-trigger';

  let svg = document.getElementById('__lg_panel_svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none;');
    svg.id = '__lg_panel_svg';
    document.body.appendChild(svg);
  }
  if (!svg.querySelector('#lg-panel-refract')) {
    const fallbackMap = _genMap(400, 400, 18, 5, false);
    const fbFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    fbFilter.id = 'lg-panel-refract';
    fbFilter.setAttribute('color-interpolation-filters', 'sRGB');
    fbFilter.setAttribute('x', '-200%'); fbFilter.setAttribute('y', '-200%');
    fbFilter.setAttribute('width', '500%'); fbFilter.setAttribute('height', '500%');
    fbFilter.innerHTML =
      `<feImage x="0" y="0" width="400" height="400" href="${fallbackMap}" result="DMAP"/>` +
      `<feGaussianBlur in="DMAP" stdDeviation="3" result="DMAP_SM"/>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="BG_BLUR"/>` +
      `<feDisplacementMap in="BG_BLUR" in2="DMAP_SM" scale="100" xChannelSelector="R" yChannelSelector="G"/>`;
    svg.appendChild(fbFilter);
  }

  // 为每个匹配元素单独生成位移图（保证不同尺寸元素各有正确滤镜）
  const els = document.querySelectorAll(def.sel);
  els.forEach((el, idx) => {
    // 隐藏元素临时显示以测量真实尺寸
    const wasHidden = el.offsetWidth === 0 && el.offsetHeight === 0;
    if (wasHidden) {
      el.style.position = 'fixed'; el.style.left = '-9999px'; el.style.top = '-9999px';
      el.style.display = 'block'; el.style.visibility = 'visible';
      el.style.opacity = '1'; el.style.pointerEvents = 'auto';
      void el.offsetHeight;
    }
    let mw = el.offsetWidth || ov.w || 240;
    let mh = el.offsetHeight || ov.h || 240;
    let mr;
    if (isCircle) { mr = Math.floor(Math.min(mw, mh) / 2); }
    else if (isCapsule) { mr = Math.floor(Math.min(mw, mh) / 2); }
    else { mr = ov.r || 18; }
    if (wasHidden) {
      el.style.position = ''; el.style.left = ''; el.style.top = '';
      el.style.display = ''; el.style.visibility = '';
      el.style.opacity = ''; el.style.pointerEvents = '';
    }

    const md = s.depth || 5;
    const filterId = els.length > 1 ? `lg-panel-refract-${id}-${idx}` : `lg-panel-refract-${id}`;
    const mapKey = `${mw}-${mh}-${mr}-${md}-${isCircle ? 'c' : 'r'}`;
    const cacheKey = filterId;
    if (!_mapCache[cacheKey] || _mapCache[cacheKey].key !== mapKey) {
      _mapCache[cacheKey] = { key: mapKey, url: _genMap(mw, mh, mr, md, isCircle) };
    }
    const mapURL = _mapCache[cacheKey].url;
    const m = Math.max(100, Math.ceil(s.refraction * 2));
    let filter = svg.querySelector('#' + filterId);
    if (!filter) {
      filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.id = filterId;
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      svg.appendChild(filter);
    }
    filter.setAttribute('x', '-' + m + '%');
    filter.setAttribute('y', '-' + m + '%');
    filter.setAttribute('width', (100 + m * 2) + '%');
    filter.setAttribute('height', (100 + m * 2) + '%');
    filter.innerHTML =
      `<feImage x="0" y="0" width="${mw}" height="${mh}" href="${mapURL}" result="DMAP"/>` +
      `<feGaussianBlur in="DMAP" stdDeviation="3" result="DMAP_SM"/>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="BG_BLUR"/>` +
      `<feDisplacementMap in="BG_BLUR" in2="DMAP_SM" scale="${s.refraction}" xChannelSelector="R" yChannelSelector="G"/>`;

    // 逐个元素应用独立滤镜
    const filterRef = `url(#${filterId})`;
    const bf = `blur(${(s.blur/2).toFixed(1)}px) ${filterRef} blur(${s.blur.toFixed(1)}px) brightness(var(--lg-brightness,${s.brightness})) saturate(${s.saturate})`;
    el.style.setProperty('backdrop-filter', bf, 'important');
    el.style.setProperty('-webkit-backdrop-filter', bf, 'important');
    el.style.setProperty('background', `rgba(255,255,255,var(--lg-bg-alpha,${s.bgAlpha}))`, 'important');
    el.style.setProperty('border', `1px solid rgba(255,255,255,${s.borderAlpha})`, 'important');
    el.style.setProperty('box-shadow', `0 8px 32px rgba(0,0,0,${s.shadowAlpha}), inset 0 1px 0 rgba(255,255,255,${s.highlight})`, 'important');
  });
}

function _applyStyleOnly(id, def, s) {
  // 保留兼容：外部调用如 updatePanelBlur 时重新应用所有元素
  _apply(id);
}

export function applyAllPanelStyles() {
  _init();
  PANEL_DEFS.forEach(p => _apply(p.id));
}

export function resetPanelState(id) {
  _init();
  // 删除旧状态 → 下次 getPanelState 从 _defaults + _panelOverrides 重建
  delete _panelState[id];
  delete _mapCache[id];
  const s = getPanelState(id);
  _apply(id);
  return s;
}

export function resetAllPanels() {
  PANEL_DEFS.forEach(p => {
    _panelState[p.id] = { ..._defaults };
    _apply(p.id);
  });
}

/* ── 全局 API (兼容旧接口) ── */

export function updatePanelRefraction(v) {
  PANEL_DEFS.forEach(p => { if (_panelState[p.id]) _panelState[p.id].refraction = v; });
  applyAllPanelStyles();
}
export function updatePanelBlur(v)     { document.documentElement.style.setProperty('--lg-panel-blur', v + 'px'); }
export function updatePanelSaturate(v) { document.documentElement.style.setProperty('--lg-panel-saturate', v); }

export function togglePanelDebug() { return false; }
