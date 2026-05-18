/* ═══════════════════════════════════════════════════════
   液态玻璃 — Canvas 径向透镜
   feImage + backdrop-filter
   ═══════════════════════════════════════════════════════ */

const MAP_SZ = 256;

export class LiquidGlassStudio {
  constructor(container, opts = {}) {
    this.container = container;
    this._spring = { x: 0, y: 0, vx: 0, vy: 0 };
    this._running = false; this._raf = null;
    this._dpr = window.devicePixelRatio || 1;
    this._refraction = 150;
    this._setup();
  }

  _setup() {
    this._canvas = document.createElement('canvas');
    this._canvas.width = MAP_SZ; this._canvas.height = MAP_SZ;
    this._mapUrl = this._renderMap();

    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none;');
    this._buildFilter();
    this.container.appendChild(this._svg);

    this._glass = document.createElement('div');
    this._glass.id = 'liquid-glass';
    this._glass.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9998;width:240px;height:240px;';
    this.container.appendChild(this._glass);

    this._target = { x: window.innerWidth / 2 * this._dpr, y: window.innerHeight / 2 * this._dpr };
    this._spring = { x: this._target.x, y: this._target.y, vx: 0, vy: 0 };
    this._onPtr = e => { this._target = { x: e.clientX * this._dpr, y: e.clientY * this._dpr }; };
    window.addEventListener('pointermove', this._onPtr);
  }

  _renderMap() {
    const ctx = this._canvas.getContext('2d');
    const img = ctx.createImageData(MAP_SZ, MAP_SZ);
    const d = img.data;
    for (let y = 0; y < MAP_SZ; y++) {
      for (let x = 0; x < MAP_SZ; x++) {
        const nx = (x / MAP_SZ - 0.5) * 2;
        const ny = (y / MAP_SZ - 0.5) * 2;
        const dist = Math.sqrt(nx * nx + ny * ny);
        const str = Math.pow(Math.min(1, dist), 3);
        const i = (y * MAP_SZ + x) * 4;
        d[i]     = Math.max(0, Math.min(255, (nx * str * 0.5 + 0.5) * 255));
        d[i + 1] = Math.max(0, Math.min(255, (ny * str * 0.5 + 0.5) * 255));
        d[i + 2] = Math.max(0, Math.min(255, (ny * str * 0.5 + 0.5) * 255));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return this._canvas.toDataURL();
  }

  _buildFilter() {
    this._svg.innerHTML =
      '<filter id="lg-refract" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">' +
        '<feImage href="' + this._mapUrl + '" result="DMAP" preserveAspectRatio="xMidYMid slice"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="DMAP" scale="' + this._refraction + '" xChannelSelector="R" yChannelSelector="B"/>' +
      '</filter>';
  }

  setRefraction(v) { this._refraction = v; this._buildFilter(); }
  setAberration(_v) {}
  setShape(w, h, r) {
    if (this._glass) {
      this._glass.style.width = w + 'px'; this._glass.style.height = h + 'px';
      this._glass.style.borderRadius = r + 'px';
    }
  }

  async start() { if (this._running) return; this._running = true; this._lastT = performance.now(); this._loop(); }
  stop() { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const s = this._spring;
    const dt = Math.min((performance.now() - this._lastT) / 1000, 0.1);
    this._lastT = performance.now();
    const T = this.tension || 170, F = this.friction || 26;
    s.vx += (T * (this._target.x - s.x) - F * s.vx) * dt;
    s.vy += (T * (this._target.y - s.y) - F * s.vy) * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    const el = this._glass;
    el.style.left = (s.x / this._dpr - el.offsetWidth / 2).toFixed(1) + 'px';
    el.style.top = (s.y / this._dpr - el.offsetHeight / 2).toFixed(1) + 'px';
  }

  updateControls(opts) { Object.assign(this, opts); }

  destroy() {
    this.stop(); window.removeEventListener('pointermove', this._onPtr);
    if (this._glass) { this._glass.remove(); this._glass = null; }
    if (this._svg) { this._svg.remove(); this._svg = null; }
    if (this._canvas) { this._canvas = null; }
  }
}
