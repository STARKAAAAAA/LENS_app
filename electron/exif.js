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

  try {
    const [exifData, fsStat] = await Promise.all([
      parse(filePath, EXIF_TAGS),
      stat(filePath).catch(() => null),
    ]);

    if (!exifData) return { ...empty, filesize: fsStat?.size || 0 };

    return {
      camera: formatCamera(exifData.Make, exifData.Model),
      lens: exifData.LensModel || '',
      aperture: formatAperture(exifData.FNumber),
      shutter: formatShutter(exifData.ExposureTime),
      iso: formatIso(exifData.ISO),
      focal_length: formatFocalLength(exifData.FocalLength),
      date: exifData.DateTimeOriginal || '',
      width: exifData.ImageWidth || 0,
      height: exifData.ImageHeight || 0,
      filesize: fsStat?.size || 0,
    };
  } catch {
    return empty;
  }
}
