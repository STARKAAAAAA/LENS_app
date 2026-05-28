/* ═══════════════════════════════════════════════════════
   液态玻璃逐面板自适应 — IPC 主进程亮度采样
   架构与透镜一致: 2档/恒定brightness/frost opacity过渡/串行IPC
   ═══════════════════════════════════════════════════════ */

import { PANEL_DEFS } from './lg-panels.js';

let _active = false;
let _ticking = false;
let _scrollTimer = 0;
let _resizeTimer = 0;
let _domObserver = null;
let _sampling = false;
let _gridCache = null;
let _textStyleEl = null;

// 所有面板统一自适应采样
const _forceDark = new Set();

// 折叠/隐藏时不采样
function _isVisible(id, el) {
  if (id === 'sidebar') {
    const frame = document.querySelector('.sidebar-frame');
    if (frame && !frame.classList.contains('sidebar--open')) return false;
  }
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  if (el.offsetWidth < 5 || el.offsetHeight < 5) return false;
  return true;
}

// 两档阈值（与透镜同步）
let _adThresh = 0.5;
// 逐面板文字模式: 'white' | 'black' | 'adaptive'，默认 white
const _panelTextModes = new Map();
// 透镜文字模式
let _lensTextMode = 'white';

// ── 根据模式 + 亮度计算全部可见颜色 ──
function _textColors(mode, isDark) {
  // 决定主色: white→白系, black→黑系, adaptive→跟随背景
  const light = mode === 'white' || (mode === 'adaptive' && isDark);
  const alpha = light ? '255,255,255' : '18,18,18';
  const borderAlpha = light ? '255,255,255' : '18,18,18';
  return {
    t1: `rgba(${alpha},0.94)`,
    t2: `rgba(${alpha},0.82)`,
    t3: `rgba(${alpha},0.64)`,
    // accent → 跟随模式
    accent: `rgba(${alpha},0.62)`,
    accentRgb: light ? '255,255,255' : '18,18,18',
    // 玻璃边框/背景 — 也跟随模式
    glassBorder: `rgba(${borderAlpha},0.14)`,
    glassBorderBright: `rgba(${borderAlpha},0.25)`,
    glassBgHover: `rgba(${borderAlpha},0.10)`,
    // text-shadow
    shadow: light ? (isDark ? '0 1px 4px rgba(0,0,0,0.35)' : '0 1px 2px rgba(255,255,255,0.1)')
                  : '0 1px 2px rgba(255,255,255,0.1)',
  };
}

function _onScroll() { clearTimeout(_scrollTimer); _scrollTimer = setTimeout(_scheduleUpdate, 150); }
function _onResize() { clearTimeout(_resizeTimer); _resizeTimer = setTimeout(_scheduleUpdate, 200); }

/* ── 主进程 IPC 全屏采样 ── */
async function _sampleGrid() {
  if (!window.electronAPI) return null;
  try {
    _gridCache = await window.electronAPI.invoke('screen:luma-grid', 30, 15, 15);
    return _gridCache;
  } catch (_) { return null; }
}

function _lookupLuminance(el) {
  if (!_gridCache || !_gridCache.data) return null;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const g = _gridCache;
  const sx = g.width / window.innerWidth;
  const sy = g.height / window.innerHeight;
  const col = Math.floor((cx * sx - g.offsetX) / g.step);
  const row = Math.floor((cy * sy - g.offsetY) / g.step);
  if (col < 0 || col >= g.cols || row < 0 || row >= g.rows) return null;
  return g.data[row * g.cols + col];
}

/* ── 注入面板文字过渡样式（一次性） ── */
function _ensureTextStyle() {
  if (_textStyleEl) return;
  _textStyleEl = document.createElement('style');
  _textStyleEl.id = '__lg_adaptive_text';
  const sels = PANEL_DEFS.map(d => d.sel).join(',');
  _textStyleEl.textContent = "";
}

function _removeTextStyle() {
  if (_textStyleEl) { _textStyleEl.remove(); _textStyleEl = null; }
}

/* ── 应用 2 档自适应 ── */
function _applyLuminance(id, lum) {
  if (lum === null || lum === undefined) return;
  const isDark = lum < _adThresh;
  const brightness = 1.1;
  const bgAlpha = isDark ? 0 : 0.18;
  const mode = _panelTextModes.get(id) || 'white';
  const tc = _textColors(mode, isDark);

  const def = PANEL_DEFS.find(p => p.id === id);
  if (!def) return;

  document.querySelectorAll(def.sel).forEach(el => {
    // 只设自适应背景变量，不改文字——文字由 :root / Dev 面板统一管控
    el.style.setProperty('--lg-brightness', brightness, 'important');
    el.style.setProperty('--lg-bg-alpha', bgAlpha, 'important');
    // text-shadow 跟随背景亮度
    el.style.setProperty('--lg-text-shadow', tc.shadow, 'important');
    // 只有用户显式选了「黑」或「自适应」模式才覆盖文字和强调色
    if (mode !== 'white') {
      el.style.setProperty('--text', tc.t1, 'important');
      el.style.setProperty('--text-2', tc.t2, 'important');
      el.style.setProperty('--text-3', tc.t3, 'important');
      el.style.setProperty('--accent', tc.accent, 'important');
      el.style.setProperty('--accent-rgb', tc.accentRgb, 'important');
      el.style.setProperty('--glass-border', tc.glassBorder, 'important');
      el.style.setProperty('--glass-border-bright', tc.glassBorderBright, 'important');
      el.style.setProperty('--glass-bg-hover', tc.glassBgHover, 'important');
    }
  });
}

/* ── 公开 API ── */

async function updateAllPanels() {
  if (!_active || _sampling) return;
  _sampling = true;

  try {
    const grid = await _sampleGrid();
    if (!grid) { _sampling = false; return; }

    for (const def of PANEL_DEFS) {
      const el = document.querySelector(def.sel);
      if (!el || !_isVisible(def.id, el)) continue;

      let lum;
      if (_forceDark.has(def.id)) {
        lum = 0.1;
      } else {
        lum = _lookupLuminance(el);
        if (lum === null) lum = 0.5; // 未知→中位阈值
      }
      _applyLuminance(def.id, lum);
    }
  } catch (_) {}
  _sampling = false;
}

function _scheduleUpdate() {
  if (_ticking) return;
  _ticking = true;
  requestAnimationFrame(() => {
    _ticking = false;
    updateAllPanels();
  });
}

export function initAdaptiveGlass() {
  if (_active) return;
  _active = true;
  _ensureTextStyle();

  // 初始只设 shadow（文字由 :root 预设管控）
  PANEL_DEFS.forEach(def => {
    document.querySelectorAll(def.sel).forEach(el => {
      el.style.setProperty('--lg-text-shadow', '0 1px 4px rgba(0,0,0,0.35)', 'important');
    });
  });

  window.addEventListener('scroll', _onScroll, { passive: true });
  window.addEventListener('resize', _onResize);

  _domObserver = new MutationObserver(() => _scheduleUpdate());
  _domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  updateAllPanels();
}

export function stopAdaptiveGlass() {
  _active = false;
  clearTimeout(_scrollTimer);
  clearTimeout(_resizeTimer);
  window.removeEventListener('scroll', _onScroll);
  window.removeEventListener('resize', _onResize);
  if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }
  _gridCache = null;
  _removeTextStyle();

  PANEL_DEFS.forEach(def => {
    document.querySelectorAll(def.sel).forEach(el => {
      el.style.removeProperty('--lg-brightness');
      el.style.removeProperty('--lg-bg-alpha');
      const keys = ['--lg-brightness','--lg-bg-alpha','--lg-text-shadow',
        '--text','--text-2','--text-3','--accent','--accent-rgb',
        '--glass-border','--glass-border-bright','--glass-bg-hover'];
      keys.forEach(k => el.style.removeProperty(k));
    });
  });
}

/* ── 阈值同步 ── */
export function setAdaptiveThreshold(v) { _adThresh = v; }

/* ── 逐面板 / 透镜文字模式 ── */
export function setLensTextMode(mode) { _lensTextMode = mode; return mode; }
export function getLensTextMode() { return _lensTextMode; }

export function setPanelTextMode(id, mode) {
  const prevMode = _panelTextModes.get(id) || 'white';
  _panelTextModes.set(id, mode);
  const def = PANEL_DEFS.find(p => p.id === id);
  if (!def) return;
  const el = document.querySelector(def.sel);
  if (!el || !_isVisible(id, el)) return;

  // 切回白色 → 移除内联文字变量，让 :root / Dev 面板接管
  if (mode === 'white') {
    ['--text','--text-2','--text-3','--accent','--accent-rgb','--glass-border','--glass-border-bright','--glass-bg-hover'].forEach(k => {
      el.style.removeProperty(k);
    });
    // 仍然应用背景自适应
    const lum = _forceDark.has(id) ? 0.1 : (_lookupLuminance(el) || 0.5);
    _applyLuminance(id, lum);
    return;
  }

  // 黑或自适应 → 写入内联变量
  const lum = _forceDark.has(id) ? 0.1 : (_lookupLuminance(el) || 0.5);
  _applyLuminance(id, lum);
}
export function getPanelTextMode(id) { return _panelTextModes.get(id) || 'white'; }

/* ── 透镜文字颜色（被 lg-studio 的 _applyTarget 调用） ── */
export function getLensTextColors(lum) {
  const isDark = lum < _adThresh;
  return _textColors(_lensTextMode, isDark);
}

export { updateAllPanels };
