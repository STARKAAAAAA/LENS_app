import random
from PyQt6.QtWidgets import (
    QWidget, QLabel, QVBoxLayout, QHBoxLayout,
    QPushButton, QGraphicsOpacityEffect
)
from PyQt6.QtCore import Qt, QTimer, QPropertyAnimation, QSize, QPoint
from PyQt6.QtGui import QPixmap, QImageReader, QPainter, QKeyEvent, QWheelEvent, QMouseEvent


class SlideshowWindow(QWidget):
    """全屏幻灯片 — 自动播放 + 缩放 + 平移"""

    def __init__(self, photos, parent=None):
        super().__init__(parent)
        self._photos = list(photos)
        random.shuffle(self._photos)
        self._idx = 0
        self._paused = False
        self._px = None
        self._zoom = 1.0
        self._fit_zoom = 1.0
        self._pan = QPoint()
        self._dragging = False
        self._drag_prev = QPoint()

        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setStyleSheet("background-color: #0a0a0a;")
        self.setMouseTracking(True)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # 占位画布（实际绘制在自身 paintEvent）
        outer.addStretch(1)

        # 底栏
        self._bar = QWidget()
        self._bar.setStyleSheet("background: transparent;")
        bot = QHBoxLayout(self._bar)
        bot.setContentsMargins(20, 10, 20, 16)
        bot.setSpacing(8)

        self._counter = QLabel()
        self._counter.setStyleSheet("color: #888; font-size: 13px; background: transparent;")
        bot.addWidget(self._counter)

        self._zoom_lbl = QLabel("适配")
        self._zoom_lbl.setStyleSheet("color: #666; font-size: 12px; background: transparent;")
        bot.addWidget(self._zoom_lbl)
        bot.addStretch()

        for text, slot in [
            ("← 上一张", self.prev),
            ("暂停", None),  # placeholder
            ("下一张 →", self.next),
            ("−", self.zoom_out),
            ("适配", self.fit),
            ("+", self.zoom_in),
            ("1:1", self.orig),
            ("退出", self._quit),
        ]:
            b = QPushButton(text)
            b.setObjectName("navBtn")
            if text == "−" or text == "+":
                b.setFixedWidth(36)
            if text == "暂停":
                self._pause_btn = b
                b.clicked.connect(self.toggle_pause)
            else:
                b.clicked.connect(slot)
            bot.addWidget(b)

        outer.addWidget(self._bar)

        # 自动隐藏
        self._hide_timer = QTimer(self)
        self._hide_timer.setInterval(3000)
        self._hide_timer.timeout.connect(self._hide_bar)
        self._hide_timer.start()

        # 自动播放
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._auto_next)
        self._timer.start(5000)

        # 淡入淡出
        self._opacity = 1.0
        self._fade_out = QTimer(self)
        self._fade_out.setInterval(30)
        self._fade_out.timeout.connect(self._fade_step)

        self._fade_dir = 0  # 0=none, -1=fading out, 1=fading in
        self._pending_next = False

        self._load()

    def paintEvent(self, _):
        if not self._px:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        p.setOpacity(self._opacity)

        sw = int(self._px.width() * self._zoom)
        sh = int(self._px.height() * self._zoom)
        bar_h = self._bar.height() if self._bar.isVisible() else 0
        area_h = self.height() - bar_h
        sx = (self.width() - sw) // 2 + self._pan.x()
        sy = (area_h - sh) // 2 + self._pan.y()

        p.drawPixmap(sx, sy, sw, sh, self._px)
        p.end()

    def mouseMoveEvent(self, _):
        self._bar.show()
        self._hide_timer.start()

    def _hide_bar(self):
        if not self._paused:
            self._bar.hide()

    def _load(self):
        if not self._photos:
            return
        ph = self._photos[self._idx % len(self._photos)]
        r = QImageReader(ph['path'])
        r.setAutoTransform(True)
        img = r.read()
        self._px = QPixmap.fromImage(img) if not img.isNull() else QPixmap(ph['path'])
        self._pan = QPoint()
        self.fit()
        self._counter.setText(f"{self._idx + 1} / {len(self._photos)}")

    def fit(self):
        if not self._px:
            return
        bar_h = self._bar.height() if self._bar.isVisible() else 0
        vw, vh = self.width(), self.height() - bar_h
        self._fit_zoom = min(vw / self._px.width(), vh / self._px.height(), 1.0)
        self._zoom = self._fit_zoom
        self._pan = QPoint()
        self._update_zoom_lbl()
        self.update()

    def zoom_in(self):
        self._zoom = min(self._zoom * 1.3, 6.0)
        self._update_zoom_lbl()
        self.update()

    def zoom_out(self):
        self._zoom = max(self._zoom / 1.3, 0.03)
        self._update_zoom_lbl()
        self.update()

    def orig(self):
        self._zoom = 1.0
        self._pan = QPoint()
        self._update_zoom_lbl()
        self.update()

    def _update_zoom_lbl(self):
        if abs(self._zoom - self._fit_zoom) < 0.02:
            self._zoom_lbl.setText("适配")
        elif abs(self._zoom - 1.0) < 0.02:
            self._zoom_lbl.setText("1:1")
        else:
            self._zoom_lbl.setText(f"{int(self._zoom * 100)}%")

    def wheelEvent(self, e: QWheelEvent):
        if e.angleDelta().y() > 0:
            self._zoom = min(self._zoom * 1.12, 6.0)
        else:
            self._zoom = max(self._zoom / 1.12, 0.03)
        self._update_zoom_lbl()
        self.update()

    def mouseDoubleClickEvent(self, _):
        self.fit()

    def mousePressEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._dragging = True
            self._drag_prev = e.globalPosition().toPoint()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif e.button() == Qt.MouseButton.RightButton:
            self._quit()

    def mouseMoveEvent(self, e):
        # 兼容 QMouseEvent
        if hasattr(e, 'globalPosition'):
            if self._dragging:
                pos = e.globalPosition().toPoint()
                self._pan += pos - self._drag_prev
                self._drag_prev = pos
                self.update()
        self._bar.show()
        self._hide_timer.start()

    def mouseReleaseEvent(self, e: QMouseEvent):
        if e.button() == Qt.MouseButton.LeftButton:
            self._dragging = False
            self.setCursor(Qt.CursorShape.ArrowCursor)

    # 播放控制
    def _auto_next(self):
        if self._paused:
            return
        self._fade_dir = -1
        self._fade_out.start()

    def _fade_step(self):
        if self._fade_dir == -1:
            self._opacity = max(0.0, self._opacity - 0.06)
            if self._opacity <= 0:
                self._fade_out.stop()
                self._idx = (self._idx + 1) % len(self._photos)
                self._load()
                self._fade_dir = 1
                self._fade_out.start()
        elif self._fade_dir == 1:
            self._opacity = min(1.0, self._opacity + 0.06)
            if self._opacity >= 1.0:
                self._fade_out.stop()
                self._fade_dir = 0
        self.update()

    def next(self):
        self._idx = (self._idx + 1) % len(self._photos)
        self._load()

    def prev(self):
        self._idx = (self._idx - 1) % len(self._photos)
        self._load()

    def toggle_pause(self):
        self._paused = not self._paused
        self._pause_btn.setText("继续" if self._paused else "暂停")
        if self._paused:
            self._bar.show()
            self._hide_timer.stop()
        else:
            self._hide_timer.start()

    def _quit(self):
        self._timer.stop()
        self._fade_out.stop()
        self.close()

    def keyPressEvent(self, e: QKeyEvent):
        k = e.key()
        if k == Qt.Key.Key_Escape:
            self._quit()
        elif k == Qt.Key.Key_Space:
            self.toggle_pause()
        elif k == Qt.Key.Key_Right:
            self.next()
        elif k == Qt.Key.Key_Left:
            self.prev()
        elif k in (Qt.Key.Key_Plus, Qt.Key.Key_Equal):
            self.zoom_in()
        elif k == Qt.Key.Key_Minus:
            self.zoom_out()
        elif k == Qt.Key.Key_0:
            self.fit()
        elif k == Qt.Key.Key_1:
            self.orig()
