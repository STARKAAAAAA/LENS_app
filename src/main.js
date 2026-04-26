import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const BATCH_SIZE = 30;
const CONFIG_KEY = 'lens-photo-dir';
const SAVED_KEY = 'lens-saved-folders';

// ========== 配置管理 ==========
function loadDir() {
  return localStorage.getItem(CONFIG_KEY) || '';
}
function saveDir(dir) {
  localStorage.setItem(CONFIG_KEY, dir);
}

function getSavedFolders() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
  } catch { return []; }
}
function saveFolders(dirs) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(dirs));
}

// ========== 选择文件夹 ==========
async function selectFolder() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择照片文件夹',
  });
  return selected || null;
}

// ========== 扫描照片 ==========
async function scanPhotos(baseDir) {
  const photos = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readDir(dir);
    } catch (e) {
      console.error(`读取失败: ${dir}`, e);
      throw e;
    }

    for (const entry of entries) {
      const fullPath = await join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.jpg')) {
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

// ========== App ==========
document.addEventListener('DOMContentLoaded', async () => {
  const heroSlidesEl = document.getElementById('hero-slides');
  const categoriesEl = document.getElementById('categories');
  const galleryEl = document.getElementById('gallery');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryInfo = document.getElementById('gallery-info');
  const galleryBack = document.getElementById('gallery-back');
  const galleryMore = document.getElementById('gallery-more');
  const loadMoreBtn = document.getElementById('load-more');
  const sectionTitle = document.getElementById('section-title');
  const sidebarList = document.getElementById('sidebar-list');

  const sidebar = document.getElementById('sidebar');
  const sidebarTrigger = document.getElementById('sidebar-trigger');

  let data = { categories: [], photos: [], byCategory: {} };
  let photoDir = loadDir();
  let currentCategory = null;
  let currentPhotos = [];
  let loadedCount = 0;
  let sidebarHideTimer = null;
  let heroTimer = null;

  // ========== 侧边栏自动隐藏/滑出 ==========
  function openSidebar() {
    clearTimeout(sidebarHideTimer);
    sidebar.classList.add('sidebar--open');
  }
  function closeSidebar() {
    sidebarHideTimer = setTimeout(() => {
      sidebar.classList.remove('sidebar--open');
    }, 400);
  }

  sidebarTrigger.addEventListener('mouseenter', openSidebar);
  sidebar.addEventListener('mouseenter', openSidebar);
  sidebar.addEventListener('mouseleave', closeSidebar);

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
        <svg class="sidebar__item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="sidebar__item-name">${name}</span>
        <span class="sidebar__item-remove">×</span>
      `;

      // 点击切换文件夹
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('sidebar__item-remove')) return;
        if (dir === loadDir()) return;
        loadFromDir(dir);
      });

      // 悬停删除
      item.querySelector('.sidebar__item-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeSavedFolder(dir);
      });

      sidebarList.appendChild(item);
    });
  }

  function addSavedFolder(dir) {
    const dirs = getSavedFolders();
    const normalized = dir.replace(/\\/g, '/');
    // 检查是否已存在（路径规范化比较）
    const exists = dirs.some(d => d.replace(/\\/g, '/') === normalized);
    if (!exists) {
      dirs.unshift(dir);
      saveFolders(dirs);
    }
    renderSidebar(dir);
  }

  function removeSavedFolder(dir) {
    const dirs = getSavedFolders();
    const idx = dirs.findIndex(d => d.replace(/\\/g, '/') === dir.replace(/\\/g, '/'));
    if (idx !== -1) dirs.splice(idx, 1);
    saveFolders(dirs);
    const current = loadDir();
    if (current.replace(/\\/g, '/') === dir.replace(/\\/g, '/')) {
      localStorage.removeItem(CONFIG_KEY);
      photoDir = '';
      if (dirs.length > 0) {
        loadFromDir(dirs[0]);
      } else {
        // 清空 UI
        heroSlidesEl.innerHTML = '';
        categoriesEl.innerHTML = '';
        galleryEl.style.display = 'none';
        categoriesEl.style.display = 'grid';
        sectionTitle.textContent = 'Selected Works';
        updateDirLabel('');
        renderSidebar();
      }
    } else {
      renderSidebar();
    }
  }

  // ========== 加载照片 ==========
  async function loadFromDir(dir) {
    // 清空画廊和分类 UI
    categoriesEl.innerHTML = '';
    if (galleryEl.style.display !== 'none') {
      galleryEl.style.display = 'none';
    }
    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';

    // 移除旧的错误/空状态提示
    document.querySelectorAll('.dir-prompt, .scan-error').forEach(el => el.remove());

    try {
      data = await scanPhotos(dir);
      saveDir(dir);
      photoDir = dir;
      updateDirLabel(dir);
      addSavedFolder(dir);
      console.log(`扫描完成: ${data.photos.length} 张, ${data.categories.length} 个分类`);
      if (data.photos.length === 0) {
        showEmpty('该文件夹中没有找到 .jpg 照片');
        return;
      }
      await rebuildHero(data.photos);
      buildCategoryCards();
    } catch (e) {
      console.error('扫描失败:', e);
      showError(`无法读取文件夹: ${e.message || e}`);
    }
  }

  async function pickAndLoad() {
    const selected = await selectFolder();
    if (selected) {
      photoDir = selected;
      await loadFromDir(photoDir);
    }
  }

  function showEmpty(msg) {
    const div = document.createElement('div');
    div.className = 'dir-prompt';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:#999;font-size:16px;z-index:9999;padding:40px;text-align:center;gap:1rem;';
    const btn = document.createElement('button');
    btn.textContent = '重新选择文件夹';
    btn.style.cssText = 'color:#f5f5f5;padding:0.6rem 1.5rem;border:1px solid #555;background:none;cursor:pointer;font-size:14px;';
    btn.addEventListener('click', () => { div.remove(); pickAndLoad(); });
    div.innerHTML = `<span>${msg}</span>`;
    div.appendChild(btn);
    document.body.appendChild(div);
  }

  function showError(msg) {
    const div = document.createElement('div');
    div.className = 'scan-error';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:#ff4444;font-size:16px;z-index:9999;padding:40px;text-align:center;gap:1rem;';
    const btn = document.createElement('button');
    btn.textContent = '重新选择文件夹';
    btn.style.cssText = 'color:#f5f5f5;padding:0.6rem 1.5rem;border:1px solid #555;background:none;cursor:pointer;font-size:14px;';
    btn.addEventListener('click', () => { div.remove(); pickAndLoad(); });
    div.innerHTML = `<span>${msg}</span>`;
    div.appendChild(btn);
    document.body.appendChild(div);
  }

  // ========== 路径标签 ==========
  function updateDirLabel(dir) {
    let label = document.getElementById('dir-label');
    if (!label) {
      label = document.createElement('span');
      label.id = 'dir-label';
      // 样式由 CSS (#dir-label) 控制
      document.body.appendChild(label);
    }
    label.textContent = dir;
  }

  // ========== 侧边栏添加按钮 ==========
  document.getElementById('sidebar-add').addEventListener('click', async () => {
    const selected = await selectFolder();
    if (selected) {
      await loadFromDir(selected);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ========== 启动：加载已有路径或弹窗选择 ==========
  const savedDirs = getSavedFolders();
  if (photoDir) {
    // 确保当前路径在保存列表中
    if (!savedDirs.some(d => d.replace(/\\/g, '/') === photoDir.replace(/\\/g, '/'))) {
      addSavedFolder(photoDir);
    } else {
      renderSidebar(photoDir);
    }
    updateDirLabel(photoDir);
    await loadFromDir(photoDir);
  } else if (savedDirs.length > 0) {
    // 加载最近使用的文件夹
    await loadFromDir(savedDirs[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // 首次启动，渲染空侧边栏
    renderSidebar();
    const selected = await selectFolder();
    if (selected) {
      await loadFromDir(selected);
    } else {
      showEmpty('请选择照片文件夹');
    }
  }

  // ========== 工具栏：添加文件夹 ==========
  document.getElementById('tb-folder').addEventListener('click', async () => {
    const selected = await selectFolder();
    if (selected) {
      await loadFromDir(selected);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  initLightbox();
  initSlideshow();
  initParallax();
  initScrollReveal();

  // ========== Hero ==========
  async function rebuildHero(photos) {
    // 清理旧定时器 + 淡出
    clearInterval(heroTimer);
    heroTimer = null;

    if (heroSlidesEl.children.length > 0) {
      heroSlidesEl.classList.add('hero__slides--out');
      await new Promise(r => setTimeout(r, 350));
      heroSlidesEl.classList.remove('hero__slides--out');
    }
    heroSlidesEl.innerHTML = '';

    if (!photos || photos.length === 0) return;

    // 选最多 6 张，去重
    const seen = new Set();
    const selected = [];
    for (const p of photos) {
      const key = p.category || p.src;
      if (!seen.has(key) && selected.length < 6) {
        seen.add(key);
        selected.push(p);
      }
    }

    selected.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'hero__slide' + (i === 0 ? ' active' : '');
      div.style.backgroundImage = `url('${p.src}')`;
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

    // 3.5s 后 LENS 移至左上角
    setTimeout(moveTitleToCorner, 3500);
  }

  function moveTitleToCorner() {
    const title = document.querySelector('.hero__title');
    const content = document.querySelector('.hero__content');
    const scroll = document.querySelector('.hero__scroll');
    if (!title || title.classList.contains('hero__title--corner')) return;

    // 1. 获取当前屏幕位置
    const rect = title.getBoundingClientRect();

    // 2. 设为 fixed 并放到当前位置（瞬间无动画）
    title.style.position = 'fixed';
    title.style.zIndex = '500';
    title.style.left = rect.left + 'px';
    title.style.top = rect.top + 'px';
    title.style.right = 'auto';
    title.style.bottom = 'auto';
    title.style.transition = 'none';
    title.style.translate = '0 0';

    // 隐藏副标题和滚动指示器
    if (scroll) scroll.style.opacity = '0';
    if (content) content.classList.add('hero__content--corner');

    // 3. 强制重排后开启过渡
    title.offsetHeight;
    title.style.transition = 'left 0.8s cubic-bezier(0.16,1,0.3,1), top 0.8s cubic-bezier(0.16,1,0.3,1), font-size 0.8s cubic-bezier(0.16,1,0.3,1), letter-spacing 0.8s ease, color 0.6s ease, filter 0.6s ease';

    // 4. 触发到角落
    title.classList.add('hero__title--corner');

    // 点击回到顶部
    title.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 从全部照片中选（每个分类一张）
  function initHero() {
    rebuildHero(data.photos);
  }

  // ========== Category Cards ==========
  function buildCategoryCards() {
    const fragment = document.createDocumentFragment();
    data.categories.forEach(cat => {
      const catPhotos = data.byCategory[cat] || [];
      const cover = catPhotos[0];
      if (!cover) return;

      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <img class="category-card__img" src="${cover.src}" alt="${cat}" loading="lazy">
        <div class="category-card__label">
          <div class="category-card__label-name">${cat}</div>
          <div class="category-card__label-count">${catPhotos.length} 张</div>
        </div>
        <div class="category-card__info">
          <div class="category-card__name">${cat}</div>
          <div class="category-card__count">${catPhotos.length} photos</div>
        </div>
      `;
      card.addEventListener('click', () => openCategory(cat));
      fragment.appendChild(card);
    });
    categoriesEl.appendChild(fragment);
  }

  // ========== Gallery ==========
  let categoryTransitioning = false;

  async function openCategory(cat) {
    if (categoryTransitioning) return;
    categoryTransitioning = true;

    // 淡出分类卡片
    categoriesEl.classList.add('categories--out');
    await new Promise(r => setTimeout(r, 350));

    currentCategory = cat;
    currentPhotos = data.byCategory[cat] || [];
    loadedCount = 0;
    sectionTitle.textContent = cat;
    categoriesEl.style.display = 'none';
    categoriesEl.classList.remove('categories--out');

    // Hero 切换为该分类的照片
    rebuildHero(currentPhotos);

    galleryGrid.innerHTML = '';
    galleryInfo.textContent = `${currentPhotos.length} 张照片`;
    galleryEl.classList.remove('gallery--out');
    galleryEl.style.display = 'block';
    loadPhotos();

    categoryTransitioning = false;
    window.scrollTo({ top: galleryEl.offsetTop - 40, behavior: 'smooth' });
  }

  galleryBack.addEventListener('click', async () => {
    if (categoryTransitioning) return;
    categoryTransitioning = true;

    // 淡出画廊
    galleryEl.classList.add('gallery--out');
    await new Promise(r => setTimeout(r, 350));

    currentCategory = null;
    galleryEl.style.display = 'none';
    galleryEl.classList.remove('gallery--out');

    // Hero 恢复为各分类代表照片
    rebuildHero(data.photos);

    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';

    categoryTransitioning = false;
    window.scrollTo({ top: document.getElementById('portfolio').offsetTop - 40, behavior: 'smooth' });
  });

  function loadPhotos() {
    const end = Math.min(loadedCount + BATCH_SIZE, currentPhotos.length);
    const fragment = document.createDocumentFragment();

    for (let i = loadedCount; i < end; i++) {
      const p = currentPhotos[i];
      const item = document.createElement('div');
      item.className = 'gallery__item';
      item.dataset.src = p.src;
      item.dataset.title = p.title;
      item.dataset.index = i;
      item.style.animationDelay = `${(i - loadedCount) * 0.04}s`;
      item.innerHTML = `
        <img src="${p.src}" alt="${p.title}" loading="lazy">
        <div class="gallery__item-overlay"><span class="gallery__item-title">${p.title}</span></div>
      `;
      fragment.appendChild(item);
    }
    galleryGrid.appendChild(fragment);
    loadedCount = end;
    galleryMore.style.display = loadedCount < currentPhotos.length ? 'block' : 'none';
  }

  loadMoreBtn.addEventListener('click', loadPhotos);

  window.addEventListener('scroll', () => {
    if (!currentCategory || loadedCount >= currentPhotos.length) return;
    if (window.scrollY + window.innerHeight + 600 > galleryGrid.offsetTop + galleryGrid.offsetHeight) {
      loadPhotos();
    }
  }, { passive: true });

  // ========== Scroll Reveal ==========
  function initScrollReveal() {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.portfolio__title').forEach(el => obs.observe(el));
  }

  // ========== Parallax ==========
  function initParallax() {
    const heroSlides = document.querySelector('.hero__slides');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      const h = document.querySelector('.hero').offsetHeight;
      if (y < h) {
        heroSlides.style.transform = `translateY(${y * 0.3}px)`;
        heroSlides.style.opacity = 1 - (y / h) * 0.6;
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

    let items = [];
    let idx = 0;
    let transitioning = false;
    let zoom = 1, panX = 0, panY = 0;
    let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

    function applyLbTransform() {
      lbImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function resetZoom() {
      zoom = 1; panX = 0; panY = 0;
      lbImg.style.transform = '';
    }

    function update() {
      const item = items[idx];
      if (!item) return;
      lbImg.style.opacity = '0';
      setTimeout(() => {
        resetZoom();
        lbImg.src = item.dataset.src;
        lbImg.alt = item.dataset.title;
        lbTitle.textContent = item.dataset.title;
        lbCounter.textContent = `${idx + 1} / ${items.length}`;
        lbImg.style.opacity = '1';
        transitioning = false;
      }, 180);
    }

    function open(index) {
      items = Array.from(galleryGrid.querySelectorAll('.gallery__item'));
      idx = index;
      transitioning = true;
      resetZoom();
      const item = items[idx];
      lbImg.src = item.dataset.src;
      lbTitle.textContent = item.dataset.title;
      lbCounter.textContent = `${idx + 1} / ${items.length}`;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => transitioning = false, 600);
    }

    function close() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      resetZoom();
    }

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

    // Wheel zoom
    lightbox.addEventListener('wheel', e => {
      if (!lightbox.classList.contains('active')) return;
      e.preventDefault();
      if (e.deltaY < 0) zoom = Math.min(zoom * 1.15, 8);
      else zoom = Math.max(zoom / 1.15, 0.5);
      if (zoom <= 1) { panX = 0; panY = 0; }
      applyLbTransform();
    }, { passive: false });

    // Drag pan
    lightbox.addEventListener('mousedown', e => {
      if (!lightbox.classList.contains('active') || e.button !== 0) return;
      if (zoom <= 1) return;
      dragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      panStartX = panX; panStartY = panY;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      applyLbTransform();
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // Double click to reset
    lbImg.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (zoom > 1) { resetZoom(); }
      else { zoom = 2.5; applyLbTransform(); }
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
    const controls = document.getElementById('slideshow-controls');
    const btnPause = document.getElementById('sl-pause');
    const btnPrev = document.getElementById('sl-prev');
    const btnNext = document.getElementById('sl-next');
    const btnZoomIn = document.getElementById('sl-zoom-in');
    const btnZoomOut = document.getElementById('sl-zoom-out');
    const btnFit = document.getElementById('sl-fit');
    const btnOrig = document.getElementById('sl-orig');
    const btnExit = document.getElementById('sl-exit');

    let photos = [];
    let idx = 0;
    let paused = false;
    let timer = null;
    let zoom = 1;
    let panX = 0, panY = 0;
    let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
    let hideTimer = null;

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function applyTransform() {
      img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function fitToWindow() {
      zoom = 1; panX = 0; panY = 0;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      applyTransform();
    }

    function loadCurrent() {
      if (!photos.length) return;
      const p = photos[idx % photos.length];
      img.src = p.src;
      counter.textContent = `${(idx % photos.length) + 1} / ${photos.length}`;
      fitToWindow();
    }

    function showControls() {
      slideshow.classList.add('controls-visible');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!paused) slideshow.classList.remove('controls-visible');
      }, 3000);
    }

    function openSlideshow() {
      if (!data.photos.length) return;
      photos = shuffle(data.photos);
      idx = 0;
      paused = false;
      zoom = 1; panX = 0; panY = 0;
      btnPause.textContent = '暂停';
      slideshow.classList.add('active');
      loadCurrent();
      timer = setInterval(() => { if (!paused) { idx++; loadCurrent(); } }, 5000);
      showControls();
    }

    function closeSlideshow() {
      clearInterval(timer);
      slideshow.classList.remove('active');
    }

    // Controls
    btnPrev.addEventListener('click', () => { idx = (idx - 1 + photos.length) % photos.length; loadCurrent(); showControls(); });
    btnNext.addEventListener('click', () => { idx++; loadCurrent(); showControls(); });
    btnPause.addEventListener('click', () => {
      paused = !paused;
      btnPause.textContent = paused ? '继续' : '暂停';
      showControls();
    });
    btnExit.addEventListener('click', closeSlideshow);

    // Zoom
    btnZoomIn.addEventListener('click', () => { zoom = Math.min(zoom * 1.3, 6); applyTransform(); showControls(); });
    btnZoomOut.addEventListener('click', () => { zoom = Math.max(zoom / 1.3, 0.1); applyTransform(); showControls(); });
    btnFit.addEventListener('click', () => { fitToWindow(); showControls(); });
    btnOrig.addEventListener('click', () => {
      img.style.maxWidth = 'none'; img.style.maxHeight = 'none';
      zoom = 1; panX = 0; panY = 0; applyTransform(); showControls();
    });

    // Wheel zoom
    const imgWrap = document.querySelector('.slideshow__img-wrap');
    imgWrap.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.deltaY < 0) zoom = Math.min(zoom * 1.12, 6);
      else zoom = Math.max(zoom / 1.12, 0.1);
      applyTransform();
      showControls();
    }, { passive: false });

    // Drag pan
    imgWrap.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      dragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      panStartX = panX; panStartY = panY;
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      applyTransform();
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // Double click to fit
    imgWrap.addEventListener('dblclick', fitToWindow);

    // Keyboard
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

    // Right click to exit
    slideshow.addEventListener('contextmenu', e => { e.preventDefault(); closeSlideshow(); });

    // Mouse move shows controls
    slideshow.addEventListener('mousemove', showControls);

    // Toolbar button
    document.getElementById('tb-slideshow').addEventListener('click', openSlideshow);
  }

  // Scroll arrow
  document.querySelector('.hero__scroll')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
  });
});
