// ===== 颜色系统 — 零 var() 依赖，JS 直接生成完整 CSS =====
// 所有颜色值精确匹配 git e867cfa 原始外观

// ── 默认配色方案（暖金黑底）──
const DEFAULT_PALETTE = {
  bg:           '#0a0a08',
  bgDeep:       '#060605',
  accent:       '#c8a87c',
  text:         '#e8e4e0',
  text2:        '#9a948e',
  text3:        '#5a5450',
  warm:         '220,200,180',   // rgba 暖色调基础
  accentRgb:    '200,168,124',   // accent RGB
  bgRgb:        '10,10,8',       // bg RGB
  bgDeepRgb:    '6,6,5',         // bg-deep RGB
  surfaceRgb:   '30,28,26',      // 浮动面板
  surface2Rgb:  '20,18,15',      // 近底面板
  errRgb:       '232,112,112',   // 关闭/收藏红色
  heroGradTop:  '255,245,235',   // Hero 标题渐变顶部(亮白)
  heroGradMid:  '220,200,175',   // Hero 标题渐变中部(暖金)
  heroGradBot:  '180,155,130',   // Hero 标题渐变底部(淡金)
};

// ── 预设定义 ──
const BUILTIN_PALETTES = [
  { id:'__default__', name:'默认', palette: DEFAULT_PALETTE },
  { id:'__warm__', name:'暖琥珀', palette: {
    bg:'#0a0804', bgDeep:'#060402', accent:'#d4a040', text:'#f0e8d8', text2:'#b0a080', text3:'#908870',
    warm:'240,200,140', accentRgb:'212,160,64', bgRgb:'10,8,4', bgDeepRgb:'6,4,2',
    surfaceRgb:'30,26,22', surface2Rgb:'20,16,14', errRgb:'232,112,112',
  }},
  { id:'__cool__', name:'冷石板', palette: {
    bg:'#08080c', bgDeep:'#040406', accent:'#8ca8c8', text:'#e0e4e8', text2:'#8c9098', text3:'#787c84',
    warm:'180,190,210', accentRgb:'140,168,200', bgRgb:'8,8,12', bgDeepRgb:'4,4,6',
    surfaceRgb:'28,28,32', surface2Rgb:'18,18,22', errRgb:'232,112,112',
  }},
  { id:'__contrast__', name:'高对比度', palette: {
    bg:'#000000', bgDeep:'#000000', accent:'#ffcc44', text:'#ffffff', text2:'#cccccc', text3:'#aaaaaa',
    warm:'255,255,255', accentRgb:'255,204,68', bgRgb:'0,0,0', bgDeepRgb:'0,0,0',
    surfaceRgb:'20,20,20', surface2Rgb:'10,10,10', errRgb:'255,80,80',
  }},
  { id:'__mono__', name:'极简黑白', palette: {
    bg:'#080808', bgDeep:'#040404', accent:'#aaaaaa', text:'#f0f0f0', text2:'#aaaaaa', text3:'#888888',
    warm:'255,255,255', accentRgb:'170,170,170', bgRgb:'8,8,8', bgDeepRgb:'4,4,4',
    surfaceRgb:'24,24,24', surface2Rgb:'14,14,14', errRgb:'232,112,112',
  }},
  { id:'__forest__', name:'暗林深绿', palette: {
    bg:'#0a0c08', bgDeep:'#060804', accent:'#7a9a6e', text:'#e4e8e0', text2:'#8c9488', text3:'#788470',
    warm:'160,200,140', accentRgb:'122,154,110', bgRgb:'10,12,8', bgDeepRgb:'6,8,4',
    surfaceRgb:'26,28,24', surface2Rgb:'16,18,14', errRgb:'232,130,130',
  }},
  { id:'__industrial__', name:'工业粗矿', palette: {
    bg:'#0c0c0c', bgDeep:'#080808', accent:'#cc9966', text:'#e0e0e0', text2:'#a0a0a0', text3:'#808080',
    warm:'200,180,160', accentRgb:'204,153,102', bgRgb:'12,12,12', bgDeepRgb:'8,8,8',
    surfaceRgb:'32,32,32', surface2Rgb:'22,22,22', errRgb:'232,112,112',
  }},
  { id:'__mist__', name:'轻雾胶片', palette: {
    bg:'#0a0908', bgDeep:'#080706', accent:'#b8a090', text:'#e8e4e0', text2:'#a09890', text3:'#908880',
    warm:'210,190,170', accentRgb:'184,160,144', bgRgb:'10,9,8', bgDeepRgb:'8,7,6',
    surfaceRgb:'30,28,26', surface2Rgb:'20,18,16', errRgb:'232,112,112',
  }},
  { id:'__editorial__', name:'编辑排版', palette: {
    bg:'#0c0b09', bgDeep:'#080706', accent:'#b8a080', text:'#e8e4de', text2:'#a09888', text3:'#908070',
    warm:'210,190,160', accentRgb:'184,160,128', bgRgb:'12,11,9', bgDeepRgb:'8,7,6',
    surfaceRgb:'32,30,26', surface2Rgb:'22,20,16', errRgb:'232,112,112',
  }},
  { id:'__terminal__', name:'终端矩阵', palette: {
    bg:'#0a0a0a', bgDeep:'#050505', accent:'#66cc88', text:'#d0d0d0', text2:'#909090', text3:'#707070',
    warm:'100,200,130', accentRgb:'102,204,136', bgRgb:'10,10,10', bgDeepRgb:'5,5,5',
    surfaceRgb:'26,26,26', surface2Rgb:'16,16,16', errRgb:'255,100,100',
  }},
  { id:'__neon__', name:'霓虹夜色', palette: {
    bg:'#080010', bgDeep:'#040008', accent:'#ff66cc', text:'#f0e0f0', text2:'#b0a0b8', text3:'#908098',
    warm:'255,100,200', accentRgb:'255,102,204', bgRgb:'8,0,16', bgDeepRgb:'4,0,8',
    surfaceRgb:'24,16,32', surface2Rgb:'14,8,20', errRgb:'255,100,150',
  }},
  { id:'__paper__', name:'暖纸书香', palette: {
    bg:'#faf8f0', bgDeep:'#f0ece0', accent:'#8b7355', text:'#333028', text2:'#6b6050', text3:'#908878',
    warm:'139,115,85', accentRgb:'139,115,85', bgRgb:'250,248,240', bgDeepRgb:'240,236,224',
    surfaceRgb:'240,236,224', surface2Rgb:'230,226,214', errRgb:'200,80,80',
  }},
  { id:'__void__', name:'极致纯黑', palette: {
    bg:'#000000', bgDeep:'#000000', accent:'#aaaaaa', text:'#ffffff', text2:'#999999', text3:'#777777',
    warm:'255,255,255', accentRgb:'170,170,170', bgRgb:'0,0,0', bgDeepRgb:'0,0,0',
    surfaceRgb:'15,15,15', surface2Rgb:'8,8,8', errRgb:'255,80,80',
  }},
  { id:'__brutal__', name:'野兽粗野', palette: {
    bg:'#0c0c0c', bgDeep:'#080808', accent:'#ff6633', text:'#e0e0e0', text2:'#a0a0a0', text3:'#808080',
    warm:'255,100,50', accentRgb:'255,102,51', bgRgb:'12,12,12', bgDeepRgb:'8,8,8',
    surfaceRgb:'32,32,32', surface2Rgb:'22,22,22', errRgb:'255,100,80',
  }},
];

// ── 生成完整 CSS（零 var() 依赖）──
function generateFullCSS(p) {
  // 派生 hero 渐变色（若 preset 未指定）
  if (!p.heroGradTop) {
    const t = p.text.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (t) {
      const tr=parseInt(t[1],16), tg=parseInt(t[2],16), tb=parseInt(t[3],16);
      p.heroGradTop = `${Math.round(tr*0.3+255*0.7)},${Math.round(tg*0.3+255*0.7)},${Math.round(tb*0.3+255*0.7)}`;
    } else p.heroGradTop = '255,245,235';
  }
  if (!p.heroGradMid) p.heroGradMid = p.accentRgb || '220,200,175';
  if (!p.heroGradBot) {
    const a = (p.accentRgb || '200,168,124').split(',');
    p.heroGradBot = `${Math.round(parseInt(a[0])*0.85)},${Math.round(parseInt(a[1])*0.78)},${Math.round(parseInt(a[2])*0.7)}`;
  }

  const W = p.warm;        // 暖色调 RGB "220,200,180"
  const A = p.accentRgb;   // 强调色 RGB
  const Bg = p.bgRgb;      // 背景 RGB
  const BgD = p.bgDeepRgb; // 深背景 RGB
  const S = p.surfaceRgb;  // 浮动表面 RGB
  const S2 = p.surface2Rgb;// 近底表面 RGB
  const E = p.errRgb;      // 红色 RGB

  return `/* === LENS 颜色系统 — 零 var() 依赖 === */
body{background:${p.bg}!important;color:${p.text}!important;}

/* ═══ Hero ═══ */
.hero__overlay{background:radial-gradient(ellipse at 50% 35%,transparent 0%,rgba(${BgD},0.35) 55%,rgba(${BgD},0.82) 100%),linear-gradient(to bottom,rgba(${BgD},0.25) 0%,transparent 25%,transparent 65%,${p.bg} 100%)!important}
.hero__title{background:linear-gradient(180deg,rgba(${p.heroGradTop},1) 0%,rgba(${p.heroGradMid},0.85) 40%,rgba(${p.heroGradBot},0.25) 100%)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;filter:drop-shadow(0 4px 24px rgba(0,0,0,0.7))!important}
.hero__title::after{background:linear-gradient(90deg,transparent,${p.heroLineColor || 'rgba('+W+',0.35)'},${p.heroLineColor || 'rgba('+W+',0.35)'},transparent)!important}
.hero__beta{color:inherit!important}
.hero__subtitle{color:${p.heroSubtitleColor || 'rgba('+W+',0.3)'}!important}
.hero__scroll{background:rgba(${W},0.06)!important;border:0.5px solid rgba(${W},0.12)!important}
.hero__scroll:hover{background:rgba(${W},0.12)!important;border-color:rgba(${W},0.22)!important;box-shadow:0 0 30px rgba(${W},0.04)!important}
.hero__scroll-line{background:rgba(${W},0.4)!important}

/* ═══ 侧边栏 ═══ */
.sidebar-frame{text-shadow:0 0 8px rgba(${Bg},0.5)!important}
.sidebar{background:rgba(${W},0.08)!important;border:0.5px solid rgba(${W},0.12)!important}
.sidebar__header{color:${p.text2}!important}
.sidebar__header-icon{opacity:0.55}
.sidebar__item{color:${p.text2}}
.sidebar__item:hover{background:rgba(${W},0.08);border-color:rgba(${W},0.12)}
.sidebar__item--active{background:rgba(${W},0.12);border-color:rgba(${W},0.22)}
.sidebar__item-icon{color:${p.text3}}
.sidebar__item:hover .sidebar__item-icon,.sidebar__item--active .sidebar__item-icon{color:${p.text2}}
.sidebar__item-name{color:${p.text2}}
.sidebar__item:hover .sidebar__item-name,.sidebar__item--active .sidebar__item-name{color:${p.text}}
.sidebar__item-remove{color:${p.text};background:rgba(${W},0.10)}
.sidebar__item-remove:hover{background:rgba(${W},0.22)}
.sidebar__empty{color:${p.text3}}
.sidebar__add{color:${p.text2};border:0.5px solid rgba(${W},0.12);background:rgba(${W},0.08)}
.sidebar__add:hover{color:${p.text};border-color:rgba(${W},0.22);background:rgba(${W},0.14)}
#dir-label{color:rgba(${W},0.25);background:rgba(${Bg},0.3);border:0.5px solid rgba(${W},0.06)}
#corner-logo{color:${p.cornerLogoColor || 'rgba(' + W + ',0.85)'}!important}
#corner-logo:hover{color:${p.accent}!important}
#cache-section{border-top:1px solid rgba(${W},0.06)}
#cache-info{color:rgba(${W},0.25)}
#lens-glow{background:rgba(${W},0.04);border:0.5px solid rgba(${W},0.06)}

/* ═══ 工具栏 ═══ */
.toolbar{background:rgba(${W},0.06);border:0.5px solid rgba(${W},0.10);box-shadow:0 4px 24px rgba(0,0,0,0.3);text-shadow:0 0 6px rgba(${Bg},0.5)}
.toolbar__btn{color:rgba(${W},0.45)}
.toolbar__btn:hover{color:${p.text};background:rgba(${W},0.10)}

/* ═══ 标题栏 ═══ */
.titlebar__btn{color:rgba(${A},0.50)}
.titlebar__btn:hover{color:${p.accent};background:rgba(${W},0.12)}
.titlebar__btn--close:hover{color:#e87070;background:rgba(${E},0.18)}
.titlebar__controls{background:rgba(${W},0.06);border:0.5px solid rgba(${W},0.10)}

/* ═══ Portfolio / 画廊 ═══ */
.portfolio::before{background:rgba(${Bg},0.75);border:0.5px solid rgba(${W},0.06)}
.portfolio__title{color:${p.text}}
.portfolio__desc{color:${p.text3}}
.portfolio__title::after{background:linear-gradient(90deg,transparent,${p.text3},${p.text3},transparent)}
.category-card{background:rgba(${W},0.015);border:1px solid rgba(${W},0.05)}
.category-card:hover{border-color:rgba(${W},0.16);box-shadow:0 24px 48px rgba(0,0,0,0.6),inset 0 0 0 1px rgba(${W},0.04)}
.category-card__info{background:rgba(${S2},0.92);border:0.5px solid rgba(${W},0.08)}
.category-card__name{color:${p.text}}
.category-card__count{color:rgba(${W},0.7);background:rgba(${W},0.08);border:0.5px solid rgba(${W},0.12)}
.category-card__count:hover{background:rgba(${W},0.12);border-color:rgba(${W},0.22)}
.category-card__label{background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.4) 60%,transparent 100%)}
.category-card__label-count{color:${p.text2}}
.category-card__rating{color:${p.accent}}
.gallery__nav{background:rgba(${Bg},0.55);border:0.5px solid rgba(${W},0.12)}
.gallery__nav *{text-shadow:0 1px 4px rgba(0,0,0,0.5)}
.gallery__back{color:${p.text}}
.gallery__back:hover{color:${p.accent}}
.gallery__info{color:${p.text2}}
.category-card::before,.gallery__item::before{background:radial-gradient(ellipse at var(--mx,50%) var(--my,50%),rgba(255,245,235,0.06) 0%,rgba(255,245,235,0.02) 40%,transparent 70%)}
.density-sweep{background:linear-gradient(to right,transparent 0%,rgba(${A},0.1) 50%,rgba(${Bg},0.92) 100%)}
.card--focused{outline:1.5px solid ${p.accent}}
.load-more-btn{background:rgba(${W},0.05);border:0.5px solid rgba(${W},0.10);color:rgba(${W},0.4)}
.load-more-btn:hover{background:rgba(${W},0.10);border-color:rgba(${W},0.22);color:${p.text};box-shadow:0 8px 24px rgba(0,0,0,0.4)}
.custom-dropdown__trigger{background:rgba(${W},0.08);border:0.5px solid rgba(${W},0.12);color:${p.text2}}
.custom-dropdown__trigger:hover{background:rgba(${W},0.14);border-color:rgba(${W},0.22);color:${p.text}}
.custom-dropdown__trigger--open{background:rgba(${A},0.12);border-color:rgba(${A},0.30);color:${p.accent}}
.custom-dropdown__menu{background:rgba(${S},0.95);border:0.5px solid rgba(${A},0.15);box-shadow:0 12px 40px rgba(0,0,0,0.5),inset 0 0 0 1px rgba(${A},0.04)}
.custom-dropdown__option{color:${p.text2}}
.custom-dropdown__option:hover{background:rgba(${A},0.08);color:${p.text}}
.custom-dropdown__option--sel{background:rgba(${A},0.10);color:${p.accent}}

/* ═══ 灯箱 ═══ */
.lightbox{background:rgba(0,0,0,0)}
.lightbox.active{background:rgba(0,0,0,0.85)}
.lightbox__close{color:${p.text};background:rgba(${W},0.12);border:0.5px solid rgba(${W},0.20)}
.lightbox__close:hover{background:rgba(${W},0.18);border-color:rgba(${W},0.30)}
.lightbox__prev,.lightbox__next{color:${p.text};background:rgba(${W},0.10);border:0.5px solid rgba(${W},0.18)}
.lightbox__prev:hover,.lightbox__next:hover{background:rgba(${W},0.16);border-color:rgba(${W},0.28)}
.lightbox__title{color:${p.text3}}
.lightbox__counter{color:${p.text3}}
.rating__star{color:rgba(${W},0.2)}
.rating__star:hover{color:${p.accent}}
.rating__star--on{color:${p.accent}}
.rating__fav{color:rgba(${W},0.2)}
.rating__fav:hover{color:#e87070}
.rating__fav--on{color:#e87070}
.lightbox__exif{background:rgba(${Bg},0.78);border:0.5px solid rgba(${A},0.12)}
.exif__tag{color:rgba(${W},0.55)}
.exif__tag--camera{color:${p.text}}
.exif__tag--lens{color:${p.text2}}

/* ═══ 幻灯片 ═══ */
.slideshow{background:${p.bg}}
.slideshow__counter{color:${p.text3}}
.slideshow__controls{background:rgba(${W},0.06);border:0.5px solid rgba(${W},0.08)}
.slideshow__btn{color:rgba(${W},0.5);background:rgba(${W},0.05);border:0.5px solid rgba(${W},0.08)}
.slideshow__btn:hover{color:${p.text};background:rgba(${W},0.10);border-color:rgba(${W},0.20)}
#sl-exit{border-color:rgba(${W},0.14);color:rgba(${W},0.6)}
#sl-exit:hover{background:rgba(${W},0.12);border-color:rgba(${W},0.3);color:${p.accent}}

/* ═══ 设置面板 ═══ */
.settings-panel{background:rgba(${S},0.92);border:0.5px solid rgba(${A},0.15);box-shadow:0 8px 32px rgba(0,0,0,0.5),inset 0 0 0 1px rgba(${A},0.04)}
.settings-panel__label{color:${p.text2}}
.settings-panel__item:hover{background:rgba(${A},0.06)}
.settings-panel__divider{background:rgba(${A},0.08)}
.cache-dir-path{color:${p.text3};background:rgba(0,0,0,0.2)}
.cache-dir-btn{color:${p.text2};background:rgba(${A},0.08);border:0.5px solid rgba(${A},0.12)}
.cache-dir-btn:hover{color:${p.text};background:rgba(${A},0.14);border-color:rgba(${A},0.22)}
.toggle-switch{background:rgba(${A},0.12);border:0.5px solid rgba(${A},0.15)}
.toggle-switch::after{background:rgba(${W},0.5)}
.toggle-switch--on{background:rgba(${A},0.35);border-color:rgba(${A},0.4)}
.toggle-switch--on::after{background:${p.accent};box-shadow:0 0 12px rgba(${A},0.5)}
.density-btns{background:rgba(${A},0.06)}
.density-btn{color:${p.text3}}
.density-btn:hover{color:${p.text2};background:rgba(${A},0.08)}
.density-btn--active{color:${p.accent};background:rgba(${A},0.14)}

/* ═══ 快捷键面板 ═══ */
.shortcuts-overlay{background:rgba(${BgD},0.5)}
.shortcuts-panel{background:rgba(${S},0.94);border:0.5px solid rgba(${A},0.18);box-shadow:0 20px 60px rgba(0,0,0,0.5),inset 0 0 0 1px rgba(${A},0.08)}
.shortcuts__title{color:${p.text}}
.shortcuts__row kbd{color:${p.accent};background:rgba(${A},0.1);border:0.5px solid rgba(${A},0.2)}
.shortcuts__row span{color:${p.text2}}
.shortcuts__hint{color:${p.text3}}
.shortcuts__divider{background:rgba(${A},0.25)}

/* ═══ 开发者面板 ═══ */
.dev-overlay{background:rgba(${BgD},0.55)}
.dev-panel{background:${p.devPanelBg || 'rgba('+Bg+',0.94)'}}
.dev-nav{background:rgba(${BgD},0.6)}
.dev-panel,.dev-preview__inner,.dev-gp-float,.dev-hints{backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px)}
.dev-preview__inner{background:${p.devPanelBg || 'rgba('+Bg+',0.94)'}}
.dev-gp-float{background:${p.devPanelBg || 'rgba('+Bg+',0.94)'}}
.dev-hints{background:${p.devPanelBg || 'rgba('+Bg+',0.94)'}}
.dev-section__title{color:${p.text}}
.dev-section__desc{color:${p.text3}}
.dev-row__label{color:${p.text2}}
.dev-row__value{color:${p.text3}}
.dev-nav__tab{color:${p.text2}}
.dev-nav__tab:hover{color:${p.text}}
.dev-nav__tab--active{color:${p.accent}}
.dev-btn{color:${p.text2}}
.dev-btn:hover{color:${p.text};background:rgba(${W},0.08)}
.dev-toggle{background:rgba(${A},0.12)}
.dev-toggle--on{background:rgba(${A},0.35)}
.dev-chip-toggle{color:${p.text2};background:rgba(${A},0.08)}
.dev-chip-toggle--on{color:${p.accent};background:rgba(${A},0.18)}
/* 手柄提示面板 */
.dev-hints{border:0.5px solid rgba(${W},0.20);border-radius:var(--radius-sm);box-shadow:0 8px 32px rgba(0,0,0,0.4)}
.dev-hints__title{color:${p.text3};border-bottom:0.5px solid rgba(${W},0.10)}
.dev-hints__desc{color:${p.text3}}
.dev-hints__btn{color:${p.text3}}
.dev-hints__icon,.gp-icon{color:${p.accent}}
/* 手柄按钮可视化 */
.dev-gp-btn{color:${p.text3};background:rgba(${W},0.06);border:0.5px solid rgba(${W},0.10)}
.dev-gp-btn--on{color:${p.accent};background:rgba(${W},0.12);border-color:rgba(${W},0.20);box-shadow:0 0 12px rgba(${A},0.25)}
.dev-reset-box__title{color:${p.text}}
.dev-reset-box__desc{color:${p.text2}}
.dev-reset-box__hint{color:${p.text3}}
.dev-preset-card{background:rgba(${W},0.04);border:0.5px solid rgba(${W},0.08)}
.dev-preset-card:hover{background:rgba(${W},0.08);border-color:rgba(${W},0.16)}
.dev-preset-card--active{border-color:${p.accent};background:rgba(${A},0.08)}
.dev-preset-card__name{color:${p.text}}
.dev-preset-card__tags{color:${p.text3}}


	/* ── 手柄焦点框（零 var()，硬编码值确保 WebView2 可见）── */
	.dev-nav__tab.hero--focused,.dev-btn.hero--focused,.dev-preset-card.hero--focused,.dev-toggle.hero--focused{background:rgba(${W},0.14)!important;box-shadow:0 0 12px rgba(${A},0.25);border-color:rgba(${W},0.22)!important}
	.dev-slider.hero--focused{box-shadow:0 0 12px rgba(${A},0.3)}
	.dev-slider.hero--focused::-webkit-slider-thumb{box-shadow:0 0 20px rgba(${A},0.6)}
	.dev-input.hero--focused{border-color:${p.accent}!important;box-shadow:0 0 12px rgba(${A},0.25)}
	.dev-row.hero--focused{background:rgba(${W},0.12)!important;border-radius:8px;box-shadow:0 0 12px rgba(${A},0.15)}
	.dev-chip-toggle.hero--focused{background:${p.accent}!important;color:${p.bg}!important;box-shadow:0 0 16px rgba(${A},0.5);border-color:${p.accent}!important}
/* ═══ 加载画面 ═══ */
.loading-screen{background:rgba(${BgD},0.9)}
#loading-track{background:rgba(${A},0.1)}
#loading-orbit-light{stroke:rgba(${A},0.55)}
#loading-text{color:rgba(${W},0.55)}
#loading-hint{color:rgba(${W},0.4)}
#loading-quote{color:rgba(${W},0.45)}

/* ═══ 动画关键帧 ═══ */
@keyframes starGlow{
  0%,100%{text-shadow:0 0 0 rgba(${A},0)}
  30%{text-shadow:0 0 20px rgba(${A},1),0 0 40px rgba(${A},0.7)}
}
@keyframes favGlow{
  0%,100%{filter:drop-shadow(0 0 0 rgba(${A},0))}
  30%{filter:drop-shadow(0 0 10px rgba(${A},0.8))}
}

/* gallery 返回按钮 B 图标 */
body.gamepad-active .gallery__back::after{background-color:${p.accent}!important}

/* ═══ 基础元素 ═══ */
.hero__reveal{background:${p.bg}}
.back-to-top{color:rgba(${W},0.5);background:rgba(${W},0.08);border:0.5px solid rgba(${W},0.12)}
.back-to-top:hover{color:${p.accent};background:rgba(${W},0.16);border-color:rgba(${W},0.25)}
`;
}

// ── 直接内联样式（最高优先级，@import CSS 无法覆盖）──
function applyDirectStyles(p) {
  const W = p.warm;
  // body
  document.body.style.backgroundColor = p.bg;
  document.body.style.color = p.text;
  // Hero 标题
  const heroTitle = document.querySelector('.hero__title');
  if (heroTitle) {
    heroTitle.style.background = `linear-gradient(180deg, rgba(${p.heroGradTop},1) 0%, rgba(${p.heroGradMid},0.85) 40%, rgba(${p.heroGradBot},0.25) 100%)`;
    heroTitle.style.webkitBackgroundClip = 'text';
    heroTitle.style.backgroundClip = 'text';
    heroTitle.style.color = 'transparent';
    heroTitle.style.webkitTextFillColor = 'transparent';
  }
  // 副标题
  const subtitle = document.querySelector('.hero__subtitle');
  if (subtitle) subtitle.style.color = p.heroSubtitleColor || `rgba(${W},0.3)`;
  // 角标
  const cornerLogo = document.getElementById('corner-logo');
  if (cornerLogo) cornerLogo.style.color = p.cornerLogoColor || `rgba(${W},0.85)`;
  // 装饰线（伪元素无法用内联样式，保留 CSS 规则）
  // 各面板背景
  const sidebar = document.getElementById('sidebar');
  if (sidebar) { sidebar.style.background = `rgba(${W},0.08)`; sidebar.style.backdropFilter = 'blur(24px)'; }
  const toolbar = document.getElementById('toolbar');
  if (toolbar) { toolbar.style.background = `rgba(${W},0.06)`; }
  const devPanel = document.getElementById('dev-panel');
  if (devPanel) devPanel.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
  const devOverlay = document.getElementById('dev-overlay');
  if (devOverlay) devOverlay.style.background = `rgba(${p.bgDeepRgb},0.55)`;
  // 预览面板 / 手柄浮层 / 提示面板 — 与主面板相同背景
  const devPreviewInner = document.querySelector('.dev-preview__inner');
  if (devPreviewInner) devPreviewInner.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
  const devGpFloat = document.querySelector('.dev-gp-float');
  if (devGpFloat) devGpFloat.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
  const devHints = document.querySelector('.dev-hints');
  if (devHints) devHints.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) settingsPanel.style.background = `rgba(${p.surfaceRgb},0.92)`;
  const shortcutsPanel = document.querySelector('.shortcuts-panel');
  if (shortcutsPanel) shortcutsPanel.style.background = `rgba(${p.surfaceRgb},0.94)`;
}

// ── 注入 / 更新 ──
function initColorSystem(palette) {
  const css = generateFullCSS(palette || DEFAULT_PALETTE);
  let s = document.getElementById('lens-colors');
  if (!s) {
    s = document.createElement('style');
    s.id = 'lens-colors';
    document.body.appendChild(s);
  }
  s.textContent = css;
  // 直接内联样式覆盖关键元素（最高优先级）
  applyDirectStyles(palette || DEFAULT_PALETTE);
  window.__lensCurrentPalette = palette || DEFAULT_PALETTE;
  window.__lensUpdateColors = (p) => {
    console.log("[colors] updateColorSystem heroGradTop:", p.heroGradTop, "cornerLogoColor:", p.cornerLogoColor);
    const css = generateFullCSS(p);
    let s = document.getElementById('lens-colors');
    if (s) {
      s.textContent = css; console.log("[colors] lens-colors updated, CSS len:", css.length);
    } else { console.error("[colors] lens-colors NOT FOUND!"); }
    applyDirectStyles(p);
    var hl = document.querySelector(".hero__title");
    var cl = document.getElementById("corner-logo");
    console.log("[colors] heroTitle:", !!hl, "cornerLogo:", !!cl);
    if (hl) console.log("[colors] heroTitle bg:", hl.style.background?.substring(0,60));
    if (cl) console.log("[colors] cornerLogo color:", cl.style.color);
    window.__lensCurrentPalette = p;
  };
}

function updateColorSystem(palette) {
  if (window.__lensUpdateColors) window.__lensUpdateColors(palette);
}

function getPaletteByName(name) {
  const p = BUILTIN_PALETTES.find(x => x.id === name || x.name === name);
  return p ? p.palette : null;
}

function paletteToVars(palette) {
  return {
    '--accent': palette.accent,
    '--bg': palette.bg,
    '--bg-deep': palette.bgDeep,
    '--text': palette.text,
    '--text-2': palette.text2,
    '--text-3': palette.text3,
    '--glass-bg': `rgba(${palette.warm},0.06)`,
    '--glass-bg-hover': `rgba(${palette.warm},0.12)`,
    '--glass-border': `rgba(${palette.warm},0.10)`,
    '--glass-border-bright': `rgba(${palette.warm},0.20)`,
    '--loading-color': `rgba(${palette.warm},0.55)`,
    '--loading-color-dim': `rgba(${palette.warm},0.40)`,
    '--loading-color-soft': `rgba(${palette.warm},0.45)`,
    '--card-bg': `rgba(${palette.warm},0.015)`,
    '--card-hover-bg': `rgba(${palette.warm},0.06)`,
    '--card-shadow': '0 4px 24px rgba(0,0,0,0.3)',
  };
}

export { initColorSystem, updateColorSystem, getPaletteByName, paletteToVars, BUILTIN_PALETTES, DEFAULT_PALETTE };
