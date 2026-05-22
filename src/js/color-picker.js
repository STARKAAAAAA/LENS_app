// ===== LENS Color Picker — 内联取色器组件 =====
// 替换原生 <input type="color">，提供 2D 饱和度/亮度面板 + 色相条 + 透明度条
// 支持 hex / rgba 双格式，配色自动跟随 CSS 变量预设系统

// ── 颜色转换工具 ──

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 200, g: 168, b: 124 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s /= 100; v /= 100;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = 0; g = 0; b = 0;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function hexToHsv(hex) {
  return rgbToHsv(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b);
}

function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

function parseRgba(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

// ── 单例取色器 ──

let activePicker = null;
let popoverEl = null;
let currentTrigger = null;
let currentState = null;
let _hideTimer = null;

function createPopover() {
  if (popoverEl) return popoverEl;

  popoverEl = document.createElement('div');
  popoverEl.className = 'dev-color-popover';
  popoverEl.innerHTML = `
    <div class="dcp-pad-wrap">
      <canvas class="dcp-pad" width="160" height="120"></canvas>
      <div class="dcp-pad-cursor"></div>
    </div>
    <div class="dcp-sliders">
      <div class="dcp-hue-wrap">
        <canvas class="dcp-hue" width="160" height="16"></canvas>
        <div class="dcp-hue-thumb"></div>
      </div>
      <div class="dcp-alpha-wrap">
        <div class="dcp-alpha-bg"></div>
        <canvas class="dcp-alpha" width="160" height="16"></canvas>
        <div class="dcp-alpha-thumb"></div>
      </div>
    </div>
    <div class="dcp-footer">
      <button class="dcp-eyedropper" title="取色笔 (从屏幕任意位置取色)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.4 2.2a2.1 2.1 0 0 1 3 3L13 13.6l-4 2 2-4Z"/><path d="m2 22 4.5-1.5L18.4 8.6"/><path d="M15 6 18 3"/></svg>
      </button>
      <input class="dcp-output" type="text" spellcheck="false" maxlength="20">
      <button class="dcp-format" title="切换 HEX/RGBA 格式">HEX</button>
    </div>
  `;

  // 拖拽: 选色板
  const pad = popoverEl.querySelector('.dcp-pad');
  const padCursor = popoverEl.querySelector('.dcp-pad-cursor');
  const padWrap = popoverEl.querySelector('.dcp-pad-wrap');

  let draggingPad = false;

  function padFromEvent(e) {
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function updatePadCursor(x, y) {
    padCursor.style.left = (x * 100) + '%';
    padCursor.style.top = (y * 100) + '%';
  }

  function commitPad(x, y) {
    currentState.sat = x * 100;
    currentState.val = (1 - y) * 100;
    currentState.hex = hsvToHex(currentState.hue, currentState.sat, currentState.val);
    applyState();
    renderAlpha();
    updatePadCanvas();
  }

  pad.addEventListener('pointerdown', (e) => {
    draggingPad = true;
    pad.setPointerCapture(e.pointerId);
    const { x, y } = padFromEvent(e);
    updatePadCursor(x, y);
    commitPad(x, y);
  });

  pad.addEventListener('pointermove', (e) => {
    if (!draggingPad) return;
    const { x, y } = padFromEvent(e);
    updatePadCursor(x, y);
    commitPad(x, y);
  });

  pad.addEventListener('pointerup', () => { draggingPad = false; });
  pad.addEventListener('pointercancel', () => { draggingPad = false; });

  // 拖拽: 色相条（横向）
  const hueCanvas = popoverEl.querySelector('.dcp-hue');
  const hueThumb = popoverEl.querySelector('.dcp-hue-thumb');
  let draggingHue = false;

  function hueFromEvent(e) {
    const rect = hueCanvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  hueCanvas.addEventListener('pointerdown', (e) => {
    draggingHue = true;
    hueCanvas.setPointerCapture(e.pointerId);
    const t = hueFromEvent(e);
    hueThumb.style.left = (t * 100) + '%';
    currentState.hue = t * 360;
    currentState.hex = hsvToHex(currentState.hue, currentState.sat, currentState.val);
    applyState();
    renderAlpha();
    updatePadCanvas();
  });

  hueCanvas.addEventListener('pointermove', (e) => {
    if (!draggingHue) return;
    const t = hueFromEvent(e);
    hueThumb.style.left = (t * 100) + '%';
    currentState.hue = t * 360;
    currentState.hex = hsvToHex(currentState.hue, currentState.sat, currentState.val);
    applyState();
    renderAlpha();
    updatePadCanvas();
  });

  hueCanvas.addEventListener('pointerup', () => { draggingHue = false; });
  hueCanvas.addEventListener('pointercancel', () => { draggingHue = false; });

  // 拖拽: 透明度条（横向）
  const alphaCanvas = popoverEl.querySelector('.dcp-alpha');
  const alphaThumb = popoverEl.querySelector('.dcp-alpha-thumb');
  let draggingAlpha = false;

  function alphaFromEvent(e) {
    const rect = alphaCanvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  alphaCanvas.addEventListener('pointerdown', (e) => {
    draggingAlpha = true;
    alphaCanvas.setPointerCapture(e.pointerId);
    const t = alphaFromEvent(e);
    alphaThumb.style.left = (t * 100) + '%';
    currentState.alpha = t;
    applyState();
  });

  alphaCanvas.addEventListener('pointermove', (e) => {
    if (!draggingAlpha) return;
    const t = alphaFromEvent(e);
    alphaThumb.style.left = (t * 100) + '%';
    currentState.alpha = t;
    applyState();
  });

  alphaCanvas.addEventListener('pointerup', () => { draggingAlpha = false; });
  alphaCanvas.addEventListener('pointercancel', () => { draggingAlpha = false; });

  // 取色笔
  const eyedropperBtn = popoverEl.querySelector('.dcp-eyedropper');
  eyedropperBtn.addEventListener('click', async () => {
    try {
      if (!window.EyeDropper) return;
      const dropper = new EyeDropper();
      const result = await dropper.open();
      const hex = result.sRGBHex;
      currentState.hex = hex;
      const { h, s, v } = hexToHsv(hex);
      currentState.hue = h;
      currentState.sat = s;
      currentState.val = v;
      applyState();
      updateAllUI();
    } catch {}
  });

  // 格式切换
  const formatBtn = popoverEl.querySelector('.dcp-format');
  formatBtn.addEventListener('click', () => {
    currentState.format = currentState.format === 'hex' ? 'rgba' : 'hex';
    formatBtn.textContent = currentState.format.toUpperCase();
    updateOutput();
  });

  // 手动输入
  const outputInput = popoverEl.querySelector('.dcp-output');
  outputInput.addEventListener('change', () => {
    const raw = outputInput.value.trim();
    let hex, alpha = currentState.alpha;

    const rgbaM = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
    const hexM = raw.match(/^#?([a-f\d]{3,8})$/i);

    if (rgbaM) {
      hex = rgbToHex(+rgbaM[1], +rgbaM[2], +rgbaM[3]);
      if (rgbaM[4] !== undefined) alpha = parseFloat(rgbaM[4]);
    } else if (hexM) {
      let h = hexM[1];
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      else if (h.length === 8) {
        alpha = parseInt(h.slice(6, 8), 16) / 255;
        h = h.slice(0, 6);
      }
      if (h.length !== 6) return;
      hex = '#' + h;
    } else return;

    currentState.hex = hex;
    currentState.alpha = alpha;
    const { h, s, v } = hexToHsv(hex);
    currentState.hue = h;
    currentState.sat = s;
    currentState.val = v;
    applyState();
    updateAllUI();
  });

  outputInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') outputInput.blur();
    if (e.key === 'Escape') { outputInput.blur(); closePopover(); }
  });

  document.body.appendChild(popoverEl);
  return popoverEl;
}

function updatePadCanvas() {
  const popover = createPopover();
  const pad = popover.querySelector('.dcp-pad');
  const ctx = pad.getContext('2d');
  const w = pad.width, h = pad.height;
  const hue = currentState.hue;

  // 白底
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);

  // 水平: 白→纯色相 (饱和度梯度)
  const satGrad = ctx.createLinearGradient(0, 0, w, 0);
  satGrad.addColorStop(0, 'white');
  satGrad.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
  ctx.fillStyle = satGrad;
  ctx.fillRect(0, 0, w, h);

  // 垂直: 透明→黑 (明度梯度)
  const valGrad = ctx.createLinearGradient(0, 0, 0, h);
  valGrad.addColorStop(0, 'rgba(0,0,0,0)');
  valGrad.addColorStop(1, 'black');
  ctx.fillStyle = valGrad;
  ctx.fillRect(0, 0, w, h);
}

function renderHueBar() {
  const popover = createPopover();
  const canvas = popover.querySelector('.dcp-hue');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 360; i += 1) {
    grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function renderAlpha() {
  const popover = createPopover();
  const canvas = popover.querySelector('.dcp-alpha');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const { r, g, b } = hexToRgb(currentState.hex);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function updateOutput() {
  const popover = createPopover();
  const output = popover.querySelector('.dcp-output');
  const { r, g, b } = hexToRgb(currentState.hex);
  const a = currentState.alpha;

  if (currentState.format === 'rgba') {
    output.value = a < 1 ? `rgba(${r},${g},${b},${+a.toFixed(2)})` : `rgb(${r},${g},${b})`;
  } else {
    output.value = a < 1
      ? currentState.hex + Math.round(a * 255).toString(16).padStart(2, '0')
      : currentState.hex;
  }
}

function updateAllUI() {
  const popover = createPopover();
  updatePadCanvas();
  renderAlpha();

  // 色板光标
  const x = currentState.sat / 100;
  const y = 1 - currentState.val / 100;
  popover.querySelector('.dcp-pad-cursor').style.left = (x * 100) + '%';
  popover.querySelector('.dcp-pad-cursor').style.top = (y * 100) + '%';

  // 色相拇指
  popover.querySelector('.dcp-hue-thumb').style.left = (currentState.hue / 360 * 100) + '%';

  // 透明度拇指
  popover.querySelector('.dcp-alpha-thumb').style.left = (currentState.alpha * 100) + '%';

  updateOutput();
  updateTrigger();
  syncAlphaVisibility();
}

function syncAlphaVisibility() {
  const popover = createPopover();
  const alphaWrap = popover.querySelector('.dcp-alpha-wrap');
  alphaWrap.style.display = currentState.hasAlpha ? '' : 'none';
}

function applyState() {
  const key = currentState.key;
  const { r, g, b } = hexToRgb(currentState.hex);
  const a = currentState.alpha;

  let cssValue;
  if (currentState.hasAlpha && a < 1) {
    cssValue = `rgba(${r},${g},${b},${+a.toFixed(2)})`;
  } else if (currentState.hasAlpha) {
    cssValue = `rgba(${r},${g},${b},1)`;
  } else {
    cssValue = currentState.hex;
  }

  document.documentElement.style.setProperty(key, cssValue);
  updateOutput();
  updateTrigger();

  // 触发 dev panel 的保存和应用流程
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lens-color-change', { detail: { key, value: cssValue } }));
  }
}

function updateTrigger() {
  if (!currentTrigger) return;
  const swatch = currentTrigger.querySelector('.dev-color-trigger__swatch');
  const valEl = currentTrigger.querySelector('.dev-color-trigger__value');
  if (swatch) {
    const { r, g, b } = hexToRgb(currentState.hex);
    const a = currentState.alpha;
    swatch.style.background = a < 1 ? `rgba(${r},${g},${b},${+a.toFixed(2)})` : currentState.hex;
  }
  if (valEl) {
    if (currentState.format === 'rgba') {
      const { r, g, b } = hexToRgb(currentState.hex);
      const a = currentState.alpha;
      valEl.textContent = a < 1 ? `rgba(${r},${g},${b},${+a.toFixed(2)})` : `rgb(${r},${g},${b})`;
    } else {
      valEl.textContent = currentState.alpha < 1
        ? currentState.hex + Math.round(currentState.alpha * 255).toString(16).padStart(2, '0')
        : currentState.hex;
    }
  }
}

function openPopover(trigger) {
  const popover = createPopover();
  currentTrigger = trigger;
  const key = trigger.dataset.css;
  const hasAlpha = trigger.dataset.alpha === 'true';
  const rawValue = trigger.dataset.value;

  let hex, alpha = 1;
  const rgbaParsed = parseRgba(rawValue);
  if (rgbaParsed) {
    hex = rgbToHex(rgbaParsed.r, rgbaParsed.g, rgbaParsed.b);
    alpha = rgbaParsed.a;
  } else {
    hex = rawValue;
  }
  if (!/^#/.test(hex)) hex = '#c8a87c';

  const { h, s, v } = hexToHsv(hex);

  currentState = {
    key,
    hasAlpha,
    hex,
    alpha,
    hue: h,
    sat: s,
    val: v,
    format: hasAlpha ? 'rgba' : 'hex',
  };

  const formatBtn = popover.querySelector('.dcp-format');
  formatBtn.textContent = currentState.format.toUpperCase();

  updateAllUI();
  syncAlphaVisibility();

  // 定位
  const triggerRect = trigger.getBoundingClientRect();
  let left = triggerRect.left;
  let top = triggerRect.bottom + 4;

  // 保持在视口内
  if (left + 200 > window.innerWidth) left = Math.max(4, window.innerWidth - 204);
  if (top + 280 > window.innerHeight) top = triggerRect.top - 284;

  popover.style.left = left + 'px';
  popover.style.top = top + 'px';
  popover.classList.add('dev-color-popover--open');

  activePicker = true;
}

function closePopover() {
  if (popoverEl) {
    popoverEl.classList.remove('dev-color-popover--open');
  }
  currentTrigger = null;
  currentState = null;
  activePicker = false;
}

// ── 对外 API ──

let _initialized = false;

export function initColorPickers(containerEl) {
  if (_initialized) {
    // 已初始化，仅补充为此容器的触发器添加委托（不同 tab 组共用同一 popover）
    return;
  }
  _initialized = true;

  // 创建 popover（挂载到 body）
  createPopover();
  renderHueBar();

  // 全局点击关闭（用 capture 捕获所有点击，包括不同 tab 组内的触发器）
  document.addEventListener('pointerdown', (e) => {
    if (!activePicker) return;
    if (popoverEl && !popoverEl.contains(e.target) && !e.target.closest('.dev-color-trigger')) {
      closePopover();
    }
  }, true);

  // 全局委托: 所有触发器点击（挂 document 上而非 container，支持跨 tab）
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.dev-color-trigger');
    if (!trigger) return;

    if (currentTrigger === trigger && activePicker) {
      closePopover();
      return;
    }

    // 更新 data-value
    const key = trigger.dataset.css;
    const val = document.documentElement.style.getPropertyValue(key)?.trim() || trigger.dataset.value;
    trigger.dataset.value = val;

    openPopover(trigger);
  });

  // 键盘关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePicker) {
      closePopover();
    }
  });
}

export function syncColorTrigger(key) {
  const trigger = document.querySelector(`.dev-color-trigger[data-css="${key}"]`);
  if (!trigger) return;
  const val = document.documentElement.style.getPropertyValue(key)?.trim();
  if (!val) return;
  trigger.dataset.value = val;

  const swatch = trigger.querySelector('.dev-color-trigger__swatch');
  const valEl = trigger.querySelector('.dev-color-trigger__value');
  if (swatch) swatch.style.background = val;
  if (valEl) valEl.textContent = val;
}

export function syncAllColorTriggers(containerEl) {
  const triggers = (containerEl || document).querySelectorAll('.dev-color-trigger[data-css]');
  triggers.forEach(t => syncColorTrigger(t.dataset.css));
}
