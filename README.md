# LENS &middot; 优雅的摄影作品画廊

> 告别简陋的照片查看器。LENS 专为摄影师和摄影爱好者打造，提供沉浸式的作品浏览体验。

> *Stop settling for clunky photo viewers. LENS is a gallery app crafted for photographers, delivering an immersive way to browse your work.*

---

当前版本 Current version: **v1.5.0**

## 为什么选择 LENS / Why LENS

市面上的照片查看器要么简陋粗糙，要么过度复杂。LENS 填补了空白——一款专注于「浏览体验」的桌面照片画廊。毛玻璃美学、丝滑动画、智能缓存，让每一张作品都以最好的方式呈现。

*Most photo viewers are either bare-bones or bloated. LENS fills the gap — a desktop gallery focused purely on the browsing experience. Frosted glass aesthetics, fluid animations, and smart caching present every shot at its best.*

## 功能 / Features

### 启动体验 / Startup
- 全屏 Hero 背景高斯模糊渐清 (2.8s)
- LENS 标题居中淡入，金线装饰展开，随后移至左上角
- 暖金光斑与毛玻璃效果同步淡入
- 加载画面：胶囊型光环绕行动画，摄影金句轮播

### 侧边栏 / Sidebar
- Finder 风格悬浮圆角面板，靠近左边缘探出，点击展开
- 多文件夹管理：添加、切换、删除，自动持久化
- 角落 LENS logo 实时跟随侧边栏位移

### 浏览 / Browsing
- 文件夹递归扫描，按子目录自动分类
- 分类卡片网格，hover 浮起 + 暖金叠加层
- 瀑布流画廊（CSS columns），hover 标题叠加
- Hero / 分类 / 画廊平滑过渡
- 画廊打开即全部预加载，滚动零卡顿

### 灯箱 / Lightbox
- 滚轮缩放 0.5x–8x，拖拽平移
- 双击放大 / 还原，键盘方向键导航
- 毛玻璃控制按钮，入场旋转动画

### 幻灯片 / Slideshow
- 全屏自动播放 (5s)，随机顺序
- 滚轮缩放、拖拽平移、双击适配窗口
- 底部毛玻璃控制栏，自动隐藏

### 性能 / Performance
- Rust 端 8 线程并行生成 480px 缩略图缓存
- 首次加载提速 5–8 倍，后续启动秒开
- 缓存持久化至磁盘，超过 7 天自动清除
- 分类卡片全部预加载，画廊图片一次性载入

### 视觉 / Design
- 暖黑底色 `#0a0a08`，暖金强调色 `#c8a87c`
- 全面毛玻璃效果 (backdrop-filter blur)
- Cormorant Garamond / Cormorant 衬线字体
- cubic-bezier(0.16, 1, 0.3, 1) 统一缓出曲线
- 全部交互均配有丝滑入场/退场动画

## 版本历史 / Changelog

| 版本 | 更新 |
|------|------|
| v1.5.0 | 灯箱底部胶片条（水平缩略图条）、点击跳转、自动滚动到当前照片、设置面板开关控制 |
| v1.4.0 | 可展开设置面板（更多按钮）、EXIF 信息显示、星级评分+收藏、缩略图密度三档调节、密度切换扫光转场动画 |
| v1.3.0 | 胶囊光环绕行加载动画、8线程并行缩略图、7天缓存自动清除、首次加载提示、缓存管理面板、全场丝滑入场动画、代码全面审查优化 |
| v1.2.4 | 大批量照片 (196+) 卡顿修复、缩略图生成加速 |
| v1.2.0 | 启动动画（LENS 移至左上角 + 背景高斯模糊渐清） |
| v1.1.x | Finder 风格侧边栏、全面毛玻璃改造、Hero/分类过渡 |
| v1.0.0 | 首个发布版：扫描、分类、画廊、灯箱、幻灯片 |

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

## 技术栈 / Tech Stack

- **前端 Frontend**: HTML, CSS (@layer, nesting, custom properties), Vanilla JS
- **后端 Backend**: Rust (Tauri v2) — image 缩略图引擎, 多线程并行
- **插件 Plugins**: tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell
- **构建 Bundler**: Vite
- **字体 Fonts**: Cormorant Garamond, Cormorant (Google Fonts)

## 早期版本 / Legacy

- `legacy/web-portfolio/` — 纯 HTML/CSS/JS 网页版
- `legacy/python-desktop/` — Python + Tkinter 桌面版

## License

MIT
