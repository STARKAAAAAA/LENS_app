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
  focusIndex = Math.min(focusIndex, focusElements.length - 1);
  focusElements[focusIndex]?.classList.add('card--focused');
}

// 计数列数：offsetLeft 去重
function countCols(selector) {
  const els = document.querySelectorAll(selector);
  if (els.length < 2) return 1;
  const set = new Set();
  for (const el of els) set.add(el.offsetLeft);
  return set.size || 1;
}

function moveFocus(dir, mode) {
  if (focusElements.length === 0) updateFocus(mode);
  let stepH = 1; // 水平步长（同行/同列内的相邻）
  let stepV = 1; // 垂直步长（跨行/跨列）
  if (mode === 'browse') {
    // CSS Grid 行优先排列：左右同行(±1) 上下跨行(±cols)
    stepH = 1;
    stepV = countCols('.category-card');
  } else if (mode === 'gallery') {
    // CSS Columns 列优先排列：上下同列(±1) 左右跨列(±itemsPerCol)
    stepH = Math.max(1, Math.round(focusElements.length / countCols('.gallery__item')));
    stepV = 1;
  }
  const prevIdx = focusIndex;
  switch (dir) {
    case 'left':  focusIndex = Math.max(0, focusIndex - stepH); break;
    case 'right': focusIndex = Math.min(focusElements.length - 1, focusIndex + stepH); break;
    case 'up':    focusIndex = Math.max(0, focusIndex - stepV); break;
    case 'down':  focusIndex = Math.min(focusElements.length - 1, focusIndex + stepV); break;
  }
  updateFocus(mode);

  const prev = focusElements[prevIdx];
  const card = focusElements[focusIndex];
  if (!card || prevIdx === focusIndex) { updateFocus(mode); return; }

  // 微动弹跳（新卡片）
  card.classList.add('card--nudge-' + dir);
  card.addEventListener('animationend', function h() { card.classList.remove('card--nudge-' + dir); card.removeEventListener('animationend', h); }, { once: true });

  // 光点从旧卡中心飞向新卡中心
  if (prev) {
    const pr = prev.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const fx = pr.left + pr.width / 2;
    const fy = pr.top + pr.height / 2;
    const tx = cr.left + cr.width / 2;
    const ty = cr.top + cr.height / 2;

    const dot = document.createElement('div');
    dot.style.cssText = `
      position:fixed;left:${fx}px;top:${fy}px;z-index:99999;
      width:16px;height:16px;margin-left:-8px;margin-top:-8px;
      border-radius:50%;pointer-events:none;
      background:radial-gradient(circle,rgba(255,245,235,0.9) 0%,rgba(255,220,180,0.4) 30%,transparent 70%);
      box-shadow:0 0 24px rgba(255,220,180,0.5),0 0 60px rgba(255,200,150,0.25);
      transition:left 0.35s var(--ease-out),top 0.35s var(--ease-out),opacity 0.2s;
    `;
    document.body.appendChild(dot);

    requestAnimationFrame(() => {
      dot.style.left = tx + 'px';
      dot.style.top = ty + 'px';
      dot.style.opacity = '1';
    });

    setTimeout(() => {
      dot.style.opacity = '0';
      setTimeout(() => dot.remove(), 250);
    }, 400);
  }
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
    focusElements.forEach(el => el.classList.remove('card--focused'));
    focusElements = [];
    focusIndex = 0;
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
    if (m === 'browse' || m === 'gallery') focusElements[focusIndex]?.click();
    if (m === 'settings') document.querySelector('.toggle-switch')?.click();
    if (m === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
  });
  const btnB = db(() => {
    const m = getMode();
    if (m === 'lightbox')  document.querySelector('.lightbox__close')?.click();
    if (m === 'slideshow') document.getElementById('sl-exit')?.click();
    if (m === 'gallery')   document.getElementById('gallery-back')?.click();
    if (m === 'settings')  document.getElementById('settings-panel')?.classList.remove('settings-panel--open');
    if (m === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
  });
  const btnX = db(() => { if (getMode() === 'lightbox') document.getElementById('rating-fav')?.click(); });
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

    // ==== 方向移动：上升沿触发（0→非0跳变），推一次移一格 ====
    const T = 0.35;
    const dx = (active.buttons[map.LEFT]?.pressed ? -1 : 0) + (active.buttons[map.RIGHT]?.pressed ? 1 : 0) + (lx < -T ? -1 : 0) + (lx > T ? 1 : 0);
    const dy = (active.buttons[map.UP]?.pressed ? -1 : 0) + (active.buttons[map.DOWN]?.pressed ? 1 : 0) + (ly < -T ? -1 : 0) + (ly > T ? 1 : 0);

    if (dx < 0 && _prevDX >= 0) moveFocus('left', mode);
    if (dx > 0 && _prevDX <= 0) moveFocus('right', mode);
    if (dy < 0 && _prevDY >= 0) moveFocus('up', mode);
    if (dy > 0 && _prevDY <= 0) moveFocus('down', mode);

    _prevDX = dx;
    _prevDY = dy;

    // ==== 卡片浮游 ====
    if ((mode === 'browse' || mode === 'gallery') && (Math.abs(lx) > 0.08 || Math.abs(ly) > 0.08)) {
      const card = focusElements[focusIndex];
      if (card && card !== _floatCard) { releaseCardFloat(); _floatCard = card; }
      if (card) injectCardFloat(card, lx, ly);
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
