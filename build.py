#!/usr/bin/env python3
"""把 src/ 的片段串成單一 index.html，並複製到 app/ 與 Desktop。"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
BANK = os.path.join(ROOT, "bank")


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def parts(pattern, ext):
    names = sorted(n for n in os.listdir(SRC) if n.endswith(ext) and re.match(pattern, n))
    return "\n".join("/* ==== %s ==== */\n%s" % (n, read(n)) for n in names)


def bank_js():
    """把 bank/*.json 注入成 const BANK = {...};（builtinSet 用）"""
    files = sorted(n for n in os.listdir(BANK) if n.endswith(".json"))
    if not files:
        return "const BANK = null;"
    with open(os.path.join(BANK, files[0]), encoding="utf-8") as f:
        data = json.load(f)          # 順便驗證 JSON 合法
    assert data.get("questions"), "題庫沒有 questions"
    return "const BANK = " + json.dumps(data, ensure_ascii=False) + ";"


def build():
    head = read("00-head.html")
    css = parts(r"^\d\d-", ".css")
    js = bank_js() + "\n" + parts(r"^\d\d-", ".js")
    html = head.replace("__CSS__", css).replace("__JS__", js)
    out = os.path.join(ROOT, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    size = os.path.getsize(out)
    assert size > 5000, "build 太小，可能有片段沒讀到: %d bytes" % size
    # 同步 index.html 與 img/ 到 app/ 與桌面
    for target_dir in [
        os.path.join(ROOT, "app"),
        os.path.join(os.path.expanduser("~"), "Desktop", "聽力練習"),
    ]:
        os.makedirs(target_dir, exist_ok=True)
        shutil.copyfile(out, os.path.join(target_dir, "index.html"))
        src_img = os.path.join(ROOT, "img")
        dst_img = os.path.join(target_dir, "img")
        if os.path.isdir(src_img) and os.path.abspath(src_img) != os.path.abspath(dst_img):
            shutil.copytree(src_img, dst_img, dirs_exist_ok=True)
    print("built index.html (%d bytes, %d parts)" % (size, len(re.findall(r"/\* ====", html))))
    return 0


if __name__ == "__main__":
    sys.exit(build())
