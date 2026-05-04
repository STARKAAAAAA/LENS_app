// ===== Imports =====
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { formatBytes, preloadImages } from './js/utils.js';
import { CONFIG_KEY, loadDir, saveDir, getSavedFolders, saveFolders } from './js/config.js';
import { selectFolder, scanPhotos } from './js/scanner.js';
import { initTitlebar } from './js/titlebar.js';
import { loadToggles, saveToggles, migrateToggles, applyTogglesUI } from './js/toggles.js';
import { showLoadingScreen, updateLoadingScreen, hideLoadingScreen, playStartupSequence } from './js/loading.js';
import { renderSidebar, addSavedFolder, removeSavedFolder, createCacheSection, updateCacheDisplay } from './js/sidebar.js';
import { buildCategoryCardsDOM, buildGalleryGridDOM, renderGalleryDropdowns, refreshCategoryCards, openCategory, getSortedFilteredPhotos, initCardTilt } from './js/gallery.js';
import { initLightbox, initSlideshow, loadRatings } from './js/lightbox.js';
import { initSettingsPanel, initShortcutsPanel } from './js/panels.js';
import { initGamepad } from './js/gamepad.js';
import { initDevPanel } from './js/dev-panel.js';

// ===== App =====
document.addEventListener('DOMContentLoaded', async () => {
  console.time('startup');
  console.log('[LENS] DOMContentLoaded');

  // ---- DOM refs ----
  const heroSlidesEl = document.getElementById('hero-slides');
  const categoriesEl = document.getElementById('categories');
  const galleryEl = document.getElementById('gallery');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryInfo = document.getElementById('gallery-info');
  const galleryBack = document.getElementById('gallery-back');
  const sectionTitle = document.getElementById('section-title');
  const sidebarList = document.getElementById('sidebar-list');
  const sidebar = document.getElementById('sidebar');
  const sidebarFrame = document.getElementById('sidebar-frame');
  const sidebarTrigger = document.getElementById('sidebar-trigger');

  initTitlebar();

  // ---- State ----
  const state = {
    data: { categories: [], photos: [], byCategory: {} },
    photoDir: loadDir(),
    currentCategory: null,
    currentPhotos: [],
    categoryTransitioning: false,
    startupAnimationDone: false,
  };
  let startupResolve = null;
  const startupPromise = new Promise(r => { startupResolve = r; });

  // ---- Feature toggles ----
  let featureToggles = loadToggles();
  migrateToggles(featureToggles);
  applyTogglesUI(featureToggles);

  // ---- Sidebar interaction (stays in main.js) ----
  let sidebarClicked = false;

  function peekSidebar() {
    clearTimeout(sidebarHideTimer);
    if (!sidebarClicked) { sidebarFrame.classList.add('sidebar--peek'); sidebarTrigger.style.pointerEvents = 'none'; }
  }
  function openSidebar() {
    clearTimeout(sidebarHideTimer);
    sidebarClicked = true;
    sidebarFrame.classList.add('sidebar--open'); sidebarFrame.classList.remove('sidebar--peek');
    sidebarTrigger.style.pointerEvents = 'none';
  }
  function hideSidebarNow() {
    clearTimeout(sidebarHideTimer);
    sidebarClicked = false;
    sidebarFrame.classList.remove('sidebar--open', 'sidebar--peek');
    sidebarTrigger.style.pointerEvents = 'auto';
  }
  function hideSidebar() {
    sidebarHideTimer = setTimeout(() => {
      if (!sidebar.matches(':hover')) {
        sidebarClicked = false;
        sidebarFrame.classList.remove('sidebar--open', 'sidebar--peek');
        sidebarTrigger.style.pointerEvents = 'auto';
      }
    }, 500);
  }
  let sidebarHideTimer = null;

  sidebarTrigger.addEventListener('mouseenter', peekSidebar);
  sidebar.addEventListener('click', (e) => {
    if (!sidebarClicked) { openSidebar(); }
    else if (e.target === sidebar || e.target.classList.contains('sidebar__list') || e.target.id === 'sidebar-list') { hideSidebarNow(); }
  });
  sidebar.addEventListener('mouseleave', hideSidebar);
  sidebarTrigger.addEventListener('mouseleave', () => {
    if (!sidebarClicked) {
      sidebarHideTimer = setTimeout(() => {
        if (!sidebar.matches(':hover')) { sidebarFrame.classList.remove('sidebar--peek'); sidebarTrigger.style.pointerEvents = 'auto'; }
      }, 200);
    }
  });

  // ---- Path label ----
  function updateDirLabel(dir) {
    let label = document.getElementById('dir-label');
    if (!label) { label = document.createElement('span'); label.id = 'dir-label'; document.body.appendChild(label); }
    label.textContent = dir;
  }

  // ---- Cache section ----
  const cacheDeps = { sidebar, featureToggles, invoke, formatBytes };
  function ensureCacheSection() { createCacheSection(cacheDeps); }
  ensureCacheSection();

  // ---- Sidebar wiring ----
  function doRenderSidebar(activeDir) {
    renderSidebar(activeDir ?? loadDir(), {
      getSavedFolders, loadDir, sidebarList,
      onSelectFolder: (d) => loadFromDir(d),
      onRemoveFolder: (d) => doRemoveSavedFolder(d),
    });
  }

  function doAddSavedFolder(dir) {
    addSavedFolder(dir, { getSavedFolders, saveFolders, renderSidebar: doRenderSidebar });
  }

  function doRemoveSavedFolder(dir) {
    removeSavedFolder(dir, {
      getSavedFolders, saveFolders, loadDir,
      renderSidebar: () => doRenderSidebar(),
      onReload: (d) => { saveDir(d); state.photoDir = d; loadFromDir(d); },
      onEmpty: () => {
        localStorage.removeItem(CONFIG_KEY); state.photoDir = '';
        heroSlidesEl.innerHTML = ''; categoriesEl.innerHTML = '';
        galleryEl.style.display = 'none'; categoriesEl.style.display = 'grid';
        sectionTitle.textContent = 'Selected Works';
        updateDirLabel(''); doRenderSidebar();
      },
    });
  }

  // ---- Gallery wiring ----
  function doGetSortedFilteredPhotos() {
    return getSortedFilteredPhotos({ currentPhotos: state.currentPhotos, featureToggles });
  }
  function doBuildGalleryGridDOM(photos) {
    buildGalleryGridDOM(photos, { galleryGrid, galleryInfo });
  }
  function doRenderGalleryDropdowns() {
    renderGalleryDropdowns({
      featureToggles, saveToggles,
      buildGalleryGridDOM: doBuildGalleryGridDOM,
      getSortedFilteredPhotos: doGetSortedFilteredPhotos,
    });
  }

  // ---- Hero slideshow ----
  let heroTimer = null;
  async function rebuildHero(photos) {
    clearInterval(heroTimer); heroTimer = null;
    if (heroSlidesEl.children.length > 0) {
      heroSlidesEl.classList.add('hero__slides--out');
      await new Promise(r => setTimeout(r, 350));
      heroSlidesEl.classList.remove('hero__slides--out');
    }
    heroSlidesEl.innerHTML = '';

    let reveal = document.querySelector('.hero__reveal');
    if (!reveal) {
      reveal = document.createElement('div');
      reveal.className = 'hero__reveal';
      document.querySelector('.hero')?.appendChild(reveal);
    } else {
      reveal.style.animation = 'none';
      reveal.offsetHeight;
      reveal.style.animation = '';
    }

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
    if (!state.startupAnimationDone) playStartupSequence({ onDone: () => { state.startupAnimationDone = true; if (startupResolve) { startupResolve(); startupResolve = null; } } });
  }

  // ---- Main photo loader (orchestrator stays in main.js) ----
  async function loadFromDir(dir) {
    categoriesEl.innerHTML = '';
    if (galleryEl.style.display !== 'none') galleryEl.style.display = 'none';
    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';
    document.querySelectorAll('.dir-prompt, .scan-error').forEach(el => el.remove());

    try {
      state.data = await scanPhotos(dir);
      galleryCtx.data = state.data; // 更新 ctx 引用
      saveDir(dir); state.photoDir = dir;
      updateDirLabel(dir); doAddSavedFolder(dir);
      console.log(`扫描完成: ${state.data.photos.length} 张, ${state.data.categories.length} 个分类`);

      if (state.data.photos.length === 0) {
        showEmpty('该文件夹中没有找到 .jpg 照片'); return;
      }

      if (!state.startupAnimationDone) await startupPromise;

      const paths = state.data.photos.map(p => p.path);
      await showLoadingScreen(`正在生成缩略图... 0 / ${paths.length}`, { onFirstShow: ensureCacheSection });

      let firstLoadHintShown = false;
      const unlisten = await listen('thumbnail-progress', (event) => {
        const { current, total, fresh } = event.payload;
        updateLoadingScreen(`正在生成缩略图... ${current} / ${total}`);
        if (!firstLoadHintShown && fresh > 0 && fresh > total * 0.3) {
          firstLoadHintShown = true;
          const hint = document.getElementById('loading-hint');
          if (hint) {
            hint.textContent = '正在为您的作品集建立本地缓存，稍后即可流畅浏览';
            hint.style.display = 'block';
            requestAnimationFrame(() => {
              hint.style.opacity = '1';
              hint.style.transform = 'translateY(0)';
            });
          }
        }
      });
      const thumbMap = await invoke('generate_thumbnails', { paths, cacheDir: featureToggles.cacheDir });
      unlisten();

      let thumbHits = 0;
      state.data.photos.forEach(p => {
        const tp = thumbMap[p.path];
        if (tp) { p.thumbSrc = convertFileSrc(tp); thumbHits++; }
      });
      console.log(`缩略图缓存: ${thumbHits} / ${state.data.photos.length} 就绪`);
      updateCacheDisplay();

      updateLoadingScreen('正在加载分类...');
      buildCategoryCardsDOM({
        categoriesEl, data: state.data, featureToggles,
        onOpenCategory: (cat) => openCategory(cat, galleryCtx),
      });
      const cardImgs = categoriesEl.querySelectorAll('img');
      await preloadImages(Array.from(cardImgs), (n, t) => {
        updateLoadingScreen(`正在加载分类... ${n} / ${t}`);
      });

      await hideLoadingScreen();
      await rebuildHero(state.data.photos);
      categoriesEl.style.display = 'grid';
    } catch (e) {
      await hideLoadingScreen();
      console.error('扫描失败:', e);
      showError(`无法读取文件夹: ${e.message || e}`);
    }
  }

  async function pickAndLoad() {
    const selected = await selectFolder();
    if (selected) { state.photoDir = selected; await loadFromDir(state.photoDir); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  // ---- Overlay helpers ----
  function showOverlay(msg, isError) {
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:${isError ? '#ff4444' : '#999'};font-size:16px;z-index:9999;padding:40px;text-align:center;gap:1rem;`;
    const btn = document.createElement('button');
    btn.textContent = '重新选择文件夹';
    btn.style.cssText = 'color:#f5f5f5;padding:0.6rem 1.5rem;border:1px solid #555;background:none;cursor:pointer;font-size:14px;';
    btn.addEventListener('click', () => { div.remove(); pickAndLoad(); });
    div.innerHTML = `<span>${msg}</span>`; div.appendChild(btn);
    document.body.appendChild(div);
  }
  function showEmpty(msg) { showOverlay(msg, false); }
  function showError(msg) { showOverlay(msg, true); }

  // ---- Gallery context (for openCategory) ----
  const galleryCtx = {
    state: state,
    setCategory: (cat, photos) => { state.currentCategory = cat; state.currentPhotos = photos; },
    categoriesEl, galleryEl, sectionTitle, galleryGrid,
    data: state.data,
    rebuildHero,
    getSortedFilteredPhotos: doGetSortedFilteredPhotos,
    buildGalleryGridDOM: doBuildGalleryGridDOM,
    renderGalleryDropdowns: doRenderGalleryDropdowns,
    showLoadingScreen: (msg) => showLoadingScreen(msg, { onFirstShow: ensureCacheSection }),
    updateLoadingScreen,
    hideLoadingScreen,
  };

  // ---- Startup sequence ----
  if (!document.querySelector('.hero__reveal')) {
    const reveal = document.createElement('div');
    reveal.className = 'hero__reveal';
    document.querySelector('.hero')?.appendChild(reveal);
  }
  playStartupSequence({ onDone: () => { state.startupAnimationDone = true; if (startupResolve) { startupResolve(); startupResolve = null; } } });

  // ---- Settings panel ----
  const settingsBtn = document.getElementById('tb-settings');
  const settingsPanel = document.getElementById('settings-panel');

  initSettingsPanel({
    settingsBtn, settingsPanel, featureToggles,
    onToggleChange: (key, value) => {
      if (key === 'sortFilter') {
        if (value && state.currentCategory) {
          doRenderGalleryDropdowns();
        } else {
          ['gallery-sort', 'gallery-filter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
              el.style.opacity = '0';
              el.style.filter = 'blur(6px)';
              el.style.WebkitFilter = 'blur(6px)';
              el.style.pointerEvents = 'none';
              el.style.transition = 'opacity 0.35s var(--ease-out), filter 0.35s var(--ease-out)';
            }
          });
          featureToggles.sortMethod = 'name';
          featureToggles.filterMode = 'all';
          saveToggles(featureToggles);
          if (state.currentCategory) {
            doBuildGalleryGridDOM(doGetSortedFilteredPhotos());
          }
        }
      }
    },
  });

  // ---- Shortcuts panel ----
  initShortcutsPanel({ featureToggles });

  // ---- Initial load ----
  const savedDirs = getSavedFolders();
  if (state.photoDir) {
    if (!savedDirs.some(d => d.replace(/\\/g, '/') === state.photoDir.replace(/\\/g, '/'))) { doAddSavedFolder(state.photoDir); }
    else { doRenderSidebar(state.photoDir); }
    updateDirLabel(state.photoDir);
    await loadFromDir(state.photoDir);
  } else if (savedDirs.length > 0) {
    await loadFromDir(savedDirs[0]);
  } else {
    doRenderSidebar();
    const selected = await selectFolder();
    if (selected) { await loadFromDir(selected); }
    else { showEmpty('请选择照片文件夹'); }
  }

  // ---- Toolbar buttons ----
  document.getElementById('sidebar-add').addEventListener('click', pickAndLoad);
  document.getElementById('tb-folder').addEventListener('click', pickAndLoad);

  // ---- Gallery back button ----
  galleryBack.addEventListener('click', async () => {
    if (state.categoryTransitioning) return;
    state.categoryTransitioning = true;
    galleryEl.classList.add('gallery--out');
    await new Promise(r => setTimeout(r, 350));
    state.currentCategory = null;
    galleryEl.style.display = 'none';
    galleryEl.classList.remove('gallery--out');
    rebuildHero(state.data.photos);
    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';
    state.categoryTransitioning = false;
    const portfolioEl = document.getElementById('portfolio');
    const portfolioRect = portfolioEl.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + portfolioRect.top - 40, behavior: 'smooth' });
  });

  // ---- Init lightbox, slideshow, effects ----
  initLightbox(galleryGrid, {
    featureToggles, invoke, formatBytes,
    onRatingChange: () => {
      if (state.data.categories.length > 0) refreshCategoryCards({ categoriesEl, data: state.data, featureToggles });
    },
  });
  initSlideshow({ getPhotos: () => state.data.photos });
  initParallax();
  initScrollReveal();
  initCardTilt();
  initGamepad();
  initDevPanel();
  updateCacheDisplay();

  // ---- UI visibility after startup ----
  setTimeout(() => {
    document.getElementById('toolbar').classList.add('toolbar--visible');
    document.getElementById('titlebar').classList.add('titlebar--visible');
    document.getElementById('titlebar-controls').classList.add('titlebar--visible');
    document.getElementById('sidebar-trigger').classList.add('sidebar-trigger--ready');
    const dirLabel = document.getElementById('dir-label');
    if (dirLabel) dirLabel.style.opacity = '1';
  }, 300);

  // ---- Scroll arrow ----
  document.querySelector('.hero__scroll')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
  });

  // ---- Back to top ----
  const backToTop = document.getElementById('back-to-top');
  let scrollTicking = false;
  backToTop.addEventListener('click', () => {
    const portfolio = document.getElementById('portfolio');
    if (portfolio) { const r = portfolio.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - 8, behavior: 'smooth' }); }
  });
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        backToTop.classList.toggle('visible', window.scrollY > window.innerHeight * 0.8);
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });

  // ---- Parallax ----
  function initParallax() {
    const heroSlides = document.querySelector('.hero__slides');
    const heroEl = document.querySelector('.hero');
    if (!heroSlides || !heroEl) return;
    let heroH = heroEl.offsetHeight;
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
    window.addEventListener('resize', () => {
      heroH = heroEl.offsetHeight;
    }, { passive: true });
  }

  // ---- Scroll reveal ----
  function initScrollReveal() {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.portfolio__title, .portfolio__desc').forEach(el => obs.observe(el));
  }
});
