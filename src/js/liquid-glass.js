/* ═══════════════════════════════════════════════════════
   LiquidGlass — 纯 CSS backdrop-filter 毛玻璃
   + 弹性弹簧跟踪 + 双层边框光照 + 高光反馈
   ═══════════════════════════════════════════════════════ */

let _panels = [];
let _mounted = false;

const DEFAULTS = {
  displacementScale: 70, blurAmount: 0.0625, saturation: 140,
  aberrationIntensity: 2, elasticity: 0.15, cornerRadius: 999,
  mode: 'standard', overLight: false, padding: '24px 32px',
  onClick: null, content: '', fixedX: null, fixedY: null,
  width: null, height: null,
};

class GlassPanel {
  static _id = 0;

  constructor(container, opts = {}) {
    this.container = container;
    this.id = ++GlassPanel._id;
    this.opts = { ...DEFAULTS, ...opts };
    this._mo = { x: 0, y: 0 };
    this._gm = { x: 0, y: 0 };
    this._hovered = false;
    this._active = false;
    this._raf = null;
    this._spring = {
      sx: { v: 1, vv: 0 }, sy: { v: 1, vv: 0 },
      tx: { v: 0, vv: 0 }, ty: { v: 0, vv: 0 },
      pulse: { v: 0, vv: 0 },
    };
    this._build();
    this._loop();
  }

  _build() {
    const o = this.opts, r = o.cornerRadius + 'px', bp = (o.overLight ? 12 : 4) + o.blurAmount * 32;

    this.el = document.createElement('div');
    this.el.style.cssText = `position:fixed;border-radius:${r};padding:${o.padding};overflow:hidden;pointer-events:auto;z-index:9999;backdrop-filter:blur(${bp}px) saturate(${o.saturation}%);-webkit-backdrop-filter:blur(${bp}px) saturate(${o.saturation}%);`;
    if (o.width) this.el.style.width = o.width;
    if (o.height) this.el.style.height = o.height;
    if (o.fixedX != null) {
      this.el.style.left = o.fixedX + 'px';
      this.el.style.top = (o.fixedY != null ? o.fixedY : 0) + 'px';
      this.el.style.transform = 'none';
    } else {
      this.el.style.top = '50%'; this.el.style.left = '50%';
      this.el.style.transform = 'translate(-50%,-50%)';
    }

    this._ct = document.createElement('div');
    this._ct.style.cssText = 'position:relative;z-index:2;color:#fff;';
    this._ct.innerHTML = o.content;
    this.el.appendChild(this._ct);

    this._bs = document.createElement('span');
    this._bs.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1.5px;z-index:1;mix-blend-mode:screen;opacity:0.2;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;`;
    this.el.appendChild(this._bs);

    this._bo = document.createElement('span');
    this._bo.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1.5px;z-index:1;mix-blend-mode:overlay;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;`;
    this.el.appendChild(this._bo);

    this._glow = document.createElement('div');
    this._glow.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;mix-blend-mode:overlay;z-index:3;opacity:0;transition:opacity .3s;background:radial-gradient(50% 0%,rgba(255,255,255,.5) 0%,transparent 50%);';
    this.el.appendChild(this._glow);

    const onMove = (e) => {
      this._gm.x = e.clientX; this._gm.y = e.clientY;
      const rc = this.el.getBoundingClientRect();
      this._mo = { x: ((e.clientX - rc.left - rc.width / 2) / rc.width) * 100, y: ((e.clientY - rc.top - rc.height / 2) / rc.height) * 100 };
    };
    this._onMove = onMove;
    window.addEventListener('mousemove', onMove, { passive: true });
    this.el.addEventListener('mouseenter', () => { this._hovered = true; this._glow.style.opacity = '0.5'; });
    this.el.addEventListener('mouseleave', () => { this._hovered = false; this._active = false; this._glow.style.opacity = '0'; });

    if (o.onClick) {
      this.el.style.cursor = 'pointer';
      this.el.addEventListener('mousedown', (e) => { e.stopPropagation(); this._active = true; this._spring.pulse.vv += 0.15; this._glow.style.opacity = '0.8'; });
      this.el.addEventListener('mouseup', (e) => { e.stopPropagation(); if (this._active && this._hovered) o.onClick(); this._active = false; this._glow.style.opacity = this._hovered ? '0.5' : '0'; });
    }

    this.container.appendChild(this.el);
  }

  _loop() {
    const K = 0.08, D = 0.75;
    const sp = (s, t) => { s.vv += (t - s.v) * K; s.vv *= D; s.v += s.vv; };

    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      if (!this.el || !this.el.isConnected) return;
      const o = this.opts, rc = this.el.getBoundingClientRect();
      const mx = this._gm.x, my = this._gm.y;
      if (mx === 0 && my === 0) return;

      const ex = mx < rc.left ? rc.left - mx : mx > rc.right ? mx - rc.right : 0;
      const ey = my < rc.top ? rc.top - my : my > rc.bottom ? my - rc.bottom : 0;
      const ed = Math.max(ex, ey), fade = ed > 200 ? 0 : 1 - ed / 200;
      const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      const cd = Math.hypot(mx - cx, my - cy), si = Math.min(cd / 300, 1) * o.elasticity * fade;
      const nx = (mx - cx) / (rc.width / 2), ny = (my - cy) / (rc.height / 2);

      sp(this._spring.sx, 1 + Math.abs(nx) * si * 0.3 - Math.abs(ny) * si * 0.15);
      sp(this._spring.sy, 1 + Math.abs(ny) * si * 0.3 - Math.abs(nx) * si * 0.15);
      sp(this._spring.tx, (mx - cx) * o.elasticity * 0.1 * fade);
      sp(this._spring.ty, (my - cy) * o.elasticity * 0.1 * fade);
      sp(this._spring.pulse, 0);

      const sX = this._spring.sx.v, sY = this._spring.sy.v;
      const tX = this._spring.tx.v, tY = this._spring.ty.v;
      const ps = 1 + this._spring.pulse.v * 0.07, as = this._active ? 0.96 : 1;

      if (o.fixedX != null && o.fixedY != null) {
        this.el.style.transform = `translate(${tX}px,${tY}px) scaleX(${sX * ps * as}) scaleY(${sY * ps * as})`;
      } else {
        this.el.style.transform = `translate(calc(-50% + ${tX}px),calc(-50% + ${tY}px)) scaleX(${sX * ps * as}) scaleY(${sY * ps * as})`;
      }

      const a = 135 + this._mo.x * 1.2;
      const h1 = Math.max(10, 33 + this._mo.y * 0.3), h2 = Math.min(90, 66 + this._mo.y * 0.4);
      const ax = Math.abs(this._mo.x);
      this._bs.style.background = `linear-gradient(${a}deg,rgba(255,255,255,0) 0%,rgba(255,255,255,${0.12 + ax * 0.008}) ${h1}%,rgba(255,255,255,${0.4 + ax * 0.012}) ${h2}%,rgba(255,255,255,0) 100%)`;
      this._bo.style.background = `linear-gradient(${a}deg,rgba(255,255,255,0) 0%,rgba(255,255,255,${0.32 + ax * 0.008}) ${h1}%,rgba(255,255,255,${0.6 + ax * 0.012}) ${h2}%,rgba(255,255,255,0) 100%)`;
    };
    this._raf = requestAnimationFrame(tick);
  }

  update(opts = {}) {
    Object.assign(this.opts, opts);
    const o = this.opts, bp = (o.overLight ? 12 : 4) + o.blurAmount * 32;
    this.el.style.backdropFilter = `blur(${bp}px) saturate(${o.saturation}%)`;
    this.el.style.WebkitBackdropFilter = `blur(${bp}px) saturate(${o.saturation}%)`;
    this.el.style.borderRadius = o.cornerRadius + 'px';
    if (opts.content !== undefined) this._ct.innerHTML = opts.content;
  }

  destroy() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    window.removeEventListener('mousemove', this._onMove);
    if (this.el) { this.el.remove(); this.el = null; }
  }
}

// ═══════════════════════════════════════════════════════
// 导出接口 (dev-panel.js 调用)
// ═══════════════════════════════════════════════════════

export function mountLiquidGlass(opts = {}) {
  if (_mounted) return;
  _mounted = true;

  // 信息卡
  const info = new GlassPanel(document.body, {
    ...opts,
    fixedX: (window.innerWidth / 2) - 320,
    fixedY: (window.innerHeight / 2) - 100,
    width: '280px',
    padding: '28px 32px',
    content: `<div style="text-align:center;">
      <h2 style="font-size:1.4rem;font-weight:600;margin:0 0 8px;letter-spacing:-0.02em;">Liquid Glass</h2>
      <p style="font-size:0.8rem;opacity:0.7;margin:0;line-height:1.5;">CSS backdrop-filter 毛玻璃<br>弹性形变 + 边框光照</p>
    </div>`,
  });

  // 按钮
  const btn = new GlassPanel(document.body, {
    ...opts,
    cornerRadius: 999,
    fixedX: (window.innerWidth / 2) + 40,
    fixedY: (window.innerHeight / 2) - 30,
    width: '140px',
    height: '48px',
    padding: '0 28px',
    content: '<span style="font-size:0.9rem;font-weight:500;display:flex;align-items:center;justify-content:center;height:100%;">Try It</span>',
    onClick: () => console.log('[LiquidGlass] clicked'),
  });

  _panels = [info, btn];
}

export function unmountLiquidGlass() {
  _panels.forEach(p => p.destroy());
  _panels = [];
  _mounted = false;
}

export function isLiquidGlassMounted() {
  return _mounted;
}
