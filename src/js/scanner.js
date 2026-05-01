// ========== 文件夹选择 & 照片扫描 ==========

import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { cleanCategory, cleanTitle } from './utils.js';

export async function selectFolder() {
  const selected = await open({ directory: true, multiple: false, title: '选择照片文件夹' });
  return selected || null;
}

export async function scanPhotos(baseDir) {
  const photos = [];
  async function walk(dir) {
    let entries;
    try { entries = await readDir(dir); }
    catch (e) { console.error(`读取失败: ${dir}`, e); throw e; }
    for (const entry of entries) {
      const fullPath = await join(dir, entry.name);
      if (entry.isDirectory) { await walk(fullPath); }
      else if (entry.name.toLowerCase().endsWith('.jpg')) {
        const rel = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        const parts = rel.split(/[\\/]/);
        const topFolder = parts[0];
        const category = cleanCategory(topFolder);
        const title = cleanTitle(entry.name);
        photos.push({ src: convertFileSrc(fullPath), path: fullPath, category, title, folder: topFolder });
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
