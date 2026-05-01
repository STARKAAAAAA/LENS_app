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

function moveFocus(direction, mode) {
  if (focusElements.length === 0) { updateFocus(mode); return; }
  if (mode === 'browse') {
    const style = getComputedStyle(document.getElementById('categories'));
    const cols = style.gridTemplateColumns.split(' ').length || 1;
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
let _inputMode = 'mouse'; // 'mouse' | 'gamepad'
let _mouseTimer = null;

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

  function injectCardFloat(lx, ly) {
    const cards = document.querySelectorAll('.category-card, .gallery__item');
    if (cards.length === 0) return;
    const lift = 5;
    const tx = lx * lift;
    const ty = ly * lift;
    cards.forEach(card => {
      card.classList.add('card--tilt-active');
      card.style.transform = `translateX(${tx}px) translateY(${ty}px) scale3d(1.005, 1.005, 1)`;
      card.style.setProperty('--shine-x', (50 + lx * 30) + '%');
      card.style.setProperty('--shine-y', (50 + ly * 30) + '%');
    });
  }

  function releaseCardFloat() {
    document.querySelectorAll('.card--tilt-active').forEach(card => {
      card.classList.remove('card--tilt-active');
      card.style.transform = '';
      card.style.setProperty('--shine-x', '50%');
      card.style.setProperty('--shine-y', '50%');
    });
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
    if ((mode === 'browse' || mode === 'gallery') && (Math.abs(lx) > 0.08 || Math.abs(ly) > 0.08)) {
      injectCardFloat(lx, ly);
    } else if ((mode === 'browse' || mode === 'gallery') && Math.abs(lx) <= 0.08 && Math.abs(ly) <= 0.08) {
      releaseCardFloat();
    }

    // --- 方向移动焦点 ---
    const moveThreshold = 0.5;
    if (debounce('l', dX < 0 || lx < -moveThreshold)) moveFocus('left', mode);
    if (debounce('r', dX > 0 || lx > moveThreshold))  moveFocus('right', mode);
    if (debounce('u', dY < 0 || ly < -moveThreshold)) moveFocus('up', mode);
    if (debounce('d', dY > 0 || ly > moveThreshold))  moveFocus('down', mode);

    // --- A: 确认 ---
    if (debounce('a', active.buttons[map.A]?.pressed)) {
      if (mode === 'browse' || mode === 'gallery') activateFocus(mode);
      if (mode === 'settings') {
        const focused = document.querySelector('.settings-panel__item:nth-child(1) .toggle-switch');
        focused?.click();
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
      if (mode === 'browse' || mode === 'gallery') document.getElementById('tb-slideshow')?.click();
    }

    // --- LB/RB: 上一张/下一张 ---
    if (debounce('lb', active.buttons[map.LB]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__prev')?.click();
      if (mode === 'slideshow') document.getElementById('sl-prev')?.click();
    }
    if (debounce('rb', active.buttons[map.RB]?.pressed)) {
      if (mode === 'lightbox')  document.querySelector('.lightbox__next')?.click();
      if (mode === 'slideshow') document.getElementById('sl-next')?.click();
    }

    // --- LT/RT: 灯箱评分增减 ---
    if (debounce('lt', active.buttons[map.LT]?.pressed)) {
      if (mode === 'lightbox') document.querySelector('.rating__star[data-v="1"]')?.click();
    }
    if (debounce('rt', active.buttons[map.RT]?.pressed)) {
      if (mode === 'lightbox') document.querySelector('.rating__star[data-v="5"]')?.click();
    }

    // --- START: 设置 ---
    if (debounce('start', active.buttons[map.START]?.pressed)) {
      document.getElementById('tb-settings')?.click();
    }

    // --- BACK: 快捷键 ---
    if (debounce('back', active.buttons[map.BACK]?.pressed)) {
      document.getElementById('tb-shortcuts')?.click();
    }

    // --- LS/RS: 灯箱/幻灯片缩放 ---
    if (mode === 'lightbox' && Math.abs(ry) > 0.1) {
      document.getElementById('lightbox')?.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -ry * 40, bubbles: true })
      );
    }
    if (mode === 'slideshow' && Math.abs(ry) > 0.1) {
      const btn = ry < -0.3 ? document.getElementById('sl-zoom-in') : document.getElementById('sl-zoom-out');
      if (Math.abs(ry) > 0.5) btn?.click();
    }

    // --- 模式切换时刷新焦点 ---
    updateFocus(mode);

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
