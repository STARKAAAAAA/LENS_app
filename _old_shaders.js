// ===== LENS Loading Shaders — 启动画面背景动画模块 =====
// 支持多种背景动画类型，通过 localStorage 'lens-loading-anim' 切换

import * as THREE from 'three';

// ── 动画类型注册表 ──

export const ANIMATION_TYPES = {
  'orbit-capsule': { name: '光轨', type: 'css', description: '暖金色光点沿 SVG 胶囊轨道环绕，经典极简' },
  'shader-waves':  { name: '暗涌', type: 'webgl', description: '片元着色器同心波纹，色调跟随强调色预设' },
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

// ── WebGL 着色器背景 ──

let _shaderRenderer = null;
let _shaderScene = null;
let _shaderCamera = null;
let _shaderUniforms = null;
let _shaderMaterial = null;
let _shaderGeometry = null;
let _shaderAnimationId = null;
let _shaderContainer = null;

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  #define TWO_PI 6.2831853072
  #define PI 3.14159265359

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
          - length(uv)
          + mod(uv.x + uv.y, 0.2)
        );
      }
    }

    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 tinted = lum * tintColor;
    gl_FragColor = vec4(mix(color, tinted, tintStrength), 1.0);
  }
`;

export function createShaderBackground(containerEl) {
  if (_shaderRenderer) return _shaderRenderer.domElement;

  _shaderContainer = containerEl;

  const camera = new THREE.Camera();
  camera.position.z = 1;
  _shaderCamera = camera;

  const scene = new THREE.Scene();
  _shaderScene = scene;

  const geometry = new THREE.PlaneGeometry(2, 2);
  _shaderGeometry = geometry;

  const accent = getAccentRgb();
  const uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
    tintColor: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
    tintStrength: { value: accent.intensity },
  };
  _shaderUniforms = uniforms;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
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

// ── 预览用微型渲染器（dev panel）──

let _previewRenderer = null;
let _previewAnimationId = null;
let _previewUniforms = null;

export function createMiniShaderPreview(parentEl, size) {
  const s = size || 160;

  const camera = new THREE.Camera();
  camera.position.z = 1;

  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);

  const accent = getAccentRgb();
  const uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2(s, s) },
    tintColor: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
    tintStrength: { value: accent.intensity },
  };
  _previewUniforms = uniforms;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });

  scene.add(new THREE.Mesh(geometry, material));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(1);
  _previewRenderer = renderer;

  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;border-radius:10px;';
  parentEl.appendChild(canvas);

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
    _previewAnimationId = requestAnimationFrame(animate);
    uniforms.time.value += 0.05;
    renderer.render(scene, camera);
  };
  animate();

  return {
    canvas,
    dispose: () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(_previewAnimationId);
      _previewAnimationId = null;
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      _previewRenderer = null;
      _previewUniforms = null;
    },
  };
}
