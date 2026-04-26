from PyQt6.QtWidgets import (
    QWidget, QGridLayout, QScrollArea, QLabel,
    QVBoxLayout, QHBoxLayout, QPushButton
)
from PyQt6.QtCore import Qt, pyqtSignal, QThreadPool, QRunnable, QObject, QSize
from PyQt6.QtGui import QPixmap, QPainter, QColor, QImageReader

BATCH = 30
COL_W = 380  # 每列固定宽度


class _Signals(QObject):
    done = pyqtSignal(str, QPixmap)


class _Loader(QRunnable):
    def __init__(self, path, w):
        super().__init__()
        self.path, self.w = path, w
        self.s = _Signals()
        self.setAutoDelete(True)

    def run(self):
        r = QImageReader(self.path)
        r.setAutoTransform(True)
        o = r.size()
        if o.width() <= 0:
            return
        h = int(o.height() * self.w / o.width())
        r.setScaledSize(QSize(self.w, h))
        img = r.read()
        if not img.isNull():
            self.s.done.emit(self.path, QPixmap.fromImage(img))


class _Item(QWidget):
    clicked = pyqtSignal(int)

    def __init__(self, idx, path, w, parent=None):
        super().__init__(parent)
        self.idx = idx
        self._col_w = w
        self._px = None
        self._hover = False
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        # 初始固定尺寸（占位），避免加载时抖动
        self.setFixedSize(w, int(w * 0.67))

    def set_px(self, px):
        self._px = px
        # 保持宽度不变，只调整高度
        h = int(px.height() * self._col_w / px.width())
        self.setFixedSize(self._col_w, h)
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        if self._px:
            # 缩放到控件尺寸
            sc = self._px.scaled(self.width(), self.height(),
                                  Qt.AspectRatioMode.KeepAspectRatio,
                                  Qt.TransformationMode.SmoothTransformation)
            x = (self.width() - sc.width()) // 2
            y = 0
            p.drawPixmap(x, y, sc)
            if self._hover:
                p.fillRect(self.rect(), QColor(255, 255, 255, 20))
        else:
            p.fillRect(self.rect(), QColor("#141414"))
        p.end()

    def enterEvent(self, e):
        self._hover = True
        self.update()

    def leaveEvent(self, e):
        self._hover = False
        self.update()

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(self.idx)


class GalleryView(QWidget):
    back_clicked = pyqtSignal()
    photo_clicked = pyqtSignal(int)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._photos = []
        self._loaded = 0
        self._items = {}

        lay = QVBoxLayout(self)
        lay.setContentsMargins(40, 20, 40, 20)
        lay.setSpacing(0)

        bar = QHBoxLayout()
        bar.setContentsMargins(0, 0, 0, 20)
        b = QPushButton("← 返回")
        b.clicked.connect(self.back_clicked)
        bar.addWidget(b)
        bar.addStretch()
        self._title = QLabel()
        self._title.setObjectName("heading")
        bar.addWidget(self._title)
        bar.addStretch()
        bar.addWidget(QLabel())
        lay.addLayout(bar)

        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._scroll.verticalScrollBar().valueChanged.connect(self._on_scroll)

        self._container = QWidget()
        self._grid = QGridLayout(self._container)
        self._grid.setSpacing(6)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignHCenter)
        self._scroll.setWidget(self._container)
        lay.addWidget(self._scroll)

        self._pool = QThreadPool.globalInstance()
        self._pool.setMaxThreadCount(8)

    def set_photos(self, photos, category):
        self._photos = photos
        self._loaded = 0
        self._items.clear()
        self._title.setText(category)
        while self._grid.count():
            it = self._grid.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
        self._load_batch()

    def _load_batch(self):
        end = min(self._loaded + BATCH, len(self._photos))
        cols = 3
        row, col = self._loaded // cols, self._loaded % cols

        for i in range(self._loaded, end):
            ph = self._photos[i]
            item = _Item(i, ph['path'], COL_W)
            item.clicked.connect(self.photo_clicked)
            self._grid.addWidget(item, row, col, Qt.AlignmentFlag.AlignTop)
            self._items[ph['path']] = item

            ld = _Loader(ph['path'], COL_W)
            ld.s.done.connect(self._on_loaded)
            self._pool.start(ld)

            col += 1
            if col >= cols:
                col = 0
                row += 1
        self._loaded = end

    def _on_loaded(self, path, px):
        if path in self._items:
            self._items[path].set_px(px)

    def _on_scroll(self, v):
        sb = self._scroll.verticalScrollBar()
        if v >= sb.maximum() - 200 and self._loaded < len(self._photos):
            self._load_batch()

    def get_photos(self):
        return self._photos
