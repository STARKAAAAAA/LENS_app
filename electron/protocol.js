// ═══════════════════════════════════════════════
// LENS — Custom lens:// Protocol
// ═══════════════════════════════════════════════

import { createRequire } from 'module';
import { protocol } from 'electron';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

async function resizeIfLarge(data) {
  if (data.length < 1024 * 1024) return data;

  try {
    const image = sharp(data);
    const metadata = await image.metadata();
    const longest = Math.max(metadata.width || 0, metadata.height || 0);

    if (longest <= 3000) return data;

    const ratio = 2560 / longest;
    const newWidth = Math.round((metadata.width || 2560) * ratio);
    const newHeight = Math.round((metadata.height || 2560) * ratio);

    return image
      .resize({ width: newWidth, height: newHeight, fit: 'inside', kernel: 'catrom' })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch {
    return data;
  }
}

export function registerProtocol() {
  protocol.handle('lens', async (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

      // Handle Windows drive letters
      if (filePath.match(/^[a-zA-Z]:/)) {
        // Path already has drive letter
      }

      const data = await readFile(filePath);
      const fullQuality = url.searchParams.get('full') === '1';
      const responseData = fullQuality ? data : await resizeIfLarge(data);

      return new Response(responseData, {
        status: 200,
        headers: {
          'Content-Type': getMimeType(filePath),
          'Cache-Control': 'max-age=3600',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}
