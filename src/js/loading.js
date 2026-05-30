// ========== 加载画面系统 ==========

import { getAnimationType, createShaderBackground, startShaderAnimation, disposeShaderBackground, createAuroraBackground, disposeAuroraBackground, createWebGLBackground, createFallingBackground, disposeFallingBackground, createGradientBarsBackground, disposeGradientBarsBackground, createWaveGridBackground, createVolAuroraBackground, createDitherBackground } from './loading-shaders.js';

export const PHOTO_QUOTES = [
  '摄影是光的诗歌，影是时间的印记',
  '每一帧光影，皆是时间的切片',
  '相机是双眼的延伸，镜头是心灵的窗',
  '按下快门的瞬间，永恒被凝固',
  '好的照片不在于看见什么，而在于如何看见',
  '光影之间，藏着一个世界',
  '最美的画面，往往在等待中出现',
  '摄影教会我们，用心去观察世界',
];

let loadingAnimFrame = null;
let loadingQuoteInterval = null;
let loadingQuoteStartTimeout = null;
let loadingShownAt = 0;
let loadingScreenDoneResolve = null;

export async function showLoadingScreen(msg, { onFirstShow } = {}) {
  let el = document.getElementById('loading-screen');
  if (!el) {
    // 从 :root 读取当前预设的字体和颜色
    const rootStyle = getComputedStyle(document.documentElement);
    const displayFont = rootStyle.getPropertyValue('--font-display').trim() || "'Cormorant Garamond', Georgia, serif";
    const fontWeight = rootStyle.getPropertyValue('--font-weight-display').trim() || '300';
    const loadingColor = rootStyle.getPropertyValue('--loading-color').trim() || 'rgba(220,200,180,0.55)';
    const loadingColorDim = rootStyle.getPropertyValue('--loading-color-dim').trim() || 'rgba(220,200,180,0.40)';
    const loadingColorSoft = rootStyle.getPropertyValue('--loading-color-soft').trim() || 'rgba(220,200,180,0.45)';
    // 读取圆角变量用于 SVG 胶囊圆角
    const pillRadius = parseFloat(rootStyle.getPropertyValue('--radius-pill').trim()) || 100;
    const svgRx = Math.min(pillRadius, 11); // SVG rect 高度 22px，最大圆角半径 11px

    el = document.createElement('div');
    el.id = 'loading-screen';
    Object.assign(el.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(6,6,5,0.9)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      opacity: '0',
      transition: 'opacity 0.5s ease',
    });

    // === 胶囊装载器（SVG 光环绕行） ===
    const capsuleWrap = document.createElement('div');
    capsuleWrap.id = 'loading-capsule-wrap';
    Object.assign(capsuleWrap.style, {
      position: 'relative',
      width: '208px', height: '44px',
      marginBottom: '2.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: '0', transform: 'scale(0.92)',
      transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
    });

    // 胶囊轨道（静态）
    const track = document.createElement('div');
    track.id = 'loading-track';
    Object.assign(track.style, {
      width: '160px', height: '6px',
      borderRadius: 'var(--radius-pill)',
      background: loadingColor,
      opacity: '0.18',
      position: 'relative',
      zIndex: '1',
    });

    // SVG 光环绕胶囊旋转
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'loading-orbit-svg';
    svg.setAttribute('width', '208');
    svg.setAttribute('height', '44');
    svg.setAttribute('viewBox', '0 0 208 44');
    svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;';

    // 发光滤镜
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    filter.id = 'orbit-glow-filter';
    filter.innerHTML = '<feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>';
    defs.appendChild(filter);
    svg.appendChild(defs);

    // 绕行轨道（暗淡底轨）
    const trackPath = document.createElementNS(svgNS, 'rect');
    trackPath.setAttribute('x', '16'); trackPath.setAttribute('y', '11');
    trackPath.setAttribute('width', '176'); trackPath.setAttribute('height', '22');
    trackPath.setAttribute('rx', String(svgRx)); trackPath.setAttribute('ry', String(svgRx));
    // CSS 变量引用 — 实时跟随 --radius-pill 变更（CSS 属性覆盖 SVG attribute）
    trackPath.style.rx = `min(var(--radius-pill), 11px)`;
    trackPath.style.ry = `min(var(--radius-pill), 11px)`;
    trackPath.setAttribute('fill', 'none');
    trackPath.setAttribute('stroke', loadingColorDim);
    trackPath.setAttribute('stroke-width', '1');
    svg.appendChild(trackPath);

    // 绕行光点（stroke-dashoffset 动画，光点沿胶囊外沿绕行）
    const orbitLight = document.createElementNS(svgNS, 'rect');
    orbitLight.id = 'loading-orbit-light';
    orbitLight.setAttribute('x', '16'); orbitLight.setAttribute('y', '11');
    orbitLight.setAttribute('width', '176'); orbitLight.setAttribute('height', '22');
    orbitLight.setAttribute('rx', String(svgRx)); orbitLight.setAttribute('ry', String(svgRx));
    // CSS 变量引用 — 实时跟随 --radius-pill 变更
    orbitLight.style.rx = `min(var(--radius-pill), 11px)`;
    orbitLight.style.ry = `min(var(--radius-pill), 11px)`;
    orbitLight.setAttribute('fill', 'none');
    orbitLight.setAttribute('stroke', loadingColor);
    orbitLight.setAttribute('stroke-width', '1.5');
    orbitLight.setAttribute('stroke-dasharray', '28 430');
    orbitLight.setAttribute('stroke-dashoffset', '0');
    orbitLight.setAttribute('filter', 'url(#orbit-glow-filter)');
    orbitLight.setAttribute('stroke-linecap', 'round');
    svg.appendChild(orbitLight);

    capsuleWrap.appendChild(svg);
    capsuleWrap.appendChild(track);

    // 进度文字
    const text = document.createElement('div');
    text.id = 'loading-text';
    Object.assign(text.style, {
      fontFamily: displayFont,
      fontSize: '0.85rem', fontStyle: 'italic',
      fontWeight: fontWeight,
      letterSpacing: '0.12em', color: loadingColor,
      marginBottom: '0.6rem',
      opacity: '0', transform: 'translateY(10px)',
      transition: 'opacity 0.6s ease, transform 0.6s ease',
    });

    // 首次加载提示（带入场动画）
    const hint = document.createElement('div');
    hint.id = 'loading-hint';
    Object.assign(hint.style, {
      fontFamily: displayFont,
      fontSize: '0.72rem', fontStyle: 'italic',
      fontWeight: fontWeight,
      letterSpacing: '0.08em', color: loadingColorDim,
      marginBottom: '2.5rem', display: 'none',
      opacity: '0', transform: 'translateY(8px)',
      transition: 'opacity 0.8s ease, transform 0.8s ease',
    });

    // 轮播金句（底部居中，暖金半透明）
    const quote = document.createElement('div');
    quote.id = 'loading-quote';
    Object.assign(quote.style, {
      position: 'absolute', bottom: '14vh', left: '50%',
      transform: 'translateX(-50%) translateY(10px)',
      fontFamily: displayFont,
      fontSize: '1rem', fontStyle: 'italic',
      fontWeight: fontWeight,
      letterSpacing: '0.1em', color: loadingColorSoft,
      textAlign: 'center', whiteSpace: 'nowrap',
      opacity: '0',
      transition: 'opacity 0.8s ease, transform 0.8s ease',
      maxWidth: '80vw',
    });

    el.appendChild(capsuleWrap);
    el.appendChild(text);
    el.appendChild(hint);
    el.appendChild(quote);
    document.body.appendChild(el);

    // 首次创建时回调（例如创建侧边栏缓存区）
    if (onFirstShow) onFirstShow();
  }

  el.style.display = 'flex';
  el.style.opacity = '1';
  document.getElementById('loading-text').textContent = msg;
  loadingShownAt = Date.now();

  // 动画：SVG 光点绕胶囊外沿旋转
  if (!loadingAnimFrame) {
    const orbitLight = document.getElementById('loading-orbit-light');
    let orbitOffset = 0;
    const animate = () => {
      orbitOffset = (orbitOffset - 0.9) % -458;
      if (orbitLight) orbitLight.setAttribute('stroke-dashoffset', String(Math.round(orbitOffset)));
      loadingAnimFrame = requestAnimationFrame(animate);
    };
    loadingAnimFrame = requestAnimationFrame(animate);
  }

  // 摄影金句轮播（入场动画完成后开始）
  if (!loadingQuoteInterval) {
    const quoteEl = document.getElementById('loading-quote');
    let quoteIdx = 0;
    quoteEl.textContent = PHOTO_QUOTES[0];
    // 不等入场动画，直接设为可见（入场动画在 450ms 后才触发）
    // 1.5s 后切换轮播过渡模式并开始循环
    loadingQuoteStartTimeout = setTimeout(() => {
      quoteEl.style.transition = 'opacity 1.2s ease';
      loadingQuoteInterval = setInterval(() => {
        quoteEl.style.opacity = '0';
        setTimeout(() => {
          quoteIdx = (quoteIdx + 1) % PHOTO_QUOTES.length;
          quoteEl.textContent = PHOTO_QUOTES[quoteIdx];
          quoteEl.style.opacity = '1';
        }, 1200);
      }, 4500);
    }, 1500);
  }

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise(r => setTimeout(r, 50));

  // 逐层入场动画
  const capsule = document.getElementById('loading-capsule-wrap');
  const text = document.getElementById('loading-text');
  const hint = document.getElementById('loading-hint');
  const quote = document.getElementById('loading-quote');

  // 1. 胶囊先出现
  requestAnimationFrame(() => {
    if (capsule) { capsule.style.opacity = '1'; capsule.style.transform = 'scale(1)'; }
  });

  // 2. 进度文字延迟 200ms
  setTimeout(() => {
    if (text) { text.style.opacity = '1'; text.style.transform = 'translateY(0)'; }
  }, 200);

  // 3. 金句延迟 450ms
  setTimeout(() => {
    if (quote) {
      quote.style.opacity = '1';
      quote.style.transform = 'translateX(-50%) translateY(0)';
    }
  }, 450);
}

export function updateLoadingScreen(msg) {
  const t = document.getElementById('loading-text');
  if (t) t.textContent = msg;
}

export function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (!el) {
    // 如果 loading-screen 已被移除，返回已解决的 Promise
    if (loadingScreenDoneResolve) { loadingScreenDoneResolve(); loadingScreenDoneResolve = null; }
    return Promise.resolve();
  }
  // 防止旧 Promise 悬挂：先 resolve 旧 Promise
  if (loadingScreenDoneResolve) { loadingScreenDoneResolve(); loadingScreenDoneResolve = null; }
  const elapsed = Date.now() - loadingShownAt;
  const delay = Math.max(0, 600 - elapsed);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      if (el.parentNode) el.remove();
      if (loadingAnimFrame) { cancelAnimationFrame(loadingAnimFrame); loadingAnimFrame = null; }
      if (loadingQuoteStartTimeout) { clearTimeout(loadingQuoteStartTimeout); loadingQuoteStartTimeout = null; }
      if (loadingQuoteInterval) { clearInterval(loadingQuoteInterval); loadingQuoteInterval = null; }
      if (loadingScreenDoneResolve) { loadingScreenDoneResolve(); loadingScreenDoneResolve = null; }
      disposeShaderBackground();
    }, 400);
  }, delay);
  return new Promise(r => { loadingScreenDoneResolve = r; });
}

// ========== 启动动画：单个 rAF 循环同步驱动所有元素 ==========
let _startupAnimating = false;

export function playStartupSequence({ onDone } = {}) {
  if (_startupAnimating) return;
  _startupAnimating = true;
  // 启动动画期间隐藏所有面板和 UI chrome（直接改内联样式，不注入 CSS 避免白屏）
  const panelsToHide = ['.toolbar', '.sidebar-frame', '.sidebar-trigger', '.titlebar__controls', '.back-to-top', '.hero__scroll', '.hero__beta'];
  const hiddenEls = [];
  panelsToHide.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      hiddenEls.push(el);
    });
  });

  const reveal = document.querySelector('.hero__reveal');
  const title = document.querySelector('.hero__title');
  const subtitle = document.querySelector('.hero__subtitle');
  const scroll = document.querySelector('.hero__scroll');
  const hero = document.querySelector('.hero');

  const start = performance.now();
  const DURATION = 2400;

  // 背景动画：插入 hero 内部，位于 reveal(z-index:1) 下方
  // 同时隐藏 hero__slides 和 hero__overlay 防止叠层
  let bgWrap = null, _bgHandle = null;
  let _hiddenSlides = null, _hiddenOverlay = null;
  const animType = getAnimationType();
  const isCustomBg = animType !== 'orbit-capsule';
  if (isCustomBg && hero) {
    _hiddenSlides = hero.querySelector('.hero__slides');
    _hiddenOverlay = hero.querySelector('.hero__overlay');
    if (_hiddenSlides) _hiddenSlides.style.display = 'none';
    if (_hiddenOverlay) _hiddenOverlay.style.display = 'none';
    bgWrap = document.createElement('div');
    bgWrap.id = 'hero-bg-wrap';
    bgWrap.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;';
    hero.insertBefore(bgWrap, hero.firstChild);

    const webglTypes = ['shader-waves','shader-lines','paper-shaders','chroma-rgb'];
    if (webglTypes.includes(animType)) {
      createShaderBackground(bgWrap, animType);
      startShaderAnimation();
    } else if (animType === 'webgl-palette') {
      _bgHandle = createWebGLBackground(bgWrap);
    } else if (animType === 'vol-aurora') {
      _bgHandle = createVolAuroraBackground(bgWrap);
    } else if (animType === 'wave-grid') {
      _bgHandle = createWaveGridBackground(bgWrap);
    } else if (animType === 'aurora') {
      createAuroraBackground(bgWrap);
    } else if (animType === 'falling-pattern') {
      createFallingBackground(bgWrap);
    } else if (animType === 'gradient-bars') {
      createGradientBarsBackground(bgWrap);
    } else if (animType === 'dither-ripple') {
      _bgHandle = createDitherBackground(bgWrap);
    }
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function tick(now) {
    const raw = Math.min((now - start) / DURATION, 1);

    // 遮罩渐隐：0–50% 快速露出背景
    if (reveal) reveal.style.opacity = 1 - easeOut(Math.min(raw / 0.50, 1));

    // 标题淡入上移：5–55%
    const tT = Math.max(0, Math.min(1, (raw - 0.05) / 0.50));
    const et = easeOut(tT);
    if (title) {
      title.style.opacity = et;
      title.style.transform = `translateY(${(1 - et) * 40}px) scale(${1.05 - et * 0.05})`;
      const tL = Math.max(0, Math.min(1, (raw - 0.35) / 0.25));
      const el = easeOut(tL);
      title.style.setProperty('--line-scale', el);
      title.style.setProperty('--line-opacity', el);
    }

    // 副标题淡入：25–55%
    const tS = Math.max(0, Math.min(1, (raw - 0.25) / 0.30));
    const es = easeOut(tS);
    if (subtitle) {
      subtitle.style.opacity = es;
      subtitle.style.transform = `translateY(${(1 - es) * 20}px)`;
    }

    if (raw < 1) {
      requestAnimationFrame(tick);
    } else {
      // 背景动画渐隐后清理，恢复 slides/overlay
      if (bgWrap) {
        bgWrap.style.transition = 'opacity 0.6s ease';
        bgWrap.style.opacity = '0';
        setTimeout(() => {
          const webglTypes = ['shader-waves','shader-lines','paper-shaders','chroma-rgb'];
          if (webglTypes.includes(animType)) disposeShaderBackground();
          if (animType === 'webgl-palette' || animType === 'vol-aurora' || animType === 'wave-grid' || animType === 'dither-ripple') { if (_bgHandle) _bgHandle.dispose(); }
          if (animType === 'aurora') disposeAuroraBackground(bgWrap);
          if (animType === 'falling-pattern') disposeFallingBackground(bgWrap);
          if (animType === 'gradient-bars') disposeGradientBarsBackground(bgWrap);
          if (bgWrap.parentNode) bgWrap.parentNode.removeChild(bgWrap);
          if (_hiddenSlides) _hiddenSlides.style.display = '';
          if (_hiddenOverlay) _hiddenOverlay.style.display = '';
        }, 600);
      }
      moveTitleToCorner();
      hiddenEls.forEach(el => {
        el.style.removeProperty('visibility');
        el.style.removeProperty('opacity');
      });
      _startupAnimating = false;
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(tick);
}

export function moveTitleToCorner() {
  const title = document.querySelector('.hero__title');
  const content = document.querySelector('.hero__content');
  const scroll = document.querySelector('.hero__scroll');
  if (!title || title.classList.contains('hero__title--corner')) return;
  if (scroll) scroll.style.opacity = '1';
  if (content) content.classList.add('hero__content--corner');

  // 容器包裹 glow + logo，挂在侧边栏内自动跟随其 transform 动画
  const wrap = document.createElement('div'); wrap.id = 'corner-logo-wrap';
  Object.assign(wrap.style, {
    position:'absolute',left:'calc(100% + 10px)',top:'0',pointerEvents:'none'
  });

  const lensGlow = document.createElement('div'); lensGlow.id = 'lens-glow';
  Object.assign(lensGlow.style, {
    position:'absolute',left:'-22px',top:'2px',width:'110px',height:'44px',
    borderRadius:'var(--radius)',background:'var(--glass-bg)',
    backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',
    border:'0.5px solid var(--glass-border)',opacity:'0',transition:'opacity 0.8s ease',
    pointerEvents:'none',
    maskImage:'radial-gradient(ellipse 60% 55% at center, black 35%, transparent 100%)',
    WebkitMaskImage:'radial-gradient(ellipse 60% 55% at center, black 35%, transparent 100%)'
  });
  wrap.appendChild(lensGlow);

  const logoStyle = getComputedStyle(document.documentElement);
  const logoFont = logoStyle.getPropertyValue('--font-display').trim() || "'Cormorant Garamond', Georgia, serif";
  const logoWeight = logoStyle.getPropertyValue('--font-weight-display').trim() || '300';
  const logoSpacing = logoStyle.getPropertyValue('--letter-spacing-display').trim() || '0.05em';
  const logoColor = logoStyle.getPropertyValue('--corner-logo-color').trim() || 'rgba(220,200,175,0.85)';

  const logo = document.createElement('div'); logo.id = 'corner-logo'; logo.textContent = 'LENS Beta';
  Object.assign(logo.style, {
    position:'absolute',left:'0',top:'10px',
    WebkitAppRegion:'no-drag',
    fontFamily:logoFont,
    fontSize:'1.2rem',fontWeight:logoWeight,letterSpacing:logoSpacing,
    color:logoColor,
    cursor:'pointer',opacity:'0',scale:'0.8',
    transition:'opacity 0.5s cubic-bezier(0.16,1,0.2,1), scale 0.6s cubic-bezier(0.34,1.56,0.64,1), color 0.3s ease',
    userSelect:'none',WebkitUserSelect:'none',lineHeight:'1',padding:'4px 0',willChange:'opacity, scale',
    pointerEvents:'auto'
  });
  logo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  wrap.appendChild(logo);

  const sidebarFrame = document.getElementById('sidebar-frame');
  if (sidebarFrame) sidebarFrame.appendChild(wrap);
  else document.body.appendChild(wrap);

  requestAnimationFrame(() => { lensGlow.style.opacity = '1'; logo.style.opacity = '1'; logo.style.scale = '1'; });
  title.classList.add('hero__title--corner');
}
