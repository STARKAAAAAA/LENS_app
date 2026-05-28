/* ═══════════════════════════════════════════════════════
   液态玻璃测试模块 — 可拖动透镜 + 参数面板 + HUD
   Canvas 线性渐变位移图 + SDF挖空
   feImage + feDisplacementMap + backdrop-filter
   关键: color-interpolation-filters="sRGB"
   ═══════════════════════════════════════════════════════ */

import { PANEL_DEFS, getPanelState, resetPanelState, setAllPanelParams, setPanelBlur, setPanelSaturate, setPanelBrightness, setPanelBgAlpha, setPanelBorderAlpha, setPanelHighlight, setPanelShadowAlpha, setPanelRefraction, setPanelDepth, applyAllPanelStyles, getPanelMapURL } from './lg-panels.js';
import { updateAllPanels, setAdaptiveThreshold, setTextTransitionSpeed, setLensTextMode, getLensTextMode, setPanelTextMode, getPanelTextMode, getLensTextColors } from './adaptive-glass.js';

function sdRoundedBox(px, py, hw, hh, r) {
  const dx = Math.abs(px) - hw + r;
  const dy = Math.abs(py) - hh + r;
  return Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2)
       + Math.min(Math.max(dx, dy), 0) - r;
}

function sdCircle(px, py, radius) {
  return Math.sqrt(px * px + py * py) - radius;
}

const HUD_CSS = `
#__lg_hud{position:fixed;top:12px;left:12px;z-index:10001;pointer-events:auto;
  background:rgba(20,20,18,0.92);border:1px solid rgba(200,168,124,0.25);
  border-radius:10px;padding:8px 10px;color:#ccc;font-family:system-ui,sans-serif;
  font-size:11px;line-height:1.45;min-width:150px;backdrop-filter:blur(6px);
  user-select:none;transition:padding 0.2s;}
#__lg_hud.collapsed{padding:6px 10px;min-width:0;}
#__lg_hud .hud-title{color:#c8a87c;font-weight:600;font-size:12px;
  display:flex;justify-content:space-between;align-items:center;gap:4px;
  cursor:grab;padding:2px 0;}
#__lg_hud .hud-title:active{cursor:grabbing;}
#__lg_hud .hud-toggle{background:none;border:none;color:#999;cursor:pointer;
  font-size:10px;padding:0 2px;pointer-events:auto;line-height:1;}
#__lg_hud .hud-toggle:hover{color:#fff;}
#__lg_hud.collapsed .hud-toggle{transform:rotate(-90deg);}
#__lg_hud .hud-label{flex:1;text-align:center;}
#__lg_hud .hud-copy{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
  color:#999;cursor:pointer;font-size:10px;padding:2px 8px;border-radius:4px;pointer-events:auto;}
#__lg_hud .hud-copy:hover{background:rgba(255,255,255,0.12);color:#fff;}
#__lg_hud .hud-copy.copied{background:rgba(200,168,124,0.2);border-color:rgba(200,168,124,0.4);color:#c8a87c;}
#__lg_hud .hud-body{overflow:hidden;transition:max-height 0.25s,opacity 0.2s,margin 0.2s;max-height:400px;opacity:1;}
#__lg_hud.collapsed .hud-body{max-height:0;opacity:0;margin:0;}
#__lg_hud canvas{border-radius:4px;border:1px solid rgba(255,255,255,0.12);
  image-rendering:pixelated;width:100%;margin:3px 0;display:block;}
#__lg_hud .hud-row{display:flex;justify-content:space-between;gap:8px;}
#__lg_hud .hud-row span:last-child{color:#aaa;font-variant-numeric:tabular-nums;user-select:text;}

#__lg_panel{position:fixed;top:50%;right:16px;transform:translateY(-50%);
  z-index:10000;pointer-events:auto;
  background:rgba(20,20,18,0.94);border:1px solid rgba(200,168,124,0.3);
  border-radius:12px;padding:14px 16px;color:#ccc;font-family:system-ui,sans-serif;
  font-size:11px;width:240px;max-height:85vh;overflow-y:auto;
  backdrop-filter:blur(8px);display:none;user-select:none;}
#__lg_panel.open{display:block;}
#__lg_panel .pnl-title{color:#c8a87c;font-weight:600;margin-bottom:10px;font-size:12px;
  display:flex;justify-content:space-between;align-items:center;}
#__lg_panel .pnl-close{background:none;border:1px solid rgba(255,255,255,0.15);color:#999;
  cursor:pointer;font-size:14px;width:22px;height:22px;border-radius:4px;line-height:1;
  pointer-events:auto;}
#__lg_panel .pnl-close:hover{background:rgba(255,255,255,0.1);color:#fff;}
#__lg_panel .pnl-row{display:grid;grid-template-columns:32px 1fr 28px;gap:4px;
  align-items:center;margin-bottom:4px;}
#__lg_panel .pnl-row label{color:#999;text-align:right;font-size:10px;}
#__lg_panel .pnl-row input[type=range]{width:100%;accent-color:#c8a87c;}
#__lg_panel .pnl-row .pnl-val{color:#c8a87c;font-size:10px;text-align:center;
  font-variant-numeric:tabular-nums;}
#__lg_panel .pnl-btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
#__lg_panel .pnl-btns button{flex:1;min-width:50px;
  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
  color:#999;padding:4px 0;border-radius:5px;cursor:pointer;font-size:10px;pointer-events:auto;}
#__lg_panel .pnl-btns button:hover{background:rgba(255,255,255,0.1);color:#fff;}
#__lg_panel .pnl-btns button.on{background:rgba(200,168,124,0.18);
  border-color:rgba(200,168,124,0.4);color:#c8a87c;}
#__lg_panel .pnl-target{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;}
#__lg_panel .pnl-target button{flex:0 0 auto;
  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
  color:#888;cursor:pointer;font-size:9px;padding:3px 7px;border-radius:4px;pointer-events:auto;}
#__lg_panel .pnl-target button:hover{background:rgba(255,255,255,0.08);color:#bbb;}
#__lg_panel .pnl-target button.on{background:rgba(200,168,124,0.18);
  border-color:rgba(200,168,124,0.4);color:#c8a87c;}
#__lg_panel .pnl-sep{width:100%;height:1px;background:rgba(255,255,255,0.06);margin:6px 0;}
`;

export class LiquidGlassStudio {
  constructor(container, opts = {}) {
    this.container = container;
    this._dpr = window.devicePixelRatio || 1;
    this._refraction = 150;
    this._organicScale = 0;
    this._depth = 10;
    this._blur = 2;
    this._ca = 2;
    this._caOn = false;
    this._debug = false;
    this._w = 240; this._h = 240; this._r = 36;
    this._panelOpen = false;
    this._isCircle = false;
    this._prevRectR = this._r;
    this._targetPanel = '_glass'; // '_glass' = 浮动透镜, 其他 = 面板ID
    this._adaptive = true;
    this._adCur = { lum:0.5, brightness:1.0, bgAlpha:0.06 };
    this._adLast = { brightness:0, bgAlpha:0 }; // 去重，避免重复触发 CSS transition
    // 可调阈值: [极暗上限, 暗色上限, 亮色上限]
    this._adThresh = 0.5;
    this._adSpeed = 1; // 过渡动画秒数
    this._setup();
  }

  /* ── 初始化 ── */
  _setup() {
    // 注入样式
    if (!document.getElementById('__lg_studio_style')) {
      const sty = document.createElement('style');
      sty.id = '__lg_studio_style';
      sty.textContent = HUD_CSS;
      document.head.appendChild(sty);
    }

    this._canvas = document.createElement('canvas');
    this._buildMap();

    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none;');
    this._svg.id = '__lg_studio_svg';
    this._buildFilter();
    this.container.appendChild(this._svg);

    // 玻璃透镜
    this._glass = document.createElement('div');
    this._glass.id = 'liquid-glass';
    const cx = window.innerWidth / 2 - this._w / 2;
    const cy = window.innerHeight / 2 - this._h / 2;
    this._glass.style.cssText =
      `position:fixed;top:${cy.toFixed(0)}px;left:${cx.toFixed(0)}px;pointer-events:auto;z-index:9998;width:${this._w}px;height:${this._h}px;border-radius:${this._r}px;cursor:grab;display:flex;align-items:center;justify-content:center;transition:border 0.3s ease,box-shadow 0.3s ease;`;
    this._applyGlassStyle();
    // 透镜内文字
    this._glassText = document.createElement('span');
    this._glassText.style.cssText = `position:relative;z-index:1;font-size:0.9rem;font-weight:500;pointer-events:none;text-align:center;line-height:1.2;color:#fff;opacity:0.85;user-select:none;transition:color ${this._adSpeed}s ease;`;
    this._glassText.textContent = '液玻';
    this._glass.appendChild(this._glassText);
    // tint overlay
    this._glassTint = document.createElement('div');
    this._glassTint.style.cssText = 'position:absolute;inset:0;border-radius:inherit;mix-blend-mode:overlay;pointer-events:none;background:rgba(255,255,255,0.1);';
    this._glass.appendChild(this._glassTint);
    // frost overlay — opacity 过渡在 GPU 合成器线程，丝滑不掉帧
    this._frostOverlay = document.createElement('div');
    this._frostOverlay.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:#fff;opacity:0;transition:opacity ${this._adSpeed}s ease;`;
    this._glass.appendChild(this._frostOverlay);
    // Apple 风格: 单像素采样指示器 (十字准星)
    this._glassSample = document.createElement('div');
    this._glassSample.style.cssText = 'position:absolute;width:6px;height:6px;background:rgba(200,168,124,0.9);pointer-events:none;border-radius:50%;box-shadow:0 0 4px rgba(200,168,124,0.5);z-index:2;';
    this._glass.appendChild(this._glassSample);
    this.container.appendChild(this._glass);

    this._buildHUD();
    this._buildPanel();
    this._setupDrag();
  }

  /* ── Canvas 位移图: 线性渐变 + SDF挖空 ── */
  _buildMap() {
    const w = this._w, h = this._h, r = this._r, depth = this._depth;
    this._canvas.width = w; this._canvas.height = h;
    const ctx = this._canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const hw = w / 2, hh = h / 2, br = r;
    const ss = t => t * t * (3 - 2 * t);

    const gsx = Math.ceil((br / w) * 15) / 100, gex = 1 - gsx;
    const gsy = Math.ceil((br / h) * 15) / 100, gey = 1 - gsy;

    const isCircle = this._isCircle;
    const cutR = isCircle ? Math.max(0, Math.min(w, h) / 2 - depth) : Math.max(0, r - depth);
    const cutW = isCircle ? 0 : w - 2 * depth;
    const cutH = isCircle ? 0 : h - 2 * depth;
    const cutHw = cutW / 2, cutHh = cutH / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ex = x - hw, ey = y - hh;
        const i = (y * w + x) * 4;

        const nx = (ex / hw) * 0.5 + 0.5;
        const tx = Math.max(0, Math.min(1, (nx - gsx) / (gex - gsx || 0.01)));
        const gradR = (1 - tx) * 255;
        const ny = (ey / hh) * 0.5 + 0.5;
        const ty = Math.max(0, Math.min(1, (ny - gsy) / (gey - gsy || 0.01)));
        const gradG = (1 - ty) * 255;

        const cutSdf = isCircle ? sdCircle(ex, ey, cutR) : sdRoundedBox(ex, ey, cutHw, cutHh, cutR);
        const inside = -cutSdf;
        const cutMask = ss(Math.max(0, Math.min(1, (inside + depth) / (depth * 2 || 1))));

        d[i]     = Math.max(0, Math.min(255, gradR * (1 - cutMask) + 128 * cutMask));
        d[i + 1] = Math.max(0, Math.min(255, gradG * (1 - cutMask) + 128 * cutMask));
        d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this._mapURL = this._canvas.toDataURL();
  }

  /* ── SVG 滤镜 ── */
  _buildFilter() {
    const scale = this._refraction;
    const organic = this._organicScale || 0;

    let mapInput = 'DMAP_SM', extra = '';
    if (organic > 0) {
      extra =
        `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="turb"/>
         <feColorMatrix type="matrix" in="turb" result="turbGray"
           values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>
         <feComposite in="turbGray" in2="DMAP_SM" operator="arithmetic"
           k1="0" k2="${(organic / 100).toFixed(3)}" k3="${(1 - organic / 100).toFixed(3)}" k4="0" result="COMBINED"/>`;
      mapInput = 'COMBINED';
    }

    let displaceHTML;
    if (this._caOn && this._ca > 0) {
      const s0 = scale + this._ca * 2;
      const s1 = scale + this._ca;
      const s2 = scale;
      displaceHTML =
        `<feDisplacementMap in="BG_BLUR" in2="${mapInput}" scale="${s0}" xChannelSelector="R" yChannelSelector="G" result="dR"/>
         <feColorMatrix type="matrix" in="dR" result="dRc"
           values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
         <feDisplacementMap in="BG_BLUR" in2="${mapInput}" scale="${s1}" xChannelSelector="R" yChannelSelector="G" result="dG"/>
         <feColorMatrix type="matrix" in="dG" result="dGc"
           values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
         <feDisplacementMap in="BG_BLUR" in2="${mapInput}" scale="${s2}" xChannelSelector="R" yChannelSelector="G" result="dB"/>
         <feColorMatrix type="matrix" in="dB" result="dBc"
           values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
         <feBlend in="dRc" in2="dGc" mode="screen" result="dRG"/>
         <feBlend in="dRG" in2="dBc" mode="screen"/>`;
    } else {
      displaceHTML = `<feDisplacementMap in="BG_BLUR" in2="${mapInput}" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
    }

    // 只更新透镜滤镜，不动面板滤镜
    let lensFilter = this._svg.querySelector('#lg-refract');
    if (!lensFilter) {
      lensFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      lensFilter.id = 'lg-refract';
      lensFilter.setAttribute('color-interpolation-filters', 'sRGB');
      this._svg.appendChild(lensFilter);
    }
    // 边界按 scale 动态计算，防止小元素高折射裁切
    const margin = Math.max(100, Math.ceil(scale * 2));
    lensFilter.setAttribute('x', '-' + margin + '%');
    lensFilter.setAttribute('y', '-' + margin + '%');
    lensFilter.setAttribute('width', (100 + margin * 2) + '%');
    lensFilter.setAttribute('height', (100 + margin * 2) + '%');
    lensFilter.innerHTML =
      `<feImage x="0" y="0" width="${this._w}" height="${this._h}" href="${this._mapURL}" result="DMAP"/>` +
      `<feGaussianBlur in="DMAP" stdDeviation="3" result="DMAP_SM"/>` +
      extra +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="BG_BLUR"/>` +
      displaceHTML;
  }

  /* ── 玻璃外观 ── */
  _applyGlassStyle() {
    if (this._debug) {
      this._glass.style.background = `url(${this._mapURL}) center/100% 100%`;
      this._glass.style.backdropFilter = 'none';
      this._glass.style.WebkitBackdropFilter = 'none';
      this._glass.style.border = '2px solid #c8a87c';
      return;
    }

    const isPanel = this._targetPanel !== '_glass';
    let filterUrl, blur, brightness, saturate, bgAlpha, borderAlpha, highlight, shadowAlpha;

    if (isPanel) {
      const ps = getPanelState(this._targetPanel);
      filterUrl = `url(#lg-panel-refract-${this._targetPanel})`;
      blur = ps.blur;
      brightness = ps.brightness;
      saturate = ps.saturate;
      bgAlpha = ps.bgAlpha;
      borderAlpha = ps.borderAlpha;
      highlight = ps.highlight;
      shadowAlpha = ps.shadowAlpha;
    } else {
      filterUrl = 'url(#lg-refract)';
      blur = this._blur;
      saturate = 1.3;
      borderAlpha = 0.25;
      highlight = 0.08;
      shadowAlpha = 0.3;
      if (this._adaptive) {
        brightness = this._adCur.brightness;
        bgAlpha = this._adCur.bgAlpha;
      } else {
        brightness = 1.1;
        bgAlpha = 0.06;
      }
    }

    const bf = `blur(${(blur / 2).toFixed(1)}px) ${filterUrl} blur(${blur.toFixed(1)}px) brightness(${brightness}) saturate(${saturate})`;
    // 自适应模式下用 frost overlay 的 opacity 过渡（GPU 合成器，不掉帧）
    if (this._adaptive && !isPanel && !this._debug) {
      this._glass.style.background = 'transparent';
      if (this._frostOverlay) this._frostOverlay.style.opacity = bgAlpha;
    } else {
      this._glass.style.background = `rgba(255,255,255,${bgAlpha})`;
    }
    this._glass.style.border = `1px solid rgba(255,255,255,${borderAlpha})`;
    this._glass.style.boxShadow = `0 8px 32px rgba(0,0,0,${shadowAlpha}), inset 0 1px 0 rgba(255,255,255,${highlight})`;
    this._glass.style.backdropFilter = bf;
    this._glass.style.WebkitBackdropFilter = bf;
  }

  /* ── 自适应亮度采样 ── */
  async _sampleLuminance() {
    if (!window.electronAPI) return null;
    const r = this._glass.getBoundingClientRect();
    // 采样玻璃右侧 5px 外，避免截到玻璃自身，无需隐藏
    const sx = Math.min(window.innerWidth - 1, r.right + 5);
    const sy = r.top + r.height * 0.15;
    try {
      return await window.electronAPI.invoke('screen:luma-at', sx, sy, window.innerWidth, window.innerHeight);
    } catch (_) { return null; }
  }

  _applyAdaptiveLum(lum) {
    if (lum === null) return;
    const isDark = lum < this._adThresh;
    const brightness = 1.1;
    const bgAlpha = isDark ? 0 : 0.35;
    this._adCur.lum = lum;
    this._adCur.brightness = brightness;
    this._adCur.bgAlpha = bgAlpha;
    if (this._targetPanel === '_glass' && this._adaptive && !this._debug) {
      // 目标不变则跳过
      if (this._adLast.brightness === brightness && this._adLast.bgAlpha === bgAlpha) return;
      // 过渡中则排队，等当前动画播完再应用
      if (this._adLocked) {
        this._adPending = { brightness, bgAlpha, isDark, lum };
        return;
      }
      this._adLocked = true;
      this._adPending = null;
      this._applyTarget(brightness, bgAlpha, isDark, lum);
    }
  }

  _applyTarget(brightness, bgAlpha, isDark, lum) {
    this._adLast.brightness = brightness;
    this._adLast.bgAlpha = bgAlpha;
    this._applyGlassStyle();
    // 面板/HUD
    const lumEl = document.getElementById('__lg_pnl_lumv');
    const lumT = document.getElementById('__lg_pnl_lumt');
    if (lumEl) lumEl.textContent = (lum * 100).toFixed(1) + '%';
    if (lumT) lumT.textContent = isDark ? '暗色' : '亮色';
    if (this._glassText) {
      this._glassText.textContent = isDark ? '暗色' : '亮色';
      const tc = getLensTextColors(lum);
      this._glassText.style.color = tc.t1;
    }
    if (this._glassTint) {
      this._glassTint.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)';
    }
    // 过渡完成后检查排队
    clearTimeout(this._adTimer);
    this._adTimer = setTimeout(() => {
      this._adLocked = false;
      const p = this._adPending;
      if (p && (p.brightness !== this._adLast.brightness || p.bgAlpha !== this._adLast.bgAlpha)) {
        this._adLocked = true;
        this._adPending = null;
        this._applyTarget(p.brightness, p.bgAlpha, p.isDark, p.lum);
      }
    }, this._adSpeed * 1000);
  }

  /* ── 拖动 ── */
  _setupDrag() {
    let dragging = false, sx, sy, ol, ot, hasMoved;
    const DRAG_THRESH = 4;

    this._onPointerDown = e => {
      dragging = true;
      hasMoved = false;
      this._glass.setPointerCapture(e.pointerId);
      this._glass.style.cursor = 'grabbing';
      sx = e.clientX; sy = e.clientY;
      ol = parseFloat(this._glass.style.left) || 0;
      ot = parseFloat(this._glass.style.top) || 0;
    };

    this._onPointerMove = e => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > DRAG_THRESH || Math.abs(dy) > DRAG_THRESH) hasMoved = true;
      if (hasMoved) {
        this._glass.style.left = (ol + dx).toFixed(1) + 'px';
        this._glass.style.top = (ot + dy).toFixed(1) + 'px';
        // 自适应亮度采样（串行化，避免并发 IPC 互相覆盖）
        if (this._adaptive && !this._adSampling) {
          this._adSampling = true;
          requestAnimationFrame(async () => {
            const lum = await this._sampleLuminance();
            if (lum !== null) this._applyAdaptiveLum(lum);
            this._adSampling = false;
          });
        }
      }
    };

    this._onPointerUp = () => {
      dragging = false;
      this._glass.style.cursor = 'grab';
      if (!hasMoved) this._togglePanel();
    };

    this._glass.addEventListener('pointerdown', this._onPointerDown);
    this._glass.addEventListener('pointermove', this._onPointerMove);
    this._glass.addEventListener('pointerup', this._onPointerUp);
    this._glass.addEventListener('pointerleave', () => { dragging = false; });
  }

  /* ── HUD 左上角信息 ── */
  _buildHUD() {
    this._hud = document.createElement('div');
    this._hud.id = '__lg_hud';
    this._hud.innerHTML =
      `<div class="hud-title" id="__lg_hud_title">
         <button class="hud-toggle" id="__lg_hud_toggle" title="折叠/展开">▼</button>
         <span class="hud-label">液态玻璃测试</span>
         <button class="hud-copy" id="__lg_hud_copy">复制</button>
       </div>
       <div class="hud-body" id="__lg_hud_body">
         <canvas id="__lg_hud_map" width="${this._w}" height="${this._h}"></canvas>
         <div class="hud-row"><span>尺寸</span><span id="__lg_hud_wh">${this._w}×${this._h}</span></div>
         <div class="hud-row"><span>圆角</span><span id="__lg_hud_r">${this._r}</span></div>
         <div class="hud-row"><span>深度</span><span id="__lg_hud_depth">${this._depth}</span></div>
         <div class="hud-row"><span>模糊</span><span id="__lg_hud_blur">${this._blur}</span></div>
         <div class="hud-row"><span>折射</span><span id="__lg_hud_rf">${this._refraction}</span></div>
         <div class="hud-row" data-glass-only><span>色差</span><span id="__lg_hud_ca">${this._caOn ? this._ca : 'OFF'}</span></div>
         <div class="hud-row" data-glass-only><span>有机</span><span id="__lg_hud_org">${this._organicScale}%</span></div>
       </div>`;
    this.container.appendChild(this._hud);
    this._updateHUDMap();

    document.getElementById('__lg_hud_copy').addEventListener('click', (e) => {
      e.stopPropagation();
      const params = [
        `宽:${this._w} 高:${this._h} 圆角:${this._r}`,
        `深度:${this._depth} 模糊:${this._blur} 折射:${this._refraction}`,
        `色差:${this._caOn ? this._ca : 'OFF'} 有机:${this._organicScale}%`,
      ].join('\n');
      navigator.clipboard.writeText(params).then(() => {
        const btn = document.getElementById('__lg_hud_copy');
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
      }).catch(() => {});
    });

    // 折叠/展开
    document.getElementById('__lg_hud_toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this._hud.classList.toggle('collapsed');
    });

    // 标题栏拖动 HUD
    let hudDragging = false, hudSX, hudSY, hudOL, hudOT;
    const titleEl = document.getElementById('__lg_hud_title');
    titleEl.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      hudDragging = true; titleEl.setPointerCapture(e.pointerId);
      hudSX = e.clientX; hudSY = e.clientY;
      hudOL = parseFloat(this._hud.style.left) || 12;
      hudOT = parseFloat(this._hud.style.top) || 12;
    });
    titleEl.addEventListener('pointermove', (e) => {
      if (!hudDragging) return;
      this._hud.style.left = (hudOL + e.clientX - hudSX) + 'px';
      this._hud.style.top = (hudOT + e.clientY - hudSY) + 'px';
    });
    titleEl.addEventListener('pointerup', () => { hudDragging = false; });
    titleEl.addEventListener('pointerleave', () => { hudDragging = false; });
  }

  _updateHUD() {
    if (this._targetPanel !== '_glass') {
      const def = PANEL_DEFS.find(p => p.id === this._targetPanel);
      const s = getPanelState(this._targetPanel);
      const title = document.querySelector('#__lg_hud .hud-label');
      if (title) title.textContent = def ? def.label : '面板';
      const wh = document.getElementById('__lg_hud_wh');
      if (wh) wh.textContent = '模糊:' + s.blur + ' 折射:' + s.refraction;
      const r = document.getElementById('__lg_hud_r');
      if (r) r.textContent = '深度:' + s.depth + ' 饱和:' + s.saturate.toFixed(2);
      ['__lg_hud_depth','__lg_hud_blur','__lg_hud_rf','__lg_hud_ca','__lg_hud_org'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement) el.parentElement.style.display = 'none';
      });
      document.getElementById('__lg_hud_r').parentElement.style.display = '';
      document.getElementById('__lg_hud_wh').parentElement.style.display = '';
      this._updateHUDMap();
      return;
    }
    // 恢复所有行
    ['__lg_hud_wh','__lg_hud_r','__lg_hud_depth','__lg_hud_blur','__lg_hud_rf','__lg_hud_ca','__lg_hud_org'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.style.display = '';
    });
    const title = document.querySelector('#__lg_hud .hud-label');
    if (title) title.textContent = '液态玻璃测试';
    const wh = document.getElementById('__lg_hud_wh');
    if (wh) wh.textContent = `${this._w}×${this._h}`;
    const r = document.getElementById('__lg_hud_r');
    if (r) r.textContent = this._r;
    const d = document.getElementById('__lg_hud_depth');
    if (d) d.textContent = this._depth;
    const b = document.getElementById('__lg_hud_blur');
    if (b) b.textContent = this._blur;
    const rf = document.getElementById('__lg_hud_rf');
    if (rf) rf.textContent = this._refraction;
    const ca = document.getElementById('__lg_hud_ca');
    if (ca) ca.textContent = this._caOn ? String(this._ca) : 'OFF';
    const org = document.getElementById('__lg_hud_org');
    if (org) org.textContent = this._organicScale + '%';
    this._updateHUDMap();
  }

  _updateHUDMap() {
    const c = document.getElementById('__lg_hud_map');
    if (!c) return;
    const hudW = c.clientWidth || 150;
    const isCircle = this._targetPanel === 'lightbox' || this._targetPanel === 'backtotop';

    const ctx = c.getContext('2d');

    if (this._targetPanel !== '_glass') {
      // 获取面板的独立位移图
      const mapURL = getPanelMapURL(this._targetPanel);
      if (mapURL) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, c.width, c.height);
          c.width = img.width; c.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = mapURL;
      }
    } else {
      ctx.clearRect(0, 0, c.width, c.height);
      c.width = this._w; c.height = this._h;
      ctx.drawImage(this._canvas, 0, 0);
    }

    if (this._targetPanel === '_glass') {
      c.style.aspectRatio = 'auto'; c.style.height = ''; c.style.maxHeight = ''; c.style.minHeight = '';
    } else {
      c.style.width = '100%'; c.style.height = 'auto';
      c.style.maxHeight = '140px'; c.style.minHeight = '40px';
      c.style.aspectRatio = this._w + '/' + this._h;
    }
    c.style.borderRadius = Math.round(hudW * Math.min(this._r / Math.max(this._w, 1), 0.5)) + 'px';
  }

  /* ── 参数面板 ── */
  _buildPanel() {
    this._panel = document.createElement('div');
    this._panel.id = '__lg_panel';
    this._panel.innerHTML =
      `<div class="pnl-title">参数调节<button class="pnl-close" id="__lg_pnl_close">&times;</button></div>
       <div class="pnl-target" id="__lg_pnl_target"></div>
       <div class="pnl-sep"></div>
       <div class="pnl-row" data-glass-only><label>宽</label><input type="range" id="__lg_pnl_w" min="40" max="800" value="${this._w}"><span class="pnl-val" id="__lg_pnl_wv">${this._w}</span></div>
       <div class="pnl-row" data-glass-only><label>高</label><input type="range" id="__lg_pnl_h" min="40" max="800" value="${this._h}"><span class="pnl-val" id="__lg_pnl_hv">${this._h}</span></div>
       <div class="pnl-row" data-glass-only><label>圆角</label><input type="range" id="__lg_pnl_r" min="0" max="400" value="${this._r}"><span class="pnl-val" id="__lg_pnl_rv">${this._r}</span></div>
       <div class="pnl-row"><label>深度</label><input type="range" id="__lg_pnl_d" min="1" max="50" value="${this._depth}"><span class="pnl-val" id="__lg_pnl_dv">${this._depth}</span></div>
       <div class="pnl-row"><label>模糊</label><input type="range" id="__lg_pnl_b" min="0" max="10" step="0.5" value="${this._blur}"><span class="pnl-val" id="__lg_pnl_bv">${this._blur}</span></div>
       <div class="pnl-row"><label>折射</label><input type="range" id="__lg_pnl_rf" min="20" max="300" value="${this._refraction}"><span class="pnl-val" id="__lg_pnl_rfv">${this._refraction}</span></div>
       <div class="pnl-row" id="__lg_pnl_sat_row" style="display:none"><label>饱和</label><input type="range" id="__lg_pnl_sat" min="0.5" max="2.5" step="0.05" value="1.3"><span class="pnl-val" id="__lg_pnl_satv">1.30</span></div>
       <div class="pnl-row" id="__lg_pnl_br_row" style="display:none"><label>亮度</label><input type="range" id="__lg_pnl_br" min="0.5" max="2.0" step="0.05" value="1.1"><span class="pnl-val" id="__lg_pnl_brv">1.10</span></div>
       <div class="pnl-row" id="__lg_pnl_glass_row1" style="display:none"><label>底透</label><input type="range" id="__lg_pnl_bga" min="0" max="0.3" step="0.01" value="0.06"><span class="pnl-val" id="__lg_pnl_bgav">0.06</span></div>
       <div class="pnl-row" id="__lg_pnl_glass_row2" style="display:none"><label>边透</label><input type="range" id="__lg_pnl_bda" min="0" max="0.5" step="0.01" value="0.25"><span class="pnl-val" id="__lg_pnl_bdav">0.25</span></div>
       <div class="pnl-row" id="__lg_pnl_glass_row3" style="display:none"><label>高光</label><input type="range" id="__lg_pnl_hl" min="0" max="0.3" step="0.01" value="0.08"><span class="pnl-val" id="__lg_pnl_hlv">0.08</span></div>
       <div class="pnl-row" data-glass-only><label>色差</label><input type="range" id="__lg_pnl_ca" min="0" max="20" value="${this._ca}"><span class="pnl-val" id="__lg_pnl_cav">${this._ca}</span></div>
       <div class="pnl-row" data-glass-only><label>有机</label><input type="range" id="__lg_pnl_org" min="0" max="100" value="${this._organicScale}"><span class="pnl-val" id="__lg_pnl_orgv">${this._organicScale}%</span></div>
       <div class="pnl-sep" data-glass-only></div>
       <div class="pnl-row" data-glass-only><label>阈值</label><input type="range" id="__lg_pnl_at0" min="0" max="100" value="${this._adThresh*100}"><span class="pnl-val" id="__lg_pnl_at0v">${(this._adThresh*100).toFixed(0)}%</span></div>
       <div class="pnl-row" data-glass-only><label>过渡</label><input type="range" id="__lg_pnl_ads" min="0.2" max="3" step="0.1" value="${this._adSpeed}"><span class="pnl-val" id="__lg_pnl_adsv">${this._adSpeed.toFixed(1)}s</span></div>
       <div class="pnl-row"><label>亮度</label><span class="pnl-val" id="__lg_pnl_lumv" style="color:#c8a87c;">-</span><span style="font-size:9px;color:#666;text-align:center;flex:1;" id="__lg_pnl_lumt">--</span></div>
       <div class="pnl-sep" data-glass-only></div>
       <div class="pnl-btns">
         <button id="__lg_pnl_btn_shape" data-glass-only>圆形</button>
         <button id="__lg_pnl_btn_debug" data-glass-only>Debug</button>
         <button id="__lg_pnl_btn_ca" data-glass-only>色差OFF</button>
         <div class="pnl-row" style="grid-template-columns:1fr 1fr 1fr;gap:3px;"><button id="__lg_pnl_btn_w">白</button><button id="__lg_pnl_btn_b">黑</button><button id="__lg_pnl_btn_ad" class="on">自适应</button></div>
         <button id="__lg_pnl_btn_reset">复位</button>
       </div>`;
    this.container.appendChild(this._panel);
    this._bindPanelEvents();
  }

  _buildTargetButtons() {
    const container = document.getElementById('__lg_pnl_target');
    if (!container) return;
    let html = '<button data-target="_glass" class="on">浮动透镜</button>';
    PANEL_DEFS.forEach(p => {
      html += `<button data-target="${p.id}">${p.label}</button>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        this._switchTarget(btn.dataset.target);
      });
    });
  }

  _switchTarget(id) {
    this._targetPanel = id;
    const isGlass = id === '_glass';
    const glassOnly = document.querySelectorAll('#__lg_panel [data-glass-only]');
    glassOnly.forEach(el => { el.style.display = isGlass ? '' : 'none'; });
    const satRow = document.getElementById('__lg_pnl_sat_row');
    if (satRow) satRow.style.display = isGlass ? 'none' : '';
    const brRow = document.getElementById('__lg_pnl_br_row');
    if (brRow) brRow.style.display = isGlass ? 'none' : '';
    ['__lg_pnl_glass_row1','__lg_pnl_glass_row2','__lg_pnl_glass_row3'].forEach(id => {
      const row = document.getElementById(id);
      if (row) row.style.display = isGlass ? 'none' : '';
    });

    // 圆形按钮(灯箱/返回顶部/滚动提示)使用真正的圆形 SDF，不是圆角矩形
    const isCircle = id === 'lightbox' || id === 'backtotop';
    const isCapsule = id === 'toolbar' || id === 'heroscroll' || id === 'loadmore' || id === 'dropdown-trigger';
    this._isCircle = isGlass ? false : isCircle;

    if (isGlass) {
      this._updatePanelVals();
      return;
    }

    const def = PANEL_DEFS.find(p => p.id === id);
    if (def && this._glass) {
      // 实测页面上真实面板的尺寸和圆角
      const realEl = document.querySelector(def.sel);
      let rw = def.refW, rh = def.refH, rr = def.refR;
      if (realEl) {
        rw = realEl.offsetWidth || rw;
        rh = realEl.offsetHeight || rh;
        if (isCircle) {
          // 圆形按钮：半径 = 内切圆，位移图用真正的圆形 SDF
          rr = Math.floor(Math.min(rw, rh) / 2);
        } else if (isCapsule) {
          // 胶囊型：强制 r = min(W,H)/2，圆水平/垂直伸长
          rr = Math.floor(Math.min(rw, rh) / 2);
        } else {
          const br = getComputedStyle(realEl).borderRadius.match(/[\d.]+/);
          if (br) rr = parseFloat(br[0]);
        }
      }
      this._w = rw; this._h = rh; this._r = rr;
      this._glass.style.width = rw + 'px';
      this._glass.style.height = rh + 'px';
      this._glass.style.borderRadius = rr + 'px';
      this._glass.style.left = (window.innerWidth / 2 - rw / 2).toFixed(0) + 'px';
      this._glass.style.top = (window.innerHeight / 2 - rh / 2).toFixed(0) + 'px';

      this._buildMap();
      this._buildFilter();
      this._applyGlassStyle();
      applyAllPanelStyles();
    }

    // 同步面板参数到滑块
    const s = getPanelState(id);
    document.getElementById('__lg_pnl_b').value = s.blur;
    document.getElementById('__lg_pnl_bv').textContent = s.blur.toFixed(1);
    document.getElementById('__lg_pnl_rf').value = s.refraction;
    document.getElementById('__lg_pnl_rfv').textContent = String(Math.round(s.refraction));
    document.getElementById('__lg_pnl_d').value = s.depth;
    document.getElementById('__lg_pnl_dv').textContent = String(Math.round(s.depth));
    const satSl = document.getElementById('__lg_pnl_sat');
    if (satSl) { satSl.value = s.saturate; document.getElementById('__lg_pnl_satv').textContent = s.saturate.toFixed(2); }
    const brSl = document.getElementById('__lg_pnl_br');
    if (brSl) { brSl.value = s.brightness; document.getElementById('__lg_pnl_brv').textContent = s.brightness.toFixed(2); }
    ['bga','bda','hl'].forEach(k => {
      const sl = document.getElementById('__lg_pnl_' + k);
      if (!sl) return;
      const key = k === 'bga' ? 'bgAlpha' : k === 'bda' ? 'borderAlpha' : 'highlight';
      sl.value = s[key];
      const vEl = document.getElementById('__lg_pnl_' + k + 'v');
      if (vEl) vEl.textContent = s[key].toFixed(2);
    });

    this._updateHUD();
    if (this._textModeUI) {
      this._textModeUI(isGlass ? getLensTextMode() : getPanelTextMode(id));
    }
  }

  _bindPanelEvents() {
    this._buildTargetButtons();

    // 通用滑块: blur / refraction
    const bindSlider = (id, onInput) => {
      const el = document.getElementById('__lg_pnl_' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        onInput(parseFloat(el.value));
        this._updatePanelVals();
        this._updateHUD();
      });
    };

    bindSlider('b', (v) => {
      if (this._targetPanel === '_glass') { this._blur = v; this._applyGlassStyle(); }
      else { setPanelBlur(this._targetPanel, v); }
    });
    bindSlider('rf', (v) => {
      if (this._targetPanel === '_glass') { this._refraction = v; this._buildFilter(); this._applyGlassStyle(); }
      else { setPanelRefraction(this._targetPanel, v); }
    });
    bindSlider('d', (v) => {
      if (this._targetPanel === '_glass') { this._depth = v; this._buildMap(); this._buildFilter(); this._applyGlassStyle(); }
      else { setPanelDepth(this._targetPanel, v); this._updateHUD(); }
    });
    bindSlider('sat', (v) => {
      if (this._targetPanel !== '_glass') { setPanelSaturate(this._targetPanel, v); }
    });
    bindSlider('br', (v) => {
      if (this._targetPanel !== '_glass') { setPanelBrightness(this._targetPanel, v); }
    });
    bindSlider('bga', (v) => {
      if (this._targetPanel !== '_glass') { setPanelBgAlpha(this._targetPanel, v); }
    });
    bindSlider('bda', (v) => {
      if (this._targetPanel !== '_glass') { setPanelBorderAlpha(this._targetPanel, v); }
    });
    bindSlider('hl', (v) => {
      if (this._targetPanel !== '_glass') { setPanelHighlight(this._targetPanel, v); }
    });

    // 玻璃专用滑块
    const glassSliders = [
      { id: 'w', prop: '_w', apply: () => { this._glass.style.width = this._w + 'px'; if (this._isCircle) { this._r = Math.floor(Math.min(this._w, this._h) / 2); this._glass.style.borderRadius = this._r + 'px'; } this._buildMap(); this._buildFilter(); this._applyGlassStyle(); } },
      { id: 'h', prop: '_h', apply: () => { this._glass.style.height = this._h + 'px'; if (this._isCircle) { this._r = Math.floor(Math.min(this._w, this._h) / 2); this._glass.style.borderRadius = this._r + 'px'; } this._buildMap(); this._buildFilter(); this._applyGlassStyle(); } },
      { id: 'r', prop: '_r', apply: () => { this._glass.style.borderRadius = this._r + 'px'; this._buildMap(); this._buildFilter(); this._applyGlassStyle(); } },
      { id: 'ca', prop: '_ca', apply: () => { this._buildFilter(); this._applyGlassStyle(); } },
      { id: 'org', prop: '_organicScale', apply: () => { this._buildFilter(); this._applyGlassStyle(); } },
    ];
    glassSliders.forEach(s => {
      const el = document.getElementById('__lg_pnl_' + s.id);
      if (!el) return;
      el.addEventListener('input', () => {
        this[s.prop] = parseFloat(el.value);
        s.apply();
        this._updatePanelVals();
        this._updateHUD();
      });
    });

    // 自适应阈值滑块
    const atSl = document.getElementById('__lg_pnl_at0');
    if (atSl) {
      atSl.addEventListener('input', () => {
        this._adThresh = parseFloat(atSl.value) / 100;
        const vl = document.getElementById('__lg_pnl_at0v');
        if (vl) vl.textContent = Math.round(this._adThresh * 100) + '%';
        setAdaptiveThreshold(this._adThresh);
        updateAllPanels();
      });
    }

    // 过渡速度滑块
    const adSp = document.getElementById('__lg_pnl_ads');
    if (adSp) {
      adSp.addEventListener('input', () => {
        this._adSpeed = parseFloat(adSp.value);
        const vl = document.getElementById('__lg_pnl_adsv');
        if (vl) vl.textContent = this._adSpeed.toFixed(1) + 's';
        if (this._frostOverlay) this._frostOverlay.style.transition = `opacity ${this._adSpeed}s ease`;
        if (this._glassText) this._glassText.style.transition = `color ${this._adSpeed}s ease`;
        setTextTransitionSpeed(this._adSpeed);
      });
    }

    document.getElementById('__lg_pnl_close').addEventListener('click', () => this._closePanel());

    document.getElementById('__lg_pnl_btn_debug').addEventListener('click', () => {
      this._debug = !this._debug;
      document.getElementById('__lg_pnl_btn_debug').classList.toggle('on', this._debug);
      this._applyGlassStyle();
    });

    document.getElementById('__lg_pnl_btn_ca').addEventListener('click', () => {
      this._caOn = !this._caOn;
      const btn = document.getElementById('__lg_pnl_btn_ca');
      btn.classList.toggle('on', this._caOn);
      btn.textContent = '色差' + (this._caOn ? 'ON' : 'OFF');
      this._buildFilter();
      this._applyGlassStyle();
      this._updateHUD();
    });

    document.getElementById('__lg_pnl_btn_shape').addEventListener('click', () => {
      this._isCircle = !this._isCircle;
      const btn = document.getElementById('__lg_pnl_btn_shape');
      if (this._isCircle) {
        this._prevRectR = this._r;
        this._r = Math.floor(Math.min(this._w, this._h) / 2);
        btn.textContent = '矩形';
        btn.classList.add('on');
      } else {
        this._r = this._prevRectR;
        btn.textContent = '圆形';
        btn.classList.remove('on');
      }
      this._glass.style.borderRadius = this._r + 'px';
      this._buildMap();
      this._buildFilter();
      this._applyGlassStyle();
      this._updateHUD();
    });

    // 文字模式选择（三按钮：白/黑/自适应）
    const textBtns = [
      { id: '__lg_pnl_btn_w',  mode: 'white' },
      { id: '__lg_pnl_btn_b',  mode: 'black' },
      { id: '__lg_pnl_btn_ad', mode: 'adaptive' },
    ];
    const _setTextUI = (activeMode) => {
      textBtns.forEach(({ id, mode }) => {
        const b = document.getElementById(id);
        if (b) b.classList.toggle('on', mode === activeMode);
      });
    };
    textBtns.forEach(({ id, mode }) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('click', () => {
        if (this._targetPanel === '_glass') {
          setLensTextMode(mode);
        } else {
          setPanelTextMode(this._targetPanel, mode);
        }
        _setTextUI(mode);
        // 刷新透镜文字（绕过 _applyAdaptiveLum 的去重检查）
        if (this._adaptive && this._targetPanel === '_glass' && !this._debug) {
          const lum = this._adCur.lum;
          const isDark = lum < this._adThresh;
          const tc = getLensTextColors(lum);
          this._glassText.style.color = tc.t1;
        }
      });
    });
    // 切换目标面板时刷新文字按钮状态
    this._textModeUI = _setTextUI;

    // 复位按钮
    document.getElementById('__lg_pnl_btn_reset').addEventListener('click', () => {
      if (this._targetPanel === '_glass') {
        this._w = 240; this._h = 240; this._r = 36; this._depth = 10;
        this._blur = 2; this._refraction = 150; this._ca = 0; this._organicScale = 0;
        this._caOn = false; this._debug = false; this._isCircle = false;
        if (this._glass) {
          this._glass.style.width = '240px'; this._glass.style.height = '240px';
          this._glass.style.borderRadius = '36px';
        }
        this._buildMap(); this._buildFilter(); this._applyGlassStyle();
        const caBtn = document.getElementById('__lg_pnl_btn_ca');
        if (caBtn) { caBtn.classList.remove('on'); caBtn.textContent = '色差OFF'; }
        const dbgBtn = document.getElementById('__lg_pnl_btn_debug');
        if (dbgBtn) dbgBtn.classList.remove('on');
        const shpBtn = document.getElementById('__lg_pnl_btn_shape');
        if (shpBtn) { shpBtn.classList.remove('on'); shpBtn.textContent = '圆形'; }
      } else {
        resetPanelState(this._targetPanel);
      }
      this._updatePanelVals();
      this._updateHUD();
    });
  }

  _updatePanelVals() {
    if (this._targetPanel !== '_glass') {
      const s = getPanelState(this._targetPanel);
      ['b','rf','d'].forEach(k => {
        const sl = document.getElementById('__lg_pnl_' + k);
        if (sl) sl.value = s[k === 'd' ? 'depth' : k === 'rf' ? 'refraction' : 'blur'];
      });
      const elBv = document.getElementById('__lg_pnl_bv');
      if (elBv) elBv.textContent = s.blur.toFixed(1);
      const elRfv = document.getElementById('__lg_pnl_rfv');
      if (elRfv) elRfv.textContent = String(Math.round(s.refraction));
      const elDv = document.getElementById('__lg_pnl_dv');
      if (elDv) elDv.textContent = String(Math.round(s.depth));
      const elSat = document.getElementById('__lg_pnl_sat');
      if (elSat) elSat.value = s.saturate;
      const elSatv = document.getElementById('__lg_pnl_satv');
      if (elSatv) elSatv.textContent = s.saturate.toFixed(2);
      const elBr = document.getElementById('__lg_pnl_br');
      if (elBr) elBr.value = s.brightness;
      const elBrv = document.getElementById('__lg_pnl_brv');
      if (elBrv) elBrv.textContent = s.brightness.toFixed(2);
      ['bga','bda','hl'].forEach(k => {
        const sl = document.getElementById('__lg_pnl_' + k);
        if (!sl) return;
        const key = k === 'bga' ? 'bgAlpha' : k === 'bda' ? 'borderAlpha' : 'highlight';
        sl.value = s[key];
        const vEl = document.getElementById('__lg_pnl_' + k + 'v');
        if (vEl) vEl.textContent = s[key].toFixed(2);
      });
      return;
    }
    const vals = { w: this._w, h: this._h, r: this._r, d: this._depth, b: this._blur, rf: this._refraction, ca: this._ca, org: this._organicScale };
    Object.entries(vals).forEach(([k, v]) => {
      const el = document.getElementById('__lg_pnl_' + k + 'v');
      if (!el) return;
      if (k === 'b') el.textContent = v.toFixed(1);
      else if (k === 'org') el.textContent = v + '%';
      else el.textContent = String(Math.round(v));
    });
    Object.entries(vals).forEach(([k, v]) => {
      const sl = document.getElementById('__lg_pnl_' + k);
      if (sl) sl.value = v;
    });
  }

  _togglePanel() {
    if (this._panelOpen) this._closePanel();
    else this._openPanel();
  }

  _openPanel() {
    this._panelOpen = true;
    this._panel.classList.add('open');
    // 重建目标选择器
    this._buildTargetButtons();
    // 高亮当前目标
    const container = document.getElementById('__lg_pnl_target');
    if (container) {
      container.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', b.dataset.target === this._targetPanel);
      });
    }
    this._switchTarget(this._targetPanel);
    this._updatePanelVals();
    document.getElementById('__lg_pnl_btn_debug').classList.toggle('on', this._debug);
    const caBtn = document.getElementById('__lg_pnl_btn_ca');
    caBtn.classList.toggle('on', this._caOn);
    caBtn.textContent = '色差' + (this._caOn ? 'ON' : 'OFF');
    const shapeBtn = document.getElementById('__lg_pnl_btn_shape');
    shapeBtn.classList.toggle('on', this._isCircle);
    shapeBtn.textContent = this._isCircle ? '矩形' : '圆形';
  }

  _closePanel() {
    this._panelOpen = false;
    this._panel.classList.remove('open');
  }

  /* ── 公共 API ── */

  setRefraction(v) { this._refraction = v; this._buildFilter(); this._applyGlassStyle(); this._updateHUD(); }
  setOrganic(strength) { this._organicScale = strength; this._buildFilter(); this._applyGlassStyle(); this._updateHUD(); }
  setBlur(v) { this._blur = v; this._applyGlassStyle(); this._updateHUD(); }
  setAberration(v) { this._ca = v; this._buildFilter(); this._applyGlassStyle(); this._updateHUD(); }

  setShape(w, h, r) {
    this._w = w; this._h = h; this._r = r;
    if (this._glass) {
      this._glass.style.width = w + 'px'; this._glass.style.height = h + 'px';
      this._glass.style.borderRadius = r + 'px';
    }
    this._buildMap();
    this._buildFilter();
    this._applyGlassStyle();
    this._updateHUD();
  }

  setDepth(d) { this._depth = d; this._buildMap(); this._buildFilter(); this._applyGlassStyle(); this._updateHUD(); }

  start() {}
  stop() {}

  updateControls(opts) {
    Object.assign(this, opts);
    this._buildMap();
    this._buildFilter();
    this._applyGlassStyle();
    this._updateHUD();
  }

  getMapURL() { return this._mapURL; }
  getCanvas() { return this._canvas; }

  destroy() {
    if (this._glass) {
      this._glass.removeEventListener('pointerdown', this._onPointerDown);
      this._glass.removeEventListener('pointermove', this._onPointerMove);
      this._glass.removeEventListener('pointerup', this._onPointerUp);
      this._glass.remove();
      this._glass = null;
    }
    if (this._svg) { this._svg.remove(); this._svg = null; }
    if (this._hud) { this._hud.remove(); this._hud = null; }
    if (this._panel) { this._panel.remove(); this._panel = null; }
    this._canvas = null;
  }
}
