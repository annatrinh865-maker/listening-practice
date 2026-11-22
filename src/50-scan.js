/* ===== 50-scan.js — 找頁面四角（Canny + 輪廓，跟掃描 App 同樣做法）→ 透視拉正 → 去陰影 ===== */

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

/* ---------- 影像處理小工具（純 JS，不用外部函式庫） ---------- */
function graySmall(cv, SW) {
  const k = SW / cv.width;
  const SH = Math.max(1, Math.round(cv.height * k));
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const x = c.getContext('2d');
  x.drawImage(cv, 0, 0, SW, SH);
  const d = x.getImageData(0, 0, SW, SH).data;
  const g = new Float32Array(SW * SH);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return { g, W: SW, H: SH };
}

function blur5(g, W, H) {
  const K = [1, 4, 6, 4, 1], S = 16;
  const t = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -2; i <= 2; i++) {
        const xx = x + i < 0 ? 0 : x + i > W - 1 ? W - 1 : x + i;
        a += g[y * W + xx] * K[i + 2];
      }
      t[y * W + x] = a / S;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -2; i <= 2; i++) {
        const yy = y + i < 0 ? 0 : y + i > H - 1 ? H - 1 : y + i;
        a += t[yy * W + x] * K[i + 2];
      }
      out[y * W + x] = a / S;
    }
  }
  return out;
}

function otsu(hist, total) {
  let sum = 0;
  for (let v = 0; v < hist.length; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let v = 0; v < hist.length; v++) {
    wB += hist[v];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = v; }
  }
  return thr;
}

/* Canny：Sobel → 非極大值抑制 → 雙門檻遲滯 */
function canny(g, W, H) {
  const N = W * H;
  const mag = new Float32Array(N), ang = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = (g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1]) - (g[i - W - 1] + 2 * g[i - 1] + g[i + W - 1]);
      const gy = (g[i + W - 1] + 2 * g[i + W] + g[i + W + 1]) - (g[i - W - 1] + 2 * g[i - W] + g[i - W + 1]);
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      ang[i] = Math.atan2(gy, gx);
    }
  }
  // 非極大值抑制
  const thin = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const m = mag[i];
      if (m < 12) continue;
      let a = ang[i] * 180 / Math.PI;
      if (a < 0) a += 180;
      let n1, n2;
      if (a < 22.5 || a >= 157.5) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
      else if (a < 67.5) { n1 = mag[i - W + 1]; n2 = mag[i + W - 1]; }
      else if (a < 112.5) { n1 = mag[i - W]; n2 = mag[i + W]; }
      else { n1 = mag[i - W - 1]; n2 = mag[i + W + 1]; }
      if (m >= n1 && m >= n2) thin[i] = m;
    }
  }
  // 門檻（用 Otsu 自動決定，不用固定值）
  const hist = new Array(256).fill(0);
  for (let i = 0; i < N; i++) {
    const v = thin[i] > 255 ? 255 : thin[i] | 0;
    if (v > 0) hist[v]++;
  }
  let cnt = 0;
  for (let v = 1; v < 256; v++) cnt += hist[v];
  const hi = Math.max(24, otsu(hist, cnt));
  const lo = hi * 0.45;

  const edge = new Uint8Array(N);
  const stack = new Int32Array(N);
  let top = 0;
  for (let i = 0; i < N; i++) if (thin[i] >= hi) { edge[i] = 2; stack[top++] = i; }
  while (top) {
    const cur = stack[--top];
    const x = cur % W, y = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (!edge[ni] && thin[ni] >= lo) { edge[ni] = 1; stack[top++] = ni; }
      }
    }
  }
  for (let i = 0; i < N; i++) if (edge[i]) edge[i] = 1;
  return edge;
}

/* 凸包（Andrew monotone chain） */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 4) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/* Douglas-Peucker：把輪廓簡化成四邊形 */
function dpLine(pts, a, b, eps, keep) {
  let maxD = -1, idx = -1;
  const dx = pts[b][0] - pts[a][0], dy = pts[b][1] - pts[a][1];
  const len = Math.hypot(dx, dy) || 1;
  for (let i = a + 1; i < b; i++) {
    const d = Math.abs((pts[i][0] - pts[a][0]) * dy - (pts[i][1] - pts[a][1]) * dx) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps && idx > 0) {
    dpLine(pts, a, idx, eps, keep);
    dpLine(pts, idx, b, eps, keep);
  } else keep.push(a);
}
function simplifyClosed(pts, eps) {
  const n = pts.length;
  if (n < 5) return pts.slice();
  // 找最遠的兩點當切點
  let i0 = 0, i1 = 0, best = -1;
  for (let i = 0; i < n; i += Math.max(1, Math.round(n / 60))) {
    for (let j = i + 1; j < n; j += Math.max(1, Math.round(n / 60))) {
      const d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (d > best) { best = d; i0 = i; i1 = j; }
    }
  }
  const keep = [];
  dpLine(pts, i0, i1, eps, keep);
  keep.push(i1);
  const rotated = pts.slice(i1).concat(pts.slice(0, i1 + 1));
  dpLine(rotated, 0, rotated.length - 1, eps, keep);
  return keep.map(i => pts[i]);
}

/* 4 個角排序成 TL, TR, BR, BL */
function orderQuad(q) {
  const sum = q.map(p => p[0] + p[1]);
  const dif = q.map(p => p[0] - p[1]);
  const TL = q[sum.indexOf(Math.min(...sum))];
  const BR = q[sum.indexOf(Math.max(...sum))];
  const TR = q[dif.indexOf(Math.max(...dif))];
  const BL = q[dif.indexOf(Math.min(...dif))];
  return [TL, TR, BR, BL];
}

function quadOk(pts, W, H) {
  if (!pts || pts.length !== 4) return false;
  const area = polyArea(pts);
  if (area < W * H * 0.35 || area > W * H * 1.02) return false;
  // 邊長不能太短（避免退化成三角形/一條線）
  const diag = Math.hypot(W, H);
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < diag * 0.08) return false;
  }
  // 凸性：每個轉角叉積同號
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-6) continue;
    const s = cr > 0 ? 1 : -1;
    if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}

/* 紙張是不是「撐滿畫面」（書頁超出鏡頭）：看四邊有多少比例是亮面 */
function frameCoverage(cv) {
  const SW = 200;
  const { g, W, H } = graySmall(cv, SW);
  const N = W * H;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < N; i++) hist[g[i] | 0]++;
  const thr = otsu(hist, N);
  const bright = i => g[i] > thr;
  let top = 0, bot = 0, left = 0, right = 0;
  for (let x = 0; x < W; x++) {
    if (bright(x)) top++;
    if (bright((H - 1) * W + x)) bot++;
  }
  for (let y = 0; y < H; y++) {
    if (bright(y * W)) left++;
    if (bright(y * W + W - 1)) right++;
  }
  return [top / W, bot / W, left / H, right / H].filter(v => v > 0.55).length;
}

/* ---- 主偵測：Canny 邊緣 → 最大輪廓 → 四邊形（掃描 App 的做法） ---- */
function detectByEdges(cv) {
  const SW = Math.min(480, cv.width);
  const { g, W, H } = graySmall(cv, SW);
  const blurred = blur5(g, W, H);
  const edge = canny(blurred, W, H);

  // 連通分量（8 連通）
  const N = W * H;
  const label = new Int32Array(N);
  const stack = new Int32Array(N);
  const comps = [];
  let id = 0;
  for (let start = 0; start < N; start++) {
    if (!edge[start] || label[start]) continue;
    id++;
    let top = 0, count = 0;
    const px = [];
    stack[top++] = start; label[start] = id;
    while (top) {
      const cur = stack[--top];
      const x = cur % W, y = (cur / W) | 0;
      if (px.length < 26000) px.push([x, y]);
      count++;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (edge[ni] && !label[ni]) { label[ni] = id; stack[top++] = ni; }
        }
      }
    }
    if (px.length > 120) comps.push({ px, count });
  }
  if (!comps.length) return null;

  // 由大到小檢查，找最大「看起來像四邊形」的輪廓
  comps.sort((a, b) => b.px.length - a.px.length);
  let best = null, bestArea = 0;
  for (let ci = 0; ci < Math.min(comps.length, 12); ci++) {
    const hull = convexHull(comps[ci].px);
    if (hull.length < 4) continue;
    const hullArea = polyArea(hull);
    if (hullArea < N * 0.12) continue;
    const peri = (() => {
      let s = 0;
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        s += Math.hypot(a[0] - b[0], a[1] - b[1]);
      }
      return s;
    })();
    let quad = null;
    for (let f = 0.01; f <= 0.3; f += 0.01) {
      const s = simplifyClosed(hull, peri * f);
      if (s.length === 4) { quad = s; break; }
      if (s.length < 4) break;
    }
    if (!quad) {
      // 退而求其次：凸包上四個對角極值
      const sum = hull.map(p => p[0] + p[1]);
      const dif = hull.map(p => p[0] - p[1]);
      quad = [
        hull[sum.indexOf(Math.min(...sum))],
        hull[dif.indexOf(Math.max(...dif))],
        hull[sum.indexOf(Math.max(...sum))],
        hull[dif.indexOf(Math.min(...dif))]
      ];
    }
    quad = orderQuad(quad);
    if (quadOk(quad, W, H) && hullArea > bestArea) { best = quad; bestArea = hullArea; }
  }
  if (!best) return null;
  const kx = cv.width / W, ky = cv.height / H;
  return best.map(p => [Math.round(p[0] * kx), Math.round(p[1] * ky)]);
}

/* ---- 備援：亮度門檻（紙面比桌面亮時有效；陰影或亮桌面會失敗） ---- */
function detectByBright(cv) {
  const W = cv.width, H = cv.height;
  const SW = 260;
  const { g, W: w, H: h } = graySmall(cv, SW);
  const N = w * h;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < N; i++) hist[g[i] | 0]++;
  const thr = otsu(hist, N);

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
      const x = cur % w, y = (cur / w) | 0;
      if (x > 0 && !seen[cur - 1] && g[cur - 1] > thr) { seen[cur - 1] = 1; stack[top++] = cur - 1; }
      if (x < w - 1 && !seen[cur + 1] && g[cur + 1] > thr) { seen[cur + 1] = 1; stack[top++] = cur + 1; }
      if (y > 0 && !seen[cur - w] && g[cur - w] > thr) { seen[cur - w] = 1; stack[top++] = cur - w; }
      if (y < h - 1 && !seen[cur + w] && g[cur + w] > thr) { seen[cur + w] = 1; stack[top++] = cur + w; }
    }
    if (count > bestCount) { bestCount = count; bestPixels = list; }
  }
  if (!bestPixels || bestCount < N * 0.15) return null;

  let minS = 1e9, maxS = -1e9, minD = 1e9, maxD = -1e9;
  let TL = null, BR = null, TR = null, BL = null;
  for (let i = 0; i < bestPixels.length; i++) {
    const idx = bestPixels[i];
    const x = idx % w, y = (idx / w) | 0;
    const s = x + y, df = x - y;
    if (s < minS) { minS = s; TL = [x, y]; }
    if (s > maxS) { maxS = s; BR = [x, y]; }
    if (df > maxD) { maxD = df; TR = [x, y]; }
    if (df < minD) { minD = df; BL = [x, y]; }
  }
  if (!TL || !TR || !BR || !BL) return null;
  const kx = W / w, ky = H / h;
  return [TL, TR, BR, BL].map(p => [Math.round(p[0] * kx), Math.round(p[1] * ky)]);
}

function growQuad(pts, W, H, k) {
  const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
  return pts.map(p => [
    Math.max(0, Math.min(W, Math.round(cx + (p[0] - cx) * k))),
    Math.max(0, Math.min(H, Math.round(cy + (p[1] - cy) * k)))
  ]);
}

/* ---- 對外：找四角 ---- */
function detectCorners(cv) {
  const W = cv.width, H = cv.height;
  const frame = [[0, 0], [W, 0], [W, H], [0, H]];
  // 書頁超出鏡頭（三邊以上都是紙）→ 不裁，直接整張
  try { if (frameCoverage(cv) >= 3) return frame; } catch (err) { }
  try {
    const e = detectByEdges(cv);
    if (e && quadOk(e, W, H) && quadInsideFrame(e, W, H)) return growQuad(e, W, H, 1.004);
  } catch (err) { /* 邊緣法失敗就換備援 */ }
  try {
    const b = detectByBright(cv);
    if (b && quadOk(b, W, H) && quadInsideFrame(b, W, H)) return growQuad(b, W, H, 1.02);
  } catch (err) { /* 備援也失敗就用整張 */ }
  return frame;
}

/* 四個角都要離畫面邊緣夠遠，否則代表紙張其實超出鏡頭（硬裁會切到字） */
function quadInsideFrame(pts, W, H) {
  const mx = W * 0.03, my = H * 0.03;
  return pts.every(p => p[0] > mx && p[0] < W - mx && p[1] > my && p[1] < H - my);
}

/* ---- 2. 透視校正（四邊形 → 矩形） ---- */
function solve8(A, b) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    if (Math.abs(A[piv][i]) < 1e-9) return null;
    if (piv !== i) {
      const t = A[i]; A[i] = A[piv]; A[piv] = t;
      const tb = b[i]; b[i] = b[piv]; b[piv] = tb;
    }
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
  const p = corners;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let outW = Math.round(Math.max(dist(p[0], p[1]), dist(p[3], p[2])));
  let outH = Math.round(Math.max(dist(p[0], p[3]), dist(p[1], p[2])));
  const cap = maxSide || 2200;
  const k = Math.min(1, cap / Math.max(outW, outH));
  outW = Math.max(80, Math.round(outW * k));
  outH = Math.max(80, Math.round(outH * k));

  const dst = [[0, 0], [outW, 0], [outW, outH], [0, outH]];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const u = dst[i][0], v = dst[i][1];
    const x = p[i][0], y = p[i][1];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const h = solve8(A, b);
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const ox = out.getContext('2d');
  if (!h) { ox.drawImage(srcCv, 0, 0, outW, outH); return out; }

  const sd = srcCv.getContext('2d').getImageData(0, 0, srcCv.width, srcCv.height).data;
  const SW = srcCv.width, SH = srcCv.height;
  const dstImg = ox.createImageData(outW, outH);
  const od = dstImg.data;

  for (let v = 0; v < outH; v++) {
    const rowBase = v * outW * 4;
    for (let u = 0; u < outW; u++) {
      const den = h[6] * u + h[7] * v + 1 || 1e-6;
      const sxf = (h[0] * u + h[1] * v + h[2]) / den;
      const syf = (h[3] * u + h[4] * v + h[5]) / den;
      const di = rowBase + u * 4;
      if (!(sxf >= 0 && syf >= 0 && sxf < SW - 1 && syf < SH - 1)) {
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

/* ---- 3. 去陰影 / 白底 ---- */
/* 用可分離的 box 濾波算「局部背景亮度」，記憶體只要灰階 + 一層累加緩衝 */
function localMean(gray, W, H, r) {
  const hs = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += gray[row + Math.min(W - 1, Math.max(0, x))];
    const n = 2 * r + 1;
    for (let x = 0; x < W; x++) {
      hs[row + x] = sum / n;
      const outX = x - r, inX = x + r + 1;
      sum += gray[row + (inX > W - 1 ? W - 1 : inX)] - gray[row + (outX < 0 ? 0 : outX)];
    }
  }
  const out = new Float32Array(W * H);
  const n = 2 * r + 1;
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += hs[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = sum / n;
      const outY = y - r, inY = y + r + 1;
      sum += hs[(inY > H - 1 ? H - 1 : inY) * W + x] - hs[(outY < 0 ? 0 : outY) * W + x];
    }
  }
  return out;
}

function enhanceCanvas(cv, mode) {
  if (!mode || mode === 'color') {
    // 彩色：只做白平衡式的提亮，不動內容
    const cx = cv.getContext('2d');
    const img = cx.getImageData(0, 0, cv.width, cv.height);
    const a = img.data;
    for (let i = 0; i < a.length; i += 4) {
      a[i] = Math.min(255, a[i] * 1.06 + 6);
      a[i + 1] = Math.min(255, a[i + 1] * 1.06 + 6);
      a[i + 2] = Math.min(255, a[i + 2] * 1.06 + 6);
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }
  const cx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const img = cx.getImageData(0, 0, W, H);
  const a = img.data;
  const gray = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    gray[p] = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0;
  }
  const r = Math.max(8, Math.round(Math.max(W, H) / 45));
  const mean = localMean(gray, W, H, r);

  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    const m = mean[p];
    const v = gray[p];
    let g;
    if (m < 6) g = v;
    else {
      const ratio = v / m;              // 1 = 跟背景一樣亮（紙）→ 白
      if (mode === 'bw') g = ratio > 0.86 ? 255 : (ratio > 0.72 ? 120 : 0);
      else {
        g = ratio * 246;
        if (g > 232) g = 255;
        if (g < 4) g = 0;
      }
    }
    a[i] = a[i + 1] = a[i + 2] = g;
    a[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return cv;
}

/* ---- 自動校正傾斜：找讓「每一列亮度差最大」的角度 ---- */
function autoDeskewAngle(cv) {
  const SW = 360;
  const { g, W, H } = graySmall(cv, SW);
  const b = blur5(g, W, H);
  const y0 = Math.round(H * 0.08), y1 = Math.round(H * 0.92);
  const x0 = Math.round(W * 0.1), x1 = Math.round(W * 0.9);
  let bestA = 0, bestScore = -1;
  for (let a = -7; a <= 7.001; a += 0.5) {
    const rad = a * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const prof = [];
    for (let y = y0; y < y1; y++) {
      let s = 0, n = 0;
      const dy = y - H / 2;
      for (let x = x0; x < x1; x += 2) {
        const dx = x - W / 2;
        const sx = Math.round(dx * cos - dy * sin + W / 2);
        const sy = Math.round(dx * sin + dy * cos + H / 2);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        s += b[sy * W + sx]; n++;
      }
      if (n > (x1 - x0) * 0.4) prof.push(s / n);
    }
    if (prof.length < (y1 - y0) * 0.6) continue;
    // 相鄰列差異的平方和：文字行對齊時最大
    let score = 0;
    for (let i = 1; i < prof.length; i++) {
      const d = prof[i] - prof[i - 1];
      score += d * d;
    }
    if (score > bestScore) { bestScore = score; bestA = a; }
  }
  return bestA;
}

function rotateCanvas(cv, deg) {
  if (Math.abs(deg) < 0.2) return cv;
  const rad = deg * Math.PI / 180;
  const W = cv.width, H = cv.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const o = out.getContext('2d');
  o.fillStyle = '#ffffff';
  o.fillRect(0, 0, W, H);
  o.translate(W / 2, H / 2);
  o.rotate(rad);
  o.drawImage(cv, -W / 2, -H / 2);
  return out;
}

/* 切掉旋轉後留下的白邊 */
function cropWhite(cv) {
  const W = cv.width, H = cv.height;
  const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 - x0 < W * 0.5 || y1 - y0 < H * 0.5) return cv;
  const cw = Math.min(W, x1 + 2) - Math.max(0, x0 - 2);
  const ch = Math.min(H, y1 + 2) - Math.max(0, y0 - 2);
  if (cw > W * 0.985 && ch > H * 0.985) return cv;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(cv, Math.max(0, x0 - 2), Math.max(0, y0 - 2), cw, ch, 0, 0, cw, ch);
  return out;
}

function shrinkTo(cv, maxSide) {
  const m = Math.max(cv.width, cv.height);
  if (m <= maxSide) return cv;
  const k = maxSide / m;
  const out = document.createElement('canvas');
  out.width = Math.round(cv.width * k);
  out.height = Math.round(cv.height * k);
  const o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  o.drawImage(cv, 0, 0, out.width, out.height);
  return out;
}

function isFrameQuad(pts, W, H) {
  return polyArea(pts) > W * H * 0.985;
}

/* 一步完成：拉正 + 增強，回傳 dataURL */
async function scanPage(url, corners, mode) {
  const im = await loadImage(url);
  let src = canvasOf(im);
  const quad = corners || detectCorners(src);
  let out;
  if (isFrameQuad(quad, src.width, src.height)) {
    // 書頁超出畫面 → 不裁切；只把文字校正成水平、切掉旋轉白邊
    src = shrinkTo(src, 2200);
    const ang = autoDeskewAngle(src);
    out = Math.abs(ang) >= 0.5 ? cropWhite(rotateCanvas(src, -ang)) : src;
  } else {
    out = warpPerspective(src, quad, 2200);
  }
  enhanceCanvas(out, mode);
  return { url: out.toDataURL('image/jpeg', 0.85), w: out.width, h: out.height };
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
