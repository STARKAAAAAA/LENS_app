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

function getMode() {
  if (document.getElementById('lightbox')?.classList.contains('active')) return 'lightbox';
  if (document.getElementById('slideshow')?.classList.contains('active')) return 'slideshow';
  if (document.getElementById('settings-panel')?.classList.contains('settings-panel--open')) return 'settings';
  if (document.getElementById('shortcuts-overlay')?.classList.contains('shortcuts-overlay--open')) return 'shortcuts';
  if (document.getElementById('gallery')?.style.display === 'block') return 'gallery';
  return 'browse';
}

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
  if (focusElements.length < 2) return 1;
  // 用两张相邻卡片的 offsetTop 是否相同判断是否在同一行，从而推算列数
  const top0 = focusElements[0].getBoundingClientRect().top;
  let cols = 1;
  for (let i = 1; i < focusElements.length; i++) {
    if (Math.abs(focusElements[i].getBoundingClientRect().top - top0) > 2) break;
    cols = i + 1;
  }
  if (cols === focusElements.length) cols = 1; // 全部同一行：单列或首行恰好满
  return cols || 1;
}

function moveFocus(direction, mode) {
  if (focusElements.length === 0) { updateFocus(mode); return; }
  if (mode === 'browse') {
    const cols = getGridCols();
    if (direction === 'left')  focusIndex = Math.max(0, focusIndex - 1);
    if (direction === 'right') focusIndex = Math.min(focusElements.length - 1, focusIndex + 1);
    if (direction === 'up')    focusIndex = Math.max(0, focusIndex - cols);
    if (direction === 'down')  focusIndex = Math.min(focusElements.length - 1, focusIndex + cols);
  } else if (mode === 'gallery') {
    if (direction === 'left' || direction === 'up')   focusIndex = Math.max(0, focusIndex - 1);
    if (direction === 'right' || direction === 'down') focusIndex = Math.min(focusElements.length - 1, focusIndex + 1);
  }
  updateFocus(mode);
}

function activateFocus(mode) {
  if (mode === 'browse' || mode === 'gallery') {
    focusElements[focusIndex]?.click();
  }
}

function createDebouncer() {
  const state = {};
  return (key, pressed) => {
    if (pressed && !state[key]) { state[key] = true; return true; }
    if (!pressed) { state[key] = false; }
    return false;
  };
}

let _gpAnimFrame = null;
let _gpActive = false;
let _inputMode = 'mouse';
let _lastMode = null;
let _floatActive = false;

function setInputMode(mode) {
  if (_inputMode === mode) return;
  _inputMode = mode;
  if (mode === 'gamepad') {
    document.body.classList.add('gamepad-active');
  } else {
    document.body.classList.remove('gamepad-active');
    // 清除所有虚拟焦点
    focusElements.forEach(el => el.classList.remove('card--focused'));
    focusElements = [];
    focusIndex = 0;
  }
}

export function initGamepad() {
  if (_gpActive) return;
  _gpActive = true;

  const debounce = createDebouncer();

  // 鼠标移动 → 切回鼠标模式
  document.addEventListener('mousemove', () => {
    if (_inputMode === 'gamepad') {
      setInputMode('mouse');
    }
  }, { passive: true });

  let _floatCard = null;

  function injectCardFloat(lx, ly, mode) {
    // 只对当前焦点卡片施加浮游效果，不是所有卡片
    if (mode === 'browse' || mode === 'gallery') {
      const card = focusElements[focusIndex];
      if (card && card !== _floatCard) {
        releaseCardFloat();
        _floatCard = card;
      }
      if (card) {
        const lift = 5;
        card.classList.add('card--tilt-active');
        card.style.transform = `translateX(${lx * lift}px) translateY(${ly * lift}px) scale3d(1.005, 1.005, 1)`;
        card.style.setProperty('--shine-x', (50 + lx * 30) + '%');
        card.style.setProperty('--shine-y', (50 + ly * 30) + '%');
      }
    }
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

  function poll() {
    const gamepads = navigator.getGamepads();
    let active = null;
    for (const gp of gamepads) {
      if (gp && gp.connected) { active = gp; break; }
    }

    if (!active) {
      releaseCardFloat();
      _gpAnimFrame = requestAnimationFrame(poll);
      return;
    }

    const layout = detectLayout(active);
    const map = BUTTONS[layout];
    const mode = getMode();

    const lx = active.axes[0] || 0;
    const ly = active.axes[1] || 0;
    const rx = active.axes[2] || 0;
    const ry = active.axes[3] || 0;

    // D-pad
    const dX = (active.buttons[map.LEFT]?.pressed ? -1 : 0) + (active.buttons[map.RIGHT]?.pressed ? 1 : 0);
    const dY = (active.buttons[map.UP]?.pressed ? -1 : 0) + (active.buttons[map.DOWN]?.pressed ? 1 : 0);

    // --- 检测手柄输入 → 切换到游戏手柄模式 ---
    const hasStickInput = Math.abs(lx) > 0.08 || Math.abs(ly) > 0.08 || Math.abs(rx) > 0.08 || Math.abs(ry) > 0.08;
    const hasButtonInput = active.buttons.some(b => b?.pressed);
    if (hasStickInput || hasButtonInput) {
      if (_inputMode !== 'gamepad') setInputMode('gamepad');
    }

    // --- 左摇杆 → 卡片浮游 (browse/gallery) ---
    const shouldFloat = (mode === 'browse' || mode === 'gallery') && (Math.abs(lx) > 0.08 || Math.abs(ly) > 0.08);
    if (shouldFloat) {
      injectCardFloat(lx, ly, mode);
      _floatActive = true;
    } else if (_floatActive) {
      releaseCardFloat();
      _floatActive = false;
    }

    // --- 方向移动焦点 (browse/gallery) / 灯箱导航 ---
    const moveThreshold = 0.5;
    if (debounce('l', dX < 0 || lx < -moveThreshold)) {
      if (mode === 'browse' || mode === 'gallery') moveFocus('left', mode);
      if (mode === 'lightbox')  document.querySelector('.lightbox__prev')?.click();
      if (mode === 'slideshow') document.getElementById('sl-prev')?.click();
    }
    if (debounce('r', dX > 0 || lx > moveThreshold)) {
      if (mode === 'browse' || mode === 'gallery') moveFocus('right', mode);
      if (mode === 'lightbox')  document.querySelector('.lightbox__next')?.click();
      if (mode === 'slideshow') document.getElementById('sl-next')?.click();
    }
    if (debounce('u', dY < 0 || ly < -moveThreshold)) {
      if (mode === 'browse' || mode === 'gallery') moveFocus('up', mode);
    }
    if (debounce('d', dY > 0 || ly > moveThreshold)) {
      if (mode === 'browse' || mode === 'gallery') moveFocus('down', mode);
    }

    // --- A: 确认 ---
    if (debounce('a', active.buttons[map.A]?.pressed)) {
      if (mode === 'browse' || mode === 'gallery') activateFocus(mode);
      if (mode === 'settings') {
        document.querySelector('.settings-panel__item:nth-child(1) .toggle-switch')?.click();
      }
      if (mode === 'shortcuts') {
        document.getElementById('shortcuts-overlay')?.click();
      }
    }

    // --- B: 返回/关闭 ---
    if (debounce('b', active.buttons[map.B]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__close')?.click();
      if (mode === 'slideshow') document.getElementById('sl-exit')?.click();
      if (mode === 'gallery')   document.getElementById('gallery-back')?.click();
      if (mode === 'settings')  document.getElementById('settings-panel')?.classList.remove('settings-panel--open');
      if (mode === 'shortcuts') document.getElementById('shortcuts-overlay')?.click();
    }

    // --- X: 收藏切换 ---
    if (debounce('x', active.buttons[map.X]?.pressed)) {
      if (mode === 'lightbox') document.getElementById('rating-fav')?.click();
    }

    // --- Y: 幻灯片 ---
    if (debounce('y', active.buttons[map.Y]?.pressed)) {
      if (mode === 'browse' || mode === 'gallery' || mode === 'lightbox') {
        document.getElementById('tb-slideshow')?.click();
      }
    }

    // --- LB/RB: 上一张/下一张 (保留，与 D-pad 双路径) ---
    if (debounce('lb', active.buttons[map.LB]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__prev')?.click();
      if (mode === 'slideshow') document.getElementById('sl-prev')?.click();
    }
    if (debounce('rb', active.buttons[map.RB]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__next')?.click();
      if (mode === 'slideshow') document.getElementById('sl-next')?.click();
    }

    // --- LT: 评分降低 / RT: 评分升高 ---
    if (debounce('lt', active.buttons[map.LT]?.pressed)) {
      if (mode === 'lightbox') document.querySelector('.rating__star[data-v="1"]')?.click();
    }
    if (debounce('rt', active.buttons[map.RT]?.pressed)) {
      if (mode === 'lightbox') document.querySelector('.rating__star[data-v="5"]')?.click();
    }

    // --- LS: 幻灯片暂停/继续 ---
    if (debounce('ls', active.buttons[map.LS]?.pressed)) {
      if (mode === 'slideshow') document.getElementById('sl-pause')?.click();
    }

    // --- START: 设置 ---
    if (debounce('start', active.buttons[map.START]?.pressed)) {
      document.getElementById('tb-settings')?.click();
    }

    // --- BACK: 快捷键 ---
    if (debounce('back', active.buttons[map.BACK]?.pressed)) {
      document.getElementById('tb-shortcuts')?.click();
    }

    // --- 右摇杆 → 缩放 ---
    if (mode === 'lightbox' && Math.abs(ry) > 0.1) {
      document.getElementById('lightbox')?.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -ry * 40, bubbles: true })
      );
    }
    if (mode === 'slideshow' && Math.abs(ry) > 0.1) {
      const btn = ry < -0.3 ? document.getElementById('sl-zoom-in') : document.getElementById('sl-zoom-out');
      if (Math.abs(ry) > 0.5) btn?.click();
    }

    // --- 模式变化时刷新焦点列表 ---
    if (_lastMode !== mode) {
      _lastMode = mode;
      focusIndex = 0;
      updateFocus(mode);
    }

    _gpAnimFrame = requestAnimationFrame(poll);
  }

  window.addEventListener('gamepadconnected', (e) => {
    console.log('[LENS] gamepad connected:', e.gamepad.id);
    if (!_gpAnimFrame) _gpAnimFrame = requestAnimationFrame(poll);
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    console.log('[LENS] gamepad disconnected:', e.gamepad.id);
    setInputMode('mouse');
    releaseCardFloat();
  });

  // 立即开始轮询
  _gpAnimFrame = requestAnimationFrame(poll);
}
