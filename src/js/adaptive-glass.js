/* ═══════════════════════════════════════════════════════
   液态玻璃自适应 — 统一 CSS 变量枢纽
   所有文字颜色通过 var(--text)/var(--text-2)/var(--text-3) 级联
   IPC 主进程亮度采样, 2 档阈值, frost opacity 过渡
   ═══════════════════════════════════════════════════════ */

import { PANEL_DEFS } from './lg-panels.js';

let _active = false;
let _ticking = false;
let _resizeTimer = 0;
let _domObserver = null;
let _sampling = false;
let _gridCache = null;
let _textStyleEl = null;
let _needsResample = true; // resize/mutation 后置 true，scroll 用冷却控制
let _lastScrollResample = 0;

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
    t1: `rgba(${alpha},0.96)`,
    t2: `rgba(${alpha},0.88)`,
    t3: `rgba(${alpha},0.72)`,
  };
}

function _onScroll() {
  _scheduleUpdate();
  // 固定面板(fixed)后的内容随滚动变化，需定期重采样，500ms 冷却防 capturePage 过频
  if (performance.now() - _lastScrollResample > 500) _needsResample = true;
}
function _onResize() { _needsResample = true; clearTimeout(_resizeTimer); _resizeTimer = setTimeout(_scheduleUpdate, 50); }
function _onRescanLuminance() { _needsResample = true; _scheduleUpdate(); }

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

  // 多样本点采样：聚焦内容区（文字位置），避开面板边缘
  const insetX = r.width * 0.15;   // 水平内缩 15%
  const insetY = r.height * 0.08;  // 垂直内缩 8%
  const cw = r.width - insetX * 2;
  const ch = r.height - insetY * 2;
  const samples = [];
  const hCount = Math.min(5, Math.max(1, Math.floor(cw / 60)));
  const vCount = Math.min(5, Math.max(1, Math.floor(ch / 80)));
  for (let vi = 0; vi < vCount; vi++) {
    for (let hi = 0; hi < hCount; hi++) {
      const px = r.left + insetX + cw * (hi + 0.5) / hCount;
      const py = r.top + insetY + ch * (vi + 0.5) / vCount;
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
function _currentBrightness(el) {
  const v = el.style.getPropertyValue('--lg-brightness');
  return v ? parseFloat(v) : 1.1;
}

function _animateGlass(el, lockKey, targetBgAlpha, tc, mode, speed, targetBrightness) {
  // 取消该元素旧动画
  const old = _locks.get(lockKey);
  if (old && old._rafId) cancelAnimationFrame(old._rafId);

  const startBg = _currentBgAlpha(el);
  const startBr = _currentBrightness(el);
  const tgtBr = targetBrightness != null ? targetBrightness : startBr;
  const props = ['--text', '--text-2', '--text-3'];
  const targetT = [tc.t1, tc.t2, tc.t3];
  const startT = props.map(p => el.style.getPropertyValue(p) || getComputedStyle(el).getPropertyValue(p));
  const startTime = performance.now();
  const duration = speed * 1000;

  function step(now) {
    const raw = Math.min(1, (now - startTime) / duration);
    const t = raw * (2 - raw); // easeOut quad

    // 玻璃背景 + 亮度
    el.style.setProperty('--lg-bg-alpha', (startBg + (targetBgAlpha - startBg) * t).toFixed(3), 'important');
    el.style.setProperty('--lg-brightness', (startBr + (tgtBr - startBr) * t).toFixed(2), 'important');
    // 文字颜色
    if (!window.__lensTextDirty && mode !== 'white') {
      props.forEach((prop, i) => {
        el.style.setProperty(prop, _interpRgba(startT[i], targetT[i], t), 'important');
      });
    }

    if (raw < 1) {
      const lock = _locks.get(lockKey);
      if (lock) lock._rafId = requestAnimationFrame(step);
    } else {
      // 动画完成：写入终值，解锁，处理排队
      el.style.setProperty('--lg-bg-alpha', targetBgAlpha, 'important');
      el.style.setProperty('--lg-brightness', tgtBr.toFixed(2), 'important');
      if (!window.__lensTextDirty && mode !== 'white') {
        props.forEach((prop, i) => el.style.setProperty(prop, targetT[i], 'important'));
      }
      _finishAnim(lockKey, el, targetBrightness);
    }
  }

  const lock = _locks.get(lockKey) || {};
  _locks.set(lockKey, lock);
  // 首帧同步执行（省一帧 rAF），后续帧在 step 内部继续用 rAF
  step(performance.now());
}

function _finishAnim(lockKey, el, targetBrightness) {
  const lock = _locks.get(lockKey);
  if (!lock) return;
  clearTimeout(lock._timer);
  lock._locked = false;

  const p = lock._pending;
  if (p) {
    lock._pending = null;
    if (Math.abs(p.bgAlpha - _currentBgAlpha(el)) > 0.001 ||
        Math.abs((p.brightness || 1.1) - _currentBrightness(el)) > 0.01 ||
        (p.tc && p.mode !== 'white' && !window.__lensTextDirty)) {
      lock._locked = true;
      _animateGlass(el, lockKey, p.bgAlpha, p.tc, p.mode, _adSpeed, p.brightness);
    }
  }
}

// 逐元素应用亮度（不再 querySelectorAll 全部元素，每个元素独立 lum）
function _applyLuminanceToEl(id, el, idx, lum) {
  if (lum === null || lum === undefined) return;
  const isDark = lum < _adThresh;
  const targetBgAlpha = isDark ? 0 : 0.48;
  const targetBrightness = 1.1; // 与其他面板一致，固定亮度
  const mode = _panelTextModes.get(id) || 'adaptive';
  const tc = _textColors(mode, isDark);

  const lockKey = `${id}-${idx}`;
  el.style.setProperty('--lg-brightness', '1.1', 'important');

  let lock = _locks.get(lockKey);
  if (!lock) { lock = {}; _locks.set(lockKey, lock); }

  const shouldAnimate = Math.abs(targetBgAlpha - _currentBgAlpha(el)) > 0.001 ||
    (mode !== 'white' && !window.__lensTextDirty);

  if (!shouldAnimate) {
    el.style.setProperty('--lg-bg-alpha', targetBgAlpha, 'important');
    if (mode === 'white') {
      el.style.removeProperty('--text');
      el.style.removeProperty('--text-2');
      el.style.removeProperty('--text-3');
    } else {
      el.style.setProperty('--text', tc.t1, 'important');
      el.style.setProperty('--text-2', tc.t2, 'important');
      el.style.setProperty('--text-3', tc.t3, 'important');
    }
    // 圆形按钮玻璃底板
    if (id === 'lightbox' || id === 'backtotop') {
      el.style.setProperty('background', `rgba(255,255,255,${targetBgAlpha})`, 'important');
    }
    return;
  }

  if (lock._locked) {
    lock._pending = { bgAlpha: targetBgAlpha, tc, mode, brightness: targetBrightness };
    return;
  }

  lock._locked = true;
  lock._pending = null;
  _animateGlass(el, lockKey, targetBgAlpha, tc, mode, _adSpeed, targetBrightness);
  // 圆形按钮（lightbox/backtotop）的玻璃底板：bgAlpha 自适应亮背景变白
  if (id === 'lightbox' || id === 'backtotop') {
    el.style.setProperty('background', `rgba(255,255,255,${targetBgAlpha})`, 'important');
  }
}

/* ── 公开 API ── */

async function updateAllPanels() {
  if (!_active || _sampling) return;
  _sampling = true;

  try {
    const grid = _needsResample ? await _sampleGrid() : _gridCache;
    if (_needsResample) { _lastScrollResample = performance.now(); _needsResample = false; }
    // IPC 失败时使用兜底：假设所有面板在暗色背景上（lum=0.1 → isDark → white text + clear glass）

    for (const def of PANEL_DEFS) {
      const els = document.querySelectorAll(def.sel);
      els.forEach((el, idx) => {
        if (!_isVisible(def.id, el)) {
          // 面板不可见时平滑过渡到 :root 预设值，再清除内联
          const curBg = _currentBgAlpha(el);
          if (curBg > 0.001) {
            const root = getComputedStyle(document.documentElement);
            const rootT1 = root.getPropertyValue('--text').trim();
            const rootT2 = root.getPropertyValue('--text-2').trim();
            const rootT3 = root.getPropertyValue('--text-3').trim();
            const dummyTc = { t1: rootT1 || 'rgba(255,255,255,0.94)', t2: rootT2 || 'rgba(255,255,255,0.82)', t3: rootT3 || 'rgba(255,255,255,0.64)' };
            _animateGlass(el, `${def.id}-${idx}`, 0, dummyTc, 'white', _adSpeed);
          } else {
            ['--text','--text-2','--text-3','--lg-bg-alpha'].forEach(k => el.style.removeProperty(k));
          }
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
        _applyLuminanceToEl(def.id, el, idx, lum);
      });
    }

    // 画廊导航栏上 5 块玻璃统一联动（返回 + 按名称 trigger/menu + 全部 trigger/menu）
    const nav = document.querySelector('.gallery__nav');
    if (nav) {
      const navLum = grid ? (_lookupLuminance(nav) || 0.1) : 0.1;
      const navDark = navLum < _adThresh;
      const tc = _textColors('adaptive', navDark);
      const targetBgAlpha = navDark ? 0 : 0.48;
      // 取消下拉面板的主循环动画，用画廊导航栏亮度重新动画（保证变色速度一致）
      ['dropdown-trigger', 'dropdown-menu'].forEach(did => {
        for (let idx = 0; idx < 10; idx++) {
          const lock = _locks.get(`${did}-${idx}`);
          if (lock) {
            if (lock._rafId) { cancelAnimationFrame(lock._rafId); lock._rafId = null; }
            lock._locked = false;
            lock._pending = null;
          }
        }
      });
      // 用同样的动画函数写入，保持 1s 过渡与其他面板一致
      const ddBrightness = navDark ? 1.1 : 0.7;
      document.querySelectorAll('.custom-dropdown__trigger,.custom-dropdown__menu').forEach((el, idx) => {
        _animateGlass(el, `dd-sync-${idx}`, targetBgAlpha, tc, 'adaptive', _adSpeed, ddBrightness);
      });
      // 选项文字也同步
      document.querySelectorAll('.custom-dropdown__option').forEach(el => {
        el.style.setProperty('--text', tc.t1, 'important');
        el.style.setProperty('--text-2', tc.t2, 'important');
        el.style.setProperty('--text-3', tc.t3, 'important');
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
  window.addEventListener('lens:rescan-luminance', _onRescanLuminance);

  _domObserver = new MutationObserver((mutations) => {
    // 只响应 childList（元素增删），忽略 attributes（避免自适应动画写 style 触发自身）
    const hasChildList = mutations.some(m => m.type === 'childList');
    if (!hasChildList) return;
    _needsResample = true;
    _scheduleUpdate();
    window.dispatchEvent(new CustomEvent('lens:panels-changed'));
  });
  _domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  // dropdown-trigger + dropdown-menu 已从 PANEL_DEFS 移除，由同步代码统一控制
  // 初始化 dirty flag — 重启自适应时始终清除手动覆盖
  window.__lensTextDirty = false;

  updateAllPanels();
}

export function stopAdaptiveGlass() {
  _active = false;
  clearTimeout(_resizeTimer);
  window.removeEventListener('scroll', _onScroll);
  window.removeEventListener('resize', _onResize);
  window.removeEventListener('lens:rescan-luminance', _onRescanLuminance);
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

  // 重新应用
  const lum = _forceDark.has(id) ? 0.1 : (_lookupLuminance(el) || 0.5);
  _applyLuminanceToEl(id, el, 0, lum);
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
