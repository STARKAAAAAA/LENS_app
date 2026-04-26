# LENS

摄影作品展示应用，支持文件夹扫描、分类浏览、画廊、灯箱放大、幻灯片播放。

## 版本

### Tauri 桌面版（主版本）

`tauri-app/` — 使用 Tauri v2 + WebView2 构建的原生桌面应用

- 文件夹选择与递归扫描
- 分类卡片浏览
- 瀑布流画廊
- 灯箱（鼠标滚轮缩放、拖拽平移）
- 幻灯片自动播放
- Apple Liquid Glass 液态玻璃 UI

```bash
npm install
npm run tauri dev    # 开发
npm run tauri build  # 构建安装包
```

### 早期版本（legacy/）

- `legacy/python-desktop/` — Python + Tkinter 桌面版
- `legacy/web-portfolio/` — 纯 HTML/CSS/JS 网页版

## 技术栈

- **前端**: HTML, CSS (@property, @layer, CSS nesting), Vanilla JS
- **后端**: Rust (Tauri v2)
- **插件**: tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell
- **字体**: Cormorant Garamond, Cormorant (Google Fonts)
