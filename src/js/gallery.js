// ========== 画廊 / 分类卡片 / 排序筛选 / 下拉组件 ==========

import { preloadImages } from './utils.js';
import { loadRatings } from './lightbox.js';

// ========== 分类卡片 ==========

// getCategoryAvgRating(cat, { data, loadRatings })
export function getCategoryAvgRating(cat, data) {
  const ratings = loadRatings();
  const photos = data.byCategory[cat] || [];
  let sum = 0, count = 0;
  photos.forEach(p => {
    const r = ratings[p.path];
    if (r && r.stars > 0) { sum += r.stars; count++; }
  });
  return count > 0 ? Math.round(sum / count) : 0;
}

// buildCategoryCardsDOM({ categoriesEl, data, featureToggles, onOpenCategory })
export function buildCategoryCardsDOM({ categoriesEl, data, featureToggles, onOpenCategory }) {
  categoriesEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  data.categories.forEach(cat => {
    const catPhotos = data.byCategory[cat] || [];
    const cover = catPhotos[0];
    if (!cover) return;
    const avg = getCategoryAvgRating(cat, data);
    const starsHtml = featureToggles.rating && avg > 0
      ? `<div class="category-card__rating">${'★'.repeat(avg)}${'☆'.repeat(5 - avg)}</div>`
      : '';
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <img class="category-card__img" src="${cover.thumbSrc || cover.src}" alt="${cat}" decoding="async">
      <div class="category-card__label">
        <div class="category-card__label-name">${cat}</div>
        <div class="category-card__label-count">${catPhotos.length} 张${starsHtml}</div>
      </div>
      <div class="category-card__info">
        <div class="category-card__name">${cat}</div>
        <div class="category-card__count">${catPhotos.length} photos</div>
      </div>`;
    card.addEventListener('click', () => onOpenCategory(cat));
    fragment.appendChild(card);
  });
  categoriesEl.appendChild(fragment);
}

// refreshCategoryCards({ categoriesEl, data, featureToggles })
export function refreshCategoryCards({ categoriesEl, data, featureToggles }) {
  if (!featureToggles.rating) {
    document.querySelectorAll('.category-card__rating').forEach(el => el.remove());
    return;
  }
  data.categories.forEach(cat => {
    const cards = categoriesEl.querySelectorAll('.category-card');
    const idx = data.categories.indexOf(cat);
    const card = cards[idx];
    if (!card) return;
    const avg = getCategoryAvgRating(cat, data);
    const labelCount = card.querySelector('.category-card__label-count');
    if (!labelCount) return;
    let ratingEl = card.querySelector('.category-card__rating');
    if (avg > 0) {
      const starsStr = '★'.repeat(avg) + '☆'.repeat(5 - avg);
      if (ratingEl) {
        ratingEl.textContent = starsStr;
      } else {
        ratingEl = document.createElement('div');
        ratingEl.className = 'category-card__rating';
        ratingEl.textContent = starsStr;
        labelCount.appendChild(ratingEl);
      }
    } else if (ratingEl) {
      ratingEl.remove();
    }
  });
}

// ========== 排序 & 筛选 ==========

export function sortPhotos(photos, method) {
  const arr = [...photos];
  if (method === 'name') {
    arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  } else if (method === 'date') {
    arr.sort((a, b) => {
      const da = extractDateFromPath(a.path);
      const db = extractDateFromPath(b.path);
      if (da && db) return db - da;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.title.localeCompare(b.title, undefined, { numeric: true });
    });
  } else if (method === 'random') {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  return arr;
}

export function extractDateFromPath(path) {
  const m = path.match(/(\d{4})[\s\-_](\d{1,2})[\s\-_](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

export function filterPhotos(photos, mode) {
  if (mode === 'all') return [...photos];
  const ratings = loadRatings();
  if (mode === 'fav') {
    return photos.filter(p => ratings[p.path]?.fav === true);
  }
  const starMatch = mode.match(/^(\d)star$/);
  if (starMatch) {
    const min = Number(starMatch[1]);
    return photos.filter(p => (ratings[p.path]?.stars || 0) >= min);
  }
  return [...photos];
}

// getSortedFilteredPhotos({ currentPhotos, featureToggles })
export function getSortedFilteredPhotos({ currentPhotos, featureToggles }) {
  const sorted = sortPhotos(currentPhotos, featureToggles.sortMethod || 'name');
  return filterPhotos(sorted, featureToggles.filterMode || 'all');
}

// ========== 画廊网格 ==========

// buildGalleryGridDOM(photos, { galleryGrid, galleryInfo })
export function buildGalleryGridDOM(photos, { galleryGrid, galleryInfo }) {
  galleryGrid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  photos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'gallery__item';
    item.dataset.src = p.src;
    item.dataset.path = p.path;
    item.dataset.title = p.title;
    item.dataset.index = i;
    item.style.animationDelay = `${i * 0.02}s`;
    item.innerHTML = `
      <img src="${p.thumbSrc || p.src}" alt="${p.title}" decoding="async">
      <div class="gallery__item-overlay"><span class="gallery__item-title">${p.title}</span></div>`;
    fragment.appendChild(item);
  });
  galleryGrid.appendChild(fragment);
  galleryInfo.textContent = `${photos.length} 张照片`;
}

// ========== 自定义下拉组件（菜单挂载到 body，避免 contain:paint 裁剪） ==========

export function createDropdown(id, options, currentValue, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown';
  wrapper.id = id;

  const trigger = document.createElement('button');
  trigger.className = 'custom-dropdown__trigger';
  trigger.type = 'button';

  const arrow = document.createElement('span');
  arrow.className = 'custom-dropdown__arrow';

  const menu = document.createElement('div');
  menu.className = 'custom-dropdown__menu';
  // 挂到 body 避免被 .portfolio contain:paint 裁剪
  document.body.appendChild(menu);

  function positionMenu() {
    const r = trigger.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = r.left + 'px';
    menu.style.minWidth = r.width + 'px';
  }

  const labelMap = {};
  options.forEach(opt => {
    labelMap[opt.value] = opt.label;
    const item = document.createElement('div');
    item.className = 'custom-dropdown__option';
    item.dataset.value = opt.value;
    item.textContent = opt.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opt.value === currentValue) { closeMenu(); return; }
      currentValue = opt.value;
      trigger.childNodes[0].textContent = opt.label;
      menu.querySelectorAll('.custom-dropdown__option').forEach(o => {
        o.classList.toggle('custom-dropdown__option--sel', o.dataset.value === opt.value);
      });
      closeMenu();
      onChange(opt.value);
    });
    menu.appendChild(item);
  });

  function updateTrigger(val) {
    currentValue = val;
    trigger.innerHTML = '';
    trigger.appendChild(document.createTextNode(labelMap[val] || options[0].label));
    trigger.appendChild(arrow);
    menu.querySelectorAll('.custom-dropdown__option').forEach(o => {
      o.classList.toggle('custom-dropdown__option--sel', o.dataset.value === val);
    });
  }

  trigger.appendChild(document.createTextNode(labelMap[currentValue] || options[0].label));
  trigger.appendChild(arrow);

  function openMenu() {
    document.querySelectorAll('.custom-dropdown__menu--open').forEach(m => {
      if (m !== menu) m.classList.remove('custom-dropdown__menu--open');
    });
    positionMenu();
    menu.classList.add('custom-dropdown__menu--open');
    trigger.classList.add('custom-dropdown__trigger--open');
  }
  function closeMenu() {
    menu.classList.remove('custom-dropdown__menu--open');
    trigger.classList.remove('custom-dropdown__trigger--open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('custom-dropdown__menu--open') ? closeMenu() : openMenu();
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && !menu.contains(e.target)) closeMenu();
  });

  // 窗口滚动/缩放时重新定位
  window.addEventListener('scroll', () => { if (menu.classList.contains('custom-dropdown__menu--open')) positionMenu(); }, { passive: true });
  window.addEventListener('resize', () => { if (menu.classList.contains('custom-dropdown__menu--open')) positionMenu(); }, { passive: true });

  wrapper.appendChild(trigger);
  return { el: wrapper, update: updateTrigger, menu };
}

// ========== 画廊下拉（排序/筛选） ==========

let _activeDropdowns = [];

// renderGalleryDropdowns({ featureToggles, saveToggles, buildGalleryGridDOM, getSortedFilteredPhotos })
export function renderGalleryDropdowns({ featureToggles, saveToggles, buildGalleryGridDOM, getSortedFilteredPhotos }) {
  const nav = document.querySelector('.gallery__nav');
  if (!nav) return;

  // 关闭筛选时：隐藏但不移除，保持布局宽度不变
  if (!featureToggles.sortFilter) {
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
    _activeDropdowns.forEach(d => { if (d.menu) d.menu.classList.remove('custom-dropdown__menu--open'); });
    return;
  }

  // 清理旧组件并重建
  _activeDropdowns.forEach(d => { d.el.remove(); if (d.menu) d.menu.remove(); });
  _activeDropdowns = [];

  const sortOpts = [
    { value: 'name', label: '按名称' },
    { value: 'date', label: '按日期' },
    { value: 'random', label: '随机' },
  ];
  const filterOpts = [
    { value: 'all', label: '全部' },
    { value: 'fav', label: '已收藏' },
    { value: '1star', label: '1 星以上' },
    { value: '2star', label: '2 星以上' },
    { value: '3star', label: '3 星以上' },
    { value: '4star', label: '4 星以上' },
    { value: '5star', label: '5 星' },
  ];

  let sortCurrent = featureToggles.sortMethod || 'name';
  let filterCurrent = featureToggles.filterMode || 'all';

  const onChange = () => {
    featureToggles.sortMethod = sortCurrent;
    featureToggles.filterMode = filterCurrent;
    saveToggles(featureToggles);
    buildGalleryGridDOM(getSortedFilteredPhotos());
  };

  const sortComp = createDropdown('gallery-sort', sortOpts, sortCurrent, (v) => {
    sortCurrent = v; onChange();
  });
  const filterComp = createDropdown('gallery-filter', filterOpts, filterCurrent, (v) => {
    filterCurrent = v; onChange();
  });

  _activeDropdowns = [sortComp, filterComp];

  const info = document.getElementById('gallery-info');
  if (info) {
    // 高斯模糊淡入动画
    [filterComp.el, sortComp.el].forEach(el => {
      el.style.opacity = '0';
      el.style.filter = 'blur(6px)';
      el.style.WebkitFilter = 'blur(6px)';
      el.style.transition = 'opacity 0.4s var(--ease-out), filter 0.4s var(--ease-out)';
    });
    nav.insertBefore(filterComp.el, info);
    nav.insertBefore(sortComp.el, filterComp.el);
    requestAnimationFrame(() => {
      [filterComp.el, sortComp.el].forEach(el => {
        el.style.opacity = '1';
        el.style.filter = 'blur(0)';
        el.style.WebkitFilter = 'blur(0)';
      });
    });
  }
}

// ========== openCategory — 打开分类 ==========

// openCategory(cat, ctx)
// ctx: { state, setCategory, categoriesEl, galleryEl, sectionTitle, galleryGrid,
//        data, rebuildHero, getSortedFilteredPhotos, buildGalleryGridDOM,
//        renderGalleryDropdowns, showLoadingScreen, updateLoadingScreen, hideLoadingScreen }
export async function openCategory(cat, ctx) {
  const {
    state, setCategory,
    categoriesEl, galleryEl, sectionTitle, galleryGrid,
    data, rebuildHero,
    getSortedFilteredPhotos, buildGalleryGridDOM, renderGalleryDropdowns,
    showLoadingScreen, updateLoadingScreen, hideLoadingScreen,
  } = ctx;

  if (state.categoryTransitioning) return;
  state.categoryTransitioning = true;

  categoriesEl.classList.add('categories--out');
  await new Promise(r => setTimeout(r, 350));

  const currentPhotos = data.byCategory[cat] || [];
  setCategory(cat, currentPhotos);
  sectionTitle.textContent = cat;
  categoriesEl.style.display = 'none';
  categoriesEl.classList.remove('categories--out');

  rebuildHero(currentPhotos);

  // 排序、筛选并渲染
  const photos = getSortedFilteredPhotos();
  buildGalleryGridDOM(photos);
  renderGalleryDropdowns();

  // 预加载全部图片，完成后才显示
  await showLoadingScreen(`加载中... 0 / ${photos.length}`);
  const imgs = galleryGrid.querySelectorAll('img');
  await preloadImages(Array.from(imgs), (n, t) => {
    updateLoadingScreen(`加载中... ${n} / ${t}`);
  });
  hideLoadingScreen();

  galleryEl.classList.remove('gallery--out');
  galleryEl.style.display = 'block';

  state.categoryTransitioning = false;
  window.scrollTo({ top: galleryEl.offsetTop - 40, behavior: 'smooth' });
}

// ========== Apple TV-style 3D card tilt & shine ==========

const CARD_FLOAT = {
  lift: 5,
  scale: 1.005,
};

let _tiltInitialized = false;

export function initCardTilt() {
  if (_tiltInitialized) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  const containers = [
    document.getElementById('categories'),
    document.getElementById('gallery-grid'),
  ].filter(Boolean);
  if (containers.length === 0) return;

  let ticking = false;
  let pendingCard = null, pendingClientX = 0, pendingClientY = 0;

  function applyTilt(card, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    const halfW = rect.width / 2, halfH = rect.height / 2;
    const cx = rect.left + halfW, cy = rect.top + halfH;
    const nx = Math.max(-1, Math.min(1, (clientX - cx) / halfW));
    const ny = Math.max(-1, Math.min(1, (clientY - cy) / halfH));
    const { lift, scale } = CARD_FLOAT;
    const tx = nx * lift;
    const ty = ny * lift;
    card.style.transform =
      `translateX(${tx}px) translateY(${ty}px) scale3d(${scale}, ${scale}, 1)`;
    card.style.setProperty('--shine-x', ((clientX - rect.left) / rect.width) * 100 + '%');
    card.style.setProperty('--shine-y', ((clientY - rect.top) / rect.height) * 100 + '%');
  }

  function onMouseMove(e) {
    const card = e.target.closest('.category-card, .gallery__item');
    if (!card || !card.classList.contains('card--tilt-active')) return;
    pendingCard = card; pendingClientX = e.clientX; pendingClientY = e.clientY;
    if (!ticking) {
      requestAnimationFrame(() => {
        if (pendingCard) applyTilt(pendingCard, pendingClientX, pendingClientY);
        ticking = false;
      });
      ticking = true;
    }
  }

  function onMouseOver(e) {
    const card = e.target.closest('.category-card, .gallery__item');
    if (!card) return;
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    card.classList.add('card--tilt-active');
    applyTilt(card, e.clientX, e.clientY);
  }

  function onMouseOut(e) {
    const card = e.target.closest('.category-card, .gallery__item');
    if (!card) return;
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    card.classList.remove('card--tilt-active');
    card.style.transform = '';
    card.style.setProperty('--shine-x', '50%');
    card.style.setProperty('--shine-y', '50%');
  }

  containers.forEach(c => {
    c.addEventListener('mousemove', onMouseMove, { passive: true });
    c.addEventListener('mouseover', onMouseOver, { passive: true });
    c.addEventListener('mouseout', onMouseOut, { passive: true });
  });
  _tiltInitialized = true;
}
