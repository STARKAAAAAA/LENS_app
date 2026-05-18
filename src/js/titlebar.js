// ========== 自定义标题栏控制 ==========

export function initTitlebar() {
  try {
    const api = window.electronAPI || window.__TAURI_INTERNALS__;

    const minimize = () => {
      if (api) api.invoke('window:minimize');
      else import('@tauri-apps/api/window').then(m => m.getCurrentWindow().minimize());
    };
    const toggleMaximize = async () => {
      if (api) api.invoke('window:toggleMaximize');
      else {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().toggleMaximize();
      }
    };
    const close = () => {
      if (api) api.invoke('window:close');
      else import('@tauri-apps/api/window').then(m => m.getCurrentWindow().close());
    };

    document.getElementById('tb-minimize')?.addEventListener('click', minimize);
    document.getElementById('tb-maximize')?.addEventListener('click', toggleMaximize);
    document.getElementById('tb-close')?.addEventListener('click', close);
    const titlebar = document.getElementById('titlebar');
    if (titlebar) {
      titlebar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.titlebar__btn')) return;
        toggleMaximize();
      });
    }
  } catch (e) { console.warn('initTitlebar error:', e); }
}
