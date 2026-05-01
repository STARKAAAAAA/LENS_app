# LENS 自我改进 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 photography-tauri v1.5.0 进行三步渐进式改进：EXIF 优化 + 死代码清理 + CSS/JS 模块拆分 + Rust 错误处理 + UI 验证

**Architecture:** 三步独立提交。Step 1 改 Rust/JS/CSS 小范围优化。Step 2 将两个 ~2000 行单体文件拆为 11 个 CSS 模块 + 10 个 JS 模块，入口文件变为 @import/import 声明。Step 3 验证 UI。

**Tech Stack:** Tauri v2, Rust, Vanilla JS (ES modules), Vite, CSS @layer + @import

---

## Step 1: EXIF 尺寸优化 + 死代码清理

### Task 1.1: EXIF 尺寸从标签读取（Rust）

**Files:**
- Modify: `src-tauri/src/main.rs:271-292`

- [ ] **Step 1: 修改 get_exif_info — 用 EXIF PixelXDimension/PixelYDimension 代替全图解码**

读取 `get_exif_info` 函数中尺寸获取部分，将 `image::load_from_memory` 替换为 EXIF 标签读取。

当前代码（第 275-279 行）：
```rust
let (width, height) = match image::load_from_memory(&data) {
    Ok(img) => img.dimensions(),
    Err(_) => (0, 0),
};
```

改为：在 EXIF 解析完成后（第 296 行 `reader.read_from_container` 之后），从已解析的 EXIF 中提取尺寸：

```rust
// 从 EXIF 获取尺寸（优先），兜底用全图解码
let (width, height) = {
    let w = exif.get_field(exif::Tag::PixelXDimension, exif::In::PRIMARY)
        .and_then(|f| match &f.value { exif::Value::Long(v) => v.first().copied(), _ => None });
    let h = exif.get_field(exif::Tag::PixelYDimension, exif::In::PRIMARY)
        .and_then(|f| match &f.value { exif::Value::Long(v) => v.first().copied(), _ => None });
    match (w, h) {
        (Some(w), Some(h)) => (w, h),
        _ => {
            eprintln!("[LENS] EXIF dimensions missing for: {}", path);
            match image::load_from_memory(&data) {
                Ok(img) => img.dimensions(),
                Err(_) => (0, 0),
            }
        }
    }
};
```

**注意**：需要把这部分代码移到 EXIF 解析块内部（`reader.read_from_container` 的 `if let Ok(exif) = ...` 代码块内），并将 width/height 的声明提前到 `if let` 之外，初始化为 `(0, 0)`。

完整改动结构：
```rust
fn get_exif_info(path: String) -> Result<ExifInfo, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    let filesize = data.len() as u64;

    let mut width: u32 = 0;
    let mut height: u32 = 0;

    let mut exif_data = ExifInfo { ... };

    let reader = exif::Reader::new();
    let mut cursor = std::io::Cursor::new(&data);
    if let Ok(exif) = reader.read_from_container(&mut cursor) {
        // 从 EXIF 获取尺寸
        let w = exif.get_field(exif::Tag::PixelXDimension, exif::In::PRIMARY)
            .and_then(|f| match &f.value { exif::Value::Long(v) => v.first().copied(), _ => None });
        let h = exif.get_field(exif::Tag::PixelYDimension, exif::In::PRIMARY)
            .and_then(|f| match &f.value { exif::Value::Long(v) => v.first().copied(), _ => None });
        match (w, h) {
            (Some(w), Some(h)) => { width = w; height = h; }
            _ => { /* 兜底在后面 */ }
        }

        // ... 现有的 camera/lens/aperture 等字段提取 ...
    }

    // 兜底：EXIF 没尺寸标签，全图解码
    if width == 0 || height == 0 {
        if let Ok(img) = image::load_from_memory(&data) {
            (width, height) = img.dimensions();
        }
    }

    exif_data.width = width;
    exif_data.height = height;

    Ok(exif_data)
}
```

- [ ] **Step 2: 构建验证**

```bash
cd "E:/claude test file/photography-tauri" && npm run tauri build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src-tauri/src/main.rs && git commit -m "perf: EXIF 尺寸从标签读取，跳过全图解码" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 1.2: 死代码清理

**Files:**
- Modify: `src/main.js`
- Modify: `src/style.css`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 检查并清理 main.js 无用的顶级函数/变量**

检查各 import 是否被使用：
- `import { listen }` — 在 loadFromDir 中使用 ✓
- `import { getCurrentWindow }` — 在 initTitlebar 中使用 ✓
- `import { open }` — 在 selectFolder 中使用 ✓
- `import { convertFileSrc, invoke }` — 多处使用 ✓
- `import { join }` — 在 scanPhotos 中使用 ✓
- `import { readDir }` — 在 scanPhotos 中使用 ✓

检查函数定义是否被调用：
- `initHero` (line 1072) — 搜索整个文件，仅在 1072 行定义，未被调用 → 删除
- 其他函数均有调用方 → 保留

删除 initHero（第 1072 行）：
```js
function initHero() { rebuildHero(data.photos); }  // ← 删除此行
```

- [ ] **Step 2: style.css 死代码检查**

搜索 style.css 中是否有对应 HTML 中不存在的选择器。主要检查：
```
grep -n "\.filmstrip\|\.fullscreen\|\.zoom-slider" src/style.css
```
若不存在对应 HTML 元素则删除。

（实际上需要先读 style.css 再判断，此处标注为检查项）

- [ ] **Step 3: main.rs 死代码检查**

检查 `use` 语句是否全部被使用，若编译器无 warning 则跳过。

- [ ] **Step 4: 构建验证**

```bash
cd "E:/claude test file/photography-tauri" && npm run tauri build 2>&1 | tail -20
```

- [ ] **Step 5: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src/main.js src/style.css && git commit -m "chore: 清理无用代码" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Step 2: CSS 拆分 + JS 拆分 + Rust 错误处理

### 2A. CSS 模块拆分

#### Task 2.1: 创建 src/css/reset.css

**Files:**
- Create: `src/css/reset.css`

- [ ] **Step 1: 从 style.css 提取 @layer reset 内容**

读取 style.css，找到 `@layer reset { ... }` 块，提取到新文件：

```css
@layer reset {
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; scrollbar-width: none; }
  body { scrollbar-width: none; }
  body::-webkit-scrollbar { display: none; }
  img { display: block; max-width: 100%; }
  a { color: inherit; text-decoration: none; }
  button { cursor: pointer; }
}
```

- [ ] **Step 2: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src/css/reset.css && git commit -m "refactor: 提取 reset.css 模块" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

#### Task 2.2: 创建 src/css/variables.css

**Files:**
- Create: `src/css/variables.css`

- [ ] **Step 1: 提取 CSS 自定义属性和 @property 定义**

从 style.css 提取 `:root { ... }`（CSS 变量）和 `@property` 定义：

```css
@layer base {
  :root {
    --bg: #0a0a08;
    --surface: rgba(15,15,12,0.8);
    --text: rgba(235,230,220,0.92);
    --text-secondary: rgba(200,190,175,0.6);
    --accent: #c8a87c;
    --accent-dim: rgba(200,168,124,0.25);
    --radius: 14px;
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  }

  @property --grid-size {
    syntax: '<length>';
    initial-value: 0px;
    inherits: false;
  }
}
```

- [ ] **Step 2: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src/css/variables.css && git commit -m "refactor: 提取 variables.css 模块" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

#### Task 2.3-2.11: 继续逐模块提取

按照设计文档的 11 个 CSS 文件逐一提取。每个模块的提取流程：

**Task 2.3: base.css** — body/html 排版、背景、字体设置
**Task 2.4: titlebar.css** — .titlebar, .titlebar__controls, .titlebar__btn, .titlebar--visible, @keyframes titlebarSlideIn
**Task 2.5: toolbar.css** — .toolbar, .toolbar__btn, .toolbar--visible, @keyframes btnSlideIn
**Task 2.6: sidebar.css** — .sidebar, .sidebar__*, .sidebar-trigger, #dir-label
**Task 2.7: loading.css** — #loading-screen, 胶囊装载器, 金句轮播, @keyframes loading*
**Task 2.8: hero.css** — .hero, .hero__*, .hero__reveal, 启动动画相关
**Task 2.9: gallery.css** — .gallery, .gallery__*, .categories, .category-card, .portfolio, .custom-dropdown
**Task 2.10: lightbox.css** — .lightbox, .slideshow, .lightbox__*, .slideshow__*, .exif__*, .rating__*
**Task 2.11: panels.css** — .settings-panel, .shortcuts-*, .toggle-switch, .density-btn, .back-to-top
**Task 2.12: utilities.css** — 工具类（如果有）

每个 Task 的步骤：
1. 从 style.css 精确定位对应 @layer 块的内容
2. 创建新文件，包裹在对应的 `@layer components { ... }` 中
3. 从 style.css 中删除对应内容
4. 构建验证

#### Task 2.13: 更新 style.css 为入口文件

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: 将 style.css 重写为 @import 入口**

```css
/* LENS — CSS Entry Point */
/* @layer 声明顺序 */
@layer reset, base, components, utilities;

/* 模块导入 */
@import './css/reset.css';
@import './css/variables.css';
@import './css/base.css';
@import './css/titlebar.css';
@import './css/toolbar.css';
@import './css/sidebar.css';
@import './css/loading.css';
@import './css/hero.css';
@import './css/gallery.css';
@import './css/lightbox.css';
@import './css/panels.css';
@import './css/utilities.css';
```

注意：`@property` 定义必须在全局作用域（不能嵌套在 @layer 内），所以需要保留在入口文件。如果 variables.css 中没有 @property，则在入口添加。

- [ ] **Step 2: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src/style.css && git commit -m "refactor: style.css 改为 @import 入口" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### 2B. JS 模块拆分

#### Task 2.14: 创建 src/js/utils.js

**Files:**
- Create: `src/js/utils.js`

- [ ] **Step 1: 提取工具函数**

从 main.js 提取 `preloadImages`, `formatBytes`, `cleanCategory`, `cleanTitle`：

```js
// 图片预加载
export function preloadImages(imgs, onProgress) {
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

// 文件大小格式化
export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// 清理分类名
export function cleanCategory(dirname) {
  const m = dirname.match(/^\d{4}\s+\d{1,2}\s+\d{1,2}\s*(.*)/);
  return (m && m[1]) ? m[1].trim() : dirname.trim();
}

// 清理文件名
export function cleanTitle(filename) {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/-DxO_DeepPRIME\s*XD2?s?/g, '');
  name = name.replace(/-CR3_DxO_DeepPRIMEXD/g, '');
  return name.trim();
}
```

- [ ] **Step 2: 提交**

#### Task 2.15: 创建 src/js/config.js

从 main.js 提取配置管理函数：

```js
const CONFIG_KEY = 'lens-photo-dir';
const SAVED_KEY = 'lens-saved-folders';

export function loadDir() { return localStorage.getItem(CONFIG_KEY) || ''; }
export function saveDir(dir) { localStorage.setItem(CONFIG_KEY, dir); }
export function getSavedFolders() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; }
  catch { return []; }
}
export function saveFolders(dirs) { localStorage.setItem(SAVED_KEY, JSON.stringify(dirs)); }
```

#### Task 2.16-2.22: 继续逐模块提取 JS 文件

**Task 2.16: scanner.js** — selectFolder, scanPhotos
**Task 2.17: titlebar.js** — initTitlebar
**Task 2.18: toggles.js** — loadToggles, saveToggles, applyTogglesUI, DEFAULT_TOGGLES, TOGGLE_KEY, TOGGLE_VERSION_KEY
**Task 2.19: sidebar.js** — renderSidebar, addSavedFolder, removeSavedFolder, createCacheSection, updateCacheDisplay
**Task 2.20: loading.js** — showLoadingScreen, updateLoadingScreen, hideLoadingScreen, playStartupSequence, moveTitleToCorner
**Task 2.21: gallery.js** — renderGallery (buildGalleryGridDOM, renderGalleryDropdowns, createDropdown, openCategory, category cards 等)
**Task 2.22: lightbox.js** — initLightbox, initSlideshow, updateRatingUI
**Task 2.23: panels.js** — settingsPanel, shortcutsPanel, toggleShortcuts, open/closeSettingsPanel

#### Task 2.24: 更新 main.js 为入口文件

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: 重写 main.js 为模块导入入口**

```js
import { getCurrentWindow } from '@tauri-apps/api/window';

import { loadDir, saveDir, getSavedFolders, saveFolders } from './js/config.js';
import { selectFolder, scanPhotos } from './js/scanner.js';
import { cleanCategory, cleanTitle, preloadImages, formatBytes } from './js/utils.js';
import { initTitlebar } from './js/titlebar.js';
import { renderSidebar, addSavedFolder, removeSavedFolder, createCacheSection, updateCacheDisplay } from './js/sidebar.js';
import { loadToggles, saveToggles, applyTogglesUI, DEFAULT_TOGGLES } from './js/toggles.js';
import { showLoadingScreen, updateLoadingScreen, hideLoadingScreen, playStartupSequence } from './js/loading.js';
import { initGallery } from './js/gallery.js';
import { initLightbox, initSlideshow, updateRatingUI } from './js/lightbox.js';
import { initSettingsPanel, initShortcutsPanel } from './js/panels.js';

// ========== App ==========
document.addEventListener('DOMContentLoaded', async () => {
  // ... 主流程编排（约150行）：状态持有、初始化调用、模块编排
});
```

- [ ] **Step 2: 构建验证**

```bash
cd "E:/claude test file/photography-tauri" && npm run tauri build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src/ && git commit -m "refactor: CSS/JS 模块化拆分（11 CSS + 10 JS）" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### 2C. Rust 错误处理改进

#### Task 2.25: 添加错误日志

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 修改 generate_one — 添加失败日志**

在第 166 行 `let data = match std::fs::read(original) {` 的 Err 分支：
```rust
let data = match std::fs::read(original) {
    Ok(d) => d,
    Err(e) => {
        eprintln!("[LENS] thumbnail read failed: {original} — {e}");
        return;
    }
};
```

在第 180 行 `} else { return; }` 之前添加日志：
```rust
} else {
    eprintln!("[LENS] thumbnail decode failed: {original}");
    return;
};
```

- [ ] **Step 2: 修改 generate_thumbnails spawn_blocking 错误信息**

在第 151 行 `.await.map_err(|e| e.to_string())` 改为：
```rust
.await.map_err(|e| format!("spawn_blocking failed: {e}"))
```

- [ ] **Step 3: 提交**

```bash
cd "E:/claude test file/photography-tauri" && git add src-tauri/src/main.rs && git commit -m "fix: 添加 Rust 端错误日志" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Step 3: UI 问题验证修复

#### Task 3.1: UI 验证

- [ ] **Step 1: 标题栏按钮点击验证**

检查 `initTitlebar` 中事件是否正常挂载：
```js
// 确认以下代码没问题
document.getElementById('tb-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('tb-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());
document.getElementById('tb-close')?.addEventListener('click', () => appWindow.close());
```

若按钮不响应，检查 CSS 中 `.titlebar__controls` 和 `.titlebar__btn` 是否有 `-webkit-app-region: no-drag`：
```css
.titlebar__controls { -webkit-app-region: no-drag; }
.titlebar__btn { -webkit-app-region: no-drag; }
```

- [ ] **Step 2: 窗口拖拽验证**

检查 `.titlebar` 是否有 `data-tauri-drag-region` 属性（HTML 中已存在）且 CSS 中 `-webkit-app-region: drag` 未被覆盖。

- [ ] **Step 3: 灯箱 × z-index 验证**

确认 `.lightbox` 和 `.slideshow` 的 z-index 为 20000。

- [ ] **Step 4: 修复 + 提交**

如有发现问题，修复后提交：
```bash
cd "E:/claude test file/photography-tauri" && git add -A && git commit -m "fix: UI 验证修复" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 最终验证

- [ ] `npm run tauri build` 构建成功
- [ ] 安装后 LENS 秒开
- [ ] 画廊、灯箱、侧边栏、设置面板、快捷键面板功能正常
- [ ] EXIF 信息面板显示正确（含尺寸）
- [ ] 标题栏按钮可点击、窗口可拖拽
- [ ] 推送 gitee + github
