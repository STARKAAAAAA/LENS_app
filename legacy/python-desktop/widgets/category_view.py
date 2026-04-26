from PyQt6.QtWidgets import (
    QWidget, QGridLayout, QScrollArea, QLabel,
    QVBoxLayout, QHBoxLayout
)
from PyQt6.QtCore import Qt, pyqtSignal, QThreadPool, QRunnable, QObject, QSize
from PyQt6.QtGui import QPixmap, QPainter, QColor, QImageReader, QLinearGradient


class _Signals(QObject):
    done = pyqtSignal(str, QPixmap)


class _Loader(QRunnable):
    def __init__(self, path, w, h):
        super().__init__()
        self.path, self.w, self.h = path, w, h
        self.s = _Signals()
        self.setAutoDelete(True)

    def run(self):
        r = QImageReader(self.path)
        r.setAutoTransform(True)
        o = r.size()
        if o.width() <= 0:
            return
        s = self.w / max(o.width(), o.height())
        r.setScaledSize(QSize(max(1, int(o.width() * s)), max(1, int(o.height() * s))))
        img = r.read()
        if not img.isNull():
            self.s.done.emit(self.path, QPixmap.fromImage(img))


class _Card(QWidget):
    clicked = pyqtSignal(str)

    def __init__(self, cat, count, path, parent=None):
        super().__init__(parent)
        self.cat, self.count, self.path = cat, count, path
        self._px = None
        self._hover = False
        self.setFixedSize(260, 330)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def set_px(self, px):
        self._px = px
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()
        img_h = h - 56

        # 背景
        p.fillRect(0, 0, w, h, QColor("#141414"))

        # 封面
        if self._px:
            sc = self._px.scaled(w, img_h, Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                                  Qt.TransformationMode.SmoothTransformation)
            x = max(0, (sc.width() - w) // 2)
            y = max(0, (sc.height() - img_h) // 2)
            p.drawPixmap(0, 0, sc, x, y, w, img_h)
        else:
            p.fillRect(0, 0, w, img_h, QColor("#1a1a1a"))

        # 渐变
        g = QLinearGradient(0, img_h - 80, 0, img_h)
        g.setColorAt(0, QColor(10, 10, 10, 0))
        g.setColorAt(1, QColor(10, 10, 10, 220))
        p.fillRect(0, img_h - 80, w, 80, g)

        # 悬停高亮
        if self._hover:
            p.fillRect(0, 0, w, img_h, QColor(255, 255, 255, 15))

        # 文字
        p.setPen(QColor("#f5f5f5"))
        f = p.font()
        f.setPixelSize(13)
        p.setFont(f)
        p.drawText(12, h - 40, w - 24, 22, Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter, self.cat)

        p.setPen(QColor("#888"))
        f.setPixelSize(11)
        p.setFont(f)
        p.drawText(12, h - 22, w - 24, 18, Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter, f"{self.count} 张")

        p.end()

    def enterEvent(self, e):
        self._hover = True
        self.update()

    def leaveEvent(self, e):
        self._hover = False
        self.update()

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(self.cat)


class CategoryView(QScrollArea):
    category_selected = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWidgetResizable(True)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._pool = QThreadPool.globalInstance()
        self._pool.setMaxThreadCount(8)

        self._box = QWidget()
        lay = QVBoxLayout(self._box)
        lay.setContentsMargins(40, 20, 40, 40)
        lay.setSpacing(0)

        t = QLabel("SELECTED WORKS")
        t.setObjectName("heading")
        t.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(t)
        lay.addSpacing(28)

        self._grid_w = QWidget()
        self._grid = QGridLayout(self._grid_w)
        self._grid.setSpacing(16)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        lay.addWidget(self._grid_w)
        lay.addStretch()

        self.setWidget(self._box)

    def set_data(self, data):
        while self._grid.count():
            it = self._grid.takeAt(0)
            if it.widget():
                it.widget().deleteLater()

        by_cat = data.get('by_category', {})
        r, c = 0, 0
        cols = 4

        for cat in data.get('categories', []):
            photos = by_cat.get(cat, [])
            if not photos:
                continue
            card = _Card(cat, len(photos), photos[0]['path'])
            card.clicked.connect(self.category_selected)
            self._grid.addWidget(card, r, c, Qt.AlignmentFlag.AlignCenter)

            ld = _Loader(photos[0]['path'], 260, 274)
            ld.s.done.connect(lambda _, px, cr=card: cr.set_px(px))
            self._pool.start(ld)

            c += 1
            if c >= cols:
                c = 0
                r += 1
