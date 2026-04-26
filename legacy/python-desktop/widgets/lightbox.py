from PyQt6.QtWidgets import QDialog, QLabel, QPushButton, QVBoxLayout, QHBoxLayout, QWidget
from PyQt6.QtCore import Qt, QSize, QPoint
from PyQt6.QtGui import QPixmap, QImageReader, QPainter, QKeyEvent, QWheelEvent, QMouseEvent


class _ImageCanvas(QDialog):
    """用 paintEvent 直接绘制缩放图片，无 QScrollArea"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._px = None          # 原始 pixmap
        self._zoom = 1.0
        self._pan = QPoint()     # 平移偏移
        self._dragging = False
        self._drag_prev = QPoint()

        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Dialog)
        self.setStyleSheet("background-color: rgba(0, 0, 0, 245);")
        self.setModal(True)
        self.setMouseTracking(True)

        # 布局：顶部栏 + 图片画布 + 底部栏
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # 顶栏
        top = QHBoxLayout()
        top.setContentsMargins(20, 12, 20, 12)
        self._counter = QLabel()
        self._counter.setStyleSheet("color: #888; font-size: 13px;")
        top.addWidget(self._counter)
        top.addStretch()
        self._zoom_lbl = QLabel("适配")
        self._zoom_lbl.setStyleSheet("color: #666; font-size: 12px;")
        top.addWidget(self._zoom_lbl)
        top.addSpacing(8)
        x = QPushButton("✕")
        x.setObjectName("closeBtn")
        x.clicked.connect(self.close)
        top.addWidget(x)
        outer.addLayout(top)

        # 图片区（用一个占位 widget 接管 paintEvent）
        self._canvas = _Canvas(self)
        outer.addWidget(self._canvas, 1)

        # 底栏
        bot = QHBoxLayout()
        bot.setContentsMargins(20, 10, 20, 14)
        bot.setSpacing(8)

        for text, slot in [
            ("← 上一张", self.prev),
            ("−", self.zoom_out),
            ("适配", self.fit),
            ("+", self.zoom_in),
            ("1:1", self.orig),
            ("下一张 →", self.next),
        ]:
            b = QPushButton(text)
            b.setObjectName("navBtn")
            if text in ("−", "+"):
                b.setFixedWidth(36)
            b.clicked.connect(slot)
            bot.addWidget(b)
            if text == "← 上一张":
                bot.addStretch()
            elif text == "下一张 →":
                pass  # last

        outer.addLayout(bot)

    def load(self, path):
        self._pan = QPoint()
        r = QImageReader(path)
        r.setAutoTransform(True)
        img = r.read()
        self._canvas._px = QPixmap.fromImage(img) if not img.isNull() else QPixmap(path)
        self.fit()

    def _apply(self):
        self._canvas._zoom = self._zoom
        self._canvas._pan = self._pan
        self._canvas.update()

        if abs(self._zoom - self._fit_zoom) < 0.02:
            self._zoom_lbl.setText("适配")
        elif abs(self._zoom - 1.0) < 0.02:
            self._zoom_lbl.setText("1:1")
        else:
            self._zoom_lbl.setText(f"{int(self._zoom * 100)}%")

    def fit(self):
        px = self._canvas._px
        if not px:
            return
        vw, vh = self._canvas.width(), self._canvas.height()
        self._fit_zoom = min(vw / px.width(), vh / px.height(), 1.0)
        self._zoom = self._fit_zoom
        self._pan = QPoint()
        self._apply()

    def zoom_in(self):
        self._zoom = min(self._zoom * 1.3, 6.0)
        self._apply()

    def zoom_out(self):
        self._zoom = max(self._zoom / 1.3, 0.03)
        self._apply()

    def orig(self):
        self._zoom = 1.0
        self._pan = QPoint()
        self._apply()

    def prev(self):
        pass  # overridden

    def next(self):
        pass  # overridden

    def resizeEvent(self, e):
        super().resizeEvent(e)
        if hasattr(self, '_fit_zoom'):
            self._apply()

    def wheelEvent(self, e: QWheelEvent):
        if e.angleDelta().y() > 0:
            self._zoom = min(self._zoom * 1.12, 6.0)
        else:
            self._zoom = max(self._zoom / 1.12, 0.03)
        self._apply()

    def mouseDoubleClickEvent(self, _):
        self.fit()

    def keyPressEvent(self, e: QKeyEvent):
        k = e.key()
        if k == Qt.Key.Key_Escape:
            self.close()
        elif k == Qt.Key.Key_Left:
            self.prev()
        elif k == Qt.Key.Key_Right:
            self.next()
        elif k in (Qt.Key.Key_Plus, Qt.Key.Key_Equal):
            self.zoom_in()
        elif k == Qt.Key.Key_Minus:
            self.zoom_out()
        elif k == Qt.Key.Key_0:
            self.fit()
        elif k == Qt.Key.Key_1:
            self.orig()


class _Canvas(QWidget):
    """纯绘制画布，paintEvent 里居中 + 缩放 + 平移绘制图片"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._px = None
        self._zoom = 1.0
        self._pan = QPoint()
        self._dragging = False
        self._drag_prev = QPoint()
        self.setMouseTracking(True)

    def paintEvent(self, _):
        if not self._px:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)

        # 计算绘制区域
        sw = int(self._px.width() * self._zoom)
        sh = int(self._px.height() * self._zoom)
        sx = (self.width() - sw) // 2 + self._pan.x()
        sy = (self.height() - sh) // 2 + self._pan.y()

        p.drawPixmap(sx, sy, sw, sh, self._px)
        p.end()

    def mousePressEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._dragging = True
            self._drag_prev = e.globalPosition().toPoint()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)

    def mouseMoveEvent(self, e: QMouseEvent):
        if self._dragging:
            pos = e.globalPosition().toPoint()
            delta = pos - self._drag_prev
            self._pan += delta
            self._drag_prev = pos
            self.update()

    def mouseReleaseEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._dragging = False
            self.setCursor(Qt.CursorShape.ArrowCursor)


class Lightbox(_ImageCanvas):
    """灯箱 — 查看照片，滚轮缩放，拖拽平移"""

    def __init__(self, photos, start=0, parent=None):
        super().__init__(parent)
        self._photos = photos
        self._idx = start
        self._loaded = False
        self._show()
        self._update_info()

    def showEvent(self, event):
        super().showEvent(event)
        # 窗口显示后再加载和适配，此时尺寸才正确
        if not self._loaded:
            self.load(self._photos[self._idx]['path'])
            self._loaded = True
        self.fit()

    def _show(self):
        self._counter.setText(f"{self._idx + 1} / {len(self._photos)}")

    def prev(self):
        if len(self._photos) <= 1:
            return
        self._idx = (self._idx - 1) % len(self._photos)
        self.load(self._photos[self._idx]['path'])
        self._update_info()

    def next(self):
        if len(self._photos) <= 1:
            return
        self._idx = (self._idx + 1) % len(self._photos)
        self.load(self._photos[self._idx]['path'])
        self._update_info()

    def _update_info(self):
        self._counter.setText(f"{self._idx + 1} / {len(self._photos)}")
