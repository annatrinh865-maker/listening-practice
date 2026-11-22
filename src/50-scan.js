/* ===== 50-scan.js — 掃描：找頁面四角 → 透視拉正 → 去陰影/白底 ===== */

function canvasOf(img) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth || img.width;
  cv.height = img.naturalHeight || img.height;
  cv.getContext('2d').drawImage(img, 0, 0);
  return cv;
}
function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('圖片讀不進來'));
    im.src = url;
  });
}

/* ---- 1. 找文件四角（Otsu → 最大亮區 → 極值四點） ---- */
function detectCorners(cv) {
  const W = cv.width, H = cv.height;
  const SW = 260;
  const SH = Math.max(1, Math.round(H * SW / W));
  const sc = document.createElement('canvas');
  sc.width = SW; sc.height = SH;
  const sx = sc.getContext('2d');
  sx.drawImage(cv, 0, 0, SW, SH);
  const d = sx.getImageData(0, 0, SW, SH).data;

  const N = SW * SH;
  const g = new Uint8Array(N);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    g[p] = v; hist[v]++;
  }
  // Otsu
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (!wB) continue;
    const wF = N - wB;
    if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = v; }
  }

  // 最大連通亮區
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  let bestPixels = null, bestCount = 0;
  for (let start = 0; start < N; start++) {
    if (seen[start] || g[start] <= thr) continue;
    let top = 0, count = 0;
    const list = [];
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const cur = stack[--top];
      list.push(cur); count++;
      const x = cur % SW, y = (cur / SW) | 0;
      if (x > 0 && !seen[cur - 1] && g[cur - 1] > thr) { seen[cur - 1] = 1; stack[top++] = cur - 1; }
      if (x < SW - 1 && !seen[cur + 1] && g[cur + 1] > thr) { seen[cur + 1] = 1; stack[top++] = cur + 1; }
      if (y > 0 && !seen[cur - SW] && g[cur - SW] > thr) { seen[cur - SW] = 1; stack[top++] = cur - SW; }
      if (y < SH - 1 && !seen[cur + SW] && g[cur + SW] > thr) { seen[cur + SW] = 1; stack[top++] = cur + SW; }
    }
    if (count > bestCount) { bestCount = count; bestPixels = list; }
  }

  const fallback = [[0, 0], [W, 0], [W, H], [0, H]];
  if (!bestPixels || bestCount < N * 0.18) return fallback;

  let minS = 1e9, maxS = -1e9, minD = 1e9, maxD = -1e9;
  // 用「最極端的一小群點的平均」當角點，避免單一雜點把角拉歪
  const k = Math.max(6, Math.floor(bestPixels.length * 0.004));
  const pick = (metric, dir) => {
    const arr = [];
    for (let i = 0; i < bestPixels.length; i++) {
      const idx = bestPixels[i];
      const x = idx % SW, y = (idx / SW) | 0;
      const v = dir * metric(x, y);
      if (arr.length < k) { arr.push([v, x, y]); if (arr.length === k) arr.sort((a, b) => a[0] - b[0]); }
      else if (v < arr[k - 1][0]) { arr[k - 1] = [v, x, y]; arr.sort((a, b) => a[0] - b[0]); }
    }
    if (!arr.length) return null;
    let sx = 0, sy = 0;
    for (const p of arr) { sx += p[1]; sy += p[2]; }
    return [sx / arr.length, sy / arr.length];
  };
  const TL = pick((x, y) => x + y, 1);
  const BR = pick((x, y) => x + y, -1);
  const TR = pick((x, y) => x - y, -1);
  const BL = pick((x, y) => x - y, 1);
  if (!TL || !TR || !BR || !BL) return fallback;
  const kx = W / SW, ky = H / SH;
  const pts = [TL, TR, BR, BL].map(p => [Math.round(p[0] * kx), Math.round(p[1] * ky)]);
  // 面積太小 → 用整張
  const area = Math.abs(
    (pts[0][0] * pts[1][1] - pts[1][0] * pts[0][1]) + (pts[1][0] * pts[2][1] - pts[2][0] * pts[1][1]) +
    (pts[2][0] * pts[3][1] - pts[3][0] * pts[2][1]) + (pts[3][0] * pts[0][1] - pts[0][0] * pts[3][1])
  ) / 2;
  if (area < W * H * 0.2) return fallback;
  // 往外放 1.5%：自動偵測容易往內縮，寧可多留一點白邊也不要切到字
  const cx0 = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
  const cy0 = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
  const grow = 1.015;
  return pts.map(p => [
    Math.max(0, Math.min(W, Math.round(cx0 + (p[0] - cx0) * grow))),
    Math.max(0, Math.min(H, Math.round(cy0 + (p[1] - cy0) * grow)))
  ]);
}

/* ---- 2. 透視校正（四邊形 → 矩形） ---- */
function solve8(A, b) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    if (Math.abs(A[piv][i]) < 1e-9) return null;
    if (piv !== i) { const t = A[i]; A[i] = A[piv]; A[piv] = t; const tb = b[i]; b[i] = b[piv]; b[piv] = tb; }
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      if (!f) continue;
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n);
  for (let i = 0; i < n; i++) x[i] = b[i] / A[i][i];
  return x;
}

function warpPerspective(srcCv, corners, maxSide) {
  const [p0, p1, p2, p3] = corners;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let outW = Math.round(Math.max(dist(p0, p1), dist(p3, p2)));
  let outH = Math.round(Math.max(dist(p0, p3), dist(p1, p2)));
  const cap = maxSide || 2200;
  const k = Math.min(1, cap / Math.max(outW, outH));
  outW = Math.max(80, Math.round(outW * k));
  outH = Math.max(80, Math.round(outH * k));

  const dst = [[0, 0], [outW, 0], [outW, outH], [0, outH]];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = dst[i], [x, y] = [p0, p1, p2, p3][i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const h = solve8(A, b);
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const ox = out.getContext('2d');
  if (!h) { ox.drawImage(srcCv, 0, 0, outW, outH); return out; }

  const sctx = srcCv.getContext('2d');
  const sd = sctx.getImageData(0, 0, srcCv.width, srcCv.height).data;
  const SW = srcCv.width, SH = srcCv.height;
  const dstImg = ox.createImageData(outW, outH);
  const od = dstImg.data;

  for (let v = 0; v < outH; v++) {
    const rowBase = v * outW * 4;
    for (let u = 0; u < outW; u++) {
      const den = h[6] * u + h[7] * v + 1;
      const sxf = (h[0] * u + h[1] * v + h[2]) / den;
      const syf = (h[3] * u + h[4] * v + h[5]) / den;
      const di = rowBase + u * 4;
      if (sxf < 0 || syf < 0 || sxf >= SW - 1 || syf >= SH - 1) {
        od[di] = od[di + 1] = od[di + 2] = 255; od[di + 3] = 255;
        continue;
      }
      const x0 = sxf | 0, y0 = syf | 0;
      const fx = sxf - x0, fy = syf - y0;
      const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4;
      const i01 = i00 + SW * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        od[di + c] =
          sd[i00 + c] * (1 - fx) * (1 - fy) + sd[i10 + c] * fx * (1 - fy) +
          sd[i01 + c] * (1 - fx) * fy + sd[i11 + c] * fx * fy;
      }
      od[di + 3] = 255;
    }
  }
  ox.putImageData(dstImg, 0, 0);
  return out;
}

/* ---- 3. 去陰影 / 白底 / 二值化 ---- */
function enhanceCanvas(cv, mode) {
  if (!mode || mode === 'color') return cv;
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
  const rect = (S, x0, y0, x1, y1) => S[y1 * W1 + x1] - S[y0 * W1 + x1] - S[y1 * W1 + x0] + S[y0 * W1 + x0];

  const r = Math.max(10, Math.round(W / 24));
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
      let gv;
      if (mode === 'bw') {
        const sq = rect(S2, x0, y0, x1, y1);
        const std = Math.sqrt(Math.max(0, sq / cnt - mean * mean));
        const T = mean * (1 + k * (std / R - 1));
        gv = v > T ? 255 : 0;
      } else {
        gv = mean > 4 ? (v / mean) * 244 : v;
        if (gv > 226) gv = 255;
        if (gv < 3) gv = 0;
      }
      out[y * W + x] = gv;
    }
  }

  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    a[i] = a[i + 1] = a[i + 2] = out[p];
    a[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return cv;
}

/* 一步完成：拉正 + 增強，回傳 dataURL */
async function scanPage(url, corners, mode) {
  const im = await loadImage(url);
  const src = canvasOf(im);
  const warped = warpPerspective(src, corners || detectCorners(src), 2200);
  enhanceCanvas(warped, mode);
  return { url: warped.toDataURL('image/jpeg', 0.85), w: warped.width, h: warped.height };
}

/* ---- 4. 匯出 PDF（用瀏覽器列印 → 存成 PDF） ---- */
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
