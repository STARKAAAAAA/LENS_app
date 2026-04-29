import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';

const CONFIG_KEY = 'lens-photo-dir';
const SAVED_KEY = 'lens-saved-folders';

// ========== 配置管理 ==========
function loadDir() { return localStorage.getItem(CONFIG_KEY) || ''; }
function saveDir(dir) { localStorage.setItem(CONFIG_KEY, dir); }
function getSavedFolders() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; }
  catch { return []; }
}
function saveFolders(dirs) { localStorage.setItem(SAVED_KEY, JSON.stringify(dirs)); }

// ========== 选择文件夹 ==========
async function selectFolder() {
  const selected = await open({ directory: true, multiple: false, title: '选择照片文件夹' });
  return selected || null;
}

// ========== 扫描照片 ==========
async function scanPhotos(baseDir) {
  const photos = [];
  async function walk(dir) {
    let entries;
    try { entries = await readDir(dir); }
    catch (e) { console.error(`读取失败: ${dir}`, e); throw e; }
    for (const entry of entries) {
      const fullPath = await join(dir, entry.name);
      if (entry.isDirectory) { await walk(fullPath); }
      else if (entry.name.toLowerCase().endsWith('.jpg')) {
        const rel = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        const parts = rel.split(/[\\/]/);
        const topFolder = parts[0];
        const category = cleanCategory(topFolder);
        const title = cleanTitle(entry.name);
        photos.push({ src: convertFileSrc(fullPath), path: fullPath, category, title, folder: topFolder });
      }
    }
  }
  await walk(baseDir);
  photos.sort((a, b) => a.folder.localeCompare(b.folder, undefined, { numeric: true }));
  const categories = [...new Set(photos.map(p => p.category))];
  const byCategory = {};
  photos.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  return { categories, photos, byCategory };
}

function cleanCategory(dirname) {
  const m = dirname.match(/^\d{4}\s+\d{1,2}\s+\d{1,2}\s*(.*)/);
  return (m && m[1]) ? m[1].trim() : dirname.trim();
}
function cleanTitle(filename) {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/-DxO_DeepPRIME\s*XD2?s?/g, '');
  name = name.replace(/-CR3_DxO_DeepPRIMEXD/g, '');
  return name.trim();
}

// ========== 图片预加载工具 ==========
function preloadImages(imgs, onProgress) {
  let loaded = 0;
  const total = imgs.length;
  return Promise.all(imgs.map(img => {
    return new Promise(resolve => {
      if (img.complete) { loaded++; if (onProgress) onProgress(loaded, total); resolve(); return; }
      img.onload = () => { loaded++; if (onProgress) onProgress(loaded, total); resolve(); };
      img.onerror = () => { loaded++; if (onProgress) onProgress(loaded, total); resolve(); };
    });
  }));
}

// ========== App ==========
document.addEventListener('DOMContentLoaded', async () => {
  const heroSlidesEl = document.getElementById('hero-slides');
  const categoriesEl = document.getElementById('categories');
  const galleryEl = document.getElementById('gallery');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryInfo = document.getElementById('gallery-info');
  const galleryBack = document.getElementById('gallery-back');
  const sectionTitle = document.getElementById('section-title');
  const sidebarList = document.getElementById('sidebar-list');
  const sidebar = document.getElementById('sidebar');
  const sidebarTrigger = document.getElementById('sidebar-trigger');

  let data = { categories: [], photos: [], byCategory: {} };
  let photoDir = loadDir();
  let currentCategory = null;
  let currentPhotos = [];
  let sidebarHideTimer = null;
  let heroTimer = null;
  let heroAnimationDone = false;
  const appStartTime = performance.now();

  // ========== 侧边栏 ==========
  let logoTracking = null;
  let sidebarClicked = false;

  function trackLogo() {
    const logo = document.getElementById('corner-logo');
    const glow = document.getElementById('lens-glow');
    const sr = sidebar.getBoundingClientRect();
    const open = sidebar.classList.contains('sidebar--open') && sr.right > 20;
    if (!logo) { logoTracking = null; return; }
    if (!open) { logo.style.left = '28px'; if (glow) glow.style.left = '6px'; logoTracking = null; return; }
    const targetLeft = sr.right + 10;
    const delta = targetLeft - 28;
    logo.style.left = (28 + delta) + 'px';
    if (glow) glow.style.left = (6 + delta) + 'px';
    logoTracking = requestAnimationFrame(trackLogo);
  }

  function peekSidebar() {
    clearTimeout(sidebarHideTimer);
    if (!sidebarClicked) { sidebar.classList.add('sidebar--peek'); sidebarTrigger.style.pointerEvents = 'none'; }
  }
  function openSidebar() {
    clearTimeout(sidebarHideTimer);
    sidebarClicked = true;
    sidebar.classList.add('sidebar--open'); sidebar.classList.remove('sidebar--peek');
    sidebarTrigger.style.pointerEvents = 'none';
    cancelAnimationFrame(logoTracking);
    logoTracking = requestAnimationFrame(trackLogo);
  }
  function hideSidebarNow() {
    clearTimeout(sidebarHideTimer);
    sidebarClicked = false;
    sidebar.classList.remove('sidebar--open', 'sidebar--peek');
    sidebarTrigger.style.pointerEvents = 'auto';
    cancelAnimationFrame(logoTracking); logoTracking = null;
  }
  function hideSidebar() {
    sidebarHideTimer = setTimeout(() => {
      if (!sidebar.matches(':hover')) {
        sidebarClicked = false;
        sidebar.classList.remove('sidebar--open', 'sidebar--peek');
        sidebarTrigger.style.pointerEvents = 'auto';
        cancelAnimationFrame(logoTracking); logoTracking = null;
        const logo = document.getElementById('corner-logo');
        const glow = document.getElementById('lens-glow');
        if (logo) logo.style.left = '28px';
        if (glow) glow.style.left = '6px';
      }
    }, 500);
  }

  sidebarTrigger.addEventListener('mouseenter', peekSidebar);
  sidebar.addEventListener('click', (e) => {
    if (!sidebarClicked) { openSidebar(); }
    else if (e.target === sidebar || e.target.classList.contains('sidebar__list') || e.target.id === 'sidebar-list') { hideSidebarNow(); }
  });
  sidebar.addEventListener('mouseleave', hideSidebar);
  sidebarTrigger.addEventListener('mouseleave', () => {
    if (!sidebarClicked) {
      sidebarHideTimer = setTimeout(() => {
        if (!sidebar.matches(':hover')) { sidebar.classList.remove('sidebar--peek'); sidebarTrigger.style.pointerEvents = 'auto'; }
      }, 200);
    }
  });

  // ========== 侧边栏渲染 ==========
  function renderSidebar(activeDir) {
    const dirs = getSavedFolders();
    sidebarList.innerHTML = '';
    if (dirs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sidebar__empty';
      empty.textContent = '暂无文件夹\n点击下方按钮添加';
      sidebarList.appendChild(empty);
      return;
    }
    dirs.forEach(dir => {
      const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
      const isActive = dir === (activeDir || loadDir());
      const item = document.createElement('div');
      item.className = 'sidebar__item' + (isActive ? ' sidebar__item--active' : '');
      item.title = dir;
      item.innerHTML = `
        <svg class="sidebar__item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="sidebar__item-name">${name}</span>
        <span class="sidebar__item-remove">×</span>`;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('sidebar__item-remove')) return;
        if (dir === loadDir()) return;
        loadFromDir(dir);
      });
      item.querySelector('.sidebar__item-remove').addEventListener('click', (e) => { e.stopPropagation(); removeSavedFolder(dir); });
      sidebarList.appendChild(item);
    });
  }

  function addSavedFolder(dir) {
    const dirs = getSavedFolders();
    const normalized = dir.replace(/\\/g, '/');
    if (!dirs.some(d => d.replace(/\\/g, '/') === normalized)) { dirs.unshift(dir); saveFolders(dirs); }
    renderSidebar(dir);
  }
  function removeSavedFolder(dir) {
    const dirs = getSavedFolders();
    const idx = dirs.findIndex(d => d.replace(/\\/g, '/') === dir.replace(/\\/g, '/'));
    if (idx !== -1) dirs.splice(idx, 1);
    saveFolders(dirs);
    const current = loadDir();
    if (current.replace(/\\/g, '/') === dir.replace(/\\/g, '/')) {
      localStorage.removeItem(CONFIG_KEY); photoDir = '';
      if (dirs.length > 0) { loadFromDir(dirs[0]); }
      else {
        heroSlidesEl.innerHTML = ''; categoriesEl.innerHTML = '';
        galleryEl.style.display = 'none'; categoriesEl.style.display = 'grid';
        sectionTitle.textContent = 'Selected Works';
        updateDirLabel(''); renderSidebar();
      }
    } else { renderSidebar(); }
  }

  // ========== 加载画面 ==========
  let loadingAnimFrame = null;
  let loadingQuoteInterval = null;

  const PHOTO_QUOTES = [
    '摄影是光的诗歌，影是时间的印记',
    '每一帧光影，皆是时间的切片',
    '相机是双眼的延伸，镜头是心灵的窗',
    '按下快门的瞬间，永恒被凝固',
    '好的照片不在于看见什么，而在于如何看见',
    '光影之间，藏着一个世界',
    '最美的画面，往往在等待中出现',
    '摄影教会我们，用心去观察世界',
  ];

  async function showLoadingScreen(msg) {
    let el = document.getElementById('loading-screen');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-screen';
      Object.assign(el.style, {
        position: 'fixed', inset: '0', zIndex: '99999',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(6,6,5,0.9)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      });

      // === 胶囊装载器容器 ===
      const capsuleWrap = document.createElement('div');
      capsuleWrap.id = 'loading-capsule-wrap';
      Object.assign(capsuleWrap.style, {
        position: 'relative',
        width: '200px', height: '60px',
        marginBottom: '2.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      });

      // 胶囊轨道（暖金圆角长条）
      const track = document.createElement('div');
      track.id = 'loading-track';
      Object.assign(track.style, {
        width: '160px', height: '6px',
        borderRadius: '100px',
        background: 'rgba(200,168,124,0.12)',
        position: 'relative', overflow: 'hidden',
      });

      // 流光（内部移动光带）
      const shimmer = document.createElement('div');
      shimmer.id = 'loading-shimmer';
      Object.assign(shimmer.style, {
        position: 'absolute',
        top: '0', left: '0',
        width: '50%', height: '100%',
        borderRadius: '100px',
        background: 'linear-gradient(90deg, transparent, rgba(200,168,124,0.6), transparent)',
      });

      // 环绕眩光光环
      const glowRing = document.createElement('div');
      glowRing.id = 'loading-glow-ring';
      Object.assign(glowRing.style, {
        position: 'absolute', inset: '-8px',
        borderRadius: '100px',
        border: '1px solid transparent',
        borderTopColor: 'rgba(200,168,124,0.25)',
        borderRightColor: 'rgba(200,168,124,0.35)',
        borderBottomColor: 'rgba(200,168,124,0.15)',
        borderLeftColor: 'rgba(200,168,124,0.25)',
        filter: 'blur(0.5px)',
        boxShadow: '0 0 16px rgba(200,168,124,0.08), inset 0 0 8px rgba(200,168,124,0.03)',
      });

      track.appendChild(shimmer);
      capsuleWrap.appendChild(glowRing);
      capsuleWrap.appendChild(track);

      // 进度文字
      const text = document.createElement('div');
      text.id = 'loading-text';
      Object.assign(text.style, {
        fontFamily: "Cormorant Garamond, Georgia, serif",
        fontSize: '0.85rem', fontStyle: 'italic', fontWeight: '300',
        letterSpacing: '0.12em', color: 'rgba(220,200,180,0.55)',
        marginBottom: '0.6rem',
      });

      // 首次加载提示
      const hint = document.createElement('div');
      hint.id = 'loading-hint';
      Object.assign(hint.style, {
        fontFamily: "Cormorant Garamond, Georgia, serif",
        fontSize: '0.72rem', fontStyle: 'italic', fontWeight: '300',
        letterSpacing: '0.08em', color: 'rgba(220,200,180,0.3)',
        marginBottom: '2.5rem', display: 'none',
      });

      // 轮播金句
      const quote = document.createElement('div');
      quote.id = 'loading-quote';
      Object.assign(quote.style, {
        position: 'absolute', bottom: '16vh', left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: "Cormorant Garamond, Georgia, serif",
        fontSize: '1.05rem', fontStyle: 'italic', fontWeight: '300',
        letterSpacing: '0.08em', color: 'rgba(220,200,180,0.3)',
        textAlign: 'center', whiteSpace: 'nowrap',
        transition: 'opacity 1.2s ease',
        maxWidth: '80vw', overflow: 'hidden', textOverflow: 'ellipsis',
      });

      el.appendChild(capsuleWrap);
      el.appendChild(text);
      el.appendChild(hint);
      el.appendChild(quote);
      document.body.appendChild(el);
    }

    el.style.display = 'flex';
    el.style.opacity = '1';
    document.getElementById('loading-text').textContent = msg;
    loadingShownAt = Date.now();

    // 胶囊动画：流光左右移动 + 光环旋转
    if (!loadingAnimFrame) {
      const shimmer = document.getElementById('loading-shimmer');
      const glowRing = document.getElementById('loading-glow-ring');
      let pos = -60, dir = 1, deg = 0;
      const speed = 1.5;
      const animate = () => {
        pos += speed * dir;
        if (pos > 60) dir = -1;
        if (pos < -60) dir = 1;
        if (shimmer) shimmer.style.transform = `translateX(${pos}%)`;
        deg = (deg + 1.2) % 360;
        if (glowRing) glowRing.style.transform = `rotate(${deg}deg)`;
        loadingAnimFrame = requestAnimationFrame(animate);
      };
      loadingAnimFrame = requestAnimationFrame(animate);
    }

    // 摄影金句轮播
    if (!loadingQuoteInterval) {
      const quoteEl = document.getElementById('loading-quote');
      let quoteIdx = 0;
      quoteEl.textContent = PHOTO_QUOTES[0];
      quoteEl.style.opacity = '1';
      loadingQuoteInterval = setInterval(() => {
        quoteEl.style.opacity = '0';
        setTimeout(() => {
          quoteIdx = (quoteIdx + 1) % PHOTO_QUOTES.length;
          quoteEl.textContent = PHOTO_QUOTES[quoteIdx];
          quoteEl.style.opacity = '1';
        }, 1200);
      }, 4500);
    }

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise(r => setTimeout(r, 50));
  }
  function updateLoadingScreen(msg) {
    const t = document.getElementById('loading-text');
    if (t) t.textContent = msg;
  }
  let loadingShownAt = 0;

  function hideLoadingScreen() {
    const el = document.getElementById('loading-screen');
    if (!el) return;
    const elapsed = Date.now() - loadingShownAt;
    const delay = Math.max(0, 600 - elapsed);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        if (el.parentNode) el.remove();
        if (loadingAnimFrame) { cancelAnimationFrame(loadingAnimFrame); loadingAnimFrame = null; }
        if (loadingSpinnerInterval) { clearInterval(loadingSpinnerInterval); loadingSpinnerInterval = null; }
        if (loadingQuoteInterval) { clearInterval(loadingQuoteInterval); loadingQuoteInterval = null; }
      }, 400);
    }, delay);
  }

  // ========== 路径标签 ==========
  function updateDirLabel(dir) {
    let label = document.getElementById('dir-label');
    if (!label) { label = document.createElement('span'); label.id = 'dir-label'; document.body.appendChild(label); }
    label.textContent = dir;
  }

  // ========== 加载照片流程 ==========
  async function loadFromDir(dir) {
    categoriesEl.innerHTML = '';
    if (galleryEl.style.display !== 'none') galleryEl.style.display = 'none';
    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';
    document.querySelectorAll('.dir-prompt, .scan-error').forEach(el => el.remove());

    try {
      // 1. 扫描（不显示加载画面，让启动动画播放）
      data = await scanPhotos(dir);
      saveDir(dir); photoDir = dir;
      updateDirLabel(dir); addSavedFolder(dir);
      console.log(`扫描完成: ${data.photos.length} 张, ${data.categories.length} 个分类`);

      if (data.photos.length === 0) {
        showEmpty('该文件夹中没有找到 .jpg 照片'); return;
      }

      // 2. 首次启动：等启动动画播完再显示加载画面
      if (!heroAnimationDone) {
        const elapsed = performance.now() - appStartTime;
        if (elapsed < 2500) await new Promise(r => setTimeout(r, 2500 - elapsed));
        heroAnimationDone = true;
      }

      // 3. 显示加载画面 → 生成缩略图 → 预加载卡片
      const paths = data.photos.map(p => p.path);
      await showLoadingScreen(`正在生成缩略图... 0 / ${paths.length}`);

      let firstLoadHintShown = false;
      const unlisten = await listen('thumbnail-progress', (event) => {
        const { current, total, fresh } = event.payload;
        updateLoadingScreen(`正在生成缩略图... ${current} / ${total}`);
        // 超过三分之一是全新生成 → 显示首次加载提示
        if (!firstLoadHintShown && fresh > 0 && fresh > total * 0.3) {
          firstLoadHintShown = true;
          const hint = document.getElementById('loading-hint');
          if (hint) { hint.textContent = '首次加载需要生成预览图，下次打开将秒开'; hint.style.display = 'block'; }
        }
      });
      const thumbMap = await invoke('generate_thumbnails', { paths });
      unlisten();

      let thumbHits = 0;
      data.photos.forEach(p => {
        const tp = thumbMap[p.path];
        if (tp) { p.thumbSrc = convertFileSrc(tp); thumbHits++; }
      });
      console.log(`缩略图缓存: ${thumbHits} / ${data.photos.length} 就绪`);

      // 预加载分类卡片
      updateLoadingScreen('正在加载分类...');
      buildCategoryCardsDOM();
      const cardImgs = categoriesEl.querySelectorAll('img');
      await preloadImages(Array.from(cardImgs), (n, t) => {
        updateLoadingScreen(`正在加载分类... ${n} / ${t}`);
      });

      hideLoadingScreen();
      await rebuildHero(data.photos);
      categoriesEl.style.display = 'grid';
    } catch (e) {
      hideLoadingScreen();
      console.error('扫描失败:', e);
      showError(`无法读取文件夹: ${e.message || e}`);
    }
  }

  async function pickAndLoad() {
    const selected = await selectFolder();
    if (selected) { photoDir = selected; await loadFromDir(photoDir); }
  }

  function showEmpty(msg) {
    const div = document.createElement('div'); div.className = 'dir-prompt';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:#999;font-size:16px;z-index:9999;padding:40px;text-align:center;gap:1rem;';
    const btn = document.createElement('button');
    btn.textContent = '重新选择文件夹';
    btn.style.cssText = 'color:#f5f5f5;padding:0.6rem 1.5rem;border:1px solid #555;background:none;cursor:pointer;font-size:14px;';
    btn.addEventListener('click', () => { div.remove(); pickAndLoad(); });
    div.innerHTML = `<span>${msg}</span>`; div.appendChild(btn);
    document.body.appendChild(div);
  }
  function showError(msg) {
    const div = document.createElement('div'); div.className = 'scan-error';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:#ff4444;font-size:16px;z-index:9999;padding:40px;text-align:center;gap:1rem;';
    const btn = document.createElement('button');
    btn.textContent = '重新选择文件夹';
    btn.style.cssText = 'color:#f5f5f5;padding:0.6rem 1.5rem;border:1px solid #555;background:none;cursor:pointer;font-size:14px;';
    btn.addEventListener('click', () => { div.remove(); pickAndLoad(); });
    div.innerHTML = `<span>${msg}</span>`; div.appendChild(btn);
    document.body.appendChild(div);
  }

  // ========== 侧边栏按钮 ==========
  document.getElementById('sidebar-add').addEventListener('click', async () => {
    const selected = await selectFolder();
    if (selected) { await loadFromDir(selected); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  // ========== 启动 ==========
  const savedDirs = getSavedFolders();
  if (photoDir) {
    if (!savedDirs.some(d => d.replace(/\\/g, '/') === photoDir.replace(/\\/g, '/'))) { addSavedFolder(photoDir); }
    else { renderSidebar(photoDir); }
    updateDirLabel(photoDir);
    await loadFromDir(photoDir);
  } else if (savedDirs.length > 0) {
    await loadFromDir(savedDirs[0]);
  } else {
    renderSidebar();
    const selected = await selectFolder();
    if (selected) { await loadFromDir(selected); }
    else { showEmpty('请选择照片文件夹'); }
  }

  document.getElementById('tb-folder').addEventListener('click', async () => {
    const selected = await selectFolder();
    if (selected) { await loadFromDir(selected); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  initLightbox();
  initSlideshow();
  initParallax();
  initScrollReveal();

  // ========== Hero ==========
  async function rebuildHero(photos) {
    clearInterval(heroTimer); heroTimer = null;
    if (heroSlidesEl.children.length > 0) {
      heroSlidesEl.classList.add('hero__slides--out');
      await new Promise(r => setTimeout(r, 350));
      heroSlidesEl.classList.remove('hero__slides--out');
    }
    heroSlidesEl.innerHTML = '';
    if (!photos || photos.length === 0) return;
    const seen = new Set(); const selected = [];
    for (const p of photos) {
      const key = p.category || p.src;
      if (!seen.has(key) && selected.length < 6) { seen.add(key); selected.push(p); }
    }
    selected.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'hero__slide' + (i === 0 ? ' active' : '');
      div.style.backgroundImage = `url('${p.src}?full=1')`;
      heroSlidesEl.appendChild(div);
    });
    const slides = heroSlidesEl.querySelectorAll('.hero__slide');
    if (slides.length < 2) return;
    let cur = 0;
    heroTimer = setInterval(() => {
      slides[cur].classList.remove('active');
      cur = (cur + 1) % slides.length;
      slides[cur].classList.add('active');
    }, 6000);
    setTimeout(moveTitleToCorner, 2350);
  }

  function moveTitleToCorner() {
    const title = document.querySelector('.hero__title');
    const content = document.querySelector('.hero__content');
    const scroll = document.querySelector('.hero__scroll');
    if (!title || title.classList.contains('hero__title--corner')) return;
    if (scroll) scroll.style.opacity = '0';
    if (content) content.classList.add('hero__content--corner');

    const lensGlow = document.createElement('div'); lensGlow.id = 'lens-glow';
    Object.assign(lensGlow.style, {
      position:'fixed',zIndex:'497',left:'6px',top:'2px',width:'110px',height:'44px',
      borderRadius:'16px',background:'rgba(200,180,160,0.04)',
      backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',
      border:'0.5px solid rgba(200,180,160,0.06)',opacity:'0',transition:'opacity 0.8s ease',
      pointerEvents:'none',
      maskImage:'radial-gradient(ellipse 60% 55% at center, black 35%, transparent 100%)',
      WebkitMaskImage:'radial-gradient(ellipse 60% 55% at center, black 35%, transparent 100%)'
    });
    document.body.appendChild(lensGlow);

    const logo = document.createElement('div'); logo.id = 'corner-logo'; logo.textContent = 'LENS';
    Object.assign(logo.style, {
      position:'fixed',zIndex:'500',left:'28px',top:'10px',
      fontFamily:"var(--font-display), 'Cormorant Garamond', Georgia, serif",
      fontSize:'1.2rem',fontWeight:'300',letterSpacing:'0.18em',
      color:'rgba(220,200,175,0.85)',cursor:'pointer',opacity:'0',scale:'0.8',
      transition:'opacity 0.5s cubic-bezier(0.16,1,0.2,1), scale 0.6s cubic-bezier(0.34,1.56,0.64,1), color 0.3s ease',
      userSelect:'none',WebkitUserSelect:'none',lineHeight:'1',padding:'4px 0',willChange:'opacity, scale'
    });
    logo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(logo);

    requestAnimationFrame(() => { lensGlow.style.opacity = '1'; logo.style.opacity = '1'; logo.style.scale = '1'; });
    document.querySelector('.hero__slides')?.classList.add('hero__slides--clear');
    title.classList.add('hero__title--corner');
  }

  function initHero() { rebuildHero(data.photos); }

  // ========== 分类卡片（全部直接加载，无懒加载） ==========
  function buildCategoryCardsDOM() {
    categoriesEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    data.categories.forEach(cat => {
      const catPhotos = data.byCategory[cat] || [];
      const cover = catPhotos[0];
      if (!cover) return;
      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <img class="category-card__img" src="${cover.thumbSrc || cover.src}" alt="${cat}" decoding="async">
        <div class="category-card__label">
          <div class="category-card__label-name">${cat}</div>
          <div class="category-card__label-count">${catPhotos.length} 张</div>
        </div>
        <div class="category-card__info">
          <div class="category-card__name">${cat}</div>
          <div class="category-card__count">${catPhotos.length} photos</div>
        </div>`;
      card.addEventListener('click', () => openCategory(cat));
      fragment.appendChild(card);
    });
    categoriesEl.appendChild(fragment);
  }

  // ========== 画廊（全部预加载，加载完才显示） ==========
  let categoryTransitioning = false;

  async function openCategory(cat) {
    if (categoryTransitioning) return;
    categoryTransitioning = true;

    categoriesEl.classList.add('categories--out');
    await new Promise(r => setTimeout(r, 350));

    currentCategory = cat;
    currentPhotos = data.byCategory[cat] || [];
    sectionTitle.textContent = cat;
    categoriesEl.style.display = 'none';
    categoriesEl.classList.remove('categories--out');

    rebuildHero(currentPhotos);

    // 构建全部画廊 DOM
    galleryGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    currentPhotos.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'gallery__item';
      item.dataset.src = p.src;
      item.dataset.title = p.title;
      item.dataset.index = i;
      item.style.animationDelay = `${i * 0.02}s`;
      item.innerHTML = `
        <img src="${p.thumbSrc || p.src}" alt="${p.title}" decoding="async">
        <div class="gallery__item-overlay"><span class="gallery__item-title">${p.title}</span></div>`;
      fragment.appendChild(item);
    });
    galleryGrid.appendChild(fragment);
    galleryInfo.textContent = `${currentPhotos.length} 张照片`;

    // 预加载全部图片，完成后才显示
    await showLoadingScreen(`加载中... 0 / ${currentPhotos.length}`);
    const imgs = galleryGrid.querySelectorAll('img');
    await preloadImages(Array.from(imgs), (n, t) => {
      updateLoadingScreen(`加载中... ${n} / ${t}`);
    });
    hideLoadingScreen();

    galleryEl.classList.remove('gallery--out');
    galleryEl.style.display = 'block';

    categoryTransitioning = false;
    window.scrollTo({ top: galleryEl.offsetTop - 40, behavior: 'smooth' });
  }

  galleryBack.addEventListener('click', async () => {
    if (categoryTransitioning) return;
    categoryTransitioning = true;
    galleryEl.classList.add('gallery--out');
    await new Promise(r => setTimeout(r, 350));
    currentCategory = null;
    galleryEl.style.display = 'none';
    galleryEl.classList.remove('gallery--out');
    rebuildHero(data.photos);
    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';
    categoryTransitioning = false;
    window.scrollTo({ top: document.getElementById('portfolio').offsetTop - 40, behavior: 'smooth' });
  });

  // ========== Scroll Reveal ==========
  function initScrollReveal() {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.portfolio__title, .portfolio__desc').forEach(el => obs.observe(el));
  }

  // ========== Parallax ==========
  function initParallax() {
    const heroSlides = document.querySelector('.hero__slides');
    const heroH = document.querySelector('.hero').offsetHeight;
    let paraTicking = false;
    window.addEventListener('scroll', () => {
      if (!paraTicking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y < heroH) {
            heroSlides.style.transform = `translateY(${y * 0.3}px)`;
            heroSlides.style.opacity = 1 - (y / heroH) * 0.6;
          }
          paraTicking = false;
        });
        paraTicking = true;
      }
    }, { passive: true });
  }

  // ========== Lightbox ==========
  function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lbImg = lightbox.querySelector('.lightbox__img');
    const lbTitle = lightbox.querySelector('.lightbox__title');
    const lbCounter = lightbox.querySelector('.lightbox__counter');
    const btnClose = lightbox.querySelector('.lightbox__close');
    const btnPrev = lightbox.querySelector('.lightbox__prev');
    const btnNext = lightbox.querySelector('.lightbox__next');

    let items = [], idx = 0, transitioning = false;
    let zoom = 1, panX = 0, panY = 0;
    let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

    function applyLbTransform() { lbImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; }
    function resetZoom() { zoom = 1; panX = 0; panY = 0; lbImg.style.transform = ''; }

    function update() {
      const item = items[idx];
      if (!item) return;
      lbImg.style.opacity = '0';
      setTimeout(() => {
        resetZoom();
        lbImg.src = item.dataset.src + '?full=1';
        lbImg.alt = item.dataset.title;
        lbTitle.textContent = item.dataset.title;
        lbCounter.textContent = `${idx + 1} / ${items.length}`;
        lbImg.style.opacity = '1';
        transitioning = false;
      }, 180);
    }

    function open(index) {
      items = Array.from(galleryGrid.querySelectorAll('.gallery__item'));
      idx = index; transitioning = true; resetZoom();
      const item = items[idx];
      lbImg.src = item.dataset.src + '?full=1';
      lbTitle.textContent = item.dataset.title;
      lbCounter.textContent = `${idx + 1} / ${items.length}`;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => transitioning = false, 600);
    }
    function close() { lightbox.classList.remove('active'); document.body.style.overflow = ''; resetZoom(); }
    function prev() { if (!transitioning) { transitioning = true; idx = (idx - 1 + items.length) % items.length; update(); } }
    function next() { if (!transitioning) { transitioning = true; idx = (idx + 1) % items.length; update(); } }

    galleryGrid.addEventListener('click', e => {
      const item = e.target.closest('.gallery__item');
      if (!item) return;
      const all = Array.from(galleryGrid.querySelectorAll('.gallery__item'));
      const i = all.indexOf(item);
      if (i !== -1) open(i);
    });

    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);
    lightbox.addEventListener('click', e => { if (e.target === lightbox || e.target === lbImg.parentElement) close(); });

    lightbox.addEventListener('wheel', e => {
      if (!lightbox.classList.contains('active')) return;
      e.preventDefault();
      if (e.deltaY < 0) zoom = Math.min(zoom * 1.15, 8);
      else zoom = Math.max(zoom / 1.15, 0.5);
      if (zoom <= 1) { panX = 0; panY = 0; }
      applyLbTransform();
    }, { passive: false });

    lightbox.addEventListener('mousedown', e => {
      if (!lightbox.classList.contains('active') || e.button !== 0 || zoom <= 1) return;
      dragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
      panStartX = panX; panStartY = panY; e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = panStartX + (e.clientX - dragStartX); panY = panStartY + (e.clientY - dragStartY);
      applyLbTransform();
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    lbImg.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (zoom > 1) resetZoom(); else { zoom = 2.5; applyLbTransform(); }
    });

    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    let touchX = 0;
    lightbox.addEventListener('touchstart', e => { touchX = e.changedTouches[0].screenX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      if (Math.abs(e.changedTouches[0].screenX - touchX) > 60) {
        e.changedTouches[0].screenX > touchX ? prev() : next();
      }
    }, { passive: true });
  }

  // ========== Slideshow ==========
  function initSlideshow() {
    const slideshow = document.getElementById('slideshow');
    const img = document.getElementById('slideshow-img');
    const counter = document.getElementById('slideshow-counter');
    const btnPause = document.getElementById('sl-pause');
    const btnPrev = document.getElementById('sl-prev');
    const btnNext = document.getElementById('sl-next');
    const btnZoomIn = document.getElementById('sl-zoom-in');
    const btnZoomOut = document.getElementById('sl-zoom-out');
    const btnFit = document.getElementById('sl-fit');
    const btnOrig = document.getElementById('sl-orig');
    const btnExit = document.getElementById('sl-exit');

    let photos = [], idx = 0, paused = false, timer = null;
    let zoom = 1, panX = 0, panY = 0;
    let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
    let hideTimer = null;

    function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function applyTransform() { img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; }
    function fitToWindow() { zoom = 1; panX = 0; panY = 0; img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; applyTransform(); }

    function loadCurrent() {
      if (!photos.length) return;
      const p = photos[idx % photos.length];
      img.classList.add('slideshow__img--out');
      setTimeout(() => {
        img.src = p.src + '?full=1';
        counter.textContent = `${(idx % photos.length) + 1} / ${photos.length}`;
        fitToWindow();
        img.classList.remove('slideshow__img--out');
      }, 400);
    }

    function showControls() {
      slideshow.classList.add('controls-visible'); clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (!paused) slideshow.classList.remove('controls-visible'); }, 3000);
    }

    function openSlideshow() {
      if (!data.photos.length) return;
      photos = shuffle(data.photos); idx = 0; paused = false; zoom = 1; panX = 0; panY = 0;
      btnPause.textContent = '暂停';
      slideshow.classList.add('active'); loadCurrent();
      timer = setInterval(() => { if (!paused) { idx++; loadCurrent(); } }, 5000);
      showControls();
    }
    function closeSlideshow() { clearInterval(timer); slideshow.classList.remove('active'); }

    btnPrev.addEventListener('click', () => { idx = (idx - 1 + photos.length) % photos.length; loadCurrent(); showControls(); });
    btnNext.addEventListener('click', () => { idx++; loadCurrent(); showControls(); });
    btnPause.addEventListener('click', () => { paused = !paused; btnPause.textContent = paused ? '继续' : '暂停'; showControls(); });
    btnExit.addEventListener('click', closeSlideshow);
    btnZoomIn.addEventListener('click', () => { zoom = Math.min(zoom * 1.3, 6); applyTransform(); showControls(); });
    btnZoomOut.addEventListener('click', () => { zoom = Math.max(zoom / 1.3, 0.1); applyTransform(); showControls(); });
    btnFit.addEventListener('click', () => { fitToWindow(); showControls(); });
    btnOrig.addEventListener('click', () => { img.style.maxWidth = 'none'; img.style.maxHeight = 'none'; zoom = 1; panX = 0; panY = 0; applyTransform(); showControls(); });

    const imgWrap = document.querySelector('.slideshow__img-wrap');
    imgWrap.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.deltaY < 0) zoom = Math.min(zoom * 1.12, 6); else zoom = Math.max(zoom / 1.12, 0.1);
      applyTransform(); showControls();
    }, { passive: false });

    imgWrap.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      dragging = true; dragStartX = e.clientX; dragStartY = e.clientY; panStartX = panX; panStartY = panY;
    });
    window.addEventListener('mousemove', e => { if (!dragging) return; panX = panStartX + (e.clientX - dragStartX); panY = panStartY + (e.clientY - dragStartY); applyTransform(); });
    window.addEventListener('mouseup', () => { dragging = false; });
    imgWrap.addEventListener('dblclick', fitToWindow);

    document.addEventListener('keydown', e => {
      if (!slideshow.classList.contains('active')) return;
      if (e.key === 'Escape') closeSlideshow();
      else if (e.key === ' ') { e.preventDefault(); btnPause.click(); }
      else if (e.key === 'ArrowLeft') btnPrev.click();
      else if (e.key === 'ArrowRight') btnNext.click();
      else if (e.key === '+' || e.key === '=') btnZoomIn.click();
      else if (e.key === '-') btnZoomOut.click();
      else if (e.key === '0') btnFit.click();
      else if (e.key === '1') btnOrig.click();
    });

    slideshow.addEventListener('contextmenu', e => { e.preventDefault(); closeSlideshow(); });
    slideshow.addEventListener('mousemove', showControls);
    document.getElementById('tb-slideshow').addEventListener('click', openSlideshow);
  }

  // ========== Scroll arrow ==========
  document.querySelector('.hero__scroll')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
  });

  // ========== 一键回顶部 ==========
  const backToTop = document.getElementById('back-to-top');
  let scrollTicking = false;
  backToTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        backToTop.classList.toggle('visible', window.scrollY > window.innerHeight * 0.8);
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });
});
