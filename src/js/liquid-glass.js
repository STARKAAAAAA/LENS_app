/* ═══════════════════════════════════════════════════════
   LiquidGlass — 集成 LG-Studio 全屏液态玻璃引擎
   ═══════════════════════════════════════════════════════ */

import { LiquidGlassStudio } from './lg-studio.js';

let _studio = null;
let _mounted = false;

export function mountLiquidGlass(opts = {}) {
  if (_mounted) return;
  _mounted = true;

  _studio = new LiquidGlassStudio(document.body, {
    ...opts,
  });
  _studio.start();
}

export function unmountLiquidGlass() {
  if (_studio) { _studio.destroy(); _studio = null; }
  _mounted = false;
}

export function isLiquidGlassMounted() { return _mounted; }
export function getStudio() { return _studio; }
