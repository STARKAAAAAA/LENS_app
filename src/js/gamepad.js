import { getPhotoRating, gpLightboxZoom, gpLightboxResetZoom, gpSlideshowZoom, gpSlideshowResetZoom } from './lightbox.js';

// -- 手柄图标辅助：读取全局内联 SVG（currentColor 跟随预设）--
window.__lensGPImg = function(name) {
  var icons = window.__lensGPIcons;
  if (icons && icons[name]) {
    return icons[name].replace(/dev-hints__icon/g, 'gp-icon');
  }
  return '<img src="/assets/icons/btn-' + name + '.svg" class="gp-icon">';
};
const sf = () => document.getElementById('sidebar-frame');

// ========== Gamepad Support ==========
//
// 架构:
//   S.input = 'mouse' | 'gamepad'       body.gamepad-active 为唯一真相源
//   S.zone  = 'grid' | 'hero' | 'sidebar'  焦点区域
//   S.mode  = 'browse' | 'gallery' | 'lightbox' | 'slideshow' | 'settings' | 'shortcuts'
//
// 输入切换:
//   mouse → gamepad: 任意摇杆/按键活动
//   gamepad → mouse: 真实鼠标点击（非手柄模拟）+ 鼠标偏离锚点 >6px
//
// 按钮提示: 仅在手柄模式 + sidebar 区域时显示（JS 真实 DOM，非 CSS ::after）

// ── Constants ──

function detectLayout(gamepad) {
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox') || id.includes('xinput')) return 'xbox';
  if (id.includes('ps4') || id.includes('ps5') || id.includes('playstation')) return 'ps';
  if (id.includes('switch') || id.includes('nintendo')) return 'switch';
  return 'xbox';
}

const BTN = {
  xbox:   { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
  ps:     { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
  switch: { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
};

const DEAD_ZONE = 0.25;          // 摇杆死区（提高以过滤漂移/噪声）
const DPAD_THRESHOLD = 0.35;     // D-pad 模拟阈值
const FLOAT_LIFT = 5;
const MOUSE_SWITCH_DIST = 8;     // px — 鼠标偏离锚点超过此距离切回鼠标模式
const GP_CONFIRM_FRAMES = 10;    // 需要 N 帧持续输入才确认切换到手柄（~167ms @ 60fps）
const GP_COOLDOWN_MS = 600;      // 切回鼠标后 N ms 内仅按钮可立即中断冷却
const OVERLAYS = new Set(['lightbox', 'slideshow', 'settings', 'shortcuts', 'dev']);
let _savedBrowseIdx = 0; // 从 gallery 返回 browse 时的分类卡位置
let _listeners = null;   // 事件监听器引用，供 destroyGamepad 移除

// ── Unified State ──

const S = {
  input: 'mouse',          // 'mouse' | 'gamepad'
  mode:  'browse',         // current app mode (from detectMode)
  zone:  'grid',           // 'grid' | 'hero' | 'sidebar' | 'toolbar'

  gridIdx:    0,           // grid zone focus index
  heroIdx:    0,           // hero zone focus index
  sidebarIdx: 0,           // sidebar zone focus index
  toolbarIdx: 0,           // toolbar zone focus index
  settingsIdx: 0,          // settings overlay focus index
  settingsDensityIdx: 0,   // density 按钮子索引 (0=小/1=中/2=大)

  gridEls:    [],          // cached grid elements
  heroEls:    [],          // cached hero elements
  sidebarEls: [],          // cached sidebar elements
  toolbarEls: [],          // cached toolbar elements
  settingsEls: [],         // cached settings elements
  devEls:     [],          // cached dev panel elements
  devIdx:     0,           // dev panel focus index

  // START+BACK combo tracking
  _comboFired:   false,
  _startWasHeld: false,
  _backWasHeld:  false,
  _startPending: 0,
  _floatBHoldStart: 0,
  _comboCooldown: 0,
  _devGroupCache: null,

  // mouse→gamepad 切换确认（防误触发）
  _gpConfirmCount: 0,          // 连续手柄输入帧数
  _gpCooldownUntil: 0,         // 冷却期截止时间戳
  _sidebarRebuildTimer: null,  // 可取消的 sidebar 重建定时器

  // Saved state
  // Saved state for zone transitions (grid ↔ hero, grid ↔ sidebar)
  save:  { zone: null, mode: null, gridIdx: 0, heroIdx: 0 },

  // Saved state for overlay entry/exit
  ovSave: { mode: null, gridIdx: 0 },

  // Mouse anchor for gamepad→mouse switch detection
  anchor: { x: 0, y: 0 },

  // Rising-edge dpad tracking
  prevDX: 0, prevDY: 0,

  // Guard: true when gamepad simulates a click, prevents false mode switch
  clicking: false,

  // Float effect
  floatCard: null,
  _lastScrollTime: 0,
  _resetConfirm: 0,
  _resetHoldStart: 0,

  // Glow sweep
  glow: { el: null, raf: null },

  // rAF handle
  raf: null,
};

// ── Mode Detection (read DOM state) ──

function detectMode() {
  // dev panel 优先级最高（z-index 最高，始终在最上层）
  if (document.getElementById('dev-overlay')?.classList.contains('dev-overlay--open')) return 'dev';
  if (document.getElementById('lightbox')?.classList.contains('active')) return 'lightbox';
  if (document.getElementById('slideshow')?.classList.contains('active')) return 'slideshow';
  if (document.getElementById('settings-panel')?.classList.contains('settings-panel--open')) return 'settings';
  if (document.getElementById('shortcuts-overlay')?.classList.contains('shortcuts-overlay--open')) return 'shortcuts';
  if (document.getElementById('gallery')?.style.display === 'block') return 'gallery';
  return 'browse';
}

// ── Input Switching ──

function setInput(input) {
  if (S.input === input) return;
  S.input = input;

  if (input === 'gamepad') {
    // ── mouse → gamepad ──
    // 清除鼠标端残留（class + inline style）
    document.querySelectorAll('.card--tilt-active').forEach(el => {
      el.classList.remove('card--tilt-active');
      el.style.transform = '';
      el.style.transition = '';
      el.style.removeProperty('--shine-x');
      el.style.removeProperty('--shine-y');
    });

    document.body.classList.add('gamepad-active');
    S.prevDX = S.prevDY = 0;

    // 设置 zone + 预建元素列表（ensureFocus 帧末自动显示焦点）
    if (sf()?.classList.contains('sidebar--open')) {
      S.zone = 'sidebar'; buildSidebarEls();
      const activeItem = document.querySelector('.sidebar__item--active');
      S.sidebarIdx = activeItem ? S.sidebarEls.indexOf(activeItem) : 0;
      if (S.sidebarIdx < 0) S.sidebarIdx = 0;
    } else if (!OVERLAYS.has(S.mode)) {
      S.zone = 'grid'; buildGridEls(); clampGridIdx();
    }
    refreshHints();
  } else {
    // ── gamepad → mouse ──
    // 取消待处理的 sidebar 重建
    if (S._sidebarRebuildTimer != null) {
      clearTimeout(S._sidebarRebuildTimer);
      S._sidebarRebuildTimer = null;
    }
    releaseFloat();
    clearGlow();
    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();
    S.gridEls = [];
    S.heroEls = [];
    S.sidebarEls = [];
    S.toolbarEls = [];
    S.settingsEls = [];
    S.devEls = [];
    S.gridIdx = 0;
    S.heroIdx = 0;
    S.sidebarIdx = 0;
    S.toolbarIdx = 0;
    S.settingsIdx = 0;
    S.settingsDensityIdx = 0;
    S.devIdx = 0;
    S._comboFired = false;
    S._startWasHeld = false;
    S._backWasHeld = false;
    S._startPending = 0;
    S._gpConfirmCount = 0;
    S._devGroupCache = null;
    S.zone = 'grid';

sf()?.classList.remove('sidebar--open', 'sidebar--peek');

    document.body.classList.remove('gamepad-active');
    S._gpCooldownUntil = performance.now() + GP_COOLDOWN_MS; // 防振荡冷却
    refreshHints();
  }
}

// ── Zone Management ──

// enterZone(zone) — 统一的区域切换入口，处理所有保存/恢复/清理
function enterZone(zone) {
  if (S.zone === zone) return;

  releaseFloat();
  clearGlow();

  const prevZone = S.zone;

  // 离开 sidebar 时取消待处理的重建定时器
  if (prevZone === 'sidebar' && S._sidebarRebuildTimer != null) {
    clearTimeout(S._sidebarRebuildTimer);
    S._sidebarRebuildTimer = null;
  }

  if (zone === 'sidebar') {
    // 保存当前状态
    S.save.zone = prevZone;
    S.save.mode = S.mode;
    S.save.gridIdx = S.gridIdx;

    // 清除 grid/hero 焦点视觉
    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();

    S.zone = 'sidebar';
    buildSidebarEls();
    // 定位到当前激活的文件夹，找不到则 fallback 到第一项
    const activeItem = document.querySelector('.sidebar__item--active');
    S.sidebarIdx = activeItem ? S.sidebarEls.indexOf(activeItem) : 0;
    if (S.sidebarIdx < 0) S.sidebarIdx = 0;

    // 确保 sidebar 完全打开
sf()?.classList.add('sidebar--open');
    sf()?.classList.remove('sidebar--peek');
  } else if (zone === 'toolbar') {
    // 保存当前状态
    S.save.zone = prevZone;
    S.save.mode = S.mode;
    S.save.heroIdx = S.heroIdx;

    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();

    S.zone = 'toolbar';
    buildToolbarEls();
    S.toolbarIdx = 0;
  } else if (zone === 'hero') {
    S.save.zone = prevZone;
    S.save.mode = S.mode;
    S.save.gridIdx = S.gridIdx;

    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();

    S.zone = 'hero';
    buildHeroEls();
    // 从 toolbar 返回时恢复位置，否则从底部开始
    S.heroIdx = (prevZone === 'toolbar' && S.save.heroIdx != null)
      ? Math.min(S.save.heroIdx, Math.max(0, S.heroEls.length - 1))
      : Math.max(0, S.heroEls.length - 1);
  } else if (zone === 'grid') {
    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();

    S.zone = 'grid';

    if (prevZone === 'sidebar') {
      S.gridIdx = (S.mode === S.save.mode) ? S.save.gridIdx : 0;
    sf()?.classList.remove('sidebar--open', 'sidebar--peek');
      S.sidebarEls = [];
    } else if (prevZone === 'hero') {
      S.gridIdx = (S.mode === S.save.mode) ? S.save.gridIdx : 0;
      S.heroEls = [];
    } else if (prevZone === 'toolbar') {
      S.gridIdx = 0;
      S.toolbarEls = [];
    }

    buildGridEls();
    clampGridIdx();
    // ensureFocus() 在帧末应用视觉焦点
  }

  refreshHints();
}

// ── Element Building ──

function buildGridEls() {
  S.gridEls = S.mode === 'browse'
    ? Array.from(document.querySelectorAll('.category-card'))
    : Array.from(document.querySelectorAll('.gallery__item'));
}

function buildHeroEls() {
  S.heroEls = [];
  if (S.mode === 'gallery') {
    const back = document.getElementById('gallery-back');
    if (back) S.heroEls.push(back);
    // 所有下拉触发器（排序 + 筛选），按 DOM 顺序
    document.querySelectorAll('.custom-dropdown__trigger').forEach(el => S.heroEls.push(el));
  }
}

function buildSidebarEls() {
  S.sidebarEls = [];
  document.querySelectorAll('#sidebar-list .sidebar__item').forEach(el => S.sidebarEls.push(el));
  const add = document.getElementById('sidebar-add');
  if (add) S.sidebarEls.push(add);
  const cacheBtn = document.querySelector('#cache-section button');
  if (cacheBtn) S.sidebarEls.push(cacheBtn);
}

function buildToolbarEls() {
  S.toolbarEls = Array.from(document.querySelectorAll('#toolbar .toolbar__btn'));
}

function buildSettingsEls() {
  S.settingsEls = [];
  // 4 个开关
  document.querySelectorAll('#settings-panel .toggle-switch').forEach(el => S.settingsEls.push(el));
  // 密度选择器（一个整体条目，densityIdx 控制子选择）
  const densityBtns = document.querySelectorAll('#settings-panel .density-btn');
  if (densityBtns.length > 0) {
    // 找到当前 active 的 density 按钮作为初始子索引
    S.settingsDensityIdx = 0;
    densityBtns.forEach((b, i) => { if (b.classList.contains('density-btn--active')) S.settingsDensityIdx = i; });
    S.settingsEls.push({ _density: true, buttons: Array.from(densityBtns) });
  }
  // 缓存按钮
  const cacheBtn = document.getElementById('cache-dir-btn');
  if (cacheBtn) S.settingsEls.push(cacheBtn);
}

// ── Focus Application ──

function clearAllCardFocus() {
  document.querySelectorAll('.card--focused').forEach(el => el.classList.remove('card--focused'));
}

function clampGridIdx() {
  if (S.gridEls.length === 0) { S.gridIdx = 0; return; }
  S.gridIdx = Math.max(0, Math.min(S.gridIdx, S.gridEls.length - 1));
}

// applyHeroFocus — 仅用于下拉菜单关闭场景（poll 循环内）
function applyHeroFocus() {
  S.heroEls.forEach(el => el.classList.remove('hero--focused'));
  const el = S.heroEls[S.heroIdx];
  if (el) {
    el.classList.add('hero--focused');
    // 滚动到 portfolio 区域顶部，保证导航条完整可见
    const portfolio = document.getElementById('portfolio');
    if (portfolio) {
      const r = portfolio.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r.top - 8, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
}

function applySettingsFocus() {
  // 先清除所有（包括 density 子按钮）
  S.settingsEls.forEach(el => {
    if (el._density) el.buttons.forEach(b => b.classList.remove('hero--focused'));
    else el.classList.remove('hero--focused');
  });
  const el = S.settingsEls[S.settingsIdx];
  if (!el) return;
  if (el._density) {
    const target = el.buttons[S.settingsDensityIdx];
    if (target) {
      target.classList.add('hero--focused');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } else {
    el.classList.add('hero--focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ── HSL 颜色转换工具 ──
function hexToHSL(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const r = parseInt(hex.slice(0,2), 16) / 255;
  const g = parseInt(hex.slice(2,4), 16) / 255;
  const b = parseInt(hex.slice(4,6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── 文本预设 ──
function getTextPresets(key) {
  if (key === '--font-display') return ["'Cormorant Garamond', Georgia, serif", "'Georgia', serif", "'Arial', sans-serif", "'Segoe UI', sans-serif"];
  if (key === '--font-body') return ["'Cormorant', Georgia, serif", "'Georgia', serif", "'Arial', sans-serif", "'Segoe UI', sans-serif"];
  if (key === '--ease-out') return ['cubic-bezier(0.16,1,0.3,1)', 'cubic-bezier(0.25,0.1,0.25,1)', 'ease-out', 'linear'];
  if (key === '--ease-spring') return ['cubic-bezier(0.34,1.56,0.64,1)', 'cubic-bezier(0.175,0.885,0.32,1.275)', 'ease-in-out', 'linear'];
  return [];
}

// ── 值调整 ──
// ── Dev 值调整 ──
function adjustDevValue(item, dir) {
  if (item._slider) {
    const el = item.el;
    const val = Math.min(item.max, Math.max(item.min, parseFloat(el.value) + item.step * dir));
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (item._color) {
    const el = item.el;
    let [h, s, l] = hexToHSL(el.value);
    h = (h + 10 * dir + 360) % 360;
    el.value = hslToHex(h, s, l);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (item._text) {
    if (!item.presets.length) return;
    item.idx = (item.idx + dir + item.presets.length) % item.presets.length;
    item.el.value = item.presets[item.idx];
    item.el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ── LB/RB 切换 dev 标签页 ──
function switchDevTab(dir) {
  const tabs = document.querySelectorAll('#dev-nav .dev-nav__tab');
  if (!tabs.length) return;
  const activeTab = document.querySelector('.dev-nav__tab--active');
  let idx = Array.from(tabs).indexOf(activeTab);
  idx = (idx + dir + tabs.length) % tabs.length;
  safeClick(tabs[idx]);
}

// ── 构建 dev 元素列表（仅在 tab 切换时调用） ──
function buildDevEls() {
  S.devEls = [];
  document.querySelectorAll('#dev-nav .dev-nav__tab').forEach(el => S.devEls.push(el));
  const group = document.querySelector('.dev-group--active');
  if (!group) return;
  group.querySelectorAll('.dev-row').forEach(row => {
    if (row.closest('.dev-perf-section--folded')) return;
    const slider = row.querySelector('.dev-slider');
    const glassAlpha = row.querySelector('.dev-glass-alpha');
    const color = row.querySelector('.dev-color');
    const glassColor = row.querySelector('.dev-glass-color');
    const textInput = row.querySelector('.dev-input--text');
    const toggle = row.querySelector('.dev-toggle');
    const presetCard = row.querySelector('.dev-preset-card');

    if (slider) {
      S.devEls.push({ _slider: true, el: slider, min: +slider.min, max: +slider.max, step: +slider.step || 1 });
    } else if (glassColor && glassAlpha) {
      // 毛玻璃行：颜色 + alpha 各为一个独立可调项
      S.devEls.push({ _color: true, el: glassColor });
      S.devEls.push({ _slider: true, el: glassAlpha, min: 0, max: 1, step: 0.01 });
    } else if (glassAlpha) {
      S.devEls.push({ _slider: true, el: glassAlpha, min: 0, max: 1, step: 0.01 });
    } else if (glassColor) {
      S.devEls.push({ _color: true, el: glassColor });
    } else if (color) {
      S.devEls.push({ _color: true, el: color });
    } else if (textInput) {
      const presets = getTextPresets(textInput.dataset.cssText);
      const curVal = textInput.value.trim();
      const matchedIdx = presets.findIndex(p => p === curVal);
      S.devEls.push({ _text: true, el: textInput, presets, idx: matchedIdx >= 0 ? matchedIdx : 0 });
    } else if (toggle) {
      S.devEls.push(toggle);
    } else if (presetCard) {
      S.devEls.push(presetCard);
    } else if (row.dataset.gpZone) {
      S.devEls.push(row); // 手柄可视化区域（按钮网格/摇杆/扳机）
    }
  });
  group.querySelectorAll('.dev-preset-card').forEach(el => {
    if (!S.devEls.includes(el)) S.devEls.push(el);
  });
}

// ── 焦点应用 ──
function applyDevFocus() {
  document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
  const cur = S.devEls[S.devIdx];
  if (!cur) return;
  const target = cur.el || cur;
  const row = target.closest?.('.dev-row');
  (row || target).classList.add('hero--focused');
  (row || target).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  // 焦点在内容区时，左侧导航变淡
  const navCount = document.querySelectorAll('#dev-nav .dev-nav__tab').length;
  const nav = document.getElementById('dev-nav');
  if (nav) nav.classList.toggle('dev-nav--dimmed', S.devIdx >= navCount);
  window.__lensUpdateDevHints?.();
}

// ── 中央焦点维护（每帧运行）──
// 非 overlay 模式下唯一焦点入口。先重建元素列表，再检查并修复焦点。
function ensureFocus() {
  if (S.input !== 'gamepad') return;
  if (OVERLAYS.has(S.mode)) return;

  const zone = S.zone;

  if (zone === 'grid') {
    // 每帧重建元素列表（querySelectorAll 很轻量，确保无过期引用）
    buildGridEls();
    clampGridIdx();
    const target = S.gridEls[S.gridIdx];
    if (!target) return;
    if (!target.classList.contains('card--focused')) {
      clearAllCardFocus();
      target.classList.add('card--focused');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } else if (zone === 'sidebar') {
    buildSidebarEls();
    S.sidebarIdx = Math.min(S.sidebarIdx, Math.max(0, S.sidebarEls.length - 1));
    if (S.sidebarEls.length === 0) return;
    const target = S.sidebarEls[S.sidebarIdx];
    if (!target) return;
    if (!target.classList.contains('hero--focused')) {
      S.sidebarEls.forEach(el => el.classList.remove('hero--focused'));
      target.classList.add('hero--focused');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      refreshHints();
    }
  } else if (zone === 'hero') {
    buildHeroEls();
    S.heroIdx = Math.min(S.heroIdx, Math.max(0, S.heroEls.length - 1));
    if (S.heroEls.length === 0) return;
    const target = S.heroEls[S.heroIdx];
    if (!target) return;
    if (!target.classList.contains('hero--focused')) {
      S.heroEls.forEach(el => el.classList.remove('hero--focused'));
      target.classList.add('hero--focused');
      const portfolio = document.getElementById('portfolio');
      if (portfolio) {
        const r = portfolio.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + r.top - 8, behavior: 'smooth' });
      } else {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  } else if (zone === 'toolbar') {
    buildToolbarEls();
    S.toolbarIdx = Math.min(S.toolbarIdx, Math.max(0, S.toolbarEls.length - 1));
    if (S.toolbarEls.length === 0) return;
    const target = S.toolbarEls[S.toolbarIdx];
    if (!target) return;
    if (!target.classList.contains('hero--focused')) {
      S.toolbarEls.forEach(el => el.classList.remove('hero--focused'));
      target.classList.add('hero--focused');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

// ── Navigation ──

function countGridCols() {
  if (S.gridEls.length < 2) return 1;
  const set = new Set();
  for (const el of S.gridEls) set.add(el.getBoundingClientRect().left);
  return set.size || 1;
}

function navigate(dir) {
  // 非左方向键取消 sidebar peek
  if (dir !== 'left') {
    if (sf()?.classList.contains('sidebar--peek') && !sf()?.classList.contains('sidebar--open')) {
      sf()?.classList.remove('sidebar--peek');
    }
  }

  if (S.zone === 'sidebar') { sidebarNavigate(dir); return; }
  if (S.zone === 'hero')    { heroNavigate(dir);    return; }
  if (S.zone === 'toolbar') { toolbarNavigate(dir);  return; }
  gridNavigate(dir);
}

function gridNavigate(dir) {
  // 检测过期 DOM 引用（元素已从文档中移除）→ 重建
  if (S.gridEls.length === 0 || (S.gridEls[S.gridIdx] && !S.gridEls[S.gridIdx].isConnected)) {
    buildGridEls(); clampGridIdx();
  }
  // 空网格：gallery 下允许 UP 进入 hero（可操作返回按钮）
  if (S.gridEls.length === 0) {
    if (S.mode === 'gallery' && dir === 'up') { enterZone('hero'); }
    return;
  }
  clampGridIdx();

  const prevIdx = S.gridIdx;

  if (S.mode === 'browse') {
    const cols = countGridCols();
    const row = Math.floor(S.gridIdx / cols);
    const col = S.gridIdx % cols;
    const totalRows = Math.ceil(S.gridEls.length / cols);

    switch (dir) {
      case 'left':
        if (col > 0) { S.gridIdx--; }
        else { trySidebarPeek(); return; }
        break;
      case 'right':
        if (col < cols - 1 && S.gridIdx < S.gridEls.length - 1) S.gridIdx++;
        break;
      case 'up':
        if (row === 0) {
          // 已在页顶 → 工具栏；否则先滚到页顶
          if (window.scrollY < 50) { enterZone('toolbar'); return; }
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } else {
          S.gridIdx = Math.max(0, S.gridIdx - cols);
        }
        break;
      case 'down':
        if (row < totalRows - 1) S.gridIdx = Math.min(S.gridEls.length - 1, S.gridIdx + cols);
        break;
    }
  } else if (S.mode === 'gallery') {
    switch (dir) {
      case 'up': {
        // 同列内上移，到列顶则跳出到 hero
        const cur = S.gridEls[S.gridIdx];
        if (!cur) break;
        const curLeft = cur.getBoundingClientRect().left;
        let found = -1;
        for (let i = S.gridIdx - 1; i >= 0; i--) {
          if (Math.abs(S.gridEls[i].getBoundingClientRect().left - curLeft) < 5) {
            found = i; break;
          }
        }
        if (found >= 0) S.gridIdx = found;
        else enterZone('hero');
        break;
      }
      case 'down':
        // 只在同列内下移，不跳到下一列
        if (S.gridIdx < S.gridEls.length - 1) {
          const cur = S.gridEls[S.gridIdx];
          const next = S.gridEls[S.gridIdx + 1];
          if (cur && next && Math.abs(cur.getBoundingClientRect().left - next.getBoundingClientRect().left) < 5) {
            S.gridIdx++;
          }
        }
        break;
      case 'left':
      case 'right': {
        const current = S.gridEls[S.gridIdx];
        if (!current) break;
        const cr = current.getBoundingClientRect();
        const cx = cr.left + cr.width / 2;
        const cy = cr.top + cr.height / 2;
        let best = S.gridIdx;
        let bestScore = Infinity;
        for (let i = 0; i < S.gridEls.length; i++) {
          if (i === S.gridIdx) continue;
          const r = S.gridEls[i].getBoundingClientRect();
          const ix = r.left + r.width / 2;
          const iy = r.top + r.height / 2;
          if (dir === 'right' && ix <= cx + 2) continue;
          if (dir === 'left'  && ix >= cx - 2) continue;
          const score = Math.abs(ix - cx) + Math.abs(iy - cy) * 3;
          if (score < bestScore) { bestScore = score; best = i; }
        }
        S.gridIdx = best;
        break;
      }
    }
    // gallery 左边界 → sidebar
    if (dir === 'left' && S.gridIdx === prevIdx) {
      trySidebarPeek();
      return;
    }
  }

  // 索引变化时触发光效，焦点由 ensureFocus() 在帧末维护
  if (S.gridIdx !== prevIdx) {
    sweepGlow(S.gridEls[S.gridIdx], dir);
  }
}

// trySidebarPeek — 第一次左：探出；第二次左：完全展开 + 进入 sidebar zone
function trySidebarPeek() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (sf()?.classList.contains('sidebar--open')) {
    // 已打开（如鼠标打开的）→ 直接接管
    enterZone('sidebar');
  } else if (sf()?.classList.contains('sidebar--peek')) {
    // 第二次左 → 完全展开
    enterZone('sidebar');
  } else {
    // 第一次左 → 探出（仅探出，logo 不动，匹配鼠标行为）
    sf()?.classList.add('sidebar--peek');
  }
}

function heroNavigate(dir) {
  // browse 模式下 hero 区为空：上→工具栏，下→网格
  if (S.heroEls.length === 0) {
    if (dir === 'up')   { enterZone('toolbar'); return; }
    if (dir === 'down') { enterZone('grid'); return; }
    return;
  }


  switch (dir) {
    case 'up':
      if (S.heroIdx >= S.heroEls.length - 1) {
        if (window.scrollY < 50) { enterZone('toolbar'); return; }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      S.heroIdx = Math.min(S.heroEls.length - 1, S.heroIdx + 1);
      break;
    case 'down':
      if (S.heroIdx === 0) { enterZone('grid'); return; }
      else S.heroIdx--;
      break;
    case 'left':  S.heroIdx = Math.max(0, S.heroIdx - 1); break;
    case 'right': S.heroIdx = Math.min(S.heroEls.length - 1, S.heroIdx + 1); break;
  }

  sweepGlow(S.heroEls[S.heroIdx], dir);
}

function toolbarNavigate(dir) {
  if (S.toolbarEls.length === 0) { enterZone('grid'); return; }

  switch (dir) {
    case 'down':
      // browse 回 grid，gallery 回 hero
      enterZone(S.mode === 'gallery' ? 'hero' : 'grid');
      return;
    case 'up':
      // 已到页面最顶部，UP 不做任何事
      return;
    case 'left':
      S.toolbarIdx = Math.max(0, S.toolbarIdx - 1);
      break;
    case 'right':
      S.toolbarIdx = Math.min(S.toolbarEls.length - 1, S.toolbarIdx + 1);
      break;
  }

  if (dir === 'left' || dir === 'right') sweepGlow(S.toolbarEls[S.toolbarIdx], dir);
}

function sidebarNavigate(dir) {
  if (S.sidebarEls.length === 0) { enterZone('grid'); return; }

  switch (dir) {
    case 'right':
      enterZone(S.save.zone === 'sidebar' ? 'grid' : (S.save.zone || 'grid'));
      return;
    case 'up': {
      const prev = S.sidebarIdx;
      S.sidebarIdx = Math.max(0, S.sidebarIdx - 1);
      if (prev !== S.sidebarIdx) { sweepGlow(S.sidebarEls[S.sidebarIdx], dir); refreshHints(); }
      break;
    }
    case 'down': {
      const prev = S.sidebarIdx;
      S.sidebarIdx = Math.min(S.sidebarEls.length - 1, S.sidebarIdx + 1);
      if (prev !== S.sidebarIdx) { sweepGlow(S.sidebarEls[S.sidebarIdx], dir); refreshHints(); }
      break;
    }
  }
}

// ── Button Actions ──

function safeClick(el) {
  if (!el) return;
  S.clicking = true;
  el.click();
  S.clicking = false;
}

function actionA() {
  const m = S.mode;

  // overlay 模式优先（zone 在 overlay 下不相关）
  if (m === 'settings') {
    if (S.settingsEls.length === 0) buildSettingsEls();
    const sEl = S.settingsEls[S.settingsIdx];
    if (!sEl) return;
    if (sEl._density) { safeClick(sEl.buttons[S.settingsDensityIdx]); }
    else { safeClick(sEl); }
    return;
  }
  if (m === 'shortcuts') { safeClick(document.getElementById('shortcuts-overlay')); return; }
  if (m === 'dev') {
    if (!S.devEls.length) buildDevEls();
    const el = S.devEls[S.devIdx];
    if (!el) return;
    if (el._slider) {
      const slider = el.el;
      const key = slider.dataset.css;
      const def = window.__lensCSSDefaults?.[key];
      if (def) {
        if (slider.classList.contains('dev-glass-alpha')) {
          const m = def.match(/rgba?\(.*?,\s*([\d.]+)\)/);
          slider.value = m ? parseFloat(m[1]) : 0.5;
        } else {
          slider.value = parseFloat(def);
        }
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    if (el._color || el._text) return;
    // 手柄可视化区域 → 悬浮放大
    if (el.dataset?.gpZone) {
      window.__lensGpFloat?.(el.dataset.gpZone);
      return;
    }
    safeClick(el);
    return;
  }

  // 非 overlay 模式按 zone 分发
  if (S.zone === 'sidebar') {
    // 取消之前的待处理重建（防快速连续按 A 造成竞态）
    if (S._sidebarRebuildTimer != null) {
      clearTimeout(S._sidebarRebuildTimer);
      S._sidebarRebuildTimer = null;
    }
    const clickedIdx = S.sidebarIdx;
    safeClick(S.sidebarEls[clickedIdx]);
    // 重建 sidebar 元素列表；ensureFocus() 在帧末处理视觉焦点
    S._sidebarRebuildTimer = setTimeout(() => {
      S._sidebarRebuildTimer = null;
      buildSidebarEls();
      S.sidebarIdx = Math.min(clickedIdx, S.sidebarEls.length - 1);
      refreshHints();
    }, 150);
    return;
  }
  if (S.zone === 'hero')    {
    const openMenuA = document.querySelector('.custom-dropdown__menu--open');
    if (openMenuA) { const s = openMenuA.querySelector('.custom-dropdown__option.hero--focused') || openMenuA.querySelector('.custom-dropdown__option--sel'); if (s) { safeClick(s); return; } }
    safeClick(S.heroEls[S.heroIdx]);
    return;
  }
  if (S.zone === 'toolbar') { safeClick(S.toolbarEls[S.toolbarIdx]); return; }

  if (m === 'browse' || m === 'gallery') {
    if (S.gridEls.length === 0) buildGridEls();
    safeClick(S.gridEls[S.gridIdx]);
  }
}

function actionB() {
  const m = S.mode;

  // overlay 模式优先
  if (m === 'settings')  { document.getElementById('settings-panel')?.classList.remove('settings-panel--open'); return; }
  if (m === 'shortcuts') { safeClick(document.getElementById('shortcuts-overlay')); return; }
  if (m === 'dev') {
    if (S._resetConfirm) {
      S._resetConfirm = 0; S._resetHoldStart = 0;
      document.getElementById('dev-reset-overlay')?.classList.remove('dev-reset-overlay--open');
      return;
    }
    // 悬浮窗长按 B 关闭中 → 阻止 actionB 关闭面板
    if (S._floatBHoldStart) return;
    // 关闭手柄悬浮窗（短按）
    if (document.getElementById('dev-gp-float')?.classList.contains('dev-gp-float--open')) {
      document.getElementById('dev-gp-float').classList.remove('dev-gp-float--open');
      return;
    }
    // 焦点在内容区时，B 回到当前激活的标签；在导航栏时，B 关闭面板
    const navCount = document.querySelectorAll('#dev-nav .dev-nav__tab').length;
    if (S.devIdx >= navCount) {
      const activeTab = document.querySelector('.dev-nav__tab--active');
      S.devIdx = activeTab ? S.devEls.indexOf(activeTab) : 0;
      if (S.devIdx < 0) S.devIdx = 0;
      applyDevFocus();
    } else {
      S._comboCooldown = performance.now() + 800; // 防止 START+BACK 立即重开
      window.__lensToggleDev?.();
    }
    return;
  }
  if (m === 'lightbox')  { safeClick(document.querySelector('.lightbox__close')); return; }
  if (m === 'slideshow') { safeClick(document.getElementById('sl-exit')); return; }

  // 非 overlay 模式
  const openMenuB = document.querySelector('.custom-dropdown__menu--open');
  if (openMenuB) {
    openMenuB.classList.remove('custom-dropdown__menu--open');
    document.querySelector('.custom-dropdown__trigger--open')?.classList.remove('custom-dropdown__trigger--open');
    // 保持焦点在触发器上，不执行其他操作
    return;
  }
  if (S.zone === 'sidebar') { enterZone(S.save.zone === 'sidebar' ? 'grid' : (S.save.zone || 'grid')); return; }
  // hero 区域：B 关闭下拉后保留焦点；再无下拉则退回 grid
  if (S.zone === 'hero') {
    enterZone('grid');
    return;
  }
  // gallery/browse 模式：B 返回分类页
  if (m === 'gallery' || m === 'browse') {
    const backBtn = document.getElementById('gallery-back');
    if (backBtn) safeClick(backBtn);
    return;
  }
}

function actionX() {
  if (S.zone === 'sidebar') {
    if (S._sidebarRebuildTimer != null) {
      clearTimeout(S._sidebarRebuildTimer);
      S._sidebarRebuildTimer = null;
    }
    const el = S.sidebarEls[S.sidebarIdx];
    safeClick(el?.querySelector('.sidebar__item-remove'));
    // 等待 DOM 更新后重建 sidebar 元素；ensureFocus() 处理视觉焦点
    S._sidebarRebuildTimer = setTimeout(() => {
      S._sidebarRebuildTimer = null;
      buildSidebarEls();
      if (S.sidebarEls.length > 0) {
        S.sidebarIdx = Math.min(S.sidebarIdx, S.sidebarEls.length - 1);
        refreshHints();
      } else {
        enterZone('grid');
      }
    }, 100);
    return;
  }
  if (S.mode === 'lightbox') safeClick(document.getElementById('rating-fav'));
  if (S.mode === 'dev') {
    if (!S._resetConfirm) {
      S._resetConfirm = Date.now();
      document.getElementById('dev-reset-overlay')?.classList.add('dev-reset-overlay--open');
      window.__lensUpdateDevHints?.();
    }
  }
}

function actionY()   { if (S.mode === 'dev') return; safeClick(document.getElementById('tb-slideshow')); }
function actionLB()  {
  if (S.mode === 'dev') { switchDevTab(-1); return; }
  if (S.mode === 'lightbox') safeClick(document.querySelector('.lightbox__prev'));
  if (S.mode === 'slideshow') safeClick(document.getElementById('sl-prev'));
}
function actionRB()  {
  if (S.mode === 'dev') { switchDevTab(1); return; }
  if (S.mode === 'lightbox') safeClick(document.querySelector('.lightbox__next'));
  if (S.mode === 'slideshow') safeClick(document.getElementById('sl-next'));
}
function actionLT() {
  if (S.mode !== 'lightbox') return;
  const path = document.getElementById('lightbox')?.dataset.currentPath;
  if (!path) return;
  const cur = getPhotoRating(path).stars;
  if (cur <= 0) return;
  const target = cur === 1 ? 1 : cur - 1; // cur=1→click star1→toggle→0, else→click star(cur-1)→cur-1
  const el = document.querySelector(`.rating__star[data-v="${target}"]`);
  if (el) safeClick(el);
}
function actionRT() {
  if (S.mode !== 'lightbox') return;
  const path = document.getElementById('lightbox')?.dataset.currentPath;
  if (!path) return;
  const cur = getPhotoRating(path).stars;
  if (cur >= 5) return;
  const el = document.querySelector(`.rating__star[data-v="${cur + 1}"]`);
  if (el) safeClick(el);
}
function actionLS()  { if (S.mode === 'slideshow') safeClick(document.getElementById('sl-pause')); }
function actionRS()  { if (S.mode === 'lightbox') gpLightboxResetZoom(); if (S.mode === 'slideshow') safeClick(document.getElementById('sl-fit')); }
function actionStart() { if (S.mode === 'dev') return; safeClick(document.getElementById('tb-settings')); }
function actionBack()  { if (S.mode === 'dev') return; safeClick(document.getElementById('tb-shortcuts')); }

// ── Visual Effects ──

function applyFloat(lx, ly) {
  const target = S.zone === 'sidebar' ? S.sidebarEls[S.sidebarIdx]
               : S.zone === 'hero'    ? S.heroEls[S.heroIdx]
               : S.zone === 'toolbar' ? S.toolbarEls[S.toolbarIdx]
               : S.gridEls[S.gridIdx];

  if (!target) { releaseFloat(); return; }
  if (target !== S.floatCard) { releaseFloat(); S.floatCard = target; }

  target.style.transform = `translateX(${lx * FLOAT_LIFT}px) translateY(${ly * FLOAT_LIFT}px) scale3d(1.005, 1.005, 1)`;
  target.style.transition = 'none';
  target.style.setProperty('--shine-x', (50 + lx * 30) + '%');
  target.style.setProperty('--shine-y', (50 + ly * 30) + '%');
}

function releaseFloat() {
  if (S.floatCard) {
    S.floatCard.style.transform = '';
    S.floatCard.style.transition = '';
    S.floatCard.style.setProperty('--shine-x', '50%');
    S.floatCard.style.setProperty('--shine-y', '50%');
    S.floatCard = null;
  }
}

function sweepGlow(el, dir) {
  if (!el) return;
  if (!S.glow.el) {
    S.glow.el = document.createElement('div');
    S.glow.el.className = 'gamepad-glow';
    document.body.appendChild(S.glow.el);
  }
  if (S.glow.raf) cancelAnimationFrame(S.glow.raf);

  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const starts = {
    left:  [r.right, cy],
    right: [r.left, cy],
    up:    [cx, r.bottom],
    down:  [cx, r.top],
  };
  const [sx, sy] = starts[dir] || [cx, cy];

  S.glow.el.style.width  = r.width + 'px';
  S.glow.el.style.height = r.height + 'px';
  S.glow.el.style.borderRadius = getComputedStyle(el).borderRadius;
  S.glow.el.style.left = (sx - r.width / 2) + 'px';
  S.glow.el.style.top  = (sy - r.height / 2) + 'px';
  S.glow.el.classList.add('gamepad-glow--active');

  let t = 0;
  const sweep = () => {
    t += 0.03;
    if (t >= 2.8) {
      S.glow.el.classList.remove('gamepad-glow--active');
      S.glow.raf = null;
      return;
    }
    if (t <= 1) {
      const e = 1 - Math.pow(1 - t, 2);
      S.glow.el.style.left = (sx + (cx - sx) * e - r.width / 2) + 'px';
      S.glow.el.style.top  = (sy + (cy - sy) * e - r.height / 2) + 'px';
    }
    S.glow.raf = requestAnimationFrame(sweep);
  };
  S.glow.raf = requestAnimationFrame(sweep);
}

function clearGlow() {
  if (S.glow.raf) { cancelAnimationFrame(S.glow.raf); S.glow.raf = null; }
  if (S.glow.el) { S.glow.el.classList.remove('gamepad-glow--active'); }
}

// ── Button Hints (自动管理，仅依据 S.input + S.zone) ──

function refreshHints() {
  // 清除旧提示
  document.querySelectorAll('.gp-hint, .gp-stick-row').forEach(el => el.remove());
  if (S.input !== 'gamepad') return;

  const lbActive = document.getElementById('lightbox')?.classList.contains('active');
  const ssActive = document.getElementById('slideshow')?.classList.contains('active');

  // ── Sidebar ──
  if (S.zone === 'sidebar') {
    const focused = S.sidebarEls[S.sidebarIdx];
    if (focused?.classList.contains('sidebar__item')) {
      const h = document.createElement('span');
      h.className = 'gp-hint';
      h.innerHTML = window.__lensGPImg('x') + '<span class="gp-hint__label">删除</span>';
      focused.appendChild(h);
    }
    if (focused?.id === 'sidebar-add') {
      const h = document.createElement('span');
      h.className = 'gp-hint';
      h.innerHTML = window.__lensGPImg('a') + '<span class="gp-hint__label">添加</span>';
      focused.appendChild(h);
    }
  }

  // ── Lightbox ──
  if (lbActive) {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    // LB/RB 固定定位按钮提示
    lb.insertAdjacentHTML('beforeend',
      `<span class="gp-hint gp-hint--lb-fixed">${window.__lensGPImg('lb')}<span>上一张</span></span>` +
      `<span class="gp-hint gp-hint--rb-fixed">${window.__lensGPImg('rb')}<span>下一张</span></span>`
    );
    // 加减星等操作提示 — 固定在窗口左下角
    const hintRow = document.createElement('div');
    hintRow.className = 'gp-stick-row';
    hintRow.innerHTML =
      '<span class="gp-hint gp-hint--fav">' + window.__lensGPImg('lt') + '<span>-1星</span></span>' +
      '<span class="gp-hint gp-hint--fav">' + window.__lensGPImg('rt') + '<span>+1星</span></span>' +
      '<span class="gp-hint gp-hint--fav">' + window.__lensGPImg('x') + '<span>收藏</span></span>' +
      '<span class="gp-hint gp-hint--fav">' + window.__lensGPImg('ls') + '<span>移动</span></span>' +
      '<span class="gp-hint gp-hint--fav">' + window.__lensGPImg('rs') + '<span>缩放</span></span>' +
      '<span class="gp-hint gp-hint--fav">' + window.__lensGPImg('rs-press') + '<span>复位</span></span>';
    document.body.appendChild(hintRow);
  }

  // ── Slideshow ──
  if (ssActive) {
    const prev = document.querySelector('#sl-prev');
    const next = document.querySelector('#sl-next');
    if (prev) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = window.__lensGPImg('lb');
      prev.appendChild(h);
    }
    if (next) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = window.__lensGPImg('rb');
      next.appendChild(h);
    }
    // LS 暂停图标放在暂停按钮旁
    const pauseBtn = document.getElementById('sl-pause');
    if (pauseBtn) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = window.__lensGPImg('ls-press');
      pauseBtn.appendChild(h);
    }
    // RS 复位图标放在适配按钮旁
    const fitBtn = document.getElementById('sl-fit');
    if (fitBtn) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = window.__lensGPImg('rs-press');
      fitBtn.appendChild(h);
    }
  }
}

// ── Debounce (rising-edge trigger) ──

function debounce(fn) {
  let state = false;
  return (pressed) => {
    if (pressed && !state) { state = true; fn(); }
    if (!pressed) state = false;
  };
}

// ── Button debouncers (created once) ──

const btnA = debounce(() => actionA());
const btnB = debounce(() => actionB());
const btnX = debounce(() => actionX());
const btnY = debounce(() => actionY());
const btnLB = debounce(() => actionLB());
const btnRB = debounce(() => actionRB());
const btnLT = debounce(() => actionLT());
const btnRT = debounce(() => actionRT());
const btnLS = debounce(() => actionLS());
const btnRS = debounce(() => actionRS());
const btnStart = debounce(() => actionStart());
const btnBack = debounce(() => actionBack());
const btnDpadL = debounce(() => { if (S.mode === 'lightbox' || S.mode === 'slideshow') actionLB(); });
const btnDpadR = debounce(() => { if (S.mode === 'lightbox' || S.mode === 'slideshow') actionRB(); });

// ── Poll Loop ──

function poll() {
  try {
    const gamepads = navigator.getGamepads();
    let active = null;
    for (const gp of gamepads) { if (gp?.connected) { active = gp; break; } }

    if (!active) { S.raf = requestAnimationFrame(poll); return; }

    const map = BTN[detectLayout(active)];
    const lx = active.axes[0] || 0;
    const ly = active.axes[1] || 0;

    // ── Detect mode change ──
    const mode = detectMode();
    const modeChanged = S.mode !== mode;
    const wasOverlay = OVERLAYS.has(S.mode);
    const isOverlay = OVERLAYS.has(mode);

    if (modeChanged) {
      releaseFloat();
      const oldMode = S.mode; // 保存旧模式

      if (!wasOverlay && isOverlay) {
        // 进入叠加模式：保存当前位置
        S.ovSave.gridIdx = S.gridIdx;
        S.ovSave.mode = S.mode;
      }

      S.mode = mode;

      // settings 进入/退出时管理元素列表（仅手柄模式应用焦点）
      if (mode === 'settings') {
        buildSettingsEls(); S.settingsIdx = 0;
        if (S.input === 'gamepad') applySettingsFocus();
      }
      if (mode === 'dev') {
        buildDevEls();
        // 如果是同一个 tab（重新打开面板），恢复上次位置；否则重置
        const curGroup = document.querySelector('.dev-nav__tab--active')?.dataset.group;
        if (curGroup !== S._devGroupCache) S.devIdx = 0;
        S._devGroupCache = curGroup;
        S.prevDX = 0; S.prevDY = 0;
        if (S.devIdx >= S.devEls.length) S.devIdx = Math.max(0, S.devEls.length - 1);
        if (S.input === 'gamepad') applyDevFocus();
        window.__lensUpdateDevHints?.();
      }
      if (wasOverlay && !isOverlay) {
        // 退出叠加模式：恢复位置
        if (S.zone === 'grid') {
          S.gridIdx = (mode === S.ovSave.mode) ? S.ovSave.gridIdx : 0;
        }
      } else if (!isOverlay && !wasOverlay) {
        // 非叠加模式间切换
        if (oldMode === 'browse' && mode === 'gallery') {
          // browse→gallery：保存当前分类卡位置
          _savedBrowseIdx = S.gridIdx;
          S.gridIdx = 0;
          S.zone = 'grid'; // 确保在 grid 区
        } else if (oldMode === 'gallery' && mode === 'browse') {
          // gallery→browse：回到之前打开的分类卡位置，强制回到 grid 区
          S.gridIdx = (typeof _savedBrowseIdx !== 'undefined') ? _savedBrowseIdx : 0;
          S.zone = 'grid'; // ← 核心修复：从 hero 区退出画廊时切回 grid
        } else {
          S.gridIdx = 0;
        }
      }

      // 非 overlay 模式：重建元素列表 + 确保 zone 正确（ensureFocus 处理视觉焦点）
      if (!isOverlay) {
        if (mode === 'browse' && S.zone !== 'grid') S.zone = 'grid';
        if (S.zone === 'grid') { buildGridEls(); clampGridIdx(); }
      }
      refreshHints(); // 模式切换时更新肩键提示
    }

    // ── mouse → gamepad detection（持续确认 + 冷却期） ──
    if (S.input === 'mouse') {
      const inCooldown = performance.now() < S._gpCooldownUntil;
      const anyButton = active.buttons.some(b => b?.pressed);
      const stickActive = Math.abs(lx) > DEAD_ZONE || Math.abs(ly) > DEAD_ZONE;

      // 按钮按下 = 明确用户意图，立即中断冷却并切换
      if (anyButton) {
        S._gpCooldownUntil = 0; // 取消冷却
        setInput('gamepad');
        S._gpConfirmCount = 0;
        // Fall through to process this frame
      } else if (inCooldown) {
        // 冷却期内无按钮：忽略摇杆输入（防鼠标移动后立即被摇杆噪声切回）
        S._gpConfirmCount = 0;
        S.raf = requestAnimationFrame(poll);
        return;
      } else if (stickActive) {
        // 冷却期外摇杆：累加确认帧
        S._gpConfirmCount++;
        if (S._gpConfirmCount >= GP_CONFIRM_FRAMES) {
          setInput('gamepad');
          S._gpConfirmCount = 0;
          // Fall through to process this frame
        } else {
          S.raf = requestAnimationFrame(poll);
          return;
        }
      } else {
        // 无输入：衰减计数
        S._gpConfirmCount = Math.max(0, S._gpConfirmCount - 2);
        S.raf = requestAnimationFrame(poll);
        return;
      }
    }

    // ── Navigation (only in non-overlay modes) ──
    if (!isOverlay) {
      // 上升沿方向检测 (D-pad + 左摇杆)
        const rawX = (active.buttons[map.LEFT]?.pressed ? -1 : 0)
                   + (active.buttons[map.RIGHT]?.pressed ? 1 : 0)
                   + (lx < -DPAD_THRESHOLD ? -1 : 0)
                   + (lx > DPAD_THRESHOLD ? 1 : 0);
        const rawY = (active.buttons[map.UP]?.pressed ? -1 : 0)
                   + (active.buttons[map.DOWN]?.pressed ? 1 : 0)
                   + (ly < -DPAD_THRESHOLD ? -1 : 0)
                   + (ly > DPAD_THRESHOLD ? 1 : 0);

        const dx = (Math.abs(lx) < DEAD_ZONE
          && !active.buttons[map.LEFT]?.pressed
          && !active.buttons[map.RIGHT]?.pressed) ? 0 : rawX;
        const dy = (Math.abs(ly) < DEAD_ZONE
          && !active.buttons[map.UP]?.pressed
          && !active.buttons[map.DOWN]?.pressed) ? 0 : rawY;

        // ── 下拉菜单拦截 ──
        const openMenu = document.querySelector('.custom-dropdown__menu--open');
        if (openMenu) {
          const opts = openMenu.querySelectorAll('.custom-dropdown__option');
          if (dy < 0 && S.prevDY >= 0 && opts.length > 0) {
            const cur = openMenu.querySelector('.custom-dropdown__option.hero--focused') || openMenu.querySelector('.custom-dropdown__option--sel');
            let oi = Array.from(opts).indexOf(cur);
            if (oi < 0) oi = 0;
            oi = Math.max(0, oi - 1);
            opts.forEach(o => o.classList.remove('hero--focused'));
            opts[oi].classList.add('hero--focused');
          }
          if (dy > 0 && S.prevDY <= 0 && opts.length > 0) {
            const cur = openMenu.querySelector('.custom-dropdown__option.hero--focused') || openMenu.querySelector('.custom-dropdown__option--sel');
            let oi = Array.from(opts).indexOf(cur);
            if (oi < 0) oi = 0;
            oi = Math.min(opts.length - 1, oi + 1);
            opts.forEach(o => o.classList.remove('hero--focused'));
            opts[oi].classList.add('hero--focused');
          }
          if ((dx < 0 && S.prevDX >= 0) || (dx > 0 && S.prevDX <= 0)) {
            openMenu.classList.remove('custom-dropdown__menu--open');
            document.querySelector('.custom-dropdown__trigger--open')?.classList.remove('custom-dropdown__trigger--open');
            if (dx < 0) S.heroIdx = Math.max(0, S.heroIdx - 1);
            if (dx > 0) S.heroIdx = Math.min(S.heroEls.length - 1, S.heroIdx + 1);
            applyHeroFocus();
          }
        } else {
          if (dx < 0 && S.prevDX >= 0) navigate('left');
          if (dx > 0 && S.prevDX <= 0) navigate('right');
          if (dy < 0 && S.prevDY >= 0) navigate('up');
          if (dy > 0 && S.prevDY <= 0) navigate('down');
        }
        S.prevDX = dx;
        S.prevDY = dy;

        // ── Float (摇杆微动，仅 grid/hero/sidebar) ──
        const dpadX = (active.buttons[map.LEFT]?.pressed ? -1 : 0) + (active.buttons[map.RIGHT]?.pressed ? 1 : 0);
        const dpadY = (active.buttons[map.UP]?.pressed ? -1 : 0) + (active.buttons[map.DOWN]?.pressed ? 1 : 0);
        const floatX = Math.abs(lx) > 0.08 ? lx : dpadX;
        const floatY = Math.abs(ly) > 0.08 ? ly : dpadY;

        if (Math.abs(floatX) > 0.08 || Math.abs(floatY) > 0.08) {
          applyFloat(floatX, floatY);
        } else if (S.floatCard) {
          releaseFloat();
        }
    } else if (mode === 'settings') {
      // ── Settings overlay ──
      if (S.settingsEls.length === 0) { buildSettingsEls(); S.settingsIdx = 0; }
      const cur = S.settingsEls[S.settingsIdx];
      const isDensity = cur && cur._density;

      // 垂直 UP/DOWN
      const rawSY = (active.buttons[map.UP]?.pressed ? -1 : 0)
                  + (active.buttons[map.DOWN]?.pressed ? 1 : 0)
                  + (ly < -DPAD_THRESHOLD ? -1 : 0)
                  + (ly > DPAD_THRESHOLD ? 1 : 0);
      const sdy = (Math.abs(ly) < DEAD_ZONE
        && !active.buttons[map.UP]?.pressed
        && !active.buttons[map.DOWN]?.pressed) ? 0 : rawSY;

      if (sdy < 0 && S.prevDY >= 0) {
        S.settingsIdx = Math.max(0, S.settingsIdx - 1);
        applySettingsFocus();
      }
      if (sdy > 0 && S.prevDY <= 0) {
        S.settingsIdx = Math.min(S.settingsEls.length - 1, S.settingsIdx + 1);
        applySettingsFocus();
      }
      S.prevDY = sdy;

      // 密度条目内：LEFT/RIGHT 切换小/中/大
      if (isDensity) {
        const rawSX = (active.buttons[map.LEFT]?.pressed ? -1 : 0)
                    + (active.buttons[map.RIGHT]?.pressed ? 1 : 0)
                    + (lx < -DPAD_THRESHOLD ? -1 : 0)
                    + (lx > DPAD_THRESHOLD ? 1 : 0);
        const sdx = (Math.abs(lx) < DEAD_ZONE
          && !active.buttons[map.LEFT]?.pressed
          && !active.buttons[map.RIGHT]?.pressed) ? 0 : rawSX;

        if (sdx < 0 && S.prevDX >= 0) {
          S.settingsDensityIdx = Math.max(0, S.settingsDensityIdx - 1);
          applySettingsFocus();
        }
        if (sdx > 0 && S.prevDX <= 0) {
          S.settingsDensityIdx = Math.min(cur.buttons.length - 1, S.settingsDensityIdx + 1);
          applySettingsFocus();
        }
        S.prevDX = sdx;
      }
    } else if (mode === 'dev') {
      // ── Dev panel overlay ──

      // 悬浮窗打开时，长按 B 关闭，其他输入跳过
      const floatOpen = document.getElementById('dev-gp-float')?.classList.contains('dev-gp-float--open');
      if (floatOpen) {
        if (active.buttons[map.B]?.pressed) {
          if (!S._floatBHoldStart) S._floatBHoldStart = performance.now();
          const held = performance.now() - S._floatBHoldStart;
          const bar = document.getElementById('dev-gp-float-bar');
          if (bar) bar.style.width = Math.min(100, (held / 800) * 100) + '%';
          if (held > 800) {
            document.getElementById('dev-gp-float').classList.remove('dev-gp-float--open');
            S._floatBHoldStart = 0;
            if (bar) bar.style.width = '0%';
          }
        } else {
          S._floatBHoldStart = 0;
          const bar = document.getElementById('dev-gp-float-bar');
          if (bar) bar.style.width = '0%';
        }
        S.prevDY = 0; S.prevDX = 0;
        S.raf = requestAnimationFrame(poll); return;
      }

      // 1) Tab 切换检测 → 重建元素列表
      const curGroup = document.querySelector('.dev-nav__tab--active')?.dataset.group;
      if (curGroup && curGroup !== S._devGroupCache) {
        S._devGroupCache = curGroup;
        buildDevEls();
        // 定位到当前激活的标签
        const activeTab = document.querySelector('.dev-nav__tab--active');
        S.devIdx = activeTab ? S.devEls.indexOf(activeTab) : 0;
        if (S.devIdx < 0) S.devIdx = 0;
        applyDevFocus();
      }
      if (!S.devEls.length) { buildDevEls(); applyDevFocus(); }
      // 检测 DOM 变化（预设加载等会重建 DOM）
      const focusTarget = S.devEls[S.devIdx]?.el || S.devEls[S.devIdx];
      if (focusTarget && !focusTarget.isConnected) { buildDevEls(); S.devIdx = Math.min(S.devIdx, S.devEls.length - 1); applyDevFocus(); }
      if (S.devIdx >= S.devEls.length) S.devIdx = Math.max(0, S.devEls.length - 1);

      // 2) UP/DOWN 导航（上升沿）
      const sdy = (active.buttons[map.UP]?.pressed || ly < -DPAD_THRESHOLD) ? -1
                : (active.buttons[map.DOWN]?.pressed || ly > DPAD_THRESHOLD) ? 1 : 0;
      if (sdy < 0 && S.prevDY >= 0) { S.devIdx = Math.max(0, S.devIdx - 1); applyDevFocus(); }
      if (sdy > 0 && S.prevDY <= 0) { S.devIdx = Math.min(S.devEls.length - 1, S.devIdx + 1); applyDevFocus(); }
      S.prevDY = sdy;

      // 3) LEFT/RIGHT — 可调元素调值，否则切区（上升沿）
      const sdx = (active.buttons[map.LEFT]?.pressed || lx < -DPAD_THRESHOLD) ? -1
                : (active.buttons[map.RIGHT]?.pressed || lx > DPAD_THRESHOLD) ? 1 : 0;
      const navCount = document.querySelectorAll('#dev-nav .dev-nav__tab').length;
      const curEl = S.devEls[S.devIdx];
      const isAdjustable = curEl && (curEl._slider || curEl._color || curEl._text);

      if (sdx !== 0 && S.prevDX === 0) {
        if (isAdjustable) {
          adjustDevValue(curEl, Math.sign(sdx));
        } else if (sdx > 0 && S.devIdx < navCount && navCount < S.devEls.length) {
          S.devIdx = navCount; applyDevFocus();
        } else if (sdx < 0 && S.devIdx >= navCount) {
          const activeTab = document.querySelector('.dev-nav__tab--active');
          S.devIdx = activeTab ? S.devEls.indexOf(activeTab) : 0;
          if (S.devIdx < 0) S.devIdx = 0;
          applyDevFocus();
        }
      }
      S.prevDX = sdx;

      // 4) 复位确认：X 长按 1 秒执行，B 取消
      if (S._resetConfirm) {
        const xHeld = active.buttons[map.X]?.pressed;
        if (xHeld) {
          if (!S._resetHoldStart) S._resetHoldStart = Date.now();
          const held = Date.now() - S._resetHoldStart;
          // 更新进度条
          const bar = document.getElementById('dev-reset-bar');
          if (bar) bar.style.width = Math.min(100, (held / 1000) * 100) + '%';
          if (held > 1000) {
            window.__lensResetAll?.();
            S._resetConfirm = 0; S._resetHoldStart = 0;
            document.getElementById('dev-reset-overlay')?.classList.remove('dev-reset-overlay--open');
            applyDevFocus();
          }
        } else {
          S._resetHoldStart = 0;
          const bar = document.getElementById('dev-reset-bar');
          if (bar) bar.style.width = '0%';
        }
      }

      // 5) 右摇杆翻页
      const ry = active.axes[3] || 0;
      if (Math.abs(ry) > 0.1) {
        const content = document.getElementById('dev-content');
        if (content) {
          const now = performance.now();
          const dt = S._lastScrollTime ? Math.min(now - S._lastScrollTime, 50) : 16;
          S._lastScrollTime = now;
          content.scrollTop += Math.sign(ry) * (ry * ry * 0.8 + Math.abs(ry) * 0.2) * dt;
        }
      } else { S._lastScrollTime = 0; }
    }

    // ── Buttons (always processed, regardless of overlay) ──
    btnA(active.buttons[map.A]?.pressed);
    btnB(active.buttons[map.B]?.pressed);
    btnX(active.buttons[map.X]?.pressed);
    btnY(active.buttons[map.Y]?.pressed);
    btnLB(active.buttons[map.LB]?.pressed);
    btnRB(active.buttons[map.RB]?.pressed);
    btnLT(active.buttons[map.LT]?.pressed);
    btnRT(active.buttons[map.RT]?.pressed);
    btnLS(active.buttons[map.LS]?.pressed);
    btnRS(active.buttons[map.RS]?.pressed);
    // START+BACK — 延迟确认 + 冷却期防误触
    const startHeld = active.buttons[map.START]?.pressed;
    const backHeld = active.buttons[map.BACK]?.pressed;
    const now = performance.now();
    const inCooldown = now < (S._comboCooldown || 0);
    if (startHeld && backHeld) {
      if (!S._comboFired && !inCooldown) {
        window.__lensToggleDev?.();
        S._comboFired = true;
        S._comboCooldown = now + 800;
      }
      S._startPending = 0;
    } else if (startHeld && !S._startWasHeld) {
      if (!inCooldown) {
        S._startPending = 3;
      }
      S._comboFired = false;
    } else if (backHeld && !S._backWasHeld) {
      S._startPending = 0;
      S._comboFired = false;
      if (!inCooldown) actionBack();
    } else {
      S._comboFired = false;
    }
    if (S._startPending > 0) {
      S._startPending--;
      if (S._startPending === 0 && !S._comboFired) actionStart();
    }
    S._startWasHeld = startHeld;
    S._backWasHeld = backHeld;
    // D-pad LEFT/RIGHT 在 lightbox/slideshow 中翻页
    btnDpadL(active.buttons[map.LEFT]?.pressed);
    btnDpadR(active.buttons[map.RIGHT]?.pressed);

    // ── Lightbox / Slideshow zoom/pan (only in gamepad mode) ──
    if (S.input === 'gamepad' && (mode === 'lightbox' || mode === 'slideshow')) {
      const ry = active.axes[3] || 0;
      const lx = active.axes[0] || 0;
      const ly = active.axes[1] || 0;
      if (mode === 'lightbox') {
        if (Math.abs(ry) > 0.1) gpLightboxZoom(-ry, 0, 0);
        if (Math.abs(lx) > 0.1 || Math.abs(ly) > 0.1) gpLightboxZoom(0, -lx, -ly);
      } else {
        if (Math.abs(ry) > 0.1) gpSlideshowZoom(-ry, 0, 0);
        if (Math.abs(lx) > 0.1 || Math.abs(ly) > 0.1) gpSlideshowZoom(0, -lx, -ly);
      }
    }
  } catch (e) {
    console.error('[LENS] gamepad poll error:', e);
  }

  // ── 中央焦点维护（每帧）──
  ensureFocus();

  // 暴露状态快照供 dev panel 读取
  window.__lensGamepadState = {
    mode: S.mode, zone: S.zone, input: S.input,
    gridIdx: S.gridIdx, heroIdx: S.heroIdx, sidebarIdx: S.sidebarIdx, toolbarIdx: S.toolbarIdx,
    settingsIdx: S.settingsIdx, devIdx: S.devIdx,
    gridEls: [...S.gridEls], heroEls: [...S.heroEls], sidebarEls: [...S.sidebarEls], toolbarEls: [...S.toolbarEls],
    settingsEls: [...S.settingsEls], devEls: [...S.devEls],
    cooldownUntil: S._gpCooldownUntil,
    resetConfirm: S._resetConfirm,
  };

  // 状态快照更新后再刷新提示面板（确保读到最新 devIdx）
  if (S.mode === 'dev') window.__lensUpdateDevHints?.();

  S.raf = requestAnimationFrame(poll);
}

// ── Public API ──

export function initGamepad() {
  if (S.raf) return;

  // ── Mouse detection for gamepad→mouse switching ──
  const onMove = (e) => {
    if (S.input === 'gamepad') {
      const dx = e.clientX - S.anchor.x;
      const dy = e.clientY - S.anchor.y;
      if (dx * dx + dy * dy > MOUSE_SWITCH_DIST * MOUSE_SWITCH_DIST) {
        setInput('mouse');
      }
    } else {
      S.anchor.x = e.clientX;
      S.anchor.y = e.clientY;
    }
  };
  const onClick = () => {
    if (!S.clicking && S.input === 'gamepad') setInput('mouse');
  };
  const onConnected = () => {
    if (!S.raf) S.raf = requestAnimationFrame(poll);
  };
  const onDisconnected = () => {
    if (S.input === 'gamepad') setInput('mouse');
  };

  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('click', onClick, { passive: true });
  window.addEventListener('gamepadconnected', onConnected);
  window.addEventListener('gamepaddisconnected', onDisconnected);

  // ── 存储事件监听器引用 ──
  _listeners = { onMove, onClick, onConnected, onDisconnected };

  // ── 监听 DOM 变化，保持元素列表最新（视觉焦点由 ensureFocus 处理）──
  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid) {
    const galleryObs = new MutationObserver(() => {
      if (S.mode === 'gallery') {
        buildGridEls();
        clampGridIdx();
      }
    });
    galleryObs.observe(galleryGrid, { childList: true, subtree: true });
    _listeners.galleryObs = galleryObs;
  }
  const categoriesEl = document.getElementById('categories');
  if (categoriesEl) {
    const catObs = new MutationObserver(() => {
      if (S.mode === 'browse') {
        buildGridEls();
        clampGridIdx();
      }
    });
    catObs.observe(categoriesEl, { childList: true, subtree: true });
    _listeners.catObs = catObs;
  }

  // ── Start polling ──
  S.raf = requestAnimationFrame(poll);
}

export function destroyGamepad() {
  // Stop polling
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }

  // Remove event listeners
  if (_listeners) {
    document.removeEventListener('mousemove', _listeners.onMove);
    document.removeEventListener('click', _listeners.onClick);
    window.removeEventListener('gamepadconnected', _listeners.onConnected);
    window.removeEventListener('gamepaddisconnected', _listeners.onDisconnected);
    if (_listeners.galleryObs) _listeners.galleryObs.disconnect();
    if (_listeners.catObs) _listeners.catObs.disconnect();
    _listeners = null;
  }

  // Clear visual effects
  clearGlow();
  if (S.glow.el) { S.glow.el.remove(); S.glow.el = null; }
  releaseFloat();

  // Clear sidebar state
  sf()?.classList.remove('sidebar--open', 'sidebar--peek');

  // Clear focus classes
  document.body.classList.remove('gamepad-active');
  document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
  clearAllCardFocus();
  document.querySelectorAll('.gp-hint').forEach(el => el.remove());

  // Reset all state
  S.input = 'mouse'; S.mode = 'browse'; S.zone = 'grid';
  S.gridIdx = 0; S.heroIdx = 0; S.sidebarIdx = 0; S.toolbarIdx = 0; S.settingsIdx = 0; S.settingsDensityIdx = 0;
  S.devIdx = 0;
  S.gridEls = []; S.heroEls = []; S.sidebarEls = []; S.toolbarEls = []; S.settingsEls = []; S.devEls = [];
  if (S._sidebarRebuildTimer != null) { clearTimeout(S._sidebarRebuildTimer); S._sidebarRebuildTimer = null; }
  S._comboFired = false; S._startWasHeld = false; S._backWasHeld = false; S._startPending = 0;
  S._devGroupCache = null;
  S._gpConfirmCount = 0; S._gpCooldownUntil = 0;
  S._floatBHoldStart = 0; S._comboCooldown = 0;
  S.save = { zone: null, mode: null, gridIdx: 0, heroIdx: 0 };
  S.ovSave = { mode: null, gridIdx: 0 };
  S.anchor = { x: 0, y: 0 };
  S.prevDX = 0; S.prevDY = 0;
  S.clicking = false;
  S.floatCard = null;
  S._lastScrollTime = 0;
  _savedBrowseIdx = 0;
  window.__lensGamepadState = null;
}
