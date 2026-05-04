// ========== 开发者面板 — LENS Developer Panel ==========
// 快捷键 Ctrl+Shift+D 打开  手柄 START+BACK 打开

// dev panel 使用独立的预设系统，不依赖 toggles.js

// ── 模块内部状态 ──
const D = {
  open: false,
  closing: false,
  activeGroup: 'visual',
  fpsRaf: null, fpsHistory: [], fpsLastTime: 0,
  consoleBuffer: [],
  consoleOrig: { log: null, warn: null, error: null, debug: null },
  gamepadPollRaf: null,
  perfInterval: null,
  _consoleRefreshInterval: null,
  _closeFallback: null,
  _closeOnEnd: null,
  gpEventLog: [],
};
const CONSOLE_MAX = 200;
const FPS_MAX = 60;
const GP_EVENT_MAX = 20;

// localStorage keys
const PRESETS_KEY = 'lens-dev-presets';
const ACTIVE_PRESET_KEY = 'lens-dev-active-preset';

// CSS 变量快照键
const CSS_VAR_KEYS = [
  '--accent','--bg','--bg-deep','--text','--text-2','--text-3',
  '--glass-bg','--glass-border',
  '--radius','--radius-sm','--radius-pill',
  '--thumb-card-size','--font-scale','--anim-speed','--glass-blur',
];

// CSS 变量默认值（init 时从 :root 捕获）
let CSS_DEFAULTS = {};

// ── 内置预设 ──
const BUILTIN_PRESETS = [
  {
    id: '__default__', name: '默认', builtin: true,
    vars: {
      '--accent':'#c8a87c','--bg':'#0a0a08','--bg-deep':'#060605',
      '--text':'#e8e4e0','--text-2':'#9a948e','--text-3':'#8a8580',
      '--glass-bg':'rgba(220,200,180,0.06)','--glass-border':'rgba(220,200,180,0.10)',
      '--radius':'20px','--radius-sm':'14px','--radius-pill':'100px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
    },
  },
  {
    id: '__warm__', name: '暖琥珀', builtin: true,
    vars: {
      '--accent':'#d4a040','--bg':'#0a0804','--bg-deep':'#060402',
      '--text':'#f0e8d8','--text-2':'#b0a080','--text-3':'#908870',
      '--glass-bg':'rgba(240,200,140,0.08)','--glass-border':'rgba(240,200,140,0.12)',
      '--radius':'20px','--radius-sm':'14px','--radius-pill':'100px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
    },
  },
  {
    id: '__cool__', name: '冷石板', builtin: true,
    vars: {
      '--accent':'#8ca8c8','--bg':'#08080c','--bg-deep':'#040406',
      '--text':'#e0e4e8','--text-2':'#8c9098','--text-3':'#787c84',
      '--glass-bg':'rgba(180,190,210,0.06)','--glass-border':'rgba(180,190,210,0.10)',
      '--radius':'18px','--radius-sm':'12px','--radius-pill':'100px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
    },
  },
  {
    id: '__contrast__', name: '高对比度', builtin: true,
    vars: {
      '--accent':'#ffcc44','--bg':'#000000','--bg-deep':'#000000',
      '--text':'#ffffff','--text-2':'#cccccc','--text-3':'#aaaaaa',
      '--glass-bg':'rgba(255,255,255,0.08)','--glass-border':'rgba(255,255,255,0.15)',
      '--radius':'20px','--radius-sm':'14px','--radius-pill':'100px',
      '--thumb-card-size':'360px','--font-scale':'1.1','--anim-speed':'0.5','--glass-blur':'0px',
    },
  },
];

// ── Open / Close ──

// ── body overflow 共享锁（与 shortcuts panel 协调） ──
function lockBodyScroll() {
  window.__lensOverflowLock = (window.__lensOverflowLock || 0) + 1;
  document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
  window.__lensOverflowLock = Math.max(0, (window.__lensOverflowLock || 0) - 1);
  if (window.__lensOverflowLock === 0) document.body.style.overflow = '';
}

function openDevPanel() {
  const overlay = document.getElementById('dev-overlay');
  const panel = document.getElementById('dev-panel');
  if (!overlay || !panel) return;

  // 如果正在关闭动画中，中断关闭
  if (D.closing) {
    D._closeFallback && clearTimeout(D._closeFallback);
    panel.removeEventListener('animationend', D._closeOnEnd);
    panel.classList.remove('dev-panel--out');
    D.closing = false;
  }

  overlay.classList.add('dev-overlay--open');
  panel.classList.remove('dev-panel--out');
  lockBodyScroll();
  D.open = true;
  startAllMonitors();
  switchGroup(D.activeGroup);
}

function closeDevPanel() {
  if (D.closing) return;
  D.closing = true;
  const panel = document.getElementById('dev-panel');
  const overlay = document.getElementById('dev-overlay');
  if (!panel || !overlay) { D.closing = false; return; }

  panel.classList.add('dev-panel--out');
  overlay.classList.remove('dev-overlay--open');

  const cleanup = () => {
    clearTimeout(D._closeFallback);
    panel.removeEventListener('animationend', onEnd);
    panel.classList.remove('dev-panel--out');
    D.closing = false;
    D.open = false;
    unlockBodyScroll();
    stopAllMonitors();
  };

  const onEnd = (e) => {
    if (e.animationName !== 'devPanelDissolve') return;
    D._closeOnEnd = null;
    cleanup();
  };
  D._closeOnEnd = onEnd;
  panel.addEventListener('animationend', onEnd);

  // 安全兜底：500ms 后强制清理（防止 animationend 未触发导致死锁）
  D._closeFallback = setTimeout(cleanup, 500);
}

export function toggleDevPanel() {
  if (D.open && !D.closing) closeDevPanel();
  else if (!D.open || D.closing) openDevPanel();
}

export function isDevPanelOpen() { return D.open; }

// ── 事件 ──

function setupDevPanelEvents() {
  const overlay = document.getElementById('dev-overlay');
  const closeBtn = document.getElementById('dev-panel-close');

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) toggleDevPanel();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDevPanel);
  }

  // 全局键盘：Ctrl+Shift+D 切换，Escape 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      toggleDevPanel();
      return;
    }
    if (e.key === 'Escape' && D.open) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      closeDevPanel();
    }
  });
}

// ── 标签页切换 ──

function setupDevTabs() {
  const nav = document.getElementById('dev-nav');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.dev-nav__tab');
    if (!tab) return;
    switchGroup(tab.dataset.group);
  });
}

function switchGroup(group) {
  D.activeGroup = group;
  document.querySelectorAll('.dev-nav__tab').forEach(t =>
    t.classList.toggle('dev-nav__tab--active', t.dataset.group === group));
  document.querySelectorAll('.dev-group').forEach(g =>
    g.classList.toggle('dev-group--active', g.id === `dev-group-${group}`));
  renderGroup(group);
}

// ── 分组渲染分发 ──

function renderGroup(group) {
  switch (group) {
    case 'visual':  renderVisualGroup(); break;
    case 'perf':    renderPerfGroup(); break;
    case 'gamepad': renderGamepadGroup(); break;
    case 'presets': renderPresetsGroup(); break;
  }
}

// ═══════════════════════════════════════════
// Group 1: 视觉 — CSS 变量实时调节
// ═══════════════════════════════════════════

function renderVisualGroup() {
  const el = document.getElementById('dev-group-visual');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  const style = getComputedStyle(document.documentElement);

  const html = `
    <div class="dev-section">
      <div class="dev-section__title">颜色</div>
      ${makeColorRow('--accent', '强调色', style)}
      ${makeColorRow('--bg', '背景色', style)}
      ${makeColorRow('--bg-deep', '深色背景', style)}
      ${makeColorRow('--text', '主文字', style)}
      ${makeColorRow('--text-2', '次文字', style)}
      ${makeColorRow('--text-3', '三级文字', style)}
    </div>
    <div class="dev-section">
      <div class="dev-section__title">圆角</div>
      ${makeSliderRow('--radius', '大圆角', style, 0, 40, 'px')}
      ${makeSliderRow('--radius-sm', '小圆角', style, 0, 30, 'px')}
      ${makeSliderRow('--radius-pill', '胶囊圆角', style, 20, 200, 'px')}
    </div>
    <div class="dev-section">
      <div class="dev-section__title">布局</div>
      ${makeSliderRow('--thumb-card-size', '缩略图尺寸', style, 120, 600, 'px')}
      ${makeSliderRow('--font-scale', '字号缩放', style, 0.8, 1.5, 'x', 0.05, 2)}
    </div>
    <div class="dev-section">
      <div class="dev-section__title">动画</div>
      ${makeSliderRow('--anim-speed', '动画速度', style, 0.1, 5, 'x', 0.1, 1)}
      <div class="dev-row">
        <span class="dev-row__label">全部动画</span>
        <button class="dev-toggle dev-toggle--on" id="dev-toggle-anim" data-key="anim"></button>
      </div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">毛玻璃</div>
      ${makeSliderRow('--glass-blur', '模糊量', style, 0, 60, 'px')}
    </div>
    <div class="dev-section">
      <div class="dev-section__title">调试</div>
      <div class="dev-row">
        <span class="dev-row__label">元素轮廓</span>
        <button class="dev-toggle" id="dev-toggle-outline" data-key="outline"></button>
      </div>
      <div class="dev-row" style="margin-top:4px">
        <span class="dev-row__label">网格线</span>
        <button class="dev-toggle" id="dev-toggle-grid-lines" data-key="grid-lines"></button>
      </div>
    </div>
  `;
  el.innerHTML = html;
  bindVisualControls(el);
}

function makeColorRow(key, label, style) {
  const val = style.getPropertyValue(key).trim();
  return `<div class="dev-row">
    <span class="dev-row__label">${label}</span>
    <input type="color" class="dev-color" data-css="${key}" value="${val}">
    <span class="dev-row__value">${val}</span>
  </div>`;
}

function makeSliderRow(key, label, style, min, max, unit, step, decimals) {
  const raw = style.getPropertyValue(key).trim();
  const num = parseFloat(raw) || min;
  const s = step || (max - min > 100 ? 5 : 1);
  const d = decimals != null ? decimals : (s < 1 ? 2 : 0);
  return `<div class="dev-row">
    <span class="dev-row__label">${label}</span>
    <input type="range" class="dev-slider" data-css="${key}" min="${min}" max="${max}" step="${s}" value="${num}">
    <span class="dev-row__value" data-display="${key}" data-unit="${unit}" data-decimals="${d}">${num.toFixed(d)}${unit}</span>
    <button class="dev-btn" data-reset="${key}" title="重置">↺</button>
  </div>`;
}

function bindVisualControls(el) {
  // 颜色
  el.querySelectorAll('.dev-color').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.css;
      document.documentElement.style.setProperty(key, input.value);
      const row = input.closest('.dev-row');
      if (row) {
        const valEl = row.querySelector('.dev-row__value');
        if (valEl) valEl.textContent = input.value;
      }
    });
  });
  // 滑块
  el.querySelectorAll('.dev-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.css;
      const val = parseFloat(slider.value);
      const display = slider.parentElement.querySelector(`[data-display="${key}"]`);
      const unit = display ? display.dataset.unit : '';
      const d = display ? parseInt(display.dataset.decimals) || 0 : 0;
      document.documentElement.style.setProperty(key, val + unit);
      if (display) display.textContent = val.toFixed(d) + unit;
    });
  });
  // 重置按钮
  el.querySelectorAll('.dev-btn[data-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.reset;
      const def = CSS_DEFAULTS[key];
      if (!def) return;
      document.documentElement.style.setProperty(key, def);

      // 特殊变量的额外清理
      if (key === '--font-scale') {
        document.documentElement.style.fontSize = '';
      }
      if (key === '--anim-speed') {
        const s = document.getElementById('dev-anim-speed');
        if (s) s.remove();
        const animToggle = el.querySelector('#dev-toggle-anim');
        if (animToggle && !animToggle.classList.contains('dev-toggle--on')) {
          animToggle.classList.add('dev-toggle--on');
          const ds = document.getElementById('dev-anim-disable');
          if (ds) ds.remove();
        }
      }
      if (key === '--glass-blur') {
        const s = document.getElementById('dev-glass-blur-style');
        if (s) s.remove();
      }
      // 同步控件
      const slider = el.querySelector(`.dev-slider[data-css="${key}"]`);
      const color = el.querySelector(`.dev-color[data-css="${key}"]`);
      if (slider) {
        const num = parseFloat(def) || 0;
        slider.value = num;
        const display = slider.parentElement.querySelector(`[data-display="${key}"]`);
        if (display) {
          const unit = display.dataset.unit || '';
          const d = parseInt(display.dataset.decimals) || 0;
          display.textContent = num.toFixed(d) + unit;
        }
      }
      if (color) {
        color.value = def;
        const valEl = color.parentElement.querySelector('.dev-row__value');
        if (valEl) valEl.textContent = def;
      }
    });
  });
  // 动画开关 — 注入/移除全局 animation/transition 禁用样式
  const animToggle = el.querySelector('#dev-toggle-anim');
  if (animToggle) {
    // 恢复保存的状态
    const animSpeed = getComputedStyle(document.documentElement).getPropertyValue('--anim-speed').trim();
    if (animSpeed === '0') animToggle.classList.remove('dev-toggle--on');

    animToggle.addEventListener('click', () => {
      const on = animToggle.classList.toggle('dev-toggle--on');
      document.documentElement.style.setProperty('--anim-speed', on ? '1' : '0');
      if (on) {
        const s = document.getElementById('dev-anim-disable');
        if (s) s.remove();
      } else {
        let s = document.getElementById('dev-anim-disable');
        if (!s) {
          s = document.createElement('style'); s.id = 'dev-anim-disable';
          s.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
          document.head.appendChild(s);
        }
      }
      const slider = el.querySelector('.dev-slider[data-css="--anim-speed"]');
      if (slider) slider.value = on ? 1 : 0;
      const display = el.querySelector('[data-display="--anim-speed"]');
      if (display) display.textContent = on ? '1.0x' : '0.0x';
    });
  }

  // --font-scale 滑块：修改 html font-size（rem 基准）
  const fontScaleSlider = el.querySelector('.dev-slider[data-css="--font-scale"]');
  if (fontScaleSlider) {
    // 劫持 input 事件，同步修改 html font-size
    fontScaleSlider.addEventListener('input', () => {
      const val = parseFloat(fontScaleSlider.value);
      document.documentElement.style.fontSize = (val * 100) + '%';
      document.documentElement.style.setProperty('--font-scale', String(val));
    });
  }

  // --anim-speed 滑块：调整注入的全局动画速度
  const animSpeedSlider = el.querySelector('.dev-slider[data-css="--anim-speed"]');
  if (animSpeedSlider) {
    animSpeedSlider.addEventListener('input', () => {
      const val = parseFloat(animSpeedSlider.value);
      document.documentElement.style.setProperty('--anim-speed', String(val));
      // 移除旧的注入样式并创建新的
      let s = document.getElementById('dev-anim-speed');
      if (s) s.remove();
      s = document.createElement('style'); s.id = 'dev-anim-speed';
      // 通过 clip-path hack 无法通用控制 duration，用 CSS 变量在关键位置生效
      s.textContent = `:root { --_anim-mult: ${val}; }`;
      document.head.appendChild(s);
      // 如果 toggle 是 off 状态但 slider > 0，自动打开 toggle
      const animToggle = el.querySelector('#dev-toggle-anim');
      if (val > 0 && !animToggle.classList.contains('dev-toggle--on')) {
        animToggle.classList.add('dev-toggle--on');
        const disableStyle = document.getElementById('dev-anim-disable');
        if (disableStyle) disableStyle.remove();
      }
    });
  }

  // --glass-blur 滑块：注入 style 覆盖所有 backdrop-filter blur
  const glassBlurSlider = el.querySelector('.dev-slider[data-css="--glass-blur"]');
  if (glassBlurSlider) {
    glassBlurSlider.addEventListener('input', () => {
      const val = parseFloat(glassBlurSlider.value);
      document.documentElement.style.setProperty('--glass-blur', val + 'px');
      let s = document.getElementById('dev-glass-blur-style');
      if (s) s.remove();
      if (val > 0) {
        s = document.createElement('style'); s.id = 'dev-glass-blur-style';
        // 选择所有带 backdrop-filter 的元素，额外叠加 blur
        s.textContent = `[style*="backdrop-filter"], .sidebar, .dev-panel, .toolbar, .gallery__nav, .lightbox.active, .back-to-top { --_glass-blur-extra: ${val}px; }`;
        document.head.appendChild(s);
      }
    });
  }

  // 调试轮廓开关
  const outlineToggle = el.querySelector('#dev-toggle-outline');
  if (outlineToggle) {
    outlineToggle.addEventListener('click', () => {
      const on = outlineToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-outline-style';
        s.textContent = `* { outline: 0.5px solid rgba(200,168,124,0.15) !important; }`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-outline-style');
        if (s) s.remove();
      }
    });
  }
  // 网格线开关
  const gridToggle = el.querySelector('#dev-toggle-grid-lines');
  if (gridToggle) {
    gridToggle.addEventListener('click', () => {
      const on = gridToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-grid-style';
        s.textContent = `.main-area, .portfolio { background-image: linear-gradient(rgba(200,168,124,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,168,124,0.04) 1px, transparent 1px); background-size: 20px 20px; }`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-grid-style');
        if (s) s.remove();
      }
    });
  }
}

// ═══════════════════════════════════════════
// Group 2: 性能 — FPS / Memory / Console
// ═══════════════════════════════════════════

function renderPerfGroup() {
  const el = document.getElementById('dev-group-perf');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  el.innerHTML = `
    <div class="dev-section">
      <div class="dev-section__title">帧率</div>
      <div class="dev-fps-chart" id="dev-fps-chart"></div>
      <div class="dev-row" style="margin-top:4px">
        <span class="dev-row__label">FPS</span>
        <span class="dev-row__value" id="dev-fps-val">--</span>
      </div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">内存</div>
      <div class="dev-stat"><span class="dev-stat__label">已用堆</span><span class="dev-stat__value" id="dev-mem-used">--</span></div>
      <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">总堆</span><span class="dev-stat__value" id="dev-mem-total">--</span></div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">DOM</div>
      <div class="dev-stat"><span class="dev-stat__label">总节点</span><span class="dev-stat__value" id="dev-dom-nodes">--</span></div>
      <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">图片</span><span class="dev-stat__value" id="dev-dom-imgs">--</span></div>
      <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">加载时间</span><span class="dev-stat__value" id="dev-load-time">--</span></div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">控制台</div>
      <div class="dev-console" id="dev-console"></div>
    </div>
  `;
}

function startFPSMeter() {
  if (D.fpsRaf) return;
  D.fpsHistory = [];
  D.fpsLastTime = performance.now();
  let frameCount = 0;

  function tick(now) {
    frameCount++;
    if (now - D.fpsLastTime >= 500) {
      const fps = Math.round(frameCount / ((now - D.fpsLastTime) / 1000));
      D.fpsHistory.push(fps);
      if (D.fpsHistory.length > FPS_MAX) D.fpsHistory.shift();
      frameCount = 0;
      D.fpsLastTime = now;
      updateFPSUI(fps);
    }
    D.fpsRaf = requestAnimationFrame(tick);
  }
  D.fpsRaf = requestAnimationFrame(tick);
}

function updateFPSUI(fps) {
  const valEl = document.getElementById('dev-fps-val');
  const chart = document.getElementById('dev-fps-chart');
  if (valEl) {
    valEl.textContent = fps;
    valEl.style.color = fps >= 55 ? 'var(--accent)' : fps >= 30 ? '#e8c870' : '#e87070';
  }
  if (chart && D.fpsHistory.length > 0) {
    const maxFps = Math.max(60, ...D.fpsHistory);
    chart.innerHTML = D.fpsHistory.map(v => {
      const h = Math.max(2, (v / maxFps) * 100);
      const c = v >= 55 ? 'var(--accent)' : v >= 30 ? '#e8c870' : '#e87070';
      return `<div class="dev-fps-bar" style="height:${h}%;background:${c}"></div>`;
    }).join('');
  }
}

function startPerfMonitor() {
  if (D.perfInterval) return;
  function update() {
    const memUsed = document.getElementById('dev-mem-used');
    const memTotal = document.getElementById('dev-mem-total');
    const domNodes = document.getElementById('dev-dom-nodes');
    const domImgs = document.getElementById('dev-dom-imgs');
    const loadTime = document.getElementById('dev-load-time');

    if (performance.memory) {
      if (memUsed) memUsed.textContent = (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB';
      if (memTotal) memTotal.textContent = (performance.memory.totalJSHeapSize / 1048576).toFixed(1) + ' MB';
    } else {
      if (memUsed) memUsed.textContent = 'N/A';
      if (memTotal) memTotal.textContent = 'N/A';
    }
    if (domNodes) domNodes.textContent = document.getElementsByTagName('*').length;
    if (domImgs) domImgs.textContent = document.querySelectorAll('img').length;
    if (loadTime) {
      const [nav] = performance.getEntriesByType('navigation');
      if (nav && nav.loadEventEnd) {
        loadTime.textContent = ((nav.loadEventEnd - nav.fetchStart) / 1000).toFixed(2) + 's';
      } else {
        loadTime.textContent = (performance.now() / 1000).toFixed(1) + 's (uptime)';
      }
    }
  }
  update();
  D.perfInterval = setInterval(update, 1000);
}

function startConsoleCapture() {
  if (D.consoleOrig.log) return; // already captured
  const methods = ['log', 'warn', 'error', 'debug'];
  methods.forEach(m => {
    D.consoleOrig[m] = console[m];
    console[m] = (...args) => {
      D.consoleOrig[m](...args);
      D.consoleBuffer.push({ type: m, text: args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a); }
        catch { return String(a); }
      }).join(' '), time: Date.now() });
      if (D.consoleBuffer.length > CONSOLE_MAX) D.consoleBuffer.shift();
    };
  });
  // 每 500ms 刷新 UI
  if (!D._consoleRefreshInterval) {
    D._consoleRefreshInterval = setInterval(updateConsoleUI, 500);
  }
}

function stopConsoleCapture() {
  if (!D.consoleOrig.log) return;
  ['log', 'warn', 'error', 'debug'].forEach(m => {
    console[m] = D.consoleOrig[m];
    D.consoleOrig[m] = null;
  });
  if (D._consoleRefreshInterval) {
    clearInterval(D._consoleRefreshInterval);
    D._consoleRefreshInterval = null;
  }
}

function updateConsoleUI() {
  const el = document.getElementById('dev-console');
  if (!el) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  el.innerHTML = D.consoleBuffer.map(l =>
    `<div class="dev-console__line dev-console__line--${l.type}">[${new Date(l.time).toLocaleTimeString()}] ${l.text}</div>`
  ).join('');
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

// ═══════════════════════════════════════════
// Group 3: 手柄 — 状态可视化
// ═══════════════════════════════════════════

const GP_BTN_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', '↑', '↓', '←', '→'];

function renderGamepadGroup() {
  const el = document.getElementById('dev-group-gamepad');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  el.innerHTML = `
    <div class="dev-section">
      <div class="dev-section__title">连接</div>
      <div class="dev-stat"><span class="dev-stat__label" id="dev-gp-connected">未连接</span></div>
      <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">ID</span><span class="dev-stat__value" id="dev-gp-id">--</span></div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">按钮</div>
      <div class="dev-gp-grid" id="dev-gp-btn-grid"></div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">摇杆 & 扳机</div>
      <div class="dev-row" style="gap:24px">
        <div>
          <div class="dev-stick" id="dev-stick-l"><div class="dev-stick__cross-h"></div><div class="dev-stick__cross-v"></div><div class="dev-stick__dot" style="left:50%;top:50%"></div></div>
          <div class="dev-stick__label">左摇杆</div>
        </div>
        <div>
          <div class="dev-stick" id="dev-stick-r"><div class="dev-stick__cross-h"></div><div class="dev-stick__cross-v"></div><div class="dev-stick__dot" style="left:50%;top:50%"></div></div>
          <div class="dev-stick__label">右摇杆</div>
        </div>
      </div>
      <div class="dev-row" style="margin-top:12px;gap:16px">
        <div style="flex:1"><div class="dev-row__label" style="margin-bottom:4px">LT</div><div class="dev-trigger"><div class="dev-trigger__fill" id="dev-trigger-lt" style="width:0%"></div></div></div>
        <div style="flex:1"><div class="dev-row__label" style="margin-bottom:4px">RT</div><div class="dev-trigger"><div class="dev-trigger__fill" id="dev-trigger-rt" style="width:0%"></div></div></div>
      </div>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">事件日志</div>
      <div class="dev-console" id="dev-gp-log" style="height:100px"></div>
    </div>
  `;

  // 初始化按钮网格
  const grid = el.querySelector('#dev-gp-btn-grid');
  if (grid) {
    grid.innerHTML = GP_BTN_NAMES.map(n => `<div class="dev-gp-btn" data-btn="${n}">${n}</div>`).join('');
  }
}

function startGamepadVizPoll() {
  if (D.gamepadPollRaf) return;
  function poll() {
    if (!D.open || D.activeGroup !== 'gamepad') {
      D.gamepadPollRaf = requestAnimationFrame(poll);
      return;
    }
    const gps = navigator.getGamepads();
    const gp = gps[0]; // 只用第一个
    const connEl = document.getElementById('dev-gp-connected');
    const idEl = document.getElementById('dev-gp-id');

    if (gp) {
      if (connEl) { connEl.textContent = '已连接'; connEl.style.color = 'var(--accent)'; }
      if (idEl) idEl.textContent = gp.id;

      // 按钮网格
      const grid = document.getElementById('dev-gp-btn-grid');
      if (grid) {
        grid.querySelectorAll('.dev-gp-btn').forEach(el => {
          const name = el.dataset.btn;
          const idx = GP_BTN_NAMES.indexOf(name);
          const pressed = idx >= 0 && idx < gp.buttons.length && gp.buttons[idx].pressed;
          el.classList.toggle('dev-gp-btn--on', pressed);
        });
      }

      // 摇杆
      updateStick('dev-stick-l', gp.axes[0], gp.axes[1]);
      updateStick('dev-stick-r', gp.axes[2], gp.axes[3]);

      // 扳机
      const ltEl = document.getElementById('dev-trigger-lt');
      const rtEl = document.getElementById('dev-trigger-rt');
      if (ltEl) ltEl.style.width = Math.round((gp.buttons[6] ? gp.buttons[6].value : 0) * 100) + '%';
      if (rtEl) rtEl.style.width = Math.round((gp.buttons[7] ? gp.buttons[7].value : 0) * 100) + '%';

      // 事件日志：检查按钮变化
      gp.buttons.forEach((b, i) => {
        const prev = D._gpPrevBtns && D._gpPrevBtns[i];
        if (prev !== undefined && prev !== b.pressed) {
          const name = GP_BTN_NAMES[i] || `Btn${i}`;
          D.gpEventLog.push({ text: `${name} ${b.pressed ? '↓' : '↑'}`, time: Date.now() });
          if (D.gpEventLog.length > GP_EVENT_MAX) D.gpEventLog.shift();
          updateGPLog();
        }
      });
      D._gpPrevBtns = gp.buttons.map(b => b.pressed);
    } else {
      if (connEl) { connEl.textContent = '未连接'; connEl.style.color = 'var(--text-3)'; }
      if (idEl) idEl.textContent = '--';
      D._gpPrevBtns = null;
    }

    D.gamepadPollRaf = requestAnimationFrame(poll);
  }
  D.gamepadPollRaf = requestAnimationFrame(poll);
}

function updateStick(id, x, y) {
  const stick = document.getElementById(id);
  if (!stick) return;
  const dot = stick.querySelector('.dev-stick__dot');
  if (!dot) return;
  dot.style.left = (50 + (x || 0) * 50) + '%';
  dot.style.top = (50 + (y || 0) * 50) + '%';
}

function updateGPLog() {
  const el = document.getElementById('dev-gp-log');
  if (!el) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  el.innerHTML = D.gpEventLog.map(l =>
    `<div class="dev-console__line dev-console__line--info">[${new Date(l.time).toLocaleTimeString()}] ${l.text}</div>`
  ).join('');
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

// ═══════════════════════════════════════════
// Group 4: 预设
// ═══════════════════════════════════════════

function getPresets() {
  try { const d = localStorage.getItem(PRESETS_KEY); return d ? JSON.parse(d) : []; }
  catch { return []; }
}

function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function getCurrentCSSSnapshot() {
  const style = getComputedStyle(document.documentElement);
  const vars = {};
  CSS_VAR_KEYS.forEach(k => { vars[k] = style.getPropertyValue(k).trim(); });
  return vars;
}

function savePreset(name) {
  if (!name || !name.trim()) return;
  const presets = getPresets();
  const vars = getCurrentCSSSnapshot();
  presets.push({ id: Date.now().toString(36), name: name.trim(), builtin: false, vars });
  savePresets(presets);
  renderPresetsGroup();
}

function loadPreset(preset) {
  if (!preset || !preset.vars) return;
  Object.entries(preset.vars).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
  // 特殊变量：同步实际生效的属性
  const fs = preset.vars['--font-scale'];
  document.documentElement.style.fontSize = (fs && fs !== '1') ? (parseFloat(fs) * 100) + '%' : '';
  // 清理并重建注入样式以匹配预设值
  ['dev-anim-speed','dev-anim-disable','dev-glass-blur-style'].forEach(id => {
    const s = document.getElementById(id); if (s) s.remove();
  });
  const ab = preset.vars['--glass-blur'];
  if (ab && parseFloat(ab) > 0) {
    const s = document.createElement('style'); s.id = 'dev-glass-blur-style';
    s.textContent = `[style*="backdrop-filter"], .sidebar, .dev-panel, .toolbar, .gallery__nav, .lightbox.active, .back-to-top { --_glass-blur-extra: ${parseFloat(ab)}px; }`;
    document.head.appendChild(s);
  }
  // 记录激活预设
  localStorage.setItem(ACTIVE_PRESET_KEY, preset.id);
  // 如果视觉分组已渲染，重新同步控件值
  syncVisualControls();
  renderPresetsGroup();
}

function deletePreset(id) {
  let presets = getPresets();
  presets = presets.filter(p => p.id !== id);
  savePresets(presets);
  renderPresetsGroup();
}

function exportPreset(preset) {
  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${preset.name}.lens-preset.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importPreset() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ filters: [{ name: '预设', extensions: ['json'] }], multiple: false });
    if (selected) {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke('read_text_file', { path: selected });
      const preset = JSON.parse(content);
      if (!preset.vars) throw new Error('无效预设格式');
      const presets = getPresets();
      preset.id = Date.now().toString(36);
      preset.builtin = false;
      presets.push(preset);
      savePresets(presets);
      renderPresetsGroup();
    }
  } catch (e) {
    // 回退方案：使用 HTML input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const preset = JSON.parse(reader.result);
          if (!preset.vars) throw new Error('无效预设格式');
          const presets = getPresets();
          preset.id = Date.now().toString(36);
          preset.builtin = false;
          presets.push(preset);
          savePresets(presets);
          renderPresetsGroup();
        } catch (err) { console.warn('导入预设失败:', err); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

function syncVisualControls() {
  const el = document.getElementById('dev-group-visual');
  if (!el || !el.dataset.rendered) return;
  const style = getComputedStyle(document.documentElement);
  el.querySelectorAll('.dev-color[data-css]').forEach(c => {
    c.value = style.getPropertyValue(c.dataset.css).trim();
    const valEl = c.parentElement.querySelector('.dev-row__value');
    if (valEl) valEl.textContent = c.value;
  });
  el.querySelectorAll('.dev-slider[data-css]').forEach(s => {
    const raw = style.getPropertyValue(s.dataset.css).trim();
    const num = parseFloat(raw) || 0;
    s.value = num;
    const key = s.dataset.css;
    const display = s.parentElement.querySelector(`[data-display="${key}"]`);
    if (display) {
      const unit = display.dataset.unit || '';
      const d = parseInt(display.dataset.decimals) || 0;
      display.textContent = num.toFixed(d) + unit;
    }
  });
}

function renderPresetsGroup() {
  const el = document.getElementById('dev-group-presets');
  if (!el) return;

  const presets = getPresets();
  const activeId = localStorage.getItem(ACTIVE_PRESET_KEY);
  const allPresets = [...BUILTIN_PRESETS, ...presets];

  let html = `
    <div class="dev-section">
      <div class="dev-section__title">内置预设</div>
      ${BUILTIN_PRESETS.map(p => makePresetCard(p, activeId, false)).join('')}
    </div>
    <div class="dev-section">
      <div class="dev-section__title">保存预设</div>
      <div class="dev-row">
        <input class="dev-input" id="dev-preset-name" placeholder="预设名称..." maxlength="30">
        <button class="dev-btn dev-btn--accent" id="dev-preset-save">保存</button>
      </div>
    </div>
  `;

  if (presets.length > 0) {
    html += `
      <div class="dev-section">
        <div class="dev-section__title">我的预设</div>
        ${presets.map(p => makePresetCard(p, activeId, true)).join('')}
      </div>
    `;
  }

  html += `
    <div class="dev-section">
      <div class="dev-section__title">导入/导出</div>
      <div class="dev-row" style="gap:8px">
        <button class="dev-btn" id="dev-preset-import">导入文件</button>
        <button class="dev-btn dev-btn--danger" id="dev-preset-reset">重置全部</button>
      </div>
    </div>
  `;

  // 仅更新动态内容，保留 section 结构
  el.innerHTML = html;

  // 绑定事件
  const saveBtn = document.getElementById('dev-preset-save');
  const nameInput = document.getElementById('dev-preset-name');
  if (saveBtn && nameInput) {
    saveBtn.addEventListener('click', () => { savePreset(nameInput.value); nameInput.value = ''; });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { savePreset(nameInput.value); nameInput.value = ''; }
    });
  }

  document.getElementById('dev-preset-import')?.addEventListener('click', importPreset);
  document.getElementById('dev-preset-reset')?.addEventListener('click', () => {
    loadPreset(BUILTIN_PRESETS[0]);
  });

  // 预设卡片事件
  el.querySelectorAll('.dev-preset-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.dev-preset-card__act')) return; // action button
      const id = card.dataset.id;
      const preset = allPresets.find(p => p.id === id);
      if (preset) loadPreset(preset);
    });
  });

  // 删除/导出按钮
  el.querySelectorAll('.dev-preset-card__act[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.dev-preset-card').dataset.id;
      deletePreset(id);
    });
  });
  el.querySelectorAll('.dev-preset-card__act[data-action="export"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.dev-preset-card').dataset.id;
      const preset = [...BUILTIN_PRESETS, ...presets].find(p => p.id === id);
      if (preset) exportPreset(preset);
    });
  });
}

function makePresetCard(preset, activeId, showActions) {
  const vars = preset.vars || {};
  const accent = vars['--accent'] || '#c8a87c';
  const bg = vars['--bg'] || '#0a0a08';
  const text = vars['--text'] || '#e8e4e0';
  const isActive = activeId === preset.id;

  return `
    <div class="dev-preset-card${isActive ? ' dev-preset-card--active' : ''}" data-id="${preset.id}">
      <div class="dev-preset-card__swatches">
        <span class="dev-preset-card__swatch" style="background:${accent}" title="accent"></span>
        <span class="dev-preset-card__swatch" style="background:${bg}" title="bg"></span>
        <span class="dev-preset-card__swatch" style="background:${text}" title="text"></span>
      </div>
      <span class="dev-preset-card__name">${preset.name}</span>
      ${preset.builtin ? '<span class="dev-preset-card__badge">内置</span>' : ''}
      ${showActions ? `
        <div class="dev-preset-card__actions">
          <button class="dev-preset-card__act" data-action="export" title="导出">⬇</button>
          <button class="dev-preset-card__act" data-action="delete" title="删除">✕</button>
        </div>
      ` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════
// 监视器生命周期
// ═══════════════════════════════════════════

function startAllMonitors() {
  startFPSMeter();
  startPerfMonitor();
  startConsoleCapture();
  startGamepadVizPoll();
}

function stopAllMonitors() {
  if (D.fpsRaf) { cancelAnimationFrame(D.fpsRaf); D.fpsRaf = null; }
  if (D.gamepadPollRaf) { cancelAnimationFrame(D.gamepadPollRaf); D.gamepadPollRaf = null; }
  if (D.perfInterval) { clearInterval(D.perfInterval); D.perfInterval = null; }
  stopConsoleCapture();
  // 清理所有注入的 style 元素（关闭面板时不应残留调试/动画覆盖样式）
  ['dev-anim-speed','dev-anim-disable','dev-glass-blur-style','dev-outline-style','dev-grid-style'].forEach(id => {
    const s = document.getElementById(id);
    if (s) s.remove();
  });
}

// ═══════════════════════════════════════════
// 初始化入口
// ═══════════════════════════════════════════

export function initDevPanel() {
  // 捕获 CSS 默认值
  const style = getComputedStyle(document.documentElement);
  CSS_VAR_KEYS.forEach(k => { CSS_DEFAULTS[k] = style.getPropertyValue(k).trim(); });

  setupDevPanelEvents();
  setupDevTabs();

  // 暴露全局 toggle 供 gamepad.js 调用
  window.__lensToggleDev = toggleDevPanel;

  console.log('[DevPanel] 初始化完成 — Ctrl+Shift+D 打开');
}
