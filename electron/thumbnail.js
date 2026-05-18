// ═══════════════════════════════════════════════
// LENS — Thumbnail Engine (sharp/libvips)
// ═══════════════════════════════════════════════

import { createRequire } from 'module';
import { join } from 'path';
import { readdir, mkdir, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const pLimit = require('p-limit');

const MAX_WORKERS = 16;
const MAX_EDGE = 480;
const JPEG_QUALITY = 95;
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 33) + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(16).padStart(8, '0');
}

async function generateOne(original, dest) {
  try {
    const metadata = await sharp(original).metadata();
    let pipeline = sharp(original);

    const longest = Math.max(metadata.width || 0, metadata.height || 0);
    if (longest > MAX_EDGE) {
      const ratio = MAX_EDGE / longest;
      pipeline = pipeline.resize({
        width: Math.round((metadata.width || MAX_EDGE) * ratio),
        height: Math.round((metadata.height || MAX_EDGE) * ratio),
        fit: 'inside',
        kernel: 'lanczos3',
      });
    }

    await pipeline.jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:2:0' }).toFile(dest);
    return true;
  } catch (err) {
    console.error(`[thumbnail] Failed: ${original}`, err.message);
    return false;
  }
}

async function cleanExpiredCache(cacheDir) {
  try {
    if (!existsSync(cacheDir)) return;
    const entries = await readdir(cacheDir);
    let newestMs = 0;
    for (const entry of entries) {
      try {
        const s = await stat(join(cacheDir, entry));
        if (s.mtimeMs > newestMs) newestMs = s.mtimeMs;
      } catch { /* skip */ }
    }
    if (newestMs > 0 && (Date.now() - newestMs) > CACHE_TTL_MS) {
      await rm(cacheDir, { recursive: true, force: true });
      await mkdir(cacheDir, { recursive: true });
    }
  } catch { /* ignore */ }
}

export async function generateThumbnails(paths, cacheDir, onProgress) {
  await cleanExpiredCache(cacheDir);

  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }

  const limit = pLimit.default ? pLimit.default(Math.min(MAX_WORKERS, paths.length)) : pLimit(Math.min(MAX_WORKERS, paths.length));
  const result = {};
  let current = 0;
  let fresh = 0;
  const total = paths.length;

  const tasks = paths.map((originalPath) => {
    const hash = djb2(originalPath);
    const dest = join(cacheDir, `${hash}.jpg`);

    return limit(async () => {
      if (existsSync(dest)) {
        result[originalPath] = dest;
      } else {
        const ok = await generateOne(originalPath, dest);
        if (ok) {
          result[originalPath] = dest;
          fresh++;
        }
      }
      current++;
      if (onProgress) {
        onProgress('progress', { current, total, fresh });
      }
    });
  });

  await Promise.all(tasks);
  return result;
}

export async function getCacheInfo(cacheDir) {
  if (!existsSync(cacheDir)) return { size_bytes: 0, file_count: 0 };

  const entries = await readdir(cacheDir);
  let sizeBytes = 0;
  let fileCount = 0;

  for (const entry of entries) {
    try {
      const s = await stat(join(cacheDir, entry));
      if (s.isFile()) {
        sizeBytes += s.size;
        fileCount++;
      }
    } catch { /* skip */ }
  }

  return { size_bytes: sizeBytes, file_count: fileCount };
}

export async function clearCache(cacheDir) {
  if (existsSync(cacheDir)) {
    await rm(cacheDir, { recursive: true, force: true });
  }
  await mkdir(cacheDir, { recursive: true });
}
