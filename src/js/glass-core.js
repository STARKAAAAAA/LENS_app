// ========== Liquid Glass Core — Shared SDF/Snell/Map/Filter Pipeline ==========
// Extracted from test-glass-v9. Stateless pure functions + shared blob cache + SVG host.

const IOR = 1.5;
const MAP_DPR = Math.min(window.devicePixelRatio || 1, 2);

// ── SDF generators ──
export function makeCircleSDF(R) {
  return function (px, py) { return Math.sqrt(px * px + py * py) - R; };
}
export function makeCapsuleSDF(W, H) {
  const hw = W / 2, hh = H / 2, r = Math.min(hw, hh), hl = Math.max(0, hw - r);
  return function (px, py) {
    const cx = Math.max(-hl, Math.min(hl, px));
    return Math.sqrt((px - cx) * (px - cx) + py * py) - r;
  };
}
export function makeRoundedRectSDF(W, H, cr) {
  const hw = W / 2, hh = H / 2;
  return function (px, py) {
    const dx = Math.abs(px) - hw + cr, dy = Math.abs(py) - hh + cr;
    return Math.sqrt(Math.max(dx, 0) * Math.max(dx, 0) + Math.max(dy, 0) * Math.max(dy, 0)) +
      Math.min(Math.max(dx, dy), 0) - cr;
  };
}

// ── SDF gradient ──
export function sdfGrad(sdf, px, py, eps) {
  eps = eps || 0.5;
  const gx = sdf(px + eps, py) - sdf(px - eps, py);
  const gy = sdf(px, py + eps) - sdf(px, py - eps);
  const gl = Math.sqrt(gx * gx + gy * gy);
  return gl < 0.0001 ? { x: 0, y: 1 } : { x: gx / gl, y: gy / gl };
}

// ── Smoothstep ──
function st(x) { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); }
function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

// ── Surface functions ──
export const F = {
  circle: function (x) { const d = 1 - Math.max(0, Math.min(1, x)); return d <= 0 ? 1 : Math.sqrt(1 - d * d); },
  squircle: function (x) { const d = 1 - Math.max(0, Math.min(1, x)); return d <= 0 ? 1 : Math.pow(1 - Math.pow(d, 4), 0.25); },
  concave: function (x) { return 1 - F.squircle(x); },
  lip: function (x) { const t = st(x); return F.squircle(x) * (1 - t) + (1 - F.squircle(x)) * t; },
};

// ── Snell's law refraction ──
export function snell(fn, bw, th, N) {
  N = N || 128;
  const o = [], d = 0.0005;
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1), h = fn(x) * th;
    const xm = Math.max(0, x - d), xp = Math.min(1, x + d);
    const der = (fn(xp) - fn(xm)) / (xp - xm);
    const nx = -der, ny = 1, nL = Math.sqrt(nx * nx + ny * ny);
    const cosT = Math.abs(ny) / nL;
    const t1 = Math.acos(Math.min(1, cosT));
    const s2 = Math.sin(t1) / IOR;
    let ds;
    if (s2 >= 1) ds = h * Math.tan(t1);
    else ds = h * Math.tan(Math.asin(s2));
    o.push({ t: x, der: der, ab: ds, mg: ds * (der >= 0 ? -1 : 1) });
  }
  return o;
}

// ── Displacement map builder ──
export function buildMap(mW, mH, sdf, bw, samples, md, ref, dpr) {
  dpr = dpr || MAP_DPR || 1;
  const cW = Math.round(mW * dpr), cH = Math.round(mH * dpr);
  const c = document.createElement('canvas'); c.width = cW; c.height = cH;
  const ctx = c.getContext('2d'), img = ctx.createImageData(cW, cH), d = img.data;
  const denom = ref || md || 1, N = samples.length - 1;
  for (let y = 0; y < cH; y++) {
    for (let x = 0; x < cW; x++) {
      const i = (y * cW + x) * 4;
      const px = x / dpr - mW / 2, py = y / dpr - mH / 2;
      const sd = sdf(px, py), bd = -sd;
      const t = Math.max(0, Math.min(1, bd / bw));
      const edgeFade = sm(t / 0.04) * sm((1 - t) / 0.04);
      if (bd < -2 || edgeFade < 0.001) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 255; continue; }
      const tf = t * N, si = Math.floor(tf), si2 = Math.min(si + 1, N), frac = tf - si;
      const s0 = samples[Math.max(0, Math.min(N, si))], s1 = samples[Math.max(0, Math.min(N, si2))];
      const ab = s0.ab + (s1.ab - s0.ab) * frac, mg = s0.mg + (s1.mg - s0.mg) * frac;
      const nm = Math.min(1, ab / denom), sg = mg < 0 ? -1 : 1, grad = sdfGrad(sdf, px, py);
      const dither = (Math.random() + Math.random() - 1) * 0.35;
      d[i] = Math.max(0, Math.min(255, Math.round(128 - grad.x * nm * sg * 127 + dither)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(128 - grad.y * nm * sg * 127 + dither)));
      d[i + 2] = 0; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ── Specular map builder ──
export function buildSpecMap(mW, mH, sdf, bw, samples, angleDeg, dpr, opt) {
  opt = opt || {};
  const linePx = opt.linePx || 1, boost = opt.boost || 1.1, tPeak = opt.tPeak || 0.05;
  const alpha = opt.alpha != null ? opt.alpha : 1;
  if (opt.angle != null) angleDeg = opt.angle;
  dpr = dpr || MAP_DPR || 1;
  const cW = Math.round(mW * dpr), cH = Math.round(mH * dpr);
  const c = document.createElement('canvas'); c.width = cW; c.height = cH;
  const ctx = c.getContext('2d'), img = ctx.createImageData(cW, cH), d = img.data;
  const lightA = angleDeg * Math.PI / 180;
  for (let y = 0; y < cH; y++) {
    for (let x = 0; x < cW; x++) {
      const i = (y * cW + x) * 4;
      const px = x / dpr - mW / 2, py = y / dpr - mH / 2;
      const sd = sdf(px, py), bd = -sd;
      const t = Math.max(0, Math.min(1, bd / bw));
      if (t <= 0.001 || t >= 0.5 || bd < -2) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0; continue; }
      const si = Math.round(t * (samples.length - 1));
      const s = samples[Math.max(0, Math.min(samples.length - 1, si))];
      const tWidth = linePx / Math.max(1, bw), tDist = Math.abs(t - tPeak) / tWidth;
      const tFactor = tDist < 1 ? (1 - tDist) : 0;
      const angle = Math.atan2(py, px), dot = Math.cos(angle - lightA);
      const v = Math.round(Math.pow(Math.abs(dot * boost), 6) * tFactor * 255);
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      d[i + 3] = Math.max(0, Math.min(255, Math.round(v * alpha)));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ── SVG filter HTML builder ──
export function buildFilter(id, dispBlob, specBlob, mW, mH, sc, blur, sat, sα) {
  return '<filter id="' + id + '" color-interpolation-filters="sRGB" x="-60%" y="-60%" width="220%" height="220%">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="' + blur + '" result="bl"/>' +
    '<feImage href="' + dispBlob + '" x="0" y="0" width="' + mW + '" height="' + mH + '" result="dm"/>' +
    '<feDisplacementMap in="bl" in2="dm" scale="' + sc + '" xChannelSelector="R" yChannelSelector="G" result="dp"/>' +
    '<feColorMatrix in="dp" type="saturate" values="' + sat + '" result="ds"/>' +
    '<feImage href="' + specBlob + '" x="0" y="0" width="' + mW + '" height="' + mH + '" result="sp"/>' +
    '<feComposite in="ds" in2="sp" operator="in" result="ss"/>' +
    '<feComponentTransfer in="sp" result="sf"><feFuncA type="linear" slope="' + sα.toFixed(2) + '"/></feComponentTransfer>' +
    '<feBlend in="ss" in2="dp" mode="normal" result="ws"/>' +
    '<feBlend in="sf" in2="ws" mode="normal"/>' +
    '</filter>';
}

// ── Shared blob URL cache ──
export const blobCache = {};

// ── Shared SVG host ──
let _svgHost = null;
export function ensureSvgHost() {
  if (_svgHost && document.body.contains(_svgHost)) return _svgHost;
  _svgHost = document.getElementById('__glass_components_svg');
  if (!_svgHost) {
    _svgHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    _svgHost.id = '__glass_components_svg';
    _svgHost.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none;');
    document.body.appendChild(_svgHost);
  }
  return _svgHost;
}

// ── Batch update all cached filters into SVG host ──
export function updateAllFilters() {
  const svg = ensureSvgHost();
  let all = '<defs>';
  for (const k in blobCache) {
    if (k.slice(-1) === 'H') all += blobCache[k];
  }
  all += '</defs>';
  svg.innerHTML = all;
}

// ── RAF-animated feDisplacementMap scale (with 3-layer NaN guard) ──
const scaleAnim = {};
export function setFilterScale(filterId, target, duration) {
  target = Number(target); if (isNaN(target)) target = 22;
  duration = duration || 120;
  if (!scaleAnim[filterId]) scaleAnim[filterId] = { current: 0, target: 0, raf: 0, start: 0, from: 0, dur: 0 };
  const a = scaleAnim[filterId];
  a.target = target; a.from = a.current; a.start = performance.now(); a.dur = duration;
  if (!a.raf) {
    a.raf = requestAnimationFrame(function tick(t) {
      const s = scaleAnim[filterId];
      if (!s) return;
      let p = Math.min(1, (t - s.start) / s.dur);
      p = 1 - Math.pow(1 - p, 3);
      s.current = s.from + (s.target - s.from) * p;
      if (isNaN(s.current)) s.current = 0;
      const svg = ensureSvgHost();
      const el = svg.querySelector('#' + filterId + ' feDisplacementMap');
      if (el) el.setAttribute('scale', Math.round(s.current));
      if (p < 1) { s.raf = requestAnimationFrame(tick); }
      else { s.raf = 0; s.current = s.target; }
    });
  }
}

// ── Generate filter for a component ──
export function prepComponentFilter(id, el, mW, mH, sdf, bw, th, mt, surf, sa, sα, sat, blur, isPress, specOpt) {
  const fn = F[surf], samples = snell(fn, bw, th, 128);
  let md = Math.max.apply(null, samples.map(function (s) { return s.ab; }));
  if (md < 0.01) md = 0.01;
  const sc = Math.round(md * mt);
  const dispMap = buildMap(mW, mH, sdf, bw, samples, md, 0, MAP_DPR);
  const specMap = buildSpecMap(mW, mH, sdf, bw, samples, sa, MAP_DPR, specOpt || {});
  dispMap.toBlob(function (dblob) {
    specMap.toBlob(function (sblob) {
      if (blobCache[id + 'D']) URL.revokeObjectURL(blobCache[id + 'D']);
      if (blobCache[id + 'S']) URL.revokeObjectURL(blobCache[id + 'S']);
      blobCache[id + 'D'] = URL.createObjectURL(dblob);
      blobCache[id + 'S'] = URL.createObjectURL(sblob);
      const fHTML = buildFilter(id, blobCache[id + 'D'], blobCache[id + 'S'], mW, mH, sc, blur, sat, sα);
      blobCache[id + 'H'] = fHTML;
      updateAllFilters();
      el.style.backdropFilter = 'url(#' + id + ')';
      el.style.webkitBackdropFilter = 'url(#' + id + ')';
      if (isPress) {
        const svg = ensureSvgHost();
        const dispEl = svg.querySelector('#' + id + ' feDisplacementMap');
        if (dispEl) dispEl.setAttribute('scale', '0');
        blobCache[id + 'SC'] = sc;
      }
    });
  });
  return { md: md, sc: sc };
}
