// ========== 灯箱 & 幻灯片 & 评分系统 ==========

import { invoke } from '@tauri-apps/api/core';
import { formatBytes } from './utils.js';

// ========== 评分数据（内存缓存 + localStorage 持久化） ==========
const RATING_KEY = 'lens-photo-ratings';
let _ratingsCache = null;

export function loadRatings() {
  if (!_ratingsCache) {
    try { _ratingsCache = JSON.parse(localStorage.getItem(RATING_KEY)) || {}; }
    catch { _ratingsCache = {}; }
  }
  return _ratingsCache;
}

export function saveRatings(r) {
  _ratingsCache = r;
  try { localStorage.setItem(RATING_KEY, JSON.stringify(r)); } catch {}
}

export function getPhotoRating(path) {
  return loadRatings()[path] || { stars: 0, fav: false };
}

export function setPhotoRating(path, stars, fav) {
  const ratings = loadRatings();
  const cur = ratings[path] || { stars: 0, fav: false };
  ratings[path] = { stars: stars ?? cur.stars, fav: fav ?? cur.fav };
  saveRatings(ratings);
}

// ========== Lightbox ==========
let _lightboxInitialized = false;

export function initLightbox(galleryGrid, { featureToggles, invoke, formatBytes, onRatingChange } = {}) {
  if (_lightboxInitialized) return;
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  _lightboxInitialized = true;
  const lbImg = lightbox.querySelector('.lightbox__img');
  const lbTitle = lightbox.querySelector('.lightbox__title');
  const lbCounter = lightbox.querySelector('.lightbox__counter');

  // 图片加载失败时回退缩略图
  lbImg.addEventListener('error', () => {
    const item = items[idx];
    if (item && item.dataset.thumbSrc && lbImg.src !== item.dataset.thumbSrc + '?full=1') {
      lbImg.src = item.dataset.thumbSrc + '?full=1';
    }
  });
  const btnClose = lightbox.querySelector('.lightbox__close');
  const btnPrev = lightbox.querySelector('.lightbox__prev');
  const btnNext = lightbox.querySelector('.lightbox__next');

  let items = [], idx = 0, transitioning = false;
  let zoom = 1, panX = 0, panY = 0;
  let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

  function applyLbTransform() { lbImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; }
  function resetZoom() { zoom = 1; panX = 0; panY = 0; lbImg.style.transform = ''; }

  // ========== 评分 UI（灯箱内） ==========
  const ratingStars = document.getElementById('rating-stars');
  const ratingFav = document.getElementById('rating-fav');
  const ratingPanel = document.getElementById('lightbox-rating');

  function updateRatingUI(path) {
    lightbox.dataset.currentPath = path || '';
    const r = getPhotoRating(path);
    ratingStars.querySelectorAll('.rating__star').forEach(s => {
      s.classList.toggle('rating__star--on', Number(s.dataset.v) <= r.stars);
    });
    ratingFav.classList.toggle('rating__fav--on', r.fav);
    if (path) ratingPanel.classList.add('rating--visible');
    else ratingPanel.classList.remove('rating--visible');
  }

  // ========== EXIF 面板 ==========
  const exifPanel = document.getElementById('lightbox-exif');
  const exifTags = {
    camera: exifPanel.querySelector('.exif__tag--camera'),
    lens: exifPanel.querySelector('.exif__tag--lens'),
    aperture: exifPanel.querySelector('.exif__tag--aperture'),
    shutter: exifPanel.querySelector('.exif__tag--shutter'),
    iso: exifPanel.querySelector('.exif__tag--iso'),
    focal: exifPanel.querySelector('.exif__tag--focal'),
    date: exifPanel.querySelector('.exif__tag--date'),
    dims: exifPanel.querySelector('.exif__tag--dims'),
    size: exifPanel.querySelector('.exif__tag--size'),
  };

  async function loadLightboxExif(filePath) {
    if (!featureToggles.exif) {
      exifPanel.classList.remove('exif--visible');
      return;
    }
    if (!filePath) {
      exifPanel.classList.remove('exif--visible');
      return;
    }
    try {
      const info = await invoke('get_exif_info', { path: filePath });
      exifTags.camera.textContent = info.camera || '';
      exifTags.camera.classList.toggle('exif__tag--empty', !info.camera);
      exifTags.lens.textContent = info.lens || '';
      exifTags.lens.classList.toggle('exif__tag--empty', !info.lens);
      exifTags.aperture.textContent = info.aperture || '';
      exifTags.aperture.classList.toggle('exif__tag--empty', !info.aperture);
      exifTags.shutter.textContent = info.shutter || '';
      exifTags.shutter.classList.toggle('exif__tag--empty', !info.shutter);
      exifTags.iso.textContent = info.iso || '';
      exifTags.iso.classList.toggle('exif__tag--empty', !info.iso);
      exifTags.focal.textContent = info.focal_length || '';
      exifTags.focal.classList.toggle('exif__tag--empty', !info.focal_length);
      exifTags.date.textContent = info.date ? info.date.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') : '';
      exifTags.date.classList.toggle('exif__tag--empty', !info.date);
      exifTags.dims.textContent = (info.width && info.height) ? `${info.width} × ${info.height}` : '';
      exifTags.dims.classList.toggle('exif__tag--empty', !info.width);
      exifTags.size.textContent = info.filesize ? formatBytes(info.filesize) : '';
      exifTags.size.classList.toggle('exif__tag--empty', !info.filesize);
      exifPanel.classList.add('exif--visible');
    } catch {
      exifPanel.classList.remove('exif--visible');
    }
  }

  function update() {
    const item = items[idx];
    if (!item) return;
    lbImg.style.opacity = '0';
    setTimeout(() => {
      if (!lightbox.classList.contains('active')) return;
      resetZoom();
      lbImg.src = item.dataset.src + '?full=1';
      lbImg.alt = item.dataset.title;
      lbTitle.textContent = item.dataset.title;
      lbCounter.textContent = `${idx + 1} / ${items.length}`;
      lbImg.style.opacity = '1';
      loadLightboxExif(item.dataset.path);
      updateRatingUI(item.dataset.path);
      transitioning = false;
    }, 180);
  }

  function open(index) {
    items = Array.from(galleryGrid.querySelectorAll('.gallery__item'));
    idx = index; transitioning = true; resetZoom();
    const item = items[idx];
    lbImg.style.opacity = '0';
    lbImg.src = item.dataset.src + '?full=1';
    lbTitle.textContent = item.dataset.title;
    lbCounter.textContent = `${idx + 1} / ${items.length}`;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadLightboxExif(item.dataset.path);
    updateRatingUI(item.dataset.path);
    setTimeout(() => { lbImg.style.opacity = '1'; transitioning = false; }, 300);
  }
  function close() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    resetZoom();
    lbImg.style.opacity = '';
    lbImg.src = '';
  }
  function prev() { if (!transitioning) { transitioning = true; idx = (idx - 1 + items.length) % items.length; update(); } }
  function next() { if (!transitioning) { transitioning = true; idx = (idx + 1) % items.length; update(); } }

  // 评分/收藏点击处理（document 级事件委托）
  document.addEventListener('click', (e) => {
    if (!lightbox.classList.contains('active')) return;
    const path = lightbox.dataset.currentPath;
    if (!path) return;
    const star = e.target.closest('.rating__star');
    if (star) {
      e.stopPropagation();
      // 辉光动画
      star.classList.add('rating__star--glow');
      star.addEventListener('animationend', () => star.classList.remove('rating__star--glow'), { once: true });
      const v = Number(star.dataset.v);
      const cur = getPhotoRating(path).stars;
      const newStars = v === cur ? 0 : v;
      setPhotoRating(path, newStars, undefined);
      updateRatingUI(path);
      if (onRatingChange) onRatingChange();
      return;
    }
    const fav = e.target.closest('#rating-fav');
    if (fav) {
      e.stopPropagation();
      fav.classList.add('rating__star--glow');
      fav.addEventListener('animationend', () => fav.classList.remove('rating__star--glow'), { once: true });
      const cur = getPhotoRating(path);
      setPhotoRating(path, undefined, !cur.fav);
      updateRatingUI(path);
      if (onRatingChange) onRatingChange();
      return;
    }
  });

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
    if (e.key === 'Escape') { close(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
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
let _slideshowInitialized = false;

export function initSlideshow({ getPhotos } = {}) {
  if (_slideshowInitialized) return;
  _slideshowInitialized = true;

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
  const tbSlideshow = document.getElementById('tb-slideshow');

  if (!slideshow || !img || !tbSlideshow) return;

  let photos = [], idx = 0, paused = false, timer = null;
  let zoom = 1, panX = 0, panY = 0;
  let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
  let hideTimer = null, loadTimer = null;

  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function applyTransform() { img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; }
  function fitToWindow() { zoom = 1; panX = 0; panY = 0; img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; applyTransform(); }

  function loadCurrent() {
    if (!photos.length) return;
    const p = photos[idx % photos.length];
    img.classList.add('slideshow__img--out');
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
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
    const allPhotos = getPhotos ? getPhotos() : [];
    if (!allPhotos.length) return;
    clearInterval(timer); clearTimeout(loadTimer);
    photos = shuffle(allPhotos); idx = 0; paused = false; zoom = 1; panX = 0; panY = 0;
    btnPause.textContent = '暂停';
    slideshow.classList.add('active'); loadCurrent();
    timer = setInterval(() => { if (!paused) { idx++; loadCurrent(); } }, 5000);
    showControls();
  }
  function closeSlideshow() { clearInterval(timer); clearTimeout(loadTimer); slideshow.classList.remove('active'); }

  btnPrev?.addEventListener('click', () => { if (!photos.length) return; idx = (idx - 1 + photos.length) % photos.length; loadCurrent(); showControls(); });
  btnNext?.addEventListener('click', () => { if (!photos.length) return; idx++; loadCurrent(); showControls(); });
  btnPause?.addEventListener('click', () => { paused = !paused; btnPause.textContent = paused ? '继续' : '暂停'; showControls(); });
  btnExit?.addEventListener('click', closeSlideshow);
  btnZoomIn?.addEventListener('click', () => { zoom = Math.min(zoom * 1.3, 6); applyTransform(); showControls(); });
  btnZoomOut?.addEventListener('click', () => { zoom = Math.max(zoom / 1.3, 0.1); applyTransform(); showControls(); });
  btnFit?.addEventListener('click', () => { fitToWindow(); showControls(); });
  btnOrig?.addEventListener('click', () => { img.style.maxWidth = 'none'; img.style.maxHeight = 'none'; zoom = 1; panX = 0; panY = 0; applyTransform(); showControls(); });

  const imgWrap = document.querySelector('.slideshow__img-wrap');
  imgWrap?.addEventListener('wheel', e => {
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
  tbSlideshow.addEventListener('click', openSlideshow);
}
