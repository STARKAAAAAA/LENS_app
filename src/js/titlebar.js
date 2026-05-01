// ========== 自定义标题栏控制 ==========

import { getCurrentWindow } from '@tauri-apps/api/window';

export function initTitlebar() {
  try {
    const appWindow = getCurrentWindow();
    document.getElementById('tb-minimize')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('tb-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());
    document.getElementById('tb-close')?.addEventListener('click', () => appWindow.close());
    const titlebar = document.getElementById('titlebar');
    if (titlebar) {
      titlebar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.titlebar__btn')) return;
        appWindow.toggleMaximize();
      });
    }
  } catch (e) { console.warn('initTitlebar error:', e); }
}
