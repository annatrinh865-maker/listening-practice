#!/usr/bin/env python3
"""把 src/ 的片段串成單一 index.html，並複製到 app/ 與 Desktop。"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def parts(pattern, ext):
    names = sorted(n for n in os.listdir(SRC) if n.endswith(ext) and re.match(pattern, n))
    return "\n".join("/* ==== %s ==== */\n%s" % (n, read(n)) if ext == ".js" else "/* ==== %s ==== */\n%s" % (n, read(n)) for n in names)


def build():
    head = read("00-head.html")
    css = parts(r"^\d\d-", ".css")
    js = parts(r"^\d\d-", ".js")
    html = head.replace("__CSS__", css).replace("__JS__", js)
    out = os.path.join(ROOT, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    size = os.path.getsize(out)
    assert size > 5000, "build 太小，可能有片段沒讀到: %d bytes" % size
    # 同步到 app/ 與桌面
    for target in [
        os.path.join(ROOT, "app", "index.html"),
        os.path.join(os.path.expanduser("~"), "Desktop", "聽力練習", "index.html"),
    ]:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(out, target)
    print("built index.html (%d bytes, %d parts)" % (size, len(re.findall(r"/\* ====", html))))
    return 0


if __name__ == "__main__":
    sys.exit(build())
