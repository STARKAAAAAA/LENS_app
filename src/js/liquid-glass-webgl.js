/* ═══════════════════════════════════════════════════════
   LiquidGlass WebGL — SDF 折射 + 色散 + 菲涅尔 + Glare
   纯 WebGL 2.0，程序化光效，不依赖背景截屏
   ═══════════════════════════════════════════════════════ */

const VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_mouse;        // normalized mouse pos in panel space (-1..1)
uniform float u_time;
uniform float u_radius;      // corner radius in UV space
uniform float u_refraction;  // 0-1 refraction intensity
uniform float u_dispersion;  // 0-1 chromatic aberration
uniform float u_fresnel;     // 0-1 edge glow
uniform float u_glare;       // 0-1 glare intensity

// ── Hash ──
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// ── 2D value noise ──
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// ── FBM ──
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// ── SDF: Rounded box (superellipse) ──
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 uv = v_uv;
  vec2 center = vec2(0.5);
  vec2 p = uv - center;          // -0.5..0.5

  // ── Shape ──
  float r = u_radius;
  vec2 halfSize = vec2(0.5 - r);
  float dist = sdRoundBox(p, halfSize, r);

  // ── Edge gradient ──
  float edge = smoothstep(0.0, 0.02, dist);           // inside -> 0, outside -> 1
  float edgeNear = smoothstep(0.0, 0.08, dist);       // wider transition
  float edgeCenter = smoothstep(0.0, 0.04, dist);     // sharp edge

  // Clip outside
  if (dist > 0.03) discard;

  // ── Organic waviness ──
  float t = u_time * 0.3;
  float waveNoise = fbm(p * 6.0 + t) * 0.5 + fbm(p * 12.0 - t * 0.7) * 0.3;

  // ── Chromatic dispersion ──
  float dispersionStrength = u_dispersion * (1.0 - edgeCenter) * 0.04;
  float rShift = waveNoise * dispersionStrength;
  float bShift = waveNoise * (-dispersionStrength * 1.3);
  vec2 pR = p + vec2(rShift, 0.0);
  vec2 pB = p + vec2(bShift, 0.0);
  float distR = sdRoundBox(pR, halfSize, r);
  float distB = sdRoundBox(pB, halfSize, r);

  // ── Edge color sampling: R/G/B split at edges ──
  float edgeR = smoothstep(0.0, 0.06, max(distR, 0.0));
  float edgeG = smoothstep(0.0, 0.06, max(dist, 0.0));
  float edgeB = smoothstep(0.0, 0.06, max(distB, 0.0));

  // ── Glass body: very subtle dark tint ──
  vec3 color = vec3(0.04, 0.03, 0.06);
  float inner = smoothstep(0.06, 0.0, dist);
  color = mix(color, vec3(0.02), inner * 0.5);

  // ── Fresnel edge (thin warm rim) ──
  float fresnelStrength = pow(1.0 - edgeCenter, 3.0) * u_fresnel;
  vec3 fresnelColor = vec3(0.7, 0.55, 0.3);
  color = mix(color, fresnelColor, fresnelStrength * 0.5);

  // ── Edge dispersion colors (subtle) ──
  float edgeMix = (1.0 - edgeCenter) * (1.0 - edgeCenter) * u_dispersion * 0.15;
  color.r += edgeR * 0.3 * u_dispersion;
  color.g += edgeG * 0.15 * u_dispersion;
  color.b += edgeB * 0.2 * u_dispersion;

  // ── Glare (mouse spot) ──
  vec2 glarePos = u_mouse * 0.35;
  float glareDist = length(p - glarePos);
  float glare = exp(-glareDist * 15.0) * 0.35 * u_glare;
  color += vec3(0.9, 0.8, 0.6) * glare;

  // ── Animated shimmer ──
  float shimmer = fbm(p * 4.0 + t * 0.5) * 0.04 * u_refraction;
  color += shimmer;

  // ── Anti-alias ──
  float aa = 1.0 - smoothstep(-0.02, 0.01, dist);
  color *= aa;

  // ── Opacity: very low in center, visible at edges ──
  float alpha = 0.1 + (1.0 - edgeCenter) * 0.55 * u_fresnel;
  alpha += glare * 0.6;
  alpha = clamp(alpha, 0.05, 0.7);
  alpha *= aa;

  outColor = vec4(color, alpha);
}`;

export class LiquidGlassWebGL {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    if (!this.gl) {
      throw new Error('[LG-WebGL] WebGL 2 not available');
    }
    this.opts = {
      radius: 0.08, refraction: 0.7, dispersion: 0.6,
      fresnel: 0.8, glare: 0.6, ...opts,
    };
    this._mouse = { x: 0, y: 0 };
    this._started = false;
    this._compile();
  }

  _compile() {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[LG-WebGL]', gl.getShaderInfoLog(s));
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    this.prog = gl.createProgram();
    gl.attachShader(this.prog, vs);
    gl.attachShader(this.prog, fs);
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      console.error('[LG-WebGL] link error:', gl.getProgramInfoLog(this.prog));
    }

    this._uResolution = gl.getUniformLocation(this.prog, 'u_resolution');
    this._uMouse = gl.getUniformLocation(this.prog, 'u_mouse');
    this._uTime = gl.getUniformLocation(this.prog, 'u_time');
    this._uRadius = gl.getUniformLocation(this.prog, 'u_radius');
    this._uRefraction = gl.getUniformLocation(this.prog, 'u_refraction');
    this._uDispersion = gl.getUniformLocation(this.prog, 'u_dispersion');
    this._uFresnel = gl.getUniformLocation(this.prog, 'u_fresnel');
    this._uGlare = gl.getUniformLocation(this.prog, 'u_glare');

    // Full-screen quad
    this._vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    this._vao = gl.createVertexArray();
    gl.bindVertexArray(this._vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._t0 = performance.now();
    const tick = () => {
      if (!this._started) return;
      this._raf = requestAnimationFrame(tick);
      this._draw();
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this._started = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  setMouse(nx, ny) {
    // nx, ny: -1..1 normalized panel coords
    this._mouse.x = this._mouse.x * 0.85 + nx * 0.15;
    this._mouse.y = this._mouse.y * 0.85 + ny * 0.15;
  }

  update(opts) {
    Object.assign(this.opts, opts);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cw = w * dpr;
    const ch = h * dpr;
    if (this.canvas.width === cw && this.canvas.height === ch) return;
    this.canvas.width = cw;
    this.canvas.height = ch;
  }

  _draw() {
    const gl = this.gl;
    const c = this.canvas;
    this.resize();
    gl.viewport(0, 0, c.width, c.height);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    gl.useProgram(this.prog);
    gl.bindVertexArray(this._vao);

    gl.uniform2f(this._uResolution, c.width, c.height);
    gl.uniform2f(this._uMouse, this._mouse.x, this._mouse.y);
    gl.uniform1f(this._uTime, (performance.now() - this._t0) * 0.001);
    gl.uniform1f(this._uRadius, this.opts.radius);
    gl.uniform1f(this._uRefraction, this.opts.refraction);
    gl.uniform1f(this._uDispersion, this.opts.dispersion);
    gl.uniform1f(this._uFresnel, this.opts.fresnel);
    gl.uniform1f(this._uGlare, this.opts.glare);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    this.stop();
    if (this.gl) {
      const gl = this.gl;
      gl.deleteProgram(this.prog);
      gl.deleteVertexArray(this._vao);
      if (this._vbo) { gl.deleteBuffer(this._vbo); this._vbo = null; }
    }
  }
}
