# LENS &middot; 优雅的摄影作品画廊

> 告别简陋的照片查看器。LENS 专为摄影师和摄影爱好者打造，提供沉浸式的作品浏览体验。

> *Stop settling for clunky photo viewers. LENS is a gallery app crafted for photographers, delivering an immersive way to browse your work.*

---

当前版本 Current version: **v1.5.0**

## 为什么选择 LENS / Why LENS

市面上的照片查看器要么简陋粗糙，要么过度复杂。LENS 填补了空白——一款专注于「浏览体验」的桌面照片画廊。毛玻璃美学、丝滑动画、智能缓存，让每一张作品都以最好的方式呈现。

*Most photo viewers are either bare-bones or bloated. LENS fills the gap — a desktop gallery focused purely on the browsing experience. Frosted glass aesthetics, fluid animations, and smart caching present every shot at its best.*

## 功能 / Features

### 窗口 / Window
- 自定义标题栏（融合式按钮），暖暗金配色
- 最小化 / 最大化 / 关闭按钮，双击标题栏切换最大化
- 窗口拖拽区域（data-tauri-drag-region）

### 启动体验 / Startup
- 全屏 Hero 背景高斯模糊渐清 (2.8s)
- LENS 标题居中淡入，金线装饰展开，随后移至左上角
- 暖金光斑与毛玻璃效果同步淡入
- 加载画面：胶囊型光环绕行动画，摄影金句轮播
- 启动完成后工具栏/标题栏/侧边栏同步滑入 (300ms)

### 侧边栏 / Sidebar
- Finder 风格悬浮圆角面板，靠近左边缘探出，点击展开
- 折叠时内容高斯模糊 (blur 6px) 且不可点击
- 多文件夹管理：添加、切换、删除，自动持久化
- 角落 LENS logo 实时跟随侧边栏位移
- 底部缓存信息面板（大小/文件数），一键清除
- 底部路径标签 (backdrop-filter blur 20px)

### 浏览 / Browsing
- 文件夹递归扫描，按子目录自动分类
- 分类卡片网格，hover 浮起 + 暖金叠加层
- 分类卡片星级评分显示（设置中可开关）
- 瀑布流画廊（CSS columns），hover 标题叠加
- 画廊导航栏滚动时悬浮 (sticky + backdrop-filter blur)
- 自定义下拉菜单（排序：名称/日期/随机；筛选：全部/收藏/星级）
- 排序/筛选下拉高斯模糊开关动画
- Hero / 分类 / 画廊平滑过渡
- 画廊打开即全部预加载，滚动零卡顿

### 灯箱 / Lightbox
- 滚轮缩放 0.5x–8x，拖拽平移
- 双击放大 / 还原，键盘方向键导航
- 毛玻璃控制按钮，入场旋转动画
- 星级评分 + 收藏（辉光动画），localStorage 持久化
- EXIF 信息面板（相机/镜头/光圈/快门/ISO/焦距/日期/尺寸/文件大小）

### 幻灯片 / Slideshow
- 全屏自动播放 (5s)，随机顺序
- 滚轮缩放、拖拽平移、双击适配窗口
- 底部毛玻璃控制栏，自动隐藏

### 设置面板 / Settings
- EXIF 信息 / 星级评分 / 快捷键提示 / 筛选排序 — 独立开关
- 缩略图密度三档调节（小/中/大），扫光转场动画
- 缓存位置自定义
- 「?」按钮高斯模糊显示/隐藏动画
- 快捷键面板（玻璃面板弹出，回收动画）

### 性能 / Performance
- EXIF 内嵌尺寸标签读取（跳过全图解码）
- Rust 端 turbojpeg SIMD 解码 + Lanczos3 缩放 + 16 线程并行
- 首次加载提速 5–8 倍，后续启动秒开
- 缓存持久化至磁盘，超过 7 天自动清除
- 分类卡片全部预加载，画廊图片一次性载入

### 视觉 / Design
- 暖黑底色 `#0a0a08`，暖金强调色 `#c8a87c`
- 全面毛玻璃效果 (backdrop-filter blur)
- Cormorant Garamond / Cormorant 衬线字体
- cubic-bezier(0.16, 1, 0.3, 1) 统一缓出曲线
- 全部交互均配有丝滑入场/退场动画
- CSS @layer 架构 (reset / base / components / utilities)

### 工程 / Engineering
- CSS 模块化拆分（12 文件）：reset, variables, base, titlebar, toolbar, sidebar, loading, hero, gallery, lightbox, panels, utilities
- JS 模块化拆分（10 文件）：utils, config, scanner, titlebar, toggles, sidebar, loading, gallery, lightbox, panels
- main.js 精简为 315 行编排层，依赖注入模式
- Rust 端错误日志 (eprintln)

## 版本历史 / Changelog

| 版本 | 更新 |
|------|------|
| v1.5.0 | 自定义标题栏（融合式按钮）、快捷键提示/排序筛选高斯模糊开关动画、画廊导航栏 sticky 毛玻璃、侧边栏折叠高斯模糊、灯箱 z-index 修正、EXIF 尺寸标签读取优化、CSS/JS 全面模块化拆分（12+10 文件）、Rust 端错误日志、代理绕过黑屏修复、功能开关即时响应 |
| v1.4.0 | 筛选排序（自定义下拉菜单）、星级评分+收藏+辉光动画、RAW 预览（CR3/NEF/ARW/DNG/ORF）、设置面板开关控制 |
| v1.3.0 | 可展开设置面板（更多按钮）、EXIF 信息显示、缩略图密度三档调节、密度切换扫光转场动画 |
| v1.2.0 | 胶囊光环绕行加载动画、8线程并行缩略图、7天缓存自动清除、首次加载提示、缓存管理面板、全场丝滑入场动画、代码全面审查优化 |
| v1.1.x | 启动动画（LENS 移至左上角 + 背景高斯模糊渐清）、大批量照片卡顿修复 |
| v1.0.0 | 首个发布版：扫描、分类、画廊、灯箱、幻灯片、Finder 风格侧边栏、毛玻璃美学 |

## 下载 / Download

| 平台 | 链接 |
|------|------|
| GitHub | https://github.com/STARKAAAAAA/LENS_app/releases |
| Gitee | https://gitee.com/STARKAA/lens_app/releases |

## 开发 / Development

```bash
npm install
npm run tauri dev      # 开发模式
npm run tauri build    # 构建 NSIS 安装包
```

### 项目结构 / Project Structure

```
src/
├── index.html              # 入口 HTML
├── style.css               # CSS 入口 (@import 12 模块)
├── main.js                 # JS 入口 (编排层, ~315 行)
├── css/                    # CSS 模块 (12 文件)
│   ├── reset.css           #   CSS reset
│   ├── variables.css       #   CSS 变量 + @property
│   ├── base.css            #   基础排版布局
│   ├── titlebar.css        #   自定义标题栏
│   ├── toolbar.css         #   工具栏
│   ├── sidebar.css         #   侧边栏
│   ├── loading.css         #   加载画面
│   ├── hero.css            #   Hero 区域
│   ├── gallery.css         #   画廊 + 分类卡片 + 下拉
│   ├── lightbox.css        #   灯箱 + 幻灯片 + EXIF
│   ├── panels.css          #   设置面板 + 快捷键面板
│   └── utilities.css       #   响应式工具类
└── js/                     # JS 模块 (10 文件)
    ├── utils.js            #   工具函数
    ├── config.js           #   配置管理
    ├── scanner.js          #   文件夹扫描
    ├── titlebar.js         #   自定义标题栏
    ├── toggles.js          #   功能开关
    ├── sidebar.js          #   侧边栏渲染
    ├── loading.js          #   启动加载画面
    ├── gallery.js          #   画廊 + 排序筛选
    ├── lightbox.js         #   灯箱 + 幻灯片 + 评分
    └── panels.js           #   设置面板 + 快捷键面板
src-tauri/
├── Cargo.toml              # Rust 依赖
├── tauri.conf.json         # Tauri 配置
├── capabilities/           # 权限配置
└── src/main.rs             # Rust 后端 (缩略图引擎 + EXIF)
```

## 技术栈 / Tech Stack

- **前端 Frontend**: HTML, CSS (@layer, @import, @property, nesting, custom properties), Vanilla JS (ES Modules)
- **后端 Backend**: Rust (Tauri v2.10) — turbojpeg SIMD, image crate, kamadak-exif, 多线程并行
- **插件 Plugins**: tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell
- **构建 Bundler**: Vite 6
- **字体 Fonts**: Cormorant Garamond, Cormorant (Google Fonts)
- **架构 Architecture**: CSS 12 模块 @import + JS 10 模块依赖注入，main.js 315 行编排层

## 早期版本 / Legacy

- `legacy/web-portfolio/` — 纯 HTML/CSS/JS 网页版
- `legacy/python-desktop/` — Python + Tkinter 桌面版

## License

MIT
