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

let focusIndex = 0;
let focusElements = [];
let _gpAnimFrame = null;
let _inputMode = 'mouse';
let _lastMode = null;
let _floatCard = null;

// --- 模式检测 ---
function getMode() {
  if (document.getElementById('lightbox')?.classList.contains('active')) return 'lightbox';
  if (document.getElementById('slideshow')?.classList.contains('active')) return 'slideshow';
  if (document.getElementById('settings-panel')?.classList.contains('settings-panel--open')) return 'settings';
  if (document.getElementById('shortcuts-overlay')?.classList.contains('shortcuts-overlay--open')) return 'shortcuts';
  if (document.getElementById('gallery')?.style.display === 'block') return 'gallery';
  return 'browse';
}

// --- 虚拟焦点 ---
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
  focusElements[focusIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function getGridCols() {
  const container = document.getElementById('categories');
  if (!container) return 1;
  // 直接用浏览器解析后的 grid-template-columns 列数
  // (repeat(auto-fill,...) 会被展开为实际 track 值)
  const tracks = getComputedStyle(container).gridTemplateColumns;
  const cols = tracks.split(' ').length;
  if (cols > 1) return cols;
  // 兜底：容器宽/卡片宽
  const card = container.querySelector('.category-card');
  if (!card) return 1;
  const gap = parseFloat(getComputedStyle(container).gap) || 16;
  return Math.max(1, Math.floor((container.clientWidth + gap) / (card.offsetWidth + gap)));
}

let _cols = 0;

function moveFocus(dir, mode) {
  if (focusElements.length === 0) { updateFocus(mode); return; }
  const cols = mode === 'browse' ? getGridCols() : 1;
  _cols = cols;
  switch (dir) {
    case 'left':  focusIndex = Math.max(0, focusIndex - 1); break;
    case 'right': focusIndex = Math.min(focusElements.length - 1, focusIndex + 1); break;
    case 'up':    focusIndex = Math.max(0, focusIndex - cols); break;
    case 'down':  focusIndex = Math.min(focusElements.length - 1, focusIndex + cols); break;
  }
  updateFocus(mode);
}

// --- 按钮去抖 ---
function createDebouncer() {
  const state = {};
  return (key, pressed) => {
    if (pressed && !state[key]) { state[key] = true; return true; }
    if (!pressed) { state[key] = false; }
    return false;
  };
}

// --- 卡片浮游 ---
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

// --- 输入模式切换 ---
function setInputMode(mode) {
  if (_inputMode === mode) return;
  _inputMode = mode;
  if (mode === 'gamepad') {
    document.body.classList.add('gamepad-active');
  } else {
    document.body.classList.remove('gamepad-active');
    focusElements.forEach(el => el.classList.remove('card--focused'));
    focusElements = [];
    focusIndex = 0;
    releaseCardFloat();
  }
}

// ========== 主入口 ==========
export function initGamepad() {
  if (_gpAnimFrame) return;

  const db = createDebouncer();

  // 鼠标移动 → 切回鼠标模式
  document.addEventListener('mousemove', () => {
    if (_inputMode === 'gamepad') setInputMode('mouse');
  }, { passive: true });

  let _prev = { l: false, r: false, u: false, d: false };

  function poll() {
    const gamepads = navigator.getGamepads();
    let active = null;
    for (const gp of gamepads) {
      if (gp?.connected) { active = gp; break; }
    }

    if (!active) {
      _gpAnimFrame = requestAnimationFrame(poll);
      return;
    }

    const map = BUTTONS[detectLayout(active)];
    const mode = getMode();

    // 兼容不同手柄轴映射：飞智等第三方手柄可能轴位置不同
    const allAxes = active.axes;
    const lx = (allAxes[0] || 0) || (allAxes[2] || 0);  // X: 轴0或2
    const ly = (allAxes[1] || 0) || (allAxes[3] || 0);  // Y: 轴1或3
    const ry = allAxes[3] || allAxes[5] || 0;

    // D-pad（数字方向键）
    const dL = active.buttons[map.LEFT]?.pressed || active.buttons[14]?.pressed || false;
    const dR = active.buttons[map.RIGHT]?.pressed || active.buttons[15]?.pressed || false;
    const dU = active.buttons[map.UP]?.pressed || active.buttons[12]?.pressed || false;
    const dD = active.buttons[map.DOWN]?.pressed || active.buttons[13]?.pressed || false;

    // 检测手柄输入 → 切换模式
    const hasInput = Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15 || dL || dR || dU || dD || active.buttons.some(b => b?.pressed);
    if (hasInput && _inputMode !== 'gamepad') setInputMode('gamepad');

    // ==== 方向移动：边缘检测，低阈值 ====
    const T = 0.25;
    const cur = {
      l: dL || lx < -T,
      r: dR || lx > T,
      u: dU || ly < -T,
      d: dD || ly > T,
    };
    // 方向指示器（确保检测生效）
    let dot = document.getElementById('gp-dir');
    if (!dot) {
      dot = document.createElement('div');
      dot.id = 'gp-dir';
      dot.style.cssText = 'position:fixed;bottom:40px;right:40px;z-index:99999;font:12px monospace;color:rgba(200,168,124,0.6);background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:4px;pointer-events:none;';
      document.body.appendChild(dot);
    }
    let moved = 0;
    if (cur.l && !_prev.l) {
      if (mode === 'browse' || mode === 'gallery') { moveFocus('left', mode); moved = 1; }
      if (mode === 'lightbox' || mode === 'slideshow') {
        if (mode === 'lightbox') { document.querySelector('.lightbox__prev')?.click(); moved = 1; }
        if (mode === 'slideshow') { document.getElementById('sl-prev')?.click(); moved = 1; }
      }
    }
    if (cur.r && !_prev.r) {
      if (mode === 'browse' || mode === 'gallery') { moveFocus('right', mode); moved = 2; }
      if (mode === 'lightbox' || mode === 'slideshow') {
        if (mode === 'lightbox') { document.querySelector('.lightbox__next')?.click(); moved = 2; }
        if (mode === 'slideshow') { document.getElementById('sl-next')?.click(); moved = 2; }
      }
    }
    if (cur.u && !_prev.u) {
      if (mode === 'browse' || mode === 'gallery') { moveFocus('up', mode); moved = 3; }
    }
    if (cur.d && !_prev.d) {
      if (mode === 'browse' || mode === 'gallery') { moveFocus('down', mode); moved = 4; }
    }

    dot.textContent = `←${cur.l?'█':'·'} ↑${cur.u?'█':'·'} ↓${cur.d?'█':'·'} →${cur.r?'█':'·'} #${focusIndex}/${focusElements.length} c${_cols||'?'} ${moved?'M'+moved:''}`;

    _prev = cur;

    // ==== 卡片浮游 ====
    const shouldFloat = (mode === 'browse' || mode === 'gallery') && (Math.abs(lx) > 0.08 || Math.abs(ly) > 0.08);
    if (shouldFloat) {
      const card = focusElements[focusIndex];
      if (card && card !== _floatCard) { releaseCardFloat(); _floatCard = card; }
      if (card) injectCardFloat(card, lx, ly);
    } else if (_floatCard) {
      releaseCardFloat();
    }

    // ==== 动作按钮 ====
    if (db('a', active.buttons[map.A]?.pressed)) {
      if (mode === 'browse' || mode === 'gallery') focusElements[focusIndex]?.click();
      if (mode === 'settings') document.querySelector('.toggle-switch')?.click();
      if (mode === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
    }
    if (db('b', active.buttons[map.B]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__close')?.click();
      if (mode === 'slideshow') document.getElementById('sl-exit')?.click();
      if (mode === 'gallery')   document.getElementById('gallery-back')?.click();
      if (mode === 'settings')  document.getElementById('settings-panel')?.classList.remove('settings-panel--open');
      if (mode === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
    }
    if (db('x', active.buttons[map.X]?.pressed)) {
      if (mode === 'lightbox') document.getElementById('rating-fav')?.click();
    }
    if (db('y', active.buttons[map.Y]?.pressed)) {
      document.getElementById('tb-slideshow')?.click();
    }
    if (db('lb', active.buttons[map.LB]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__prev')?.click();
      if (mode === 'slideshow') document.getElementById('sl-prev')?.click();
    }
    if (db('rb', active.buttons[map.RB]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__next')?.click();
      if (mode === 'slideshow') document.getElementById('sl-next')?.click();
    }
    if (db('lt', active.buttons[map.LT]?.pressed)) {
      if (mode === 'lightbox') document.querySelector('.rating__star[data-v="1"]')?.click();
    }
    if (db('rt', active.buttons[map.RT]?.pressed)) {
      if (mode === 'lightbox') document.querySelector('.rating__star[data-v="5"]')?.click();
    }
    if (db('ls', active.buttons[map.LS]?.pressed)) {
      if (mode === 'slideshow') document.getElementById('sl-pause')?.click();
    }
    if (db('start', active.buttons[map.START]?.pressed)) {
      document.getElementById('tb-settings')?.click();
    }
    if (db('back', active.buttons[map.BACK]?.pressed)) {
      document.getElementById('tb-shortcuts')?.click();
    }

    // ==== 右摇杆缩放 ====
    if (mode === 'lightbox' && Math.abs(ry) > 0.15) {
      document.getElementById('lightbox')?.dispatchEvent(new WheelEvent('wheel', { deltaY: -ry * 50, bubbles: true }));
    }

    // ==== 模式变化刷新焦点 ====
    if (_lastMode !== mode) {
      _lastMode = mode;
      focusIndex = 0;
      updateFocus(mode);
    }

    _gpAnimFrame = requestAnimationFrame(poll);
  }

  window.addEventListener('gamepadconnected', (e) => {
    if (!_gpAnimFrame) _gpAnimFrame = requestAnimationFrame(poll);
  });

  window.addEventListener('gamepaddisconnected', () => {
    setInputMode('mouse');
  });

  _gpAnimFrame = requestAnimationFrame(poll);
}
