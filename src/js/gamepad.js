// ========== Gamepad Support ==========

function detectLayout(gamepad) {
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox') || id.includes('xinput')) return 'xbox';
  if (id.includes('ps4') || id.includes('ps5') || id.includes('playstation')) return 'ps';
  if (id.includes('switch') || id.includes('nintendo')) return 'switch';
  return 'xbox';
}

const BUTTONS = {
  xbox:   { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
  ps:     { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
  switch: { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
};

// --- 状态 ---
let focusIndex = 0;
let focusElements = [];
let _gpAnimFrame = null;
let _inputMode = 'mouse';
let _lastMode = null;
let _floatCard = null;
let _prevDX = 0, _prevDY = 0; // 上一帧方向值，用于上升沿检测
let _glowEl = null;        // 独立光晕 DOM 元素
let _glowRaf = null;       // 光晕动画 rAF ID
let _focusZone = 'grid';   // 'grid' | 'hero' | 'sidebar'
let _heroElements = [];     // hero/sidebar 区域可聚焦元素
let _heroIndex = 0;        // hero/sidebar 区域当前索引
let _savedGridIndex = 0;   // 进入 hero/sidebar 前网格焦点位置
let _savedMode = null;      // 保存时的模式，模式变了就不恢复
let _savedZone = null;      // 进入 sidebar 前的 zone，退出时恢复

// --- 模式 ---
function getMode() {
  if (document.getElementById('lightbox')?.classList.contains('active')) return 'lightbox';
  if (document.getElementById('slideshow')?.classList.contains('active')) return 'slideshow';
  if (document.getElementById('settings-panel')?.classList.contains('settings-panel--open')) return 'settings';
  if (document.getElementById('shortcuts-overlay')?.classList.contains('shortcuts-overlay--open')) return 'shortcuts';
  if (document.getElementById('gallery')?.style.display === 'block') return 'gallery';
  return 'browse';
}

// --- 焦点 ---
function updateFocus(mode) {
  focusElements.forEach(el => el.classList.remove('card--focused'));
  focusElements = [];
  if (mode === 'browse') {
    focusElements = Array.from(document.querySelectorAll('.category-card'));
  } else if (mode === 'gallery') {
    focusElements = Array.from(document.querySelectorAll('.gallery__item'));
  }
  if (focusElements.length === 0) { focusIndex = 0; return; }
  focusIndex = Math.max(0, Math.min(focusIndex, focusElements.length - 1));
  focusElements[focusIndex]?.classList.add('card--focused');
  focusElements[focusIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// 计数列数：offsetLeft 去重
function countCols(selector) {
  const els = document.querySelectorAll(selector);
  if (els.length < 2) return 1;
  const set = new Set();
  for (const el of els) set.add(el.offsetLeft);
  return set.size || 1;
}

// hero 区域元素
function buildHeroElements(mode) {
  _heroElements = [];
  if (mode === 'gallery') {
    const back = document.getElementById('gallery-back');
    const sort = document.querySelector('.custom-dropdown__trigger');
    if (back) _heroElements.push(back);
    if (sort) _heroElements.push(sort);
  }
  _heroIndex = 0;
}

function buildSidebarElements() {
  _heroElements = [];
  const items = document.querySelectorAll('#sidebar-list .sidebar__item');
  items.forEach(el => _heroElements.push(el));
  const add = document.getElementById('sidebar-add');
  if (add) _heroElements.push(add);
  _heroIndex = 0;
}

// LENS 随侧边栏展开右移（模拟鼠标行为）
function lensShiftRight() {
  const logo = document.getElementById('corner-logo');
  if (logo) { logo.style.transition = 'left 0.5s cubic-bezier(0.16,1,0.3,1)'; logo.style.left = '262px'; }
}
function lensShiftBack() {
  const logo = document.getElementById('corner-logo');
  if (logo) { logo.style.transition = 'left 0.5s cubic-bezier(0.16,1,0.3,1)'; logo.style.left = '28px'; }
}

// 光晕扫入动画（grid 和 sidebar 共用）
function sweepGlow(el, dir) {
  if (!el) return;
  if (!_glowEl) {
    _glowEl = document.createElement('div');
    _glowEl.className = 'gamepad-glow';
    document.body.appendChild(_glowEl);
  }
  if (_glowRaf) cancelAnimationFrame(_glowRaf);

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

  _glowEl.style.width  = r.width + 'px';
  _glowEl.style.height = r.height + 'px';
  _glowEl.style.borderRadius = getComputedStyle(el).borderRadius;
  _glowEl.style.left = (sx - r.width / 2) + 'px';
  _glowEl.style.top  = (sy - r.height / 2) + 'px';
  _glowEl.classList.add('gamepad-glow--active');

  let t = 0;
  const sweep = () => {
    t += 0.03;
    if (t >= 2.8) {
      _glowEl.classList.remove('gamepad-glow--active');
      _glowRaf = null;
      return;
    }
    if (t <= 1) {
      const e = 1 - Math.pow(1 - t, 2);
      _glowEl.style.left = (sx + (cx - sx) * e - r.width / 2) + 'px';
      _glowEl.style.top  = (sy + (cy - sy) * e - r.height / 2) + 'px';
    }
    _glowRaf = requestAnimationFrame(sweep);
  };
  _glowRaf = requestAnimationFrame(sweep);
}

function updateHeroFocus() {
  _heroElements.forEach(el => el.classList.remove('hero--focused'));
  const el = _heroElements[_heroIndex];
  if (el) {
    el.classList.add('hero--focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function moveFocus(dir, mode) {
  // ==== Hero 区域导航 ====
  // hero 元素排序：index 0=最靠近卡片，index 越大越靠页面顶部
  if (_focusZone === 'hero') {
    if (_heroElements.length === 0) { _focusZone = 'grid'; return; }
    if (dir === 'down') {
      if (_heroIndex === 0) {
        // 已在最靠近卡片的 hero 元素，再按下 → 回到之前的位置
        _focusZone = 'grid';
        updateHeroFocus();
        focusIndex = (mode === _savedMode) ? _savedGridIndex : 0;
        updateFocus(mode);
      } else {
        _heroIndex--;
        updateHeroFocus();
      }
      return;
    }
    if (dir === 'up') {
      _heroIndex = Math.min(_heroElements.length - 1, _heroIndex + 1);
      updateHeroFocus();
      return;
    }
    if (dir === 'left')  { _heroIndex = Math.max(0, _heroIndex - 1); updateHeroFocus(); }
    if (dir === 'right') { _heroIndex = Math.min(_heroElements.length - 1, _heroIndex + 1); updateHeroFocus(); }
    return;
  }

  // ==== Sidebar 区域导航 ====
  if (_focusZone === 'sidebar') {
    if (dir === 'right') {
      // 仅右 → 关闭侧边栏，回到进入前的状态
      updateHeroFocus();
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.remove('sidebar--open', 'sidebar--peek');
      lensShiftBack();
      if (_savedZone === 'grid') {
        _focusZone = 'grid';
        focusIndex = (mode === _savedMode) ? _savedGridIndex : 0;
        // 手动恢复焦点（新鲜 DOM + 不 scrollIntoView）
        const els = mode === 'browse'
          ? Array.from(document.querySelectorAll('.category-card'))
          : Array.from(document.querySelectorAll('.gallery__item'));
        if (els.length > 0) {
          focusIndex = Math.max(0, Math.min(focusIndex, els.length - 1));
          els.forEach(el => el.classList.remove('card--focused'));
          els[focusIndex]?.classList.add('card--focused');
        }
      } else {
        _focusZone = _savedZone || 'grid';
      }
      return;
    }
    if (_heroElements.length === 0) { _focusZone = 'grid'; return; }
    if (dir === 'up') {
      const prev = _heroIndex;
      _heroIndex = Math.max(0, _heroIndex - 1);
      updateHeroFocus();
      if (prev !== _heroIndex) sweepGlow(_heroElements[_heroIndex], dir);
    }
    if (dir === 'down') {
      const prev = _heroIndex;
      _heroIndex = Math.min(_heroElements.length - 1, _heroIndex + 1);
      updateHeroFocus();
      if (prev !== _heroIndex) sweepGlow(_heroElements[_heroIndex], dir);
    }
    return;
  }

  // 始终从 DOM 新鲜查询，不依赖缓存
  focusElements.forEach(el => el.classList.remove('card--focused'));
  focusElements = [];
  if (mode === 'browse') {
    focusElements = Array.from(document.querySelectorAll('.category-card'));
  } else if (mode === 'gallery') {
    focusElements = Array.from(document.querySelectorAll('.gallery__item'));
  }
  if (focusElements.length === 0) { focusIndex = 0; return; }
  focusIndex = Math.max(0, Math.min(focusIndex, focusElements.length - 1));

  let stepH = 1;
  let stepV = 1;
  if (mode === 'browse') {
    stepH = 1;
    stepV = countCols('.category-card');
  } else if (mode === 'gallery') {
    stepH = Math.max(1, Math.round(focusElements.length / countCols('.gallery__item')));
    stepV = 1;
  }
  // 非左方向键取消侧边栏 peek
  if (dir !== 'left') {
    const sb = document.getElementById('sidebar');
    if (sb?.classList.contains('sidebar--peek') && !sb.classList.contains('sidebar--open')) {
      sb.classList.remove('sidebar--peek');
      lensShiftBack();
    }
  }

  const prevIdx = focusIndex;
  if (mode === 'browse') {
    // CSS Grid 行优先：同行内左右移动，上下跨行
    const col = focusIndex % stepV;
    const totalCols = stepV;
    switch (dir) {
      case 'left':
        if (col > 0) {
          focusIndex -= stepH;
        } else {
          const sidebar = document.getElementById('sidebar');
          if (sidebar?.classList.contains('sidebar--peek')) {
            // 第二次左：完全展开 + 进入侧边栏
            sidebar.classList.add('sidebar--open');
            _savedGridIndex = focusIndex;
            _savedMode = mode;
            _savedZone = _focusZone;
            _focusZone = 'sidebar';
            buildSidebarElements();
            updateHeroFocus();
            // LENS 右移
            lensShiftRight();
            releaseCardFloat();
          } else {
            // 第一次左：探出
            sidebar?.classList.add('sidebar--peek');
          }
        }
        break;
      case 'right': if (col < totalCols - 1 && focusIndex < focusElements.length - 1) focusIndex += stepH; break;
      case 'up':
        if (focusIndex < stepV) {
          // 第一行向上 → 跟鼠标点击 corner logo 一样滚到顶部
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          focusIndex = Math.max(0, focusIndex - stepV);
        }
        break;
      case 'down':  focusIndex = Math.min(focusElements.length - 1, focusIndex + stepV); break;
    }
  } else if (mode === 'gallery') {
    // CSS Columns 列优先：上下同列相邻移动，左右按屏幕坐标找最近项
    const current = focusElements[focusIndex];
    switch (dir) {
      case 'up':
        if (focusIndex === 0) {
          // 第一张照片向上 → 跳出网格进入 hero
          _savedGridIndex = focusIndex;
          _savedMode = mode;
          _focusZone = 'hero';
          buildHeroElements(mode);
          updateHeroFocus();
          releaseCardFloat();
        } else {
          focusIndex = Math.max(0, focusIndex - stepV);
        }
        break;
      case 'down':
        focusIndex = Math.min(focusElements.length - 1, focusIndex + stepV);
        break;
      case 'left':
      case 'right': {
        if (!current) break;
        const cr = current.getBoundingClientRect();
        const cy = cr.top + cr.height / 2;
        const cx = cr.left + cr.width / 2;
        let best = focusIndex;
        let bestScore = Infinity;
        for (let i = 0; i < focusElements.length; i++) {
          if (i === focusIndex) continue;
          const r = focusElements[i].getBoundingClientRect();
          const ix = r.left + r.width / 2;
          const iy = r.top + r.height / 2;
          if (dir === 'right' && ix <= cx + 2) continue;
          if (dir === 'left'  && ix >= cx - 2) continue;
          const hDist = Math.abs(ix - cx);
          const vDist = Math.abs(iy - cy);
          const score = hDist + vDist * 3; // 纵向偏差重罚，优先同行
          if (score < bestScore) { bestScore = score; best = i; }
        }
        focusIndex = best;
        break;
      }
    }
    // gallery 左边界 → 两步展开侧边栏
    if (dir === 'left' && focusIndex === prevIdx) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar?.classList.contains('sidebar--peek')) {
        sidebar.classList.add('sidebar--open');
        _savedGridIndex = focusIndex;
        _focusZone = 'sidebar';
        buildSidebarElements();
        updateHeroFocus();
        lensShiftRight();
        releaseCardFloat();
      } else {
        sidebar?.classList.add('sidebar--peek');
      }
    }
  }
  // 如果已跳转到 hero/sidebar 区域，跳过网格焦点应用
  if (_focusZone !== 'grid') return;
  if (_focusZone === 'hero') return;

  // 应用焦点视觉（不重复查询 DOM）
  if (prevIdx !== focusIndex) {
    focusElements[prevIdx]?.classList.remove('card--focused');
    focusElements[focusIndex]?.classList.add('card--focused');
    focusElements[focusIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    focusElements[focusIndex]?.classList.add('card--focused');
  }

  // 光晕从移动方向扫入中心（独立 DOM 元素）
  if (prevIdx !== focusIndex) sweepGlow(focusElements[focusIndex], dir);
}

// --- 去抖（按钮用） ---
function db(fn) {
  let state = false;
  return (pressed) => {
    if (pressed && !state) { state = true; fn(); }
    if (!pressed) state = false;
  };
}

// --- 输入模式 ---
function setInputMode(mode) {
  if (_inputMode === mode) return;
  _inputMode = mode;
  if (mode === 'gamepad') {
    document.body.classList.add('gamepad-active');
    _prevDX = _prevDY = 0;
    updateFocus(getMode());
  } else {
    document.body.classList.remove('gamepad-active');
    _heroElements.forEach(el => el.classList.remove('hero--focused'));
    _heroElements = [];
    document.getElementById('sidebar')?.classList.remove('sidebar--open', 'sidebar--peek');
    lensShiftBack();
    focusElements.forEach(el => el.classList.remove('card--focused'));
    focusElements = [];
    focusIndex = 0;
    _focusZone = 'grid';
  }
}

// --- 浮游 ---
function injectCardFloat(card, lx, ly) {
  const lift = 5;
  card.classList.add('card--tilt-active');
  card.style.transform = `translateX(${lx * lift}px) translateY(${ly * lift}px) scale3d(1.005, 1.005, 1)`;
  card.style.setProperty('--shine-x', (50 + lx * 30) + '%');
  card.style.setProperty('--shine-y', (50 + ly * 30) + '%');
}

function releaseCardFloat() {
  if (_floatCard) {
    _floatCard.classList.remove('card--tilt-active');
    _floatCard.style.transform = '';
    _floatCard.style.setProperty('--shine-x', '50%');
    _floatCard.style.setProperty('--shine-y', '50%');
    _floatCard = null;
  }
}

// ========== 入口 ==========
export function initGamepad() {
  if (_gpAnimFrame) return;

  const btnA = db(() => {
    const m = getMode();
    if (_focusZone === 'hero' || _focusZone === 'sidebar') {
      _heroElements[_heroIndex]?.click();
      return;
    }
    if (m === 'browse' || m === 'gallery') {
      if (focusElements.length === 0) updateFocus(m);
      focusElements[focusIndex]?.click();
    }
    if (m === 'settings') document.querySelector('.toggle-switch')?.click();
    if (m === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
  });
  const btnB = db(() => {
    const m = getMode();
    if (_focusZone === 'sidebar') {
      // B 关闭侧边栏，回到进入前的状态
      updateHeroFocus();
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.remove('sidebar--open', 'sidebar--peek');
      lensShiftBack();
      if (_savedZone === 'grid') {
        _focusZone = 'grid';
        focusIndex = (m === _savedMode) ? _savedGridIndex : 0;
        // 手动恢复焦点，不调 updateFocus（避免 scrollIntoView）
        const els = m === 'browse'
          ? Array.from(document.querySelectorAll('.category-card'))
          : Array.from(document.querySelectorAll('.gallery__item'));
        if (els.length > 0) {
          focusIndex = Math.max(0, Math.min(focusIndex, els.length - 1));
          els.forEach(el => el.classList.remove('card--focused'));
          els[focusIndex]?.classList.add('card--focused');
        }
      } else {
        _focusZone = _savedZone || 'grid';
      }
      return;
    }
    if (m === 'lightbox')  document.querySelector('.lightbox__close')?.click();
    if (m === 'slideshow') document.getElementById('sl-exit')?.click();
    if (m === 'gallery')   document.getElementById('gallery-back')?.click();
    if (m === 'settings')  document.getElementById('settings-panel')?.classList.remove('settings-panel--open');
    if (m === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
  });
  const btnX = db(() => {
    if (_focusZone === 'sidebar') {
      const el = _heroElements[_heroIndex];
      el?.querySelector('.sidebar__item-remove')?.click();
      return;
    }
    if (getMode() === 'lightbox') document.getElementById('rating-fav')?.click();
  });
  const btnY = db(() => { document.getElementById('tb-slideshow')?.click(); });
  const btnLB = db(() => {
    const m = getMode();
    if (m === 'lightbox')  document.querySelector('.lightbox__prev')?.click();
    if (m === 'slideshow') document.getElementById('sl-prev')?.click();
  });
  const btnRB = db(() => {
    const m = getMode();
    if (m === 'lightbox')  document.querySelector('.lightbox__next')?.click();
    if (m === 'slideshow') document.getElementById('sl-next')?.click();
  });
  const btnLT = db(() => { if (getMode() === 'lightbox') document.querySelector('.rating__star[data-v="1"]')?.click(); });
  const btnRT = db(() => { if (getMode() === 'lightbox') document.querySelector('.rating__star[data-v="5"]')?.click(); });
  const btnLS = db(() => { if (getMode() === 'slideshow') document.getElementById('sl-pause')?.click(); });
  const btnStart = db(() => { document.getElementById('tb-settings')?.click(); });
  const btnBack = db(() => { document.getElementById('tb-shortcuts')?.click(); });

  document.addEventListener('mousemove', () => {
    if (_inputMode === 'gamepad') setInputMode('mouse');
  }, { passive: true });

  function poll() {
    const gamepads = navigator.getGamepads();
    let active = null;
    for (const gp of gamepads) { if (gp?.connected) { active = gp; break; } }
    if (!active) { _gpAnimFrame = requestAnimationFrame(poll); return; }

    const map = BUTTONS[detectLayout(active)];
    const mode = getMode();
    const lx = active.axes[0] || 0;
    const ly = active.axes[1] || 0;
    const ry = active.axes[3] || 0;

    // 输入检测 → 切换模式
    if ((Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15 || active.buttons.some(b => b?.pressed)) && _inputMode !== 'gamepad') {
      setInputMode('gamepad');
    }

    // ==== 方向移动：上升沿触发 ====
    const T = 0.3;
    const DEAD = 0.15;
    const rawX = (active.buttons[map.LEFT]?.pressed ? -1 : 0) + (active.buttons[map.RIGHT]?.pressed ? 1 : 0) + (lx < -T ? -1 : 0) + (lx > T ? 1 : 0);
    const rawY = (active.buttons[map.UP]?.pressed ? -1 : 0) + (active.buttons[map.DOWN]?.pressed ? 1 : 0) + (ly < -T ? -1 : 0) + (ly > T ? 1 : 0);
    // 死区归零：摇杆回到中心附近自动重置边缘检测
    const dx = Math.abs(lx) < DEAD && !active.buttons[map.LEFT]?.pressed && !active.buttons[map.RIGHT]?.pressed ? 0 : rawX;
    const dy = Math.abs(ly) < DEAD && !active.buttons[map.UP]?.pressed && !active.buttons[map.DOWN]?.pressed ? 0 : rawY;

    if (dx < 0 && _prevDX >= 0) moveFocus('left', mode);
    if (dx > 0 && _prevDX <= 0) moveFocus('right', mode);
    if (dy < 0 && _prevDY >= 0) moveFocus('up', mode);
    if (dy > 0 && _prevDY <= 0) moveFocus('down', mode);

    _prevDX = dx;
    _prevDY = dy;

    // ==== 浮游微动（grid 卡片 + sidebar 文件夹） ====
    const dpadX = (active.buttons[map.LEFT]?.pressed ? -1 : 0) + (active.buttons[map.RIGHT]?.pressed ? 1 : 0);
    const dpadY = (active.buttons[map.UP]?.pressed ? -1 : 0) + (active.buttons[map.DOWN]?.pressed ? 1 : 0);
    const floatX = Math.abs(lx) > 0.08 ? lx : dpadX;
    const floatY = Math.abs(ly) > 0.08 ? ly : dpadY;

    const canFloat = (_focusZone === 'grid' && (mode === 'browse' || mode === 'gallery'))
                  || _focusZone === 'sidebar';

    if (canFloat && (Math.abs(floatX) > 0.08 || Math.abs(floatY) > 0.08)) {
      const target = _focusZone === 'sidebar' ? _heroElements[_heroIndex] : focusElements[focusIndex];
      if (target && target !== _floatCard) { releaseCardFloat(); _floatCard = target; }
      if (target) injectCardFloat(target, floatX, floatY);
    } else if (_floatCard) {
      releaseCardFloat();
    }

    // ==== 按钮 ====
    btnA(active.buttons[map.A]?.pressed);
    btnB(active.buttons[map.B]?.pressed);
    btnX(active.buttons[map.X]?.pressed);
    btnY(active.buttons[map.Y]?.pressed);
    btnLB(active.buttons[map.LB]?.pressed);
    btnRB(active.buttons[map.RB]?.pressed);
    btnLT(active.buttons[map.LT]?.pressed);
    btnRT(active.buttons[map.RT]?.pressed);
    btnLS(active.buttons[map.LS]?.pressed);
    btnStart(active.buttons[map.START]?.pressed);
    btnBack(active.buttons[map.BACK]?.pressed);

    // ==== 右摇杆缩放 ====
    if (mode === 'lightbox' && Math.abs(ry) > 0.15) {
      document.getElementById('lightbox')?.dispatchEvent(new WheelEvent('wheel', { deltaY: -ry * 50, bubbles: true }));
    }

    // ==== 模式变化 → 刷新焦点 ====
    if (_lastMode !== mode) {
      _lastMode = mode;
      focusIndex = 0;
      if (_focusZone === 'hero') updateHeroFocus();
      _focusZone = 'grid';
      updateFocus(mode);
    }

    _gpAnimFrame = requestAnimationFrame(poll);
  }

  window.addEventListener('gamepadconnected', () => {
    if (!_gpAnimFrame) _gpAnimFrame = requestAnimationFrame(poll);
  });
  window.addEventListener('gamepaddisconnected', () => setInputMode('mouse'));

  _gpAnimFrame = requestAnimationFrame(poll);
}
