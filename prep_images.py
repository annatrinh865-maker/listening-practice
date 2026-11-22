#!/usr/bin/env python3
"""把書頁照片縮小放進 app/img/（閱讀器用原圖放大看）。"""
import os
from PIL import Image, ImageOps

CACHE = os.path.expanduser("~/AppData/Local/hermes/cache/images")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")

MAP = {
    "p160": "img_c0e3ae41058f",
    "p161": "img_7fd31efe76b8",
    "p162": "img_0abc0d064519",
    "p163": "img_2b5da00ba6cd",
    "p164": "img_34b76d038beb",
    "p165": "img_adbb3545d554",
    "p166": "img_5840dd2a3517",
    "p167": "img_139cc5b8143c",
    "p168": "img_d8dada6c5965",
    "p169": "img_744f0465bf58",
    "p170": "img_9edd88e084bc",
    "p171": "img_47c98c6dbb72",
    "p172": "img_a312062053f6",
    "p173": "img_b3fe114728fb",
    "p174": "img_cf6f7502b56c",
    "p175": "img_85ecb0f3d911",
}


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, src in MAP.items():
        path = os.path.join(CACHE, src + ".jpeg")
        im = Image.open(path)
        im = ImageOps.exif_transpose(im).convert("RGB")
        w = 1400
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        dst = os.path.join(OUT, name + ".jpg")
        im.save(dst, "JPEG", quality=78, optimize=True)
        total += os.path.getsize(dst)
        print(name, im.size, round(os.path.getsize(dst) / 1024), "KB")
    print("total", round(total / 1024 / 1024, 1), "MB")


if __name__ == "__main__":
    main()
