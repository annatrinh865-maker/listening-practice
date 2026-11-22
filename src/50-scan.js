/* ===== 50-scan.js — 掃描增強（去陰影＋白底） / 匯出 PDF ===== */

/* 用積分圖做局部均值／標準差：
   gray 模式＝把每個像素除以它周圍的背景亮度（去掉陰影、紙底拉成純白）
   bw   模式＝Sauvola 二值化（局部門檻，暗處不會糊成一團黑） */
function enhanceCanvas(cv, mode) {
  const cx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const img = cx.getImageData(0, 0, W, H);
  const a = img.data;
  const n = W * H;

  const L = new Float32Array(n);
  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    L[p] = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
  }

  const W1 = W + 1;
  const S1 = new Float64Array((n) + W1 * 2);
  const S2 = new Float64Array((n) + W1 * 2);
  for (let y = 0; y < H; y++) {
    let rs = 0, rq = 0;
    const rowBase = (y + 1) * W1, prevBase = y * W1;
    for (let x = 0; x < W; x++) {
      const v = L[y * W + x];
      rs += v; rq += v * v;
      S1[rowBase + x + 1] = S1[prevBase + x + 1] + rs;
      S2[rowBase + x + 1] = S2[prevBase + x + 1] + rq;
    }
  }
  const rect = (S, x0, y0, x1, y1) =>
    S[y1 * W1 + x1] - S[y0 * W1 + x1] - S[y1 * W1 + x0] + S[y0 * W1 + x0];

  const r = Math.max(10, Math.round(W / 26));
  const k = 0.2, R = 128;
  const out = new Uint8ClampedArray(n);

  for (let y = 0; y < H; y++) {
    const y0 = y - r < 0 ? 0 : y - r;
    const y1 = y + r + 1 > H ? H : y + r + 1;
    for (let x = 0; x < W; x++) {
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r + 1 > W ? W : x + r + 1;
      const cnt = (x1 - x0) * (y1 - y0);
      const mean = rect(S1, x0, y0, x1, y1) / cnt;
      const v = L[y * W + x];
      let g;
      if (mode === 'bw') {
        const sq = rect(S2, x0, y0, x1, y1);
        const std = Math.sqrt(Math.max(0, sq / cnt - mean * mean));
        const T = mean * (1 + k * (std / R - 1));
        g = v > T ? 255 : 0;
      } else {
        g = mean > 4 ? (v / mean) * 244 : v;   // 除以局部背景 → 去陰影
        if (g > 226) g = 255;                  // 紙底純白
        if (g < 3) g = 0;
      }
      out[y * W + x] = g;
    }
  }

  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    a[i] = a[i + 1] = a[i + 2] = out[p];
    a[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return cv;
}

/* 用 dataURL 產生掃描版 dataURL */
function enhanceDataUrl(url, mode) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        cv.getContext('2d').drawImage(im, 0, 0);
        enhanceCanvas(cv, mode);
        res(cv.toDataURL('image/jpeg', 0.82));
      } catch (e) { rej(e); }
    };
    im.onerror = () => rej(new Error('圖片讀不進來'));
    im.src = url;
  });
}

/* 用瀏覽器內建的列印功能存成 PDF（手機：分享 → 列印 → 存成 PDF） */
function exportPDF(set) {
  const w = window.open('', '_blank');
  if (!w) return toast('請允許彈出視窗才能匯出');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(set.name)}</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { width: 100%; display: block; page-break-after: always; break-after: page; }
    img:last-child { page-break-after: auto; }
  </style></head><body>
  ${set.pages.map(p => `<img src="${p.url}" alt="">`).join('')}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };<\/script>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
