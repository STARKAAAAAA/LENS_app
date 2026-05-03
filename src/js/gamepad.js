import { getPhotoRating, gpLightboxZoom, gpLightboxResetZoom, gpSlideshowZoom, gpSlideshowResetZoom } from './lightbox.js';

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

const DEAD_ZONE = 0.15;
const DPAD_THRESHOLD = 0.3;
const FLOAT_LIFT = 5;
const MOUSE_SWITCH_DIST = 6; // px — 鼠标偏离锚点超过此距离切回鼠标模式
const OVERLAYS = new Set(['lightbox', 'slideshow', 'settings', 'shortcuts']);
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

  // Glow sweep
  glow: { el: null, raf: null },

  // rAF handle
  raf: null,
};

// ── Mode Detection (read DOM state) ──

function detectMode() {
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

    // 进入合适的 zone
    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('sidebar--open')) {
      enterZone('sidebar');
    } else if (!OVERLAYS.has(S.mode)) {
      enterZone('grid');
    }
    refreshFocus();
    refreshHints(); // overlay 模式下 enterZone 不会被调用，需要手动刷新提示
  } else {
    // ── gamepad → mouse ──
    releaseFloat();
    clearGlow();
    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();
    S.gridEls = [];
    S.heroEls = [];
    S.sidebarEls = [];
    S.toolbarEls = [];
    S.settingsEls = [];
    S.gridIdx = 0;
    S.heroIdx = 0;
    S.sidebarIdx = 0;
    S.toolbarIdx = 0;
    S.settingsIdx = 0;
    S.settingsDensityIdx = 0;
    S.zone = 'grid';

    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.remove('sidebar--open', 'sidebar--peek');
    gpTrackLogoStop(true);

    document.body.classList.remove('gamepad-active');
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
    S.sidebarIdx = 0;
    applySidebarFocus();

    // 确保 sidebar 完全打开
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.add('sidebar--open');
    sidebar?.classList.remove('sidebar--peek');
    gpTrackLogoStart();
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
    applyToolbarFocus();
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
    applyHeroFocus();
  } else if (zone === 'grid') {
    document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
    clearAllCardFocus();

    S.zone = 'grid';

    if (prevZone === 'sidebar') {
      S.gridIdx = (S.mode === S.save.mode) ? S.save.gridIdx : 0;
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.remove('sidebar--open', 'sidebar--peek');
      gpTrackLogoStop(true);
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
    applyGridFocus();
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

function applyGridFocus() {
  clearAllCardFocus();
  const el = S.gridEls[S.gridIdx];
  if (el) {
    el.classList.add('card--focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

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

function applySidebarFocus() {
  S.sidebarEls.forEach(el => el.classList.remove('hero--focused'));
  const el = S.sidebarEls[S.sidebarIdx];
  if (el) {
    el.classList.add('hero--focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  refreshHints(); // 提示跟随焦点移动
}

function applyToolbarFocus() {
  S.toolbarEls.forEach(el => el.classList.remove('hero--focused'));
  const el = S.toolbarEls[S.toolbarIdx];
  if (el) {
    el.classList.add('hero--focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

// refreshFocus — mode/zone 变化后刷新焦点视觉
function refreshFocus() {
  if (S.zone === 'grid') {
    buildGridEls(); clampGridIdx(); applyGridFocus();
  } else if (S.zone === 'hero') {
    buildHeroEls();
    S.heroIdx = Math.min(S.heroIdx, Math.max(0, S.heroEls.length - 1));
    applyHeroFocus();
  } else if (S.zone === 'sidebar') {
    buildSidebarEls();
    S.sidebarIdx = Math.min(S.sidebarIdx, Math.max(0, S.sidebarEls.length - 1));
    applySidebarFocus();
  } else if (S.zone === 'toolbar') {
    buildToolbarEls();
    S.toolbarIdx = Math.min(S.toolbarIdx, Math.max(0, S.toolbarEls.length - 1));
    applyToolbarFocus();
  }
}

// ── Navigation ──

function countGridCols() {
  if (S.gridEls.length < 2) return 1;
  const set = new Set();
  for (const el of S.gridEls) set.add(el.offsetLeft);
  return set.size || 1;
}

function navigate(dir) {
  // 非左方向键取消 sidebar peek
  if (dir !== 'left') {
    const sb = document.getElementById('sidebar');
    if (sb?.classList.contains('sidebar--peek') && !sb.classList.contains('sidebar--open')) {
      sb.classList.remove('sidebar--peek');
      gpTrackLogoStop(true);
    }
  }

  if (S.zone === 'sidebar') { sidebarNavigate(dir); return; }
  if (S.zone === 'hero')    { heroNavigate(dir);    return; }
  if (S.zone === 'toolbar') { toolbarNavigate(dir);  return; }
  gridNavigate(dir);
}

function gridNavigate(dir) {
  if (S.gridEls.length === 0) { buildGridEls(); }
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

  // 应用焦点
  if (S.gridIdx !== prevIdx) {
    applyGridFocus();
    sweepGlow(S.gridEls[S.gridIdx], dir);
  } else {
    // 索引未变，焦点已在目标元素上（由上次 applyGridFocus 设置），无需重新设置
    const el = S.gridEls[S.gridIdx];
    if (el && !el.classList.contains('card--focused')) {
      el.classList.add('card--focused');
    }
  }
}

// trySidebarPeek — 第一次左：探出；第二次左：完全展开 + 进入 sidebar zone
function trySidebarPeek() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (sidebar.classList.contains('sidebar--open')) {
    // 已打开（如鼠标打开的）→ 直接接管
    enterZone('sidebar');
  } else if (sidebar.classList.contains('sidebar--peek')) {
    // 第二次左 → 完全展开
    enterZone('sidebar');
  } else {
    // 第一次左 → 探出（仅探出，logo 不动，匹配鼠标行为）
    sidebar.classList.add('sidebar--peek');
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

  applyHeroFocus();
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

  applyToolbarFocus();
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
      applySidebarFocus();
      if (prev !== S.sidebarIdx) sweepGlow(S.sidebarEls[S.sidebarIdx], dir);
      break;
    }
    case 'down': {
      const prev = S.sidebarIdx;
      S.sidebarIdx = Math.min(S.sidebarEls.length - 1, S.sidebarIdx + 1);
      applySidebarFocus();
      if (prev !== S.sidebarIdx) sweepGlow(S.sidebarEls[S.sidebarIdx], dir);
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

  // 非 overlay 模式按 zone 分发
  if (S.zone === 'sidebar') { safeClick(S.sidebarEls[S.sidebarIdx]); return; }
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
  if (m === 'lightbox')  { safeClick(document.querySelector('.lightbox__close')); return; }
  if (m === 'slideshow') { safeClick(document.getElementById('sl-exit')); return; }

  // 非 overlay 模式
  const openMenuB = document.querySelector('.custom-dropdown__menu--open');
  if (openMenuB) { openMenuB.classList.remove('custom-dropdown__menu--open'); document.querySelector('.custom-dropdown__trigger--open')?.classList.remove('custom-dropdown__trigger--open'); return; }
  if (S.zone === 'sidebar') { enterZone(S.save.zone === 'sidebar' ? 'grid' : (S.save.zone || 'grid')); return; }

  if (m === 'gallery') safeClick(document.getElementById('gallery-back'));
}

function actionX() {
  if (S.zone === 'sidebar') {
    const el = S.sidebarEls[S.sidebarIdx];
    safeClick(el?.querySelector('.sidebar__item-remove'));
    // 等待 DOM 更新后重建 sidebar 元素
    setTimeout(() => {
      buildSidebarEls();
      if (S.sidebarEls.length > 0) {
        S.sidebarIdx = Math.min(S.sidebarIdx, S.sidebarEls.length - 1);
        applySidebarFocus();
        refreshHints();
      } else {
        enterZone('grid');
      }
    }, 100);
    return;
  }
  if (S.mode === 'lightbox') safeClick(document.getElementById('rating-fav'));
}

function actionY()   { safeClick(document.getElementById('tb-slideshow')); }
function actionLB()  { if (S.mode === 'lightbox') safeClick(document.querySelector('.lightbox__prev')); if (S.mode === 'slideshow') safeClick(document.getElementById('sl-prev')); }
function actionRB()  { if (S.mode === 'lightbox') safeClick(document.querySelector('.lightbox__next')); if (S.mode === 'slideshow') safeClick(document.getElementById('sl-next')); }
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
function actionStart() { safeClick(document.getElementById('tb-settings')); }
function actionBack()  { safeClick(document.getElementById('tb-shortcuts')); }

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
      h.innerHTML = '<img src="/assets/icons/btn-x.svg"><span class="gp-hint__label">删除</span>';
      focused.appendChild(h);
    }
    if (focused?.id === 'sidebar-add') {
      const h = document.createElement('span');
      h.className = 'gp-hint';
      h.innerHTML = '<img src="/assets/icons/btn-a.svg"><span class="gp-hint__label">添加</span>';
      focused.appendChild(h);
    }
  }

  // ── Lightbox ──
  if (lbActive) {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.insertAdjacentHTML('beforeend',
      `<span class="gp-hint gp-hint--lb-fixed"><img src="/assets/icons/btn-lb.svg"><span>上一张</span></span>` +
      `<span class="gp-hint gp-hint--rb-fixed"><img src="/assets/icons/btn-rb.svg"><span>下一张</span></span>`
    );
    // 全部提示统一放在内容区下面（block 布局，自然换行）
    const content = lb.querySelector('.lightbox__content');
    if (content) {
      const hintRow = document.createElement('div');
      hintRow.className = 'gp-stick-row';
      hintRow.innerHTML =
        '<span class="gp-hint gp-hint--fav"><img src="/assets/icons/btn-lt.svg"><span>-1星</span></span>' +
        '<span class="gp-hint gp-hint--fav"><img src="/assets/icons/btn-rt.svg"><span>+1星</span></span>' +
        '<span class="gp-hint gp-hint--fav"><img src="/assets/icons/btn-x.svg"><span>收藏</span></span>' +
        '<span class="gp-hint gp-hint--fav"><img src="/assets/icons/btn-ls.svg"><span>移动</span></span>' +
        '<span class="gp-hint gp-hint--fav"><img src="/assets/icons/btn-rs.svg"><span>缩放</span></span>' +
        '<span class="gp-hint gp-hint--fav"><img src="/assets/icons/btn-rs-press.svg"><span>复位</span></span>';
      content.appendChild(hintRow);
    }
  }

  // ── Slideshow ──
  if (ssActive) {
    const prev = document.querySelector('#sl-prev');
    const next = document.querySelector('#sl-next');
    if (prev) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = '<img src="/assets/icons/btn-lb.svg">';
      prev.appendChild(h);
    }
    if (next) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = '<img src="/assets/icons/btn-rb.svg">';
      next.appendChild(h);
    }
    // LS 暂停图标放在暂停按钮旁
    const pauseBtn = document.getElementById('sl-pause');
    if (pauseBtn) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = '<img src="/assets/icons/btn-ls-press.svg">';
      pauseBtn.appendChild(h);
    }
    // RS 复位图标放在适配按钮旁
    const fitBtn = document.getElementById('sl-fit');
    if (fitBtn) {
      const h = document.createElement('span');
      h.className = 'gp-hint gp-hint--inline';
      h.innerHTML = '<img src="/assets/icons/btn-rs-press.svg">';
      fitBtn.appendChild(h);
    }
  }
}

// ── LENS Logo 随动追踪（照搬 main.js trackLogo 的 rAF 逻辑）──

function gpTrackLogoStart() { window.__lensStartLogo?.(); }
function gpTrackLogoStop(reset) { if (reset) window.__lensStopLogo?.(); }

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

      // settings 进入/退出时管理元素列表
      if (mode === 'settings') {
        buildSettingsEls(); S.settingsIdx = 0; applySettingsFocus();
      }
      if (wasOverlay && !isOverlay) {
        // 退出叠加模式：恢复位置
        if (S.zone === 'grid') {
          S.gridIdx = (mode === S.ovSave.mode) ? S.ovSave.gridIdx : 0;
        }
      } else if (!isOverlay && !wasOverlay && S.zone === 'grid') {
        // 非叠加模式间切换
        if (oldMode === 'browse' && mode === 'gallery') {
          // browse→gallery：保存当前分类卡位置
          _savedBrowseIdx = S.gridIdx;
          S.gridIdx = 0;
        } else if (oldMode === 'gallery' && mode === 'browse') {
          // gallery→browse：回到之前打开的分类卡位置
          S.gridIdx = (typeof _savedBrowseIdx !== 'undefined') ? _savedBrowseIdx : 0;
        } else {
          S.gridIdx = 0;
        }
      }

      if (!isOverlay && S.zone === 'grid') {
        buildGridEls(); clampGridIdx(); applyGridFocus();
      }
      refreshHints(); // 模式切换时更新肩键提示
    }

    // ── mouse → gamepad detection ──
    if (S.input === 'mouse') {
      const hasInput = Math.abs(lx) > DEAD_ZONE || Math.abs(ly) > DEAD_ZONE
        || active.buttons.some(b => b?.pressed);
      if (hasInput) {
        setInput('gamepad');
        // Fall through to process this frame
      } else {
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
        // 上升沿：按一次移动一次（和正常导航一致）
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
        // LEFT/RIGHT 关闭菜单回 hero
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
    btnStart(active.buttons[map.START]?.pressed);
    btnBack(active.buttons[map.BACK]?.pressed);
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
  _listeners = { onMove, onClick, onConnected, onDisconnected };

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
    _listeners = null;
  }

  // Clear visual effects
  clearGlow();
  if (S.glow.el) { S.glow.el.remove(); S.glow.el = null; }
  releaseFloat();
  gpTrackLogoStop(true);

  // Clear sidebar state
  const sidebar = document.getElementById('sidebar');
  sidebar?.classList.remove('sidebar--open', 'sidebar--peek');

  // Clear focus classes
  document.body.classList.remove('gamepad-active');
  document.querySelectorAll('.hero--focused').forEach(el => el.classList.remove('hero--focused'));
  clearAllCardFocus();
  document.querySelectorAll('.gp-hint').forEach(el => el.remove());

  // Reset all state
  S.input = 'mouse'; S.mode = 'browse'; S.zone = 'grid';
  S.gridIdx = 0; S.heroIdx = 0; S.sidebarIdx = 0; S.toolbarIdx = 0; S.settingsIdx = 0; S.settingsDensityIdx = 0;
  S.gridEls = []; S.heroEls = []; S.sidebarEls = []; S.toolbarEls = []; S.settingsEls = [];
  S.save = { zone: null, mode: null, gridIdx: 0, heroIdx: 0 };
  S.ovSave = { mode: null, gridIdx: 0 };
  S.anchor = { x: 0, y: 0 };
  S.prevDX = 0; S.prevDY = 0;
  S.clicking = false;
  _savedBrowseIdx = 0;
}
