import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QStackedWidget,
    QWidget, QHBoxLayout, QPushButton, QLabel, QVBoxLayout
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont

from scanner import ScanThread, FolderWatcher
from widgets.category_view import CategoryView
from widgets.gallery_view import GalleryView
from widgets.lightbox import Lightbox
from widgets.slideshow import SlideshowWindow
from styles import THEME

PHOTO_DIR = r"G:\宣传部"


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("LENS")
        self.setMinimumSize(1000, 700)
        self.resize(1400, 900)
        self._data = {"categories": [], "photos": [], "by_category": {}}

        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # 顶栏
        bar = QWidget()
        bar.setFixedHeight(56)
        bl = QHBoxLayout(bar)
        bl.setContentsMargins(30, 0, 30, 0)

        t = QLabel("LENS")
        t.setObjectName("title")
        bl.addWidget(t)
        bl.addStretch()

        self._back = QPushButton("← 返回")
        self._back.setVisible(False)
        self._back.clicked.connect(self._show_cats)
        bl.addWidget(self._back)

        self._slide_btn = QPushButton("幻灯片")
        self._slide_btn.clicked.connect(self._start_slide)
        bl.addWidget(self._slide_btn)

        self._status = QLabel()
        self._status.setObjectName("dim")
        self._status.setText("扫描中…")
        bl.addWidget(self._status)

        root.addWidget(bar)

        sep = QWidget()
        sep.setFixedHeight(1)
        sep.setStyleSheet("background: #222;")
        root.addWidget(sep)

        # 视图栈
        self._stack = QStackedWidget()

        self._cat_view = CategoryView()
        self._cat_view.category_selected.connect(self._open_cat)
        self._stack.addWidget(self._cat_view)

        self._gal_view = GalleryView()
        self._gal_view.back_clicked.connect(self._show_cats)
        self._gal_view.photo_clicked.connect(self._open_lightbox)
        self._stack.addWidget(self._gal_view)

        root.addWidget(self._stack)

        # 扫描
        self._scan()
        QTimer.singleShot(1000, self._watch)

    def _scan(self):
        self._status.setText("扫描中…")
        self._t = ScanThread(PHOTO_DIR)
        self._t.finished.connect(self._on_scan)
        self._t.start()

    def _on_scan(self, data):
        self._data = data
        n, c = len(data['photos']), len(data['categories'])
        self._status.setText(f"{n} 张 · {c} 个分类")
        self._cat_view.set_data(data)

    def _watch(self):
        self._w = FolderWatcher(PHOTO_DIR, lambda: QTimer.singleShot(2000, self._scan))

    def _show_cats(self):
        self._back.setVisible(False)
        self._stack.setCurrentWidget(self._cat_view)

    def _open_cat(self, cat):
        photos = self._data['by_category'].get(cat, [])
        self._gal_view.set_photos(photos, cat)
        self._back.setVisible(True)
        self._stack.setCurrentWidget(self._gal_view)

    def _open_lightbox(self, idx):
        photos = self._gal_view.get_photos()
        if not photos:
            return
        lb = Lightbox(photos, idx, self)
        lb.setGeometry(self.geometry())
        lb.show()

    def _start_slide(self):
        if not self._photos:
            return
        s = SlideshowWindow(self._data['photos'])
        s.showFullScreen()

    @property
    def _photos(self):
        return self._data.get('photos', [])


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(THEME)
    w = MainWindow()
    w.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
