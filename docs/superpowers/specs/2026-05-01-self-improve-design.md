# LENS 自我改进 — 设计文档

## 概述

对 photography-tauri v1.5.0 进行三轮渐进式改进：EXIF 信息获取优化、无用代码清理、CSS/JS 模块拆分、Rust 错误处理、UI 问题验证修复。

## 策略：三步渐进（方案 B）

每步独立提交，可独立测试和回滚。

---

## Step 1: EXIF 尺寸优化 + 死代码清理

### 1A. EXIF 尺寸获取优化

**文件**: `src-tauri/src/main.rs:271-292`

**问题**: `get_exif_info` 使用 `image::load_from_memory(&data)` 全图解码获取 `(width, height)`，对 30-50MB JPEG 解码代价极高。

**改进**: 优先从 EXIF 标签读取尺寸，仅兜底时全图解码。

**具体逻辑**:
1. 在已解析的 EXIF 数据中读取 `PixelXDimension` + `PixelYDimension`（IFD PRIMARY）
2. 两个都存在 → 使用 EXIF 值
3. 缺失任一 → 兜底用 `image::load_from_memory` 解码获取尺寸
4. 兜底解码也失败 → `(0, 0)`

**EXIF 函数**: 复用 `get_rational` 提取 Rational 值，转为 `u32`。

**收益**: `get_exif_info` 响应时间从百毫秒级降到几毫秒（跳过全图解码），灯箱信息面板秒开。

### 1B. 无用代码清理

| 文件 | 清理项 |
|------|--------|
| `main.js` | 检查 `showChrome` 残留引用（已删除函数） |
| `main.js` | 检查 import 中未使用的变量 |
| `style.css` | 检查无对应 HTML 的 CSS 选择器 |

清理方法：grep 搜索每个 import 变量是否在文件中被引用；检查 CSS 选择器是否有对应的 HTML 元素。

---

## Step 2: 模块化拆分 + Rust 错误处理

### 2A. CSS 拆分

**从** `src/style.css`（~2000行单文件）

**到**:

```
src/
├── style.css              # 入口：@import 各模块 + @layer 声明
└── css/
    ├── reset.css           # @layer reset — CSS reset
    ├── variables.css       # @layer base — CSS 自定义属性
    ├── base.css            # @layer base — body/html/排版
    ├── titlebar.css        # @layer components — 自定义标题栏 + 按钮
    ├── toolbar.css         # @layer components — 工具栏
    ├── sidebar.css         # @layer components — 侧边栏 + 目录标签
    ├── loading.css         # @layer components — 加载画面 + 动画
    ├── hero.css            # @layer components — Hero 区域 + 滚动指示器
    ├── gallery.css         # @layer components — 画廊网格 + 导航栏 + 下拉
    ├── lightbox.css        # @layer components — 灯箱 + 幻灯片
    ├── panels.css          # @layer components — 设置/快捷键面板 + 开关
    └── utilities.css       # @layer utilities
```

**原则**:
- 每个文件开头声明 `@layer components {` 包裹全部规则
- 入口 `style.css` 保留 `@property` 定义 + `@keyframes` + `@import`
- Vite 生产构建自动合并 `@import`，无性能损失

### 2B. JS 拆分

**从** `src/main.js`（~2000行单文件）

**到**:

```
src/
├── main.js                 # 入口：import 模块, 全局状态, 初始化
└── js/
    ├── config.js           # 配置管理 (loadDir, saveDir, getSavedFolders, saveFolders)
    ├── scanner.js          # 文件夹扫描 (selectFolder, scanPhotos, cleanCategory, cleanTitle)
    ├── titlebar.js         # 自定义标题栏 (initTitlebar)
    ├── sidebar.js          # 侧边栏渲染 (renderSidebar, 文件夹列表)
    ├── loading.js          # 启动加载画面 (playStartupSequence, LoadingManager)
    ├── gallery.js          # 画廊渲染 (renderGallery, renderGalleryDropdowns)
    ├── lightbox.js         # 灯箱 + 幻灯片 (openLightbox, Slideshow)
    ├── panels.js           # 设置面板 + 快捷键面板 (SettingsPanel, ShortcutsPanel)
    ├── toggles.js          # 功能开关 (featureToggles, saveToggles, applyTogglesUI)
    └── utils.js            # 工具函数 (preloadImages, debounce, 图片工具)
```

**共享状态方案**: 全局状态（`currentPhotos`, `featureToggles`, DOM refs）保持在 `main.js`，模块导出函数接收这些状态作为参数：

```js
// main.js
import { renderGallery } from './js/gallery.js';
import { renderSidebar } from './js/sidebar.js';

let currentPhotos = [];
let featureToggles = { ... };

// 模块函数通过参数接收状态
renderGallery(photos, toggles);
renderSidebar(dir, photos);
```

**原则**:
- 每个模块导出纯函数，不创建闭包共享状态
- `main.js` 作为唯一的状态持有者和协调者
- 避免循环依赖

### 2C. Rust 错误处理

**文件**: `src-tauri/src/main.rs`

轻量改进，不引入 `anyhow` 或 `thiserror`，保持零额外依赖。

| 函数 | 改进 |
|------|------|
| `generate_one` | 解码失败时 `eprintln!("[LENS] thumbnail failed: {original}")` |
| `generate_thumbnails` | spawn_blocking join error 包含上下文 `"spawn_blocking failed: {e}"` |
| `get_exif_info` | 尺寸解码兜底失败时 `eprintln!` 警告 |

---

## Step 3: UI 问题验证修复

### 验证清单

1. **标题栏按钮可点击** — 最小化/最大化/关闭按钮事件是否生效
   - 若失败：检查 `-webkit-app-region: no-drag` + z-index
2. **窗口拖拽** — 拖拽标题栏区域能否移动窗口
   - 若失败：检查 `data-tauri-drag-region` + `-webkit-app-region: drag`
3. **灯箱 × 与导航栏** — 上次已提 z-index 至 20000，确认不重叠
4. **`getCurrentWindow` 导入** — 确认 `@tauri-apps/api/window` 路径正确

### 可能修复

- z-index 层级调整
- CSS `-webkit-app-region` 检查
- 事件监听器挂载时机调整

---

## 影响文件汇总

### Step 1
| 操作 | 文件 | 改动量 |
|------|------|--------|
| 修改 | `src-tauri/src/main.rs` | ~15 行 |
| 修改 | `src/main.js` | ~5 行（如有残留） |
| 修改 | `src/style.css` | ~5 行（如有残留） |

### Step 2
| 操作 | 文件 | 改动量 |
|------|------|--------|
| 新建 | `src/css/*.css`（11 文件） | ~2000 行（拆分） |
| 修改 | `src/style.css` | 缩减为 ~50 行入口 |
| 新建 | `src/js/*.js`（10 文件） | ~2000 行（拆分） |
| 修改 | `src/main.js` | 缩减为 ~150 行入口 |
| 修改 | `src-tauri/src/main.rs` | ~5 行 |

### Step 3
| 操作 | 文件 | 改动量 |
|------|------|--------|
| 待定 | 视问题而定 | 预估 < 20 行 |

---

## 验证

1. `npm run tauri build` 构建成功
2. LENS 启动秒开（代理绕过生效）
3. 画廊、灯箱、侧边栏、设置面板功能正常
4. EXIF 信息面板显示正确（含尺寸）
5. 标题栏按钮可点击、窗口可拖拽
6. CSS @import 生产构建正确合并
7. JS 模块无循环依赖
