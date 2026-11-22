/* ===== 45-crop.js — 掃描框選（四角可拖） ===== */
let CROP = null;

async function openCrop(queue, target) {
  CROP = { queue, idx: 0, target, filter: (S.imp.mode === 'bw' ? 'bw' : 'gray'), imgW: 0, imgH: 0, corners: null, busy: false };
  await loadCropStep();
}

async function loadCropStep() {
  const p = CROP.queue[CROP.idx];
  const im = await loadImage(p.url);
  CROP.imgW = im.naturalWidth;
  CROP.imgH = im.naturalHeight;
  CROP.corners = detectCorners(canvasOf(im));
  S.screen = 'crop';
  render();
}

function cropPolyPoints() {
  return CROP.corners.map(p => `${p[0]},${p[1]}`).join(' ');
}

function cropHTML() {
  const c = CROP;
  if (!c || !c.imgW) return `<div class="crop"><div class="cbar">處理中…</div></div>`;
  const r = Math.max(16, Math.round(c.imgW / 34));
  return `<div class="crop">
    <div class="cbar">
      <button class="btn2" data-act="cropCancel">✕ 取消</button>
      <div style="flex:1;text-align:center">第 ${c.idx + 1} / ${c.queue.length} 張 · 拉四個角對齊紙張</div>
      <button class="btn2" data-act="cropAuto">自動</button>
    </div>
    <div class="cropstage" id="cstage">
      <div class="cropwrap" id="cwrap">
        <img id="cimg" src="${c.queue[c.idx].url}" alt="">
        <svg id="csvg" viewBox="0 0 ${c.imgW} ${c.imgH}" preserveAspectRatio="none">
          <polygon class="quad" points="${cropPolyPoints()}"></polygon>
          ${c.corners.map((pt, i) => `<circle class="h" data-i="${i}" cx="${pt[0]}" cy="${pt[1]}" r="${r}"></circle>`).join('')}
        </svg>
      </div>
    </div>
    <div class="cfoot">
      <div class="seg2">
        <button data-act="cropFilter" data-v="color" class="${c.filter === 'color' ? 'on' : ''}">彩色</button>
        <button data-act="cropFilter" data-v="gray" class="${c.filter === 'gray' ? 'on' : ''}">灰階</button>
        <button data-act="cropFilter" data-v="bw" class="${c.filter === 'bw' ? 'on' : ''}">黑白</button>
      </div>
      <button class="btn2 strong" data-act="cropApply">${c.idx + 1 === c.queue.length ? '完成' : '下一張 ›'}</button>
    </div>
  </div>`;
}

/* 尺寸：把圖縮到放得進畫面，回報 scale */
function sizeCrop() {
  const stage = document.getElementById('cstage');
  const wrap = document.getElementById('cwrap');
  if (!stage || !wrap || !CROP) return;
  const pad = 8;
  const sw = stage.clientWidth - pad * 2;
  const sh = stage.clientHeight - pad * 2;
  const k = Math.min(sw / CROP.imgW, sh / CROP.imgH);
  wrap.style.width = Math.round(CROP.imgW * k) + 'px';
  wrap.style.height = Math.round(CROP.imgH * k) + 'px';
}

function bindCrop() {
  if (!CROP) return;
  sizeCrop();
  window.onresize = () => { if (S.screen === 'crop') sizeCrop(); };
  const svg = document.getElementById('csvg');
  const poly = svg && svg.querySelector('.quad');
  if (!svg) return;
  let dragIdx = -1;

  const toImg = e => {
    const r = svg.getBoundingClientRect();
    return [
      (e.clientX - r.left) / r.width * CROP.imgW,
      (e.clientY - r.top) / r.height * CROP.imgH
    ];
  };
  svg.querySelectorAll('circle.h').forEach(cir => {
    cir.addEventListener('pointerdown', e => {
      e.preventDefault();
      dragIdx = +cir.dataset.i;
      cir.setPointerCapture(e.pointerId);
    });
    cir.addEventListener('pointermove', e => {
      if (dragIdx !== +cir.dataset.i) return;
      const [x, y] = toImg(e);
      const cx = Math.max(0, Math.min(CROP.imgW, x));
      const cy = Math.max(0, Math.min(CROP.imgH, y));
      CROP.corners[+cir.dataset.i] = [Math.round(cx), Math.round(cy)];
      cir.setAttribute('cx', cx);
      cir.setAttribute('cy', cy);
      if (poly) poly.setAttribute('points', cropPolyPoints());
    });
    cir.addEventListener('pointerup', e => { dragIdx = -1; });
    cir.addEventListener('pointercancel', () => { dragIdx = -1; });
  });
}

async function cropApply() {
  if (!CROP || CROP.busy) return;
  CROP.busy = true;
  toast('處理中…');
  try {
    const p = CROP.queue[CROP.idx];
    const out = await scanPage(p.url, CROP.corners, CROP.filter);
    const page = { id: uid(), url: out.url, w: out.w, h: out.h, role: 'scan' };
    if (CROP.target === 'set' && S.set) { S.set.pages.push(page); save(); }
    else S.imp.pages.push(page);
  } catch (e) {
    toast('這張處理失敗');
  }
  CROP.busy = false;
  CROP.idx++;
  if (CROP.idx >= CROP.queue.length) finishCrop();
  else await loadCropStep();
}

function finishCrop() {
  const target = CROP ? CROP.target : 'import';
  CROP = null;
  window.onresize = null;
  if (target === 'set') { S.screen = 'set'; render(); }
  else { S.screen = 'import'; render(); }
}
