// ═══════════════════════════════════════════════
// LENS — EXIF Reader (exifr)
// ═══════════════════════════════════════════════

import { createRequire } from 'module';
import { stat } from 'fs/promises';

const require = createRequire(import.meta.url);
const { parse } = require('exifr');

const EXIF_TAGS = [
  'Make', 'Model', 'LensModel',
  'FNumber', 'ExposureTime', 'ISO',
  'FocalLength', 'DateTimeOriginal',
  'ImageWidth', 'ImageHeight',
];

function formatAperture(fnumber) {
  if (!fnumber) return '';
  return `f/${Number(fnumber).toFixed(1).replace(/\.0$/, '')}`;
}

function formatShutter(exposureTime) {
  if (!exposureTime) return '';
  if (exposureTime >= 1) return `${Number(exposureTime).toFixed(0)}s`;
  const denom = Math.round(1 / exposureTime);
  return `1/${denom}s`;
}

function formatIso(iso) {
  if (!iso) return '';
  return `ISO ${iso}`;
}

function formatFocalLength(fl) {
  if (!fl) return '';
  return `${Math.round(Number(fl))}mm`;
}

function formatCamera(make, model) {
  if (!make && !model) return '';
  if (!make) return model;
  if (!model) return make;
  if (model.startsWith(make)) return model;
  return `${make} ${model}`;
}

export async function getExifInfo(filePath) {
  const empty = {
    camera: '', lens: '', aperture: '', shutter: '', iso: '',
    focal_length: '', date: '', width: 0, height: 0, filesize: 0,
  };

  // 独立获取 filesize（不受 EXIF 解析影响）
  let filesize = 0;
  try {
    const st = await stat(filePath);
    filesize = st.size;
  } catch {}

  // 独立解析 EXIF
  let exif = null;
  try {
    exif = await parse(filePath, EXIF_TAGS);
  } catch {}

  if (!exif) return { ...empty, filesize };

  try {
    return {
      camera: formatCamera(exif.Make, exif.Model),
      lens: exif.LensModel || '',
      aperture: formatAperture(exif.FNumber),
      shutter: formatShutter(exif.ExposureTime),
      iso: formatIso(exif.ISO),
      focal_length: formatFocalLength(exif.FocalLength),
      date: exif.DateTimeOriginal || '',
      width: exif.ImageWidth || 0,
      height: exif.ImageHeight || 0,
      filesize,
    };
  } catch {
    return { ...empty, filesize };
  }
}
