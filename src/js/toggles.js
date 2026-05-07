// ========== 功能开关管理 ==========

export const TOGGLE_KEY = 'lens-feature-toggles';
export const TOGGLE_VERSION_KEY = 'lens-toggle-version';

export const DEFAULT_TOGGLES = {
  exif: true, rating: true,
  shortcuts: true, sortFilter: true,
  sortMethod: 'name', filterMode: 'all',
  density: 'm',
  cacheDir: 'E:\\LENS\\thumbnails',
};

export function loadToggles() {
  try { return { ...DEFAULT_TOGGLES, ...JSON.parse(localStorage.getItem(TOGGLE_KEY)) }; }
  catch { return { ...DEFAULT_TOGGLES }; }
}

export function saveToggles(t) { localStorage.setItem(TOGGLE_KEY, JSON.stringify(t)); }

// v1.5+ 迁移：确保评分、筛选排序默认开启
export function migrateToggles(toggles) {
  if (localStorage.getItem(TOGGLE_VERSION_KEY) !== '1.5.0') {
    toggles.rating = true;
    toggles.sortFilter = true;
    toggles.sortMethod = toggles.sortMethod || 'name';
    toggles.filterMode = toggles.filterMode || 'all';
    saveToggles(toggles);
    localStorage.setItem(TOGGLE_VERSION_KEY, '1.5.0');
  }
}

export function applyTogglesUI(toggles) {
  document.querySelectorAll('.toggle-switch').forEach(btn => {
    const key = btn.dataset.key;
    const on = toggles[key];
    btn.classList.toggle('toggle-switch--on', on);
  });
  // 快捷键 "?" 按钮显隐动画
  const shortcutsBtn2 = document.getElementById('tb-shortcuts');
  if (shortcutsBtn2) {
    if (toggles.shortcuts) {
      shortcutsBtn2.style.opacity = '1';
      shortcutsBtn2.style.maxWidth = '200px';
      shortcutsBtn2.style.paddingLeft = '';
      shortcutsBtn2.style.paddingRight = '';
      shortcutsBtn2.style.pointerEvents = 'auto';
      shortcutsBtn2.style.filter = 'blur(0)';
      shortcutsBtn2.style.WebkitFilter = 'blur(0)';
    } else {
      shortcutsBtn2.style.opacity = '0';
      shortcutsBtn2.style.maxWidth = '0';
      shortcutsBtn2.style.paddingLeft = '0';
      shortcutsBtn2.style.paddingRight = '0';
      shortcutsBtn2.style.pointerEvents = 'none';
      shortcutsBtn2.style.overflow = 'hidden';
      shortcutsBtn2.style.margin = '0';
      shortcutsBtn2.style.border = '0';
      shortcutsBtn2.style.filter = 'blur(8px)';
      shortcutsBtn2.style.WebkitFilter = 'blur(8px)';
    }
  }
  document.querySelectorAll('.density-btn').forEach(b => {
    b.classList.toggle('density-btn--active', b.dataset.density === toggles.density);
  });
  const sizes = { s: '200px', m: '280px', l: '360px' };
  const size = sizes[toggles.density] || '280px';
  document.documentElement.style.setProperty('--thumb-card-size', size);
  const cats = document.getElementById('categories');
  const gGrid = document.getElementById('gallery-grid');
  const cols = { s: 4, m: 3, l: 2 };
  // 不设置内联样式，让 CSS var(--thumb-card-size) 生效，dev panel 调节可覆盖
  if (gGrid) gGrid.style.columns = cols[toggles.density] || 3;
  [cats, gGrid].forEach(el => {
    if (!el) return;
    const sweep = document.createElement('div');
    sweep.className = 'density-sweep';
    el.appendChild(sweep);
    requestAnimationFrame(() => {
      sweep.classList.add('density-sweep--run');
      sweep.addEventListener('animationend', () => sweep.remove());
    });
  });
}
