// ========== 文件夹选择 & 照片扫描 ==========

import { cleanCategory, cleanTitle } from './utils.js';

const api = window.electronAPI;

export async function selectFolder() {
  if (api) {
    const selected = await api.invoke('dialog:open', { directory: true });
    return selected || null;
  }
  // Tauri fallback
  const [{ open }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
  ]);
  const selected = await open({ directory: true, multiple: false, title: '选择照片文件夹' });
  return selected || null;
}

export async function scanPhotos(baseDir) {
  const photos = [];

  // Read directory entries
  async function readDirEntries(dir) {
    if (api) return api.invoke('fs:readDir', dir);
    const [{ readDir }, { join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    const raw = await readDir(dir);
    return raw.map(e => ({ name: e.name, isDirectory: e.isDirectory, isFile: !e.isDirectory, isSymlink: false }));
  }

  // Join path segments
  async function pathJoin(...parts) {
    if (api) return api.invoke('path:join', ...parts);
    const { join } = await import('@tauri-apps/api/path');
    return join(...parts);
  }

  // Convert to display URL
  function toSrc(fullPath) {
    if (api) return api.convertFileSrc(fullPath);
    // Dynamic import for Tauri fallback
    return import('@tauri-apps/api/core').then(m => m.convertFileSrc(fullPath));
  }

  async function walk(dir) {
    let entries;
    try {
      entries = await readDirEntries(dir);
    } catch (e) {
      console.warn(`跳过无法读取的目录: ${dir}`, e);
      return;
    }
    for (const entry of entries) {
      const fullPath = await pathJoin(dir, entry.name);
      if (entry.isDirectory) {
        await walk(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.jpg')) {
        const rel = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        const parts = rel.split(/[\\/]/);
        const topFolder = parts[0];
        const category = cleanCategory(topFolder);
        const title = cleanTitle(entry.name);
        const src = await toSrc(fullPath);
        photos.push({ src, path: fullPath, category, title, folder: topFolder });
      }
    }
  }
  await walk(baseDir);
  photos.sort((a, b) => a.folder.localeCompare(b.folder, undefined, { numeric: true }));
  const categories = [...new Set(photos.map(p => p.category))];
  const byCategory = {};
  photos.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  return { categories, photos, byCategory };
}
