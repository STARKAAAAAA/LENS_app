// ===== LENS Loading Shaders — 启动画面背景动画模块 =====
// 支持多种背景动画类型，通过 localStorage 'lens-loading-anim' 切换

import * as THREE from 'three';

// ── 动画类型注册表 ──

export const ANIMATION_TYPES = {
  'orbit-capsule':   { name: '光轨', type: 'css', description: '暖金色光点沿 SVG 胶囊轨道环绕，经典极简' },
  'shader-waves':    { name: '暗涌', type: 'webgl', description: '片元着色器同心波纹，色调跟随强调色预设' },
  'aurora':          { name: '极光', type: 'css', description: '纯 CSS 极光渐变飘移，多层混合模式 + 径向遮罩渐隐' },
  'shader-lines':    { name: '像素波纹', type: 'webgl', description: '像素化马赛克同心环纹 + 色道交换，随机偏移流动感' },
  'paper-shaders':   { name: '噪波辉光', type: 'webgl', description: '顶点位移波动 + 片元噪声混合 + 辉光衰减，有机质感' },
  'chroma-rgb':      { name: '色散波纹', type: 'webgl', description: 'RGB 三色道分离正弦波 + 色差畸变，chromatic aberration 效果' },
  'falling-pattern': { name: '落雨纹', type: 'css', description: '纯 CSS 径向渐变落雨图案 + 模糊叠加层，无限滚动' },
  'webgl-palette':   { name: '分形彩纹', type: 'webgl', description: '纯 WebGL 分形多层叠加 + 调色板函数 + 渐变覆盖' },
  'vol-aurora':      { name: '体积极光', type: 'webgl2d', description: '纯 WebGL 体积光线步进 32 层 + FBM 噪声，真实极光模拟' },
  'dither-ripple':   { name: '抖动波纹', type: 'webgl2d', description: 'WebGL2 新普森噪声 + 7 种图案 + Bayer 抖动，复古像素美学' },
  'wave-grid':       { name: '波浪网格', type: 'canvas2d', description: 'Canvas 2D 等距波浪网格 + 鼠标排斥力场，流畅交互' },
  'gradient-bars':   { name: '渐变柱阵', type: 'css', description: '纯 CSS 渐变柱脉冲 scaleY 动画，交错延迟呼吸感' },
};

export function getAnimationType() {
  return localStorage.getItem('lens-loading-anim') || 'shader-waves';
}

export function setAnimationType(type) {
  localStorage.setItem('lens-loading-anim', type);
}

// ── 每个预设的着色器配色（curated per-preset tint + intensity）──

const PRESET_TINTS = {
  '__default__':        { hex: '#c8a87c', intensity: 1.0  },
  '__apple__':          { hex: '#4499dd', intensity: 0.55 },
  '__apple-light__':    { hex: '#6699bb', intensity: 0.35 },
  '__apple-parchment__':{ hex: '#b8a080', intensity: 0.50 },
  '__ibm__':            { hex: '#5599dd', intensity: 0.65 },
  '__ibm-light__':      { hex: '#77aacc', intensity: 0.45 },
  '__bugatti__':        { hex: '#3366cc', intensity: 0.80 },
  '__bugatti-silver__': { hex: '#7799bb', intensity: 0.40 },
  '__warm__':           { hex: '#d4a060', intensity: 1.0  },
  '__cool__':           { hex: '#6699bb', intensity: 0.55 },
  '__contrast__':       { hex: '#ffffff', intensity: 0.22 },
  '__mono__':           { hex: '#aaaaaa', intensity: 0.15 },
  '__forest__':         { hex: '#669966', intensity: 0.60 },
  '__industrial__':     { hex: '#889999', intensity: 0.35 },
  '__mist__':           { hex: '#aabbcc', intensity: 0.20 },
  '__editorial__':      { hex: '#998877', intensity: 0.40 },
  '__terminal__':       { hex: '#33cc33', intensity: 0.85 },
  '__neon__':           { hex: '#ee44aa', intensity: 0.90 },
  '__paper__':          { hex: '#bbbbbb', intensity: 0.15 },
  '__void__':           { hex: '#666666', intensity: 0.10 },
  '__brutal__':         { hex: '#ee5533', intensity: 0.85 },
  '__liquid-glass__':   { hex: '#88bbdd', intensity: 0.50 },
};

function getAccentRgb() {
  try {
    const activeId = localStorage.getItem('lens-dev-active-preset');
    if (activeId && PRESET_TINTS[activeId]) {
      const t = PRESET_TINTS[activeId];
      const m = t.hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (m) return {
        r: parseInt(m[1],16)/255,
        g: parseInt(m[2],16)/255,
        b: parseInt(m[3],16)/255,
        intensity: t.intensity
      };
    }
    // 用户自定义预设 — 从 --accent 自动推导
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const m = accent.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (m) {
      const r = parseInt(m[1],16)/255, g = parseInt(m[2],16)/255, b = parseInt(m[3],16)/255;
      const sat = Math.max(r,g,b) - Math.min(r,g,b);
      return { r, g, b, intensity: 0.15 + sat * 0.85 };
    }
  } catch {}
  return { r: 0.78, g: 0.66, b: 0.49, intensity: 1.0 };
}

// ── 极光背景（纯 CSS）──

let _auroraStyleEl = null;

export function ensureAuroraCSS() {
  if (_auroraStyleEl) return;
  _auroraStyleEl = document.createElement('style');
  _auroraStyleEl.id = 'lens-aurora-css';
  _auroraStyleEl.textContent = `
    @keyframes aurora-drift {
      from { background-position: 50% 50%, 50% 50%; }
      to   { background-position: 350% 50%, 350% 50%; }
    }
    /* 极光主层：静态渐变 + 模糊 + 遮罩 */
    .hero-aurora-layer {
      position: absolute;
      inset: -10px;
      background-image: var(--aurora-dark), var(--aurora-color);
      background-size: 300%, 200%;
      background-position: 50% 50%, 50% 50%;
      filter: blur(10px);
      opacity: 0.5;
      will-change: transform;
      mask-image: radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%);
    }
    /* 极光伪元素：动画渐变 + 混合模式，产生流动干涉纹 */
    .hero-aurora-layer::after {
      content: '';
      position: absolute; inset: 0;
      background-image: var(--aurora-dark), var(--aurora-color);
      background-size: 200%, 100%;
      background-attachment: fixed;
      animation: aurora-drift 60s linear infinite;
      mix-blend-mode: difference;
    }
    /* 完整预览版 */
    .dev-aurora-preview {
      position: absolute; inset: 0;
      z-index: 1;
      background-image: var(--aurora-dark), var(--aurora-color);
      background-size: 300%, 200%;
      filter: blur(6px);
      opacity: 0.55;
      will-change: transform;
      mask-image: radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%);
    }
    .dev-aurora-preview::after {
      content: '';
      position: absolute; inset: 0;
      background-image: var(--aurora-dark), var(--aurora-color);
      background-size: 200%, 100%;
      background-attachment: fixed;
      animation: aurora-drift 60s linear infinite;
      mix-blend-mode: difference;
    }
    /* 卡片微缩版 */
    .dev-aurora-card {
      width: 100%; height: 100%;
      background-image: var(--aurora-dark), var(--aurora-color);
      background-size: 300%, 200%;
      filter: blur(4px);
      opacity: 0.55;
      will-change: transform;
      mask-image: radial-gradient(ellipse at 100% 0%, black 15%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at 100% 0%, black 15%, transparent 70%);
    }
    .dev-aurora-card::after {
      content: '';
      position: absolute; inset: 0;
      background-image: var(--aurora-dark), var(--aurora-color);
      background-size: 200%, 100%;
      background-attachment: fixed;
      animation: aurora-drift 60s linear infinite;
      mix-blend-mode: difference;
    }
  `;
  document.head.appendChild(_auroraStyleEl);
}

export function hexToHsl(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { h: 0, s: 0, l: 0 };
  let r = parseInt(m[1],16)/255, g = parseInt(m[2],16)/255, b = parseInt(m[3],16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    if (max === r) h = ((g-b)/d + (g<b?6:0)) / 6;
    else if (max === g) h = ((b-r)/d + 2) / 6;
    else h = ((r-g)/d + 4) / 6;
  }
  return { h: h*360, s: s*100, l: l*100 };
}

function hslToHex(h, s, l) {
  h = ((h%360)+360)%360 / 360;
  s /= 100; l /= 100;
  const hue2rgb = (p,q,t) => {
    if (t<0) t++; if (t>1) t--;
    if (t<1/6) return p+(q-p)*6*t;
    if (t<1/2) return q;
    if (t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  if (s===0) { const v=Math.round(l*255); return '#'+[v,v,v].map(v=>v.toString(16).padStart(2,'0')).join(''); }
  const q = l < 0.5 ? l*(1+s) : l+s-l*s;
  const p = 2*l - q;
  return '#'+[hue2rgb(p,q,h+1/3), hue2rgb(p,q,h), hue2rgb(p,q,h-1/3)]
    .map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
}

export function updateAuroraColors() {
  let accentHex = '#c8a87c';
  try {
    accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    if (!/^#/.test(accentHex)) accentHex = '#c8a87c';
  } catch {}
  const base = hexToHsl(accentHex);

  // 5 阶渐变：base → 更亮更饱和 → 偏冷偏移 → 偏暖偏移 → 更深
  const c1 = hslToHex(base.h, Math.min(base.s*0.8, 80), Math.min(base.l+28, 88));
  const c2 = hslToHex(base.h, Math.min(base.s*1.1, 90), Math.min(base.l+12, 78));
  const c3 = hslToHex((base.h+25)%360, Math.min(base.s*0.9, 75), Math.min(base.l+18, 82));
  const c4 = hslToHex((base.h-20+360)%360, Math.min(base.s*1.0, 85), base.l);
  const c5 = hslToHex(base.h, Math.min(base.s*0.7, 65), Math.max(base.l-15, 25));

  const root = document.documentElement.style;
  root.setProperty('--aurora-dark',
    `repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)`);
  root.setProperty('--aurora-color',
    `repeating-linear-gradient(100deg, ${c1} 10%, ${c2} 15%, ${c3} 20%, ${c4} 25%, ${c5} 30%)`);
}

export function createAuroraBackground(containerEl) {
  ensureAuroraCSS();
  updateAuroraColors();

  const layer = document.createElement('div');
  layer.className = 'hero-aurora-layer';
  containerEl.appendChild(layer);
  return layer;
}

export function disposeAuroraBackground(containerEl) {
  const layer = containerEl.querySelector('.hero-aurora-layer');
  if (layer) layer.remove();
}

// ── WebGL 着色器背景 ──

let _shaderRenderer = null;
let _shaderScene = null;
let _shaderCamera = null;
let _shaderUniforms = null;
let _shaderMaterial = null;
let _shaderGeometry = null;
let _shaderAnimationId = null;
let _shaderContainer = null;

// ── 着色器变体注册表 ──

const SHADER_VARIANTS = {
  'shader-waves': {
    vertex: `void main() { gl_Position = vec4(position, 1.0); }`,
    fragment: `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform vec3 tintColor;
      uniform float tintStrength;
      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.05;
        float lineWidth = 0.003;
        vec3 color = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            color[j] += lineWidth * float(i * i) / abs(
              fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0
              - length(uv) + mod(uv.x + uv.y, 0.2));
          }
        }
        float lum = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 tinted = lum * tintColor;
        gl_FragColor = vec4(mix(color, tinted, tintStrength), 1.0);
      }`
  },
  'shader-lines': {
    vertex: `void main() { gl_Position = vec4(position, 1.0); }`,
    fragment: `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform vec3 tintColor;
      uniform float tintStrength;
      float random (in float x) { return fract(sin(x)*1e4); }
      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        vec2 fMosaic = vec2(4.0, 2.0);
        vec2 vScreen = vec2(256.0, 256.0);
        uv.x = floor(uv.x * vScreen.x / fMosaic.x) / (vScreen.x / fMosaic.x);
        uv.y = floor(uv.y * vScreen.y / fMosaic.y) / (vScreen.y / fMosaic.y);
        float t = time * 0.06 + random(uv.x) * 0.4;
        float lineWidth = 0.0008;
        vec3 color = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) - length(uv));
          }
        }
        vec3 finalCol = vec3(color[2], color[1], color[0]);
        float lum = dot(finalCol, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(mix(finalCol, lum * tintColor, tintStrength), 1.0);
      }`
  },
  'paper-shaders': {
    vertex: `
      uniform float time;
      uniform float shaderIntensity;
      varying vec2 vUv;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vPosition = position;
        vec3 pos = position;
        pos.y += sin(pos.x * 10.0 + time) * 0.1 * shaderIntensity;
        pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * shaderIntensity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }`,
    fragment: `
      precision highp float;
      uniform float time;
      uniform float shaderIntensity;
      uniform vec3 tintColor;
      varying vec2 vUv;
      varying vec3 vPosition;
      void main() {
        vec2 uv = vUv;
        float noise = sin(uv.x * 20.0 + time * 0.1) * cos(uv.y * 15.0 + time * 0.1);
        noise += sin(uv.x * 35.0 - time * 0.1) * cos(uv.y * 25.0 + time * 0.1) * 0.5;
        vec3 color = mix(tintColor * 0.05, tintColor, noise * 0.5 + 0.5);
        color = mix(color, tintColor * 1.5, pow(abs(noise), 2.0) * shaderIntensity);
        float glow = 1.0 - length(uv - 0.5) * 2.0;
        glow = pow(glow, 2.0);
        gl_FragColor = vec4(color * glow, glow * 0.8);
      }`
  },
  'chroma-rgb': {
    vertex: `void main() { gl_Position = vec4(position, 1.0); }`,
    fragment: `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform vec3 tintColor;
      uniform float tintStrength;
      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
        float d = length(p) * 0.07;
        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);
        float r = 0.05 / abs(p.y + sin((rx + time * 0.3) * 1.0) * 0.5);
        float g = 0.05 / abs(p.y + sin((gx + time * 0.3) * 1.0) * 0.5);
        float b = 0.05 / abs(p.y + sin((bx + time * 0.3) * 1.0) * 0.5);
        vec3 col = vec3(r, g, b);
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(mix(col, lum * tintColor, tintStrength), 1.0);
      }`
  }
};

// 兼容旧代码 — 默认 fragment/vertex shader
const _defaultFrag = SHADER_VARIANTS['shader-waves'].fragment;
const _defaultVert = SHADER_VARIANTS['shader-waves'].vertex;
const fragmentShader = _defaultFrag;
const vertexShader   = _defaultVert;

export function createShaderBackground(containerEl, shaderId) {
  if (_shaderRenderer) return _shaderRenderer.domElement;
  const id = shaderId || 'shader-waves';
  const variant = SHADER_VARIANTS[id] || SHADER_VARIANTS['shader-waves'];

  _shaderContainer = containerEl;

  const camera = new THREE.Camera();
  camera.position.z = 1;
  _shaderCamera = camera;

  const scene = new THREE.Scene();
  _shaderScene = scene;

  // paper-shaders 需要更密的几何体来做顶点位移
  const isPaper = id === 'paper-shaders';
  const geometry = isPaper ? new THREE.PlaneGeometry(2, 2, 32, 32) : new THREE.PlaneGeometry(2, 2);
  _shaderGeometry = geometry;

  const accent = getAccentRgb();
  const uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
    tintColor: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
    tintStrength: { value: accent.intensity },
    shaderIntensity: { value: 1.0 },
  };
  _shaderUniforms = uniforms;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: variant.vertex,
    fragmentShader: variant.fragment,
    transparent: isPaper,
    side: isPaper ? THREE.DoubleSide : THREE.FrontSide,
  });
  _shaderMaterial = material;

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _shaderRenderer = renderer;

  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;background:#000;';

  // 初始大小
  const w = containerEl.clientWidth;
  const h = containerEl.clientHeight;
  renderer.setSize(w, h, false);
  uniforms.resolution.value.set(w * Math.min(window.devicePixelRatio, 2), h * Math.min(window.devicePixelRatio, 2));

  containerEl.insertBefore(canvas, containerEl.firstChild);

  // 自动 resize
  window.addEventListener('resize', resizeShaderBackground, { passive: true });

  return canvas;
}

export function startShaderAnimation() {
  if (!_shaderRenderer) return;

  const animate = () => {
    _shaderAnimationId = requestAnimationFrame(animate);
    if (_shaderUniforms) {
      _shaderUniforms.time.value += 0.05;
      if (_shaderUniforms.shaderIntensity) {
        _shaderUniforms.shaderIntensity.value = 1.0 + Math.sin(_shaderUniforms.time.value * 0.1) * 0.3;
      }
    }
    if (_shaderRenderer && _shaderScene && _shaderCamera) {
      _shaderRenderer.render(_shaderScene, _shaderCamera);
    }
  };

  animate();
}

export function stopShaderAnimation() {
  if (_shaderAnimationId) {
    cancelAnimationFrame(_shaderAnimationId);
    _shaderAnimationId = null;
  }
}

export function resizeShaderBackground() {
  if (!_shaderRenderer || !_shaderContainer) return;
  const w = _shaderContainer.clientWidth;
  const h = _shaderContainer.clientHeight;
  _shaderRenderer.setSize(w, h, false);
  if (_shaderUniforms) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    _shaderUniforms.resolution.value.set(w * dpr, h * dpr);
  }
}

export function disposeShaderBackground() {
  window.removeEventListener('resize', resizeShaderBackground);
  stopShaderAnimation();
  if (_shaderRenderer) {
    _shaderRenderer.dispose();
    if (_shaderRenderer.domElement && _shaderRenderer.domElement.parentNode) {
      _shaderRenderer.domElement.parentNode.removeChild(_shaderRenderer.domElement);
    }
    _shaderRenderer = null;
  }
  if (_shaderGeometry) { _shaderGeometry.dispose(); _shaderGeometry = null; }
  if (_shaderMaterial) { _shaderMaterial.dispose(); _shaderMaterial = null; }
  _shaderScene = null;
  _shaderCamera = null;
  _shaderUniforms = null;
  _shaderContainer = null;
}

// ── 纯 WebGL 背景（无 Three.js 依赖，用于 webgl-palette）──

export function createWebGLBackground(containerEl) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;background:#000;';
  containerEl.insertBefore(canvas, containerEl.firstChild);

  const gl = canvas.getContext('webgl');
  if (!gl) return { canvas, dispose: () => {} };

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }');
  gl.compileShader(vs);

  const accent = getAccentRgb();
  const tR = accent.r.toFixed(2), tG = accent.g.toFixed(2), tB = accent.b.toFixed(2);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_tint;
    vec3 palette(float t) {
      vec3 a = vec3(0.5,0.5,0.5); vec3 b = vec3(0.5,0.5,0.5);
      vec3 c = vec3(1.0,1.0,0.5); vec3 d = vec3(0.263,0.416,0.557);
      return a + b * cos(6.28318 * (c * t + d));
    }
    void main() {
      vec2 uv0 = gl_FragCoord.xy / u_resolution.xy;
      vec2 uv = uv0 * 2.0 - 1.0;
      uv.x *= u_resolution.x / u_resolution.y;
      vec3 col = vec3(0.0);
      for (float i = 0.0; i < 4.0; i++) {
        uv = fract(uv * 1.5) - 0.5;
        float d = length(uv) * exp(-length(uv0));
        vec3 pcol = palette(length(uv0) + i * 0.4 + u_time * 0.01);
        d = sin(d * 4.0 + u_time) / 36.0;
        d = pow(0.005 / abs(d), 1.5);
        col += pcol * d;
      }
      col = mix(col, col * u_tint, 0.45);
      vec3 grad = mix(u_tint * 0.2, u_tint * 0.85, uv0.y + sin(u_time) * 0.2);
      col = mix(col, grad, 0.4);
      gl_FragColor = vec4(col, 1.0);
    }
  `);
  gl.compileShader(fs);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  let animId = null;
  const dpr = Math.min(window.devicePixelRatio, 2);
  function resize() {
    const w = containerEl.clientWidth * dpr, h = containerEl.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const startTime = performance.now();
  const render = () => {
    animId = requestAnimationFrame(render);
    const t = (performance.now() - startTime) * 0.001;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), t);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_tint'), accent.r, accent.g, accent.b);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  render();

  return {
    canvas,
    dispose: () => {
      window.removeEventListener('resize', resize, { passive: true });
      if (animId) cancelAnimationFrame(animId);
      gl.deleteProgram(prog);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}

export function disposeWebGLBackground(containerOrHandle) {
  if (containerOrHandle && typeof containerOrHandle.dispose === 'function') {
    containerOrHandle.dispose();
    return;
  }
  const containerEl = containerOrHandle;
  if (!containerEl) return;
  const c = containerEl.querySelector('canvas');
  if (c) c.remove();
}

// ── 落雨纹 CSS 背景 ──

let _fallingStyleEl = null;

export function ensureFallingCSS() {
  if (_fallingStyleEl) return;
  _fallingStyleEl = document.createElement('style');
  _fallingStyleEl.id = 'lens-falling-css';
  _fallingStyleEl.textContent = `
    @keyframes falling-rain {
      0% { background-position: 0px 220px, 3px 220px, 151.5px 337.5px, 25px 24px, 28px 24px, 176.5px 150px, 50px 16px, 53px 16px, 201.5px 91px, 75px 224px, 78px 224px, 226.5px 230.5px, 100px 19px, 103px 19px, 251.5px 121px, 125px 120px, 128px 120px, 276.5px 187px, 150px 31px, 153px 31px, 301.5px 120.5px, 175px 235px, 178px 235px, 326.5px 384.5px, 200px 121px, 203px 121px, 351.5px 228.5px, 225px 224px, 228px 224px, 376.5px 364.5px, 250px 26px, 253px 26px, 401.5px 105px, 275px 75px, 278px 75px, 426.5px 180px; }
      100% { background-position: 0px 6800px, 3px 6800px, 151.5px 6917.5px, 25px 13632px, 28px 13632px, 176.5px 13758px, 50px 5416px, 53px 5416px, 201.5px 5491px, 75px 17175px, 78px 17175px, 226.5px 17301.5px, 100px 5119px, 103px 5119px, 251.5px 5221px, 125px 8428px, 128px 8428px, 276.5px 8495px, 150px 9876px, 153px 9876px, 301.5px 9965.5px, 175px 13391px, 178px 13391px, 326.5px 13540.5px, 200px 14741px, 203px 14741px, 351.5px 14848.5px, 225px 18770px, 228px 18770px, 376.5px 18910.5px, 250px 5082px, 253px 5082px, 401.5px 5161px, 275px 6375px, 278px 6375px, 426.5px 6480px; }
    }
    .hero-falling-layer {
      position: absolute; inset: 0;
      background-color: var(--falling-bg, #060605);
      background-image: var(--falling-pattern);
      background-size: var(--falling-sizes);
      animation: falling-rain 150s linear infinite;
      mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%);
    }
    .hero-falling-blur {
      position: absolute; inset: 0;
      backdrop-filter: blur(1em);
      -webkit-backdrop-filter: blur(1em);
      background: radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, var(--falling-bg, #060605) 2px);
      background-size: 8px 8px;
      z-index: 1;
    }
    .dev-falling-card {
      width: 100%; height: 100%;
      background-color: var(--falling-bg, #060605);
      background-image: var(--falling-pattern);
      background-size: var(--falling-sizes);
      animation: falling-rain 150s linear infinite;
      mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%);
    }
    .dev-falling-preview {
      position: absolute; inset: 0; z-index: 1;
      background-color: var(--falling-bg, #060605);
      background-image: var(--falling-pattern);
      background-size: var(--falling-sizes);
      animation: falling-rain 150s linear infinite;
      mask-image: radial-gradient(ellipse at center, black 20%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 80%);
    }
  `;
  document.head.appendChild(_fallingStyleEl);
}

export function buildFallingVars() {
  const accent = getAccentRgb();
  const hex = (r,g,b) => '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
  const c = hex(accent.r * 0.8, accent.g * 0.8, accent.b * 0.8);
  const patterns = [
    `radial-gradient(4px 100px at 0px 235px, ${c}, transparent)`,
    `radial-gradient(4px 100px at 300px 235px, ${c}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 117.5px, ${c} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 252px, ${c}, transparent)`,
    `radial-gradient(4px 100px at 300px 252px, ${c}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 126px, ${c} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 150px, ${c}, transparent)`,
    `radial-gradient(4px 100px at 300px 150px, ${c}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 75px, ${c} 100%, transparent 150%)`,
  ];
  // 简化为9层图案循环（与原版视觉等效）
  const allPatterns = [...patterns, ...patterns, ...patterns, ...patterns]; // 36 层
  const root = document.documentElement.style;
  root.setProperty('--falling-pattern', allPatterns.join(', '));
  root.setProperty('--falling-sizes', Array(36).fill('300px 300px').join(', '));
  root.setProperty('--falling-bg', `rgba(${Math.round(accent.r*255*0.1)},${Math.round(accent.g*255*0.1)},${Math.round(accent.b*255*0.1)},0.95)`);
}

export function createFallingBackground(containerEl) {
  ensureFallingCSS();
  buildFallingVars();
  const layer = document.createElement('div');
  layer.className = 'hero-falling-layer';
  containerEl.appendChild(layer);
  const blur = document.createElement('div');
  blur.className = 'hero-falling-blur';
  containerEl.appendChild(blur);
  return { layer, blur };
}

export function disposeFallingBackground(containerEl) {
  containerEl.querySelectorAll('.hero-falling-layer, .hero-falling-blur').forEach(el => el.remove());
}

// ── 抖动波纹 WebGL2 背景 ──

export function createDitherBackground(containerEl) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  containerEl.insertBefore(canvas, containerEl.firstChild);

  const gl = canvas.getContext('webgl2');
  if (!gl) { canvas.remove(); return { dispose() {} }; }

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, '#version 300 es\nlayout(location=0) in vec4 a_position; void main(){gl_Position=a_position;}');
  gl.compileShader(vs);

  const accent = getAccentRgb();
  const cR = accent.r.toFixed(2), cG = accent.g.toFixed(2), cB = accent.b.toFixed(2);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, `#version 300 es
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec3 u_color;
    out vec4 fragColor;

    float hash(vec2 p){p=fract(p*vec2(0.3183099,0.3678794))+0.1;p+=dot(p,p+19.19);return fract(p.x*p.y);}

    ${/* simplex noise */''}
    vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
    float snoise(vec2 v){
      const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
      vec2 i=floor(v+dot(v,C.yy));
      vec2 x0=v-i+dot(i,C.xx);
      vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
      vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
      i=mod(i,289.0);
      vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
      vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
      m=m*m;m=m*m;
      vec3 x=2.0*fract(p*C.www)-1.0;
      vec3 h=abs(x)-0.5;
      vec3 ox=floor(x+0.5);
      vec3 a0=x-ox;
      m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
      vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
      return 130.0*dot(m,g);
    }

    void main() {
      float t=0.5*u_time;
      vec2 uv=(gl_FragCoord.xy/u_resolution.xy)-0.5;
      vec2 suv=uv*0.003;
      for(float i=1.0;i<6.0;i++){suv.x+=0.6/i*cos(i*2.5*suv.y+t);suv.y+=0.6/i*cos(i*1.5*suv.x+t);}
      float shape=0.15/abs(sin(t-suv.y-suv.x));
      shape=smoothstep(0.02,1.0,shape);
      float noise=snoise(uv*4.0+vec2(0.0,t*0.3));
      float dither=step(hash(gl_FragCoord.xy),shape+noise*0.1);
      vec3 col=mix(u_color*0.02,u_color*0.7,dither);
      fragColor=vec4(col,1.0);
    }
  `);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { canvas.remove(); return { dispose() {} }; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uColor = gl.getUniformLocation(prog, 'u_color');
  const startT = performance.now();
  let animId;
  const dpr = Math.min(window.devicePixelRatio, 2);

  function resize() {
    canvas.width = containerEl.clientWidth * dpr; canvas.height = containerEl.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function render() {
    animId = requestAnimationFrame(render);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now()-startT)*0.001*1.2);
    gl.uniform3f(uColor, accent.r, accent.g, accent.b);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  render();

  return {
    dispose: () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteBuffer(buf);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}

// ── 渐变柱阵 CSS 背景 ──

let _gradientBarsStyleEl = null;

export function ensureGradientBarsCSS() {
  if (_gradientBarsStyleEl) return;
  _gradientBarsStyleEl = document.createElement('style');
  _gradientBarsStyleEl.id = 'lens-gradient-bars-css';
  _gradientBarsStyleEl.textContent = `
    @keyframes gradbar-pulse {
      0% { transform: scaleY(var(--bar-init)); }
      100% { transform: scaleY(calc(var(--bar-init) * 0.7)); }
    }
    .hero-gradbar-wrap {
      position: absolute; inset: 0;
      display: flex; height: 100%;
      opacity: 0.45;
    }
    .hero-gradbar-bar {
      flex: 1 0 calc(100% / var(--bar-count, 7));
      max-width: calc(100% / var(--bar-count, 7));
      height: 100%;
      transform-origin: bottom;
      animation: gradbar-pulse var(--bar-dur, 2s) ease-in-out infinite alternate;
    }
    .dev-gradbar-card {
      display: flex; height: 100%; width: 100%;
    }
    .dev-gradbar-card .dev-gradbar-bar-mini {
      flex: 1;
      height: 100%;
      transform-origin: bottom;
      animation: gradbar-pulse 2s ease-in-out infinite alternate;
    }
    .dev-gradbar-preview {
      position: absolute; inset: 0; z-index: 1;
      display: flex; height: 100%;
      opacity: 0.5;
    }
    .dev-gradbar-preview .dev-gradbar-bar {
      flex: 1;
      height: 100%;
      transform-origin: bottom;
      animation: gradbar-pulse 2s ease-in-out infinite alternate;
    }
  `;
  document.head.appendChild(_gradientBarsStyleEl);
}

export function createGradientBarsBackground(containerEl) {
  ensureGradientBarsCSS();
  const accent = getAccentRgb();
  const hex = (r,g,b) => '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
  const fromColor = hex(accent.r, accent.g, accent.b);
  const wrap = document.createElement('div');
  wrap.className = 'hero-gradbar-wrap';
  const count = 7;
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'hero-gradbar-bar';
    const pos = i / (count - 1);
    const distFromCenter = Math.abs(pos - 0.5);
    const h = 0.3 + Math.pow(distFromCenter * 2, 1.2) * 0.7;
    bar.style.cssText = `--bar-init:${h.toFixed(2)};--bar-dur:${2 + i * 0.1}s;animation-delay:${i * 0.1}s;background:linear-gradient(to top,${fromColor},transparent);`;
    wrap.appendChild(bar);
  }
  containerEl.appendChild(wrap);
  return wrap;
}

export function disposeGradientBarsBackground(containerEl) {
  const w = containerEl.querySelector('.hero-gradbar-wrap');
  if (w) w.remove();
}

// ── 波浪网格 Canvas 2D 背景 ──

export function createWaveGridBackground(containerEl) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  containerEl.insertBefore(canvas, containerEl.firstChild);

  const ctx = canvas.getContext('2d');
  const accent = getAccentRgb();
  const colorStr = `${Math.round(accent.r*255)},${Math.round(accent.g*255)},${Math.round(accent.b*255)}`;
  const mouse = { x: -1000, y: -1000, tx: -1000, ty: -1000 };
  let time = 0;
  const DENSITY = 40;

  function resize() {
    canvas.width = containerEl.clientWidth;
    canvas.height = containerEl.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function onMouse(e) {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left;
    mouse.ty = e.clientY - r.top;
  }
  function onLeave() { mouse.tx = mouse.ty = -1000; }
  window.addEventListener('mousemove', onMouse, { passive: true });
  window.addEventListener('mouseleave', onLeave);

  let animId = null;
  function draw() {
    animId = requestAnimationFrame(draw);
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    mouse.x += (mouse.tx - mouse.x) * 0.1;
    mouse.y += (mouse.ty - mouse.y) * 0.1;
    time += 0.01;

    const rows = Math.ceil(h / DENSITY) + 5, cols = Math.ceil(w / DENSITY) + 5;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `rgba(${colorStr},0)`);
    grad.addColorStop(0.5, `rgba(${colorStr},0.4)`);
    grad.addColorStop(1, `rgba(${colorStr},0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;

    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      let first = true;
      for (let x = 0; x <= cols; x++) {
        const bx = x * DENSITY - DENSITY * 2;
        const by = y * DENSITY - DENSITY * 2;
        const wave = Math.sin(x * 0.2 + time) * Math.cos(y * 0.2 + time) * 15;
        const dx = bx - mouse.x, dy = by - mouse.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const force = Math.max(0, (300-dist)/300);
        const iy = -(force*force) * 80;
        const fy = by + wave + iy;
        if (first) { ctx.moveTo(bx, fy); first = false; }
        else ctx.lineTo(bx, fy);
      }
      ctx.stroke();
    }
  }
  draw();

  return {
    dispose: () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseleave', onLeave);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };
}

// ── 体积极光 WebGL 背景 ──

export function createVolAuroraBackground(containerEl) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  containerEl.insertBefore(canvas, containerEl.firstChild);

  const gl = canvas.getContext('webgl');
  if (!gl) return { dispose() { canvas.remove(); } };

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }');
  gl.compileShader(vs);

  const accent = getAccentRgb();
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform vec3 uTint;
    #define MARCH_STEPS 16
    mat2 rot(float a) { float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
    float hash(vec2 p) { p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float fbm(vec3 p) {
      float f=0.0,amp=0.5;
      for(int i=0;i<5;i++) { f+=amp*hash(p.xy); p*=2.0; amp*=0.5; }
      return f;
    }
    float map(vec3 p) {
      vec3 q=p; q.z+=iTime*0.4;
      float f=fbm(q*2.0);
      f*=sin(p.y*2.0+iTime)*0.5+0.5;
      return clamp(f,0.0,1.0);
    }
    void main() {
      vec2 uv=(gl_FragCoord.xy-0.5*iResolution.xy)/iResolution.y;
      vec3 ro=vec3(0,-1,0),rd=normalize(vec3(uv,1.0)),col=vec3(0);
      float t=0.0;
      for(int i=0;i<MARCH_STEPS;i++) {
        vec3 p=ro+rd*t;
        float density=map(p);
        if(density>0.0) {
          vec3 ac=0.5+0.5*cos(iTime*0.5+p.y*2.0+vec3(0,2,4));
          col+=mix(ac,uTint,0.7)*density*0.08;
        }
        t+=0.2;
      }
      gl_FragColor=vec4(col,1.0);
    }
  `);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { canvas.remove(); return { dispose() { canvas.remove(); } }; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPosition');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'iResolution');
  const uTime = gl.getUniformLocation(prog, 'iTime');
  const uTint = gl.getUniformLocation(prog, 'uTint');
  const startT = performance.now();
  let animId;
  const dpr = Math.min(window.devicePixelRatio, 2);

  function resize() {
    canvas.width = containerEl.clientWidth * dpr; canvas.height = containerEl.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function render() {
    animId = requestAnimationFrame(render);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now()-startT)*0.001);
    gl.uniform3f(uTint, accent.r, accent.g, accent.b);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  render();

  return {
    dispose: () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };
}

// ── 预览用微型渲染器（dev panel）── 完全实例化，无全局状态

export function createMiniShaderPreview(parentEl, size, shaderId) {
  const s = size || 160;
  const id = shaderId || 'shader-waves';
  const variant = SHADER_VARIANTS[id] || SHADER_VARIANTS['shader-waves'];

  const camera = new THREE.Camera();
  camera.position.z = 1;

  const scene = new THREE.Scene();
  const isPaper = id === 'paper-shaders';
  const geometry = isPaper ? new THREE.PlaneGeometry(2, 2, 16, 16) : new THREE.PlaneGeometry(2, 2);

  const accent = getAccentRgb();
  const uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2(s, s) },
    tintColor: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
    tintStrength: { value: accent.intensity },
    shaderIntensity: { value: 1.0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: variant.vertex,
    fragmentShader: variant.fragment,
    transparent: isPaper,
    side: isPaper ? THREE.DoubleSide : THREE.FrontSide,
  });

  scene.add(new THREE.Mesh(geometry, material));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(1);

  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;border-radius:10px;';
  parentEl.appendChild(canvas);

  let animationId = null;

  function updateSize() {
    const w = parentEl.clientWidth;
    const h = parentEl.clientHeight;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h, false);
      uniforms.resolution.value.set(w, h);
    }
  }
  updateSize();

  const resizeObserver = new ResizeObserver(() => updateSize());
  resizeObserver.observe(parentEl);

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    uniforms.time.value += 0.05;
    if (uniforms.shaderIntensity) {
      uniforms.shaderIntensity.value = 1.0 + Math.sin(uniforms.time.value * 0.1) * 0.3;
    }
    renderer.render(scene, camera);
  };
  animate();

  return {
    canvas,
    dispose: () => {
      resizeObserver.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
