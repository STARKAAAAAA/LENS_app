// ========== 配置管理（localStorage） ==========

export const CONFIG_KEY = 'lens-photo-dir';
export const SAVED_KEY = 'lens-saved-folders';

export function loadDir() { return localStorage.getItem(CONFIG_KEY) || ''; }
export function saveDir(dir) { localStorage.setItem(CONFIG_KEY, dir); }

export function getSavedFolders() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; }
  catch { return []; }
}
export function saveFolders(dirs) { localStorage.setItem(SAVED_KEY, JSON.stringify(dirs)); }
