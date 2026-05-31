// ========== GlassSwitch — Liquid Glass Toggle Component ==========
// 160×67 track + 146×92 capsule thumb with SVG backdrop-filter + press-to-glass
// Ported from test-glass-v9

import { makeCapsuleSDF, F, snell, prepComponentFilter, setFilterScale, blobCache } from './glass-core.js';

let _instanceId = 0;

export class GlassSwitch {
  /**
   * @param {Object} opts
   * @param {number} [opts.trackW=160]
   * @param {number} [opts.trackH=67]
   * @param {number} [opts.thumbW=146]
   * @param {number} [opts.thumbH=92]
   * @param {string} [opts.surface='concave']
   * @param {number} [opts.bezel=60]
   * @param {number} [opts.thick=60]
   * @param {number} [opts.scale=0.90]
   * @param {number} [opts.blur=0.2]
   * @param {number} [opts.saturate=0]
   * @param {number} [opts.specAngle=-45]
   * @param {number} [opts.specAlpha=0.4]
   * @param {boolean} [opts.initialState=false]
   * @param {Function} [opts.onChange]
   */
  constructor(opts = {}) {
    this.id = 'gsw-' + (++_instanceId);
    this._opts = Object.assign({
      trackW: 160, trackH: 67, thumbW: 146, thumbH: 92,
      surface: 'concave', bezel: 60, thick: 60, scale: 0.90,
      blur: 0.2, saturate: 0, specAngle: -45, specAlpha: 0.4,
      initialState: false,
    }, opts);
    this._on = this._opts.initialState;
    this._onChange = this._opts.onChange || null;

    // Drag state
    this._active = false;
    this._moved = 0;
    this._startX = 0; this._startTX = 0;
    this._targetTX = 0; this._currentTX = 0;
    this._raf = 0;
    this._mounted = false;

    // Bound handlers
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._tick = this._tick.bind(this);
  }

  /** Create DOM and mount into parent */
  mount(parentEl) {
    if (this._mounted) return;
    this._mounted = true;

    // Build DOM
    this._track = document.createElement('div');
    this._track.className = 'gsw-track' + (this._on ? ' on' : '');
    Object.assign(this._track.style, {
      display: 'inline-block',
      width: this._opts.trackW + 'px', height: this._opts.trackH + 'px',
      borderRadius: (this._opts.trackH / 2) + 'px',
      position: 'relative', cursor: 'pointer',
      transition: 'background 0.3s',
    });

    this._thumb = document.createElement('div');
    this._thumb.className = 'gsw-thumb';
    // Positioning computed from dimensions — overhang formula from v9 tuning
    const top = this._opts.trackH / 2;
    this._overhang = Math.round((this._opts.thumbH - this._opts.trackH) * 0.878 * 100) / 100;
    const marginLeft = -this._overhang;
    Object.assign(this._thumb.style, {
      position: 'absolute', height: this._opts.thumbH + 'px', width: this._opts.thumbW + 'px',
      borderRadius: (this._opts.thumbH / 2) + 'px',
      top: top + 'px', left: '0', marginLeft: marginLeft + 'px',
      transform: 'translateX(0px) translateY(-50%) scale(0.65)',
      transition: 'transform 0.35s cubic-bezier(0.34,1.3,0.64,1.0)',
    });
    this._track.appendChild(this._thumb);
    parentEl.appendChild(this._track);

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
    this._track.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this._track.addEventListener('pointerleave', this._onPointerLeave);
    this._thumb.addEventListener('pointerleave', this._onPointerLeave);
  }

  /** Remove from DOM and cleanup */
  destroy() {
    if (!this._mounted) return;
    this._mounted = false;
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    if (this._track) {
      this._track.removeEventListener('pointerdown', this._onPointerDown);
      this._track.removeEventListener('pointerleave', this._onPointerLeave);
      this._thumb.removeEventListener('pointerleave', this._onPointerLeave);
      this._track.remove();
    }
    cancelAnimationFrame(this._raf);
    // Revoke blob URLs
    for (const suffix of ['D', 'S', 'H', 'SC']) {
      const key = this.id + suffix;
      if (blobCache[key]) {
        if (suffix === 'D' || suffix === 'S') URL.revokeObjectURL(blobCache[key]);
        delete blobCache[key];
      }
    }
    this._track = null; this._thumb = null;
  }

  get state() { return this._on; }

  _glassOn() {
    this._thumb.classList.add('glass');
    setFilterScale(this.id, blobCache[this.id + 'SC'] || this._fullScale, 150);
    this._thumb.style.transition = 'transform 0.25s ease-out';
    const tx = this._on ? this._endTX : 0;
    this._thumb.style.transform = 'translateX(' + tx + 'px) translateY(-50%) scale(0.96)';
  }

  _glassOff() {
    setFilterScale(this.id, '0', 200);
    this._thumb.classList.remove('glass');
    this._thumb.style.transition = 'transform 0.45s cubic-bezier(0.25,0.8,0.35,1.0)';
    const tx = this._on ? this._endTX : 0;
    this._thumb.style.transform = 'translateX(' + tx + 'px) translateY(-50%) scale(0.65)';
  }

  _snap(target) {
    if (target !== this._on) {
      this._on = target;
      this._track.classList.toggle('on', this._on);
      if (this._onChange) this._onChange(this._on);
    }
  }

  // ON position computed from dimensions: trackW - thumbW + 2*overhang
  get _endTX() { return Math.round((this._opts.trackW - this._opts.thumbW + 2 * this._overhang) * 100) / 100; }

  _getCurrentTX() {
    const m = this._thumb.style.transform.match(/translateX\(([-\d.]+)px\)/);
    return m ? parseFloat(m[1]) : (this._on ? this._endTX : 0);
  }

  _onPointerDown(e) {
    this._active = true; this._moved = 0;
    this._startX = e.clientX;
    const tx = this._getCurrentTX();
    this._startTX = tx; this._targetTX = tx; this._currentTX = tx;
    this._thumb.setPointerCapture(e.pointerId);
    this._glassOn();
    e.preventDefault(); e.stopPropagation();
  }

  _onPointerMove(e) {
    if (!this._active) return;
    const dx = e.clientX - this._startX; this._moved = Math.abs(dx);
    this._targetTX = this._startTX + dx;
    this._thumb.style.transition = 'none';
    if (!this._raf) this._raf = requestAnimationFrame(this._tick);
  }

  _onPointerUp() {
    if (!this._active) return;
    this._active = false; this._raf = 0;
    if (this._moved < 3) this._snap(!this._on);
    else this._snap(this._currentTX > this._endTX / 2);
    this._glassOff();
  }

  _onPointerLeave() {
    if (this._active) { this._active = false; this._glassOff(); }
  }

  _tick() {
    if (!this._active) { this._raf = 0; return; }
    const end = this._endTX, half = end / 2;
    let tx = this._targetTX;
    // Rubber band
    if (tx < 0) { const d = -tx; tx = -d / (1 + d * 0.10); }
    else if (tx > end) { const d = tx - end; tx = end + d / (1 + d * 0.10); }
    // Lerp damping
    this._currentTX = this._currentTX + (tx - this._currentTX) * 0.45;
    if (Math.abs(tx - this._currentTX) < 0.15) this._currentTX = tx;
    this._thumb.style.transform = 'translateX(' + this._currentTX + 'px) translateY(-50%) scale(0.96)';
    this._track.classList.toggle('on', this._currentTX > half);
    this._raf = requestAnimationFrame(this._tick);
  }
}
