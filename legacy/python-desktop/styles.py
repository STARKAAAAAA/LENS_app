THEME = """
* {
    font-family: "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif;
}

/* 基础 */
QMainWindow, QDialog, QWidget {
    background-color: #0a0a0a;
    color: #f5f5f5;
}

/* 标题 */
QLabel#title {
    font-size: 22px;
    font-weight: 300;
    letter-spacing: 8px;
    color: #f5f5f5;
    background: transparent;
}

QLabel#heading {
    font-size: 18px;
    font-weight: 300;
    letter-spacing: 4px;
    color: #f5f5f5;
}

QLabel#dim {
    color: #666;
    font-size: 12px;
}

/* 按钮 */
QPushButton {
    background: transparent;
    color: #999;
    border: 1px solid #333;
    padding: 6px 16px;
    font-size: 13px;
}

QPushButton:hover { color: #f5f5f5; border-color: #555; }
QPushButton:pressed { background: #1a1a1a; }

QPushButton#closeBtn {
    border: none;
    font-size: 16px;
    padding: 4px 8px;
}

QPushButton#closeBtn:hover { color: #fff; }

/* 滚动条 */
QScrollArea { border: none; }

QScrollBar:vertical {
    width: 6px; background: #0a0a0a; margin: 0;
}
QScrollBar::handle:vertical {
    background: #333; min-height: 30px; border-radius: 3px;
}
QScrollBar::handle:vertical:hover { background: #555; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
"""
