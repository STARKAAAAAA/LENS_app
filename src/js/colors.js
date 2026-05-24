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
  glassBlur:    '0px',           // 全局毛玻璃模糊叠加量
  devPanelBg:        'rgba(10,10,8,0.94)',
  heroLineColor:     'rgba(220,200,180,0.35)',
  heroSubtitleColor: 'rgba(220,200,180,0.3)',
  cornerLogoColor:   'rgba(220,200,180,0.85)',
  heroGradTop:  '255,245,235',   // Hero 标题渐变顶部(亮白)
  heroGradMid:  '220,200,175',   // Hero 标题渐变中部(暖金)
  heroGradBot:  '180,155,130',   // Hero 标题渐变底部(淡金)
};

// ── 预设定义 ──
const BUILTIN_PALETTES = [
  { id:'__default__', name:'默认', palette: DEFAULT_PALETTE },
  { id:'__apple__', name:'Apple', palette: {
    bg:'#000000', bgDeep:'#000000', accent:'#0066cc', text:'#ffffff', text2:'#cccccc', text3:'#999999',
    warm:'210,210,215', accentRgb:'0,102,204', bgRgb:'0,0,0', bgDeepRgb:'0,0,0',
    surfaceRgb:'39,39,41', surface2Rgb:'37,37,39', errRgb:'255,69,58',
    devPanelBg:'rgba(39,39,41,0.94)', heroLineColor:'rgba(210,210,215,0.25)', heroSubtitleColor:'rgba(210,210,215,0.3)', cornerLogoColor:'rgba(210,210,215,0.85)',
    heroGradTop:'220,220,225', heroGradMid:'180,180,190', heroGradBot:'80,80,90',
  }},
  { id:'__apple-light__', name:'Apple Light', palette: {
    bg:'#ffffff', bgDeep:'#f5f5f7', accent:'#0066cc', text:'#1d1d1f', text2:'#6e6e73', text3:'#aeaeb2',
    warm:'50,50,55', accentRgb:'0,102,204', bgRgb:'255,255,255', bgDeepRgb:'245,245,247',
    surfaceRgb:'248,248,250', surface2Rgb:'240,240,244', errRgb:'255,69,58',
    devPanelBg:'rgba(250,250,252,0.97)', heroLineColor:'rgba(0,0,0,0.08)', heroSubtitleColor:'rgba(0,0,0,0.35)', cornerLogoColor:'rgba(29,29,31,0.85)',
    heroGradTop:'29,29,31', heroGradMid:'90,90,95', heroGradBot:'170,170,175',
  }},
  { id:'__apple-parchment__', name:'Apple Parchment', palette: {
    bg:'#f5f5f7', bgDeep:'#e8e8ed', accent:'#0066cc', text:'#1d1d1f', text2:'#6e6e73', text3:'#aeaeb2',
    warm:'40,40,45', accentRgb:'0,102,204', bgRgb:'245,245,247', bgDeepRgb:'232,232,237',
    surfaceRgb:'255,255,255', surface2Rgb:'248,248,250', errRgb:'255,69,58',
    devPanelBg:'rgba(248,248,250,0.97)', heroLineColor:'rgba(0,0,0,0.07)', heroSubtitleColor:'rgba(0,0,0,0.3)', cornerLogoColor:'rgba(29,29,31,0.8)',
    heroGradTop:'29,29,31', heroGradMid:'85,85,90', heroGradBot:'175,175,180',
  }},
  { id:'__ibm__', name:'IBM', palette: {
    bg:'#161616', bgDeep:'#0d0d0d', accent:'#0f62fe', text:'#ffffff', text2:'#c6c6c6', text3:'#8c8c8c',
    warm:'198,198,198', accentRgb:'15,98,254', bgRgb:'22,22,22', bgDeepRgb:'13,13,13',
    surfaceRgb:'38,38,38', surface2Rgb:'30,30,30', errRgb:'218,30,40',
    devPanelBg:'rgba(22,22,22,0.94)', heroLineColor:'rgba(15,98,254,0.25)', heroSubtitleColor:'rgba(198,198,198,0.3)', cornerLogoColor:'rgba(15,98,254,0.85)',
    heroGradTop:'230,235,255', heroGradMid:'150,170,230', heroGradBot:'15,98,254',
  }},
  { id:'__ibm-light__', name:'IBM Light', palette: {
    bg:'#ffffff', bgDeep:'#f4f4f4', accent:'#0f62fe', text:'#161616', text2:'#525252', text3:'#8d8d8d',
    warm:'22,22,22', accentRgb:'15,98,254', bgRgb:'255,255,255', bgDeepRgb:'244,244,244',
    surfaceRgb:'244,244,244', surface2Rgb:'224,224,224', errRgb:'218,30,40',
    devPanelBg:'rgba(255,255,255,0.97)', heroLineColor:'rgba(15,98,254,0.2)', heroSubtitleColor:'rgba(22,22,22,0.35)', cornerLogoColor:'rgba(15,98,254,0.85)',
    heroGradTop:'22,22,22', heroGradMid:'70,70,75', heroGradBot:'170,190,220',
  }},
  { id:'__bugatti__', name:'Bugatti', palette: {
    bg:'#000000', bgDeep:'#000000', accent:'#ffffff', text:'#ffffff', text2:'#cccccc', text3:'#999999',
    warm:'255,255,255', accentRgb:'255,255,255', bgRgb:'0,0,0', bgDeepRgb:'0,0,0',
    surfaceRgb:'20,20,20', surface2Rgb:'13,13,13', errRgb:'218,30,40',
    devPanelBg:'rgba(0,0,0,0.96)', heroLineColor:'rgba(255,255,255,0.15)', heroSubtitleColor:'rgba(255,255,255,0.25)', cornerLogoColor:'rgba(255,255,255,0.9)',
    heroGradTop:'255,255,255', heroGradMid:'180,180,180', heroGradBot:'60,60,60',
  }},
  { id:'__bugatti-silver__', name:'Bugatti Silver', palette: {
    bg:'#0d0d0d', bgDeep:'#080808', accent:'#c3d9f3', text:'#ffffff', text2:'#e6e6e6', text3:'#999999',
    warm:'210,220,235', accentRgb:'195,217,243', bgRgb:'13,13,13', bgDeepRgb:'8,8,8',
    surfaceRgb:'20,20,20', surface2Rgb:'15,15,15', errRgb:'218,30,40',
    devPanelBg:'rgba(13,13,13,0.96)', heroLineColor:'rgba(195,217,243,0.2)', heroSubtitleColor:'rgba(210,220,235,0.22)', cornerLogoColor:'rgba(195,217,243,0.85)',
    heroGradTop:'240,245,255', heroGradMid:'195,217,243', heroGradBot:'50,60,80',
  }},
  { id:'__warm__', name:'暖琥珀', palette: {
    bg:'#0a0804', bgDeep:'#060402', accent:'#d4a040', text:'#f0e8d8', text2:'#b0a080', text3:'#908870',
    warm:'240,200,140', accentRgb:'212,160,64', bgRgb:'10,8,4', bgDeepRgb:'6,4,2',
    surfaceRgb:'30,26,22', surface2Rgb:'20,16,14', errRgb:'232,112,112',
    devPanelBg:'rgba(10,8,4,0.94)', heroLineColor:'rgba(240,200,140,0.35)', heroSubtitleColor:'rgba(240,200,140,0.3)', cornerLogoColor:'rgba(240,200,140,0.85)',
  }},
  { id:'__cool__', name:'冷石板', palette: {
    bg:'#08080c', bgDeep:'#040406', accent:'#8ca8c8', text:'#e0e4e8', text2:'#8c9098', text3:'#787c84',
    warm:'180,190,210', accentRgb:'140,168,200', bgRgb:'8,8,12', bgDeepRgb:'4,4,6',
    surfaceRgb:'28,28,32', surface2Rgb:'18,18,22', errRgb:'232,112,112',
    devPanelBg:'rgba(8,8,12,0.94)', heroLineColor:'rgba(180,190,210,0.35)', heroSubtitleColor:'rgba(180,190,210,0.3)', cornerLogoColor:'rgba(180,190,210,0.85)',
  }},
  { id:'__contrast__', name:'高对比度', palette: {
    bg:'#000000', bgDeep:'#000000', accent:'#ffcc44', text:'#ffffff', text2:'#cccccc', text3:'#aaaaaa',
    warm:'255,255,255', accentRgb:'255,204,68', bgRgb:'0,0,0', bgDeepRgb:'0,0,0',
    surfaceRgb:'20,20,20', surface2Rgb:'10,10,10', errRgb:'255,80,80',
    devPanelBg:'rgba(0,0,0,0.94)', heroLineColor:'rgba(255,255,255,0.35)', heroSubtitleColor:'rgba(255,255,255,0.3)', cornerLogoColor:'rgba(255,255,255,0.85)',
  }},
  { id:'__mono__', name:'极简黑白', palette: {
    bg:'#080808', bgDeep:'#040404', accent:'#aaaaaa', text:'#f0f0f0', text2:'#aaaaaa', text3:'#888888',
    warm:'255,255,255', accentRgb:'170,170,170', bgRgb:'8,8,8', bgDeepRgb:'4,4,4',
    surfaceRgb:'24,24,24', surface2Rgb:'14,14,14', errRgb:'232,112,112',
    devPanelBg:'rgba(8,8,8,0.94)', heroLineColor:'rgba(255,255,255,0.35)', heroSubtitleColor:'rgba(255,255,255,0.3)', cornerLogoColor:'rgba(255,255,255,0.85)',
  }},
  { id:'__forest__', name:'暗林深绿', palette: {
    bg:'#0a0c08', bgDeep:'#060804', accent:'#7a9a6e', text:'#e4e8e0', text2:'#8c9488', text3:'#788470',
    warm:'160,200,140', accentRgb:'122,154,110', bgRgb:'10,12,8', bgDeepRgb:'6,8,4',
    surfaceRgb:'26,28,24', surface2Rgb:'16,18,14', errRgb:'232,130,130', glassBlur:'6px',
    devPanelBg:'rgba(10,12,8,0.94)', heroLineColor:'rgba(160,200,140,0.35)', heroSubtitleColor:'rgba(160,200,140,0.3)', cornerLogoColor:'rgba(160,200,140,0.85)',
  }},
  { id:'__industrial__', name:'工业粗矿', palette: {
    bg:'#0c0c0c', bgDeep:'#080808', accent:'#cc9966', text:'#e0e0e0', text2:'#a0a0a0', text3:'#808080',
    warm:'200,180,160', accentRgb:'204,153,102', bgRgb:'12,12,12', bgDeepRgb:'8,8,8',
    surfaceRgb:'32,32,32', surface2Rgb:'22,22,22', errRgb:'232,112,112', glassBlur:'20px',
    devPanelBg:'rgba(12,12,12,0.94)', heroLineColor:'rgba(200,180,160,0.35)', heroSubtitleColor:'rgba(200,180,160,0.3)', cornerLogoColor:'rgba(200,180,160,0.85)',
  }},
  { id:'__mist__', name:'轻雾胶片', palette: {
    bg:'#0a0908', bgDeep:'#080706', accent:'#b8a090', text:'#e8e4e0', text2:'#a09890', text3:'#908880',
    warm:'210,190,170', accentRgb:'184,160,144', bgRgb:'10,9,8', bgDeepRgb:'8,7,6',
    surfaceRgb:'30,28,26', surface2Rgb:'20,18,16', errRgb:'232,112,112', glassBlur:'6px',
    devPanelBg:'rgba(10,9,8,0.94)', heroLineColor:'rgba(210,190,170,0.35)', heroSubtitleColor:'rgba(210,190,170,0.3)', cornerLogoColor:'rgba(210,190,170,0.85)',
  }},
  { id:'__editorial__', name:'编辑排版', palette: {
    bg:'#0c0b09', bgDeep:'#080706', accent:'#b8a080', text:'#e8e4de', text2:'#a09888', text3:'#908070',
    warm:'210,190,160', accentRgb:'184,160,128', bgRgb:'12,11,9', bgDeepRgb:'8,7,6',
    surfaceRgb:'32,30,26', surface2Rgb:'22,20,16', errRgb:'232,112,112', glassBlur:'8px',
    devPanelBg:'rgba(12,11,9,0.94)', heroLineColor:'rgba(210,190,160,0.35)', heroSubtitleColor:'rgba(210,190,160,0.3)', cornerLogoColor:'rgba(210,190,160,0.85)',
  }},
  { id:'__terminal__', name:'终端矩阵', palette: {
    bg:'#0a0a0a', bgDeep:'#050505', accent:'#66cc88', text:'#d0d0d0', text2:'#909090', text3:'#707070',
    warm:'100,200,130', accentRgb:'102,204,136', bgRgb:'10,10,10', bgDeepRgb:'5,5,5',
    surfaceRgb:'26,26,26', surface2Rgb:'16,16,16', errRgb:'255,100,100', glassBlur:'8px',
    devPanelBg:'rgba(10,10,10,0.94)', heroLineColor:'rgba(100,200,130,0.35)', heroSubtitleColor:'rgba(100,200,130,0.3)', cornerLogoColor:'rgba(100,200,130,0.85)',
  }},
  { id:'__neon__', name:'霓虹夜色', palette: {
    bg:'#080010', bgDeep:'#040008', accent:'#ff66cc', text:'#f0e0f0', text2:'#b0a0b8', text3:'#908098',
    warm:'255,100,200', accentRgb:'255,102,204', bgRgb:'8,0,16', bgDeepRgb:'4,0,8',
    surfaceRgb:'24,16,32', surface2Rgb:'14,8,20', errRgb:'255,100,150', glassBlur:'12px',
    devPanelBg:'rgba(8,0,16,0.94)', heroLineColor:'rgba(255,100,200,0.35)', heroSubtitleColor:'rgba(255,100,200,0.3)', cornerLogoColor:'rgba(255,100,200,0.85)',
  }},
  { id:'__paper__', name:'暖纸书香', palette: {
    bg:'#faf8f0', bgDeep:'#f0ece0', accent:'#8b7355', text:'#333028', text2:'#6b6050', text3:'#908878',
    warm:'120,100,75', accentRgb:'139,115,85', bgRgb:'250,248,240', bgDeepRgb:'240,236,224',
    surfaceRgb:'240,236,224', surface2Rgb:'230,226,214', errRgb:'200,80,80', glassBlur:'4px',
    devPanelBg:'rgba(250,248,240,0.96)', heroLineColor:'rgba(139,115,85,0.28)', heroSubtitleColor:'rgba(139,115,85,0.35)', cornerLogoColor:'rgba(139,115,85,0.82)',
    heroGradTop:'51,48,40', heroGradMid:'100,95,85', heroGradBot:'180,175,165',
  }},
  { id:'__void__', name:'极致纯黑', palette: {
    bg:'#000000', bgDeep:'#000000', accent:'#aaaaaa', text:'#ffffff', text2:'#999999', text3:'#777777',
    warm:'255,255,255', accentRgb:'170,170,170', bgRgb:'0,0,0', bgDeepRgb:'0,0,0',
    surfaceRgb:'15,15,15', surface2Rgb:'8,8,8', errRgb:'255,80,80',
    devPanelBg:'rgba(0,0,0,0.94)', heroLineColor:'rgba(255,255,255,0.35)', heroSubtitleColor:'rgba(255,255,255,0.3)', cornerLogoColor:'rgba(255,255,255,0.85)',
  }},
  { id:'__brutal__', name:'野兽粗野', palette: {
    bg:'#0c0c0c', bgDeep:'#080808', accent:'#ff6633', text:'#e0e0e0', text2:'#a0a0a0', text3:'#808080',
    warm:'255,100,50', accentRgb:'255,102,51', bgRgb:'12,12,12', bgDeepRgb:'8,8,8',
    surfaceRgb:'32,32,32', surface2Rgb:'22,22,22', errRgb:'255,100,80', glassBlur:'4px',
    devPanelBg:'rgba(12,12,12,0.94)', heroLineColor:'rgba(255,100,50,0.35)', heroSubtitleColor:'rgba(255,100,50,0.3)', cornerLogoColor:'rgba(255,100,50,0.85)',
  }},
  { id:'__liquid-glass__', name:'液态玻璃', palette: {
    bg:'#08080c', bgDeep:'#040408', accent:'#5e9ef0', text:'#e8ecf2', text2:'#a0a8b8', text3:'#687080',
    warm:'180,210,240', accentRgb:'94,158,240', bgRgb:'8,8,12', bgDeepRgb:'4,4,8',
    surfaceRgb:'20,22,28', surface2Rgb:'16,18,22', errRgb:'255,90,90', glassBlur:'20px',
    devPanelBg:'rgba(16,18,22,0.94)', heroLineColor:'rgba(160,200,240,0.18)', heroSubtitleColor:'rgba(160,200,240,0.3)', cornerLogoColor:'rgba(160,200,240,0.85)',
    heroGradTop:'230,240,255', heroGradMid:'140,180,230', heroGradBot:'50,80,140',
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
  const FSD = p.fontStyleDisplay || 'normal';
  const FSB = p.fontStyleBody || 'normal';
  const FSC = p.fontStyleCaption || 'normal';
  const FSM = p.fontStyleMono || 'normal';
  const TTR = p.textTransform || 'none';
  const FD = p.fontDisplay || "'Cormorant Garamond', Georgia, serif";
  const FB = p.fontBody || "'Cormorant', Georgia, serif";
  const FC = p.fontCaption || "'Cormorant Garamond', Georgia, serif";
  const FM = p.fontMono || "'Consolas', 'Courier New', monospace";
  const FWD = p.fontWeightDisplay || '300';
  const FWB = p.fontWeightBody || '400';
  const FWC = p.fontWeightCaption || '400';
  const FWM = p.fontWeightMono || '400';
  const LSD = p.letterSpacingDisplay || '0.05em';
  const LSB = p.letterSpacingBody || '0.04em';
  const LSC = p.letterSpacingCaption || '0.04em';
  const LSM = p.letterSpacingMono || '0';

  return `/* === LENS 颜色系统 — 零 var() 依赖 === */
:root{
--danger:rgb(${E});--danger-rgb:${E};--accent-rgb:${A};--warm-rgb:${W};--bg-deep-rgb:${BgD};--glass-blur:${p.glassBlur || '0px'};
--sidebar-glass-bg:rgba(${W},0.08);--sidebar-glass-border:rgba(${W},0.12);--sidebar-glass-bg-hover:rgba(${W},0.14);--sidebar-glass-border-bright:rgba(${W},0.22);--sidebar-glass-blur:calc(24px + var(--glass-blur,0px));
--titlebar-glass-bg:rgba(${W},0.06);--titlebar-glass-border:rgba(${W},0.10);--titlebar-glass-bg-hover:rgba(${W},0.12);--titlebar-btn-color:rgba(${W},0.45);--titlebar-glass-blur:calc(12px + var(--glass-blur,0px));
--toolbar-glass-bg:rgba(${W},0.06);--toolbar-glass-border:rgba(${W},0.10);--toolbar-glass-bg-hover:rgba(${W},0.10);--toolbar-btn-color:rgba(${W},0.45);--toolbar-glass-blur:calc(16px + var(--glass-blur,0px));
--card-glass-bg:rgba(${W},0.015);--card-glass-border:rgba(${W},0.05);--card-glass-bg-hover:rgba(${W},0.06);--card-glass-border-bright:rgba(${W},0.16);--card-hover-blur:calc(6px + var(--glass-blur,0px));--gallery-nav-blur:calc(24px + var(--glass-blur,0px));--dropdown-blur:calc(12px + var(--glass-blur,0px));
--panel-glass-bg:rgba(${S},0.92);--panel-glass-border:rgba(${A},0.15);--panel-glass-bg-hover:rgba(${A},0.06);--panel-glass-blur:calc(24px + var(--glass-blur,0px));--shortcuts-blur:calc(30px + var(--glass-blur,0px));
--lightbox-glass-bg:rgba(${W},0.12);--lightbox-glass-border:rgba(${W},0.20);--lightbox-glass-bg-hover:rgba(${W},0.18);--lightbox-glass-blur:calc(30px + var(--glass-blur,0px));--lightbox-btn-blur:calc(20px + var(--glass-blur,0px));--lightbox-exif-blur:calc(16px + var(--glass-blur,0px));--slideshow-blur:calc(20px + var(--glass-blur,0px));
--hero-scroll-blur:calc(20px + var(--glass-blur,0px));--back-to-top-blur:calc(20px + var(--glass-blur,0px));--dev-panel-blur:calc(40px + var(--glass-blur,0px));--loading-track-height:4px;
}
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
.sidebar{background:var(--sidebar-glass-bg,rgba(${W},0.08))!important;border:0.5px solid var(--sidebar-glass-border,rgba(${W},0.12))!important;backdrop-filter:blur(var(--sidebar-glass-blur,calc(24px + ${p.glassBlur || '0px'})))!important;-webkit-backdrop-filter:blur(var(--sidebar-glass-blur,calc(24px + ${p.glassBlur || '0px'})))!important}
.sidebar__header{color:${p.text2}!important}
.sidebar__header-icon{opacity:0.55}
.sidebar__item{color:${p.text2}}
.sidebar__item:hover{background:var(--sidebar-glass-bg,rgba(${W},0.08));border-color:var(--sidebar-glass-border,rgba(${W},0.12))}
.sidebar__item--active{background:var(--sidebar-glass-bg-hover,rgba(${W},0.12));border-color:var(--sidebar-glass-border-bright,rgba(${W},0.22))}
.sidebar__item-icon{color:${p.text3}}
.sidebar__item:hover .sidebar__item-icon,.sidebar__item--active .sidebar__item-icon{color:${p.text2}}
.sidebar__item-name{color:${p.text2}}
.sidebar__item:hover .sidebar__item-name,.sidebar__item--active .sidebar__item-name{color:${p.text}}
.sidebar__item-remove{color:${p.text};background:var(--sidebar-glass-border,rgba(${W},0.10))}
.sidebar__item-remove:hover{background:var(--sidebar-glass-border-bright,rgba(${W},0.22))}
.sidebar__empty{color:${p.text3}}
.sidebar__add{color:${p.text2};border:0.5px solid var(--sidebar-glass-border,rgba(${W},0.12));background:var(--sidebar-glass-bg,rgba(${W},0.08))}
.sidebar__add:hover{color:${p.text};border-color:var(--sidebar-glass-border-bright,rgba(${W},0.22));background:var(--sidebar-glass-bg-hover,rgba(${W},0.14))}
#dir-label{color:rgba(${W},0.25);background:rgba(${Bg},0.3);border:0.5px solid var(--sidebar-glass-border,rgba(${W},0.06))}
#corner-logo{color:${p.cornerLogoColor || 'rgba(' + W + ',0.85)'}!important}
#corner-logo:hover{color:${p.accent}!important}
#cache-section{border-top:1px solid var(--sidebar-glass-border,rgba(${W},0.06))}
#cache-info{color:rgba(${W},0.25)}
#lens-glow{background:var(--sidebar-glass-bg,rgba(${W},0.04));border:0.5px solid var(--sidebar-glass-border,rgba(${W},0.06))}

/* ═══ 工具栏 ═══ */
.toolbar{background:var(--toolbar-glass-bg,rgba(${W},0.06))!important;border:0.5px solid var(--toolbar-glass-border,rgba(${W},0.10))!important;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-shadow:0 0 6px rgba(${Bg},0.5);backdrop-filter:blur(var(--toolbar-glass-blur,calc(16px + ${p.glassBlur || '0px'})))!important;-webkit-backdrop-filter:blur(var(--toolbar-glass-blur,calc(16px + ${p.glassBlur || '0px'})))!important}
.toolbar__btn{color:var(--toolbar-btn-color,rgba(${W},0.45))}
.toolbar__btn:hover{color:${p.text};background:var(--toolbar-glass-bg-hover,rgba(${W},0.10))}

/* ═══ 标题栏 ═══ */
.titlebar__btn{color:var(--titlebar-btn-color,rgba(${W},0.45))}
.titlebar__btn:hover{color:${p.accent};background:var(--titlebar-glass-bg-hover,rgba(${W},0.12))}
.titlebar__btn--close:hover{color:var(--danger);background:rgba(${E},0.18)}
.titlebar__controls{background:var(--titlebar-glass-bg,rgba(${W},0.06))!important;border:0.5px solid var(--titlebar-glass-border,rgba(${W},0.10))!important;backdrop-filter:blur(var(--titlebar-glass-blur,calc(12px + ${p.glassBlur || '0px'})))!important;-webkit-backdrop-filter:blur(var(--titlebar-glass-blur,calc(12px + ${p.glassBlur || '0px'})))!important}

/* ═══ Portfolio / 画廊 ═══ */
.portfolio::before{background:rgba(${Bg},0.75);border:0.5px solid var(--card-glass-border,rgba(${W},0.06))}
.portfolio__title{color:${p.text}}
.portfolio__desc{color:${p.text3}}
.category-card{background:var(--card-glass-bg,rgba(${W},0.015));border:1px solid var(--card-glass-border,rgba(${W},0.05))}
.category-card:hover{border-color:var(--card-glass-border-bright,rgba(${W},0.16))}
.category-card__info{background:rgba(${S2},0.92);border:0.5px solid var(--card-glass-border,rgba(${W},0.08))}
.category-card__name{color:${p.text}}
.category-card__count{color:rgba(${W},0.7);background:var(--card-glass-bg,rgba(${W},0.08));border:0.5px solid var(--card-glass-border,rgba(${W},0.12))}
.category-card__count:hover{background:var(--card-glass-bg-hover,rgba(${W},0.12));border-color:var(--card-glass-border-bright,rgba(${W},0.22))}
.category-card__label{background:linear-gradient(to top,rgba(${BgD},0.85) 0%,rgba(${BgD},0.4) 60%,transparent 100%)}
.category-card__label-count{color:${p.text2}}
.category-card__rating{color:${p.accent}}
.gallery__nav{background:rgba(${Bg},0.55);border:0.5px solid var(--card-glass-border,rgba(${W},0.12))}
.gallery__nav *{text-shadow:0 1px 4px rgba(0,0,0,0.5)}
.gallery__back{color:${p.text}}
.gallery__back:hover{color:${p.accent}}
.gallery__info{color:${p.text2}}
.density-sweep{background:linear-gradient(to right,transparent 0%,rgba(${A},0.1) 50%,rgba(${Bg},0.92) 100%)}
.card--focused{outline:1.5px solid ${p.accent}}
.load-more-btn{background:var(--card-glass-bg,rgba(${W},0.05));border:0.5px solid var(--card-glass-border,rgba(${W},0.10));color:rgba(${W},0.4)}
.load-more-btn:hover{background:var(--card-glass-bg-hover,rgba(${W},0.10));border-color:var(--card-glass-border-bright,rgba(${W},0.22));color:${p.text};box-shadow:0 8px 24px rgba(0,0,0,0.4)}
.custom-dropdown__trigger{background:var(--card-glass-bg,rgba(${W},0.08));border:0.5px solid var(--card-glass-border,rgba(${W},0.12));color:${p.text2}}
.custom-dropdown__trigger:hover{background:var(--card-glass-bg-hover,rgba(${W},0.14));border-color:var(--card-glass-border-bright,rgba(${W},0.22));color:${p.text}}
.custom-dropdown__trigger--open{background:rgba(${A},0.12);border-color:rgba(${A},0.30);color:${p.accent}}
.custom-dropdown__menu{background:rgba(${S},0.95);border:0.5px solid rgba(${A},0.15);box-shadow:0 12px 40px rgba(0,0,0,0.5),inset 0 0 0 1px rgba(${A},0.04)}
.custom-dropdown__option{color:${p.text2}}
.custom-dropdown__option:hover{background:rgba(${A},0.08);color:${p.text}}
.custom-dropdown__option--sel{background:rgba(${A},0.10);color:${p.accent}}

/* ═══ 灯箱 ═══ */
.lightbox{background:rgba(0,0,0,0)}
.lightbox.active{background:rgba(0,0,0,0.85)!important;backdrop-filter:blur(var(--lightbox-glass-blur,calc(30px + ${p.glassBlur || '0px'})))!important;-webkit-backdrop-filter:blur(var(--lightbox-glass-blur,calc(30px + ${p.glassBlur || '0px'})))!important}
.lightbox__close{color:${p.text};background:var(--lightbox-glass-bg,rgba(${W},0.12));border:0.5px solid var(--lightbox-glass-border,rgba(${W},0.20))}
.lightbox__close:hover{background:var(--lightbox-glass-bg-hover,rgba(${W},0.18));border-color:var(--lightbox-glass-border,rgba(${W},0.30))}
.lightbox__prev,.lightbox__next{color:${p.text};background:var(--lightbox-glass-bg,rgba(${W},0.10));border:0.5px solid var(--lightbox-glass-border,rgba(${W},0.18))}
.lightbox__prev:hover,.lightbox__next:hover{background:var(--lightbox-glass-bg-hover,rgba(${W},0.16));border-color:var(--lightbox-glass-border,rgba(${W},0.28))}
.lightbox__title{color:${p.text3}}
.lightbox__counter{color:${p.text3}}
.rating__star{color:rgba(${W},0.2)}
.rating__star:hover{color:${p.accent}}
.rating__star--on{color:${p.accent}}
.rating__fav{color:rgba(${W},0.2)}
.rating__fav:hover{color:var(--danger)}
.rating__fav--on{color:var(--danger)}
.lightbox__exif{background:rgba(${Bg},0.78);border:0.5px solid rgba(${A},0.12)}
.exif__tag{color:rgba(${W},0.55)}
.exif__tag--camera{color:${p.text}}
.exif__tag--lens{color:${p.text2}}

/* ═══ 幻灯片 ═══ */
.slideshow{background:${p.bg}}
.slideshow__counter{color:${p.text3}}
.slideshow__controls{background:var(--lightbox-glass-bg,rgba(${W},0.06));border:0.5px solid var(--lightbox-glass-border,rgba(${W},0.08))}
.slideshow__btn{color:var(--lightbox-glass-bg-hover,rgba(${W},0.5));background:var(--lightbox-glass-bg,rgba(${W},0.05));border:0.5px solid var(--lightbox-glass-border,rgba(${W},0.08))}
.slideshow__btn:hover{color:${p.text};background:var(--lightbox-glass-bg-hover,rgba(${W},0.10));border-color:var(--lightbox-glass-border,rgba(${W},0.20))}
#sl-exit{border-color:var(--lightbox-glass-border,rgba(${W},0.14));color:rgba(${W},0.6)}
#sl-exit:hover{background:var(--lightbox-glass-bg,rgba(${W},0.12));border-color:var(--lightbox-glass-border,rgba(${W},0.3));color:${p.accent}}

/* ═══ 设置面板 ═══ */
.settings-panel{background:var(--panel-glass-bg,rgba(${S},0.92))!important;border:0.5px solid var(--panel-glass-border,rgba(${A},0.15))!important;box-shadow:0 8px 32px rgba(0,0,0,0.5),inset 0 0 0 1px rgba(${A},0.04);backdrop-filter:blur(var(--panel-glass-blur,calc(24px + ${p.glassBlur || '0px'})))!important;-webkit-backdrop-filter:blur(var(--panel-glass-blur,calc(24px + ${p.glassBlur || '0px'})))!important}
.settings-panel__label{color:${p.text2}}
.settings-panel__item:hover{background:var(--panel-glass-bg-hover,rgba(${A},0.06))}
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
.dev-panel,.dev-preview__inner,.dev-gp-float,.dev-hints{backdrop-filter:blur(var(--dev-panel-blur,calc(40px + var(--glass-blur,0px))))!important;-webkit-backdrop-filter:blur(var(--dev-panel-blur,calc(40px + var(--glass-blur,0px))))!important}
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
#loading-track{background:var(--loading-color,rgba(${W},0.55))!important;height:var(--loading-track-height,4px)!important;border-radius:var(--radius-pill,100px)!important}
#loading-orbit-light{stroke:rgba(${A},0.55)}
#loading-text{color:var(--loading-color,rgba(${W},0.55))}
#loading-hint{color:var(--loading-color-dim,rgba(${W},0.4))}
#loading-quote{color:var(--loading-color-soft,rgba(${W},0.45))}

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

/* ═══ 全局字体系统（零var()，硬编码保证WebView2生效）═══ */
/* 展示 Display — 标题/Hero/导航 */
.hero__title,.hero__subtitle,.hero__beta,.hero__scroll-line,
.portfolio__title,#section-title,
.portfolio__desc,
.category-card__name,.category-card__label-name,
.gallery__back,.gallery__item-title,.gallery__info,
.custom-dropdown__trigger,
.lightbox__title,
.slideshow__counter,.slideshow__btn,
.sidebar__item-name,.sidebar__header,.sidebar__add,
#corner-logo,#dir-label,
.toolbar__btn,
.cache-dir-btn,
.shortcuts__title,
.dev-section__title,.dev-reset-box__title,
.dev-hints__title,
#loading-text,#loading-quote,#loading-hint
{font-family:${FD}!important;font-weight:${FWD}!important;letter-spacing:${LSD}!important;font-style:${FSD}!important;text-transform:${TTR}!important;}

/* 正文 Body — 段落/描述/计数 */
body,
.portfolio__desc,
.category-card__count,.category-card__label-count,
.custom-dropdown__option,
.lightbox__counter,
.settings-panel__label,
.cache-dir-path,
.density-btn,
.shortcuts__row kbd,.shortcuts__row span,
.shortcuts__hint,
.dev-nav__tab,
.dev-section__desc,
.dev-row__label,.dev-row__value,
.dev-btn:not([data-font-preset]),.dev-gp-btn,
.dev-preset-card__name,
.dev-input,.dev-input--text,
.dev-chip-toggle,
.sidebar__item-remove,.sidebar__empty,
.gallery__item-stars,.gallery__item-fav
{font-family:${FB}!important;font-weight:${FWB}!important;letter-spacing:${LSB}!important;font-style:${FSB}!important;}

/* 辅助 Caption — EXIF/提示/时间戳 */
.exif__tag,.exif__tag--lens,.exif__tag--aperture,
.exif__tag--shutter,.exif__tag--iso,.exif__tag--focal,
.exif__tag--date,.exif__tag--dims,.exif__tag--size,
.gp-hint__label,.gp-hint--fav span,
.gp-hint--lb-fixed span,.gp-hint--rb-fixed span,
.shortcuts__section--gamepad .shortcuts__row span,
.dev-hints__desc,.dev-hints__btn,
.dev-reset-box__desc,.dev-reset-box__hint,
.dev-stick__label,.dev-axis-label,
.dev-preset-card__badge,.dev-preset-card__time,.dev-preset-card__tag,
#cache-info,
.dev-gp-float__hint
{font-family:${FC}!important;font-weight:${FWC}!important;letter-spacing:${LSC}!important;font-style:${FSC}!important;}

/* 等宽 Mono — 控制台/代码/手柄按钮 */
.dev-console,
.dev-stat,.dev-state-row
{font-family:${FM}!important;font-weight:${FWM}!important;letter-spacing:${LSM}!important;font-style:${FSM}!important;}
${window.__lensLiquidGlass ? `
/* ═══ 液态玻璃面板 — UI chrome 面板透明底板+backdrop-filter折射 ═══ */
/* 参数通过 CSS 变量调节：--lg-panel-blur(16px) / --lg-panel-saturate(1.3) / --lg-panel-refraction(150) */
.sidebar,.sidebar__add,.toolbar,.titlebar__controls,
.settings-panel,.shortcuts-panel,.shortcuts-overlay,
.dev-overlay,.dev-panel,.dev-gp-float,.dev-reset-overlay,.dev-reset-box,.dev-hints,.dev-preview__inner,
.lightbox__close,.lightbox__prev,.lightbox__next,.lightbox__exif,
.slideshow__controls,.gallery__nav,.hero__scroll,.back-to-top,[popover]
{background:rgba(255,255,255,var(--lg-panel-bg-alpha,0))!important;
backdrop-filter:blur(var(--lg-panel-blur,6px)) saturate(var(--lg-panel-saturate,1.3)) url(#lg-panel-refract)!important;
-webkit-backdrop-filter:blur(var(--lg-panel-blur,6px)) saturate(var(--lg-panel-saturate,1.3)) url(#lg-panel-refract)!important;
border:0.5px solid rgba(255,255,255,var(--lg-panel-border-alpha,0.12))!important;
box-shadow:0 8px 32px rgba(0,0,0,var(--lg-panel-shadow-alpha,0.3)),inset 0 1px 0 rgba(255,255,255,var(--lg-panel-highlight,0.08))!important;}
/* 子元素背景透明化 */
.sidebar__item:hover{background:rgba(255,255,255,0.12)!important;box-shadow:0 0 12px rgba(255,255,255,0.06);}
.sidebar__item--active{background:rgba(255,255,255,0.16)!important;box-shadow:0 0 16px rgba(255,255,255,0.1);}
.sidebar__item-remove{background:rgba(255,255,255,0.08)!important;}
.sidebar__item-remove:hover{background:rgba(255,255,255,0.2)!important;box-shadow:0 0 10px rgba(255,255,255,0.1);}
.toolbar{text-shadow:none!important;box-shadow:0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.08)!important;}
.toolbar__btn:hover,.titlebar__btn:hover{background:rgba(255,255,255,0.14)!important;box-shadow:0 0 12px rgba(255,255,255,0.08);}
/* ═══ 设置面板 — 液态玻璃定制 ═══ */
.settings-panel__item:hover{background:rgba(255,255,255,0.08)!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,0.06);}
.settings-panel__label{color:rgba(255,255,255,0.85)!important;text-shadow:0 0 8px rgba(255,255,255,0.15);}
.settings-panel__divider{background:rgba(255,255,255,0.08)!important;backdrop-filter:blur(4px);}
.cache-dir-path{background:rgba(255,255,255,0.04)!important;border:0.5px solid rgba(255,255,255,0.08)!important;border-radius:8px;color:rgba(255,255,255,0.6)!important;}
.cache-dir-btn{background:rgba(255,255,255,0.06)!important;border:0.5px solid rgba(255,255,255,0.1)!important;color:rgba(255,255,255,0.7)!important;border-radius:8px;}
.cache-dir-btn:hover{background:rgba(255,255,255,0.12)!important;border-color:rgba(255,255,255,0.2)!important;color:rgba(255,255,255,0.9)!important;}
/* 设置面板开关 — 玻璃药丸 */
.toggle-switch{background:rgba(255,255,255,0.08)!important;border:0.5px solid rgba(255,255,255,0.12)!important;box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);}
.toggle-switch::after{background:rgba(255,255,255,0.7)!important;box-shadow:0 1px 3px rgba(0,0,0,0.3);}
.toggle-switch--on{background:rgba(255,255,255,0.2)!important;border-color:rgba(255,255,255,0.25)!important;box-shadow:0 0 12px rgba(255,255,255,0.15),inset 0 1px 3px rgba(0,0,0,0.2);}
.toggle-switch--on::after{background:rgba(255,255,255,0.95)!important;box-shadow:0 0 8px rgba(255,255,255,0.3);}
/* 密度按钮 — 玻璃芯片 */
.density-btns{background:rgba(255,255,255,0.04)!important;border:0.5px solid rgba(255,255,255,0.08)!important;border-radius:10px;}
.density-btn{color:rgba(255,255,255,0.5)!important;border-radius:8px;}
.density-btn:hover{background:rgba(255,255,255,0.12)!important;color:rgba(255,255,255,0.85)!important;box-shadow:0 0 10px rgba(255,255,255,0.08);}
.density-btn--active{background:rgba(255,255,255,0.18)!important;color:rgba(255,255,255,0.95)!important;box-shadow:0 0 14px rgba(255,255,255,0.15);}
.lightbox__exif{background:transparent!important;}
.slideshow{background:rgba(0,0,0,0.88)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;}
.slideshow__btn{background:rgba(255,255,255,0.04)!important;}
.slideshow__btn:hover{background:rgba(255,255,255,0.14)!important;box-shadow:0 0 12px rgba(255,255,255,0.08);}
.shortcuts__row kbd{background:rgba(255,255,255,0.06)!important;}
.shortcuts-panel{backdrop-filter:blur(var(--lg-panel-blur,6px)) saturate(var(--lg-panel-saturate,1.3)) url(#lg-panel-refract)!important;}
.dev-nav{background:transparent!important;}
.dev-preset-card{background:rgba(255,255,255,0.04)!important;}
.dev-preset-card:hover{background:rgba(255,255,255,0.12)!important;box-shadow:0 0 16px rgba(255,255,255,0.08);}
.dev-preset-card--active{background:rgba(255,255,255,0.14)!important;box-shadow:0 0 20px rgba(255,255,255,0.12);}
.dev-toggle{background:rgba(255,255,255,0.1)!important;}
.dev-toggle--on{background:rgba(255,255,255,0.22)!important;box-shadow:0 0 10px rgba(255,255,255,0.12);}
.dev-chip-toggle{background:rgba(255,255,255,0.06)!important;}
.dev-chip-toggle--on{background:rgba(255,255,255,0.16)!important;box-shadow:0 0 10px rgba(255,255,255,0.1);}
.dev-btn:hover{background:rgba(255,255,255,0.12)!important;box-shadow:0 0 10px rgba(255,255,255,0.08);}
.density-btns{background:rgba(255,255,255,0.04)!important;}
.density-btn:hover{background:rgba(255,255,255,0.06)!important;}
.density-btn--active{background:rgba(255,255,255,0.1)!important;}
.dev-gp-btn{background:rgba(255,255,255,0.04)!important;}
.dev-gp-btn--on{background:rgba(255,255,255,0.14)!important;box-shadow:0 0 12px rgba(255,255,255,0.1);}
.hero__scroll:hover{background:rgba(255,255,255,0.14)!important;box-shadow:0 0 16px rgba(255,255,255,0.08);}
` : ''}
`;
}

// ── 直接内联样式（最高优先级，@import CSS 无法覆盖）──
function applyDirectStyles(p) {
  const W = p.warm;
  const GB = p.glassBlur || '0px';
  const root = document.documentElement;

  // body
  document.body.style.backgroundColor = p.bg;
  document.body.style.color = p.text;

  // 分区玻璃 CSS 变量设为 documentElement 内联样式（WebView2 兼容：getComputedStyle 可读）
  // 仅当 __lensZoneGlassDirty 为 true 时写入（预设切换后），否则保留用户手动覆盖
  // 模糊值使用 calc(Npx + var(--glass-blur,0px)) 动态表达式，让全局 --glass-blur 滑块实时生效
  if (window.__lensZoneGlassDirty) {
    root.style.setProperty('--sidebar-glass-bg', `rgba(${W},0.08)`);
    root.style.setProperty('--sidebar-glass-border', `rgba(${W},0.12)`);
    root.style.setProperty('--sidebar-glass-bg-hover', `rgba(${W},0.14)`);
    root.style.setProperty('--sidebar-glass-border-bright', `rgba(${W},0.22)`);
    root.style.setProperty('--sidebar-glass-blur', 'calc(24px + var(--glass-blur,0px))');
    root.style.setProperty('--titlebar-glass-bg', `rgba(${W},0.06)`);
    root.style.setProperty('--titlebar-glass-border', `rgba(${W},0.10)`);
    root.style.setProperty('--titlebar-glass-bg-hover', `rgba(${W},0.12)`);
    root.style.setProperty('--titlebar-btn-color', `rgba(${W},0.45)`);
    root.style.setProperty('--titlebar-glass-blur', 'calc(12px + var(--glass-blur,0px))');
    root.style.setProperty('--toolbar-glass-bg', `rgba(${W},0.06)`);
    root.style.setProperty('--toolbar-glass-border', `rgba(${W},0.10)`);
    root.style.setProperty('--toolbar-glass-bg-hover', `rgba(${W},0.10)`);
    root.style.setProperty('--toolbar-btn-color', `rgba(${W},0.45)`);
    root.style.setProperty('--toolbar-glass-blur', 'calc(16px + var(--glass-blur,0px))');
    root.style.setProperty('--card-glass-bg', `rgba(${W},0.015)`);
    root.style.setProperty('--card-glass-border', `rgba(${W},0.05)`);
    root.style.setProperty('--card-glass-bg-hover', `rgba(${W},0.06)`);
    root.style.setProperty('--card-glass-border-bright', `rgba(${W},0.16)`);
    root.style.setProperty('--card-hover-blur', 'calc(6px + var(--glass-blur,0px))');
    root.style.setProperty('--gallery-nav-blur', 'calc(24px + var(--glass-blur,0px))');
    root.style.setProperty('--dropdown-blur', 'calc(12px + var(--glass-blur,0px))');
    root.style.setProperty('--panel-glass-bg', `rgba(${p.surfaceRgb},0.92)`);
    root.style.setProperty('--panel-glass-border', `rgba(${p.accentRgb},0.15)`);
    root.style.setProperty('--panel-glass-bg-hover', `rgba(${p.accentRgb},0.06)`);
    root.style.setProperty('--panel-glass-blur', 'calc(24px + var(--glass-blur,0px))');
    root.style.setProperty('--shortcuts-blur', 'calc(30px + var(--glass-blur,0px))');
    root.style.setProperty('--lightbox-glass-bg', `rgba(${W},0.12)`);
    root.style.setProperty('--lightbox-glass-border', `rgba(${W},0.20)`);
    root.style.setProperty('--lightbox-glass-bg-hover', `rgba(${W},0.18)`);
    root.style.setProperty('--lightbox-glass-blur', 'calc(30px + var(--glass-blur,0px))');
    root.style.setProperty('--lightbox-btn-blur', 'calc(20px + var(--glass-blur,0px))');
    root.style.setProperty('--lightbox-exif-blur', 'calc(16px + var(--glass-blur,0px))');
    root.style.setProperty('--slideshow-blur', 'calc(20px + var(--glass-blur,0px))');
    root.style.setProperty('--hero-scroll-blur', 'calc(20px + var(--glass-blur,0px))');
    root.style.setProperty('--back-to-top-blur', 'calc(20px + var(--glass-blur,0px))');
    root.style.setProperty('--dev-panel-blur', 'calc(40px + var(--glass-blur,0px))');
    window.__lensZoneGlassDirty = false;
  }

  // Hero 标题 — 必须用 setProperty priority=important 才能在零var()体系内击败样式表!important
  const heroTitle = document.querySelector('.hero__title');
  if (heroTitle) {
    heroTitle.style.setProperty('background', `linear-gradient(180deg, rgba(${p.heroGradTop},1) 0%, rgba(${p.heroGradMid},0.85) 40%, rgba(${p.heroGradBot},0.25) 100%)`, 'important');
    heroTitle.style.setProperty('-webkit-background-clip', 'text', 'important');
    heroTitle.style.setProperty('background-clip', 'text', 'important');
    heroTitle.style.setProperty('color', 'transparent', 'important');
    heroTitle.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
  }
  // 副标题
  const subtitle = document.querySelector('.hero__subtitle');
  if (subtitle) subtitle.style.color = p.heroSubtitleColor || `rgba(${W},0.3)`;
  // 角标
  const cornerLogo = document.getElementById('corner-logo');
  if (cornerLogo) cornerLogo.style.color = p.cornerLogoColor || `rgba(${W},0.85)`;
  // 装饰线（伪元素无法用内联样式，保留 CSS 规则）
  // 液态玻璃模式下跳过内联背景（由 generateFullCSS 中的玻璃 CSS 接管）
  if (!window.__lensLiquidGlass) {
    const devPanel = document.getElementById('dev-panel');
    if (devPanel) devPanel.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
    const devOverlay = document.getElementById('dev-overlay');
    if (devOverlay) devOverlay.style.background = `rgba(${p.bgDeepRgb},0.55)`;
    const devPreviewInner = document.querySelector('.dev-preview__inner');
    if (devPreviewInner) devPreviewInner.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
    const devGpFloat = document.querySelector('.dev-gp-float');
    if (devGpFloat) devGpFloat.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
    const devHints = document.querySelector('.dev-hints');
    if (devHints) devHints.style.background = p.devPanelBg || `rgba(${p.bgRgb},0.94)`;
  } else {
    const devPanel = document.getElementById('dev-panel');
    if (devPanel) devPanel.style.background = 'transparent';
    const devOverlay = document.getElementById('dev-overlay');
    if (devOverlay) devOverlay.style.background = 'transparent';
    ['dev-preview__inner','dev-gp-float','dev-hints'].forEach(cls => {
      const el = document.querySelector('.' + cls);
      if (el) el.style.background = 'transparent';
    });
  }
}

// ── 注入 / 更新 ──
function initColorSystem(palette) {
  // 首次初始化时允许 applyDirectStyles 写入分区玻璃默认值
  if (window.__lensZoneGlassDirty === undefined) window.__lensZoneGlassDirty = true;
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
    '--accent-rgb': palette.accentRgb,
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
