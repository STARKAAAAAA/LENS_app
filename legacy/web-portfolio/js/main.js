document.addEventListener('DOMContentLoaded', () => {

  if (typeof PHOTOS_DATA === 'undefined') return;

  const photos = PHOTOS_DATA.photos;
  const categories = PHOTOS_DATA.categories;
  const BATCH_SIZE = 30;

  // DOM
  const heroSlidesEl = document.getElementById('hero-slides');
  const categoriesEl = document.getElementById('categories');
  const galleryEl = document.getElementById('gallery');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryInfo = document.getElementById('gallery-info');
  const galleryBack = document.getElementById('gallery-back');
  const galleryMore = document.getElementById('gallery-more');
  const loadMoreBtn = document.getElementById('load-more');
  const sectionTitle = document.getElementById('section-title');

  // 状态
  let currentCategory = null;
  let currentPhotos = [];
  let loadedCount = 0;

  // 按分类分组
  const photoMap = {};
  photos.forEach(p => {
    if (!photoMap[p.category]) photoMap[p.category] = [];
    photoMap[p.category].push(p);
  });

  // 初始化
  initHero();
  buildCategoryCards();
  initLightbox();
  initParallax();
  initScrollReveal();

  // ==================== Hero ====================
  function initHero() {
    const seen = new Set();
    const heroPhotos = [];
    for (const p of photos) {
      if (!seen.has(p.category) && heroPhotos.length < 6) {
        seen.add(p.category);
        heroPhotos.push(p);
      }
    }
    heroPhotos.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'hero__slide' + (i === 0 ? ' active' : '');
      div.style.backgroundImage = `url('${p.src}')`;
      heroSlidesEl.appendChild(div);
    });
    const slides = heroSlidesEl.querySelectorAll('.hero__slide');
    if (slides.length < 2) return;
    let cur = 0;
    setInterval(() => {
      slides[cur].classList.remove('active');
      cur = (cur + 1) % slides.length;
      slides[cur].classList.add('active');
    }, 6000);
  }

  // ==================== 分类卡片 ====================
  function buildCategoryCards() {
    const fragment = document.createDocumentFragment();
    categories.forEach(cat => {
      const catPhotos = photoMap[cat] || [];
      const cover = catPhotos[0];
      if (!cover) return;

      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.category = cat;

      const img = document.createElement('img');
      img.className = 'category-card__img';
      img.src = cover.src;
      img.alt = cat;
      img.loading = 'lazy';
      card.appendChild(img);

      // 底部常驻标签
      const label = document.createElement('div');
      label.className = 'category-card__label';
      label.innerHTML = `
        <div class="category-card__label-name">${cat}</div>
        <div class="category-card__label-count">${catPhotos.length} 张</div>
      `;
      card.appendChild(label);

      // 悬停时显示的居中信息
      const info = document.createElement('div');
      info.className = 'category-card__info';
      info.innerHTML = `
        <div class="category-card__name">${cat}</div>
        <div class="category-card__count">${catPhotos.length} photos</div>
      `;
      card.appendChild(info);

      card.addEventListener('click', () => openCategory(cat));
      fragment.appendChild(card);
    });
    categoriesEl.appendChild(fragment);
  }

  // ==================== 打开分类 ====================
  function openCategory(cat) {
    currentCategory = cat;
    currentPhotos = photoMap[cat] || [];
    loadedCount = 0;

    sectionTitle.textContent = cat;
    categoriesEl.style.display = 'none';
    galleryEl.style.display = 'block';
    galleryGrid.innerHTML = '';

    galleryInfo.textContent = `${currentPhotos.length} 张照片`;
    loadPhotos();
    window.scrollTo({ top: galleryEl.offsetTop - 40, behavior: 'smooth' });
  }

  // ==================== 返回分类列表 ====================
  galleryBack.addEventListener('click', () => {
    currentCategory = null;
    galleryEl.style.display = 'none';
    categoriesEl.style.display = 'grid';
    sectionTitle.textContent = 'Selected Works';
    window.scrollTo({ top: document.getElementById('portfolio').offsetTop - 40, behavior: 'smooth' });
  });

  // ==================== 加载照片（分批） ====================
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

      const img = document.createElement('img');
      img.src = p.src;
      img.alt = p.title;
      img.loading = 'lazy';
      item.appendChild(img);

      const overlay = document.createElement('div');
      overlay.className = 'gallery__item-overlay';
      overlay.innerHTML = `<span class="gallery__item-title">${p.title}</span>`;
      item.appendChild(overlay);

      fragment.appendChild(item);
    }
    galleryGrid.appendChild(fragment);
    loadedCount = end;

    // 显示/隐藏"加载更多"
    if (loadedCount < currentPhotos.length) {
      galleryMore.style.display = 'block';
    } else {
      galleryMore.style.display = 'none';
    }
  }

  loadMoreBtn.addEventListener('click', loadPhotos);

  // ==================== 滚动到底部自动加载 ====================
  window.addEventListener('scroll', () => {
    if (!currentCategory) return;
    if (loadedCount >= currentPhotos.length) return;
    const scrollBottom = window.scrollY + window.innerHeight;
    const gridBottom = galleryGrid.offsetTop + galleryGrid.offsetHeight;
    if (scrollBottom + 600 > gridBottom) {
      loadPhotos();
    }
  }, { passive: true });

  // ==================== 滚动渐入 ====================
  function initScrollReveal() {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.portfolio__title').forEach(el => obs.observe(el));
  }

  // ==================== 视差 ====================
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

  // ==================== 灯箱 ====================
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

    function getGalleryItems() {
      return Array.from(galleryGrid.querySelectorAll('.gallery__item'));
    }

    function update() {
      const item = items[idx];
      if (!item) return;
      lbImg.style.opacity = '0';
      lbTitle.style.opacity = '0';
      setTimeout(() => {
        lbImg.src = item.dataset.src;
        lbImg.alt = item.dataset.title;
        lbTitle.textContent = item.dataset.title;
        lbCounter.textContent = `${idx + 1} / ${items.length}`;
        lbImg.style.opacity = '1';
        lbTitle.style.opacity = '1';
        transitioning = false;
      }, 180);
    }

    function open(index) {
      items = getGalleryItems();
      idx = index;
      transitioning = true;
      const item = items[idx];
      lbImg.src = item.dataset.src;
      lbTitle.textContent = item.dataset.title;
      lbCounter.textContent = `${idx + 1} / ${items.length}`;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => { transitioning = false; }, 600);
    }

    function close() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    function prev() {
      if (transitioning) return;
      transitioning = true;
      idx = (idx - 1 + items.length) % items.length;
      update();
    }

    function next() {
      if (transitioning) return;
      transitioning = true;
      idx = (idx + 1) % items.length;
      update();
    }

    galleryGrid.addEventListener('click', e => {
      const item = e.target.closest('.gallery__item');
      if (!item) return;
      const all = getGalleryItems();
      const i = all.indexOf(item);
      if (i !== -1) open(i);
    });

    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });

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

  // ==================== 滚动箭头 ====================
  document.querySelector('.hero__scroll')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
  });
});
