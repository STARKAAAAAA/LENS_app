// ========== 开发者面板 — LENS Developer Panel ==========
// 快捷键 Ctrl+Shift+D 打开  手柄 START+BACK 打开

import { updateColorSystem, paletteToVars, BUILTIN_PALETTES as COLOR_PRESETS } from './colors.js';
import { mountLiquidGlass, unmountLiquidGlass, isLiquidGlassMounted, getStudio } from './liquid-glass.js';
import { enableLiquidGlassPanels, disableLiquidGlassPanels, isLiquidGlassPanelsActive, updatePanelBlur, updatePanelSaturate, updatePanelRefraction } from './lg-panels.js';
import { initColorPickers, syncColorTrigger, syncAllColorTriggers } from './color-picker.js';
import { ANIMATION_TYPES, getAnimationType, setAnimationType, createMiniShaderPreview, ensureAuroraCSS, updateAuroraColors, ensureFallingCSS, buildFallingVars, ensureGradientBarsCSS, createAuroraBackground, disposeAuroraBackground, createFallingBackground, disposeFallingBackground, createGradientBarsBackground, disposeGradientBarsBackground, createWebGLBackground, disposeWebGLBackground, createVolAuroraBackground, createWaveGridBackground, createDitherBackground } from './loading-shaders.js';

const api = window.electronAPI;

// dev panel 使用独立的预设系统，不依赖 toggles.js

// ── 模块内部状态 ──
const D = {
  open: false,
  closing: false,
  activeGroup: 'presets',
  fpsRaf: null, fpsHistory: [], fpsLastTime: 0,
  consoleBuffer: [],
  consoleOrig: { log: null, warn: null, error: null, debug: null },
  gamepadPollRaf: null,
  perfInterval: null,
  _consoleRefreshInterval: null,
  _closeFallback: null,
  _closeOnEnd: null,
  gpEventLog: [],
  invokeLog: [],
  perfToggles: { fps: true, metrics: true, invoke: true, console: true },
  _previewAnimRaf: null,
  _previewAnimStart: 0,
  liquidGlassInstances: [],
  liquidGlassOn: false,
};
const CONSOLE_MAX = 200;
const FPS_MAX = 60;
const GP_EVENT_MAX = 20;
const INVOKE_MAX = 50;

// localStorage keys
const PRESETS_KEY = 'lens-dev-presets';
const ACTIVE_PRESET_KEY = 'lens-dev-active-preset';
const SESSION_KEY = 'lens-dev-session-vars';

// CSS 变量快照键
const CSS_VAR_KEYS = [
  '--accent','--bg','--bg-deep','--text','--text-2','--text-3',
  '--glass-bg','--glass-border','--glass-bg-hover','--glass-border-bright',
  '--radius','--radius-sm','--radius-pill',
  '--thumb-card-size','--font-scale','--anim-speed','--glass-blur',
  '--font-display','--font-body','--font-weight-display','--font-weight-body',
  '--letter-spacing-display','--letter-spacing-body',
  '--font-style-display','--font-style-body','--text-transform','--font-caption','--font-mono','--font-weight-caption','--font-weight-mono','--letter-spacing-caption','--letter-spacing-mono','--font-style-caption','--font-style-mono',
  '--font-scale-heading','--line-spacing',
  '--section-gap','--gap-scale','--card-bg','--card-hover-bg','--card-shadow','--shadow-depth',
  '--loading-color','--loading-color-dim','--loading-color-soft','--loading-track-height',
  '--ease-out','--ease-spring',
  '--hero-grad-top','--hero-grad-mid','--hero-grad-bot',
  '--corner-logo-color',
  '--hero-subtitle-color','--hero-line-color',
  '--dev-panel-bg',
  // 分区玻璃（解耦各区域毛玻璃效果）
  '--sidebar-glass-bg','--sidebar-glass-border','--sidebar-glass-bg-hover','--sidebar-glass-border-bright','--sidebar-glass-blur',
  '--titlebar-glass-bg','--titlebar-glass-border','--titlebar-glass-bg-hover','--titlebar-btn-color','--titlebar-glass-blur',
  '--toolbar-glass-bg','--toolbar-glass-border','--toolbar-glass-bg-hover','--toolbar-btn-color','--toolbar-glass-blur',
  '--card-glass-bg','--card-glass-border','--card-glass-bg-hover','--card-glass-border-bright','--card-hover-blur','--gallery-nav-blur','--dropdown-blur',
  '--panel-glass-bg','--panel-glass-border','--panel-glass-bg-hover','--panel-glass-blur','--shortcuts-blur',
  '--lightbox-glass-bg','--lightbox-glass-border','--lightbox-glass-bg-hover','--lightbox-glass-blur','--lightbox-btn-blur','--lightbox-exif-blur','--slideshow-blur',
  '--hero-scroll-blur','--back-to-top-blur','--dev-panel-blur',
];

// 分区玻璃变量列表 — 预设加载/重置时清除覆盖
const ZONE_GLASS_VARS = [
  '--sidebar-glass-bg','--sidebar-glass-border','--sidebar-glass-bg-hover','--sidebar-glass-border-bright','--sidebar-glass-blur',
  '--titlebar-glass-bg','--titlebar-glass-border','--titlebar-glass-bg-hover','--titlebar-btn-color','--titlebar-glass-blur',
  '--toolbar-glass-bg','--toolbar-glass-border','--toolbar-glass-bg-hover','--toolbar-btn-color','--toolbar-glass-blur',
  '--card-glass-bg','--card-glass-border','--card-glass-bg-hover','--card-glass-border-bright','--card-hover-blur','--gallery-nav-blur','--dropdown-blur',
  '--panel-glass-bg','--panel-glass-border','--panel-glass-bg-hover','--panel-glass-blur','--shortcuts-blur',
  '--lightbox-glass-bg','--lightbox-glass-border','--lightbox-glass-bg-hover','--lightbox-glass-blur','--lightbox-btn-blur','--lightbox-exif-blur','--slideshow-blur',
  '--hero-scroll-blur','--back-to-top-blur','--dev-panel-blur',
];

// 字体族预设
const ALL_FONT_PRESETS = [
  ['cormorant-g', 'Cormorant G.', "'Cormorant Garamond', Georgia, serif"],
  ['cormorant', 'Cormorant', "'Cormorant', Georgia, serif"],
  ['georgia', 'Georgia', "Georgia, 'Times New Roman', serif"],
  ['system', 'System UI', "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"],
  ['plex', 'Plex Sans', "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif"],
  ['saira', 'Saira Cond.', "'Saira Condensed', 'Cormorant Garamond', Georgia, sans-serif"],
  ['xbox', 'Xbox', "'Xbox', 'Arial Black', Impact, sans-serif"],
  ['impact', 'Arial Black', "'Arial Black', Impact, 'Helvetica Neue', sans-serif"],
  ['consolas', 'Consolas', "'Consolas', 'Courier New', 'SF Mono', monospace"],
  ['jetbrains', 'JetBrains', "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace"],
  ['ibmmono', 'Plex Mono', "'IBM Plex Mono', ui-monospace, monospace"],
  ['sfmono', 'SF Mono', "'SF Mono', ui-monospace, monospace"],
];

// 所有字体分类使用相同的统一字体列表
const FONT_FAMILY_PRESETS = {
  display: ALL_FONT_PRESETS,
  body: ALL_FONT_PRESETS,
  caption: ALL_FONT_PRESETS,
  mono: ALL_FONT_PRESETS,
};

// CSS 变量默认值（init 时从 :root 捕获）
let CSS_DEFAULTS = {};

// ── 内置预设 ──
const BUILTIN_PRESETS = [
  {
    id: '__default__', name: '默认', builtin: true,
    vars: {
      '--accent':'#c8a87c','--bg':'#0a0a08','--bg-deep':'#060605',
      '--text':'#e8e4e0','--text-2':'#9a948e','--text-3':'#5a5450',
      '--glass-bg':'rgba(220,200,180,0.06)','--glass-border':'rgba(220,200,180,0.10)',
      '--glass-bg-hover':'rgba(220,200,180,0.12)','--glass-border-bright':'rgba(220,200,180,0.20)',
      '--radius':'20px','--radius-sm':'14px','--radius-pill':'100px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0.05em','--letter-spacing-body':'0.04em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.04em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(220,200,180,0.55)','--loading-color-dim':'rgba(220,200,180,0.40)','--loading-color-soft':'rgba(220,200,180,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1','--line-spacing':'1.7',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(220,200,180,0.015)','--card-hover-bg':'rgba(220,200,180,0.06)',
      '--card-shadow':'0 4px 24px rgba(0,0,0,0.3)','--shadow-depth':'1',
      '--hero-grad-top':'rgba(255,245,235,1)','--hero-grad-mid':'rgba(220,200,175,0.85)','--hero-grad-bot':'rgba(180,155,130,0.25)',
      '--corner-logo-color':'rgba(220,200,175,0.85)','--hero-subtitle-color':'rgba(220,200,180,0.3)','--hero-line-color':'rgba(220,200,180,0.35)',
    },
  },
  {
    id: '__apple__', name: 'Apple', builtin: true,
    vars: {
      '--accent':'#0066cc','--bg':'#000000','--bg-deep':'#000000',
      '--text':'#ffffff','--text-2':'#cccccc','--text-3':'#999999',
      '--glass-bg':'rgba(255,255,255,0.025)','--glass-border':'rgba(255,255,255,0.06)',
      '--glass-bg-hover':'rgba(255,255,255,0.05)','--glass-border-bright':'rgba(255,255,255,0.10)',
      '--radius':'18px','--radius-sm':'8px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-body':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-weight-display':'600','--font-weight-body':'400',
      '--letter-spacing-display':'-0.01em','--letter-spacing-body':'-0.022em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",'--font-mono':"'SF Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'-0.016em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(0,102,204,0.55)','--loading-color-dim':'rgba(0,102,204,0.40)','--loading-color-soft':'rgba(0,102,204,0.45)',
      '--ease-out':'cubic-bezier(0.25,0.1,0.25,1)','--ease-spring':'cubic-bezier(0.25,0.1,0.25,1)',
      '--font-scale-heading':'1','--line-spacing':'1.47',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(255,255,255,0.015)','--card-hover-bg':'rgba(255,255,255,0.04)',
      '--card-shadow':'rgba(0,0,0,0.22) 3px 5px 30px','--shadow-depth':'0.5',
      '--hero-grad-top':'rgba(235,240,255,1)','--hero-grad-mid':'rgba(180,190,210,0.8)','--hero-grad-bot':'rgba(80,90,110,0.25)',
      '--corner-logo-color':'rgba(255,255,255,0.88)','--hero-subtitle-color':'rgba(255,255,255,0.25)','--hero-line-color':'rgba(255,255,255,0.12)',
    },
  },
  {
    id: '__apple-light__', name: 'Apple Light', builtin: true,
    vars: {
      '--accent':'#0066cc','--bg':'#ffffff','--bg-deep':'#f5f5f7',
      '--text':'#1d1d1f','--text-2':'#86868b','--text-3':'#aeaeb2',
      '--glass-bg':'rgba(0,0,0,0.02)','--glass-border':'rgba(0,0,0,0.04)',
      '--glass-bg-hover':'rgba(0,0,0,0.04)','--glass-border-bright':'rgba(0,0,0,0.08)',
      '--radius':'18px','--radius-sm':'8px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-body':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-weight-display':'600','--font-weight-body':'400',
      '--letter-spacing-display':'-0.01em','--letter-spacing-body':'-0.022em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",'--font-mono':"'SF Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'-0.016em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(0,102,204,0.55)','--loading-color-dim':'rgba(0,102,204,0.40)','--loading-color-soft':'rgba(0,102,204,0.45)',
      '--ease-out':'cubic-bezier(0.25,0.1,0.25,1)','--ease-spring':'cubic-bezier(0.25,0.1,0.25,1)',
      '--font-scale-heading':'1','--line-spacing':'1.47',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(0,0,0,0.015)','--card-hover-bg':'rgba(0,0,0,0.04)',
      '--card-shadow':'0 1px 8px rgba(0,0,0,0.06)','--shadow-depth':'0.25',
      '--hero-grad-top':'rgba(20,20,22,1)','--hero-grad-mid':'rgba(60,60,65,0.75)','--hero-grad-bot':'rgba(140,140,150,0.3)',
      '--corner-logo-color':'rgba(29,29,31,0.85)','--hero-subtitle-color':'rgba(0,0,0,0.35)','--hero-line-color':'rgba(0,0,0,0.12)',
    },
  },
  {
    id: '__apple-parchment__', name: 'Apple Parchment', builtin: true,
    vars: {
      '--accent':'#0066cc','--bg':'#f5f5f7','--bg-deep':'#e8e8ed',
      '--text':'#1d1d1f','--text-2':'#6e6e73','--text-3':'#aeaeb2',
      '--glass-bg':'rgba(0,0,0,0.018)','--glass-border':'rgba(0,0,0,0.035)',
      '--glass-bg-hover':'rgba(0,0,0,0.035)','--glass-border-bright':'rgba(0,0,0,0.06)',
      '--radius':'18px','--radius-sm':'8px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-body':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-weight-display':'600','--font-weight-body':'400',
      '--letter-spacing-display':'-0.01em','--letter-spacing-body':'-0.022em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",'--font-mono':"'SF Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'-0.016em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(0,102,204,0.5)','--loading-color-dim':'rgba(0,102,204,0.35)','--loading-color-soft':'rgba(0,102,204,0.4)',
      '--ease-out':'cubic-bezier(0.25,0.1,0.25,1)','--ease-spring':'cubic-bezier(0.25,0.1,0.25,1)',
      '--font-scale-heading':'1','--line-spacing':'1.47',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(0,0,0,0.01)','--card-hover-bg':'rgba(0,0,0,0.03)',
      '--card-shadow':'0 1px 6px rgba(0,0,0,0.04)','--shadow-depth':'0.2',
      '--hero-grad-top':'rgba(20,20,22,1)','--hero-grad-mid':'rgba(70,70,75,0.7)','--hero-grad-bot':'rgba(160,160,170,0.25)',
      '--corner-logo-color':'rgba(29,29,31,0.8)','--hero-subtitle-color':'rgba(0,0,0,0.3)','--hero-line-color':'rgba(0,0,0,0.10)',
    },
  },
  {
    id: '__ibm__', name: 'IBM', builtin: true,
    vars: {
      '--accent':'#0f62fe','--bg':'#161616','--bg-deep':'#0d0d0d',
      '--text':'#ffffff','--text-2':'#c6c6c6','--text-3':'#8c8c8c',
      '--glass-bg':'rgba(255,255,255,0.02)','--glass-border':'rgba(255,255,255,0.05)',
      '--glass-bg-hover':'rgba(255,255,255,0.04)','--glass-border-bright':'rgba(255,255,255,0.10)',
      '--radius':'0px','--radius-sm':'0px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      '--font-body':"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0','--letter-spacing-body':'0.16px','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",'--font-mono':"'IBM Plex Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.32px','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(15,98,254,0.5)','--loading-color-dim':'rgba(15,98,254,0.35)','--loading-color-soft':'rgba(15,98,254,0.4)',
      '--ease-out':'cubic-bezier(0.2,0,0.38,0.9)','--ease-spring':'cubic-bezier(0,0,0.3,1)',
      '--font-scale-heading':'1','--line-spacing':'1.5',
      '--section-gap':'1rem','--gap-scale':'1',
      '--card-bg':'rgba(255,255,255,0.015)','--card-hover-bg':'rgba(255,255,255,0.04)',
      '--card-shadow':'none','--shadow-depth':'0',
      '--hero-grad-top':'rgba(235,240,255,1)','--hero-grad-mid':'rgba(160,180,220,0.8)','--hero-grad-bot':'rgba(30,50,100,0.25)',
      '--corner-logo-color':'rgba(15,98,254,0.9)','--hero-subtitle-color':'rgba(198,198,198,0.25)','--hero-line-color':'rgba(255,255,255,0.12)',
    },
  },
  {
    id: '__ibm-light__', name: 'IBM Light', builtin: true,
    vars: {
      '--accent':'#0f62fe','--bg':'#ffffff','--bg-deep':'#f4f4f4',
      '--text':'#161616','--text-2':'#525252','--text-3':'#8c8c8c',
      '--glass-bg':'rgba(0,0,0,0.02)','--glass-border':'rgba(0,0,0,0.04)',
      '--glass-bg-hover':'rgba(0,0,0,0.03)','--glass-border-bright':'rgba(0,0,0,0.08)',
      '--radius':'0px','--radius-sm':'0px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      '--font-body':"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0','--letter-spacing-body':'0.16px','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",'--font-mono':"'IBM Plex Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.32px','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(15,98,254,0.5)','--loading-color-dim':'rgba(15,98,254,0.35)','--loading-color-soft':'rgba(15,98,254,0.4)',
      '--ease-out':'cubic-bezier(0.2,0,0.38,0.9)','--ease-spring':'cubic-bezier(0,0,0.3,1)',
      '--font-scale-heading':'1','--line-spacing':'1.5',
      '--section-gap':'1rem','--gap-scale':'1',
      '--card-bg':'rgba(0,0,0,0.01)','--card-hover-bg':'rgba(0,0,0,0.04)',
      '--card-shadow':'none','--shadow-depth':'0',
      '--hero-grad-top':'rgba(22,22,22,1)','--hero-grad-mid':'rgba(60,60,65,0.75)','--hero-grad-bot':'rgba(180,195,220,0.3)',
      '--corner-logo-color':'rgba(15,98,254,0.85)','--hero-subtitle-color':'rgba(22,22,22,0.3)','--hero-line-color':'rgba(15,98,254,0.2)',
    },
  },
  {
    id: '__bugatti__', name: 'Bugatti', builtin: true,
    vars: {
      '--accent':'#ffffff','--bg':'#000000','--bg-deep':'#000000',
      '--text':'#ffffff','--text-2':'#cccccc','--text-3':'#999999',
      '--glass-bg':'rgba(255,255,255,0.015)','--glass-border':'rgba(255,255,255,0.04)',
      '--glass-bg-hover':'rgba(255,255,255,0.025)','--glass-border-bright':'rgba(255,255,255,0.07)',
      '--radius':'0px','--radius-sm':'0px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'Saira Condensed', 'Cormorant Garamond', Georgia, sans-serif",
      '--font-body':"'Cormorant Garamond', Georgia, serif",
      '--font-weight-display':'400','--font-weight-body':'400',
      '--letter-spacing-display':'4px','--letter-spacing-body':'0','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'uppercase','--font-caption':"'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",'--font-mono':"'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'2px','--letter-spacing-mono':'2.5px','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(255,255,255,0.35)','--loading-color-dim':'rgba(255,255,255,0.2)','--loading-color-soft':'rgba(255,255,255,0.25)',
      '--ease-out':'cubic-bezier(0.3,0,0.7,1)','--ease-spring':'cubic-bezier(0.3,0,0.7,1)',
      '--font-scale-heading':'1','--line-spacing':'1.5',
      '--section-gap':'2rem','--gap-scale':'1',
      '--card-bg':'rgba(255,255,255,0.008)','--card-hover-bg':'rgba(255,255,255,0.02)',
      '--card-shadow':'none','--shadow-depth':'0',
      '--hero-grad-top':'rgba(245,245,248,0.95)','--hero-grad-mid':'rgba(170,170,175,0.6)','--hero-grad-bot':'rgba(50,50,55,0.25)',
      '--corner-logo-color':'rgba(255,255,255,0.92)','--hero-subtitle-color':'rgba(255,255,255,0.2)','--hero-line-color':'rgba(255,255,255,0.08)',
    },
  },
  {
    id: '__bugatti-silver__', name: 'Bugatti Silver', builtin: true,
    vars: {
      '--accent':'#c3d9f3','--bg':'#0d0d0d','--bg-deep':'#080808',
      '--text':'#ffffff','--text-2':'#e6e6e6','--text-3':'#999999',
      '--glass-bg':'rgba(255,255,255,0.015)','--glass-border':'rgba(255,255,255,0.04)',
      '--glass-bg-hover':'rgba(255,255,255,0.03)','--glass-border-bright':'rgba(255,255,255,0.08)',
      '--radius':'0px','--radius-sm':'0px','--radius-pill':'9999px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'Saira Condensed', 'Cormorant Garamond', Georgia, sans-serif",
      '--font-body':"'Cormorant Garamond', Georgia, serif",
      '--font-weight-display':'400','--font-weight-body':'400',
      '--letter-spacing-display':'3px','--letter-spacing-body':'0','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'uppercase','--font-caption':"'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",'--font-mono':"'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'2px','--letter-spacing-mono':'2.5px','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(195,217,243,0.35)','--loading-color-dim':'rgba(195,217,243,0.2)','--loading-color-soft':'rgba(195,217,243,0.25)',
      '--ease-out':'cubic-bezier(0.3,0,0.7,1)','--ease-spring':'cubic-bezier(0.3,0,0.7,1)',
      '--font-scale-heading':'1','--line-spacing':'1.5',
      '--section-gap':'2rem','--gap-scale':'1',
      '--card-bg':'rgba(195,217,243,0.015)','--card-hover-bg':'rgba(195,217,243,0.04)',
      '--card-shadow':'none','--shadow-depth':'0',
      '--hero-grad-top':'rgba(245,248,255,0.95)','--hero-grad-mid':'rgba(180,200,225,0.65)','--hero-grad-bot':'rgba(50,60,80,0.25)',
      '--corner-logo-color':'rgba(195,217,243,0.9)','--hero-subtitle-color':'rgba(255,255,255,0.2)','--hero-line-color':'rgba(195,217,243,0.2)',
    },
  },
  {
    id: '__warm__', name: '暖琥珀', builtin: true,
    vars: {
      '--accent':'#d4a040','--bg':'#0a0804','--bg-deep':'#060402',
      '--text':'#f0e8d8','--text-2':'#b0a080','--text-3':'#908870',
      '--glass-bg':'rgba(240,200,140,0.08)','--glass-border':'rgba(240,200,140,0.12)',
      '--glass-bg-hover':'rgba(240,200,140,0.14)','--glass-border-bright':'rgba(240,200,140,0.22)',
      '--radius':'20px','--radius-sm':'14px','--radius-pill':'100px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0.06em','--letter-spacing-body':'0.04em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.04em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(240,200,140,0.55)','--loading-color-dim':'rgba(240,200,140,0.40)','--loading-color-soft':'rgba(240,200,140,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1','--line-spacing':'1.7',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(240,200,140,0.015)','--card-hover-bg':'rgba(240,200,140,0.06)',
      '--card-shadow':'0 4px 24px rgba(0,0,0,0.3)','--shadow-depth':'1',
    },
  },
  {
    id: '__cool__', name: '冷石板', builtin: true,
    vars: {
      '--accent':'#8ca8c8','--bg':'#08080c','--bg-deep':'#040406',
      '--text':'#e0e4e8','--text-2':'#8c9098','--text-3':'#787c84',
      '--glass-bg':'rgba(180,190,210,0.06)','--glass-border':'rgba(180,190,210,0.10)',
      '--glass-bg-hover':'rgba(180,190,210,0.12)','--glass-border-bright':'rgba(180,190,210,0.20)',
      '--radius':'18px','--radius-sm':'12px','--radius-pill':'100px',
      '--thumb-card-size':'280px','--font-scale':'1','--anim-speed':'1','--glass-blur':'0px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0.06em','--letter-spacing-body':'0.04em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.04em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(180,190,210,0.55)','--loading-color-dim':'rgba(180,190,210,0.40)','--loading-color-soft':'rgba(180,190,210,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1','--line-spacing':'1.7',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(180,190,210,0.015)','--card-hover-bg':'rgba(180,190,210,0.06)',
      '--card-shadow':'0 4px 24px rgba(0,0,0,0.3)','--shadow-depth':'1',
    },
  },
  {
    id: '__contrast__', name: '高对比度', builtin: true,
    vars: {
      '--accent':'#ffcc44','--bg':'#000000','--bg-deep':'#000000',
      '--text':'#ffffff','--text-2':'#cccccc','--text-3':'#aaaaaa',
      '--glass-bg':'rgba(255,255,255,0.08)','--glass-border':'rgba(255,255,255,0.15)',
      '--glass-bg-hover':'rgba(255,255,255,0.14)','--glass-border-bright':'rgba(255,255,255,0.25)',
      '--radius':'20px','--radius-sm':'14px','--radius-pill':'100px',
      '--thumb-card-size':'360px','--font-scale':'1.1','--anim-speed':'0.5','--glass-blur':'0px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-weight-display':'400','--font-weight-body':'400',
      '--letter-spacing-display':'0.08em','--letter-spacing-body':'0.05em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.05em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(255,255,255,0.55)','--loading-color-dim':'rgba(255,255,255,0.40)','--loading-color-soft':'rgba(255,255,255,0.45)',
      '--font-scale-heading':'1','--line-spacing':'1.7',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(220,200,180,0.015)','--card-hover-bg':'rgba(220,200,180,0.06)',
      '--card-shadow':'0 4px 24px rgba(0,0,0,0.3)','--shadow-depth':'1',
    },
  },
  {
    id: '__mono__', name: '极简黑白', builtin: true,
    vars: {
      '--accent':'#aaaaaa','--bg':'#080808','--bg-deep':'#040404',
      '--text':'#f0f0f0','--text-2':'#aaaaaa','--text-3':'#888888',
      '--glass-bg':'rgba(255,255,255,0.04)','--glass-border':'rgba(255,255,255,0.08)',
      '--glass-bg-hover':'rgba(255,255,255,0.08)','--glass-border-bright':'rgba(255,255,255,0.15)',
      '--radius':'12px','--radius-sm':'8px','--radius-pill':'80px',
      '--thumb-card-size':'260px','--font-scale':'1','--anim-speed':'1.5','--glass-blur':'0px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0.12em','--letter-spacing-body':'0.06em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.06em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(255,255,255,0.55)','--loading-color-dim':'rgba(255,255,255,0.40)','--loading-color-soft':'rgba(255,255,255,0.45)',
      '--font-scale-heading':'1','--line-spacing':'1.5',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(255,255,255,0.02)','--card-hover-bg':'rgba(255,255,255,0.05)',
      '--card-shadow':'0 4px 24px rgba(0,0,0,0.3)','--shadow-depth':'1',
    },
  },
  {
    id: '__forest__', name: '暗林深绿', builtin: true,
    vars: {
      '--accent':'#7a9a6e','--bg':'#0a0c08','--bg-deep':'#060804',
      '--text':'#e4e8e0','--text-2':'#8c9488','--text-3':'#788470',
      '--glass-bg':'rgba(160,200,140,0.06)','--glass-border':'rgba(160,200,140,0.10)',
      '--glass-bg-hover':'rgba(160,200,140,0.12)','--glass-border-bright':'rgba(160,200,140,0.20)',
      '--radius':'16px','--radius-sm':'10px','--radius-pill':'90px',
      '--thumb-card-size':'300px','--font-scale':'0.95','--anim-speed':'1.2','--glass-blur':'6px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0.04em','--letter-spacing-body':'0.03em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.03em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(160,200,140,0.55)','--loading-color-dim':'rgba(160,200,140,0.40)','--loading-color-soft':'rgba(160,200,140,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1','--line-spacing':'1.8',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(160,200,140,0.015)','--card-hover-bg':'rgba(160,200,140,0.06)',
      '--card-shadow':'0 4px 24px rgba(0,0,0,0.3)','--shadow-depth':'1',
    },
  },
  {
    id: '__industrial__', name: '工业粗矿', builtin: true,
    vars: {
      '--accent':'#cc9966','--bg':'#0c0c0c','--bg-deep':'#080808',
      '--text':'#e0e0e0','--text-2':'#a0a0a0','--text-3':'#808080',
      '--glass-bg':'rgba(200,180,160,0.05)','--glass-border':'rgba(200,180,160,0.10)',
      '--glass-bg-hover':'rgba(200,180,160,0.10)','--glass-border-bright':'rgba(200,180,160,0.20)',
      '--radius':'4px','--radius-sm':'2px','--radius-pill':'20px',
      '--thumb-card-size':'320px','--font-scale':'0.9','--anim-speed':'0.7','--glass-blur':'20px',
      '--font-display':"'Xbox', 'Arial Black', Impact, sans-serif",'--font-body':"'Segoe UI', system-ui, sans-serif",
      '--font-weight-display':'900','--font-weight-body':'400',
      '--letter-spacing-display':'0.08em','--letter-spacing-body':'0.04em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.01em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(200,160,120,0.55)','--loading-color-dim':'rgba(200,160,120,0.40)','--loading-color-soft':'rgba(200,160,120,0.45)',
      '--ease-out':'cubic-bezier(0.5,0,0.5,1)','--ease-spring':'cubic-bezier(0.5,1.2,0.5,1)',
      '--font-scale-heading':'0.9','--line-spacing':'1.4',
      '--section-gap':'1rem','--gap-scale':'0.8',
      '--card-bg':'rgba(200,160,120,0.02)','--card-hover-bg':'rgba(200,160,120,0.06)',
      '--card-shadow':'0 2px 8px rgba(0,0,0,0.5)','--shadow-depth':'1.5',
    },
  },
  {
    id: '__mist__', name: '轻雾胶片', builtin: true,
    vars: {
      '--accent':'#b8a090','--bg':'#0a0908','--bg-deep':'#080706',
      '--text':'#e8e4e0','--text-2':'#a09890','--text-3':'#908880',
      '--glass-bg':'rgba(210,190,170,0.08)','--glass-border':'rgba(210,190,170,0.12)',
      '--glass-bg-hover':'rgba(210,190,170,0.14)','--glass-border-bright':'rgba(210,190,170,0.24)',
      '--radius':'24px','--radius-sm':'16px','--radius-pill':'120px',
      '--thumb-card-size':'340px','--font-scale':'1.05','--anim-speed':'1.8','--glass-blur':'6px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--font-weight-display':'300','--font-weight-body':'300',
      '--letter-spacing-display':'0.12em','--letter-spacing-body':'0.06em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.06em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(210,190,170,0.55)','--loading-color-dim':'rgba(210,190,170,0.40)','--loading-color-soft':'rgba(210,190,170,0.45)',
      '--ease-out':'cubic-bezier(0.22,1,0.36,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1.05','--line-spacing':'2.0',
      '--section-gap':'2rem','--gap-scale':'1.2',
      '--card-bg':'rgba(210,190,170,0.02)','--card-hover-bg':'rgba(210,190,170,0.08)',
      '--card-shadow':'0 8px 40px rgba(0,0,0,0.4)','--shadow-depth':'0.8',
    },
  },
  {
    id: '__editorial__', name: '编辑排版', builtin: true,
    vars: {
      '--accent':'#b8a080','--bg':'#0c0b09','--bg-deep':'#080706',
      '--text':'#e8e4de','--text-2':'#a09888','--text-3':'#908070',
      '--glass-bg':'rgba(210,190,160,0.07)','--glass-border':'rgba(210,190,160,0.12)',
      '--glass-bg-hover':'rgba(210,190,160,0.13)','--glass-border-bright':'rgba(210,190,160,0.22)',
      '--radius':'8px','--radius-sm':'6px','--radius-pill':'40px',
      '--thumb-card-size':'300px','--font-scale':'1.0','--anim-speed':'2.0','--glass-blur':'8px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"Georgia, 'Times New Roman', serif",
      '--font-weight-display':'300','--font-weight-body':'300',
      '--letter-spacing-display':'0.14em','--letter-spacing-body':'0.06em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'300','--font-weight-mono':'400','--letter-spacing-caption':'0.06em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(210,190,160,0.55)','--loading-color-dim':'rgba(210,190,160,0.40)','--loading-color-soft':'rgba(210,190,160,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1.15','--line-spacing':'2.2',
      '--section-gap':'2rem','--gap-scale':'1.5',
      '--card-bg':'rgba(210,190,160,0.015)','--card-hover-bg':'rgba(210,190,160,0.06)',
      '--card-shadow':'0 6px 32px rgba(0,0,0,0.35)','--shadow-depth':'0.9',
    },
  },
  {
    id: '__terminal__', name: '终端矩阵', builtin: true,
    vars: {
      '--accent':'#66cc88','--bg':'#0a0a0a','--bg-deep':'#050505',
      '--text':'#d0d0d0','--text-2':'#909090','--text-3':'#707070',
      '--glass-bg':'rgba(100,200,130,0.05)','--glass-border':'rgba(100,200,130,0.10)',
      '--glass-bg-hover':'rgba(100,200,130,0.10)','--glass-border-bright':'rgba(100,200,130,0.18)',
      '--radius':'2px','--radius-sm':'1px','--radius-pill':'4px',
      '--thumb-card-size':'240px','--font-scale':'0.85','--anim-speed':'0.5','--glass-blur':'8px',
      '--font-display':"'Consolas', 'Courier New', 'SF Mono', monospace",'--font-body':"'Consolas', 'Courier New', monospace",
      '--font-weight-display':'400','--font-weight-body':'400',
      '--letter-spacing-display':'0','--letter-spacing-body':'0','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(100,200,130,0.55)','--loading-color-dim':'rgba(100,200,130,0.40)','--loading-color-soft':'rgba(100,200,130,0.45)',
      '--ease-out':'cubic-bezier(0.5,0,0.5,1)','--ease-spring':'cubic-bezier(0.5,1,0.5,1)',
      '--font-scale-heading':'0.85','--line-spacing':'1.2',
      '--section-gap':'1rem','--gap-scale':'0.7',
      '--card-bg':'rgba(100,200,130,0.02)','--card-hover-bg':'rgba(100,200,130,0.06)',
      '--card-shadow':'0 2px 8px rgba(0,0,0,0.5)','--shadow-depth':'1.2',
    },
  },
  {
    id: '__neon__', name: '霓虹夜色', builtin: true,
    vars: {
      '--accent':'#ff66cc','--bg':'#080010','--bg-deep':'#040008',
      '--text':'#f0e0f0','--text-2':'#b0a0b8','--text-3':'#908098',
      '--glass-bg':'rgba(255,100,200,0.08)','--glass-border':'rgba(255,100,200,0.14)',
      '--glass-bg-hover':'rgba(255,100,200,0.14)','--glass-border-bright':'rgba(255,100,200,0.24)',
      '--radius':'16px','--radius-sm':'10px','--radius-pill':'40px',
      '--thumb-card-size':'280px','--font-scale':'1.0','--anim-speed':'1.2','--glass-blur':'12px',
      '--font-display':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",'--font-body':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-weight-display':'400','--font-weight-body':'400',
      '--letter-spacing-display':'0.02em','--letter-spacing-body':'0.02em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.02em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(255,100,200,0.55)','--loading-color-dim':'rgba(255,100,200,0.40)','--loading-color-soft':'rgba(255,100,200,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1.0','--line-spacing':'1.6',
      '--section-gap':'1.5rem','--gap-scale':'1.3',
      '--card-bg':'rgba(255,100,200,0.02)','--card-hover-bg':'rgba(255,100,200,0.08)',
      '--card-shadow':'0 4px 24px rgba(255,100,200,0.2)','--shadow-depth':'1.0',
    },
  },
  {
    id: '__paper__', name: '暖纸书香', builtin: true,
    vars: {
      '--accent':'#8b7355','--bg':'#faf8f0','--bg-deep':'#f0ece0',
      '--text':'#333028','--text-2':'#6b6050','--text-3':'#908878',
      '--glass-bg':'rgba(139,115,85,0.08)','--glass-border':'rgba(139,115,85,0.14)',
      '--glass-bg-hover':'rgba(139,115,85,0.14)','--glass-border-bright':'rgba(139,115,85,0.24)',
      '--radius':'6px','--radius-sm':'4px','--radius-pill':'18px',
      '--thumb-card-size':'320px','--font-scale':'1.05','--anim-speed':'1.5','--glass-blur':'4px',
      '--font-display':"Georgia, 'Times New Roman', serif",'--font-body':"Georgia, 'Times New Roman', serif",
      '--font-weight-display':'400','--font-weight-body':'400',
      '--letter-spacing-display':'0.06em','--letter-spacing-body':'0.04em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.04em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(139,115,85,0.55)','--loading-color-dim':'rgba(139,115,85,0.40)','--loading-color-soft':'rgba(139,115,85,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1.1','--line-spacing':'2.0',
      '--section-gap':'2rem','--gap-scale':'2.0',
      '--card-bg':'rgba(139,115,85,0.04)','--card-hover-bg':'rgba(139,115,85,0.12)',
      '--card-shadow':'0 3px 16px rgba(0,0,0,0.12)','--shadow-depth':'0.6',
    },
  },
  {
    id: '__void__', name: '极致纯黑', builtin: true,
    vars: {
      '--accent':'#aaaaaa','--bg':'#000000','--bg-deep':'#000000',
      '--text':'#ffffff','--text-2':'#999999','--text-3':'#777777',
      '--glass-bg':'rgba(255,255,255,0.04)','--glass-border':'rgba(255,255,255,0.08)',
      '--glass-bg-hover':'rgba(255,255,255,0.08)','--glass-border-bright':'rgba(255,255,255,0.14)',
      '--radius':'0px','--radius-sm':'0px','--radius-pill':'0px',
      '--thumb-card-size':'280px','--font-scale':'0.95','--anim-speed':'1.0','--glass-blur':'0px',
      '--font-display':"'Cormorant Garamond', Georgia, serif",'--font-body':"'Cormorant', Georgia, serif",
      '--font-weight-display':'300','--font-weight-body':'400',
      '--letter-spacing-display':'0.08em','--letter-spacing-body':'0.04em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'0.04em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(255,255,255,0.55)','--loading-color-dim':'rgba(255,255,255,0.40)','--loading-color-soft':'rgba(255,255,255,0.45)',
      '--ease-out':'cubic-bezier(0.16,1,0.3,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'0.95','--line-spacing':'1.6',
      '--section-gap':'1.5rem','--gap-scale':'1.0',
      '--card-bg':'rgba(255,255,255,0.02)','--card-hover-bg':'rgba(255,255,255,0.05)',
      '--card-shadow':'0 2px 10px rgba(0,0,0,0.5)','--shadow-depth':'1.0',
    },
  },
  {
    id: '__brutal__', name: '野兽粗野', builtin: true,
    vars: {
      '--accent':'#ff6633','--bg':'#0c0c0c','--bg-deep':'#080808',
      '--text':'#e0e0e0','--text-2':'#a0a0a0','--text-3':'#808080',
      '--glass-bg':'rgba(255,100,50,0.06)','--glass-border':'rgba(255,100,50,0.12)',
      '--glass-bg-hover':'rgba(255,100,50,0.12)','--glass-border-bright':'rgba(255,100,50,0.24)',
      '--radius':'0px','--radius-sm':'0px','--radius-pill':'0px',
      '--thumb-card-size':'320px','--font-scale':'0.85','--anim-speed':'0.3','--glass-blur':'4px',
      '--font-display':"'Xbox', 'Arial Black', Impact, sans-serif",'--font-body':"'Arial Black', Impact, 'Helvetica Neue', sans-serif",
      '--font-weight-display':'900','--font-weight-body':'700',
      '--letter-spacing-display':'-0.02em','--letter-spacing-body':'-0.01em','--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none','--font-caption':"'Cormorant Garamond', Georgia, serif",'--font-mono':"'Consolas', 'Courier New', monospace",'--font-weight-caption':'400','--font-weight-mono':'400','--letter-spacing-caption':'-0.01em','--letter-spacing-mono':'0','--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(255,100,50,0.55)','--loading-color-dim':'rgba(255,100,50,0.40)','--loading-color-soft':'rgba(255,100,50,0.45)',
      '--ease-out':'cubic-bezier(0.8,0,0.2,1)','--ease-spring':'cubic-bezier(0.8,1.4,0.2,1)',
      '--font-scale-heading':'0.85','--line-spacing':'1.3',
      '--section-gap':'0.8rem','--gap-scale':'0.5',
      '--card-bg':'rgba(255,100,50,0.02)','--card-hover-bg':'rgba(255,100,50,0.08)',
      '--card-shadow':'0 6px 0 rgba(255,100,50,0.5)','--shadow-depth':'2.0',
    },
  },
  {
    id: '__liquid-glass__', name: '液态玻璃', builtin: true,
    vars: {
      '--accent':'#5e9ef0','--bg':'#08080c','--bg-deep':'#040408',
      '--text':'#e8ecf2','--text-2':'#a0a8b8','--text-3':'#687080',
      '--glass-bg':'rgba(160,200,240,0.08)','--glass-border':'rgba(160,200,240,0.14)',
      '--glass-bg-hover':'rgba(160,200,240,0.15)','--glass-border-bright':'rgba(160,200,240,0.26)',
      '--radius':'24px','--radius-sm':'16px','--radius-pill':'120px',
      '--thumb-card-size':'300px','--font-scale':'1','--anim-speed':'1.4','--glass-blur':'20px',
      '--font-display':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-body':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-weight-display':'500','--font-weight-body':'400',
      '--letter-spacing-display':'-0.01em','--letter-spacing-body':'-0.01em',
      '--font-style-display':'normal','--font-style-body':'normal','--text-transform':'none',
      '--font-caption':"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--font-mono':"'SF Mono', 'Consolas', ui-monospace, monospace",
      '--font-weight-caption':'400','--font-weight-mono':'400',
      '--letter-spacing-caption':'0','--letter-spacing-mono':'0',
      '--font-style-caption':'normal','--font-style-mono':'normal',
      '--loading-color':'rgba(100,160,240,0.55)','--loading-color-dim':'rgba(100,160,240,0.40)',
      '--loading-color-soft':'rgba(100,160,240,0.45)','--loading-track-height':'3px',
      '--ease-out':'cubic-bezier(0.22,1,0.36,1)','--ease-spring':'cubic-bezier(0.34,1.56,0.64,1)',
      '--font-scale-heading':'1','--line-spacing':'1.6',
      '--section-gap':'1.5rem','--gap-scale':'1',
      '--card-bg':'rgba(160,200,240,0.03)','--card-hover-bg':'rgba(160,200,240,0.08)',
      '--card-shadow':'0 8px 32px rgba(0,0,0,0.4)','--shadow-depth':'0.8',
      '--hero-grad-top':'rgba(230,240,255,1)','--hero-grad-mid':'rgba(140,180,230,0.8)','--hero-grad-bot':'rgba(50,80,140,0.25)',
      '--corner-logo-color':'rgba(160,200,240,0.85)','--hero-subtitle-color':'rgba(160,200,240,0.3)','--hero-line-color':'rgba(160,200,240,0.15)',
      '--sidebar-glass-bg':'rgba(160,200,240,0.06)','--sidebar-glass-border':'rgba(160,200,240,0.12)',
      '--sidebar-glass-bg-hover':'rgba(160,200,240,0.12)','--sidebar-glass-border-bright':'rgba(160,200,240,0.22)',
      '--sidebar-glass-blur':'18px',
      '--titlebar-glass-bg':'rgba(160,200,240,0.06)','--titlebar-glass-border':'rgba(160,200,240,0.12)',
      '--titlebar-glass-bg-hover':'rgba(160,200,240,0.12)','--titlebar-btn-color':'rgba(190,220,250,0.9)',
      '--titlebar-glass-blur':'18px',
      '--toolbar-glass-bg':'rgba(160,200,240,0.06)','--toolbar-glass-border':'rgba(160,200,240,0.12)',
      '--toolbar-glass-bg-hover':'rgba(160,200,240,0.12)','--toolbar-btn-color':'rgba(190,220,250,0.9)',
      '--toolbar-glass-blur':'18px',
      '--card-glass-bg':'rgba(160,200,240,0.04)','--card-glass-border':'rgba(160,200,240,0.10)',
      '--card-glass-bg-hover':'rgba(160,200,240,0.10)','--card-glass-border-bright':'rgba(160,200,240,0.20)',
      '--card-hover-blur':'16px','--gallery-nav-blur':'14px','--dropdown-blur':'16px',
      '--panel-glass-bg':'rgba(160,200,240,0.08)','--panel-glass-border':'rgba(160,200,240,0.14)',
      '--panel-glass-bg-hover':'rgba(160,200,240,0.14)','--panel-glass-blur':'20px','--shortcuts-blur':'18px',
      '--lightbox-glass-bg':'rgba(160,200,240,0.06)','--lightbox-glass-border':'rgba(160,200,240,0.12)',
      '--lightbox-glass-bg-hover':'rgba(160,200,240,0.12)','--lightbox-glass-blur':'18px',
      '--lightbox-btn-blur':'12px','--lightbox-exif-blur':'14px','--slideshow-blur':'18px',
      '--hero-scroll-blur':'12px','--back-to-top-blur':'14px','--dev-panel-blur':'20px',
    },
  },
];

// ── 模块级 applyEffects 防抖（供所有标签页的 reset 按钮等使用）──
let _applyEffectsTimer = null;
function scheduleApplyEffects() {
  clearTimeout(_applyEffectsTimer);
  _applyEffectsTimer = setTimeout(() => applySpecialVarEffects(), 80);
}
window.__lensCancelApplyEffects = () => {
  clearTimeout(_applyEffectsTimer);
  _applyEffectsTimer = null;
};

// ── Open / Close ──

// ── body overflow 共享锁（与 shortcuts panel 协调） ──
function lockBodyScroll() {
  window.__lensOverflowLock = (window.__lensOverflowLock || 0) + 1;
  document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
  window.__lensOverflowLock = Math.max(0, (window.__lensOverflowLock || 0) - 1);
  if (window.__lensOverflowLock === 0) document.body.style.overflow = '';
}

function openDevPanel() {
  const overlay = document.getElementById('dev-overlay');
  const panel = document.getElementById('dev-panel');
  if (!overlay || !panel) return;

  // 如果正在关闭动画中，中断关闭 — 补偿被取消的 unlockBodyScroll
  if (D.closing) {
    D._closeFallback && clearTimeout(D._closeFallback);
    panel.removeEventListener('animationend', D._closeOnEnd);
    panel.classList.remove('dev-panel--out');
    D.closing = false;
    unlockBodyScroll(); // 中断关闭丢失的 unlock
  }

  // 自动收起其他面板
  document.getElementById('settings-panel')?.classList.remove('settings-panel--open');
  const shortcutsOverlay = document.getElementById('shortcuts-overlay');
  if (shortcutsOverlay?.classList.contains('shortcuts-overlay--open')) {
    shortcutsOverlay.classList.remove('shortcuts-overlay--open');
    const sp = shortcutsOverlay.querySelector('.shortcuts-panel');
    if (sp) { sp.classList.remove('shortcuts-panel--out'); }
    unlockBodyScroll(); // 回收快捷键面板的 scroll lock
  }

  overlay.classList.add('dev-overlay--open');
  panel.classList.remove('dev-panel--out');
  lockBodyScroll();
  D.open = true;
  // 重新注入动画速度等特殊样式 + 刷新预览
  applySpecialVarEffects();
  startAllMonitors();
  switchGroup(D.activeGroup);
  // 确保调试样式在面板打开时正确恢复（防止外部清理导致不一致）
  restoreDebugStyles();
}

function restoreDebugStyles() {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c8a87c';
  const accentRgb = (() => { const m = accent.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i); return m ? `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}` : '200,168,124'; })();
  const toggles = {
    'dev-toggle-outline': { id: 'dev-outline-style', css: `*{outline:0.5px solid rgba(${accentRgb},0.15)!important}` },
    'dev-toggle-grid-lines': { id: 'dev-grid-style', css: `.main-area,.portfolio{background-image:linear-gradient(rgba(${accentRgb},0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(${accentRgb},0.04) 1px,transparent 1px)!important;background-size:20px 20px!important}` },
    'dev-toggle-box-model': { id: 'dev-box-model-style', css: 'body.dev-bm-active *:hover{outline:1px solid rgba(0,120,255,0.4)!important;background:rgba(0,120,255,0.04)!important}', extraId: 'dev-box-model-hover', extraCss: 'body.dev-bm-active *:hover{outline:1px solid rgba(0,120,255,0.4)!important;background:rgba(0,120,255,0.04)!important}', extraClass: 'dev-bm-active' },
  };
  Object.entries(toggles).forEach(([toggleId, cfg]) => {
    const toggle = document.getElementById(toggleId);
    const style = document.getElementById(cfg.id);
    const isOn = toggle?.classList.contains('dev-toggle--on');
    if (isOn) {
      if (!style) {
        const s = document.createElement('style'); s.id = cfg.id; s.textContent = cfg.css; document.head.appendChild(s);
        if (cfg.extraId && !document.getElementById(cfg.extraId)) {
          const s2 = document.createElement('style'); s2.id = cfg.extraId; s2.textContent = cfg.extraCss; document.head.appendChild(s2);
        }
      }
      // 确保关联的 body class 始终存在（stopAllMonitors 可能清除了）
      if (cfg.extraClass) document.body.classList.add(cfg.extraClass);
    } else {
      if (style) { style.remove(); if (cfg.extraId) { const s2 = document.getElementById(cfg.extraId); if (s2) s2.remove(); } }
      if (cfg.extraClass) document.body.classList.remove(cfg.extraClass);
    }
  });
  ['dev-toggle-overflow','dev-toggle-img-info','dev-toggle-z-index','dev-toggle-tag-labels','dev-toggle-layout-hl','dev-toggle-empty-el','dev-toggle-depth-color','dev-toggle-font-info','dev-toggle-link-info','dev-toggle-img-alt','dev-toggle-size-label','dev-toggle-fps-badge','dev-toggle-img-waste','dev-toggle-dom-stats','dev-toggle-key-log','dev-toggle-click-ripple','dev-toggle-focus-track'].forEach(toggleId => {
    const toggle = document.getElementById(toggleId);
    if (!toggle?.classList.contains('dev-toggle--on')) return;
    const key = toggleId.replace('dev-toggle-', '');
    const id = `dev-${key}-style`;
    if (document.getElementById(id)) return;
    const cssMap = {
      'overflow': '*{--_dev-of:none}[style*="overflow:hidden"],*[style*="overflow: hidden"]{outline:2px solid rgba(255,60,60,0.4)!important;outline-offset:-1px}',
      'img-info': 'img{position:relative}img::after{content:attr(src);position:absolute;top:0;left:0;font-size:10px;color:#fff;background:rgba(0,0,0,0.7);padding:2px 6px;z-index:99999;pointer-events:none;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      'z-index': '[style*="z-index:"]::before{content:\'z:\' attr(style);position:absolute;top:0;left:0;font-size:9px;color:#ff0;background:rgba(0,0,0,0.8);padding:1px 4px;z-index:999999;pointer-events:none;font-family:monospace;white-space:nowrap;border-radius:2px}',
      'empty-el': '*:empty:not(script):not(style):not(link):not(meta):not(br):not(hr):not(img):not(input):not(source):not(track):not(col){outline:2px solid rgba(255,100,200,0.6)!important;outline-offset:-1px!important;background:rgba(255,100,200,0.06)!important;min-width:20px!important;min-height:12px!important}',
      'depth-color': 'body>*{outline:1px solid rgba(255,80,80,0.35)!important;outline-offset:-1px}body>*>*{outline:1px solid rgba(255,180,60,0.35)!important;outline-offset:-1px}body>*>*>*{outline:1px solid rgba(255,255,80,0.35)!important;outline-offset:-1px}body>*>*>*>*{outline:1px solid rgba(80,255,80,0.35)!important;outline-offset:-1px}body>*>*>*>*>*{outline:1px solid rgba(80,180,255,0.35)!important;outline-offset:-1px}body>*>*>*>*>*>*{outline:1px solid rgba(120,80,255,0.35)!important;outline-offset:-1px}body>*>*>*>*>*>*>*{outline:1px solid rgba(255,80,255,0.35)!important;outline-offset:-1px}',
      'layout-hl': '[style*="display:flex" i],[style*="display: flex" i],.toolbar,.sidebar,.categories,.gallery__grid,.portfolio,.gallery__nav,.custom-dropdown__menu{outline:2px dashed rgba(0,200,255,0.5)!important;outline-offset:-1px!important}[style*="display:grid" i],[style*="display: grid" i],[class*="grid"]{outline:2px dashed rgba(255,200,0,0.5)!important;outline-offset:-1px!important}',
      'link-info': 'a[href]:not([href="#"]):not([href=""]):hover::after{content:" → " attr(href)!important;position:absolute!important;top:100%!important;left:0!important;font-size:10px!important;font-family:monospace!important;color:#0ff!important;background:rgba(0,0,0,0.9)!important;padding:2px 8px!important;border-radius:3px!important;z-index:999999!important;pointer-events:none!important;white-space:nowrap!important;max-width:400px!important;overflow:hidden!important;text-overflow:ellipsis!important}a:not([href]),a[href="#"],a[href=""]{outline:2px dotted rgba(255,120,0,0.6)!important;outline-offset:2px!important}',
      'img-alt': 'img:not([alt]){outline:3px solid rgba(255,60,60,0.7)!important;outline-offset:2px!important;filter:sepia(0.8) hue-rotate(-20deg)!important}img[alt=""]{outline:3px solid rgba(255,180,60,0.7)!important;outline-offset:2px!important}img:not([width]):not([height]){outline:1px dotted rgba(255,200,0,0.4)!important;outline-offset:3px!important}',
    };
    if (cssMap[key]) { const s = document.createElement('style'); s.id = id; s.textContent = cssMap[key]; document.head.appendChild(s); }
  });

  // 每次关闭面板时也确保调试样式存在（在 closeDevPanel 的 cleanup 后调用）
  window.__lensRestoreDebugStyles = restoreDebugStyles;
}

function closeDevPanel() {
  if (D.closing) return;
  D.closing = true;
  const panel = document.getElementById('dev-panel');
  const overlay = document.getElementById('dev-overlay');
  if (!panel || !overlay) { D.closing = false; return; }

  panel.classList.add('dev-panel--out');
  overlay.classList.remove('dev-overlay--open');
  document.getElementById('dev-gp-float')?.classList.remove('dev-gp-float--open');
  document.getElementById('dev-reset-overlay')?.classList.remove('dev-reset-overlay--open');

  const cleanup = () => {
    clearTimeout(D._closeFallback);
    panel.removeEventListener('animationend', onEnd);
    panel.classList.remove('dev-panel--out');
    D.closing = false;
    D.open = false;
    unlockBodyScroll();
    stopAllMonitors();
    stopPreviewAnimations();
    // 清理着色器预览和卡片渲染器
    if (_animPreviewHandle) { _animPreviewHandle.dispose(); _animPreviewHandle = null; }
    disposeCardPreviews();
    // 关闭后确保调试样式存在（双重保障）
    setTimeout(() => restoreDebugStyles(), 50);
  };

  const onEnd = (e) => {
    if (e.animationName !== 'devPanelDissolve') return;
    D._closeOnEnd = null;
    cleanup();
  };
  D._closeOnEnd = onEnd;
  panel.addEventListener('animationend', onEnd);

  // 安全兜底：500ms 后强制清理（防止 animationend 未触发导致死锁）
  D._closeFallback = setTimeout(cleanup, 500);
}

export function toggleDevPanel() {
  if (D.open && !D.closing) closeDevPanel();
  else if (!D.open || D.closing) openDevPanel();
}

export function isDevPanelOpen() { return D.open; }

// ── 事件 ──

function setupDevPanelEvents() {
  const overlay = document.getElementById('dev-overlay');
  const closeBtn = document.getElementById('dev-panel-close');

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) toggleDevPanel();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDevPanel);
  }

  // 全局键盘：Ctrl+Shift+D 切换，Escape 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      toggleDevPanel();
      return;
    }
    if (e.key === 'Escape' && D.open) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      closeDevPanel();
    }
  });
}

// ── 标签页切换 ──

function setupDevTabs() {
  const nav = document.getElementById('dev-nav');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.dev-nav__tab');
    if (!tab) return;
    switchGroup(tab.dataset.group);
  });
}

function switchGroup(group) {
  D.activeGroup = group;
  document.querySelectorAll('.dev-nav__tab').forEach(t =>
    t.classList.toggle('dev-nav__tab--active', t.dataset.group === group));
  document.querySelectorAll('.dev-group').forEach(g =>
    g.classList.toggle('dev-group--active', g.id === `dev-group-${group}`));
  // 预览面板在视觉和预设标签显示
  const preview = document.getElementById('dev-preview');
  if (preview) preview.classList.toggle('dev-preview--hidden', group !== 'visual' && group !== 'presets' && group !== 'hero');
  renderGroup(group);
  // 切换到预设/视觉/Hero 标签时立即刷新预览（无需等待点击预设卡片）
  if (group === 'visual' || group === 'presets' || group === 'hero') {
    buildDevPreview();
    startPreviewAnimations();
  }
}

// ── 分组渲染分发 ──

function renderGroup(group) {
  switch (group) {
    case 'visual':  renderVisualGroup(); break;
    case 'hero':    renderHeroGroup(); break;
    case 'perf':    renderPerfGroup(); break;
    case 'gamepad': renderGamepadGroup(); break;
    case 'presets': renderPresetsGroup(); break;
  }
}

// ═══════════════════════════════════════════
// Group 1: 视觉 — CSS 变量实时调节
// ═══════════════════════════════════════════

// ── 颜色工具函数（供预览面板使用）──
function parseRgba(str) {
  if (!str) return { r:0,g:0,b:0,a:1 };
  const m = str.match(/rgba?\((\d+),?\s*(\d+),?\s*(\d+),?\s*([\d.]+)?\)/);
  if (m) return { r:+m[1], g:+m[2], b:+m[3], a:m[4]!==undefined?+m[4]:1 };
  const hm = str.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hm) return { r:parseInt(hm[1],16), g:parseInt(hm[2],16), b:parseInt(hm[3],16), a:1 };
  return { r:0,g:0,b:0,a:1 };
}
function interpolateRgba(a, b, t) {
  const c1=parseRgba(a), c2=parseRgba(b);
  return `rgba(${Math.round(c1.r+(c2.r-c1.r)*t)},${Math.round(c1.g+(c2.g-c1.g)*t)},${Math.round(c1.b+(c2.b-c1.b)*t)},${(c1.a+(c2.a-c1.a)*t).toFixed(3)})`;
}
function hexToRgbDataAttr(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}` : '200,168,124';
}

function buildDevPreview() {
  const preview = document.getElementById('dev-preview');
  if (!preview) return;
  const inner = preview.querySelector('.dev-preview__inner');
  if (!inner) return;

  const s = getComputedStyle(document.documentElement);
  const get = (key, fb) => { const v = s.getPropertyValue(key).trim(); return v || fb; };

  const V = {
    accent: get('--accent','#c8a87c'), bg: get('--bg','#0a0a08'), bgDeep: get('--bg-deep','#060605'),
    text: get('--text','#e8e4e0'), text2: get('--text-2','#9a948e'), text3: get('--text-3','#5a5450'),
    glassBg: get('--glass-bg','rgba(220,200,180,0.06)'), glassBorder: get('--glass-border','rgba(220,200,180,0.10)'),
    glassBgHover: get('--glass-bg-hover','rgba(220,200,180,0.12)'), glassBorderBright: get('--glass-border-bright','rgba(220,200,180,0.20)'),
    radius: get('--radius','20px'), radiusSm: get('--radius-sm','14px'), radiusPill: get('--radius-pill','100px'),
    fontDisplay: get('--font-display',"'Cormorant Garamond', Georgia, serif"), fontBody: get('--font-body',"'Cormorant', Georgia, serif"),
    fontWeightDisplay: get('--font-weight-display','300'), fontWeightBody: get('--font-weight-body','400'),
    letterSpacingDisplay: get('--letter-spacing-display','0.05em'), letterSpacingBody: get('--letter-spacing-body','0.04em'),
    fontStyleDisplay: get('--font-style-display','normal'), fontStyleBody: get('--font-style-body','normal'),
    fontCaption: get('--font-caption',"'Cormorant Garamond', Georgia, serif"),
    fontMono: get('--font-mono',"'Consolas', 'Courier New', monospace"),
    fontWeightCaption: get('--font-weight-caption','400'),
    fontWeightMono: get('--font-weight-mono','400'),
    letterSpacingCaption: get('--letter-spacing-caption','0.04em'),
    letterSpacingMono: get('--letter-spacing-mono','0'),
    fontStyleCaption: get('--font-style-caption','normal'),
    fontStyleMono: get('--font-style-mono','normal'),
    textTransform: get('--text-transform','none'),
    headingScale: get('--font-scale-heading','1'), lineSpacing: get('--line-spacing','1.7'),
    glassBlur: get('--glass-blur','0px'),
    loadingColor: get('--loading-color','rgba(220,200,180,0.55)'), loadingColorDim: get('--loading-color-dim','rgba(220,200,180,0.40)'),
    cardBg: get('--card-bg','rgba(220,200,180,0.015)'), cardHoverBg: get('--card-hover-bg','rgba(220,200,180,0.06)'),
    cardShadow: get('--card-shadow','0 4px 24px rgba(0,0,0,0.3)'),
    heroGradTop: get('--hero-grad-top','rgba(255,245,235,1)'), heroGradMid: get('--hero-grad-mid','rgba(220,200,175,0.85)'),
    heroGradBot: get('--hero-grad-bot','rgba(180,155,130,0.25)'), cornerLogoColor: get('--corner-logo-color','rgba(220,200,175,0.85)'),
    heroSubtitleColor: get('--hero-subtitle-color','rgba(220,200,180,0.3)'), heroLineColor: get('--hero-line-color','rgba(220,200,180,0.35)'),
    devPanelBg: get('--dev-panel-bg','rgba(10,10,8,0.94)'),
    accentRgb: hexToRgbDataAttr(get('--accent','#c8a87c')),
    sectionGap: get('--section-gap','1.5rem'),
  };

  // 设置 inner 容器内联样式（零 var() 依赖）
  const previewBlurPx = 40 + (parseInt(V.glassBlur) || 0);
  inner.style.background = V.devPanelBg;
  inner.style.backdropFilter = `blur(${previewBlurPx}px)`;
  inner.style.webkitBackdropFilter = `blur(${previewBlurPx}px)`;
  inner.style.border = `0.5px solid ${V.glassBorderBright}`;
  inner.style.borderRadius = V.radius;
  inner.style.boxShadow = `0 8px 40px rgba(0,0,0,0.5), 0 0 0 0.5px ${V.glassBorder} inset`;

  const hd = parseFloat(V.headingScale)||1;

  inner.innerHTML = `
    <div class="dev-preview__header" style="font-family:${V.fontDisplay};font-size:0.8rem;font-weight:400;font-style:italic;letter-spacing:0.1em;color:${V.text};padding-bottom:0.4rem;border-bottom:0.5px solid ${V.glassBorder};">实时预览</div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">卡片样式</div>
      <div class="dev-preview__card-wrap" style="position:relative;border-radius:${V.radius};">
        <div class="dev-preview__card-backdrop" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Arial Black',Impact,sans-serif;font-size:3rem;font-weight:900;color:${V.accent};opacity:0.35;letter-spacing:0.3em;pointer-events:none;z-index:0;">TEST</div>
        <div class="js-prev-card" data-card-bg="${V.cardBg}" data-card-hover-bg="${V.cardHoverBg}" data-glass-border="${V.glassBorder}" data-glass-border-bright="${V.glassBorderBright}" data-glass-blur="${V.glassBlur}" style="position:relative;z-index:1;background:${V.cardBg};border:0.5px solid ${V.glassBorder};border-radius:${V.radius};box-shadow:${V.cardShadow};padding:0.8rem;">
          <div class="dev-preview__card-label" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.06em;margin-bottom:0.4rem;">示例卡片 — 自动展示毛玻璃效果</div>
          <div class="dev-preview__card-glass" style="background:${V.glassBg};border:0.5px solid ${V.glassBorder};border-radius:${V.radiusSm};padding:0.6rem;">
            <div class="dev-preview__card-title" style="font-family:${V.fontDisplay};font-size:${(0.75*hd).toFixed(2)}rem;font-weight:${V.fontWeightDisplay};letter-spacing:${V.letterSpacingDisplay};color:${V.text};margin-bottom:0.25rem;">标题预览</div>
            <div class="dev-preview__card-body" style="font-family:${V.fontBody};font-size:0.6rem;font-weight:${V.fontWeightBody};letter-spacing:${V.letterSpacingBody};color:${V.text2};line-height:${V.lineSpacing};">正文内容，展示字体样式与排版效果。</div>
          </div>
        </div>
      </div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">颜色方案</div>
      <div class="dev-preview__swatches" style="display:flex;gap:6px;flex-wrap:wrap;">
        <div style="width:26px;height:26px;border-radius:${V.radiusSm};border:0.5px solid ${V.glassBorderBright};background:${V.accent};" title="强调色"></div>
        <div style="width:26px;height:26px;border-radius:${V.radiusSm};border:0.5px solid ${V.glassBorderBright};background:${V.text};" title="主文字"></div>
        <div style="width:26px;height:26px;border-radius:${V.radiusSm};border:0.5px solid ${V.glassBorderBright};background:${V.text2};" title="次文字"></div>
        <div style="width:26px;height:26px;border-radius:${V.radiusSm};border:0.5px solid ${V.glassBorderBright};background:${V.text3};" title="三级文字"></div>
        <div style="width:26px;height:26px;border-radius:${V.radiusSm};border:0.5px solid ${V.glassBorderBright};background:${V.bg};" title="背景色"></div>
        <div style="width:26px;height:26px;border-radius:${V.radiusSm};border:0.5px solid ${V.glassBorderBright};background:${V.bgDeep};" title="深色背景"></div>
      </div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">Hero 标题渐变</div>
      <div style="font-family:${V.fontDisplay};font-weight:${V.fontWeightDisplay};font-size:2rem;letter-spacing:0.15em;text-transform:${V.textTransform};text-align:center;line-height:1.2;padding:0.3rem 0;
        background:linear-gradient(180deg,${V.heroGradTop} 0%,${V.heroGradMid} 40%,${V.heroGradBot} 100%);
        -webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 12px rgba(0,0,0,0.5));">LENS</div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">角标 / 副标题 / 装饰线</div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center;padding:0.4rem 0;">
        <div style="font-family:${V.fontDisplay};font-weight:${V.fontWeightDisplay};letter-spacing:${V.letterSpacingDisplay};color:${V.cornerLogoColor};font-size:0.65rem;">LENS <span style="font-size:0.5rem;vertical-align:super;">Beta</span></div>
        <div style="font-family:${V.fontDisplay};font-weight:${V.fontWeightDisplay};font-style:italic;letter-spacing:0.15em;color:${V.heroSubtitleColor};font-size:0.55rem;">Photography Portfolio</div>
        <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,${V.heroLineColor},${V.heroLineColor},transparent);margin-top:2px;"></div>
      </div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">圆角预览</div>
      <div style="display:flex;gap:8px;align-items:center;padding:0.3rem 0;">
        <div style="width:44px;height:32px;border-radius:${V.radius};background:${V.glassBg};border:0.5px solid ${V.glassBorderBright};" title="大圆角"></div>
        <div style="width:44px;height:32px;border-radius:${V.radiusSm};background:${V.glassBg};border:0.5px solid ${V.glassBorderBright};" title="小圆角"></div>
        <div style="width:44px;height:32px;border-radius:${V.radiusPill};background:${V.glassBg};border:0.5px solid ${V.glassBorderBright};" title="胶囊圆角"></div>
      </div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">Dev 面板背景</div>
      <div style="width:100%;height:28px;border-radius:${V.radiusSm};background:${V.devPanelBg};border:0.5px solid ${V.glassBorder};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);"></div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">字体预览</div>
      <div class="dev-preview__text-display" style="font-family:${V.fontDisplay};font-weight:${V.fontWeightDisplay};letter-spacing:${V.letterSpacingDisplay};font-style:${V.fontStyleDisplay};text-transform:${V.textTransform};font-size:0.95rem;color:${V.text};margin-bottom:0.3rem;line-height:1.3;">Display 标题字体展示</div>
      <div class="dev-preview__text-body" style="font-family:${V.fontBody};font-weight:${V.fontWeightBody};letter-spacing:${V.letterSpacingBody};font-style:${V.fontStyleBody};font-size:0.65rem;color:${V.text2};line-height:${V.lineSpacing};">Body 正文字体展示，显示行距与字距效果。</div>
      <div class="dev-preview__text-caption" style="font-family:${V.fontCaption};font-weight:${V.fontWeightCaption};letter-spacing:${V.letterSpacingCaption};font-style:${V.fontStyleCaption};font-size:0.55rem;color:${V.text3};margin-bottom:0.25rem;line-height:1.3;">CAPTION 辅助标签文字展示</div>
      <div class="dev-preview__text-mono" style="font-family:${V.fontMono};font-weight:${V.fontWeightMono};letter-spacing:${V.letterSpacingMono};font-style:${V.fontStyleMono};font-size:0.55rem;color:${V.text2};line-height:1.3;">MONO 等宽技术文字 0123456789</div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">加载预览</div>
      <div class="dev-preview__loading-capsule" style="width:100%;height:14px;border-radius:${V.radiusPill};background:${V.loadingColorDim};opacity:0.25;position:relative;overflow:hidden;">
        <div class="js-prev-shimmer" data-loading-color="${V.loadingColor}" style="position:absolute;top:0;left:-40%;width:50%;height:100%;background:${V.loadingColor};border-radius:${V.radiusPill};"></div>
      </div>
    </div>

    <div class="dev-preview__section">
      <div class="dev-preview__section-title" style="font-family:${V.fontBody};font-size:0.56rem;color:${V.text3};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">控件预览</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="js-prev-toggle" data-accent-rgb="${V.accentRgb}" data-text2="${V.text2}" data-glass-bg-hover="${V.glassBgHover}" style="width:34px;height:20px;border-radius:${V.radiusPill};background:${V.glassBgHover};border:0.5px solid ${V.glassBorder};position:relative;flex-shrink:0;">
          <div class="js-prev-toggle-knob" style="position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:${V.radiusPill};background:${V.text2};"></div>
        </div>
        <span class="dev-preview__toggle-label" style="font-family:${V.fontBody};font-size:0.58rem;color:${V.text3};">开关预览</span>
      </div>
    </div>
  `;
}

// ── JS 动画驱动（替代 CSS @keyframes，零 var() 依赖）──
function startPreviewAnimations() {
  stopPreviewAnimations();
  D._previewAnimStart = performance.now();

  const card = document.querySelector('.js-prev-card');
  const toggle = document.querySelector('.js-prev-toggle');
  const toggleKnob = document.querySelector('.js-prev-toggle-knob');
  const shimmer = document.querySelector('.js-prev-shimmer');

  if (!card && !toggle && !shimmer) return;

  const s = getComputedStyle(document.documentElement);
  const animSpeed = parseFloat(s.getPropertyValue('--anim-speed').trim()) || 1;

  function tick(now) {
    if (!D.open) { stopPreviewAnimations(); return; }
    const elapsed = (now - D._previewAnimStart) * animSpeed;

    // 卡片循环：normal ↔ hover（sin 波，1.2s周期）
    if (card) {
      const raw = ((elapsed % 1200) / 1200);
      const p = (Math.sin(raw * Math.PI * 2 - Math.PI/2) + 1) / 2;
      const blurVal = (parseFloat(card.dataset.glassBlur) || 0) + p * 16;
      card.style.backdropFilter = `blur(${blurVal}px)`;
      card.style.webkitBackdropFilter = `blur(${blurVal}px)`;
      card.style.background = interpolateRgba(card.dataset.cardBg, card.dataset.cardHoverBg, p);
      card.style.borderColor = interpolateRgba(card.dataset.glassBorder, card.dataset.glassBorderBright, p);
    }

    // 开关循环：off/on（4段相位，2.4s周期）
    if (toggle && toggleKnob) {
      const raw = ((elapsed % 2400) / 2400);
      const accentRgb = toggle.dataset.accentRgb;
      const text2 = toggle.dataset.text2;
      let bgAlpha, borderAlpha, knobL, knobBg, knobShadow;
      if (raw < 0.35) {
        bgAlpha=0.12; borderAlpha=0.15; knobL=2; knobBg=text2; knobShadow='none';
      } else if (raw < 0.50) {
        const t=(raw-0.35)/0.15;
        bgAlpha=0.12+t*0.23; borderAlpha=0.15+t*0.25; knobL=2+t*14;
        knobBg=interpolateRgba(text2,`rgba(${accentRgb},1)`,t); knobShadow='none';
      } else if (raw < 0.85) {
        bgAlpha=0.35; borderAlpha=0.4; knobL=16;
        knobBg=`rgba(${accentRgb},1)`; knobShadow=`0 0 8px rgba(${accentRgb},0.5)`;
      } else {
        const t=(raw-0.85)/0.15;
        bgAlpha=0.35-t*0.23; borderAlpha=0.4-t*0.25; knobL=16-t*14;
        knobBg=interpolateRgba(`rgba(${accentRgb},1)`,text2,t); knobShadow='none';
      }
      toggle.style.background = `rgba(${accentRgb},${bgAlpha.toFixed(2)})`;
      toggle.style.borderColor = `rgba(${accentRgb},${borderAlpha.toFixed(2)})`;
      toggleKnob.style.left = knobL + 'px';
      toggleKnob.style.background = knobBg;
      toggleKnob.style.boxShadow = knobShadow;
    }

    // 加载 shimmer：left -40%→100% 横扫（1.8s周期）
    if (shimmer) {
      const raw = ((elapsed % 1800) / 1800);
      shimmer.style.left = (-40 + raw * 140) + '%';
    }

    D._previewAnimRaf = requestAnimationFrame(tick);
  }

  D._previewAnimRaf = requestAnimationFrame(tick);
}

function stopPreviewAnimations() {
  if (D._previewAnimRaf) {
    cancelAnimationFrame(D._previewAnimRaf);
    D._previewAnimRaf = null;
  }
}

function renderHeroGroup() {
  const el = document.getElementById('dev-group-hero');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  const style = getComputedStyle(document.documentElement);

  el.innerHTML = `
    <div class="dev-section">
      <div class="dev-section__title">Hero 标题渐变</div>
      <div class="dev-section__desc">LENS 大标题的金色渐变三段色标。顶部=亮白高光、中部=暖金主色、底部=淡金渐隐</div>
      ${makeGlassColorRow('--hero-grad-top', '顶部亮色', style, '渐变顶部：明亮暖白高光')}
      ${makeGlassColorRow('--hero-grad-mid', '中部金色', style, '渐变中部：暖金色，为主要显示色')}
      ${makeGlassColorRow('--hero-grad-bot', '底部淡色', style, '渐变底部：淡金色，渐隐到透明')}
    </details>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">角标</div>
      <div class="dev-section__desc">启动后左上角 "LENS Beta" 文字颜色和悬停色</div>
      ${makeGlassColorRow('--corner-logo-color', '角标颜色', style, '左上角 "LENS Beta" 文字颜色')}
    </details>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">副标题与装饰线</div>
      <div class="dev-section__desc">Hero 标题下方的 "Photography Portfolio" 副标题和金色装饰横线</div>
      ${makeGlassColorRow('--hero-subtitle-color', '副标题色', style, '"Photography Portfolio" 文字颜色')}
      ${makeGlassColorRow('--hero-line-color', '装饰线色', style, 'LENS 下方的分隔横线颜色')}
    </div>
  `;
  bindVisualControls(el);
  buildDevPreview();
}

function renderVisualGroup() {
  const el = document.getElementById('dev-group-visual');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  const style = getComputedStyle(document.documentElement);

  const html = `
    <div class="dev-visual-layout">
      <div class="dev-subnav">
        <button class="dev-subnav__btn dev-subnav__btn--active" data-subtab="all">全部</button>
        <button class="dev-subnav__btn" data-subtab="color">色彩</button>
        <button class="dev-subnav__btn" data-subtab="glass">玻璃</button>
        <button class="dev-subnav__btn" data-subtab="capsule">胶囊</button>
        <button class="dev-subnav__btn" data-subtab="startup">启动</button>
        <button class="dev-subnav__btn" data-subtab="layout">布局</button>
        <button class="dev-subnav__btn" data-subtab="font">字体</button>
        <button class="dev-subnav__btn" data-subtab="motion">动效</button>
        <button class="dev-subnav__btn" data-subtab="debug">调试</button>
        <button class="dev-subnav__btn" data-subtab="lg">液态玻璃</button>
      </div>
      <div class="dev-subcontent">
    <div class="dev-section" data-subtab="color">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">配色</summary>
      <div class="dev-section__desc">全局色彩方案：强调色用于按钮和交互，文字三级用于标题/正文/辅助信息</div>
      ${makeColorRow('--accent', '强调色', style, '按钮悬停、激活态、图标的高亮色')}
      ${makeColorRow('--bg', '背景色', style, '页面主背景色')}
      ${makeColorRow('--bg-deep', '深色背景', style, '最深区域背景（加载画面等）')}
      ${makeColorRow('--text', '主文字', style, '标题和重要文字的颜色')}
      ${makeColorRow('--text-2', '次文字', style, '正文和描述的默认颜色')}
      ${makeColorRow('--text-3', '三级文字', style, '辅助信息和标签的颜色')}
    </details>
    </div>
    <div class="dev-section" data-subtab="glass">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">表面</summary>
      <div class="dev-section__desc">全局毛玻璃参数。下方的「全局模糊叠加」是主控——它影响下方所有分区模糊的最终值（最终 = 分区基础值 + 全局叠加）</div>
      ${makeGlassColorRow('--glass-bg', '玻璃背景', style, '侧边栏/工具栏/面板的磨砂底色')}
      ${makeGlassColorRow('--glass-bg-hover', '玻璃悬停', style, '鼠标悬浮时加深的背景色')}
      ${makeGlassColorRow('--glass-border', '玻璃边框', style, '毛玻璃面板的边缘线条颜色')}
      ${makeGlassColorRow('--glass-border-bright', '玻璃亮边框', style, '悬浮或激活时的高亮边框')}
      ${makeGlassColorRow('--card-bg', '卡片背景', style, '照片卡片的默认底色')}
      ${makeGlassColorRow('--card-hover-bg', '悬停背景', style, '卡片悬浮时的加深背景')}
      ${makeTextInputRow('--card-shadow', '卡片阴影', style, 'CSS box-shadow 值，如 0 4px 24px rgba(0,0,0,0.3)')}
      ${makeSliderRow('--shadow-depth', '阴影深度', style, 0, 2.0, 'x', 0.05, 2, '阴影深浅倍率，0=无阴影 2=最深')}
      ${makeSliderRow('--glass-blur', '全局模糊叠加', style, 0, 60, 'px', null, 0, '重点！所有分区模糊的统一偏移量。最终模糊 = 分区基础值 + 此值。例：侧边栏 24px + 此值 10px = 最终34px')}
      ${makeSliderRow('--dev-panel-blur', 'Dev面板模糊', style, 0, 120, 'px', null, 0, '开发者面板自身的毛玻璃模糊量(基础40px)')}
      ${makeGlassColorRow('--dev-panel-bg', 'Dev面板背景', style, '开发者面板自身的背景色')}
    </details>
    </div>
    <div class="dev-section" data-subtab="glass">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">分区玻璃</summary>
      <div class="dev-section__desc">每个 UI 区域的毛玻璃效果独立调节。默认值继承自全局暖色调。此处模糊值为「基础值」——最终渲染模糊 = 基础值 + 上方「全局模糊叠加」</div>
      <details class="dev-zone">
        <summary class="dev-zone__summary">侧边栏 (Sidebar)</summary>
        ${makeGlassColorRow('--sidebar-glass-bg', '背景', style, '侧边栏面板毛玻璃背景色')}
        ${makeGlassColorRow('--sidebar-glass-bg-hover', '悬停背景', style, '鼠标悬浮/激活时的背景色')}
        ${makeGlassColorRow('--sidebar-glass-border', '边框', style, '侧边栏面板边框色')}
        ${makeGlassColorRow('--sidebar-glass-border-bright', '亮边框', style, '悬浮/激活时的高亮边框色')}
        ${makeSliderRow('--sidebar-glass-blur', '模糊量', style, 0, 80, 'px', null, 0, '侧边栏 backdrop-filter 模糊像素')}
      </details>
      <details class="dev-zone">
        <summary class="dev-zone__summary">标题栏 (Titlebar)</summary>
        ${makeGlassColorRow('--titlebar-glass-bg', '背景', style, '标题栏控件背景色')}
        ${makeGlassColorRow('--titlebar-glass-bg-hover', '悬停背景', style, '标题栏按钮悬浮背景色')}
        ${makeGlassColorRow('--titlebar-glass-border', '边框', style, '标题栏控件边框色')}
        ${makeGlassColorRow('--titlebar-btn-color', '按钮文字', style, '标题栏按钮文字颜色')}
        ${makeSliderRow('--titlebar-glass-blur', '模糊量', style, 0, 60, 'px', null, 0, '标题栏 backdrop-filter 模糊像素')}
      </details>
      <details class="dev-zone">
        <summary class="dev-zone__summary">工具栏 (Toolbar)</summary>
        ${makeGlassColorRow('--toolbar-glass-bg', '背景', style, '工具栏毛玻璃背景色')}
        ${makeGlassColorRow('--toolbar-glass-bg-hover', '悬停背景', style, '工具栏按钮悬浮背景色')}
        ${makeGlassColorRow('--toolbar-glass-border', '边框', style, '工具栏边框色')}
        ${makeGlassColorRow('--toolbar-btn-color', '按钮文字', style, '工具栏按钮文字颜色')}
        ${makeSliderRow('--toolbar-glass-blur', '模糊量', style, 0, 60, 'px', null, 0, '工具栏 backdrop-filter 模糊像素')}
      </details>
      <details class="dev-zone">
        <summary class="dev-zone__summary">卡片 (Cards)</summary>
        ${makeGlassColorRow('--card-glass-bg', '背景', style, '分类卡片默认背景色')}
        ${makeGlassColorRow('--card-glass-bg-hover', '悬停背景', style, '卡片悬浮时背景色')}
        ${makeGlassColorRow('--card-glass-border', '边框', style, '分类卡片默认边框色')}
        ${makeGlassColorRow('--card-glass-border-bright', '亮边框', style, '卡片悬浮时边框色')}
        ${makeSliderRow('--card-hover-blur', '卡片悬浮模糊', style, 0, 40, 'px', null, 0, '鼠标悬浮分类卡片/画廊图片时的模糊像素')}
        ${makeSliderRow('--gallery-nav-blur', '导航条模糊', style, 0, 80, 'px', null, 0, '画廊顶部导航条的毛玻璃模糊像素')}
        ${makeSliderRow('--dropdown-blur', '下拉菜单模糊', style, 0, 80, 'px', null, 0, '排序/筛选下拉菜单的毛玻璃模糊像素')}
      </details>
      <details class="dev-zone">
        <summary class="dev-zone__summary">面板 (Panels)</summary>
        ${makeGlassColorRow('--panel-glass-bg', '背景', style, '设置/快捷键面板背景色')}
        ${makeGlassColorRow('--panel-glass-bg-hover', '悬停背景', style, '设置面板列表项悬停背景色')}
        ${makeGlassColorRow('--panel-glass-border', '边框', style, '设置/快捷键面板边框色')}
        ${makeSliderRow('--panel-glass-blur', '设置面板模糊', style, 0, 80, 'px', null, 0, '设置面板 backdrop-filter 模糊像素')}
        ${makeSliderRow('--shortcuts-blur', '快捷键面板模糊', style, 0, 80, 'px', null, 0, '快捷键面板 backdrop-filter 模糊像素')}
      </details>
      <details class="dev-zone">
        <summary class="dev-zone__summary">灯箱/幻灯片 (Lightbox)</summary>
        ${makeGlassColorRow('--lightbox-glass-bg', '按钮背景', style, '灯箱/幻灯片按钮背景色')}
        ${makeGlassColorRow('--lightbox-glass-bg-hover', '按钮悬停背景', style, '灯箱按钮悬浮背景色')}
        ${makeGlassColorRow('--lightbox-glass-border', '按钮边框', style, '灯箱/幻灯片按钮边框色')}
        ${makeSliderRow('--lightbox-glass-blur', '灯箱背景模糊', style, 0, 80, 'px', null, 0, '灯箱全屏背景 backdrop-filter 模糊像素')}
        ${makeSliderRow('--lightbox-btn-blur', '按钮模糊', style, 0, 60, 'px', null, 0, '灯箱导航按钮(关闭/前后)的毛玻璃模糊像素')}
        ${makeSliderRow('--lightbox-exif-blur', 'EXIF模糊', style, 0, 60, 'px', null, 0, '灯箱 EXIF 信息条的毛玻璃模糊像素')}
        ${makeSliderRow('--slideshow-blur', '幻灯片模糊', style, 0, 60, 'px', null, 0, '幻灯片播放控件的毛玻璃模糊像素')}
      </details>
    </details>
    </div>
    <div class="dev-section" data-subtab="layout">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">圆角</summary>
      <div class="dev-section__desc">所有 UI 元素的转角弧度：大圆角影响卡片和面板，小圆角影响按钮和输入框，胶囊圆角影响开关和加载条</div>
      ${makeSliderRow('--radius', '大圆角', style, 0, 40, 'px', null, 0, '卡片、面板、弹窗等大元素的圆角')}
      ${makeSliderRow('--radius-sm', '小圆角', style, 0, 30, 'px', null, 0, '按钮、输入框、标签等小元素的圆角')}
    </details>
    </div>
    <div class="dev-section" data-subtab="capsule">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">加载胶囊</summary>
      <div class="dev-section__desc">启动加载进度条的胶囊外观：圆角、粗细和三级文字颜色。圆角影响所有胶囊元素（开关/筛选按钮等）</div>
      ${makeSliderRow('--radius-pill', '胶囊圆角', style, 0, 100, 'px', null, 0, '胶囊圆角：影响加载条、开关、筛选按钮等')}
      ${makeSliderRow('--loading-track-height', '轨道粗细', style, 1, 20, 'px', null, 0, '加载进度轨道的厚度')}
      ${makeGlassColorRow('--loading-color', '加载主色', style, '进度文字和轨道颜色')}
      ${makeGlassColorRow('--loading-color-dim', '加载次色', style, '首次加载提示文字颜色')}
      ${makeGlassColorRow('--loading-color-soft', '加载柔色', style, '底部轮播金句颜色')}
    </details>
    <div class="dev-capsule-preview">
      <div class="dev-capsule-mock">
        <div class="dev-capsule-mock-bg"></div>
        <div class="dev-capsule-mock-orbit">
          ${renderOrbitPreviewSVG()}
        </div>
        <div class="dev-capsule-mock-text">正在生成缩略图... 12 / 48</div>
        <div class="dev-capsule-mock-hint">首次加载，正在生成缩略图缓存…</div>
        <div class="dev-capsule-mock-quote">摄影是光的诗歌，影是时间的印记</div>
      </div>
    </div>
    </div>
    <div class="dev-section" data-subtab="startup">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">启动动画</summary>
      <div class="dev-section__desc">选择启动加载画面的背景动画效果。文字动画（标题入场/副标题/摄影金句）不受影响</div>
      <div class="dev-anim-selector" id="dev-anim-selector">
        ${renderAnimCards()}
      </div>
      <div class="dev-anim-preview-wrap" id="dev-anim-preview"></div>
    </details>
    </div>
    <div class="dev-section" data-subtab="layout">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">网格与间距</summary>
      <div class="dev-section__desc">照片网格的卡片尺寸、元素之间的间距倍率和区块间距</div>
      ${makeSliderRow('--thumb-card-size', '缩略图尺寸', style, 120, 600, 'px', null, 0, '照片网格中每张卡片的大小')}
      ${makeSliderRow('--gap-scale', '间距倍率', style, 0.5, 2.0, 'x', 0.05, 2, '卡片之间的间距缩放 0.5=紧凑 2=宽松')}
      ${makeSliderRow('--section-gap', '区块间距', style, 0.5, 4, 'rem', 0.25, 2, '各页面区块之间的垂直间距')}
    </details>
    </div>
    <div class="dev-section" data-subtab="font">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">字体</summary>
      <div class="dev-section__desc">标题、正文、辅助标签和等宽文字的字体族、粗细、字距、斜体，以及全局大小写变换</div>

      <!-- 全局 -->
      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">全局</div>
      ${makeBtnGroupRow('--text-transform', '大小写', style, [['none','无'],['uppercase','大写'],['lowercase','小写']], '全局文字大小写变换（Bugatti 用大写）')}
      ${makeSliderRow('--font-scale', '字号缩放', style, 0.8, 1.5, 'x', 0.05, 2, '全局字号倍率，影响所有 rem 单位文字')}
      ${makeSliderRow('--font-scale-heading', '标题缩放', style, 0.7, 1.5, 'x', 0.05, 2, '标题相对于基准字号的倍率')}
      ${makeSliderRow('--line-spacing', '行高', style, 1.2, 2.4, '', 0.05, 2, '1.2=紧凑 1.7=标准 2.2=宽松')}

      <!-- 展示字体 -->
      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">展示 Display</div>
      ${makeFontFamilyRow('--font-display', style, FONT_FAMILY_PRESETS.display, '展示字体族：标题、Hero、分类名')}
      ${makeSliderRow('--font-weight-display', '字重', style, 100, 900, '', 100, 0, '100=纤细 400=常规 700=粗')}
      ${makeSliderRow('--letter-spacing-display', '字距', style, -0.05, 0.3, 'em', 0.01, 2, '负值收紧 0=默认 正值放宽')}
      ${makeBtnGroupRow('--font-style-display', '斜体', style, [['normal','常规'],['italic','斜体']], '展示文字斜体/正体')}

      <!-- 正文 -->
      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">正文 Body</div>
      ${makeFontFamilyRow('--font-body', style, FONT_FAMILY_PRESETS.body, '正文字体族：段落、描述、计数')}
      ${makeSliderRow('--font-weight-body', '字重', style, 100, 900, '', 100, 0, '100=纤细 400=常规 700=粗')}
      ${makeSliderRow('--letter-spacing-body', '字距', style, -0.05, 0.2, 'em', 0.01, 2, '负值收紧 0=默认 正值放宽')}
      ${makeBtnGroupRow('--font-style-body', '斜体', style, [['normal','常规'],['italic','斜体']], '正文文字斜体/正体')}

      <!-- 辅助 Caption -->
      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">辅助 Caption</div>
      ${makeFontFamilyRow('--font-caption', style, FONT_FAMILY_PRESETS.caption, '辅助字体族：EXIF标签、提示、时间戳')}
      ${makeSliderRow('--font-weight-caption', '字重', style, 100, 900, '', 100, 0, '100=纤细 400=常规 700=粗')}
      ${makeSliderRow('--letter-spacing-caption', '字距', style, -0.05, 0.3, 'em', 0.01, 2, '负值收紧 0=默认 正值放宽')}
      ${makeBtnGroupRow('--font-style-caption', '斜体', style, [['normal','常规'],['italic','斜体']], '辅助文字斜体/正体')}

      <!-- 等宽 Mono -->
      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">等宽 Mono</div>
      ${makeFontFamilyRow('--font-mono', style, FONT_FAMILY_PRESETS.mono, '等宽字体族：控制台、手柄按钮标签')}
      ${makeSliderRow('--font-weight-mono', '字重', style, 100, 900, '', 100, 0, '100=纤细 400=常规 700=粗')}
      ${makeSliderRow('--letter-spacing-mono', '字距', style, -0.05, 0.3, 'em', 0.01, 2, '负值收紧 0=默认 正值放宽')}
      ${makeBtnGroupRow('--font-style-mono', '斜体', style, [['normal','常规'],['italic','斜体']], '等宽文字斜体/正体')}
    </details>
    </div>
    <div class="dev-section" data-subtab="motion">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">动效</summary>
      <div class="dev-section__desc">过渡动画的缓动曲线和全局动画速度倍率（0=禁用全部动画）</div>
      ${makeTextInputRow('--ease-out', '缓出', style, 'CSS cubic-bezier 缓出曲线')}
      ${makeTextInputRow('--ease-spring', '弹簧', style, 'CSS cubic-bezier 弹性曲线')}
      ${makeSliderRow('--anim-speed', '动画速度', style, 0.1, 5, 'x', 0.1, 1, '全局动画时长倍率：0=停用 0.5=快速 1=正常 2=慢速')}
      <div class="dev-row">
        <span class="dev-row__label">全部动画</span>
        <button class="dev-toggle dev-toggle--on" id="dev-toggle-anim" data-key="anim"></button>
      </div>
    </details>
    </div>
    <div class="dev-section" data-subtab="debug">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">调试</summary>
      <div class="dev-section__desc">开发辅助工具集：关闭面板后持续生效，各开关独立控制</div>

      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">布局分析</div>
      <div class="dev-row" title="所有元素添加半透明强调色边框，看清每个元素的边界和占位"><span class="dev-row__label">元素轮廓</span><button class="dev-toggle" id="dev-toggle-outline" data-key="outline"></button></div>
      <div class="dev-row" style="margin-top:3px" title="主区域叠加 20px 网格背景线，检查像素级对齐和间距一致性"><span class="dev-row__label">网格线</span><button class="dev-toggle" id="dev-toggle-grid-lines" data-key="grid-lines"></button></div>
      <div class="dev-row" style="margin-top:3px" title="鼠标悬停时蓝色填充 + margin虚线，直观显示 content/padding/border/margin 四层"><span class="dev-row__label">盒模型层</span><button class="dev-toggle" id="dev-toggle-box-model" data-key="box-model"></button></div>
      <div class="dev-row" style="margin-top:3px" title="蓝色虚线标记 flex 容器，黄色虚线标记 grid 容器，快速识别页面布局模式"><span class="dev-row__label">Flex/Grid 高亮</span><button class="dev-toggle" id="dev-toggle-layout-hl" data-key="layout-hl"></button></div>
      <div class="dev-row" style="margin-top:3px" title="七色彩虹由浅入深着色(红橙黄绿蓝紫粉)，通过颜色快速判断元素在 DOM 树中的嵌套深度"><span class="dev-row__label">嵌套深度</span><button class="dev-toggle" id="dev-toggle-depth-color" data-key="depth-color"></button></div>

      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">元素检测</div>
      <div class="dev-row" title="红色边框标记所有 overflow:hidden 元素，快速定位可能导致内容被裁切隐藏的位置"><span class="dev-row__label">overflow 标记</span><button class="dev-toggle" id="dev-toggle-overflow" data-key="overflow"></button></div>
      <div class="dev-row" style="margin-top:3px" title="粉色标记空元素(无子节点无文本)，排除 br/hr/img/input 等自闭合标签"><span class="dev-row__label">空元素标记</span><button class="dev-toggle" id="dev-toggle-empty-el" data-key="empty-el"></button></div>
      <div class="dev-row" style="margin-top:3px" title="红色标记无 alt 属性的图片，黄色标记空 alt，虚线标记未设 width/height 的图片"><span class="dev-row__label">图片alt检查</span><button class="dev-toggle" id="dev-toggle-img-alt" data-key="img-alt"></button></div>
      <div class="dev-row" style="margin-top:3px" title="悬停链接显示 href 目标地址；橙色虚线标记无效链接(href为空或#)"><span class="dev-row__label">链接标记</span><button class="dev-toggle" id="dev-toggle-link-info" data-key="link-info"></button></div>
      <div class="dev-row" style="margin-top:3px" title="图片左上角叠加 src 文件路径，追踪每张图片的来源"><span class="dev-row__label">图片信息</span><button class="dev-toggle" id="dev-toggle-img-info" data-key="img-info"></button></div>

      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">信息叠加</div>
      <div class="dev-row" title="悬停时左上角显示标签名和类名如 <div.container>，快速识别元素类型和选择器"><span class="dev-row__label">元素标签</span><button class="dev-toggle" id="dev-toggle-tag-labels" data-key="tag-labels"></button></div>
      <div class="dev-row" style="margin-top:3px" title="悬停文本元素时显示字体族简称 + 字号 + 字重，检查排版一致性"><span class="dev-row__label">字体详情</span><button class="dev-toggle" id="dev-toggle-font-info" data-key="font-info"></button></div>
      <div class="dev-row" style="margin-top:3px" title="悬停时右下角显示元素实际渲染宽×高(px)，检查元素尺寸是否符合预期"><span class="dev-row__label">尺寸标注</span><button class="dev-toggle" id="dev-toggle-size-label" data-key="size-label"></button></div>
      <div class="dev-row" style="margin-top:3px" title="黄色标签显示内联 z-index 值，用于调试元素层叠顺序问题"><span class="dev-row__label">z-index 标签</span><button class="dev-toggle" id="dev-toggle-z-index" data-key="z-index"></button></div>

      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">性能检测</div>
      <div class="dev-row" title="左上角实时显示帧率(FPS)，刷新率低于60时数字变红"><span class="dev-row__label">FPS 角标</span><button class="dev-toggle" id="dev-toggle-fps-badge" data-key="fps-badge"></button></div>
      <div class="dev-row" style="margin-top:3px" title="红色标记渲染尺寸远小于原始尺寸的图片(浪费带宽)，悬停显示原始尺寸"><span class="dev-row__label">图片浪费</span><button class="dev-toggle" id="dev-toggle-img-waste" data-key="img-waste"></button></div>
      <div class="dev-row" style="margin-top:3px" title="左上角显示页面总 DOM 节点数，节点过多(>3000)时变红警告"><span class="dev-row__label">DOM 统计</span><button class="dev-toggle" id="dev-toggle-dom-stats" data-key="dom-stats"></button></div>

      <div class="dev-section__subtitle" style="font-size:0.65rem;color:var(--text-3);margin:0.8rem 0 0.4rem;letter-spacing:0.08em;text-transform:uppercase;">输入检测</div>
      <div class="dev-row" title="屏幕底部显示最近按下的键名和键码，用于调试快捷键和键盘事件"><span class="dev-row__label">键盘日志</span><button class="dev-toggle" id="dev-toggle-key-log" data-key="key-log"></button></div>
      <div class="dev-row" style="margin-top:3px" title="鼠标/触摸点击位置显示波纹扩散动画，确认点击坐标和事件触发位置"><span class="dev-row__label">点击波纹</span><button class="dev-toggle" id="dev-toggle-click-ripple" data-key="click-ripple"></button></div>
      <div class="dev-row" style="margin-top:3px" title="始终高亮当前 focus 元素(蓝色发光边框)，方便键盘导航调试"><span class="dev-row__label">焦点追踪</span><button class="dev-toggle" id="dev-toggle-focus-track" data-key="focus-track"></button></div>

    </details>
    </div>
    <div class="dev-section" data-subtab="lg">
      <details class="dev-zone" open>
        <summary class="dev-zone__summary">液态玻璃</summary>
      <div class="dev-section__desc">CSS backdrop-filter 磨砂玻璃 — 模糊 + 半透明 + 边缘高光 + 投影。鼠标移动时弹性跟随。</div>
      <div class="dev-row">
        <span class="dev-row__label">启用液态玻璃</span>
        <button class="dev-toggle" id="dev-toggle-liquid-glass" data-key="liquid-glass"></button>
      </div>
      <div class="dev-row">
        <span class="dev-row__label">测试背景</span>
        <button class="dev-toggle" id="dev-toggle-lg-test-bg" data-key="lg-test-bg"></button>
      </div>
      ${lgSlider('宽度', 'width', 60, 600, 240, 10, 'px')}
      ${lgSlider('高度', 'height', 60, 600, 240, 10, 'px')}
      ${lgSlider('圆角', 'radius', 0, 100, 36, 2, 'px')}
      ${lgSlider('模糊', 'blur', 0, 40, 6, 1, 'px')}
      ${lgSlider('折射', 'refraction', 0, 200, 150, 2, '')}
      <div class="dev-row">
        <span class="dev-row__label">球型玻璃</span>
        <button class="dev-toggle" id="dev-toggle-lg-sphere" data-key="lg-sphere"></button>
      </div>
      ${lgSlider('饱和度', 'saturate', 0.5, 3, 1.3, 0.1, '')}
      ${lgSlider('底色', 'bgOpacity', 0, 0.5, 0.06, 0.01, '')}
      ${lgSlider('边框', 'borderOpacity', 0, 0.5, 0.15, 0.01, '')}
      ${lgSlider('投影', 'shadowBlur', 0, 80, 40, 2, 'px')}
      ${lgSlider('投影深', 'shadowOpacity', 0, 0.5, 0.15, 0.01, '')}
      ${lgSlider('弹性', 'tension', 50, 400, 170, 10, '')}
      ${lgSlider('阻尼', 'friction', 5, 60, 26, 1, '')}
    </details>
    </div>
      </div>
    </div>
  `;
  el.innerHTML = html;
  bindVisualControls(el);
  buildDevPreview();

  // 液态玻璃：读取滑块值更新 glass div
  const BASE_W = 240, BASE_H = 240;
  const applyLG = () => {
    const g = document.getElementById('liquid-glass');
    if (!g) return;
    const rv = (n, fb) => { const e2 = el.querySelector('[data-lg="' + n + '"]'); if (!e2) return fb; const v = parseFloat(e2.value); return isNaN(v) ? fb : v; };
    const bp = rv('blur', 6), sat = rv('saturate', 1.3), rf = rv('refraction', 0);
    const w = rv('width', BASE_W), h = rv('height', BASE_H);
    // 模糊度跟随尺寸等比缩放，保持视觉一致
    const scale = Math.sqrt((w * h) / (BASE_W * BASE_H));
    const effectiveBlur = bp * scale;
    const effectiveRefraction = rf * scale;
    g.style.width = w + 'px';
    g.style.height = h + 'px';
    g.style.borderRadius = rv('radius', 36) + 'px';
    g.style.background = 'rgba(255,255,255,' + rv('bgOpacity', 0.06) + ')';
    g.style.border = '1px solid rgba(255,255,255,' + rv('borderOpacity', 0.15) + ')';
    g.style.boxShadow = '0 8px ' + rv('shadowBlur', 40) + 'px rgba(0,0,0,' + rv('shadowOpacity', 0.15) + '), inset 0 1px 0 rgba(255,255,255,0.2)';
    const bf = 'blur(' + effectiveBlur.toFixed(1) + 'px) saturate(' + sat + ')' + (rf > 0 ? ' url(#lg-refract)' : '');
    g.style.backdropFilter = bf;
    g.style.WebkitBackdropFilter = bf;
    const st = getStudio();
    if (st) { st.setShape(w, h, rv('radius', 36)); st.setRefraction(effectiveRefraction); st.updateControls({ tension: rv('tension', 170), friction: rv('friction', 26) }); }
  };

  // 开关
  const lgToggle = el.querySelector('#dev-toggle-liquid-glass');
  if (lgToggle) {
    lgToggle.addEventListener('click', () => {
      const on = lgToggle.classList.toggle('dev-toggle--on');
      D.liquidGlassOn = on;
      if (on) { mountLiquidGlass(); setTimeout(applyLG, 50); setTimeout(applyLG, 300); }
      else { unmountLiquidGlass(); }
    });
  }

  // 测试背景 — 单击轮播（liquid-glass-studio 案例图片）
  let _lgBgIdx = 0;
  const _lgBgLabel = ['网格', '条纹', '半色', '太浩湖', '建筑', '文字', 'TimCook', 'UI界面'];
  const _lgBgUrls = ['assets/bg-grid.png', 'assets/bg-bars.png', 'assets/bg-half.png', 'assets/bg-tahoe-light.webp', 'assets/bg-buildings.png', 'assets/bg-text.jpg', 'assets/bg-timcook.png', 'assets/bg-ui.svg'];
  const _makeBg = (url) => {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none;' +
      'background: url(' + url + ') center/cover no-repeat;';
    return bg;
  };

  const lgTestBg = el.querySelector('#dev-toggle-lg-test-bg');
  if (lgTestBg) {
    lgTestBg.addEventListener('click', () => {
      const old = document.getElementById('__lg_test_bg');
      if (old) {
        old.remove();
        lgTestBg.classList.remove('dev-toggle--on');
        D.liquidGlassTestBg = false;
        lgTestBg.title = '测试背景';
      } else {
        const bg = _makeBg(_lgBgUrls[_lgBgIdx]);
        bg.id = '__lg_test_bg';
        document.body.appendChild(bg);
        lgTestBg.classList.add('dev-toggle--on');
        D.liquidGlassTestBg = true;
        lgTestBg.title = '测试背景: ' + _lgBgLabel[_lgBgIdx] + ' (再点关闭 / 右键切换)';
      }
    });
    lgTestBg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const old = document.getElementById('__lg_test_bg');
      if (!old) return;
      old.remove();
      _lgBgIdx = (_lgBgIdx + 1) % _lgBgUrls.length;
      const bg = _makeBg(_lgBgUrls[_lgBgIdx]);
      bg.id = '__lg_test_bg';
      document.body.appendChild(bg);
      lgTestBg.title = '测试背景: ' + _lgBgLabel[_lgBgIdx] + ' (再点关闭 / 右键切换)';
    });
  }

  // 球型玻璃
  const lgSphere = el.querySelector('#dev-toggle-lg-sphere');
  if (lgSphere) {
    lgSphere.addEventListener('click', () => {
      const on = lgSphere.classList.toggle('dev-toggle--on');
      const g = document.getElementById('liquid-glass');
      if (g) {
        if (on) {
          g.dataset.sphere = '1';
          const s = Math.max(g.offsetWidth, g.offsetHeight);
          g.style.width = s + 'px'; g.style.height = s + 'px';
          g.style.borderRadius = '50%';
        } else {
          g.dataset.sphere = '0';
          applyLG();
        }
      }
    });
  }

  // 滑块
  el.querySelectorAll('[data-lg]').forEach(sl => {
    sl.addEventListener('input', () => {
      const val = parseFloat(sl.value);
      const display = sl.parentElement.querySelector('.dev-row__value');
      if (display) display.textContent = val;
      applyLG();
    });
  });

  // 卡片真实渲染（初始渲染后执行一次）
  requestAnimationFrame(() => initCardPreviews(el));
}

function makeColorRow(key, label, style, tip) {
  const val = style.getPropertyValue(key).trim();
  const tipAttr = tip ? ` title="${escapeHtml(tip)}"` : '';
  return `<div class="dev-row">
    <span class="dev-row__label"${tipAttr}>${label}</span>
    <button class="dev-color-trigger" data-css="${key}" data-value="${escapeHtml(val)}" data-alpha="false">
      <span class="dev-color-trigger__swatch" style="background:${escapeHtml(val)}"></span>
      <span class="dev-color-trigger__value">${escapeHtml(val)}</span>
    </button>
    <button class="dev-btn" data-reset="${key}" title="复位">↺</button>
  </div>`;
}

function lgSlider(label, name, min, max, val, step, unit) {
  return `<div class="dev-row">
    <span class="dev-row__label">${label}</span>
    <input type="range" class="dev-slider" data-lg="${name}" min="${min}" max="${max}" step="${step}" value="${val}">
    <span class="dev-row__value">${val}${unit}</span>
  </div>`;
}

function makeSliderRow(key, label, style, min, max, unit, step, decimals, tip) {
  const raw = style.getPropertyValue(key).trim();
  // 解析 calc() 表达式（如 "calc(24px + 0px)"），提取第一个数字
  const calcMatch = raw.match(/^calc\(([\d.]+)px/);
  // 解析 var() 表达式（如 "var(--glass-blur,0px)"），提取 fallback 数字
  const varMatch = raw.match(/^var\([^,]+,\s*([\d.]+)px/);
  const num = calcMatch ? parseFloat(calcMatch[1]) : (varMatch ? parseFloat(varMatch[1]) : (parseFloat(raw) || min));
  const s = step || (max - min > 100 ? 5 : 1);
  const d = decimals != null ? decimals : (s < 1 ? 2 : 0);
  const tipAttr = tip ? ` title="${tip}"` : '';
  return `<div class="dev-row">
    <span class="dev-row__label"${tipAttr}>${label}</span>
    <input type="range" class="dev-slider" data-css="${key}" min="${min}" max="${max}" step="${s}" value="${num}">
    <span class="dev-row__value" data-display="${key}" data-unit="${unit}" data-decimals="${d}">${num.toFixed(d)}${unit}</span>
    <button class="dev-btn" data-reset="${key}" title="重置">↺</button>
  </div>`;
}

function rgbaToHexAlpha(rgba) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { hex: '#888888', alpha: 1 };
  const hex = '#' + [m[1],m[2],m[3]].map(v => parseInt(v).toString(16).padStart(2,'0')).join('');
  return { hex, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

function makeGlassColorRow(key, label, style, tip) {
  const val = style.getPropertyValue(key).trim();
  const tipAttr = tip ? ` title="${escapeHtml(tip)}"` : '';
  return `<div class="dev-row">
    <span class="dev-row__label"${tipAttr}>${label}</span>
    <button class="dev-color-trigger" data-css="${key}" data-value="${escapeHtml(val)}" data-alpha="true">
      <span class="dev-color-trigger__swatch" style="background:${escapeHtml(val)}"></span>
      <span class="dev-color-trigger__value">${escapeHtml(val)}</span>
    </button>
    <button class="dev-btn" data-reset="${key}" title="重置">↺</button>
  </div>`;
}

function makeBtnGroupRow(key, label, style, options, tooltip) {
  const val = style.getPropertyValue(key).trim() || options[0][0];
  const btns = options.map(([v, name]) => `<button class="dev-btn dev-btn--sm${val===v?' dev-btn--active':''}" data-css-btn="${key}" data-value="${v}">${name}</button>`).join('');
  return `<div class="dev-row" data-tooltip="${tooltip||''}">
    <span class="dev-row__label">${label}</span>
    <div class="dev-row__btns" style="display:flex;gap:4px;">${btns}</div>
  </div>`;
}

function makeTextInputRow(key, label, style, tip) {
  const val = style.getPropertyValue(key).trim();
  const tipAttr = tip ? ` title="${tip}"` : '';
  return `<div class="dev-row dev-row--col">
    <span class="dev-row__label"${tipAttr}>${label}</span>
    <input type="text" class="dev-input dev-input--text" data-css-text="${key}" value="${val}" spellcheck="false">
  </div>`;
}

function makeFontFamilyRow(key, style, presets, tooltip) {
  const val = style.getPropertyValue(key).trim();
  // Find which preset matches (or custom)
  let activeId = '_custom_';
  for (const [id, label, cssValue] of presets) {
    if (val === cssValue) { activeId = id; break; }
  }
  const btns = presets.map(([id, label, cssValue]) =>
    `<button class="dev-btn dev-btn--sm${id===activeId?' dev-btn--active':''}" data-font-preset="${key}" data-preset-id="${id}" style="font-family:${cssValue};">${label}</button>`
  ).join('');
  const customVisible = activeId === '_custom_' ? '' : ' style="display:none"';
  return `<div class="dev-row" data-tooltip="${tooltip||''}">
    <span class="dev-row__label" style="min-width:0;width:auto;">字体</span>
    <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${btns}<button class="dev-btn dev-btn--sm${activeId==='_custom_'?' dev-btn--active':''}" data-font-preset="${key}" data-preset-id="_custom_">自定义</button></div>
      <input class="dev-input dev-input--text" data-css-text="${key}" value="${escapeHtml(val)}"${customVisible}>
    </div>
  </div>`;
}

function escapeHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let _animPreviewHandle = null;

function ensurePreviewFixCSS() {
  if (document.getElementById('__lg_preview_fix')) return;
  const style = document.createElement('style');
  style.id = '__lg_preview_fix';
  style.textContent = [
    // ── 全屏预览覆盖 ──
    '#dev-anim-full-bg .hero-aurora-layer{',
    'inset:0!important;filter:blur(4px)!important;opacity:0.55!important;',
    'mask-image:radial-gradient(ellipse at 50% 50%,black 20%,transparent 85%)!important;',
    '-webkit-mask-image:radial-gradient(ellipse at 50% 50%,black 20%,transparent 85%)!important;}',
    '#dev-anim-full-bg .hero-aurora-layer::after{background-attachment:scroll!important;}',
    '#dev-anim-full-bg .hero-falling-layer{',
    'mask-image:radial-gradient(ellipse at 50% 50%,black 25%,transparent 90%)!important;',
    '-webkit-mask-image:radial-gradient(ellipse at 50% 50%,black 25%,transparent 90%)!important;}',
    '#dev-anim-full-bg .hero-falling-blur{',
    'backdrop-filter:blur(0.3em)!important;-webkit-backdrop-filter:blur(0.3em)!important;}',
    '#dev-anim-full-bg .hero-gradbar-wrap{opacity:0.45!important;}',
    '#dev-anim-full-bg .hero-gradbar-bar{max-height:100%!important;}',
    '#dev-anim-full-bg canvas{max-width:100%!important;max-height:100%!important;}',
    // ── 卡片覆盖 — 微型真实渲染 ──
    '.dev-anim-card__preview .hero-aurora-layer{',
    'inset:-4px!important;filter:blur(1px)!important;opacity:0.45!important;',
    'mask-image:radial-gradient(ellipse at 50% 50%,black 30%,transparent 80%)!important;',
    '-webkit-mask-image:radial-gradient(ellipse at 50% 50%,black 30%,transparent 80%)!important;}',
    '.dev-anim-card__preview .hero-aurora-layer::after{background-attachment:scroll!important;}',
    '.dev-anim-card__preview .hero-falling-layer{',
    'mask-image:radial-gradient(ellipse at 50% 50%,black 35%,transparent 85%)!important;',
    '-webkit-mask-image:radial-gradient(ellipse at 50% 50%,black 35%,transparent 85%)!important;}',
    '.dev-anim-card__preview .hero-falling-blur{',
    'backdrop-filter:blur(0.1em)!important;-webkit-backdrop-filter:blur(0.1em)!important;}',
    '.dev-anim-card__preview .hero-gradbar-wrap{opacity:0.35!important;}',
    '.dev-anim-card__preview .hero-gradbar-bar{max-height:100%!important;}',
    '.dev-anim-card__preview canvas{max-width:100%!important;max-height:100%!important;}',
  ].join('');
  document.head.appendChild(style);
}

let _cardHandles = [];

function disposeCardPreviews() {
  _cardHandles.forEach(h => { try { h.dispose(); } catch(e) {} });
  _cardHandles = [];
}

function initCardPreviews(el) {
  disposeCardPreviews();
  const threeJsTypes = ['shader-waves','shader-lines','paper-shaders','chroma-rgb'];

  el.querySelectorAll('.dev-anim-card').forEach(card => {
    const type = card.dataset.anim;
    if (type === 'orbit-capsule') return; // 已有真实 SVG

    const preview = card.querySelector('.dev-anim-card__shader-mini');
    if (!preview) return;

    try {
      if (threeJsTypes.includes(type)) {
        _cardHandles.push(createMiniShaderPreview(preview, 64, type));
      } else if (type === 'aurora') {
        createAuroraBackground(preview);
        _cardHandles.push({ dispose: () => disposeAuroraBackground(preview) });
      } else if (type === 'falling-pattern') {
        createFallingBackground(preview);
        _cardHandles.push({ dispose: () => disposeFallingBackground(preview) });
      } else if (type === 'gradient-bars') {
        createGradientBarsBackground(preview);
        _cardHandles.push({ dispose: () => disposeGradientBarsBackground(preview) });
      } else if (type === 'webgl-palette') {
        _cardHandles.push(createWebGLBackground(preview));
      } else if (type === 'vol-aurora') {
        _cardHandles.push(createVolAuroraBackground(preview));
      } else if (type === 'dither-ripple') {
        _cardHandles.push(createDitherBackground(preview));
      } else if (type === 'wave-grid') {
        _cardHandles.push(createWaveGridBackground(preview));
      }
    } catch (e) { /* 跳过无法创建的 */ }
  });
}

function updateAnimPreview(el) {
  const wrap = el.querySelector('#dev-anim-preview');
  if (!wrap) return;
  if (_animPreviewHandle) { _animPreviewHandle.dispose(); _animPreviewHandle = null; }
  wrap.innerHTML = '';

  const active = getAnimationType();
  wrap.innerHTML = `
    <div class="dev-anim-full-preview">
      <div class="dev-anim-full-bg" id="dev-anim-full-bg"></div>
      <div class="dev-anim-full-reveal"></div>
      <div class="dev-anim-full-label">LENS</div>
      <div class="dev-anim-full-sub">Photography Portfolio</div>
    </div>
  `;

  ensurePreviewFixCSS();

  requestAnimationFrame(() => {
    const bgEl = wrap.querySelector('#dev-anim-full-bg');
    if (!bgEl) return;
    const s = getComputedStyle(document.documentElement);
    const accentRgb = s.getPropertyValue('--accent-rgb').trim() || '200,168,124';

    // Three.js WebGL — 真实着色器
    const threeJsTypes = ['shader-waves','shader-lines','paper-shaders','chroma-rgb'];
    if (threeJsTypes.includes(active)) {
      _animPreviewHandle = createMiniShaderPreview(bgEl, 320, active);
      return;
    }

    // 真实 create*Background（与启动画面完全相同）
    if (active === 'aurora') {
      createAuroraBackground(bgEl);
      _animPreviewHandle = { dispose: () => disposeAuroraBackground(bgEl) };
      return;
    }
    if (active === 'falling-pattern') {
      createFallingBackground(bgEl);
      _animPreviewHandle = { dispose: () => disposeFallingBackground(bgEl) };
      return;
    }
    if (active === 'gradient-bars') {
      createGradientBarsBackground(bgEl);
      _animPreviewHandle = { dispose: () => disposeGradientBarsBackground(bgEl) };
      return;
    }

    // orbit-capsule — 默认模式，无背景动画，保持暗色底色即可
    if (active === 'orbit-capsule') {
      bgEl.style.background = `rgba(${accentRgb},0.06)`;
      _animPreviewHandle = { dispose: () => { bgEl.style.background = ''; } };
      return;
    }

    // webgl-palette / vol-aurora / dither-ripple / wave-grid — 真实渲染
    if (active === 'webgl-palette') {
      _animPreviewHandle = createWebGLBackground(bgEl);
      return;
    }
    if (active === 'vol-aurora') {
      _animPreviewHandle = createVolAuroraBackground(bgEl);
      return;
    }
    if (active === 'dither-ripple') {
      _animPreviewHandle = createDitherBackground(bgEl);
      return;
    }
    if (active === 'wave-grid') {
      _animPreviewHandle = createWaveGridBackground(bgEl);
      return;
    }
  });
}

function renderAnimCards() {
  // 卡片只是选择器，真正预览在下方 updateAnimPreview() 中
  const active = getAnimationType();
  return Object.entries(ANIMATION_TYPES).map(([id, info]) => {
    const previewHTML = id === 'orbit-capsule'
      ? `<div class="dev-anim-card__orbit-wrap">${renderOrbitPreviewSVG()}</div>`
      : '<div class="dev-anim-card__shader-mini"></div>';
    return `
      <button class="dev-anim-card${id === active ? ' dev-anim-card--active' : ''}" data-anim="${id}">
        <div class="dev-anim-card__preview">${previewHTML}</div>
        <span class="dev-anim-card__name">${info.name}</span>
        <span class="dev-anim-card__desc">${info.description}</span>
      </button>
    `;
  }).join('');
}

function renderOrbitPreviewSVG() {
  // 微型 SVG 轨道胶囊，100% 复刻真实加载画面的光环动画
  // 颜色使用 CSS currentColor 继承，由父容器设置 --loading-color 变量
  return `
    <svg class="dev-anim-orbit-svg" viewBox="0 0 208 44" width="160" height="34">
      <defs>
        <filter id="dev-orbit-glow">
          <feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect x="16" y="11" width="176" height="22" rx="11" ry="11"
            fill="none" stroke="var(--loading-color, rgba(220,200,180,0.55))" stroke-width="1" opacity="0.73"
            style="rx:min(var(--radius-pill),11px);ry:min(var(--radius-pill),11px)"/>
      <rect class="dev-anim-orbit-light" x="16" y="11" width="176" height="22" rx="11" ry="11"
            fill="none" stroke="var(--loading-color, rgba(220,200,180,0.55))" stroke-width="1.5"
            stroke-dasharray="28 430" stroke-dashoffset="0"
            filter="url(#dev-orbit-glow)" stroke-linecap="round"
            style="rx:min(var(--radius-pill),11px);ry:min(var(--radius-pill),11px)"/>
    </svg>
  `;
}

function bindVisualControls(el) {
  // 视觉面板左侧二级导航
  el.querySelectorAll('.dev-subnav [data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subtab = btn.dataset.subtab;
      el.querySelectorAll('.dev-subnav [data-subtab]').forEach(b => b.classList.remove('dev-subnav__btn--active'));
      btn.classList.add('dev-subnav__btn--active');
      el.querySelectorAll('.dev-section[data-subtab]').forEach(sec => {
        sec.style.display = (subtab === 'all' || sec.dataset.subtab === subtab) ? '' : 'none';
      });
    });
  });
  // 滑块
  el.querySelectorAll('.dev-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.css;
      const val = parseFloat(slider.value);
      const display = slider.parentElement.querySelector(`[data-display="${key}"]`);
      const unit = display ? display.dataset.unit : '';
      const d = display ? parseInt(display.dataset.decimals) || 0 : 0;
      document.documentElement.style.setProperty(key, val + unit);
      if (display) display.textContent = val.toFixed(d) + unit;
    });
  });
  // 重置按钮
  el.querySelectorAll('.dev-btn[data-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.reset;
      const def = CSS_DEFAULTS[key];
      if (!def) return;
      document.documentElement.style.setProperty(key, def);

      // 特殊变量的额外清理
      if (key === '--font-scale') {
        document.documentElement.style.fontSize = '';
      }
      if (key === '--anim-speed') {
        const s = document.getElementById('dev-anim-speed');
        if (s) s.remove();
        const animToggle = el.querySelector('#dev-toggle-anim');
        if (animToggle && !animToggle.classList.contains('dev-toggle--on')) {
          animToggle.classList.add('dev-toggle--on');
          const ds = document.getElementById('dev-anim-disable');
          if (ds) ds.remove();
        }
      }
      // 同步控件
      const slider = el.querySelector(`.dev-slider[data-css="${key}"]`);
      if (slider) {
        const calcMatch = def.match(/^calc\(([\d.]+)px/);
        const num = calcMatch ? parseFloat(calcMatch[1]) : (parseFloat(def) || 0);
        slider.value = num;
        const display = slider.parentElement.querySelector(`[data-display="${key}"]`);
        if (display) {
          const unit = display.dataset.unit || '';
          const d = parseInt(display.dataset.decimals) || 0;
          display.textContent = num.toFixed(d) + unit;
        }
      }
      // 内联取色器重置
      const colorTrigger = el.querySelector(`.dev-color-trigger[data-css="${key}"]`);
      if (colorTrigger) {
        colorTrigger.dataset.value = def;
        const swatch = colorTrigger.querySelector('.dev-color-trigger__swatch');
        const valEl = colorTrigger.querySelector('.dev-color-trigger__value');
        if (swatch) swatch.style.background = def;
        if (valEl) valEl.textContent = def;
      }
      // 文本输入重置
      const textInput = el.querySelector(`.dev-input--text[data-css-text="${key}"]`);
      if (textInput) textInput.value = def;
      autoSaveSession();
      scheduleApplyEffects();
    });
  });
  // 动画开关 — 注入/移除全局 animation/transition 禁用样式
  const animToggle = el.querySelector('#dev-toggle-anim');
  if (animToggle) {
    // 恢复保存的状态
    const animSpeed = getComputedStyle(document.documentElement).getPropertyValue('--anim-speed').trim();
    if (animSpeed === '0') animToggle.classList.remove('dev-toggle--on');

    animToggle.addEventListener('click', () => {
      const on = animToggle.classList.toggle('dev-toggle--on');
      document.documentElement.style.setProperty('--anim-speed', on ? '1' : '0');
      if (on) {
        const s = document.getElementById('dev-anim-disable');
        if (s) s.remove();
      } else {
        let s = document.getElementById('dev-anim-disable');
        if (!s) {
          s = document.createElement('style'); s.id = 'dev-anim-disable';
          s.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
          document.head.appendChild(s);
        }
      }
      const slider = el.querySelector('.dev-slider[data-css="--anim-speed"]');
      if (slider) slider.value = on ? 1 : 0;
      const display = el.querySelector('[data-display="--anim-speed"]');
      if (display) display.textContent = on ? '1.0x' : '0.0x';
      autoSaveSession();
    });
  }

  // --font-scale 滑块：修改 html font-size（rem 基准）
  const fontScaleSlider = el.querySelector('.dev-slider[data-css="--font-scale"]');
  if (fontScaleSlider) {
    // 劫持 input 事件，同步修改 html font-size
    fontScaleSlider.addEventListener('input', () => {
      const val = parseFloat(fontScaleSlider.value);
      document.documentElement.style.fontSize = (val * 100) + '%';
      document.documentElement.style.setProperty('--font-scale', String(val));
    });
  }

  // --anim-speed 滑块：调整注入的全局动画速度
  const animSpeedSlider = el.querySelector('.dev-slider[data-css="--anim-speed"]');
  if (animSpeedSlider) {
    animSpeedSlider.addEventListener('input', () => {
      const val = parseFloat(animSpeedSlider.value);
      document.documentElement.style.setProperty('--anim-speed', String(val));
      // 移除旧的注入样式并创建新的
      let s = document.getElementById('dev-anim-speed');
      if (s) s.remove();
      s = document.createElement('style'); s.id = 'dev-anim-speed';
      // 通过 clip-path hack 无法通用控制 duration，用 CSS 变量在关键位置生效
      s.textContent = `:root { --_anim-mult: ${val}; }`;
      document.head.appendChild(s);
      // 如果 toggle 是 off 状态但 slider > 0，自动打开 toggle
      const animToggle = el.querySelector('#dev-toggle-anim');
      if (animToggle && val > 0 && !animToggle.classList.contains('dev-toggle--on')) {
        animToggle.classList.add('dev-toggle--on');
        const disableStyle = document.getElementById('dev-anim-disable');
        if (disableStyle) disableStyle.remove();
      }
    });
  }

  // --glass-blur 滑块：直接设置 CSS 变量，所有 backdrop-filter 通过 var() 引用
  const glassBlurSlider = el.querySelector('.dev-slider[data-css="--glass-blur"]');
  if (glassBlurSlider) {
    glassBlurSlider.addEventListener('input', () => {
      const val = parseFloat(glassBlurSlider.value);
      document.documentElement.style.setProperty('--glass-blur', val + 'px');
    });
  }

  // 调试轮廓开关
  const outlineToggle = el.querySelector('#dev-toggle-outline');
  if (outlineToggle) {
    outlineToggle.addEventListener('click', () => {
      const on = outlineToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const accentRgb = (() => { const a = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c8a87c'; const m=a.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i); return m?`${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`:'200,168,124'; })();
        const s = document.createElement('style'); s.id = 'dev-outline-style';
        s.textContent = `*{outline:0.5px solid rgba(${accentRgb},0.15)!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-outline-style');
        if (s) s.remove();
      }
    });
  }
  // 网格线开关
  const gridToggle = el.querySelector('#dev-toggle-grid-lines');
  if (gridToggle) {
    gridToggle.addEventListener('click', () => {
      const on = gridToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const accentRgb = (() => { const a = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c8a87c'; const m=a.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i); return m?`${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`:'200,168,124'; })();
        const s = document.createElement('style'); s.id = 'dev-grid-style';
        s.textContent = `.main-area,.portfolio{background-image:linear-gradient(rgba(${accentRgb},0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(${accentRgb},0.04) 1px,transparent 1px)!important;background-size:20px 20px!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-grid-style');
        if (s) s.remove();
      }
    });
  }

  // 盒模型层开关 — 鼠标悬停时显示盒模型

  const boxModelToggle = el.querySelector('#dev-toggle-box-model');
  if (boxModelToggle) {
    boxModelToggle.addEventListener('click', () => {
      const on = boxModelToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-box-model-style';
        s.textContent = `.dev-bm-hover{position:relative}.dev-bm-hover::before{content:'';position:absolute;inset:0;background:rgba(0,0,255,0.06);z-index:99999;pointer-events:none}.dev-bm-hover::after{content:'';position:absolute;inset:-4px;border:1px dashed rgba(0,255,0,0.35);z-index:99998;pointer-events:none}`;
        document.head.appendChild(s);
        // MutationObserver 持续给 body 加 class 让所有元素都有 :hover 效果不可行
        // 改为注入 style 用 *:hover 规则
        const s2 = document.createElement('style'); s2.id = 'dev-box-model-hover';
        s2.textContent = `body.dev-bm-active *:hover{outline:1px solid rgba(0,120,255,0.4)!important;background:rgba(0,120,255,0.04)!important}`;
        document.head.appendChild(s2);
        document.body.classList.add('dev-bm-active');
      } else {
        ['dev-box-model-style','dev-box-model-hover'].forEach(id => { const s=document.getElementById(id); if(s)s.remove(); });
        document.body.classList.remove('dev-bm-active');
      }
    });
  }

  // overflow 标记开关
  const overflowToggle = el.querySelector('#dev-toggle-overflow');
  if (overflowToggle) {
    overflowToggle.addEventListener('click', () => {
      const on = overflowToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-overflow-style';
        s.textContent = `*{--_dev-of:none}[style*="overflow:hidden"],*[style*="overflow: hidden"]{outline:2px solid rgba(255,60,60,0.4)!important;outline-offset:-1px}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-overflow-style');
        if (s) s.remove();
      }
    });
  }

  // 图片信息开关
  const imgInfoToggle = el.querySelector('#dev-toggle-img-info');
  if (imgInfoToggle) {
    imgInfoToggle.addEventListener('click', () => {
      const on = imgInfoToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-img-info-style';
        s.textContent = `img{position:relative}img::after{content:attr(src);position:absolute;top:0;left:0;font-size:10px;color:#fff;background:rgba(0,0,0,0.7);padding:2px 6px;z-index:99999;pointer-events:none;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-img-info-style');
        if (s) s.remove();
      }
    });
  }

  // z-index 标签开关
  const zIndexToggle = el.querySelector('#dev-toggle-z-index');
  if (zIndexToggle) {
    zIndexToggle.addEventListener('click', () => {
      const on = zIndexToggle.classList.toggle('dev-toggle--on');
      if (on) {
        // 注入 CSS 显示 z-index > 0 元素的标签
        const s = document.createElement('style'); s.id = 'dev-z-index-style';
        s.textContent = `[style*="z-index:"]::before{content:'z:' attr(style);position:absolute;top:0;left:0;font-size:9px;color:#ff0;background:rgba(0,0,0,0.8);padding:1px 4px;z-index:999999;pointer-events:none;font-family:monospace;white-space:nowrap;border-radius:2px}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-z-index-style');
        if (s) s.remove();
      }
    });
  }

  // 元素标签 — hover 显示标签名和类名
  const tagLabelsToggle = el.querySelector('#dev-toggle-tag-labels');
  if (tagLabelsToggle) {
    let tagLabelsObserver = null;
    tagLabelsToggle.addEventListener('click', () => {
      const on = tagLabelsToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-tag-labels-style';
        s.textContent = '*[data-dev-tag]:hover::after{content:attr(data-dev-tag)!important;position:absolute!important;top:-20px!important;left:0!important;font-size:10px!important;font-family:monospace!important;color:#fff!important;background:rgba(0,0,0,0.85)!important;padding:2px 6px!important;border-radius:3px!important;z-index:999999!important;pointer-events:none!important;white-space:nowrap!important}';
        document.head.appendChild(s);
        // 一次扫描给元素打标签
        const tagAll = () => document.querySelectorAll('*').forEach(el => {
          if (el === document.documentElement || el === document.body) return;
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(c=>c).slice(0,2).join('.') : '';
          el.setAttribute('data-dev-tag', `<${tag}${cls}>`);
        });
        tagAll();
        tagLabelsObserver = new MutationObserver(() => tagAll());
        tagLabelsObserver.observe(document.body, { childList: true, subtree: true });
      } else {
        const s = document.getElementById('dev-tag-labels-style'); if (s) s.remove();
        if (tagLabelsObserver) { tagLabelsObserver.disconnect(); tagLabelsObserver = null; }
        document.querySelectorAll('[data-dev-tag]').forEach(el => el.removeAttribute('data-dev-tag'));
      }
    });
  }

  // Flex/Grid 高亮
  const layoutHlToggle = el.querySelector('#dev-toggle-layout-hl');
  if (layoutHlToggle) {
    layoutHlToggle.addEventListener('click', () => {
      const on = layoutHlToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-layout-hl-style';
        s.textContent = `[style*="display:flex" i],[style*="display: flex" i],.toolbar,.sidebar,.categories,.gallery__grid,.portfolio,.gallery__nav,.custom-dropdown__menu{outline:2px dashed rgba(0,200,255,0.5)!important;outline-offset:-1px!important}
[style*="display:grid" i],[style*="display: grid" i],[class*="grid"]{outline:2px dashed rgba(255,200,0,0.5)!important;outline-offset:-1px!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-layout-hl-style'); if (s) s.remove();
      }
    });
  }

  // 空元素标记
  const emptyElToggle = el.querySelector('#dev-toggle-empty-el');
  if (emptyElToggle) {
    emptyElToggle.addEventListener('click', () => {
      const on = emptyElToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-empty-el-style';
        s.textContent = `*:empty:not(script):not(style):not(link):not(meta):not(br):not(hr):not(img):not(input):not(source):not(track):not(col){outline:2px solid rgba(255,100,200,0.6)!important;outline-offset:-1px!important;background:rgba(255,100,200,0.06)!important;min-width:20px!important;min-height:12px!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-empty-el-style'); if (s) s.remove();
      }
    });
  }

  // 嵌套深度着色
  const depthToggle = el.querySelector('#dev-toggle-depth-color');
  if (depthToggle) {
    depthToggle.addEventListener('click', () => {
      const on = depthToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-depth-color-style';
        s.textContent = `body>*{outline:1px solid rgba(255,80,80,0.35)!important;outline-offset:-1px}
body>*>*{outline:1px solid rgba(255,180,60,0.35)!important;outline-offset:-1px}
body>*>*>*{outline:1px solid rgba(255,255,80,0.35)!important;outline-offset:-1px}
body>*>*>*>*{outline:1px solid rgba(80,255,80,0.35)!important;outline-offset:-1px}
body>*>*>*>*>*{outline:1px solid rgba(80,180,255,0.35)!important;outline-offset:-1px}
body>*>*>*>*>*>*{outline:1px solid rgba(120,80,255,0.35)!important;outline-offset:-1px}
body>*>*>*>*>*>*>*{outline:1px solid rgba(255,80,255,0.35)!important;outline-offset:-1px}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-depth-color-style'); if (s) s.remove();
      }
    });
  }

  // 字体详情 — hover 显示字体栈
  const fontInfoToggle = el.querySelector('#dev-toggle-font-info');
  if (fontInfoToggle) {
    let fontInfoObserver = null;
    fontInfoToggle.addEventListener('click', () => {
      const on = fontInfoToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-font-info-style';
        s.textContent = `*[data-dev-font]:hover::after{content:attr(data-dev-font)!important;position:absolute!important;top:-28px!important;left:0!important;font-size:10px!important;font-family:monospace!important;color:#ff0!important;background:rgba(0,0,0,0.9)!important;padding:2px 8px!important;border-radius:3px!important;z-index:999999!important;pointer-events:none!important;white-space:nowrap!important;max-width:400px!important;overflow:hidden!important;text-overflow:ellipsis!important}`;
        document.head.appendChild(s);
        const tagFonts = () => document.querySelectorAll('p,span,a,h1,h2,h3,h4,h5,h6,div,button,li,td,th,label,figcaption,blockquote').forEach(el => {
          const cs = getComputedStyle(el);
          const info = `${cs.fontFamily.split(',')[0].trim()} ${cs.fontSize} w${cs.fontWeight}`;
          el.setAttribute('data-dev-font', info);
        });
        tagFonts();
        fontInfoObserver = new MutationObserver(() => tagFonts());
        fontInfoObserver.observe(document.body, { childList: true, subtree: true });
      } else {
        const s = document.getElementById('dev-font-info-style'); if (s) s.remove();
        if (fontInfoObserver) { fontInfoObserver.disconnect(); fontInfoObserver = null; }
        document.querySelectorAll('[data-dev-font]').forEach(el => el.removeAttribute('data-dev-font'));
      }
    });
  }

  // 链接标记
  const linkInfoToggle = el.querySelector('#dev-toggle-link-info');
  if (linkInfoToggle) {
    linkInfoToggle.addEventListener('click', () => {
      const on = linkInfoToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-link-info-style';
        s.textContent = `a[href]:not([href="#"]):not([href=""]):hover::after{content:" → " attr(href)!important;position:absolute!important;top:100%!important;left:0!important;font-size:10px!important;font-family:monospace!important;color:#0ff!important;background:rgba(0,0,0,0.9)!important;padding:2px 8px!important;border-radius:3px!important;z-index:999999!important;pointer-events:none!important;white-space:nowrap!important;max-width:400px!important;overflow:hidden!important;text-overflow:ellipsis!important}
a:not([href]),a[href="#"],a[href=""]{outline:2px dotted rgba(255,120,0,0.6)!important;outline-offset:2px!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-link-info-style'); if (s) s.remove();
      }
    });
  }

  // 图片alt检查
  const imgAltToggle = el.querySelector('#dev-toggle-img-alt');
  if (imgAltToggle) {
    imgAltToggle.addEventListener('click', () => {
      const on = imgAltToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-img-alt-style';
        s.textContent = `img:not([alt]){outline:3px solid rgba(255,60,60,0.7)!important;outline-offset:2px!important;filter:sepia(0.8) hue-rotate(-20deg)!important}
img[alt=""]{outline:3px solid rgba(255,180,60,0.7)!important;outline-offset:2px!important}
img:not([width]):not([height]){outline:1px dotted rgba(255,200,0,0.4)!important;outline-offset:3px!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-img-alt-style'); if (s) s.remove();
      }
    });
  }

  // 尺寸标注 — 悬浮显示元素宽高
  const sizeLabelToggle = el.querySelector('#dev-toggle-size-label');
  if (sizeLabelToggle) {
    let sizeLabelObserver = null;
    sizeLabelToggle.addEventListener('click', () => {
      const on = sizeLabelToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-size-label-style';
        s.textContent = `*[data-dev-size]:hover::after{content:attr(data-dev-size)!important;position:absolute!important;bottom:-22px!important;right:0!important;font-size:10px!important;font-family:monospace!important;color:#0f0!important;background:rgba(0,0,0,0.9)!important;padding:2px 6px!important;border-radius:3px!important;z-index:999999!important;pointer-events:none!important;white-space:nowrap!important}`;
        document.head.appendChild(s);
        const tagSizes = () => document.querySelectorAll('div,section,article,main,nav,aside,header,footer,img,picture,video,canvas,iframe').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 || r.height > 0) el.setAttribute('data-dev-size', `${Math.round(r.width)}×${Math.round(r.height)}`);
        });
        tagSizes();
        sizeLabelObserver = new MutationObserver(() => tagSizes());
        sizeLabelObserver.observe(document.body, { childList: true, subtree: true });
      } else {
        const s = document.getElementById('dev-size-label-style'); if (s) s.remove();
        if (sizeLabelObserver) { sizeLabelObserver.disconnect(); sizeLabelObserver = null; }
        document.querySelectorAll('[data-dev-size]').forEach(el => el.removeAttribute('data-dev-size'));
      }
    });
  }

  // FPS 角标 — 实时帧率显示
  const fpsBadgeToggle = el.querySelector('#dev-toggle-fps-badge');
  if (fpsBadgeToggle) {
    let fpsBadgeRaf = null, fpsBadgeLast = 0, fpsBadgeFrames = 0, fpsBadgeEl = null;
    fpsBadgeToggle.addEventListener('click', () => {
      const on = fpsBadgeToggle.classList.toggle('dev-toggle--on');
      if (on) {
        fpsBadgeEl = document.createElement('div'); fpsBadgeEl.id = 'dev-fps-badge';
        fpsBadgeEl.style.cssText = 'position:fixed;top:8px;left:8px;z-index:999999;font-family:monospace;font-size:12px;font-weight:700;color:#0f0;background:rgba(0,0,0,0.8);padding:3px 8px;border-radius:4px;pointer-events:none;';
        document.body.appendChild(fpsBadgeEl);
        const tick = (now) => {
          fpsBadgeFrames++;
          if (now - fpsBadgeLast >= 1000) {
            const fps = Math.round(fpsBadgeFrames * 1000 / (now - fpsBadgeLast));
            fpsBadgeEl.textContent = fps + ' FPS';
            fpsBadgeEl.style.color = fps < 30 ? '#f44' : fps < 60 ? '#fa0' : '#0f0';
            fpsBadgeFrames = 0; fpsBadgeLast = now;
          }
          fpsBadgeRaf = requestAnimationFrame(tick);
        };
        fpsBadgeLast = performance.now();
        fpsBadgeRaf = requestAnimationFrame(tick);
      } else {
        if (fpsBadgeRaf) { cancelAnimationFrame(fpsBadgeRaf); fpsBadgeRaf = null; }
        if (fpsBadgeEl) { fpsBadgeEl.remove(); fpsBadgeEl = null; }
      }
    });
  }

  // 图片浪费检测
  const imgWasteToggle = el.querySelector('#dev-toggle-img-waste');
  if (imgWasteToggle) {
    imgWasteToggle.addEventListener('click', () => {
      const on = imgWasteToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-img-waste-style';
        s.textContent = `img[data-dev-wasted]{outline:2px solid rgba(255,60,60,0.6)!important;outline-offset:2px!important;filter:sepia(0.3)!important}
img[data-dev-wasted]:hover::after{content:attr(data-dev-wasted)!important;position:absolute!important;top:0!important;left:0!important;font-size:10px!important;font-family:monospace!important;color:#f44!important;background:rgba(0,0,0,0.9)!important;padding:2px 6px!important;z-index:999999!important;pointer-events:none!important;white-space:nowrap!important}`;
        document.head.appendChild(s);
        document.querySelectorAll('img').forEach(img => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const rw = img.clientWidth || img.width || 0;
            const rh = img.clientHeight || img.height || 0;
            if (rw > 0 && (img.naturalWidth > rw * 2 || img.naturalHeight > rh * 2)) {
              img.setAttribute('data-dev-wasted', `浪费 ${img.naturalWidth}×${img.naturalHeight} → ${rw}×${rh}`);
            }
          }
        });
      } else {
        const s = document.getElementById('dev-img-waste-style'); if (s) s.remove();
        document.querySelectorAll('[data-dev-wasted]').forEach(el => el.removeAttribute('data-dev-wasted'));
      }
    });
  }

  // DOM 统计角标
  const domStatsToggle = el.querySelector('#dev-toggle-dom-stats');
  if (domStatsToggle) {
    let domStatsInterval = null, domStatsEl = null;
    domStatsToggle.addEventListener('click', () => {
      const on = domStatsToggle.classList.toggle('dev-toggle--on');
      if (on) {
        domStatsEl = document.createElement('div'); domStatsEl.id = 'dev-dom-stats';
        domStatsEl.style.cssText = 'position:fixed;top:30px;left:8px;z-index:999999;font-family:monospace;font-size:11px;color:#aaa;background:rgba(0,0,0,0.8);padding:2px 8px;border-radius:4px;pointer-events:none;';
        document.body.appendChild(domStatsEl);
        const update = () => {
          const nodes = document.querySelectorAll('*').length;
          const imgs = document.querySelectorAll('img').length;
          domStatsEl.textContent = `DOM: ${nodes} nodes | ${imgs} imgs`;
          domStatsEl.style.color = nodes > 3000 ? '#f44' : nodes > 1500 ? '#fa0' : '#aaa';
        };
        update();
        domStatsInterval = setInterval(update, 2000);
      } else {
        if (domStatsInterval) { clearInterval(domStatsInterval); domStatsInterval = null; }
        if (domStatsEl) { domStatsEl.remove(); domStatsEl = null; }
      }
    });
  }

  // 键盘日志
  const keyLogToggle = el.querySelector('#dev-toggle-key-log');
  if (keyLogToggle) {
    let keyLogHandler = null, keyLogEl = null, keyLogTimer = null;
    keyLogToggle.addEventListener('click', () => {
      const on = keyLogToggle.classList.toggle('dev-toggle--on');
      if (on) {
        keyLogEl = document.createElement('div'); keyLogEl.id = 'dev-key-log';
        keyLogEl.style.cssText = 'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:999999;font-family:monospace;font-size:11px;color:#0ff;background:rgba(0,0,0,0.85);padding:4px 14px;border-radius:6px;pointer-events:none;min-width:120px;text-align:center;';
        document.body.appendChild(keyLogEl);
        keyLogHandler = (e) => {
          keyLogEl.textContent = `${e.key}  code:${e.keyCode}  ${e.ctrlKey?'Ctrl+':''}${e.shiftKey?'Shift+':''}${e.altKey?'Alt+':''}`;
          clearTimeout(keyLogTimer);
          keyLogTimer = setTimeout(() => { keyLogEl.textContent = ''; }, 2000);
        };
        document.addEventListener('keydown', keyLogHandler);
      } else {
        if (keyLogHandler) { document.removeEventListener('keydown', keyLogHandler); keyLogHandler = null; }
        if (keyLogEl) { keyLogEl.remove(); keyLogEl = null; }
        clearTimeout(keyLogTimer);
      }
    });
  }

  // 点击波纹
  const clickRippleToggle = el.querySelector('#dev-toggle-click-ripple');
  if (clickRippleToggle) {
    let clickRippleHandler = null;
    clickRippleToggle.addEventListener('click', () => {
      const on = clickRippleToggle.classList.toggle('dev-toggle--on');
      if (on) {
        clickRippleHandler = (e) => {
          const ripple = document.createElement('div');
          ripple.style.cssText = `position:fixed;left:${e.clientX - 15}px;top:${e.clientY - 15}px;width:30px;height:30px;border-radius:50%;border:2px solid rgba(0,200,255,0.8);z-index:999999;pointer-events:none;animation:devRipple 0.6s ease-out forwards;`;
          document.body.appendChild(ripple);
          const s = document.getElementById('dev-ripple-keyframes') || (() => { const st = document.createElement('style'); st.id = 'dev-ripple-keyframes'; st.textContent = '@keyframes devRipple{0%{transform:scale(0.3);opacity:1}100%{transform:scale(3);opacity:0}}'; document.head.appendChild(st); return st; })();
          ripple.addEventListener('animationend', () => ripple.remove());
        };
        document.addEventListener('click', clickRippleHandler);
      } else {
        if (clickRippleHandler) { document.removeEventListener('click', clickRippleHandler); clickRippleHandler = null; }
        document.querySelectorAll('[style*="devRipple"]').forEach(el => el.remove()); // cleanup ripples
      }
    });
  }

  // 焦点追踪 — 始终高亮 focus 元素
  const focusTrackToggle = el.querySelector('#dev-toggle-focus-track');
  if (focusTrackToggle) {
    focusTrackToggle.addEventListener('click', () => {
      const on = focusTrackToggle.classList.toggle('dev-toggle--on');
      if (on) {
        const s = document.createElement('style'); s.id = 'dev-focus-track-style';
        s.textContent = `*:focus{outline:3px solid rgba(0,150,255,0.8)!important;outline-offset:3px!important;box-shadow:0 0 16px rgba(0,150,255,0.4)!important}`;
        document.head.appendChild(s);
      } else {
        const s = document.getElementById('dev-focus-track-style'); if (s) s.remove();
      }
    });
  }

  // 毛玻璃颜色（rgba 颜色 + alpha 滑块联动）

  // 初始化内联取色器（替换原生 <input type="color">）
  initColorPickers(el);


  // --gap-scale：注入 style 覆盖 .portfolio 和 .categories 间距
  const gapScaleSlider = el.querySelector('.dev-slider[data-css="--gap-scale"]');
  if (gapScaleSlider) {
    gapScaleSlider.addEventListener('input', () => {
      const val = parseFloat(gapScaleSlider.value);
      document.documentElement.style.setProperty('--gap-scale', String(val));
      let s = document.getElementById('dev-gap-style');
      if (s) s.remove();
      s = document.createElement('style'); s.id = 'dev-gap-style';
      s.textContent = `.portfolio { padding: calc(8rem * ${val}) calc(3rem * ${val}) calc(6rem * ${val}); } .categories { gap: calc(16px * ${val}); }`;
      document.head.appendChild(s);
    });
  }

  // --shadow-depth：注入 style 覆盖全局 box-shadow
  const shadowDepthSlider = el.querySelector('.dev-slider[data-css="--shadow-depth"]');
  if (shadowDepthSlider) {
    shadowDepthSlider.addEventListener('input', () => {
      const val = parseFloat(shadowDepthSlider.value);
      document.documentElement.style.setProperty('--shadow-depth', String(val));
      let s = document.getElementById('dev-shadow-style');
      if (s) s.remove();
      s = document.createElement('style'); s.id = 'dev-shadow-style';
      s.textContent = `.toolbar,.dev-panel,.sidebar,.settings-panel,.category-card,.back-to-top,.shortcuts-panel{box-shadow:0 calc(4px*${val}) calc(24px*${val}) rgba(0,0,0,calc(0.3*${val}))!important}`;
      document.head.appendChild(s);
    });
  }

  // --font-scale-heading：注入 style 覆盖标题字号
  const fsHeadingSlider = el.querySelector('.dev-slider[data-css="--font-scale-heading"]');
  if (fsHeadingSlider) {
    fsHeadingSlider.addEventListener('input', () => {
      const val = parseFloat(fsHeadingSlider.value);
      document.documentElement.style.setProperty('--font-scale-heading', String(val));
      let s = document.getElementById('dev-heading-style');
      if (s) s.remove();
      s = document.createElement('style'); s.id = 'dev-heading-style';
      s.textContent = `.portfolio__title{font-size:calc(clamp(1.8rem,4.5vw,3.2rem)*${val})}.portfolio__desc{font-size:calc(0.85rem*${val})}.category-card__name{font-size:calc(0.85rem*${val})}`;
      document.head.appendChild(s);
    });
  }

  // 文本输入（字体、缓动曲线）
  el.querySelectorAll('.dev-input--text').forEach(input => {
    input.addEventListener('input', () => {
      document.documentElement.style.setProperty(input.dataset.cssText, input.value);
      autoSaveSession();
      scheduleApplyEffects();
    });
  });

  // ═══════════════════════════════════════════════════
  // 液态玻璃控件
  // ═══════════════════════════════════════════════════

  // 全局委托：任何控件变动自动保存 + 更新直接样式
  el.addEventListener('input', (e) => {
    if (e.target.closest('.dev-slider, .dev-input--text')) {
      autoSaveSession();
      scheduleApplyEffects();
    }
  });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-font-preset]')) {
      const btn = e.target.closest('[data-font-preset]');
      const key = btn.dataset.fontPreset;
      const presetId = btn.dataset.presetId;
      const container = btn.closest('.dev-row');
      const customInput = container?.querySelector('[data-css-text]');

      if (presetId === '_custom_') {
        // Show custom input
        if (customInput) customInput.style.display = '';
        customInput?.focus();
      } else {
        // Find preset value
        const category = key.replace('--font-', '');
        const presets = FONT_FAMILY_PRESETS[category] || [];
        const preset = presets.find(p => p[0] === presetId);
        if (preset) {
          document.documentElement.style.setProperty(key, preset[2]);
          if (customInput) { customInput.value = preset[2]; customInput.style.display = 'none'; }
          autoSaveSession();
          scheduleApplyEffects();
        }
      }
      // Update active button state
      container?.querySelectorAll('[data-font-preset]').forEach(b => b.classList.remove('dev-btn--active'));
      btn.classList.add('dev-btn--active');
    }
    if (e.target.closest('[data-css-btn]')) {
      const btn = e.target.closest('[data-css-btn]');
      const key = btn.dataset.cssBtn;
      const val = btn.dataset.value;
      document.documentElement.style.setProperty(key, val);
      btn.parentElement.querySelectorAll('[data-css-btn]').forEach(b => b.classList.remove('dev-btn--active'));
      btn.classList.add('dev-btn--active');
      autoSaveSession();
      scheduleApplyEffects();
    }
    // 启动动画选择
    if (e.target.closest('[data-anim]')) {
      const btn = e.target.closest('[data-anim]');
      setAnimationType(btn.dataset.anim);
      el.querySelectorAll('.dev-anim-card').forEach(c => c.classList.remove('dev-anim-card--active'));
      btn.classList.add('dev-anim-card--active');
      updateAnimPreview(el);
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.closest('.dev-color-trigger')) { autoSaveSession(); scheduleApplyEffects(); }
  });

  // 内联取色器颜色变更 → 保存 + 刷新
  window.addEventListener('lens-color-change', () => {
    autoSaveSession();
    scheduleApplyEffects();
  });

  // 初始渲染着色器预览
  updateAnimPreview(el);

}

// ═══════════════════════════════════════════
// Group 2: 性能 — FPS / Memory / Console
// ═══════════════════════════════════════════

function renderPerfGroup() {
  const el = document.getElementById('dev-group-perf');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  el.innerHTML = `
    <div class="dev-section dev-section--compact">
      <div class="dev-section__title">监控开关</div>
      <div class="dev-row" style="gap:8px;flex-wrap:wrap">
        <button class="dev-chip-toggle dev-chip-toggle--on" data-perf="fps">FPS 图表</button>
        <button class="dev-chip-toggle dev-chip-toggle--on" data-perf="metrics">内存/DOM</button>
        <button class="dev-chip-toggle dev-chip-toggle--on" data-perf="invoke">Tauri 调用</button>
        <button class="dev-chip-toggle dev-chip-toggle--on" data-perf="console">控制台</button>
      </div>
    </div>
    <div class="dev-perf-section" data-perf-section="fps">
      <div class="dev-section">
        <div class="dev-section__title">帧率</div>
        <div class="dev-fps-chart" id="dev-fps-chart"></div>
        <div class="dev-row" style="margin-top:4px">
          <span class="dev-row__label">FPS</span>
          <span class="dev-row__value" id="dev-fps-val">--</span>
        </div>
      </div>
    </div>
    <div class="dev-perf-section" data-perf-section="metrics">
      <div class="dev-section">
        <div class="dev-section__title">内存</div>
        <div class="dev-stat"><span class="dev-stat__label">已用堆</span><span class="dev-stat__value" id="dev-mem-used">--</span></div>
        <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">总堆</span><span class="dev-stat__value" id="dev-mem-total">--</span></div>
      </div>
      <div class="dev-section">
        <div class="dev-section__title">DOM</div>
        <div class="dev-stat"><span class="dev-stat__label">总节点</span><span class="dev-stat__value" id="dev-dom-nodes">--</span></div>
        <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">图片</span><span class="dev-stat__value" id="dev-dom-imgs">--</span></div>
        <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">加载时间</span><span class="dev-stat__value" id="dev-load-time">--</span></div>
      </div>
      <div class="dev-section">
        <div class="dev-section__title">存储</div>
        <div class="dev-stat"><span class="dev-stat__label">localStorage</span><span class="dev-stat__value" id="dev-storage-size">--</span></div>
      </div>
    </div>
    <div class="dev-perf-section" data-perf-section="invoke">
      <div class="dev-section">
        <div class="dev-section__title">Tauri 命令</div>
        <div class="dev-console" id="dev-invoke-log" style="height:120px"></div>
      </div>
    </div>
    <div class="dev-perf-section" data-perf-section="console">
      <div class="dev-section">
        <div class="dev-section__title">控制台</div>
        <div class="dev-row" style="margin-bottom:4px">
          <span class="dev-row__label">日志捕获</span>
          <button class="dev-btn" id="dev-console-clear" style="font-size:0.65rem">清除</button>
        </div>
        <div class="dev-console" id="dev-console"></div>
      </div>
    </div>
  `;

  // 控制台清除按钮
  document.getElementById('dev-console-clear')?.addEventListener('click', () => {
    D.consoleBuffer.length = 0;
    const consoleEl = document.getElementById('dev-console');
    if (consoleEl) consoleEl.innerHTML = '';
  });

  // 监控开关 chip-toggle 绑定
  el.querySelectorAll('.dev-chip-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('dev-chip-toggle--on');
      D.perfToggles[btn.dataset.perf] = btn.classList.contains('dev-chip-toggle--on');
      applyPerfToggles();
    });
  });
}

function applyPerfToggles() {
  const t = D.perfToggles;
  if (!t.fps && D.fpsRaf) { cancelAnimationFrame(D.fpsRaf); D.fpsRaf = null; }
  if (t.fps && !D.fpsRaf && D.open) startFPSMeter();
  if (!t.metrics && D.perfInterval) { clearInterval(D.perfInterval); D.perfInterval = null; }
  if (t.metrics && !D.perfInterval && D.open) startPerfMonitor();
  if (!t.console && D.consoleOrig.log) stopConsoleCapture();
  if (t.console && !D.consoleOrig.log && D.open) startConsoleCapture();
  // 折叠动画
  ['fps','metrics','invoke','console'].forEach(key => {
    const el = document.querySelector(`.dev-perf-section[data-perf-section="${key}"]`);
    if (el) el.classList.toggle('dev-perf-section--folded', !t[key]);
  });
}

function startFPSMeter() {
  if (D.fpsRaf) return;
  D.fpsHistory = [];
  D.fpsLastTime = performance.now();
  let frameCount = 0;

  function tick(now) {
    frameCount++;
    if (now - D.fpsLastTime >= 500) {
      const fps = Math.round(frameCount / ((now - D.fpsLastTime) / 1000));
      D.fpsHistory.push(fps);
      if (D.fpsHistory.length > FPS_MAX) D.fpsHistory.shift();
      frameCount = 0;
      D.fpsLastTime = now;
      updateFPSUI(fps);
    }
    D.fpsRaf = requestAnimationFrame(tick);
  }
  D.fpsRaf = requestAnimationFrame(tick);
}

function updateFPSUI(fps) {
  const valEl = document.getElementById('dev-fps-val');
  const chart = document.getElementById('dev-fps-chart');
  if (valEl) {
    valEl.textContent = fps;
    valEl.style.color = fps >= 55 ? 'var(--accent)' : fps >= 30 ? '#e8c870' : '#e87070';
  }
  if (chart && D.fpsHistory.length > 0) {
    const maxFps = Math.max(60, ...D.fpsHistory);
    chart.innerHTML = D.fpsHistory.map(v => {
      const h = Math.max(2, (v / maxFps) * 100);
      const c = v >= 55 ? 'var(--accent)' : v >= 30 ? '#e8c870' : '#e87070';
      return `<div class="dev-fps-bar" style="height:${h}%;background:${c}"></div>`;
    }).join('');
  }
}

function startPerfMonitor() {
  if (D.perfInterval) return;
  function update() {
    if (!D.open) return;
    const memUsed = document.getElementById('dev-mem-used');
    const memTotal = document.getElementById('dev-mem-total');
    const domNodes = document.getElementById('dev-dom-nodes');
    const domImgs = document.getElementById('dev-dom-imgs');
    const loadTime = document.getElementById('dev-load-time');

    if (performance.memory) {
      if (memUsed) memUsed.textContent = (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB';
      if (memTotal) memTotal.textContent = (performance.memory.totalJSHeapSize / 1048576).toFixed(1) + ' MB';
    } else {
      if (memUsed) memUsed.textContent = 'N/A';
      if (memTotal) memTotal.textContent = 'N/A';
    }
    if (domNodes) domNodes.textContent = document.getElementsByTagName('*').length;
    if (domImgs) domImgs.textContent = document.querySelectorAll('img').length;
    const storageEl = document.getElementById('dev-storage-size');
    if (storageEl) {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        total += k.length + (localStorage.getItem(k) || '').length;
      }
      storageEl.textContent = (total / 1024).toFixed(1) + ' KB';
    }
    if (loadTime) {
      const [nav] = performance.getEntriesByType('navigation');
      if (nav && nav.loadEventEnd) {
        loadTime.textContent = ((nav.loadEventEnd - nav.fetchStart) / 1000).toFixed(2) + 's';
      } else {
        loadTime.textContent = (performance.now() / 1000).toFixed(1) + 's (uptime)';
      }
    }
  }
  update();
  D.perfInterval = setInterval(() => { update(); if (D.perfToggles.invoke) updateInvokeLogUI(); }, 1000);
}

function startConsoleCapture() {
  if (D.consoleOrig.log) return; // already captured
  const methods = ['log', 'warn', 'error', 'debug'];
  methods.forEach(m => {
    D.consoleOrig[m] = console[m];
    console[m] = (...args) => {
      D.consoleOrig[m](...args);
      D.consoleBuffer.push({ type: m, text: args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a); }
        catch { return String(a); }
      }).join(' '), time: Date.now() });
      if (D.consoleBuffer.length > CONSOLE_MAX) D.consoleBuffer.shift();
    };
  });
  // 每 500ms 刷新 UI
  if (!D._consoleRefreshInterval) {
    D._consoleRefreshInterval = setInterval(updateConsoleUI, 500);
  }
}

function stopConsoleCapture() {
  if (!D.consoleOrig.log) return;
  ['log', 'warn', 'error', 'debug'].forEach(m => {
    console[m] = D.consoleOrig[m];
    D.consoleOrig[m] = null;
  });
  if (D._consoleRefreshInterval) {
    clearInterval(D._consoleRefreshInterval);
    D._consoleRefreshInterval = null;
  }
}

function hasSelectionIn(el) {
  const sel = window.getSelection();
  return sel && sel.rangeCount > 0 && el.contains(sel.anchorNode);
}

function updateConsoleUI() {
  const el = document.getElementById('dev-console');
  if (!el || hasSelectionIn(el)) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  el.innerHTML = D.consoleBuffer.map(l =>
    `<div class="dev-console__line dev-console__line--${l.type}">[${new Date(l.time).toLocaleTimeString()}] ${l.text}</div>`
  ).join('');
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

function updateInvokeLogUI() {
  const el = document.getElementById('dev-invoke-log');
  if (!el || hasSelectionIn(el)) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  el.innerHTML = D.invokeLog.map(l => {
    const cls = l.ok ? 'dev-console__line--info' : 'dev-console__line--error';
    const status = l.ok ? `${l.ms}ms` : 'FAIL';
    return `<div class="dev-console__line ${cls}">[${new Date(l.time).toLocaleTimeString()}] ${l.cmd} — ${status}</div>`;
  }).join('');
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

// ═══════════════════════════════════════════
// Group 3: 手柄 — 状态可视化
// ═══════════════════════════════════════════

const GP_BTN_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', '↑', '↓', '←', '→'];

function renderGamepadGroup() {
  const el = document.getElementById('dev-group-gamepad');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  el.innerHTML = `
    <div class="dev-section">
      <div class="dev-section__title">连接</div>
      <div class="dev-stat"><span class="dev-stat__label" id="dev-gp-connected">未连接</span></div>
      <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">ID</span><span class="dev-stat__value" id="dev-gp-id">--</span></div>
      <div class="dev-stat" style="margin-top:4px"><span class="dev-stat__label">控制器</span><span class="dev-stat__value" id="dev-gp-layout">--</span></div>
    </details>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">状态机</div>
      <div class="dev-state-row"><span class="dev-state-row__label">模式</span><span class="dev-state-row__value" id="dev-st-mode">--</span></div>
      <div class="dev-state-row"><span class="dev-state-row__label">区域</span><span class="dev-state-row__value" id="dev-st-zone">--</span></div>
      <div class="dev-state-row"><span class="dev-state-row__label">输入</span><span class="dev-state-row__value" id="dev-st-input">--</span></div>
      <div class="dev-state-row"><span class="dev-state-row__label">焦点</span><span class="dev-state-row__value" id="dev-st-focus">--</span></div>
      <div class="dev-state-row"><span class="dev-state-row__label">元素</span><span class="dev-state-row__value" id="dev-st-els">--</span></div>
      <div class="dev-state-row"><span class="dev-state-row__label">冷却</span><span class="dev-state-row__value" id="dev-st-cooldown">--</span></div>
    </details>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">按钮</div>
      <div class="dev-row dev-row--col" data-gp-zone="buttons">
        <div class="dev-gp-grid" id="dev-gp-btn-grid"></div>
      </div>
    </details>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">摇杆 & 扳机</div>
      <div class="dev-row dev-row--col" data-gp-zone="sticks" style="gap:12px">
        <div style="display:flex;gap:24px;justify-content:center">
          <div>
            <div class="dev-stick" id="dev-stick-l"><div class="dev-stick__deadzone"></div><div class="dev-stick__cross-h"></div><div class="dev-stick__cross-v"></div><div class="dev-stick__dot" style="left:50%;top:50%"></div></div>
            <div class="dev-stick__label">左摇杆</div>
            <div class="dev-axis-label" id="dev-axis-l">X: 0.00  Y: 0.00</div>
          </div>
          <div>
            <div class="dev-stick" id="dev-stick-r"><div class="dev-stick__deadzone"></div><div class="dev-stick__cross-h"></div><div class="dev-stick__cross-v"></div><div class="dev-stick__dot" style="left:50%;top:50%"></div></div>
            <div class="dev-stick__label">右摇杆</div>
            <div class="dev-axis-label" id="dev-axis-r">X: 0.00  Y: 0.00</div>
          </div>
        </div>
        <div style="display:flex;gap:20px">
          <div style="flex:2"><div class="dev-row__label" style="margin-bottom:4px">LT</div><div class="dev-trigger"><div class="dev-trigger__fill" id="dev-trigger-lt" style="width:0%"></div></div></div>
          <div style="flex:2"><div class="dev-row__label" style="margin-bottom:4px">RT</div><div class="dev-trigger"><div class="dev-trigger__fill" id="dev-trigger-rt" style="width:0%"></div></div></div>
        </div>
      </div>
    </details>
    </div>
    <div class="dev-section">
      <div class="dev-section__title">事件日志</div>
      <div class="dev-console" id="dev-gp-log" style="height:100px"></div>
    </div>
  `;

  // 初始化按钮网格（动态显示所有按钮）
  const grid = el.querySelector('#dev-gp-btn-grid');
  if (grid) {
    const gps = navigator.getGamepads();
    const gp = Array.from(gps).find(g => g);
    const count = gp ? gp.buttons.length : 16;
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(GP_BTN_NAMES[i] || `B${i}`);
    }
    grid.innerHTML = names.map((n, i) => `<div class="dev-gp-btn" data-btn="${n}" data-idx="${i}">${n}</div>`).join('');
  }
}

// 手柄悬浮窗实时更新
let _gpFloatRaf = null;
function startGpFloatPoll(zone) {
  if (_gpFloatRaf) cancelAnimationFrame(_gpFloatRaf);
  function tick() {
    const float = document.getElementById('dev-gp-float');
    if (!float?.classList.contains('dev-gp-float--open')) { _gpFloatRaf = null; return; }
    const gp = navigator.getGamepads()[0];
    if (!gp) { _gpFloatRaf = requestAnimationFrame(tick); return; }
    if (zone === 'buttons') {
      float.querySelectorAll('.dev-gp-btn').forEach(el => {
        const idx = parseInt(el.dataset.idx);
        el.classList.toggle('dev-gp-btn--on', !isNaN(idx) && idx < gp.buttons.length && gp.buttons[idx].pressed);
      });
    } else if (zone === 'sticks') {
      const dotL = float.querySelector('#dev-stick-l .dev-stick__dot');
      const dotR = float.querySelector('#dev-stick-r .dev-stick__dot');
      if (dotL) { dotL.style.left = (50 + gp.axes[0] * 50) + '%'; dotL.style.top = (50 + gp.axes[1] * 50) + '%'; }
      if (dotR) { dotR.style.left = (50 + gp.axes[2] * 50) + '%'; dotR.style.top = (50 + gp.axes[3] * 50) + '%'; }
      const lt = float.querySelector('#dev-trigger-lt');
      const rt = float.querySelector('#dev-trigger-rt');
      if (lt) lt.style.width = Math.round((gp.buttons[6]?.value || 0) * 100) + '%';
      if (rt) rt.style.width = Math.round((gp.buttons[7]?.value || 0) * 100) + '%';
      const axL = float.querySelector('#dev-axis-l');
      const axR = float.querySelector('#dev-axis-r');
      if (axL) axL.textContent = `X: ${(gp.axes[0] || 0).toFixed(2)}  Y: ${(gp.axes[1] || 0).toFixed(2)}`;
      if (axR) axR.textContent = `X: ${(gp.axes[2] || 0).toFixed(2)}  Y: ${(gp.axes[3] || 0).toFixed(2)}`;
    }
    _gpFloatRaf = requestAnimationFrame(tick);
  }
  _gpFloatRaf = requestAnimationFrame(tick);
}

function startGamepadVizPoll() {
  if (D.gamepadPollRaf) return;
  function poll() {
    if (!D.open || D.activeGroup !== 'gamepad') {
      D.gamepadPollRaf = null;
      return;
    }
    const gps = navigator.getGamepads();
    const gp = gps[0]; // 只用第一个
    const connEl = document.getElementById('dev-gp-connected');
    const idEl = document.getElementById('dev-gp-id');

    // 状态机视图（从 gamepad.js 暴露的状态快照读取）
    const st = window.__lensGamepadState;
    if (st) {
      const modeEl = document.getElementById('dev-st-mode');
      const zoneEl = document.getElementById('dev-st-zone');
      const inputEl = document.getElementById('dev-st-input');
      const focusEl = document.getElementById('dev-st-focus');
      const elsEl = document.getElementById('dev-st-els');
      const cdEl = document.getElementById('dev-st-cooldown');
      if (modeEl) modeEl.textContent = st.mode || '--';
      if (zoneEl) zoneEl.textContent = st.zone || '--';
      if (inputEl) { inputEl.textContent = st.input || '--'; inputEl.style.color = st.input === 'gamepad' ? 'var(--accent)' : 'var(--text-3)'; }
      if (focusEl) {
        const idx = st.mode === 'dev' ? st.devIdx : st.mode === 'settings' ? st.settingsIdx : st.gridIdx;
        focusEl.textContent = `idx=${idx}`;
      }
      if (elsEl) {
        const count = st.mode === 'dev' ? st.devEls : st.mode === 'settings' ? st.settingsEls : st.gridEls;
        elsEl.textContent = `${Array.isArray(count) ? count.length : 0} 个`;
      }
      if (cdEl) {
        const remaining = Math.max(0, (st.cooldownUntil || 0) - performance.now());
        cdEl.textContent = remaining > 0 ? Math.ceil(remaining) + 'ms' : '无';
      }
    }

    if (gp) {
      if (connEl) { connEl.textContent = '已连接'; connEl.style.color = 'var(--accent)'; }
      if (idEl) idEl.textContent = gp.id;

      // 控制器类型
      const layoutEl = document.getElementById('dev-gp-layout');
      if (layoutEl) {
        const gid = gp.id.toLowerCase();
        if (gid.includes('xbox') || gid.includes('xinput')) layoutEl.textContent = 'Xbox';
        else if (gid.includes('ps4') || gid.includes('ps5') || gid.includes('playstation')) layoutEl.textContent = 'PlayStation';
        else if (gid.includes('switch') || gid.includes('nintendo')) layoutEl.textContent = 'Switch';
        else layoutEl.textContent = gp.id.slice(0, 30);
      }

      // 按钮网格
      const grid = document.getElementById('dev-gp-btn-grid');
      if (grid) {
        grid.querySelectorAll('.dev-gp-btn').forEach(el => {
          const idx = parseInt(el.dataset.idx);
          const pressed = !isNaN(idx) && idx < gp.buttons.length && gp.buttons[idx].pressed;
          el.classList.toggle('dev-gp-btn--on', pressed);
        });
      }

      // 摇杆
      updateStick('dev-stick-l', gp.axes[0], gp.axes[1]);
      updateStick('dev-stick-r', gp.axes[2], gp.axes[3]);

      // 轴值
      const axisL = document.getElementById('dev-axis-l');
      const axisR = document.getElementById('dev-axis-r');
      if (axisL) axisL.textContent = `X: ${(gp.axes[0] || 0).toFixed(2)}  Y: ${(gp.axes[1] || 0).toFixed(2)}`;
      if (axisR) axisR.textContent = `X: ${(gp.axes[2] || 0).toFixed(2)}  Y: ${(gp.axes[3] || 0).toFixed(2)}`;

      // 扳机
      const ltEl = document.getElementById('dev-trigger-lt');
      const rtEl = document.getElementById('dev-trigger-rt');
      if (ltEl) ltEl.style.width = Math.round((gp.buttons[6] ? gp.buttons[6].value : 0) * 100) + '%';
      if (rtEl) rtEl.style.width = Math.round((gp.buttons[7] ? gp.buttons[7].value : 0) * 100) + '%';

      // 事件日志：检查按钮变化
      gp.buttons.forEach((b, i) => {
        const prev = D._gpPrevBtns && D._gpPrevBtns[i];
        if (prev !== undefined && prev !== b.pressed) {
          const name = GP_BTN_NAMES[i] || `Btn${i}`;
          D.gpEventLog.push({ text: `${name} ${b.pressed ? '↓' : '↑'}`, time: Date.now() });
          if (D.gpEventLog.length > GP_EVENT_MAX) D.gpEventLog.shift();
          updateGPLog();
        }
      });
      D._gpPrevBtns = gp.buttons.map(b => b.pressed);
    } else {
      if (connEl) { connEl.textContent = '未连接'; connEl.style.color = 'var(--text-3)'; }
      if (idEl) idEl.textContent = '--';
      D._gpPrevBtns = null;
    }

    D.gamepadPollRaf = requestAnimationFrame(poll);
  }
  D.gamepadPollRaf = requestAnimationFrame(poll);
}

function updateStick(id, x, y) {
  const stick = document.getElementById(id);
  if (!stick) return;
  const dot = stick.querySelector('.dev-stick__dot');
  if (!dot) return;
  dot.style.left = (50 + (x || 0) * 50) + '%';
  dot.style.top = (50 + (y || 0) * 50) + '%';
}

function updateGPLog() {
  const el = document.getElementById('dev-gp-log');
  if (!el || hasSelectionIn(el)) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  el.innerHTML = D.gpEventLog.map(l =>
    `<div class="dev-console__line dev-console__line--info">[${new Date(l.time).toLocaleTimeString()}] ${l.text}</div>`
  ).join('');
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

// ── 手柄提示面板 ──
// ── 手柄图标：原始 SVG 内联，currentColor 自动跟随预设 ──
const GP_SVG = {
  'a': '<svg class="dev-hints__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"> <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2"/> <text x="12" y="16.5" text-anchor="middle" font-family="\'Segoe UI\',Arial,sans-serif" font-size="12" font-weight="700" fill="currentColor">A</text> </svg>',
  'b': '<svg class="dev-hints__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"> <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2"/> <text x="12" y="16.5" text-anchor="middle" font-family="\'Segoe UI\',Arial,sans-serif" font-size="12" font-weight="700" fill="currentColor">B</text> </svg>',
  'back': '<svg class="dev-hints__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"> <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2"/> <rect x="6" y="7" width="6" height="5" rx="0.5" fill="currentColor"/> <rect x="10" y="10" width="6" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/> </svg>',
  'dpad-down': '<svg class="dev-hints__icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="12" y="28" width="8" height="8" rx="0.5" transform="rotate(-90 12 28)" fill="currentColor"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M11 19.2C11 19.0895 10.9105 19 10.8 19L5.2 19C5.08954 19 5 18.9105 5 18.8L5 13.2C5 13.0895 5.08954 13 5.2 13L11.5 13C12.3284 13 13 12.3284 13 11.5L13 5.2C13 5.08954 13.0895 5 13.2 5L18.8 5C18.9105 5 19 5.08954 19 5.2L19 11.5C19 12.3284 19.6716 13 20.5 13L26.8 13C26.9105 13 27 13.0895 27 13.2L27 18.8C27 18.9105 26.9105 19 26.8 19L21.2 19C21.0895 19 21 19.0895 21 19.2L21 19.8C21 19.9105 21.0895 20 21.2 20L27.5 20C27.7761 20 28 19.7761 28 19.5L28 12.5C28 12.2239 27.7761 12 27.5 12L20.5 12C20.2239 12 20 11.7761 20 11.5L20 4.5C20 4.22386 19.7761 4 19.5 4L12.5 4C12.2239 4 12 4.22386 12 4.5L12 11.5C12 11.7761 11.7761 12 11.5 12L4.5 12C4.22386 12 4 12.2239 4 12.5L4 19.5C4 19.7761 4.22386 20 4.5 20L10.8 20C10.9105 20 11 19.9105 11 19.8L11 19.2Z" fill="currentColor"/> </svg>',
  'dpad-left': '<svg class="dev-hints__icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="4" y="12" width="8" height="8" rx="0.5" fill="currentColor"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M12.8 11C12.9105 11 13 10.9105 13 10.8V5.2C13 5.08954 13.0895 5 13.2 5H18.8C18.9105 5 19 5.08954 19 5.2V11.5C19 12.3284 19.6716 13 20.5 13H26.8C26.9105 13 27 13.0895 27 13.2V18.8C27 18.9105 26.9105 19 26.8 19H20.5C19.6716 19 19 19.6716 19 20.5V26.8C19 26.9105 18.9105 27 18.8 27H13.2C13.0895 27 13 26.9105 13 26.8V21.2C13 21.0895 12.9105 21 12.8 21H12.2C12.0895 21 12 21.0895 12 21.2V27.5C12 27.7761 12.2239 28 12.5 28H19.5C19.7761 28 20 27.7761 20 27.5V20.5C20 20.2239 20.2239 20 20.5 20H27.5C27.7761 20 28 19.7761 28 19.5V12.5C28 12.2239 27.7761 12 27.5 12H20.5C20.2239 12 20 11.7761 20 11.5V4.5C20 4.22386 19.7761 4 19.5 4H12.5C12.2239 4 12 4.22386 12 4.5V10.8C12 10.9105 12.0895 11 12.2 11H12.8Z" fill="currentColor"/> </svg>',
  'dpad-right': '<svg class="dev-hints__icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect width="8" height="8" rx="0.5" transform="matrix(-1 0 0 1 28 12)" fill="currentColor"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M19.2 11C19.0895 11 19 10.9105 19 10.8V5.2C19 5.08954 18.9105 5 18.8 5H13.2C13.0895 5 13 5.08954 13 5.2V11.5C13 12.3284 12.3284 13 11.5 13H5.2C5.08954 13 5 13.0895 5 13.2V18.8C5 18.9105 5.08954 19 5.2 19H11.5C12.3284 19 13 19.6716 13 20.5V26.8C13 26.9105 13.0895 27 13.2 27H18.8C18.9105 27 19 26.9105 19 26.8V21.2C19 21.0895 19.0895 21 19.2 21H19.8C19.9105 21 20 21.0895 20 21.2V27.5C20 27.7761 19.7761 28 19.5 28H12.5C12.2239 28 12 27.7761 12 27.5V20.5C12 20.2239 11.7761 20 11.5 20H4.5C4.22386 20 4 19.7761 4 19.5V12.5C4 12.2239 4.22386 12 4.5 12H11.5C11.7761 12 12 11.7761 12 11.5V4.5C12 4.22386 12.2239 4 12.5 4H19.5C19.7761 4 20 4.22386 20 4.5V10.8C20 10.9105 19.9105 11 19.8 11H19.2Z" fill="currentColor"/> </svg>',
  'dpad-up': '<svg class="dev-hints__icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect width="8" height="8" rx="0.5" transform="matrix(4.37114e-08 1 1 -4.37114e-08 12 4)" fill="currentColor"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M11 12.8C11 12.9105 10.9105 13 10.8 13L5.2 13C5.08954 13 5 13.0895 5 13.2L5 18.8C5 18.9105 5.08954 19 5.2 19L11.5 19C12.3284 19 13 19.6716 13 20.5L13 26.8C13 26.9105 13.0895 27 13.2 27L18.8 27C18.9105 27 19 26.9105 19 26.8L19 20.5C19 19.6716 19.6716 19 20.5 19L26.8 19C26.9105 19 27 18.9105 27 18.8L27 13.2C27 13.0895 26.9105 13 26.8 13L21.2 13C21.0895 13 21 12.9105 21 12.8L21 12.2C21 12.0895 21.0895 12 21.2 12L27.5 12C27.7761 12 28 12.2239 28 12.5L28 19.5C28 19.7761 27.7761 20 27.5 20L20.5 20C20.2239 20 20 20.2239 20 20.5L20 27.5C20 27.7761 19.7761 28 19.5 28L12.5 28C12.2239 28 12 27.7761 12 27.5L12 20.5C12 20.2239 11.7761 20 11.5 20L4.5 20C4.22386 20 4 19.7761 4 19.5L4 12.5C4 12.2239 4.22386 12 4.5 12L10.8 12C10.9105 12 11 12.0895 11 12.2L11 12.8Z" fill="currentColor"/> </svg>',
  'lb': '<svg class="dev-hints__icon" viewBox="0 0 39 22" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M0.560165 9.22469L0.111878 19.4485C0.0508985 20.8392 1.16193 22 2.55398 22H33.3939C34.5346 22 35.5236 21.2111 35.7772 20.099L38.6453 7.51976C38.8609 6.57455 38.4974 5.59129 37.7189 5.01349L31.666 0.52086C31.2825 0.236228 30.8212 0.0684723 30.344 0.0481076C16.6251 -0.53743 5.98773 4.35606 1.51272 7.4406C0.925611 7.84528 0.591401 8.51231 0.560165 9.22469Z" fill="currentColor"/> <mask id="path-2-outside-1_2_166" maskUnits="userSpaceOnUse" x="13.7138" y="5" fill="black"> <rect fill="white" x="13.7138" y="5"/> <path d="M21.164 18H14.0751V6.09668H16.7562V15.8252H21.164V18ZM22.7743 18V6.09668H27.1073C28.4354 6.09668 29.4564 6.34017 30.1703 6.82715C30.8842 7.31413 31.2411 8.00033 31.2411 8.88574C31.2411 9.52767 31.0225 10.0894 30.5853 10.5708C30.1537 11.0522 29.6003 11.387 28.9252 11.5752V11.6084C29.7719 11.7135 30.447 12.0262 30.9506 12.5464C31.4597 13.0666 31.7142 13.7002 31.7142 14.4473C31.7142 15.5374 31.3241 16.4035 30.5438 17.0454C29.7636 17.6818 28.6983 18 27.348 18H22.7743ZM25.4555 8.07227V10.8945H26.6342C27.1876 10.8945 27.622 10.7617 27.9374 10.4961C28.2584 10.2249 28.4188 9.85417 28.4188 9.38379C28.4188 8.50944 27.7658 8.07227 26.4599 8.07227H25.4555ZM25.4555 12.8867V16.0244H26.9081C27.5279 16.0244 28.0121 15.8805 28.3607 15.5928C28.7149 15.305 28.892 14.9121 28.892 14.4141C28.892 13.9382 28.7177 13.5646 28.369 13.2935C28.0259 13.0223 27.5445 12.8867 26.9247 12.8867H25.4555Z"/> </mask> <path d="M21.164 18H14.0751V6.09668H16.7562V15.8252H21.164V18ZM22.7743 18V6.09668H27.1073C28.4354 6.09668 29.4564 6.34017 30.1703 6.82715C30.8842 7.31413 31.2411 8.00033 31.2411 8.88574C31.2411 9.52767 31.0225 10.0894 30.5853 10.5708C30.1537 11.0522 29.6003 11.387 28.9252 11.5752V11.6084C29.7719 11.7135 30.447 12.0262 30.9506 12.5464C31.4597 13.0666 31.7142 13.7002 31.7142 14.4473C31.7142 15.5374 31.3241 16.4035 30.5438 17.0454C29.7636 17.6818 28.6983 18 27.348 18H22.7743ZM25.4555 8.07227V10.8945H26.6342C27.1876 10.8945 27.622 10.7617 27.9374 10.4961C28.2584 10.2249 28.4188 9.85417 28.4188 9.38379C28.4188 8.50944 27.7658 8.07227 26.4599 8.07227H25.4555ZM25.4555 12.8867V16.0244H26.9081C27.5279 16.0244 28.0121 15.8805 28.3607 15.5928C28.7149 15.305 28.892 14.9121 28.892 14.4141C28.892 13.9382 28.7177 13.5646 28.369 13.2935C28.0259 13.0223 27.5445 12.8867 26.9247 12.8867H25.4555Z" fill="#1C212A"/> <path d="M21.164 18V18.1H21.264V18H21.164ZM14.0751 18H13.9751V18.1H14.0751V18ZM14.0751 6.09668V5.99668H13.9751V6.09668H14.0751ZM16.7562 6.09668H16.8562V5.99668H16.7562V6.09668ZM16.7562 15.8252H16.6562V15.9252H16.7562V15.8252ZM21.164 15.8252H21.264V15.7252H21.164V15.8252ZM21.164 17.9H14.0751V18.1H21.164V17.9ZM14.1751 18V6.09668H13.9751V18H14.1751ZM14.0751 6.19668H16.7562V5.99668H14.0751V6.19668ZM16.6562 6.09668V15.8252H16.8562V6.09668H16.6562ZM16.7562 15.9252H21.164V15.7252H16.7562V15.9252ZM21.064 15.8252V18H21.264V15.8252H21.064ZM22.7743 18H22.6743V18.1H22.7743V18ZM22.7743 6.09668V5.99668H22.6743V6.09668H22.7743ZM30.5853 10.5708L30.5113 10.5036L30.5109 10.504L30.5853 10.5708ZM28.9252 11.5752L28.8983 11.4789L28.8252 11.4993V11.5752H28.9252ZM28.9252 11.6084H28.8252V11.6967L28.9129 11.7076L28.9252 11.6084ZM30.9506 12.5464L30.8787 12.6159L30.8791 12.6163L30.9506 12.5464ZM30.5438 17.0454L30.607 17.1229L30.6074 17.1226L30.5438 17.0454ZM25.4555 8.07227V7.97227H25.3555V8.07227H25.4555ZM25.4555 10.8945H25.3555V10.9945H25.4555V10.8945ZM27.9374 10.4961L28.0018 10.5726L28.0019 10.5725L27.9374 10.4961ZM25.4555 12.8867V12.7867H25.3555V12.8867H25.4555ZM25.4555 16.0244H25.3555V16.1244H25.4555V16.0244ZM28.3607 15.5928L28.2977 15.5152L28.2971 15.5157L28.3607 15.5928ZM28.369 13.2935L28.307 13.3719L28.3076 13.3724L28.369 13.2935ZM22.8743 18V6.09668H22.6743V18H22.8743ZM22.7743 6.19668H27.1073V5.99668H22.7743V6.19668ZM27.1073 6.19668C28.4254 6.19668 29.4234 6.43869 30.114 6.90976L30.2267 6.74454C29.4895 6.24165 28.4455 5.99668 27.1073 5.99668V6.19668ZM30.114 6.90976C30.7997 7.37757 31.1411 8.03241 31.1411 8.88574H31.3411C31.3411 7.96824 30.9686 7.25069 30.2267 6.74454L30.114 6.90976ZM31.1411 8.88574C31.1411 9.50246 30.932 10.0403 30.5113 10.5036L30.6594 10.638C31.113 10.1384 31.3411 9.55288 31.3411 8.88574H31.1411ZM30.5109 10.504C30.093 10.9701 29.5567 11.2954 28.8983 11.4789L28.952 11.6715C29.6439 11.4787 30.2144 11.1344 30.6598 10.6376L30.5109 10.504ZM28.8252 11.5752V11.6084H29.0252V11.5752H28.8252ZM28.9129 11.7076C29.7411 11.8105 30.3937 12.115 30.8787 12.6159L31.0224 12.4768C30.5002 11.9374 29.8026 11.6166 28.9375 11.5092L28.9129 11.7076ZM30.8791 12.6163C31.3694 13.1173 31.6142 13.7256 31.6142 14.4473H31.8142C31.8142 13.6748 31.55 13.0159 31.022 12.4764L30.8791 12.6163ZM31.6142 14.4473C31.6142 15.5102 31.2355 16.3469 30.4803 16.9682L30.6074 17.1226C31.4127 16.4601 31.8142 15.5646 31.8142 14.4473H31.6142ZM30.4806 16.9679C29.7235 17.5855 28.6831 17.9 27.348 17.9V18.1C28.7135 18.1 29.8037 17.7782 30.607 17.1229L30.4806 16.9679ZM27.348 17.9H22.7743V18.1H27.348V17.9ZM25.3555 8.07227V10.8945H25.5555V8.07227H25.3555ZM25.4555 10.9945H26.6342V10.7945H25.4555V10.9945ZM26.6342 10.9945C27.203 10.9945 27.663 10.8579 28.0018 10.5726L27.873 10.4196C27.5809 10.6655 27.1721 10.7945 26.6342 10.7945V10.9945ZM28.0019 10.5725C28.3482 10.2799 28.5188 9.87965 28.5188 9.38379H28.3188C28.3188 9.82868 28.1685 10.17 27.8729 10.4197L28.0019 10.5725ZM28.5188 9.38379C28.5188 8.91766 28.3424 8.55653 27.9847 8.31705C27.6341 8.08233 27.1209 7.97227 26.4599 7.97227V8.17227C27.1048 8.17227 27.5711 8.28079 27.8735 8.48324C28.1688 8.68094 28.3188 8.97556 28.3188 9.38379H28.5188ZM26.4599 7.97227H25.4555V8.17227H26.4599V7.97227ZM25.3555 12.8867V16.0244H25.5555V12.8867H25.3555ZM25.4555 16.1244H26.9081V15.9244H25.4555V16.1244ZM26.9081 16.1244C27.5425 16.1244 28.0522 15.9771 28.4244 15.6699L28.2971 15.5157C27.972 15.784 27.5132 15.9244 26.9081 15.9244V16.1244ZM28.4238 15.6704C28.8037 15.3617 28.992 14.9391 28.992 14.4141H28.792C28.792 14.8851 28.6261 15.2483 28.2977 15.5152L28.4238 15.6704ZM28.992 14.4141C28.992 13.9101 28.8055 13.5063 28.4304 13.2145L28.3076 13.3724C28.6298 13.623 28.792 13.9663 28.792 14.4141H28.992ZM28.431 13.215C28.0642 12.9251 27.5578 12.7867 26.9247 12.7867V12.9867C27.5312 12.9867 27.9876 13.1195 28.307 13.3719L28.431 13.215ZM26.9247 12.7867H25.4555V12.9867H26.9247V12.7867Z" fill="#1C212A" mask="url(#path-2-outside-1_2_166)"/> </svg>',
  'ls': '<svg class="dev-hints__icon" width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="17" cy="17" r="12" fill="currentColor"/> <circle cx="17" cy="17" r="11.0769" fill="#1C212A"/> <circle cx="17" cy="17" r="10.1538" fill="currentColor"/> <mask id="path-4-outside-1_2_143" maskUnits="userSpaceOnUse" x="14" y="10" width="8" height="14" fill="black"> <rect fill="white" x="14" y="10" width="8" height="14"/> <path d="M21.4502 23H14.3613V11.0967H17.0425V20.8252H21.4502V23Z"/> </mask> <path d="M21.4502 23H14.3613V11.0967H17.0425V20.8252H21.4502V23Z" fill="#1C212A"/> <path d="M21.4502 23V23.1H21.5502V23H21.4502ZM14.3613 23H14.2613V23.1H14.3613V23ZM14.3613 11.0967V10.9967H14.2613V11.0967H14.3613ZM17.0425 11.0967H17.1425V10.9967H17.0425V11.0967ZM17.0425 20.8252H16.9425V20.9252H17.0425V20.8252ZM21.4502 20.8252H21.5502V20.7252H21.4502V20.8252ZM21.4502 22.9H14.3613V23.1H21.4502V22.9ZM14.4613 23V11.0967H14.2613V23H14.4613ZM14.3613 11.1967H17.0425V10.9967H14.3613V11.1967ZM16.9425 11.0967V20.8252H17.1425V11.0967H16.9425ZM17.0425 20.9252H21.4502V20.7252H17.0425V20.9252ZM21.3502 20.8252V23H21.5502V20.8252H21.3502Z" fill="#1C212A" mask="url(#path-4-outside-1_2_143)"/> <path d="M23.9533 5.44186C19.0575 2.945 15.6776 2.93463 10.1359 5.46188C10.0238 5.51297 9.92522 5.3469 10.0258 5.27589L17.4386 0.0433595C17.475 0.0176779 17.5239 0.0191496 17.5587 0.0469694L24.0739 5.25915C24.1696 5.33571 24.0624 5.49754 23.9533 5.44186Z" fill="currentColor"/> <path d="M23.9533 28.5581C19.0575 31.055 15.6776 31.0654 10.1359 28.5381C10.0238 28.487 9.92522 28.6531 10.0258 28.7241L17.4386 33.9566C17.475 33.9823 17.5239 33.9809 17.5587 33.953L24.0739 28.7409C24.1696 28.6643 24.0624 28.5025 23.9533 28.5581Z" fill="currentColor"/> <path d="M28.5581 10.5467C31.055 15.4425 31.0654 18.8224 28.5381 24.3641C28.487 24.4762 28.6531 24.5748 28.7241 24.4742L33.9566 17.0614C33.9823 17.025 33.9809 16.9761 33.953 16.9413L28.7409 10.4261C28.6643 10.3304 28.5025 10.4376 28.5581 10.5467Z" fill="currentColor"/> <path d="M5.44186 10.5467C2.945 15.4425 2.93463 18.8224 5.46188 24.3641C5.51297 24.4762 5.3469 24.5748 5.27589 24.4742L0.0433595 17.0614C0.0176779 17.025 0.0191496 16.9761 0.0469694 16.9413L5.25915 10.4261C5.33571 10.3304 5.49754 10.4376 5.44186 10.5467Z" fill="currentColor"/> </svg>',
  'ls-press': '<svg class="dev-hints__icon" width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect y="10" width="34" height="16" rx="8" fill="currentColor"/> <rect x="9" y="26" width="16" height="4" fill="currentColor"/> <mask id="path-3-outside-1_2_235" maskUnits="userSpaceOnUse" x="14" y="11.5" width="8" height="14" fill="black"> <rect fill="white" x="14" y="11.5" width="8" height="14"/> <path d="M21.4502 24.5H14.3613V12.5967H17.0425V22.3252H21.4502V24.5Z"/> </mask> <path d="M21.4502 24.5H14.3613V12.5967H17.0425V22.3252H21.4502V24.5Z" fill="#1C212A"/> <path d="M21.4502 24.5V24.6H21.5502V24.5H21.4502ZM14.3613 24.5H14.2613V24.6H14.3613V24.5ZM14.3613 12.5967V12.4967H14.2613V12.5967H14.3613ZM17.0425 12.5967H17.1425V12.4967H17.0425V12.5967ZM17.0425 22.3252H16.9425V22.4252H17.0425V22.3252ZM21.4502 22.3252H21.5502V22.2252H21.4502V22.3252ZM21.4502 24.4H14.3613V24.6H21.4502V24.4ZM14.4613 24.5V12.5967H14.2613V24.5H14.4613ZM14.3613 12.6967H17.0425V12.4967H14.3613V12.6967ZM16.9425 12.5967V22.3252H17.1425V12.5967H16.9425ZM17.0425 22.4252H21.4502V22.2252H17.0425V22.4252ZM21.3502 22.3252V24.5H21.5502V22.3252H21.3502Z" fill="#1C212A" mask="url(#path-3-outside-1_2_235)"/> <path d="M17 10L20.4641 5.5H13.5359L17 10Z" fill="currentColor"/> </svg>',
  'lt': '<svg class="dev-hints__icon" viewBox="-2 -6 37 44" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M30.7968 0H6.96407C5.5154 0 4.53936 1.50178 4.97039 2.88485C8.04102 12.7377 4.72677 22.5714 1.60882 28.152C0.909864 29.403 1.56319 31.0564 2.97511 31.3014C24.5858 35.0499 31.7462 22.8169 32.6025 15.9295C33.2488 10.7312 32.9611 4.72824 32.7517 1.79756C32.6786 0.774478 31.8225 0 30.7968 0Z" fill="currentColor"/> <mask id="path-2-outside-1_2_178" maskUnits="userSpaceOnUse" x="11.5" y="5" fill="black"> <rect fill="white" x="11.5" y="5"/> <path d="M18.9502 18H11.8613V6.09668H14.5425V15.8252H18.9502V18ZM27.7905 8.27979H24.3955V18H21.7061V8.27979H18.3276V6.09668H27.7905V8.27979Z"/> </mask> <path d="M18.9502 18H11.8613V6.09668H14.5425V15.8252H18.9502V18ZM27.7905 8.27979H24.3955V18H21.7061V8.27979H18.3276V6.09668H27.7905V8.27979Z" fill="#1C212A"/> <path d="M18.9502 18V18.1H19.0502V18H18.9502ZM11.8613 18H11.7613V18.1H11.8613V18ZM11.8613 6.09668V5.99668H11.7613V6.09668H11.8613ZM14.5425 6.09668H14.6425V5.99668H14.5425V6.09668ZM14.5425 15.8252H14.4425V15.9252H14.5425V15.8252ZM18.9502 15.8252H19.0502V15.7252H18.9502V15.8252ZM18.9502 17.9H11.8613V18.1H18.9502V17.9ZM11.9613 18V6.09668H11.7613V18H11.9613ZM11.8613 6.19668H14.5425V5.99668H11.8613V6.19668ZM14.4425 6.09668V15.8252H14.6425V6.09668H14.4425ZM14.5425 15.9252H18.9502V15.7252H14.5425V15.9252ZM18.8502 15.8252V18H19.0502V15.8252H18.8502ZM27.7905 8.27979V8.37979H27.8905V8.27979H27.7905ZM24.3955 8.27979V8.17979H24.2955V8.27979H24.3955ZM24.3955 18V18.1H24.4955V18H24.3955ZM21.7061 18H21.6061V18.1H21.7061V18ZM21.7061 8.27979H21.8061V8.17979H21.7061V8.27979ZM18.3276 8.27979H18.2276V8.37979H18.3276V8.27979ZM18.3276 6.09668V5.99668H18.2276V6.09668H18.3276ZM27.7905 6.09668H27.8905V5.99668H27.7905V6.09668ZM27.7905 8.17979H24.3955V8.37979H27.7905V8.17979ZM24.2955 8.27979V18H24.4955V8.27979H24.2955ZM24.3955 17.9H21.7061V18.1H24.3955V17.9ZM21.8061 18V8.27979H21.6061V18H21.8061ZM21.7061 8.17979H18.3276V8.37979H21.7061V8.17979ZM18.4276 8.27979V6.09668H18.2276V8.27979H18.4276ZM18.3276 6.19668H27.7905V5.99668H18.3276V6.19668ZM27.6905 6.09668V8.27979H27.8905V6.09668H27.6905Z" fill="#1C212A" mask="url(#path-2-outside-1_2_178)"/> </svg>',
  'rb': '<svg class="dev-hints__icon" viewBox="0 0 39 22" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M38.4399 9.22469L38.8882 19.4485C38.9491 20.8392 37.8381 22 36.4461 22H5.60612C4.46545 22 3.47641 21.2111 3.22284 20.099L0.354691 7.51976C0.139175 6.57455 0.502621 5.59129 1.2811 5.01349L7.33406 0.52086C7.71755 0.236228 8.17886 0.0684723 8.656 0.0481076C22.375 -0.53743 33.0123 4.35606 37.4873 7.4406C38.0744 7.84528 38.4086 8.51231 38.4399 9.22469Z" fill="currentColor"/> <mask id="path-2-outside-1_2_170" maskUnits="userSpaceOnUse" x="7.631" y="5" fill="black"> <rect fill="white" x="7.631" y="5"/> <path d="M17.9782 18H14.8986L13.0475 14.937C12.9092 14.7046 12.7763 14.4971 12.6491 14.3145C12.5218 14.1318 12.3917 13.9769 12.2589 13.8496C12.1317 13.7168 11.9961 13.6172 11.8522 13.5508C11.7138 13.4788 11.5617 13.4429 11.3957 13.4429H10.6735V18H7.99233V6.09668H12.2423C15.131 6.09668 16.5753 7.17578 16.5753 9.33398C16.5753 9.74902 16.5117 10.1336 16.3844 10.4878C16.2571 10.8364 16.0773 11.1519 15.8449 11.4341C15.6124 11.7163 15.3302 11.9598 14.9982 12.1646C14.6717 12.3693 14.3065 12.5298 13.9025 12.646V12.6792C14.0796 12.7345 14.2511 12.8258 14.4171 12.9531C14.5832 13.0749 14.7436 13.2188 14.8986 13.3848C15.0535 13.5508 15.2002 13.7306 15.3385 13.9243C15.4824 14.1125 15.6124 14.2979 15.7287 14.4805L17.9782 18ZM10.6735 8.10547V11.4175H11.8356C12.4111 11.4175 12.8732 11.2515 13.2218 10.9194C13.576 10.5819 13.7531 10.1641 13.7531 9.66602C13.7531 8.62565 13.1305 8.10547 11.8854 8.10547H10.6735ZM19.0988 18V6.09668H23.4318C24.7599 6.09668 25.7809 6.34017 26.4948 6.82715C27.2086 7.31413 27.5656 8.00033 27.5656 8.88574C27.5656 9.52767 27.347 10.0894 26.9098 10.5708C26.4782 11.0522 25.9248 11.387 25.2497 11.5752V11.6084C26.0963 11.7135 26.7715 12.0262 27.275 12.5464C27.7842 13.0666 28.0387 13.7002 28.0387 14.4473C28.0387 15.5374 27.6486 16.4035 26.8683 17.0454C26.088 17.6818 25.0228 18 23.6725 18H19.0988ZM21.7799 8.07227V10.8945H22.9586C23.512 10.8945 23.9464 10.7617 24.2619 10.4961C24.5828 10.2249 24.7433 9.85417 24.7433 9.38379C24.7433 8.50944 24.0903 8.07227 22.7843 8.07227H21.7799ZM21.7799 12.8867V16.0244H23.2326C23.8524 16.0244 24.3366 15.8805 24.6852 15.5928C25.0394 15.305 25.2165 14.9121 25.2165 14.4141C25.2165 13.9382 25.0421 13.5646 24.6935 13.2935C24.3504 13.0223 23.869 12.8867 23.2492 12.8867H21.7799Z"/> </mask> <path d="M17.9782 18H14.8986L13.0475 14.937C12.9092 14.7046 12.7763 14.4971 12.6491 14.3145C12.5218 14.1318 12.3917 13.9769 12.2589 13.8496C12.1317 13.7168 11.9961 13.6172 11.8522 13.5508C11.7138 13.4788 11.5617 13.4429 11.3957 13.4429H10.6735V18H7.99233V6.09668H12.2423C15.131 6.09668 16.5753 7.17578 16.5753 9.33398C16.5753 9.74902 16.5117 10.1336 16.3844 10.4878C16.2571 10.8364 16.0773 11.1519 15.8449 11.4341C15.6124 11.7163 15.3302 11.9598 14.9982 12.1646C14.6717 12.3693 14.3065 12.5298 13.9025 12.646V12.6792C14.0796 12.7345 14.2511 12.8258 14.4171 12.9531C14.5832 13.0749 14.7436 13.2188 14.8986 13.3848C15.0535 13.5508 15.2002 13.7306 15.3385 13.9243C15.4824 14.1125 15.6124 14.2979 15.7287 14.4805L17.9782 18ZM10.6735 8.10547V11.4175H11.8356C12.4111 11.4175 12.8732 11.2515 13.2218 10.9194C13.576 10.5819 13.7531 10.1641 13.7531 9.66602C13.7531 8.62565 13.1305 8.10547 11.8854 8.10547H10.6735ZM19.0988 18V6.09668H23.4318C24.7599 6.09668 25.7809 6.34017 26.4948 6.82715C27.2086 7.31413 27.5656 8.00033 27.5656 8.88574C27.5656 9.52767 27.347 10.0894 26.9098 10.5708C26.4782 11.0522 25.9248 11.387 25.2497 11.5752V11.6084C26.0963 11.7135 26.7715 12.0262 27.275 12.5464C27.7842 13.0666 28.0387 13.7002 28.0387 14.4473C28.0387 15.5374 27.6486 16.4035 26.8683 17.0454C26.088 17.6818 25.0228 18 23.6725 18H19.0988ZM21.7799 8.07227V10.8945H22.9586C23.512 10.8945 23.9464 10.7617 24.2619 10.4961C24.5828 10.2249 24.7433 9.85417 24.7433 9.38379C24.7433 8.50944 24.0903 8.07227 22.7843 8.07227H21.7799ZM21.7799 12.8867V16.0244H23.2326C23.8524 16.0244 24.3366 15.8805 24.6852 15.5928C25.0394 15.305 25.2165 14.9121 25.2165 14.4141C25.2165 13.9382 25.0421 13.5646 24.6935 13.2935C24.3504 13.0223 23.869 12.8867 23.2492 12.8867H21.7799Z" fill="#1C212A"/> <path d="M17.9782 18V18.11H18.179L18.0709 17.9408L17.9782 18ZM14.8986 18L14.8044 18.0569L14.8365 18.11H14.8986V18ZM13.0475 14.937L12.953 14.9933L12.9534 14.9939L13.0475 14.937ZM12.2589 13.8496L12.1794 13.9258L12.1828 13.929L12.2589 13.8496ZM11.8522 13.5508L11.8014 13.6485L11.8061 13.6507L11.8522 13.5508ZM10.6735 13.4429V13.3329H10.5635V13.4429H10.6735ZM10.6735 18V18.11H10.7835V18H10.6735ZM7.99233 18H7.88233V18.11H7.99233V18ZM7.99233 6.09668V5.98668H7.88233V6.09668H7.99233ZM16.3844 10.4878L16.4878 10.5255L16.4879 10.525L16.3844 10.4878ZM14.9982 12.1646L14.9405 12.0709L14.9397 12.0714L14.9982 12.1646ZM13.9025 12.646L13.8721 12.5403L13.7925 12.5632V12.646H13.9025ZM13.9025 12.6792H13.7925V12.7601L13.8697 12.7842L13.9025 12.6792ZM14.4171 12.9531L14.3502 13.0404L14.3521 13.0418L14.4171 12.9531ZM15.3385 13.9243L15.249 13.9883L15.2511 13.9911L15.3385 13.9243ZM15.7287 14.4805L15.6359 14.5395L15.636 14.5397L15.7287 14.4805ZM10.6735 8.10547V7.99547H10.5635V8.10547H10.6735ZM10.6735 11.4175H10.5635V11.5275H10.6735V11.4175ZM13.2218 10.9194L13.2977 10.9991L13.2977 10.9991L13.2218 10.9194ZM17.9782 17.89H14.8986V18.11H17.9782V17.89ZM14.9927 17.9431L13.1417 14.8801L12.9534 14.9939L14.8044 18.0569L14.9927 17.9431ZM13.142 14.8807C13.0026 14.6465 12.8684 14.4367 12.7393 14.2516L12.5588 14.3774C12.6843 14.5574 12.8157 14.7627 12.953 14.9933L13.142 14.8807ZM12.7393 14.2516C12.6087 14.0642 12.4741 13.9034 12.335 13.7702L12.1828 13.929C12.3094 14.0504 12.4349 14.1995 12.5588 14.3774L12.7393 14.2516ZM12.3384 13.7735C12.2031 13.6323 12.0565 13.5239 11.8983 13.4509L11.8061 13.6507C11.9356 13.7104 12.0602 13.8013 12.1795 13.9257L12.3384 13.7735ZM11.9029 13.4532C11.7479 13.3726 11.5782 13.3329 11.3957 13.3329V13.5529C11.5452 13.5529 11.6798 13.5851 11.8014 13.6484L11.9029 13.4532ZM11.3957 13.3329H10.6735V13.5529H11.3957V13.3329ZM10.5635 13.4429V18H10.7835V13.4429H10.5635ZM10.6735 17.89H7.99233V18.11H10.6735V17.89ZM8.10233 18V6.09668H7.88233V18H8.10233ZM7.99233 6.20668H12.2423V5.98668H7.99233V6.20668ZM12.2423 6.20668C13.6762 6.20668 14.7315 6.47505 15.4263 6.99413C16.115 7.5087 16.4653 8.28188 16.4653 9.33398H16.6853C16.6853 8.22788 16.3135 7.38241 15.5579 6.81788C14.8084 6.25786 13.6972 5.98668 12.2423 5.98668V6.20668ZM16.4653 9.33398C16.4653 9.73764 16.4035 10.1095 16.2809 10.4506L16.4879 10.525C16.6199 10.1577 16.6853 9.76041 16.6853 9.33398H16.4653ZM16.2811 10.4501C16.158 10.7872 15.9843 11.0917 15.76 11.3642L15.9298 11.504C16.1702 11.212 16.3563 10.8857 16.4878 10.5255L16.2811 10.4501ZM15.76 11.3642C15.5357 11.6364 15.2629 11.8721 14.9405 12.0709L15.0559 12.2582C15.3976 12.0475 15.6892 11.7962 15.9298 11.504L15.76 11.3642ZM14.9397 12.0714C14.6227 12.2702 14.2671 12.4267 13.8721 12.5403L13.9329 12.7517C14.3459 12.6329 14.7207 12.4684 15.0566 12.2577L14.9397 12.0714ZM13.7925 12.646V12.6792H14.0125V12.646H13.7925ZM13.8697 12.7842C14.033 12.8352 14.1931 12.92 14.3502 13.0404L14.4841 12.8658C14.3091 12.7317 14.1262 12.6339 13.9353 12.5742L13.8697 12.7842ZM14.3521 13.0418C14.512 13.1591 14.6674 13.2983 14.8182 13.4598L14.979 13.3097C14.8198 13.1392 14.6543 12.9906 14.4822 12.8644L14.3521 13.0418ZM14.8182 13.4598C14.9697 13.6222 15.1133 13.7983 15.249 13.9883L15.428 13.8604C15.287 13.663 15.1374 13.4794 14.979 13.3097L14.8182 13.4598ZM15.2511 13.9911C15.3933 14.177 15.5215 14.3598 15.6359 14.5395L15.8215 14.4214C15.7034 14.2359 15.5715 14.0479 15.4259 13.8575L15.2511 13.9911ZM15.636 14.5397L17.8855 18.0592L18.0709 17.9408L15.8213 14.4212L15.636 14.5397ZM10.5635 8.10547V11.4175H10.7835V8.10547H10.5635ZM10.6735 11.5275H11.8356V11.3075H10.6735V11.5275ZM11.8356 11.5275C12.4335 11.5275 12.9247 11.3543 13.2977 10.9991L13.146 10.8398C12.8217 11.1486 12.3887 11.3075 11.8356 11.3075V11.5275ZM13.2977 10.9991C13.6741 10.6403 13.8631 10.1935 13.8631 9.66602H13.6431C13.6431 10.1346 13.4779 10.5234 13.1459 10.8398L13.2977 10.9991ZM13.8631 9.66602C13.8631 9.12317 13.6997 8.69781 13.3567 8.41119C13.0174 8.12774 12.5206 7.99547 11.8854 7.99547V8.21547C12.4953 8.21547 12.9323 8.34329 13.2156 8.58002C13.4952 8.81358 13.6431 9.1685 13.6431 9.66602H13.8631ZM11.8854 7.99547H10.6735V8.21547H11.8854V7.99547ZM19.0988 18H18.9888V18.11H19.0988V18ZM19.0988 6.09668V5.98668H18.9888V6.09668H19.0988ZM26.9098 10.5708L26.8284 10.4969L26.8279 10.4974L26.9098 10.5708ZM25.2497 11.5752L25.2201 11.4692L25.1397 11.4917V11.5752H25.2497ZM25.2497 11.6084H25.1397V11.7056L25.2361 11.7176L25.2497 11.6084ZM27.275 12.5464L27.196 12.6229L27.1964 12.6233L27.275 12.5464ZM26.8683 17.0454L26.9378 17.1307L26.9382 17.1304L26.8683 17.0454ZM21.7799 8.07227V7.96227H21.6699V8.07227H21.7799ZM21.7799 10.8945H21.6699V11.0045H21.7799V10.8945ZM24.2619 10.4961L24.3327 10.5802L24.3329 10.5801L24.2619 10.4961ZM21.7799 12.8867V12.7767H21.6699V12.8867H21.7799ZM21.7799 16.0244H21.6699V16.1344H21.7799V16.0244ZM24.6852 15.5928L24.6158 15.5074L24.6152 15.5079L24.6852 15.5928ZM24.6935 13.2935L24.6253 13.3798L24.626 13.3803L24.6935 13.2935ZM19.2088 18V6.09668H18.9888V18H19.2088ZM19.0988 6.20668H23.4318V5.98668H19.0988V6.20668ZM23.4318 6.20668C24.7489 6.20668 25.7446 6.44854 26.4328 6.91802L26.5568 6.73628C25.8172 6.23179 24.771 5.98668 23.4318 5.98668V6.20668ZM26.4328 6.91802C27.1157 7.38391 27.4556 8.03562 27.4556 8.88574H27.6756C27.6756 7.96503 27.3015 7.24435 26.5568 6.73628L26.4328 6.91802ZM27.4556 8.88574C27.4556 9.49993 27.2474 10.0354 26.8284 10.4969L26.9912 10.6447C27.4465 10.1434 27.6756 9.5554 27.6756 8.88574H27.4556ZM26.8279 10.4974C26.4114 10.9619 25.8768 11.2862 25.2201 11.4692L25.2792 11.6812C25.9728 11.4879 26.5449 11.1426 26.9917 10.6442L26.8279 10.4974ZM25.1397 11.5752V11.6084H25.3597V11.5752H25.1397ZM25.2361 11.7176C26.0625 11.8202 26.7129 12.1238 27.196 12.6229L27.3541 12.4699C26.83 11.9286 26.1302 11.6069 25.2632 11.4992L25.2361 11.7176ZM27.1964 12.6233C27.6848 13.1224 27.9287 13.7281 27.9287 14.4473H28.1487C28.1487 13.6723 27.8835 13.0108 27.3537 12.4694L27.1964 12.6233ZM27.9287 14.4473C27.9287 15.5075 27.5511 16.3412 26.7984 16.9605L26.9382 17.1304C27.7461 16.4657 28.1487 15.5674 28.1487 14.4473H27.9287ZM26.7988 16.9602C26.0439 17.5758 25.0061 17.89 23.6725 17.89V18.11C25.0395 18.11 26.1321 17.7878 26.9378 17.1307L26.7988 16.9602ZM23.6725 17.89H19.0988V18.11H23.6725V17.89ZM21.6699 8.07227V10.8945H21.8899V8.07227H21.6699ZM21.7799 11.0045H22.9586V10.7845H21.7799V11.0045ZM22.9586 11.0045C23.529 11.0045 23.9916 10.8675 24.3327 10.5802L24.191 10.412C23.9013 10.6559 23.495 10.7845 22.9586 10.7845V11.0045ZM24.3329 10.5801C24.6817 10.2854 24.8533 9.8822 24.8533 9.38379H24.6333C24.6333 9.82613 24.484 10.1645 24.1909 10.4121L24.3329 10.5801ZM24.8533 9.38379C24.8533 8.91477 24.6756 8.55031 24.3148 8.30874C23.9618 8.0724 23.4461 7.96227 22.7843 7.96227V8.18227C23.4285 8.18227 23.8924 8.29071 24.1924 8.49155C24.4845 8.68716 24.6333 8.97846 24.6333 9.38379H24.8533ZM22.7843 7.96227H21.7799V8.18227H22.7843V7.96227ZM21.6699 12.8867V16.0244H21.8899V12.8867H21.6699ZM21.7799 16.1344H23.2326V15.9144H21.7799V16.1344ZM23.2326 16.1344C23.8685 16.1344 24.3807 15.9868 24.7552 15.6776L24.6152 15.5079C24.2925 15.7743 23.8362 15.9144 23.2326 15.9144V16.1344ZM24.7546 15.6781C25.137 15.3674 25.3265 14.9418 25.3265 14.4141H25.1065C25.1065 14.8824 24.9417 15.2426 24.6158 15.5074L24.7546 15.6781ZM25.3265 14.4141C25.3265 13.9072 25.1388 13.5004 24.761 13.2066L24.626 13.3803C24.9455 13.6288 25.1065 13.9691 25.1065 14.4141H25.3265ZM24.7617 13.2072C24.3925 12.9154 23.8836 12.7767 23.2492 12.7767V12.9967C23.8543 12.9967 24.3083 13.1292 24.6253 13.3798L24.7617 13.2072ZM23.2492 12.7767H21.7799V12.9967H23.2492V12.7767Z" fill="#1C212A" mask="url(#path-2-outside-1_2_170)"/> </svg>',
  'rs': '<svg class="dev-hints__icon" width="32" height="37" viewBox="0 0 32 37" fill="none" xmlns="http://www.w3.org/2000/svg"> <circle cx="16" cy="19" r="12" fill="currentColor"/> <circle cx="16" cy="19" r="11.0769" fill="#1C212A"/> <circle cx="16" cy="19" r="10.1538" fill="currentColor"/> <mask id="path-4-outside-1_117_10" maskUnits="userSpaceOnUse" x="11.5" y="12" width="11" height="14" fill="black"> <rect fill="white" x="11.5" y="12" width="11" height="14"/> <path d="M21.8472 25H18.7676L16.9165 21.937C16.7782 21.7046 16.6453 21.4971 16.5181 21.3145C16.3908 21.1318 16.2607 20.9769 16.1279 20.8496C16.0007 20.7168 15.8651 20.6172 15.7212 20.5508C15.5828 20.4788 15.4307 20.4429 15.2646 20.4429H14.5425V25H11.8613V13.0967H16.1113C19 13.0967 20.4443 14.1758 20.4443 16.334C20.4443 16.749 20.3807 17.1336 20.2534 17.4878C20.1261 17.8364 19.9463 18.1519 19.7139 18.4341C19.4814 18.7163 19.1992 18.9598 18.8672 19.1646C18.5407 19.3693 18.1755 19.5298 17.7715 19.646V19.6792C17.9486 19.7345 18.1201 19.8258 18.2861 19.9531C18.4521 20.0749 18.6126 20.2188 18.7676 20.3848C18.9225 20.5508 19.0692 20.7306 19.2075 20.9243C19.3514 21.1125 19.4814 21.2979 19.5977 21.4805L21.8472 25ZM14.5425 15.1055V18.4175H15.7046C16.2801 18.4175 16.7422 18.2515 17.0908 17.9194C17.445 17.5819 17.6221 17.1641 17.6221 16.666C17.6221 15.6257 16.9995 15.1055 15.7544 15.1055H14.5425Z"/> </mask> <path d="M21.8472 25H18.7676L16.9165 21.937C16.7782 21.7046 16.6453 21.4971 16.5181 21.3145C16.3908 21.1318 16.2607 20.9769 16.1279 20.8496C16.0007 20.7168 15.8651 20.6172 15.7212 20.5508C15.5828 20.4788 15.4307 20.4429 15.2646 20.4429H14.5425V25H11.8613V13.0967H16.1113C19 13.0967 20.4443 14.1758 20.4443 16.334C20.4443 16.749 20.3807 17.1336 20.2534 17.4878C20.1261 17.8364 19.9463 18.1519 19.7139 18.4341C19.4814 18.7163 19.1992 18.9598 18.8672 19.1646C18.5407 19.3693 18.1755 19.5298 17.7715 19.646V19.6792C17.9486 19.7345 18.1201 19.8258 18.2861 19.9531C18.4521 20.0749 18.6126 20.2188 18.7676 20.3848C18.9225 20.5508 19.0692 20.7306 19.2075 20.9243C19.3514 21.1125 19.4814 21.2979 19.5977 21.4805L21.8472 25ZM14.5425 15.1055V18.4175H15.7046C16.2801 18.4175 16.7422 18.2515 17.0908 17.9194C17.445 17.5819 17.6221 17.1641 17.6221 16.666C17.6221 15.6257 16.9995 15.1055 15.7544 15.1055H14.5425Z" fill="#1C212A"/> <path d="M21.8472 25V25.1H22.0298L21.9314 24.9461L21.8472 25ZM18.7676 25L18.682 25.0517L18.7112 25.1H18.7676V25ZM16.9165 21.937L16.8306 21.9882L16.8309 21.9887L16.9165 21.937ZM16.1279 20.8496L16.0557 20.9189L16.0587 20.9218L16.1279 20.8496ZM15.7212 20.5508L15.675 20.6396L15.6793 20.6416L15.7212 20.5508ZM14.5425 20.4429V20.3429H14.4425V20.4429H14.5425ZM14.5425 25V25.1H14.6425V25H14.5425ZM11.8613 25H11.7613V25.1H11.8613V25ZM11.8613 13.0967V12.9967H11.7613V13.0967H11.8613ZM20.2534 17.4878L20.3474 17.5221L20.3475 17.5216L20.2534 17.4878ZM18.8672 19.1646L18.8147 19.0794L18.8141 19.0798L18.8672 19.1646ZM17.7715 19.646L17.7438 19.5499L17.6715 19.5707V19.646H17.7715ZM17.7715 19.6792H17.6715V19.7527L17.7417 19.7746L17.7715 19.6792ZM18.2861 19.9531L18.2253 20.0325L18.227 20.0338L18.2861 19.9531ZM19.2075 20.9243L19.1261 20.9825L19.1281 20.9851L19.2075 20.9243ZM19.5977 21.4805L19.5133 21.5342L19.5134 21.5343L19.5977 21.4805ZM14.5425 15.1055V15.0055H14.4425V15.1055H14.5425ZM14.5425 18.4175H14.4425V18.5175H14.5425V18.4175ZM17.0908 17.9194L17.1598 17.9918L17.1598 17.9918L17.0908 17.9194ZM21.8472 25V24.9H18.7676V25V25.1H21.8472V25ZM18.7676 25L18.8532 24.9483L17.0021 21.8853L16.9165 21.937L16.8309 21.9887L18.682 25.0517L18.7676 25ZM16.9165 21.937L17.0024 21.8859C16.8631 21.6518 16.729 21.4422 16.6001 21.2573L16.5181 21.3145L16.436 21.3716C16.5617 21.5519 16.6932 21.7574 16.8306 21.9882L16.9165 21.937ZM16.5181 21.3145L16.6001 21.2573C16.4698 21.0703 16.3356 20.9101 16.1971 20.7774L16.1279 20.8496L16.0587 20.9218C16.1859 21.0437 16.3118 21.1933 16.436 21.3716L16.5181 21.3145ZM16.1279 20.8496L16.2001 20.7804C16.0656 20.64 15.92 20.5324 15.7631 20.46L15.7212 20.5508L15.6793 20.6416C15.8101 20.702 15.9357 20.7936 16.0557 20.9188L16.1279 20.8496ZM15.7212 20.5508L15.7673 20.4621C15.6138 20.3822 15.4457 20.3429 15.2646 20.3429V20.4429V20.5429C15.4157 20.5429 15.5519 20.5754 15.6751 20.6395L15.7212 20.5508ZM15.2646 20.4429V20.3429H14.5425V20.4429V20.5429H15.2646V20.4429ZM14.5425 20.4429H14.4425V25H14.5425H14.6425V20.4429H14.5425ZM14.5425 25V24.9H11.8613V25V25.1H14.5425V25ZM11.8613 25H11.9613V13.0967H11.8613H11.7613V25H11.8613ZM11.8613 13.0967V13.1967H16.1113V13.0967V12.9967H11.8613V13.0967ZM16.1113 13.0967V13.1967C17.5461 13.1967 18.604 13.4652 19.3012 13.9861C19.993 14.503 20.3443 15.2794 20.3443 16.334H20.4443H20.5443C20.5443 15.2303 20.1735 14.3882 19.4209 13.8259C18.6739 13.2677 17.5652 12.9967 16.1113 12.9967V13.0967ZM20.4443 16.334H20.3443C20.3443 16.7387 20.2823 17.1117 20.1593 17.454L20.2534 17.4878L20.3475 17.5216C20.4791 17.1555 20.5443 16.7594 20.5443 16.334H20.4443ZM20.2534 17.4878L20.1595 17.4535C20.036 17.7917 19.8618 18.0972 19.6367 18.3705L19.7139 18.4341L19.7911 18.4977C20.0308 18.2066 20.2163 17.8812 20.3474 17.5221L20.2534 17.4878ZM19.7139 18.4341L19.6367 18.3705C19.4117 18.6437 19.138 18.8801 18.8147 19.0794L18.8672 19.1646L18.9197 19.2497C19.2604 19.0395 19.5512 18.7889 19.7911 18.4977L19.7139 18.4341ZM18.8672 19.1646L18.8141 19.0798C18.4962 19.2792 18.1396 19.436 17.7438 19.5499L17.7715 19.646L17.7991 19.7421C18.2113 19.6235 18.5852 19.4594 18.9203 19.2493L18.8672 19.1646ZM17.7715 19.646H17.6715V19.6792H17.7715H17.8715V19.646H17.7715ZM17.7715 19.6792L17.7417 19.7746C17.9062 19.8261 18.0674 19.9114 18.2253 20.0325L18.2861 19.9531L18.347 19.8738C18.1728 19.7402 17.9909 19.643 17.8013 19.5838L17.7715 19.6792ZM18.2861 19.9531L18.227 20.0338C18.3875 20.1515 18.5434 20.2911 18.6945 20.453L18.7676 20.3848L18.8407 20.3165C18.6819 20.1464 18.5168 19.9983 18.3453 19.8725L18.2861 19.9531ZM18.7676 20.3848L18.6945 20.453C18.8463 20.6157 18.9902 20.7921 19.1261 20.9824L19.2075 20.9243L19.2889 20.8662C19.1481 20.6691 18.9987 20.4859 18.8407 20.3165L18.7676 20.3848ZM19.2075 20.9243L19.1281 20.9851C19.2704 21.1711 19.3988 21.3542 19.5133 21.5342L19.5977 21.4805L19.682 21.4268C19.5641 21.2415 19.4324 21.0538 19.287 20.8636L19.2075 20.9243ZM19.5977 21.4805L19.5134 21.5343L21.7629 25.0539L21.8472 25L21.9314 24.9461L19.6819 21.4266L19.5977 21.4805ZM14.5425 15.1055H14.4425V18.4175H14.5425H14.6425V15.1055H14.5425ZM14.5425 18.4175V18.5175H15.7046V18.4175V18.3175H14.5425V18.4175ZM15.7046 18.4175V18.5175C16.3005 18.5175 16.789 18.345 17.1598 17.9918L17.0908 17.9194L17.0219 17.847C16.6954 18.158 16.2598 18.3175 15.7046 18.3175V18.4175ZM17.0908 17.9194L17.1598 17.9918C17.5342 17.635 17.7221 17.1909 17.7221 16.666H17.6221H17.5221C17.5221 17.1373 17.3558 17.5287 17.0218 17.847L17.0908 17.9194ZM17.6221 16.666H17.7221C17.7221 16.1252 17.5594 15.7031 17.2193 15.4189C16.8826 15.1375 16.3884 15.0055 15.7544 15.0055V15.1055V15.2055C16.3655 15.2055 16.8052 15.3335 17.091 15.5723C17.3735 15.8083 17.5221 16.1664 17.5221 16.666H17.6221ZM15.7544 15.1055V15.0055H14.5425V15.1055V15.2055H15.7544V15.1055Z" fill="#1C212A" mask="url(#path-4-outside-1_117_10)"/> <path d="M22.9533 30.5581C18.0575 33.055 14.6776 33.0654 9.13587 30.5381C9.02383 30.487 8.92522 30.6531 9.02582 30.7241L16.4386 35.9566C16.475 35.9823 16.5239 35.9809 16.5587 35.953L23.0739 30.7409C23.1696 30.6643 23.0624 30.5025 22.9533 30.5581Z" fill="currentColor"/> <circle cx="16" cy="19" r="12" fill="currentColor"/> <circle cx="16" cy="19" r="11.0769" fill="#1C212A"/> <circle cx="16" cy="19" r="10.1538" fill="currentColor"/> <mask id="path-10-outside-2_117_10" maskUnits="userSpaceOnUse" x="11.5" y="12" width="11" height="14" fill="black"> <rect fill="white" x="11.5" y="12" width="11" height="14"/> <path d="M21.8472 25H18.7676L16.9165 21.937C16.7782 21.7046 16.6453 21.4971 16.5181 21.3145C16.3908 21.1318 16.2607 20.9769 16.1279 20.8496C16.0007 20.7168 15.8651 20.6172 15.7212 20.5508C15.5828 20.4788 15.4307 20.4429 15.2646 20.4429H14.5425V25H11.8613V13.0967H16.1113C19 13.0967 20.4443 14.1758 20.4443 16.334C20.4443 16.749 20.3807 17.1336 20.2534 17.4878C20.1261 17.8364 19.9463 18.1519 19.7139 18.4341C19.4814 18.7163 19.1992 18.9598 18.8672 19.1646C18.5407 19.3693 18.1755 19.5298 17.7715 19.646V19.6792C17.9486 19.7345 18.1201 19.8258 18.2861 19.9531C18.4521 20.0749 18.6126 20.2188 18.7676 20.3848C18.9225 20.5508 19.0692 20.7306 19.2075 20.9243C19.3514 21.1125 19.4814 21.2979 19.5977 21.4805L21.8472 25ZM14.5425 15.1055V18.4175H15.7046C16.2801 18.4175 16.7422 18.2515 17.0908 17.9194C17.445 17.5819 17.6221 17.1641 17.6221 16.666C17.6221 15.6257 16.9995 15.1055 15.7544 15.1055H14.5425Z"/> </mask> <path d="M21.8472 25H18.7676L16.9165 21.937C16.7782 21.7046 16.6453 21.4971 16.5181 21.3145C16.3908 21.1318 16.2607 20.9769 16.1279 20.8496C16.0007 20.7168 15.8651 20.6172 15.7212 20.5508C15.5828 20.4788 15.4307 20.4429 15.2646 20.4429H14.5425V25H11.8613V13.0967H16.1113C19 13.0967 20.4443 14.1758 20.4443 16.334C20.4443 16.749 20.3807 17.1336 20.2534 17.4878C20.1261 17.8364 19.9463 18.1519 19.7139 18.4341C19.4814 18.7163 19.1992 18.9598 18.8672 19.1646C18.5407 19.3693 18.1755 19.5298 17.7715 19.646V19.6792C17.9486 19.7345 18.1201 19.8258 18.2861 19.9531C18.4521 20.0749 18.6126 20.2188 18.7676 20.3848C18.9225 20.5508 19.0692 20.7306 19.2075 20.9243C19.3514 21.1125 19.4814 21.2979 19.5977 21.4805L21.8472 25ZM14.5425 15.1055V18.4175H15.7046C16.2801 18.4175 16.7422 18.2515 17.0908 17.9194C17.445 17.5819 17.6221 17.1641 17.6221 16.666C17.6221 15.6257 16.9995 15.1055 15.7544 15.1055H14.5425Z" fill="#1C212A"/> <path d="M21.8472 25V25.1H22.0298L21.9314 24.9461L21.8472 25ZM18.7676 25L18.682 25.0517L18.7112 25.1H18.7676V25ZM16.9165 21.937L16.8306 21.9882L16.8309 21.9887L16.9165 21.937ZM16.1279 20.8496L16.0557 20.9189L16.0587 20.9218L16.1279 20.8496ZM15.7212 20.5508L15.675 20.6396L15.6793 20.6416L15.7212 20.5508ZM14.5425 20.4429V20.3429H14.4425V20.4429H14.5425ZM14.5425 25V25.1H14.6425V25H14.5425ZM11.8613 25H11.7613V25.1H11.8613V25ZM11.8613 13.0967V12.9967H11.7613V13.0967H11.8613ZM20.2534 17.4878L20.3474 17.5221L20.3475 17.5216L20.2534 17.4878ZM18.8672 19.1646L18.8147 19.0794L18.8141 19.0798L18.8672 19.1646ZM17.7715 19.646L17.7438 19.5499L17.6715 19.5707V19.646H17.7715ZM17.7715 19.6792H17.6715V19.7527L17.7417 19.7746L17.7715 19.6792ZM18.2861 19.9531L18.2253 20.0325L18.227 20.0338L18.2861 19.9531ZM19.2075 20.9243L19.1261 20.9825L19.1281 20.9851L19.2075 20.9243ZM19.5977 21.4805L19.5133 21.5342L19.5134 21.5343L19.5977 21.4805ZM14.5425 15.1055V15.0055H14.4425V15.1055H14.5425ZM14.5425 18.4175H14.4425V18.5175H14.5425V18.4175ZM17.0908 17.9194L17.1598 17.9918L17.1598 17.9918L17.0908 17.9194ZM21.8472 25V24.9H18.7676V25V25.1H21.8472V25ZM18.7676 25L18.8532 24.9483L17.0021 21.8853L16.9165 21.937L16.8309 21.9887L18.682 25.0517L18.7676 25ZM16.9165 21.937L17.0024 21.8859C16.8631 21.6518 16.729 21.4422 16.6001 21.2573L16.5181 21.3145L16.436 21.3716C16.5617 21.5519 16.6932 21.7574 16.8306 21.9882L16.9165 21.937ZM16.5181 21.3145L16.6001 21.2573C16.4698 21.0703 16.3356 20.9101 16.1971 20.7774L16.1279 20.8496L16.0587 20.9218C16.1859 21.0437 16.3118 21.1933 16.436 21.3716L16.5181 21.3145ZM16.1279 20.8496L16.2001 20.7804C16.0656 20.64 15.92 20.5324 15.7631 20.46L15.7212 20.5508L15.6793 20.6416C15.8101 20.702 15.9357 20.7936 16.0557 20.9188L16.1279 20.8496ZM15.7212 20.5508L15.7673 20.4621C15.6138 20.3822 15.4457 20.3429 15.2646 20.3429V20.4429V20.5429C15.4157 20.5429 15.5519 20.5754 15.6751 20.6395L15.7212 20.5508ZM15.2646 20.4429V20.3429H14.5425V20.4429V20.5429H15.2646V20.4429ZM14.5425 20.4429H14.4425V25H14.5425H14.6425V20.4429H14.5425ZM14.5425 25V24.9H11.8613V25V25.1H14.5425V25ZM11.8613 25H11.9613V13.0967H11.8613H11.7613V25H11.8613ZM11.8613 13.0967V13.1967H16.1113V13.0967V12.9967H11.8613V13.0967ZM16.1113 13.0967V13.1967C17.5461 13.1967 18.604 13.4652 19.3012 13.9861C19.993 14.503 20.3443 15.2794 20.3443 16.334H20.4443H20.5443C20.5443 15.2303 20.1735 14.3882 19.4209 13.8259C18.6739 13.2677 17.5652 12.9967 16.1113 12.9967V13.0967ZM20.4443 16.334H20.3443C20.3443 16.7387 20.2823 17.1117 20.1593 17.454L20.2534 17.4878L20.3475 17.5216C20.4791 17.1555 20.5443 16.7594 20.5443 16.334H20.4443ZM20.2534 17.4878L20.1595 17.4535C20.036 17.7917 19.8618 18.0972 19.6367 18.3705L19.7139 18.4341L19.7911 18.4977C20.0308 18.2066 20.2163 17.8812 20.3474 17.5221L20.2534 17.4878ZM19.7139 18.4341L19.6367 18.3705C19.4117 18.6437 19.138 18.8801 18.8147 19.0794L18.8672 19.1646L18.9197 19.2497C19.2604 19.0395 19.5512 18.7889 19.7911 18.4977L19.7139 18.4341ZM18.8672 19.1646L18.8141 19.0798C18.4962 19.2792 18.1396 19.436 17.7438 19.5499L17.7715 19.646L17.7991 19.7421C18.2113 19.6235 18.5852 19.4594 18.9203 19.2493L18.8672 19.1646ZM17.7715 19.646H17.6715V19.6792H17.7715H17.8715V19.646H17.7715ZM17.7715 19.6792L17.7417 19.7746C17.9062 19.8261 18.0674 19.9114 18.2253 20.0325L18.2861 19.9531L18.347 19.8738C18.1728 19.7402 17.9909 19.643 17.8013 19.5838L17.7715 19.6792ZM18.2861 19.9531L18.227 20.0338C18.3875 20.1515 18.5434 20.2911 18.6945 20.453L18.7676 20.3848L18.8407 20.3165C18.6819 20.1464 18.5168 19.9983 18.3453 19.8725L18.2861 19.9531ZM18.7676 20.3848L18.6945 20.453C18.8463 20.6157 18.9902 20.7921 19.1261 20.9824L19.2075 20.9243L19.2889 20.8662C19.1481 20.6691 18.9987 20.4859 18.8407 20.3165L18.7676 20.3848ZM19.2075 20.9243L19.1281 20.9851C19.2704 21.1711 19.3988 21.3542 19.5133 21.5342L19.5977 21.4805L19.682 21.4268C19.5641 21.2415 19.4324 21.0538 19.287 20.8636L19.2075 20.9243ZM19.5977 21.4805L19.5134 21.5343L21.7629 25.0539L21.8472 25L21.9314 24.9461L19.6819 21.4266L19.5977 21.4805ZM14.5425 15.1055H14.4425V18.4175H14.5425H14.6425V15.1055H14.5425ZM14.5425 18.4175V18.5175H15.7046V18.4175V18.3175H14.5425V18.4175ZM15.7046 18.4175V18.5175C16.3005 18.5175 16.789 18.345 17.1598 17.9918L17.0908 17.9194L17.0219 17.847C16.6954 18.158 16.2598 18.3175 15.7046 18.3175V18.4175ZM17.0908 17.9194L17.1598 17.9918C17.5342 17.635 17.7221 17.1909 17.7221 16.666H17.6221H17.5221C17.5221 17.1373 17.3558 17.5287 17.0218 17.847L17.0908 17.9194ZM17.6221 16.666H17.7221C17.7221 16.1252 17.5594 15.7031 17.2193 15.4189C16.8826 15.1375 16.3884 15.0055 15.7544 15.0055V15.1055V15.2055C16.3655 15.2055 16.8052 15.3335 17.091 15.5723C17.3735 15.8083 17.5221 16.1664 17.5221 16.666H17.6221ZM15.7544 15.1055V15.0055H14.5425V15.1055V15.2055H15.7544V15.1055Z" fill="#1C212A" mask="url(#path-10-outside-2_117_10)"/> <path d="M22.9533 7.44186C18.0575 4.945 14.6776 4.93463 9.13587 7.46188C9.02383 7.51297 8.92522 7.3469 9.02582 7.27589L16.4386 2.04336C16.475 2.01768 16.5239 2.01915 16.5587 2.04697L23.0739 7.25915C23.1696 7.33571 23.0624 7.49754 22.9533 7.44186Z" fill="currentColor"/> </svg>',
  'rs-press': '<svg class="dev-hints__icon" width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect y="10" width="34" height="16" rx="8" fill="currentColor"/> <rect x="9" y="26" width="16" height="4" fill="currentColor"/> <mask id="path-3-outside-1_2_241" maskUnits="userSpaceOnUse" x="12" y="11.5" width="11" height="14" fill="black"> <rect fill="white" x="12" y="11.5" width="11" height="14"/> <path d="M22.3472 24.5H19.2676L17.4165 21.437C17.2782 21.2046 17.1453 20.9971 17.0181 20.8145C16.8908 20.6318 16.7607 20.4769 16.6279 20.3496C16.5007 20.2168 16.3651 20.1172 16.2212 20.0508C16.0828 19.9788 15.9307 19.9429 15.7646 19.9429H15.0425V24.5H12.3613V12.5967H16.6113C19.5 12.5967 20.9443 13.6758 20.9443 15.834C20.9443 16.249 20.8807 16.6336 20.7534 16.9878C20.6261 17.3364 20.4463 17.6519 20.2139 17.9341C19.9814 18.2163 19.6992 18.4598 19.3672 18.6646C19.0407 18.8693 18.6755 19.0298 18.2715 19.146V19.1792C18.4486 19.2345 18.6201 19.3258 18.7861 19.4531C18.9521 19.5749 19.1126 19.7188 19.2676 19.8848C19.4225 20.0508 19.5692 20.2306 19.7075 20.4243C19.8514 20.6125 19.9814 20.7979 20.0977 20.9805L22.3472 24.5ZM15.0425 14.6055V17.9175H16.2046C16.7801 17.9175 17.2422 17.7515 17.5908 17.4194C17.945 17.0819 18.1221 16.6641 18.1221 16.166C18.1221 15.1257 17.4995 14.6055 16.2544 14.6055H15.0425Z"/> </mask> <path d="M22.3472 24.5H19.2676L17.4165 21.437C17.2782 21.2046 17.1453 20.9971 17.0181 20.8145C16.8908 20.6318 16.7607 20.4769 16.6279 20.3496C16.5007 20.2168 16.3651 20.1172 16.2212 20.0508C16.0828 19.9788 15.9307 19.9429 15.7646 19.9429H15.0425V24.5H12.3613V12.5967H16.6113C19.5 12.5967 20.9443 13.6758 20.9443 15.834C20.9443 16.249 20.8807 16.6336 20.7534 16.9878C20.6261 17.3364 20.4463 17.6519 20.2139 17.9341C19.9814 18.2163 19.6992 18.4598 19.3672 18.6646C19.0407 18.8693 18.6755 19.0298 18.2715 19.146V19.1792C18.4486 19.2345 18.6201 19.3258 18.7861 19.4531C18.9521 19.5749 19.1126 19.7188 19.2676 19.8848C19.4225 20.0508 19.5692 20.2306 19.7075 20.4243C19.8514 20.6125 19.9814 20.7979 20.0977 20.9805L22.3472 24.5ZM15.0425 14.6055V17.9175H16.2046C16.7801 17.9175 17.2422 17.7515 17.5908 17.4194C17.945 17.0819 18.1221 16.6641 18.1221 16.166C18.1221 15.1257 17.4995 14.6055 16.2544 14.6055H15.0425Z" fill="#1C212A"/> <path d="M22.3472 24.5V24.6H22.5298L22.4314 24.4461L22.3472 24.5ZM19.2676 24.5L19.182 24.5517L19.2112 24.6H19.2676V24.5ZM17.4165 21.437L17.3306 21.4882L17.3309 21.4887L17.4165 21.437ZM16.6279 20.3496L16.5557 20.4189L16.5587 20.4218L16.6279 20.3496ZM16.2212 20.0508L16.175 20.1396L16.1793 20.1416L16.2212 20.0508ZM15.0425 19.9429V19.8429H14.9425V19.9429H15.0425ZM15.0425 24.5V24.6H15.1425V24.5H15.0425ZM12.3613 24.5H12.2613V24.6H12.3613V24.5ZM12.3613 12.5967V12.4967H12.2613V12.5967H12.3613ZM20.7534 16.9878L20.8474 17.0221L20.8475 17.0216L20.7534 16.9878ZM19.3672 18.6646L19.3147 18.5794L19.3141 18.5798L19.3672 18.6646ZM18.2715 19.146L18.2438 19.0499L18.1715 19.0707V19.146H18.2715ZM18.2715 19.1792H18.1715V19.2527L18.2417 19.2746L18.2715 19.1792ZM18.7861 19.4531L18.7253 19.5325L18.727 19.5338L18.7861 19.4531ZM19.7075 20.4243L19.6261 20.4825L19.6281 20.4851L19.7075 20.4243ZM20.0977 20.9805L20.0133 21.0342L20.0134 21.0343L20.0977 20.9805ZM15.0425 14.6055V14.5055H14.9425V14.6055H15.0425ZM15.0425 17.9175H14.9425V18.0175H15.0425V17.9175ZM17.5908 17.4194L17.6598 17.4918L17.6598 17.4918L17.5908 17.4194ZM22.3472 24.4H19.2676V24.6H22.3472V24.4ZM19.3532 24.4483L17.5021 21.3853L17.3309 21.4887L19.182 24.5517L19.3532 24.4483ZM17.5024 21.3859C17.3631 21.1518 17.229 20.9422 17.1001 20.7573L16.936 20.8716C17.0617 21.0519 17.1932 21.2574 17.3306 21.4882L17.5024 21.3859ZM17.1001 20.7573C16.9698 20.5703 16.8356 20.4101 16.6971 20.2774L16.5587 20.4218C16.6859 20.5437 16.8118 20.6933 16.936 20.8716L17.1001 20.7573ZM16.7001 20.2804C16.5656 20.14 16.42 20.0324 16.2631 19.96L16.1793 20.1416C16.3101 20.202 16.4357 20.2936 16.5557 20.4188L16.7001 20.2804ZM16.2673 19.9621C16.1138 19.8822 15.9457 19.8429 15.7646 19.8429V20.0429C15.9157 20.0429 16.0519 20.0754 16.1751 20.1395L16.2673 19.9621ZM15.7646 19.8429H15.0425V20.0429H15.7646V19.8429ZM14.9425 19.9429V24.5H15.1425V19.9429H14.9425ZM15.0425 24.4H12.3613V24.6H15.0425V24.4ZM12.4613 24.5V12.5967H12.2613V24.5H12.4613ZM12.3613 12.6967H16.6113V12.4967H12.3613V12.6967ZM16.6113 12.6967C18.0461 12.6967 19.104 12.9652 19.8012 13.4861C20.493 14.003 20.8443 14.7794 20.8443 15.834H21.0443C21.0443 14.7303 20.6735 13.8882 19.9209 13.3259C19.1739 12.7677 18.0652 12.4967 16.6113 12.4967V12.6967ZM20.8443 15.834C20.8443 16.2387 20.7823 16.6117 20.6593 16.954L20.8475 17.0216C20.9791 16.6555 21.0443 16.2594 21.0443 15.834H20.8443ZM20.6595 16.9535C20.536 17.2917 20.3618 17.5972 20.1367 17.8705L20.2911 17.9977C20.5308 17.7066 20.7163 17.3812 20.8474 17.0221L20.6595 16.9535ZM20.1367 17.8705C19.9117 18.1437 19.638 18.3801 19.3147 18.5794L19.4197 18.7497C19.7604 18.5395 20.0512 18.2889 20.2911 17.9977L20.1367 17.8705ZM19.3141 18.5798C18.9962 18.7792 18.6396 18.936 18.2438 19.0499L18.2991 19.2421C18.7113 19.1235 19.0852 18.9594 19.4203 18.7493L19.3141 18.5798ZM18.1715 19.146V19.1792H18.3715V19.146H18.1715ZM18.2417 19.2746C18.4062 19.3261 18.5674 19.4114 18.7253 19.5325L18.847 19.3738C18.6728 19.2402 18.4909 19.143 18.3013 19.0838L18.2417 19.2746ZM18.727 19.5338C18.8875 19.6515 19.0434 19.7911 19.1945 19.953L19.3407 19.8165C19.1819 19.6464 19.0168 19.4983 18.8453 19.3725L18.727 19.5338ZM19.1945 19.953C19.3463 20.1157 19.4902 20.2921 19.6261 20.4824L19.7889 20.3662C19.6481 20.1691 19.4987 19.9859 19.3407 19.8165L19.1945 19.953ZM19.6281 20.4851C19.7704 20.6711 19.8988 20.8542 20.0133 21.0342L20.182 20.9268C20.0641 20.7415 19.9324 20.5538 19.787 20.3636L19.6281 20.4851ZM20.0134 21.0343L22.2629 24.5539L22.4314 24.4461L20.1819 20.9266L20.0134 21.0343ZM14.9425 14.6055V17.9175H15.1425V14.6055H14.9425ZM15.0425 18.0175H16.2046V17.8175H15.0425V18.0175ZM16.2046 18.0175C16.8005 18.0175 17.289 17.845 17.6598 17.4918L17.5219 17.347C17.1954 17.658 16.7598 17.8175 16.2046 17.8175V18.0175ZM17.6598 17.4918C18.0342 17.135 18.2221 16.6909 18.2221 16.166H18.0221C18.0221 16.6373 17.8558 17.0287 17.5218 17.347L17.6598 17.4918ZM18.2221 16.166C18.2221 15.6252 18.0594 15.2031 17.7193 14.9189C17.3826 14.6375 16.8884 14.5055 16.2544 14.5055V14.7055C16.8655 14.7055 17.3052 14.8335 17.591 15.0723C17.8735 15.3083 18.0221 15.6664 18.0221 16.166H18.2221ZM16.2544 14.5055H15.0425V14.7055H16.2544V14.5055Z" fill="#1C212A" mask="url(#path-3-outside-1_2_241)"/> <path d="M17 10L20.4641 5.5H13.5359L17 10Z" fill="currentColor"/> </svg>',
  'rt': '<svg class="dev-hints__icon" viewBox="-2 -6 37 44" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M2.2032 0H26.0359C27.4846 0 28.4606 1.50178 28.0296 2.88485C24.959 12.7377 28.2732 22.5714 31.3912 28.152C32.0901 29.403 31.4368 31.0564 30.0249 31.3014C8.41418 35.0499 1.25383 22.8169 0.397533 15.9295C-0.248768 10.7312 0.0389252 4.72824 0.248299 1.79756C0.321392 0.774478 1.17751 0 2.2032 0Z" fill="currentColor"/> <mask id="path-2-outside-1_2_174" maskUnits="userSpaceOnUse" x="4.75" y="5" fill="black"> <rect fill="white" x="4.75" y="5"/> <path d="M15.0972 18H12.0176L10.1665 14.937C10.0282 14.7046 9.89535 14.4971 9.76807 14.3145C9.64079 14.1318 9.51074 13.9769 9.37793 13.8496C9.25065 13.7168 9.11507 13.6172 8.97119 13.5508C8.83285 13.4788 8.68066 13.4429 8.51465 13.4429H7.79248V18H5.11133V6.09668H9.36133C12.25 6.09668 13.6943 7.17578 13.6943 9.33398C13.6943 9.74902 13.6307 10.1336 13.5034 10.4878C13.3761 10.8364 13.1963 11.1519 12.9639 11.4341C12.7314 11.7163 12.4492 11.9598 12.1172 12.1646C11.7907 12.3693 11.4255 12.5298 11.0215 12.646V12.6792C11.1986 12.7345 11.3701 12.8258 11.5361 12.9531C11.7021 13.0749 11.8626 13.2188 12.0176 13.3848C12.1725 13.5508 12.3192 13.7306 12.4575 13.9243C12.6014 14.1125 12.7314 14.2979 12.8477 14.4805L15.0972 18ZM7.79248 8.10547V11.4175H8.95459C9.53011 11.4175 9.99219 11.2515 10.3408 10.9194C10.695 10.5819 10.8721 10.1641 10.8721 9.66602C10.8721 8.62565 10.2495 8.10547 9.00439 8.10547H7.79248ZM24.228 8.27979H20.833V18H18.1436V8.27979H14.7651V6.09668H24.228V8.27979Z"/> </mask> <path d="M15.0972 18H12.0176L10.1665 14.937C10.0282 14.7046 9.89535 14.4971 9.76807 14.3145C9.64079 14.1318 9.51074 13.9769 9.37793 13.8496C9.25065 13.7168 9.11507 13.6172 8.97119 13.5508C8.83285 13.4788 8.68066 13.4429 8.51465 13.4429H7.79248V18H5.11133V6.09668H9.36133C12.25 6.09668 13.6943 7.17578 13.6943 9.33398C13.6943 9.74902 13.6307 10.1336 13.5034 10.4878C13.3761 10.8364 13.1963 11.1519 12.9639 11.4341C12.7314 11.7163 12.4492 11.9598 12.1172 12.1646C11.7907 12.3693 11.4255 12.5298 11.0215 12.646V12.6792C11.1986 12.7345 11.3701 12.8258 11.5361 12.9531C11.7021 13.0749 11.8626 13.2188 12.0176 13.3848C12.1725 13.5508 12.3192 13.7306 12.4575 13.9243C12.6014 14.1125 12.7314 14.2979 12.8477 14.4805L15.0972 18ZM7.79248 8.10547V11.4175H8.95459C9.53011 11.4175 9.99219 11.2515 10.3408 10.9194C10.695 10.5819 10.8721 10.1641 10.8721 9.66602C10.8721 8.62565 10.2495 8.10547 9.00439 8.10547H7.79248ZM24.228 8.27979H20.833V18H18.1436V8.27979H14.7651V6.09668H24.228V8.27979Z" fill="#1C212A"/> <path d="M15.0972 18V18.1H15.2798L15.1814 17.9461L15.0972 18ZM12.0176 18L11.932 18.0517L11.9612 18.1H12.0176V18ZM10.1665 14.937L10.0806 14.9882L10.0809 14.9887L10.1665 14.937ZM9.37793 13.8496L9.30567 13.9189L9.30874 13.9218L9.37793 13.8496ZM8.97119 13.5508L8.925 13.6396L8.92929 13.6416L8.97119 13.5508ZM7.79248 13.4429V13.3429H7.69248V13.4429H7.79248ZM7.79248 18V18.1H7.89248V18H7.79248ZM5.11133 18H5.01133V18.1H5.11133V18ZM5.11133 6.09668V5.99668H5.01133V6.09668H5.11133ZM13.5034 10.4878L13.5974 10.5221L13.5975 10.5216L13.5034 10.4878ZM12.1172 12.1646L12.0647 12.0794L12.0641 12.0798L12.1172 12.1646ZM11.0215 12.646L10.9938 12.5499L10.9215 12.5707V12.646H11.0215ZM11.0215 12.6792H10.9215V12.7527L10.9917 12.7746L11.0215 12.6792ZM11.5361 12.9531L11.4753 13.0325L11.477 13.0338L11.5361 12.9531ZM12.4575 13.9243L12.3761 13.9825L12.3781 13.9851L12.4575 13.9243ZM12.8477 14.4805L12.7633 14.5342L12.7634 14.5343L12.8477 14.4805ZM7.79248 8.10547V8.00547H7.69248V8.10547H7.79248ZM7.79248 11.4175H7.69248V11.5175H7.79248V11.4175ZM10.3408 10.9194L10.4098 10.9918L10.4098 10.9918L10.3408 10.9194ZM15.0972 17.9H12.0176V18.1H15.0972V17.9ZM12.1032 17.9483L10.2521 14.8853L10.0809 14.9887L11.932 18.0517L12.1032 17.9483ZM10.2524 14.8859C10.1131 14.6518 9.97901 14.4422 9.85011 14.2573L9.68603 14.3716C9.81168 14.5519 9.9432 14.7574 10.0806 14.9882L10.2524 14.8859ZM9.85011 14.2573C9.71981 14.0703 9.58557 13.9101 9.44712 13.7774L9.30874 13.9218C9.43591 14.0437 9.56177 14.1933 9.68603 14.3716L9.85011 14.2573ZM9.45013 13.7804C9.31557 13.64 9.17001 13.5324 9.0131 13.46L8.92929 13.6416C9.06013 13.702 9.18574 13.7936 9.30573 13.9188L9.45013 13.7804ZM9.01733 13.4621C8.86381 13.3822 8.69566 13.3429 8.51465 13.3429V13.5429C8.66567 13.5429 8.80188 13.5754 8.92506 13.6395L9.01733 13.4621ZM8.51465 13.3429H7.79248V13.5429H8.51465V13.3429ZM7.69248 13.4429V18H7.89248V13.4429H7.69248ZM7.79248 17.9H5.11133V18.1H7.79248V17.9ZM5.21133 18V6.09668H5.01133V18H5.21133ZM5.11133 6.19668H9.36133V5.99668H5.11133V6.19668ZM9.36133 6.19668C10.7961 6.19668 11.854 6.46518 12.5512 6.98612C13.243 7.50296 13.5943 8.27943 13.5943 9.33398H13.7943C13.7943 8.23034 13.4235 7.38815 12.6709 6.8259C11.9239 6.26773 10.8152 5.99668 9.36133 5.99668V6.19668ZM13.5943 9.33398C13.5943 9.73868 13.5323 10.1117 13.4093 10.454L13.5975 10.5216C13.7291 10.1555 13.7943 9.75937 13.7943 9.33398H13.5943ZM13.4095 10.4535C13.286 10.7917 13.1118 11.0972 12.8867 11.3705L13.0411 11.4977C13.2808 11.2066 13.4663 10.8812 13.5974 10.5221L13.4095 10.4535ZM12.8867 11.3705C12.6617 11.6437 12.388 11.8801 12.0647 12.0794L12.1697 12.2497C12.5104 12.0395 12.8012 11.7889 13.0411 11.4977L12.8867 11.3705ZM12.0641 12.0798C11.7462 12.2792 11.3896 12.436 10.9938 12.5499L11.0491 12.7421C11.4613 12.6235 11.8352 12.4594 12.1703 12.2493L12.0641 12.0798ZM10.9215 12.646V12.6792H11.1215V12.646H10.9215ZM10.9917 12.7746C11.1562 12.8261 11.3174 12.9114 11.4753 13.0325L11.597 12.8738C11.4228 12.7402 11.2409 12.643 11.0513 12.5838L10.9917 12.7746ZM11.477 13.0338C11.6375 13.1515 11.7934 13.2911 11.9445 13.453L12.0907 13.3165C11.9319 13.1464 11.7668 12.9983 11.5953 12.8725L11.477 13.0338ZM11.9445 13.453C12.0963 13.6157 12.2402 13.7921 12.3761 13.9824L12.5389 13.8662C12.3981 13.6691 12.2487 13.4859 12.0907 13.3165L11.9445 13.453ZM12.3781 13.9851C12.5204 14.1711 12.6488 14.3542 12.7633 14.5342L12.932 14.4268C12.8141 14.2415 12.6824 14.0538 12.537 13.8636L12.3781 13.9851ZM12.7634 14.5343L15.0129 18.0539L15.1814 17.9461L12.9319 14.4266L12.7634 14.5343ZM7.69248 8.10547V11.4175H7.89248V8.10547H7.69248ZM7.79248 11.5175H8.95459V11.3175H7.79248V11.5175ZM8.95459 11.5175C9.55045 11.5175 10.039 11.345 10.4098 10.9918L10.2719 10.847C9.94535 11.158 9.50977 11.3175 8.95459 11.3175V11.5175ZM10.4098 10.9918C10.7842 10.635 10.9721 10.1909 10.9721 9.66602H10.7721C10.7721 10.1373 10.6058 10.5287 10.2718 10.847L10.4098 10.9918ZM10.9721 9.66602C10.9721 9.12523 10.8094 8.70307 10.4693 8.41887C10.1326 8.13754 9.63843 8.00547 9.00439 8.00547V8.20547C9.61548 8.20547 10.0552 8.33349 10.341 8.57234C10.6235 8.80832 10.7721 9.16644 10.7721 9.66602H10.9721ZM9.00439 8.00547H7.79248V8.20547H9.00439V8.00547ZM24.228 8.27979V8.37979H24.328V8.27979H24.228ZM20.833 8.27979V8.17979H20.733V8.27979H20.833ZM20.833 18V18.1H20.933V18H20.833ZM18.1436 18H18.0436V18.1H18.1436V18ZM18.1436 8.27979H18.2436V8.17979H18.1436V8.27979ZM14.7651 8.27979H14.6651V8.37979H14.7651V8.27979ZM14.7651 6.09668V5.99668H14.6651V6.09668H14.7651ZM24.228 6.09668H24.328V5.99668H24.228V6.09668ZM24.228 8.17979H20.833V8.37979H24.228V8.17979ZM20.733 8.27979V18H20.933V8.27979H20.733ZM20.833 17.9H18.1436V18.1H20.833V17.9ZM18.2436 18V8.27979H18.0436V18H18.2436ZM18.1436 8.17979H14.7651V8.37979H18.1436V8.17979ZM14.8651 8.27979V6.09668H14.6651V8.27979H14.8651ZM14.7651 6.19668H24.228V5.99668H14.7651V6.19668ZM24.128 6.09668V8.27979H24.328V6.09668H24.128Z" fill="#1C212A" mask="url(#path-2-outside-1_2_174)"/> </svg>',
  'start': '<svg class="dev-hints__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"> <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2"/> <rect x="7" y="9" width="10" height="1.4" rx="0.7" fill="currentColor"/> <rect x="7" y="12.3" width="10" height="1.4" rx="0.7" fill="currentColor"/> <rect x="7" y="15.6" width="10" height="1.4" rx="0.7" fill="currentColor"/> </svg>',
  'x': '<svg class="dev-hints__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"> <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2"/> <text x="12" y="16.5" text-anchor="middle" font-family="\'Segoe UI\',Arial,sans-serif" font-size="12" font-weight="700" fill="currentColor">X</text> </svg>',
  'y': '<svg class="dev-hints__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"> <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2"/> <text x="12" y="16.5" text-anchor="middle" font-family="\'Segoe UI\',Arial,sans-serif" font-size="12" font-weight="700" fill="currentColor">Y</text> </svg>',
};
window.__lensGPIcons = GP_SVG;
function gpIcon(name) {
  if (GP_SVG[name]) return GP_SVG[name];
  return `<img src="./assets/icons/btn-${name}.svg" class="dev-hints__icon" alt="${name}">`;
}

function updateDevHints() {
  const el = document.getElementById('dev-hints-list');
  if (!el) return;
  const st = window.__lensGamepadState;
  const devEls = st?.devEls || [];
  const devIdx = st?.devIdx ?? 0;
  const cur = devEls[devIdx];
  const navCount = document.querySelectorAll('#dev-nav .dev-nav__tab').length;
  const isNav = devIdx < navCount;

  const rsHint = [[gpIcon('rs')], '翻页'];
  const resetConfirm = st?.resetConfirm;
  const xHint = resetConfirm ? [[gpIcon('x')], '确认复位？'] : [[gpIcon('x')], '复位全部'];

  let hints;
  if (isNav) {
    const exitHint = [[gpIcon('b')], '关闭'];
    hints = [
      [[gpIcon('dpad-up'), gpIcon('dpad-down')], '切换标签'],
      [[gpIcon('dpad-right')], '进入内容'],
      [[gpIcon('lb'), gpIcon('rb')], '切换标签'],
      [[gpIcon('a')], '选择'],
      xHint, rsHint,
      exitHint,
    ];
  } else if (cur && cur._slider) {
    hints = [
      [[gpIcon('dpad-up'), gpIcon('dpad-down')], '切换控件'],
      [[gpIcon('dpad-left'), gpIcon('dpad-right')], '调整数值'],
      [[gpIcon('a')], '复位'],
      [[gpIcon('lb'), gpIcon('rb')], '切换标签'],
      xHint, rsHint,
      [[gpIcon('b')], '返回'],
    ];
  } else if (cur && cur._color) {
    const lrLabel = cur._alpha ? '调整透明度' : '调整色相';
    hints = [
      [[gpIcon('dpad-up'), gpIcon('dpad-down')], '切换控件'],
      [[gpIcon('dpad-left'), gpIcon('dpad-right')], lrLabel],
      [[gpIcon('a')], '重置'],
      [[gpIcon('lb'), gpIcon('rb')], '切换标签'],
      xHint, rsHint,
      [[gpIcon('b')], '返回'],
    ];
  } else if (cur && cur._text) {
    hints = [
      [[gpIcon('dpad-up'), gpIcon('dpad-down')], '切换控件'],
      [[gpIcon('dpad-left'), gpIcon('dpad-right')], '切换预设'],
      [[gpIcon('lb'), gpIcon('rb')], '切换标签'],
      xHint, rsHint,
      [[gpIcon('b')], '返回'],
    ];
  } else {
    const isZone = cur?.dataset?.gpZone;
    hints = [
      [[gpIcon('dpad-up'), gpIcon('dpad-down')], '切换控件'],
      [[gpIcon('dpad-left')], '返回标签'],
      [[gpIcon('lb'), gpIcon('rb')], '切换标签'],
      [[gpIcon('a')], isZone ? '放大' : '点击'],
      xHint, rsHint,
      [[gpIcon('b')], '返回'],
    ];
  }

  el.innerHTML = hints.map(([icons, desc]) =>
    `<div class="dev-hints__row"><span class="dev-hints__btn">${icons.join('')}</span><span class="dev-hints__desc">${desc}</span></div>`
  ).join('');
}

// ═══════════════════════════════════════════
// Group 4: 预设
// ═══════════════════════════════════════════

function getPresets() {
  try { const d = localStorage.getItem(PRESETS_KEY); return d ? JSON.parse(d) : []; }
  catch { return []; }
}

function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

let _autoSaveTimer = null;

function autoSaveSession() {
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    _autoSaveTimer = null;
    try {
      const vars = getCurrentCSSSnapshot();
      localStorage.setItem(SESSION_KEY, JSON.stringify(vars));
    } catch {}
  }, 200);
}

function getCurrentCSSSnapshot() {
  const style = getComputedStyle(document.documentElement);
  const vars = {};
  CSS_VAR_KEYS.forEach(k => { vars[k] = style.getPropertyValue(k).trim(); });
  return vars;
}

function savePreset(name) {
  if (!name || !name.trim()) return;
  const presets = getPresets();
  const vars = getCurrentCSSSnapshot();
  presets.push({ id: Date.now().toString(36), name: name.trim(), builtin: false, vars });
  savePresets(presets);
  renderPresetsGroup();
}

function loadPreset(preset) {
  if (!preset || !preset.vars) return;
  // 取消所有待处理的 scheduleApplyEffects（防止竞态覆盖预设值）
  if (window.__lensCancelApplyEffects) window.__lensCancelApplyEffects();
  // 清除预设未包含的 hero/特殊变量（防止旧值残留导致预设外观错误）
  const HERO_KEYS = ['--hero-grad-top','--hero-grad-mid','--hero-grad-bot','--corner-logo-color','--hero-subtitle-color','--hero-line-color','--dev-panel-bg'];
  HERO_KEYS.forEach(k => {
    if (!(k in preset.vars)) document.documentElement.style.removeProperty(k);
  });
  // 清除分区玻璃覆盖并允许 applyDirectStyles 重设（预设通过 generateFullCSS 重新派生默认值）
  window.__lensZoneGlassDirty = true;
  ZONE_GLASS_VARS.forEach(k => document.documentElement.style.removeProperty(k));
  // 设置 CSS 变量（用于面板控件同步）
  Object.entries(preset.vars).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
  // 清理注入样式
  ['dev-anim-speed','dev-anim-disable','dev-shadow-style','dev-gap-style','dev-heading-style'].forEach(id => {
    const s = document.getElementById(id); if (s) s.remove();
  });
  // 记录激活预设（必须在 applySpecialVarEffects 之前，确保 COLOR_PRESETS ID 匹配拿到正确的 warm/glassBlur）
  localStorage.setItem(ACTIVE_PRESET_KEY, preset.id);
  // 液态玻璃模式：设置标志位让 generateFullCSS 直接输出透明面板+backdrop-filter
  window.__lensLiquidGlass = (preset.id === '__liquid-glass__');
  if (window.__lensLiquidGlass) {
    enableLiquidGlassPanels(); // 创建 SVG 滤镜
  } else if (isLiquidGlassPanelsActive()) {
    disableLiquidGlassPanels(); // 移除 SVG 滤镜
  }
  // 更新颜色系统（零 var() CSS 注入）—— 内部检查 __lensLiquidGlass 决定面板样式
  applySpecialVarEffects();
  syncVisualControls();
  renderPresetsGroup();
  autoSaveSession();
  // 同步 toggle UI
  const lgToggle = document.getElementById('dev-toggle-liquid-glass');
  if (lgToggle) { lgToggle.classList.toggle('dev-toggle--on', window.__lensLiquidGlass); }

  // 重建卡片真实渲染器（强调色已变更）
  const visualEl = document.getElementById('dev-group-visual');
  if (visualEl && visualEl.dataset.rendered) {
    disposeCardPreviews();
    updateAnimPreview(visualEl);
    requestAnimationFrame(() => initCardPreviews(visualEl));
  }
}

function deletePreset(id) {
  let presets = getPresets();
  presets = presets.filter(p => p.id !== id);
  savePresets(presets);
  renderPresetsGroup();
}

function exportPreset(preset) {
  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${preset.name}.lens-preset.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importPreset() {
  try {
    const selected = api
      ? await api.invoke('dialog:open', { filters: [{ name: '预设', extensions: ['json'] }] })
      : (await import('@tauri-apps/plugin-dialog')).open({ filters: [{ name: '预设', extensions: ['json'] }], multiple: false });
    if (selected) {
      const content = api
        ? (await api.invoke('fs:readFile', { path: selected })).toString()
        : await (await import('@tauri-apps/api/core')).invoke('read_text_file', { path: selected });
      const preset = JSON.parse(content);
      if (!preset.vars) throw new Error('无效预设格式');
      const presets = getPresets();
      preset.id = Date.now().toString(36);
      preset.builtin = false;
      presets.push(preset);
      savePresets(presets);
      renderPresetsGroup();
    }
  } catch (e) {
    // 回退方案：使用 HTML input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const preset = JSON.parse(reader.result);
          if (!preset.vars) throw new Error('无效预设格式');
          const presets = getPresets();
          preset.id = Date.now().toString(36);
          preset.builtin = false;
          presets.push(preset);
          savePresets(presets);
          renderPresetsGroup();
        } catch (err) { console.warn('导入预设失败:', err); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

function syncVisualControls() {
  const el = document.getElementById('dev-group-visual');
  if (!el || !el.dataset.rendered) return;
  const style = getComputedStyle(document.documentElement);
  syncAllColorTriggers(el);
  el.querySelectorAll('.dev-slider[data-css]').forEach(s => {
    const raw = style.getPropertyValue(s.dataset.css).trim();
    const calcMatch = raw.match(/^calc\(([\d.]+)px/);
    const varMatch = raw.match(/^var\([^,]+,\s*([\d.]+)px/);
    const num = calcMatch ? parseFloat(calcMatch[1]) : (varMatch ? parseFloat(varMatch[1]) : (parseFloat(raw) || 0));
    s.value = num;
    const key = s.dataset.css;
    const display = s.parentElement.querySelector(`[data-display="${key}"]`);
    if (display) {
      const unit = display.dataset.unit || '';
      const d = parseInt(display.dataset.decimals) || 0;
      display.textContent = num.toFixed(d) + unit;
    }
  });
  // 文本输入同步
  el.querySelectorAll('.dev-input--text[data-css-text]').forEach(input => {
    input.value = style.getPropertyValue(input.dataset.cssText).trim();
  });
  // 按钮组同步
  el.querySelectorAll('[data-css-btn]').forEach(btn => {
    const val = style.getPropertyValue(btn.dataset.cssBtn).trim();
    btn.classList.toggle('dev-btn--active', btn.dataset.value === val);
  });
  // 字体预设按钮同步（用 important 击败 generateFullCSS 的 !important）
  el.querySelectorAll('[data-font-preset]').forEach(btn => {
    const key = btn.dataset.fontPreset;
    const val = style.getPropertyValue(key).trim();
    const presetId = btn.dataset.presetId;
    const category = key.replace('--font-', '');
    const presets = FONT_FAMILY_PRESETS[category] || [];
    const match = presets.find(p => p[2] === val);
    const isActive = (presetId === '_custom_' && !match) || (match && match[0] === presetId);
    btn.classList.toggle('dev-btn--active', isActive);
  });
  // 字体自定义输入同步
  el.querySelectorAll('[data-css-text]').forEach(input => {
    const key = input.dataset.cssText;
    if (key && key.startsWith('--font-')) {
      const val = style.getPropertyValue(key).trim();
      const category = key.replace('--font-', '');
      const presets = FONT_FAMILY_PRESETS[category] || [];
      const match = presets.some(p => p[2] === val);
      input.style.display = match ? 'none' : '';
      input.value = val;
    }
  });
  // 新控件同步：卡片毛玻璃颜色
  ['--card-bg','--card-hover-bg'].forEach(key => {
    syncColorTrigger(key);
  });
  // 新控件同步：间距/阴影/标题缩放/行高/区块间距滑块
  ['--gap-scale','--shadow-depth','--font-scale-heading','--line-spacing','--section-gap'].forEach(key => {
    const slider = el.querySelector(`.dev-slider[data-css="${key}"]`);
    if (slider) {
      const raw = style.getPropertyValue(key).trim();
      const num = parseFloat(raw) || 0;
      slider.value = num;
      const display = slider.parentElement.querySelector(`[data-display="${key}"]`);
      if (display) {
        const unit = display.dataset.unit || '';
        const d = parseInt(display.dataset.decimals) || 0;
        display.textContent = num.toFixed(d) + unit;
      }
    }
  });
  // 同步 Hero 标签页控件
  const heroEl = document.getElementById('dev-group-hero');
  if (heroEl && heroEl.dataset.rendered) {
    const hStyle = getComputedStyle(document.documentElement);
    syncAllColorTriggers(heroEl);
  }
  // 着色器/极光预览跟随预设更新
  updateAuroraColors();
  updateAnimPreview(el);
}

function renderPresetsGroup() {
  const el = document.getElementById('dev-group-presets');
  if (!el) return;

  const presets = getPresets();
  const activeId = localStorage.getItem(ACTIVE_PRESET_KEY);
  const allPresets = [...BUILTIN_PRESETS, ...presets];

  let html = `
    <div class="dev-section">
      <div class="dev-section__title">内置预设</div>
      ${BUILTIN_PRESETS.map(p => makePresetCard(p, activeId, false)).join('')}
    </details>
    </div>
  `;

  // 液态玻璃预设专属配置
  if (activeId === '__liquid-glass__') {
    html += `
    <div class="dev-section" id="lg-preset-config">
      <div class="dev-section__title">液态玻璃配置</div>
      ${lgSlider('面板模糊', 'panelBlur', 2, 40, 6, 1, 'px')}
      ${lgSlider('面板折射', 'panelRefraction', 0, 250, 150, 2, '')}
      ${lgSlider('面板饱和度', 'panelSaturate', 0.5, 3, 1.3, 0.1, '')}
      ${lgSlider('玻璃雾度', 'panelBgAlpha', 0, 0.08, 0, 0.002, '')}
      ${lgSlider('边框透明度', 'panelBorderAlpha', 0, 0.4, 0.12, 0.01, '')}
      ${lgSlider('高光强度', 'panelHighlight', 0, 0.2, 0.08, 0.005, '')}
      ${lgSlider('阴影深度', 'panelShadowAlpha', 0, 0.6, 0.3, 0.01, '')}
    </div>
    `;
  }

  html += `
    <div class="dev-section">
      <div class="dev-section__title">保存预设</div>
      <div class="dev-row">
        <input class="dev-input" id="dev-preset-name" placeholder="预设名称..." maxlength="30">
        <button class="dev-btn dev-btn--accent" id="dev-preset-save">保存</button>
      </div>
    </div>
  `;

  if (presets.length > 0) {
    html += `
      <div class="dev-section">
        <div class="dev-section__title">我的预设</div>
        ${presets.map(p => makePresetCard(p, activeId, true)).join('')}
      </div>
    `;
  }

  html += `
    <div class="dev-section">
      <div class="dev-section__title">导入/导出</div>
      <div class="dev-row" style="gap:8px;flex-wrap:wrap">
        <button class="dev-btn" id="dev-preset-import">导入文件</button>
        <button class="dev-btn" id="dev-preset-export-all">导出全部</button>
        <button class="dev-btn dev-btn--danger" id="dev-preset-reset">重置全部</button>
      </div>
    </div>
  `;

  // 仅更新动态内容，保留 section 结构
  el.innerHTML = html;

  // 液态玻璃预设配置滑块事件（委托）
  el.querySelectorAll('#lg-preset-config [data-lg]').forEach(sl => {
    sl.addEventListener('input', () => {
      const val = parseFloat(sl.value);
      const d = sl.parentElement.querySelector('.dev-row__value');
      if (d) d.textContent = val;
      const name = sl.dataset.lg;
      if (name === 'panelBlur') updatePanelBlur(val);
      else if (name === 'panelSaturate') updatePanelSaturate(val);
      else if (name === 'panelRefraction') updatePanelRefraction(val);
      else if (name === 'panelBorderAlpha') document.documentElement.style.setProperty('--lg-panel-border-alpha', val);
      else if (name === 'panelShadowAlpha') document.documentElement.style.setProperty('--lg-panel-shadow-alpha', val);
      else if (name === 'panelBgAlpha') document.documentElement.style.setProperty('--lg-panel-bg-alpha', val);
      else if (name === 'panelHighlight') document.documentElement.style.setProperty('--lg-panel-highlight', val);
    });
  });
  // 同步面板 slider 值为当前 CSS 变量
  const root = document.documentElement.style;
  const _sync = (sel, prop) => { const sl = el.querySelector('[data-lg="' + sel + '"]'); if (sl) { const v = parseFloat(root.getPropertyValue(prop)); if (!isNaN(v)) sl.value = v; } };
  _sync('panelBlur', '--lg-panel-blur'); _sync('panelRefraction', '--lg-panel-refraction');
  _sync('panelSaturate', '--lg-panel-saturate'); _sync('panelBgAlpha', '--lg-panel-bg-alpha');
  _sync('panelBorderAlpha', '--lg-panel-border-alpha'); _sync('panelHighlight', '--lg-panel-highlight');
  _sync('panelShadowAlpha', '--lg-panel-shadow-alpha');

  // 绑定事件
  const saveBtn = document.getElementById('dev-preset-save');
  const nameInput = document.getElementById('dev-preset-name');
  if (saveBtn && nameInput) {
    saveBtn.addEventListener('click', () => { savePreset(nameInput.value); nameInput.value = ''; });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { savePreset(nameInput.value); nameInput.value = ''; }
    });
  }

  document.getElementById('dev-preset-import')?.addEventListener('click', importPreset);
  document.getElementById('dev-preset-export-all')?.addEventListener('click', () => {
    const userPresets = getPresets();
    if (userPresets.length === 0) return;
    const blob = new Blob([JSON.stringify(userPresets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lens-presets-all.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('dev-preset-reset')?.addEventListener('click', () => {
    // 重置 CSS 变量为默认（含分区玻璃清除）
    loadPreset(BUILTIN_PRESETS[0]);
    ZONE_GLASS_VARS.forEach(k => document.documentElement.style.removeProperty(k));
    // 重置性能开关为全开
    D.perfToggles = { fps: true, metrics: true, invoke: true, console: true };
    el.querySelectorAll('.dev-chip-toggle').forEach(btn => {
      btn.classList.add('dev-chip-toggle--on');
    });
    applyPerfToggles();
    // 重置调试开关
    ['dev-outline-style','dev-grid-style','dev-box-model-style','dev-box-model-hover','dev-overflow-style','dev-img-info-style','dev-z-index-style','dev-tag-labels-style','dev-layout-hl-style','dev-empty-el-style','dev-depth-color-style','dev-font-info-style','dev-link-info-style','dev-img-alt-style','dev-size-label-style','dev-fps-badge','dev-img-waste-style','dev-dom-stats','dev-key-log','dev-ripple-keyframes','dev-focus-track-style'].forEach(id => {
      const s = document.getElementById(id); if (s) s.remove();
    });
    document.body.classList.remove('dev-bm-active');
    // 同步视觉 tab 调试 toggle 状态（仅调试开关，保留动画开关）
    const visEl = document.getElementById('dev-group-visual');
    if (visEl) {
      ['dev-toggle-outline','dev-toggle-grid-lines','dev-toggle-box-model','dev-toggle-overflow','dev-toggle-img-info','dev-toggle-z-index','dev-toggle-tag-labels','dev-toggle-layout-hl','dev-toggle-empty-el','dev-toggle-depth-color','dev-toggle-font-info','dev-toggle-link-info','dev-toggle-img-alt','dev-toggle-size-label','dev-toggle-fps-badge','dev-toggle-img-waste','dev-toggle-dom-stats','dev-toggle-key-log','dev-toggle-click-ripple','dev-toggle-focus-track'].forEach(id => {
        const t = document.getElementById(id);
        if (t) t.classList.remove('dev-toggle--on');
      });
    }
    // 清除 applyTogglesUI 设置的内联样式，让 CSS 变量重新生效
    const cats = document.getElementById('categories');
    if (cats) cats.style.gridTemplateColumns = '';
    const gGrid = document.getElementById('gallery-grid');
    if (gGrid) gGrid.style.columns = '';
  });

  // 预设卡片事件
  el.querySelectorAll('.dev-preset-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.dev-preset-card__act')) return; // action button
      const id = card.dataset.id;
      const preset = allPresets.find(p => p.id === id);
      if (preset) loadPreset(preset);
    });
  });

  // 删除/导出按钮
  el.querySelectorAll('.dev-preset-card__act[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.dev-preset-card').dataset.id;
      deletePreset(id);
    });
  });
  el.querySelectorAll('.dev-preset-card__act[data-action="export"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.dev-preset-card').dataset.id;
      const preset = [...BUILTIN_PRESETS, ...presets].find(p => p.id === id);
      if (preset) exportPreset(preset);
    });
  });
}

function makePresetCard(preset, activeId, showActions) {
  const vars = preset.vars || {};
  const swatchKeys = ['--accent','--bg','--bg-deep','--text','--text-2','--text-3'];
  const isActive = activeId === preset.id;
  const timeStr = preset.id && !preset.builtin
    ? new Date(parseInt(preset.id, 36)).toLocaleDateString()
    : '';
  const displayFont = vars['--font-display'] || '';
  const fontLabel = displayFont.includes('Xbox') || displayFont.includes('Arial Black') ? '几何'
    : displayFont.includes('sans-serif') ? '无衬'
    : '衬线';
  const radiusPx = parseFloat(vars['--radius']) || 20;
  const scaleVal = parseFloat(vars['--font-scale']) || 1;
  const gapScale = parseFloat(vars['--gap-scale']) || 1;
  const spacingLabel = gapScale <= 0.7 ? '紧凑' : gapScale >= 1.5 ? '宽松' : '标准';

  return `
    <div class="dev-preset-card${isActive ? ' dev-preset-card--active' : ''}" data-id="${preset.id}">
      <div class="dev-preset-card__swatches">
        ${swatchKeys.map(k => `<span class="dev-preset-card__swatch" style="background:${vars[k] || '#888'}" title="${k}"></span>`).join('')}
      </div>
      <div class="dev-preset-card__info">
        <span class="dev-preset-card__name">${preset.name}</span>
        <div class="dev-preset-card__tags">
          <span class="dev-preset-card__tag">${fontLabel}</span>
          <span class="dev-preset-card__tag">R${radiusPx}</span>
          <span class="dev-preset-card__tag">${scaleVal}x</span>
          <span class="dev-preset-card__tag">${spacingLabel}</span>
        </div>
        ${timeStr ? `<span class="dev-preset-card__time">${timeStr}</span>` : ''}
      </div>
      ${preset.builtin ? '<span class="dev-preset-card__badge">内置</span>' : ''}
      ${showActions ? `
        <div class="dev-preset-card__actions">
          <button class="dev-preset-card__act" data-action="export" title="导出">⬇</button>
          <button class="dev-preset-card__act" data-action="delete" title="删除">✕</button>
        </div>
      ` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════
// 监视器生命周期
// ═══════════════════════════════════════════

function startAllMonitors() {
  if (D.perfToggles.fps) startFPSMeter();
  if (D.perfToggles.metrics) startPerfMonitor();
  if (D.perfToggles.console) startConsoleCapture();
  startGamepadVizPoll();
}

function stopAllMonitors() {
  if (D.fpsRaf) { cancelAnimationFrame(D.fpsRaf); D.fpsRaf = null; }
  if (D.gamepadPollRaf) { cancelAnimationFrame(D.gamepadPollRaf); D.gamepadPollRaf = null; }
  if (D.perfInterval) { clearInterval(D.perfInterval); D.perfInterval = null; }
  if (_gpFloatRaf) { cancelAnimationFrame(_gpFloatRaf); _gpFloatRaf = null; }
  stopConsoleCapture();
  // 调试注入样式全部保留（由各自的 toggle 控制开关，关闭面板后继续生效；restoreDebugStyles 在关闭后恢复 body class）
}

// ═══════════════════════════════════════════
// 初始化入口
// ═══════════════════════════════════════════

function applySpecialVarEffects() {
  const style = getComputedStyle(document.documentElement);
  const vars = {};
  CSS_VAR_KEYS.forEach(k => { vars[k] = style.getPropertyValue(k).trim(); });

  // --font-scale → html font-size
  const fs = parseFloat(vars['--font-scale']) || 1;
  document.documentElement.style.fontSize = (fs * 100) + '%';

  // --anim-speed → injected style
  const as = parseFloat(vars['--anim-speed']) || 1;
  if (as !== 1) {
    let s = document.getElementById('dev-anim-speed');
    if (!s) { s = document.createElement('style'); s.id = 'dev-anim-speed'; document.head.appendChild(s); }
    s.textContent = `:root { --_anim-mult: ${as}; }`;
  }

  // --glass-blur 由各 CSS 文件直接通过 var(--glass-blur, 0px) 引用，无需注入

  // --anim-speed = 0 → 禁用动画
  if (as === 0) {
    let s = document.getElementById('dev-anim-disable');
    if (!s) { s = document.createElement('style'); s.id = 'dev-anim-disable'; document.head.appendChild(s); }
    s.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
  }

  // 构建当前 palette 并更新颜色系统（零 var()，完整 CSS 注入）
  const _bgRgb = hexToRgbStr(vars['--bg'] || '#0a0a08') || '10,10,8';
  const _bgDeepRgb = hexToRgbStr(vars['--bg-deep'] || '#060605') || '6,6,5';
  const _accentRgb = hexToRgbStr(vars['--accent'] || '#c8a87c') || '200,168,124';
  const _textRgb = hexToRgbStr(vars['--text'] || '#e8e4e0') || '232,228,224';
  // 从活跃颜色预设获取真实 warm/surface/errRgb（避免硬编码二选一）
  const _activePresetId = localStorage.getItem(ACTIVE_PRESET_KEY);
  let _warm = null, _surfaceRgb = null, _surface2Rgb = null, _errRgb = null, _glassBlur = null;
  if (_activePresetId) {
    const cp = COLOR_PRESETS.find(p => p.id === _activePresetId);
    if (cp) {
      _warm = cp.palette.warm;
      _surfaceRgb = cp.palette.surfaceRgb;
      _surface2Rgb = cp.palette.surface2Rgb;
      _errRgb = cp.palette.errRgb;
      _glassBlur = cp.palette.glassBlur;
    }
  }
  if (!_warm) _warm = deriveWarmTint(vars);
  const palette = {
    bg: vars['--bg'] || '#0a0a08',
    bgDeep: vars['--bg-deep'] || '#060605',
    accent: vars['--accent'] || '#c8a87c',
    text: vars['--text'] || '#e8e4e0',
    text2: vars['--text-2'] || '#9a948e',
    text3: vars['--text-3'] || '#5a5450',
    warm: _warm,
    accentRgb: _accentRgb,
    bgRgb: _bgRgb,
    bgDeepRgb: _bgDeepRgb,
    surfaceRgb: _surfaceRgb || '30,28,26',
    surface2Rgb: _surface2Rgb || '20,18,15',
    errRgb: _errRgb || '232,112,112',
    glassBlur: _glassBlur || '0px',
    heroGradTop: parseRgbPart(vars['--hero-grad-top']) || (()=>{const t=_textRgb.split(',');return `${Math.round(t[0]*0.3+255*0.7)},${Math.round(t[1]*0.3+255*0.7)},${Math.round(t[2]*0.3+255*0.7)}`;})(),
    heroGradMid: parseRgbPart(vars['--hero-grad-mid']) || _accentRgb,
    heroGradBot: parseRgbPart(vars['--hero-grad-bot']) || (()=>{const a=_accentRgb.split(',');return `${Math.round(a[0]*0.85)},${Math.round(a[1]*0.78)},${Math.round(a[2]*0.7)}`;})(),
    cornerLogoColor: vars['--corner-logo-color'] || `rgba(${_accentRgb},0.55)`,
    heroSubtitleColor: vars['--hero-subtitle-color'] || `rgba(${_accentRgb},0.3)`,
    heroLineColor: vars['--hero-line-color'] || `rgba(${_accentRgb},0.35)`,
    devPanelBg: vars['--dev-panel-bg'] || `rgba(${_bgRgb},0.94)`,
    fontDisplay: vars['--font-display'] || "'Cormorant Garamond', Georgia, serif",
    fontBody: vars['--font-body'] || "'Cormorant', Georgia, serif",
    fontCaption: vars['--font-caption'] || "'Cormorant Garamond', Georgia, serif",
    fontMono: vars['--font-mono'] || "'Consolas', 'Courier New', monospace",
    fontWeightDisplay: vars['--font-weight-display'] || '300',
    fontWeightBody: vars['--font-weight-body'] || '400',
    fontWeightCaption: vars['--font-weight-caption'] || '400',
    fontWeightMono: vars['--font-weight-mono'] || '400',
    letterSpacingDisplay: vars['--letter-spacing-display'] || '0.05em',
    letterSpacingBody: vars['--letter-spacing-body'] || '0.04em',
    letterSpacingCaption: vars['--letter-spacing-caption'] || '0.04em',
    letterSpacingMono: vars['--letter-spacing-mono'] || '0',
    fontStyleDisplay: vars['--font-style-display'] || 'normal',
    fontStyleBody: vars['--font-style-body'] || 'normal',
    fontStyleCaption: vars['--font-style-caption'] || 'normal',
    fontStyleMono: vars['--font-style-mono'] || 'normal',
    textTransform: vars['--text-transform'] || 'none',
  };
  updateColorSystem(palette);

  // 将派生的 hero 颜色写回 CSS 变量（供面板控件同步显示）
  document.documentElement.style.setProperty('--hero-grad-top', `rgba(${palette.heroGradTop},1)`);
  document.documentElement.style.setProperty('--hero-grad-mid', `rgba(${palette.heroGradMid},0.85)`);
  document.documentElement.style.setProperty('--hero-grad-bot', `rgba(${palette.heroGradBot},0.25)`);
  if (!vars['--corner-logo-color']) {
    document.documentElement.style.setProperty('--corner-logo-color', palette.cornerLogoColor);
  }
  if (!vars['--hero-subtitle-color']) {
    document.documentElement.style.setProperty('--hero-subtitle-color', palette.heroSubtitleColor);
  }
  if (!vars['--hero-line-color']) {
    document.documentElement.style.setProperty('--hero-line-color', palette.heroLineColor);
  }
  if (!vars['--dev-panel-bg']) {
    document.documentElement.style.setProperty('--dev-panel-bg', palette.devPanelBg);
  }

  // 同步角标字体
  const cornerLogo = document.getElementById('corner-logo');
  if (cornerLogo) {
    cornerLogo.style.fontFamily = vars['--font-display'];
    cornerLogo.style.fontWeight = vars['--font-weight-display'];
    cornerLogo.style.letterSpacing = vars['--letter-spacing-display'];
  }

  // 强制 Hero 标题重绘
  const heroTitle = document.querySelector('.hero__title');
  if (heroTitle) {
    heroTitle.style.display = 'none';
    void heroTitle.offsetHeight;
    heroTitle.style.display = '';
    void heroTitle.offsetHeight;
  }

  // 重建预览面板（零 var()，全部内联样式）并启动动画
  buildDevPreview();
  startPreviewAnimations();
  // 同步面板控件显示状态（字体预设按钮等）
  if (D.open) syncVisualControls();

  void document.documentElement.offsetHeight;
}

function hexToRgbStr(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (m) return `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`;
  const rgbM = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbM) return `${rgbM[1]},${rgbM[2]},${rgbM[3]}`;
  return null;
}

function parseRgbPart(val) {
  if (!val) return null;
  const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  // 如果已经是纯 RGB 字符串 "255,245,235"
  if (/^\d+,\d+,\d+$/.test(val.trim())) return val.trim();
  return null;
}

function deriveWarmTint(vars) {
  // 从背景色派生暖色调（而非强调色），避免蓝色面板
  const bg = vars['--bg'] || '#0a0a08';
  const m = bg.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (m) {
    const r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
    const avg = (r + g + b) / 3;
    if (avg < 128) {
      // 暗背景 → 暖灰白
      return '220,200,180';
    } else {
      // 亮背景 → 深暖灰
      return '30,28,26';
    }
  }
  return '220,200,180';
}

export function initDevPanel() {
  // 捕获 CSS 默认值（从已注入的 lens-colors 样式表读取）
  const style = getComputedStyle(document.documentElement);
  CSS_VAR_KEYS.forEach(k => { CSS_DEFAULTS[k] = style.getPropertyValue(k).trim(); });
  // 补充未在样式表中定义的变量的默认值
  const HARD_DEFAULTS = {
    '--hero-grad-top': 'rgba(255,245,235,1)',
    '--hero-grad-mid': 'rgba(220,200,175,0.85)',
    '--hero-grad-bot': 'rgba(180,155,130,0.25)',
    '--corner-logo-color': 'rgba(220,200,175,0.85)',
    '--hero-subtitle-color': 'rgba(220,200,180,0.3)',
    '--hero-line-color': 'rgba(220,200,180,0.35)',
    '--dev-panel-bg': 'rgba(10,10,8,0.94)',
  };
  Object.entries(HARD_DEFAULTS).forEach(([k, v]) => {
    if (!CSS_DEFAULTS[k]) CSS_DEFAULTS[k] = v;
  });

  // 一次性清理：清除旧版本的分区玻璃残留（v1.7.0 分区玻璃解耦）
  if (!localStorage.getItem('lens-dev-session-v3')) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_PRESET_KEY);
    localStorage.setItem('lens-dev-session-v3', '1');
  }

  // 恢复上次会话的调节
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (saved) Object.entries(saved).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
    // 强制重排确保 CSS 变量立即对 DOM 生效（Hero标题/加载画面依赖）
    void document.documentElement.offsetHeight;
  } catch {}

  setupDevPanelEvents();
  setupDevTabs();

  // 会话恢复后强制重写分区玻璃默认值（覆盖旧版本的残留/冲突数据）
  window.__lensZoneGlassDirty = true;

  // 液态玻璃预设：先创建 SVG 滤镜 + 设置标志位，再调用 applySpecialVarEffects
  // 这样 generateFullCSS 内部能检测到标志位并输出玻璃 CSS
  if (localStorage.getItem(ACTIVE_PRESET_KEY) === '__liquid-glass__') {
    enableLiquidGlassPanels();
    window.__lensLiquidGlass = true;
  }

  // 恢复会话变量的特殊副作用（注入样式等）—— 内部已包含 buildDevPreview + 动画启动
  applySpecialVarEffects();

  window.__lensToggleDev = toggleDevPanel;
  // 暴露 invoke 日志缓冲供 main.js 写入
  window.__lensInvokeLog = D.invokeLog;
  // 暴露手柄提示更新供 gamepad.js 调用
  window.__lensUpdateDevHints = updateDevHints;
  // 暴露渲染完成标志供 gamepad.js 检测
  window.__lensDevRendered = () => document.querySelector('.dev-group--active .dev-slider') !== null;
  // 暴露 CSS 默认值供 gamepad.js 复位使用
  window.__lensCSSDefaults = BUILTIN_PRESETS[0].vars;
  // 暴露手柄悬浮放大
  window.__lensGpFloat = (zone) => {
    const float = document.getElementById('dev-gp-float');
    const content = document.getElementById('dev-gp-float-content');
    if (!float || !content) return;
    const source = document.querySelector(`[data-gp-zone="${zone}"]`);
    if (!source) return;
    content.innerHTML = source.innerHTML;
    // 复制按钮网格的 data 属性
    if (zone === 'buttons') {
      const srcGrid = source.querySelector('.dev-gp-grid');
      const dstGrid = content.querySelector('.dev-gp-grid');
      if (srcGrid && dstGrid) {
        dstGrid.innerHTML = srcGrid.innerHTML;
      }
    }
    float.classList.add('dev-gp-float--open');
    // 启动悬浮窗的实时更新
    startGpFloatPoll(zone);
  };
  // 暴露一键复位（手柄长按 X）
  window.__lensResetAll = () => {
    loadPreset(BUILTIN_PRESETS[0]);
    D.perfToggles = { fps: true, metrics: true, invoke: true, console: true };
    document.querySelectorAll('.dev-chip-toggle').forEach(btn => btn.classList.add('dev-chip-toggle--on'));
    applyPerfToggles();
    ['dev-outline-style','dev-grid-style','dev-box-model-style','dev-box-model-hover','dev-overflow-style','dev-img-info-style','dev-z-index-style','dev-tag-labels-style','dev-layout-hl-style','dev-empty-el-style','dev-depth-color-style','dev-font-info-style','dev-link-info-style','dev-img-alt-style','dev-size-label-style','dev-fps-badge','dev-img-waste-style','dev-dom-stats','dev-key-log','dev-ripple-keyframes','dev-focus-track-style'].forEach(id => {
      const s = document.getElementById(id); if (s) s.remove();
    });
    document.body.classList.remove('dev-bm-active');
    const visEl2 = document.getElementById('dev-group-visual');
    if (visEl2) {
      ['dev-toggle-outline','dev-toggle-grid-lines','dev-toggle-box-model','dev-toggle-overflow','dev-toggle-img-info','dev-toggle-z-index','dev-toggle-tag-labels','dev-toggle-layout-hl','dev-toggle-empty-el','dev-toggle-depth-color','dev-toggle-font-info','dev-toggle-link-info','dev-toggle-img-alt','dev-toggle-size-label','dev-toggle-fps-badge','dev-toggle-img-waste','dev-toggle-dom-stats','dev-toggle-key-log','dev-toggle-click-ripple','dev-toggle-focus-track'].forEach(id => {
        const t = document.getElementById(id);
        if (t) t.classList.remove('dev-toggle--on');
      });
    }
    // 清除内联样式覆盖，让 CSS 变量生效
    const cats = document.getElementById('categories');
    if (cats) cats.style.gridTemplateColumns = '';
    const gGrid = document.getElementById('gallery-grid');
    if (gGrid) gGrid.style.columns = '';
  };

  console.log('[DevPanel] 初始化完成 — Ctrl+Shift+D 打开');
}
