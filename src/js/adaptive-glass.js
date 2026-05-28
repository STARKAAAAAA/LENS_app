/* ═══════════════════════════════════════════════════════
   液态玻璃自适应 — 统一 CSS 变量枢纽
   所有文字颜色通过 var(--text)/var(--text-2)/var(--text-3) 级联
   IPC 主进程亮度采样, 2 档阈值, frost opacity 过渡
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

const _forceDark = new Set();

// ── 两档阈值 ──
let _adThresh = 0.5;
// 逐面板文字模式: 'white' | 'black' | 'adaptive'，默认 adaptive（自动跟随背景）
const _panelTextModes = new Map();
// 透镜文字模式 — 默认 adaptive
let _lensTextMode = 'adaptive';

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

// ── 根据模式 + 亮度计算文字色 ──
function _textColors(mode, isDark) {
  const light = mode === 'white' || (mode === 'adaptive' && isDark);
  const alpha = light ? '255,255,255' : '0,0,0';
  return {
    t1: `rgba(${alpha},0.94)`,
    t2: `rgba(${alpha},0.82)`,
    t3: `rgba(${alpha},0.64)`,
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
  const g = _gridCache;
  const sx = g.width / window.innerWidth;
  const sy = g.height / window.innerHeight;

  // 多样本点采样：大面板沿长轴采样多点取平均
  const samples = [];
  const hCount = Math.min(5, Math.max(1, Math.floor(r.width / 60)));   // 水平
  const vCount = Math.min(5, Math.max(1, Math.floor(r.height / 80))); // 垂直
  for (let vi = 0; vi < vCount; vi++) {
    for (let hi = 0; hi < hCount; hi++) {
      const px = r.left + r.width * (hi + 0.5) / hCount;
      const py = r.top + r.height * (vi + 0.5) / vCount;
      const col = Math.floor((px * sx - g.offsetX) / g.step);
      const row = Math.floor((py * sy - g.offsetY) / g.step);
      if (col >= 0 && col < g.cols && row >= 0 && row < g.rows) {
        samples.push(g.data[row * g.cols + col]);
      }
    }
  }
  if (samples.length === 0) return null;
  // 多数投票：暗样本过半 → 暗背景，避免上下明暗不一被平均
  const darkCount = samples.filter(v => v < _adThresh).length;
  if (darkCount > samples.length / 2) {
    // 暗背景：取暗样本的中位数（排除少数亮样本干扰）
    const darks = samples.filter(v => v < _adThresh).sort((a,b)=>a-b);
    return darks[Math.floor(darks.length / 2)];
  } else {
    // 亮背景：取亮样本的中位数
    const lights = samples.filter(v => v >= _adThresh).sort((a,b)=>a-b);
    return lights[Math.floor(lights.length / 2)];
  }
}

/* ── JS 驱动平滑过渡（零 CSS transition 注入，不干扰面板动画）── */
function _ensureTextStyle() {
  if (_textStyleEl) return;
  _textStyleEl = document.createElement('style');
  _textStyleEl.id = '__lg_adaptive_text';
  _textStyleEl.textContent = ':root { --lg-text-speed: 1s; }';
  document.head.appendChild(_textStyleEl);
}

function _parseRgba(str) {
  const m = str && str.match(/rgba?\((\d+),(\d+),(\d+),?([\d.]+)?\)/);
  return m ? [ +m[1], +m[2], +m[3], +(m[4] || 1) ] : null;
}

function _interpRgba(from, to, t) {
  const a = _parseRgba(from), b = _parseRgba(to);
  if (!a || !b) return to;
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bb = Math.round(a[2] + (b[2] - a[2]) * t);
  const alpha = (a[3] + (b[3] - a[3]) * t).toFixed(3);
  return `rgba(${r},${g},${bb},${alpha})`;
}

function _animateTextVars(el, tc, durationSec) {
  const key = el;
  const existing = _textAnims.get(key);
  if (existing) cancelAnimationFrame(existing.rafId);

  const props = ['--text', '--text-2', '--text-3'];
  const targetVals = [tc.t1, tc.t2, tc.t3];
  const startVals = props.map(p => el.style.getPropertyValue(p) || getComputedStyle(el).getPropertyValue(p));

  // 如果所有值相同，跳过
  if (startVals.every((s, i) => s === targetVals[i])) return;

  const startTime = performance.now();
  const duration = durationSec * 1000;

  function step(now) {
    const raw = Math.min(1, (now - startTime) / duration);
    const t = raw * (2 - raw); // easeOut quad
    props.forEach((prop, i) => {
      el.style.setProperty(prop, _interpRgba(startVals[i], targetVals[i], t), 'important');
    });
    if (raw < 1) {
      _textAnims.set(key, { rafId: requestAnimationFrame(step) });
    } else {
      _textAnims.delete(key);
      props.forEach((prop, i) => {
        el.style.setProperty(prop, targetVals[i], 'important');
      });
    }
  }
  _textAnims.set(key, { rafId: requestAnimationFrame(step) });
}

function _removeTextStyle() {
  if (_textStyleEl) { _textStyleEl.remove(); _textStyleEl = null; }
}

/* ── 应用 2 档自适应（含 JS 动画锁定 + rAF 插值）── */
let _adSpeed = 1; // 过渡速度（秒）
const _locks = new Map(); // panelId → { locked, pending, timer }

function _currentBgAlpha(el) {
  const v = el.style.getPropertyValue('--lg-bg-alpha');
  return v ? parseFloat(v) : 0;
}

function _animateGlass(el, id, targetBgAlpha, tc, mode, speed) {
  // 取消该面板旧动画
  const old = _locks.get(id);
  if (old && old._rafId) cancelAnimationFrame(old._rafId);

  const startBg = _currentBgAlpha(el);
  const props = ['--text', '--text-2', '--text-3'];
  const targetT = [tc.t1, tc.t2, tc.t3];
  const startT = props.map(p => el.style.getPropertyValue(p) || getComputedStyle(el).getPropertyValue(p));
  const startTime = performance.now();
  const duration = speed * 1000;

  function step(now) {
    const raw = Math.min(1, (now - startTime) / duration);
    const t = raw * (2 - raw); // easeOut quad

    // 玻璃背景
    el.style.setProperty('--lg-bg-alpha', (startBg + (targetBgAlpha - startBg) * t).toFixed(3), 'important');
    // 文字颜色
    if (!window.__lensTextDirty && mode !== 'white') {
      props.forEach((prop, i) => {
        el.style.setProperty(prop, _interpRgba(startT[i], targetT[i], t), 'important');
      });
    }

    if (raw < 1) {
      const lock = _locks.get(id);
      if (lock) lock._rafId = requestAnimationFrame(step);
    } else {
      // 动画完成：写入终值，解锁，处理排队
      el.style.setProperty('--lg-bg-alpha', targetBgAlpha, 'important');
      if (!window.__lensTextDirty && mode !== 'white') {
        props.forEach((prop, i) => el.style.setProperty(prop, targetT[i], 'important'));
      }
      _finishAnim(id, el);
    }
  }

  const lock = _locks.get(id) || {};
  lock._rafId = requestAnimationFrame(step);
  _locks.set(id, lock);
}

function _finishAnim(id, el) {
  const lock = _locks.get(id);
  if (!lock) return;
  clearTimeout(lock._timer);
  lock._locked = false;

  const p = lock._pending;
  if (p) {
    lock._pending = null;
    // 仅当目标值不同时排队播放
    if (Math.abs(p.bgAlpha - _currentBgAlpha(el)) > 0.001 ||
        (p.tc && p.mode !== 'white' && !window.__lensTextDirty)) {
      lock._locked = true;
      _animateGlass(el, id, p.bgAlpha, p.tc, p.mode, _adSpeed);
    }
  }
}

function _applyLuminance(id, lum) {
  if (lum === null || lum === undefined) return;
  const isDark = lum < _adThresh;
  const targetBgAlpha = isDark ? 0 : 0.35;
  const mode = _panelTextModes.get(id) || 'adaptive';
  const tc = _textColors(mode, isDark);

  const def = PANEL_DEFS.find(p => p.id === id);
  if (!def) return;

  document.querySelectorAll(def.sel).forEach(el => {
    el.style.setProperty('--lg-brightness', '1.1', 'important');


    // 过渡锁定：如果该面板正在动画中，排队
    let lock = _locks.get(id);
    if (!lock) { lock = {}; _locks.set(id, lock); }

    const shouldAnimate = Math.abs(targetBgAlpha - _currentBgAlpha(el)) > 0.001 ||
      (mode !== 'white' && !window.__lensTextDirty);

    if (!shouldAnimate) {
      el.style.setProperty('--lg-bg-alpha', targetBgAlpha, 'important');
      if (mode === 'white') {
        el.style.removeProperty('--text');
        el.style.removeProperty('--text-2');
        el.style.removeProperty('--text-3');
      }
      return;
    }

    if (lock._locked) {
      lock._pending = { bgAlpha: targetBgAlpha, tc, mode };
      return;
    }

    lock._locked = true;
    lock._pending = null;
    _animateGlass(el, id, targetBgAlpha, tc, mode, _adSpeed);
  });
}

/* ── 公开 API ── */

async function updateAllPanels() {
  if (!_active || _sampling) return;
  _sampling = true;

  try {
    const grid = await _sampleGrid();
    // IPC 失败时使用兜底：假设所有面板在暗色背景上（lum=0.1 → isDark → white text + clear glass）

    for (const def of PANEL_DEFS) {
      const els = document.querySelectorAll(def.sel);
      els.forEach(el => {
        if (!_isVisible(def.id, el)) {
          // 面板不可见时清除旧内联颜色，回退到 :root 预设
          ['--text','--text-2','--text-3','--lg-bg-alpha'].forEach(k => el.style.removeProperty(k));
          return;
        }

        let lum;
        if (_forceDark.has(def.id)) {
          lum = 0.1;
        } else if (grid) {
          lum = _lookupLuminance(el);
          if (lum === null) lum = 0.1;
        } else {
          lum = 0.1;
        }
        _applyLuminance(def.id, lum);
      });
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

  // 初始 frost 变量
  PANEL_DEFS.forEach(def => {
    document.querySelectorAll(def.sel).forEach(el => {
      el.style.setProperty('--lg-brightness', '1.1', 'important');
      el.style.setProperty('--lg-bg-alpha', '0', 'important');
    });
  });

  window.addEventListener('scroll', _onScroll, { passive: true });
  window.addEventListener('resize', _onResize);

  _domObserver = new MutationObserver(() => _scheduleUpdate());
  _domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  // 初始化 dirty flag
  if (window.__lensTextDirty === undefined) window.__lensTextDirty = false;

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
      const keys = ['--lg-brightness','--lg-bg-alpha',
        '--text','--text-2','--text-3',
        '--glass-border','--glass-border-bright','--glass-bg-hover'];
      keys.forEach(k => el.style.removeProperty(k));
    });
  });
}

/* ── 阈值 / 速度 ── */
export function setAdaptiveThreshold(v) { _adThresh = v; }
export function setTextTransitionSpeed(sec) {
  _adSpeed = sec;
  document.documentElement.style.setProperty('--lg-text-speed', sec + 's');
}

/* ── 逐面板 / 透镜文字模式 ── */
export function setLensTextMode(mode) { _lensTextMode = mode; return mode; }
export function getLensTextMode() { return _lensTextMode; }

export function setPanelTextMode(id, mode) {
  _panelTextModes.set(id, mode);
  const def = PANEL_DEFS.find(p => p.id === id);
  if (!def) return;
  const el = document.querySelector(def.sel);
  if (!el || !_isVisible(id, el)) return;

  // 白模式 → 清除面板级文字变量，回退 :root
  if (mode === 'white') {
    ['--text','--text-2','--text-3'].forEach(k => el.style.removeProperty(k));
  }

  // 重新应用（dirty flag 检查在 _applyLuminance 内部）
  const lum = _forceDark.has(id) ? 0.1 : (_lookupLuminance(el) || 0.5);
  _applyLuminance(id, lum);
}
export function getPanelTextMode(id) { return _panelTextModes.get(id) || 'adaptive'; }

/* ── 透镜文字颜色（被 lg-studio 的 _applyTarget 调用）── */
export function getLensTextColors(lum) {
  const isDark = lum < _adThresh;
  return _textColors(_lensTextMode, isDark);
}

/* ── 全局文字脏标记 — Dev Panel 调用 ── */
export function markTextDirty() { window.__lensTextDirty = true; }
export function clearTextDirty() { window.__lensTextDirty = false; updateAllPanels(); }
export function isTextDirty() { return !!window.__lensTextDirty; }

export { updateAllPanels };
