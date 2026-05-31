// ========== GlassSlider — Liquid Glass Range Component ==========
// 330×14 track + 90×60 capsule thumb with SVG backdrop-filter + press-to-glass
// Ported from test-glass-v9

import { makeCapsuleSDF, F, snell, prepComponentFilter, setFilterScale, blobCache } from './glass-core.js';

let _instanceId = 0;

export class GlassSlider {
  /**
   * @param {Object} opts
   * @param {number} [opts.trackW=330]
   * @param {number} [opts.trackH=14]
   * @param {number} [opts.thumbW=90]
   * @param {number} [opts.thumbH=60]
   * @param {string} [opts.surface='concave']
   * @param {number} [opts.bezel=40]
   * @param {number} [opts.thick=50]
   * @param {number} [opts.scale=2.50]
   * @param {number} [opts.blur=0]
   * @param {number} [opts.saturate=0]
   * @param {number} [opts.specAngle=-45]
   * @param {number} [opts.specAlpha=0.4]
   * @param {number} [opts.min=0]
   * @param {number} [opts.max=100]
   * @param {number} [opts.step=1]
   * @param {number} [opts.initialValue=0]
   * @param {Function} [opts.onChange]
   */
  constructor(opts = {}) {
    this.id = 'gsl-' + (++_instanceId);
    this._opts = Object.assign({
      trackW: 330, trackH: 14, thumbW: 90, thumbH: 60,
      surface: 'concave', bezel: 40, thick: 50, scale: 2.50,
      blur: 0, saturate: 0, specAngle: -45, specAlpha: 0.4,
      min: 0, max: 100, step: 1, initialValue: 0,
    }, opts);
    this._val = this._opts.initialValue;
    this._onChange = this._opts.onChange || null;

    // Drag state
    this._dragging = false;
    this._targetX = 0; this._grabOffset = 0;
    this._raf = 0;
    this._mounted = false;

    // Outer height = thumbH
    this._outerH = this._opts.thumbH;

    // Bound handlers
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._tick = this._tick.bind(this);
  }

  mount(parentEl) {
    if (this._mounted) return;
    this._mounted = true;

    // Build DOM
    // Outer container
    this._outer = document.createElement('div');
    this._outer.className = 'gsl-outer';
    Object.assign(this._outer.style, {
      position: 'relative', width: this._opts.trackW + 'px', height: this._outerH + 'px',
    });

    // Track
    const trackTop = (this._outerH - this._opts.trackH) / 2;
    this._track = document.createElement('div');
    this._track.className = 'gsl-track';
    Object.assign(this._track.style, {
      display: 'inline-block', width: this._opts.trackW + 'px', height: this._opts.trackH + 'px',
      left: '0', top: trackTop + 'px',
      borderRadius: (this._opts.trackH / 2) + 'px',
      position: 'absolute', cursor: 'pointer',
    });

    // Fill wrap
    this._fillWrap = document.createElement('div');
    Object.assign(this._fillWrap.style, {
      width: '100%', height: '100%', overflow: 'hidden', borderRadius: (this._opts.trackH / 2) + 'px',
    });
    this._fill = document.createElement('div');
    this._fill.className = 'gsl-fill';
    Object.assign(this._fill.style, {
      position: 'absolute', top: '0', left: '0', height: this._opts.trackH + 'px',
      borderRadius: (this._opts.trackH / 2 - 1) + 'px', width: '0%',
    });
    this._fillWrap.appendChild(this._fill);
    this._track.appendChild(this._fillWrap);

    // Thumb
    this._thumb = document.createElement('div');
    this._thumb.className = 'gsl-thumb';
    const thumbTop = (this._outerH - this._opts.thumbH) / 2;
    Object.assign(this._thumb.style, {
      position: 'absolute', height: this._opts.thumbH + 'px', width: this._opts.thumbW + 'px',
      borderRadius: (this._opts.thumbH / 2) + 'px',
      top: thumbTop + 'px', left: '0',
      cursor: 'pointer', touchAction: 'pan-y', userSelect: 'none',
    });

    this._outer.appendChild(this._track);
    this._outer.appendChild(this._thumb);
    parentEl.appendChild(this._outer);

    // Set initial thumb position from initialValue
    const initFrac = this._frac;
    this._thumb.style.left = Math.round(initFrac * this._opts.trackW) + 'px';
    this._fill.style.width = (initFrac * 100) + '%';

    // Generate filter
    const sdf = makeCapsuleSDF(this._opts.thumbW, this._opts.thumbH);
    const { sc } = prepComponentFilter(
      this.id, this._thumb, this._opts.thumbW, this._opts.thumbH,
      sdf, this._opts.bezel, this._opts.thick, this._opts.scale,
      this._opts.surface, this._opts.specAngle, this._opts.specAlpha,
      this._opts.saturate, this._opts.blur, true
    );
    this._fullScale = sc;

    // Events
    this._thumb.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  destroy() {
    if (!this._mounted) return;
    this._mounted = false;
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    if (this._outer) {
      this._thumb.removeEventListener('pointerdown', this._onPointerDown);
      this._outer.remove();
    }
    cancelAnimationFrame(this._raf);
    for (const suffix of ['D', 'S', 'H', 'SC']) {
      const key = this.id + suffix;
      if (blobCache[key]) {
        if (suffix === 'D' || suffix === 'S') URL.revokeObjectURL(blobCache[key]);
        delete blobCache[key];
      }
    }
    this._outer = this._track = this._fill = this._thumb = null;
  }

  get value() { return this._val; }

  _glassOn() {
    this._thumb.classList.add('glass');
    setFilterScale(this.id, blobCache[this.id + 'SC'] || this._fullScale, 100);
    this._thumb.style.transition = 'transform 0.10s linear';
  }

  _glassOff() {
    setFilterScale(this.id, '0', 100);
    this._thumb.classList.remove('glass');
  }

  _onPointerDown(e) {
    this._dragging = true; this._glassOn();
    const r = this._track.getBoundingClientRect();
    const thumbCenter = parseFloat(this._thumb.style.left) || (this._frac * r.width);
    this._grabOffset = thumbCenter - (e.clientX - r.left);
    this._thumb.setPointerCapture(e.pointerId);
    if (!this._raf) this._raf = requestAnimationFrame(this._tick);
    e.preventDefault();
  }

  _onPointerMove(e) {
    if (!this._dragging) return;
    const r = this._track.getBoundingClientRect();
    this._targetX = e.clientX - r.left + this._grabOffset;
  }

  _onPointerUp() {
    if (!this._dragging) return;
    this._dragging = false; this._glassOff();
    const w = this._track.getBoundingClientRect().width;
    this._thumb.style.transition = 'left 0.45s cubic-bezier(0.25,0.8,0.35,1.0), transform 0.3s cubic-bezier(0.22,0.9,0.36,1.0)';
    this._thumb.style.left = Math.round(this._frac * w) + 'px';
  }

  get _frac() {
    return Math.max(0, Math.min(1, (this._val - this._opts.min) / (this._opts.max - this._opts.min)));
  }

  _tick() {
    if (!this._dragging) { this._raf = 0; return; }
    const r = this._track.getBoundingClientRect();
    const raw = this._targetX, w = r.width;
    let tx;
    if (raw < 0) { const d = -raw; tx = -d / (1 + d * 0.25); }
    else if (raw > w) { const d = raw - w; tx = w + d / (1 + d * 0.25); }
    else { tx = raw; }
    const frac = Math.max(0, Math.min(1, raw / w));
    this._val = this._opts.min + frac * (this._opts.max - this._opts.min);
    this._val = Math.round(this._val / this._opts.step) * this._opts.step;
    if (this._onChange) this._onChange(this._val);

    const cur = parseFloat(this._thumb.style.left) || 0;
    let nx = cur + (tx - cur) * 0.55;
    if (Math.abs(tx - cur) < 0.3) nx = tx;
    this._thumb.style.left = Math.round(nx) + 'px';
    this._fill.style.width = (frac * 100) + '%';
    this._raf = requestAnimationFrame(this._tick);
  }
}
