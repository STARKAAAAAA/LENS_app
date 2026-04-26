# LENS

摄影作品展示桌面应用，暗黑毛玻璃风格，支持文件夹扫描、分类浏览、瀑布流画廊、灯箱放大、幻灯片播放。

当前版本：**v1.2.1**

## 功能

### 启动动画
- Hero 背景 40px 高斯模糊渐清 (2.5s)
- LENS 标题从下方淡入屏幕中央 (1.8s)，装饰线展开
- 标题渐隐后，角落 LENS logo + 毛玻璃光斑同步淡入
- 角落 logo 可点击回到顶部

### 访达风格侧边栏
- 左侧悬浮圆角面板，自动隐藏，鼠标靠近左边缘滑出
- 多文件夹管理：添加、切换、删除，刷新后持久化
- 角落 LENS logo 与毛玻璃光斑实时跟随侧边栏位移

### 照片浏览
- 文件夹递归扫描，按子目录自动分类
- 分类卡片网格，hover 浮起 + 毛玻璃信息面板
- 瀑布流画廊，图片 hover 叠加标题
- 点击分类卡 Hero 同步切换为该分类照片
- 分类 ↔ 画廊平滑淡入淡出过渡

### 灯箱
- 鼠标滚轮缩放 (0.5x–8x)
- 拖拽平移、双击放大/还原
- 键盘方向键 / Esc 导航

### 幻灯片
- 全屏自动播放 (5s 间隔)
- 滚轮缩放、拖拽平移、双击适配窗口
- 底部毛玻璃控制栏，自动隐藏

### 视觉风格
- 暗黑底色 `#030303`，全面毛玻璃效果（backdrop-filter blur）
- Cormorant Garamond / Cormorant 衬线字体
- 路径标签、工具栏胶囊、加载按钮均为毛玻璃风格

## 版本历史

| 版本 | 主要更新 |
|------|---------|
| v1.2.1 | 启动动画完善、毛玻璃光斑、侧边栏联动 |
| v1.2.0 | 启动动画（LENS 移至左上角 + 背景高斯模糊） |
| v1.1.x | 访达侧边栏、全面毛玻璃改造、Hero/分类过渡 |
| v1.0.0 | 首个发布版：扫描、分类、画廊、灯箱、幻灯片 |

## 开发

```bash
npm install
npm run tauri dev      # 开发模式
npm run tauri build    # 构建 NSIS 安装包
```

## 技术栈

- **前端**: HTML, CSS (@layer, @property, CSS nesting), Vanilla JS
- **后端**: Rust (Tauri v2)
- **插件**: tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell
- **构建**: Vite
- **字体**: Cormorant Garamond, Cormorant (Google Fonts)

## 下载

| 平台 | 链接 |
|------|------|
| GitHub | https://github.com/STARKAAAAAA/LENS_app/releases |
| Gitee | https://gitee.com/STARKAA/lens_app/releases |

## 早期版本 (legacy/)

- `legacy/web-portfolio/` — 纯 HTML/CSS/JS 网页版，使用预扫描的 photos.js
- `legacy/python-desktop/` — Python + Tkinter 桌面版

## License

MIT
