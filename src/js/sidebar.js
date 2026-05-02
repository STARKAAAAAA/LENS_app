// ========== 侧边栏渲染 & 缓存管理 ==========

// renderSidebar(activeDir, { getSavedFolders, loadDir, sidebarList, onSelectFolder, onRemoveFolder })
export function renderSidebar(activeDir, { getSavedFolders, loadDir, sidebarList, onSelectFolder, onRemoveFolder }) {
  const dirs = getSavedFolders();
  sidebarList.innerHTML = '';
  if (dirs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sidebar__empty';
    empty.textContent = '暂无文件夹\n点击下方按钮添加';
    sidebarList.appendChild(empty);
    return;
  }
  dirs.forEach(dir => {
    const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
    const isActive = dir === (activeDir || loadDir());
    const item = document.createElement('div');
    item.className = 'sidebar__item' + (isActive ? ' sidebar__item--active' : '');
    item.title = dir;
    item.innerHTML = `
      <svg class="sidebar__item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="sidebar__item-name">${name}</span>
      <span class="sidebar__item-remove">×</span>`;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('sidebar__item-remove')) return;
      if (dir === loadDir()) return;
      if (onSelectFolder) onSelectFolder(dir);
    });
    item.querySelector('.sidebar__item-remove').addEventListener('click', (e) => { e.stopPropagation(); if (onRemoveFolder) onRemoveFolder(dir); });
    sidebarList.appendChild(item);
  });
}

// addSavedFolder(dir, { getSavedFolders, saveFolders, renderSidebar })
export function addSavedFolder(dir, { getSavedFolders, saveFolders, renderSidebar }) {
  const dirs = getSavedFolders();
  const normalized = dir.replace(/\\/g, '/');
  if (!dirs.some(d => d.replace(/\\/g, '/') === normalized)) { dirs.unshift(dir); saveFolders(dirs); }
  renderSidebar(dir);
}

// removeSavedFolder(dir, { getSavedFolders, saveFolders, loadDir, renderSidebar, onReload, onEmpty })
export function removeSavedFolder(dir, { getSavedFolders, saveFolders, loadDir, renderSidebar, onReload, onEmpty }) {
  const dirs = getSavedFolders();
  const idx = dirs.findIndex(d => d.replace(/\\/g, '/') === dir.replace(/\\/g, '/'));
  if (idx !== -1) dirs.splice(idx, 1);
  saveFolders(dirs);
  const current = loadDir() || '';
  if (current.replace(/\\/g, '/') === dir.replace(/\\/g, '/')) {
    if (dirs.length > 0) { onReload(dirs[0]); }
    else { onEmpty(); }
  } else { renderSidebar(); }
}

// ========== 缓存管理 ==========
let _cacheDeps = null;

// createCacheSection({ sidebar, featureToggles, invoke, formatBytes })
export function createCacheSection({ sidebar, featureToggles, invoke, formatBytes }) {
  if (document.getElementById('cache-section')) return;
  _cacheDeps = { invoke, featureToggles, formatBytes };

  const section = document.createElement('div');
  section.id = 'cache-section';
  Object.assign(section.style, {
    padding: '10px 18px 14px',
    borderTop: '0.5px solid rgba(220,200,180,0.06)',
    marginTop: '4px',
  });

  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  });

  const info = document.createElement('span');
  info.id = 'cache-info';
  Object.assign(info.style, {
    fontFamily: "Cormorant Garamond, Georgia, serif",
    fontSize: '0.62rem', fontStyle: 'italic',
    letterSpacing: '0.05em', color: 'rgba(220,200,180,0.25)',
  });
  info.textContent = '缓存: --';

  const delBtn = document.createElement('button');
  delBtn.textContent = '清除';
  Object.assign(delBtn.style, {
    fontFamily: "Cormorant Garamond, Georgia, serif",
    fontSize: '0.6rem', fontStyle: 'italic',
    letterSpacing: '0.06em',
    color: 'rgba(220,200,180,0.3)',
    background: 'none', border: '0.5px solid rgba(220,200,180,0.10)',
    borderRadius: '100px', padding: '3px 12px', cursor: 'pointer',
    transition: 'all 0.3s ease',
  });
  delBtn.addEventListener('mouseenter', () => {
    delBtn.style.color = 'rgba(220,200,180,0.7)';
    delBtn.style.borderColor = 'rgba(220,200,180,0.25)';
  });
  delBtn.addEventListener('mouseleave', () => {
    delBtn.style.color = 'rgba(220,200,180,0.3)';
    delBtn.style.borderColor = 'rgba(220,200,180,0.10)';
  });
  delBtn.addEventListener('click', async () => {
    await invoke('clear_cache', { cacheDir: featureToggles.cacheDir });
    await updateCacheDisplay();
  });

  row.appendChild(info);
  row.appendChild(delBtn);
  section.appendChild(row);
  sidebar.appendChild(section);
}

// updateCacheDisplay() — uses stored _cacheDeps
export async function updateCacheDisplay() {
  if (!_cacheDeps) return;
  const { invoke, featureToggles, formatBytes } = _cacheDeps;
  try {
    const cache = await invoke('get_cache_info', { cacheDir: featureToggles.cacheDir });
    const info = document.getElementById('cache-info');
    if (info) info.textContent = `缓存: ${formatBytes(cache.size_bytes)} | ${cache.file_count} 文件`;
  } catch (e) { /* ignore */ }
}
