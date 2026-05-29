// ========== 自定义标题栏控制 ==========

export function initTitlebar() {
  try {
    const api = window.electronAPI;

    const minimize = () => api.invoke('window:minimize');
    const toggleMaximize = async () => api.invoke('window:toggleMaximize');
    const close = () => api.invoke('window:close');

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
