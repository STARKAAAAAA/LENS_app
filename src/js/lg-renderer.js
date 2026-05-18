/* ═══════════════════════════════════════════════════════
   LG-Renderer — Vanilla JS 移植自 liquid-glass-studio
   MultiPassRenderer / FrameBuffer / RenderPass / ShaderProgram
   ═══════════════════════════════════════════════════════ */

class ShaderProgram {
  constructor(gl, source) {
    this.gl = gl;
    this.uniforms = new Map();
    this.attributes = new Map();
    this.program = this._create(source);
    this._detect();
  }

  _compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`Shader error: ${err}`);
    }
    return s;
  }

  _create(source) {
    const gl = this.gl;
    const p = gl.createProgram();
    const vs = this._compile(gl.VERTEX_SHADER, source.vertex);
    const fs = this._compile(gl.FRAGMENT_SHADER, source.fragment);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(`Link error: ${err}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  _detect() {
    const gl = this.gl, p = this.program;
    const nAttr = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < nAttr; i++) {
      const info = gl.getActiveAttrib(p, i);
      if (info) this.attributes.set(info.name, { location: gl.getAttribLocation(p, info.name), size: info.size, type: info.type });
    }
    const nUni = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nUni; i++) {
      const info = gl.getActiveUniform(p, i);
      if (!info) continue;
      const loc = gl.getUniformLocation(p, info.name);
      if (!loc) continue;
      const arrMatch = info.name.match(/\[\d+\]$/);
      this.uniforms.set(arrMatch ? info.name.replace(arrMatch[0], '') : info.name, {
        location: loc, type: info.type, value: null,
        isArray: arrMatch ? { size: info.size } : false,
      });
    }
  }

  use() { this.gl.useProgram(this.program); }

  setUniform(name, value) {
    const gl = this.gl;
    const u = this.uniforms.get(name);
    if (!u) return;
    const loc = u.location;
    if (u.isArray && Array.isArray(value)) {
      switch (u.type) {
        case gl.FLOAT: gl.uniform1fv(loc, value); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(loc, value); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(loc, value); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(loc, value); break;
      }
    } else {
      switch (u.type) {
        case gl.FLOAT: gl.uniform1f(loc, value); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(loc, value); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(loc, value); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(loc, value); break;
        case gl.INT: case gl.SAMPLER_2D: gl.uniform1i(loc, value); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(loc, false, value); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(loc, false, value); break;
      }
    }
  }

  getAttrLoc(name) { const a = this.attributes.get(name); return a ? a.location : -1; }

  dispose() {
    const gl = this.gl;
    const shaders = gl.getAttachedShaders(this.program);
    shaders?.forEach(s => gl.deleteShader(s));
    gl.deleteProgram(this.program);
    this.uniforms.clear();
    this.attributes.clear();
  }
}

class FrameBuffer {
  constructor(gl, w, h) {
    this.gl = gl; this.width = w; this.height = h;
    const { fbo, tex, depthTex } = this._create();
    this.fbo = fbo; this.texture = tex; this.depthTexture = depthTex;
  }

  _create() {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    const depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.width, this.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer incomplete');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fbo, tex, depthTex };
  }

  bind() { this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo); }
  unbind() { this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); }
  getTexture() { return this.texture; }

  resize(w, h) {
    this.width = w; this.height = h;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.texture);
    gl.deleteTexture(this.depthTexture);
  }
}

class RenderPass {
  constructor(gl, shaderSource, outputToScreen = false) {
    this.gl = gl;
    this.config = { name: '', shader: shaderSource };
    this.program = new ShaderProgram(gl, shaderSource);
    this.frameBuffer = outputToScreen ? null : new FrameBuffer(gl, gl.canvas.width, gl.canvas.height);
    this.vao = this._createVAO();
  }

  _createVAO() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = this.program.getAttrLoc('a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vao;
  }

  setConfig(cfg) { this.config = cfg; }

  render(uniforms = {}) {
    const gl = this.gl;
    if (this.frameBuffer) this.frameBuffer.bind();
    else gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.program.use();
    let texUnit = 0;
    for (const [name, value] of Object.entries(uniforms)) {
      if (value instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + texUnit);
        gl.bindTexture(gl.TEXTURE_2D, value);
        this.program.setUniform(name, texUnit);
        texUnit++;
      } else {
        this.program.setUniform(name, value);
      }
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    if (this.frameBuffer) this.frameBuffer.unbind();
  }

  getOutputTexture() { return this.frameBuffer ? this.frameBuffer.getTexture() : null; }
  resize(w, h) { if (this.frameBuffer) this.frameBuffer.resize(w, h); }

  dispose() {
    if (this.frameBuffer) this.frameBuffer.dispose();
    this.program.dispose();
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    const buf = gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.deleteBuffer(buf);
    gl.deleteVertexArray(this.vao);
  }
}

export class MultiPassRenderer {
  constructor(canvas, configs, opts = {}) {
    const gl = canvas.getContext('webgl2', { alpha: opts.alpha !== false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL 2 not supported');
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float not supported');
    this.gl = gl;
    this.passes = new Map();
    this.passesArray = [];
    this.globalUniforms = {};

    for (const [i, cfg] of configs.entries()) {
      const pass = new RenderPass(gl, cfg.shader, cfg.outputToScreen);
      pass.setConfig(cfg);
      this.passes.set(cfg.name, pass);
      this.passesArray[i] = pass;
    }
  }

  resize(w, h) { this.passesArray.forEach(p => p.resize(w, h)); }
  setUniform(name, value) { this.globalUniforms[name] = value; }
  setUniforms(uniforms) { Object.assign(this.globalUniforms, uniforms); }

  render(passUniforms) {
    this.passesArray.forEach((pass, i) => {
      const uniforms = { ...this.globalUniforms };
      if (passUniforms) {
        if (Array.isArray(passUniforms)) Object.assign(uniforms, passUniforms[i]);
        else Object.assign(uniforms, passUniforms[pass.config.name] ?? {});
      }
      if (pass.config.inputs) {
        for (const [uniName, fromPassName] of Object.entries(pass.config.inputs)) {
          const fromPass = this.passes.get(fromPassName);
          uniforms[uniName] = fromPass?.getOutputTexture();
        }
      }
      pass.render(uniforms);
    });
  }

  dispose() {
    this.passes.forEach(p => p.dispose());
    this.passes.clear();
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

export function loadTexture(gl, url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = '';
    img.onload = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      resolve({ texture: tex, ratio: img.naturalWidth / img.naturalHeight });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function computeGaussianKernel(radius) {
  const sigma = radius / 3;
  const kernel = [];
  let sum = 0;
  for (let i = 0; i <= radius; i++) {
    const w = Math.exp(-0.5 * (i * i) / (sigma * sigma));
    kernel.push(w);
    sum += i === 0 ? w : w * 2;
  }
  return kernel.map(w => w / sum);
}
