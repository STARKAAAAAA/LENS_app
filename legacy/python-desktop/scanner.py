import os
import re
from PyQt6.QtCore import QThread, pyqtSignal, QFileSystemWatcher


class ScanThread(QThread):
    """后台扫描线程，避免阻塞 UI"""
    finished = pyqtSignal(dict)  # {"categories": [...], "photos": [...]}

    def __init__(self, base_path):
        super().__init__()
        self.base_path = base_path

    def run(self):
        data = scan_photos(self.base_path)
        self.finished.emit(data)


def clean_category(dirname):
    """去掉文件夹名前的日期前缀，如 '2025 10 15任务' → '任务'"""
    name = dirname.strip()
    m = re.match(r'^\d{4}\s+\d{1,2}\s+\d{1,2}\s*(.*)', name)
    if m and m.group(1):
        return m.group(1).strip()
    return name


def clean_title(filename):
    """去掉 DxO 处理软件的后缀"""
    name = os.path.splitext(filename)[0]
    name = re.sub(r'-DxO_DeepPRIME\s*XD2?s?', '', name)
    name = re.sub(r'-CR3_DxO_DeepPRIMEXD', '', name)
    return name.strip()


def scan_photos(base_path):
    """扫描目录，返回分类和照片数据"""
    photos = []

    if not os.path.isdir(base_path):
        return {"categories": [], "photos": []}

    for root, dirs, files in os.walk(base_path):
        for f in files:
            if not f.lower().endswith('.jpg'):
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, base_path)

            parts = rel.replace('\\', '/').split('/')
            top_folder = parts[0]
            category = clean_category(top_folder)
            title = clean_title(f)

            photos.append({
                'path': full,
                'category': category,
                'title': title,
                'folder': top_folder
            })

    photos.sort(key=lambda p: p['folder'])
    categories = list(dict.fromkeys(p['category'] for p in photos))

    # 按分类分组
    by_category = {}
    for p in photos:
        by_category.setdefault(p['category'], []).append(p)

    return {
        'categories': categories,
        'photos': photos,
        'by_category': by_category
    }


class FolderWatcher:
    """封装 QFileSystemWatcher，监控文件夹变化"""

    def __init__(self, base_path, callback):
        self.base_path = base_path
        self.callback = callback
        self.watcher = QFileSystemWatcher()
        self._setup_watcher()

    def _setup_watcher(self):
        if os.path.isdir(self.base_path):
            self.watcher.addPath(self.base_path)
            # 也监控子文件夹
            for entry in os.scandir(self.base_path):
                if entry.is_dir():
                    self.watcher.addPath(entry.path)
        self.watcher.directoryChanged.connect(self._on_changed)

    def _on_changed(self, path):
        # 更新子文件夹监控列表
        self.watcher.removePaths(self.watcher.directories())
        self._setup_watcher()
        self.callback()
