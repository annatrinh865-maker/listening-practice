/* ===== 45-crop.js — 掃描框選（大顆好拖的角點 + 放大鏡） ===== */
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
  const pctX = v => (v / c.imgW * 100).toFixed(3) + '%';
  const pctY = v => (v / c.imgH * 100).toFixed(3) + '%';
  const isFrame = isFrameQuad(c.corners, c.imgW, c.imgH);
  return `<div class="crop">
    <div class="cbar">
      <button class="btn2" data-act="cropCancel">✕</button>
      <div class="ctitle">第 ${c.idx + 1} / ${c.queue.length} 張<span>${isFrame ? '書頁超出畫面，用整張就好（可拖角調整）' : '拖綠點對齊紙張四角'}</span></div>
      <button class="btn2" data-act="cropFrame">整張</button>
      <button class="btn2" data-act="cropAuto">自動</button>
    </div>
    <div class="cropstage" id="cstage">
      <div class="cropwrap" id="cwrap">
        <img id="cimg" src="${c.queue[c.idx].url}" alt="">
        <svg id="csvg" viewBox="0 0 ${c.imgW} ${c.imgH}" preserveAspectRatio="none">
          <polygon class="quad" points="${cropPolyPoints()}"></polygon>
        </svg>
        ${c.corners.map((pt, i) => `<div class="hdl" data-i="${i}" style="left:${pctX(pt[0])};top:${pctY(pt[1])}"><span></span></div>`).join('')}
        <div class="loupe" id="cloupe"></div>
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

function sizeCrop() {
  const stage = document.getElementById('cstage');
  const wrap = document.getElementById('cwrap');
  if (!stage || !wrap || !CROP) return;
  const pad = 10;
  const sw = stage.clientWidth - pad * 2;
  const sh = stage.clientHeight - pad * 2;
  const k = Math.min(sw / CROP.imgW, sh / CROP.imgH);
  wrap.style.width = Math.max(40, Math.round(CROP.imgW * k)) + 'px';
  wrap.style.height = Math.max(40, Math.round(CROP.imgH * k)) + 'px';
}

function bindCrop() {
  if (!CROP) return;
  sizeCrop();
  window.onresize = () => { if (S.screen === 'crop') sizeCrop(); };

  const wrap = document.getElementById('cwrap');
  const svg = document.getElementById('csvg');
  const poly = svg && svg.querySelector('.quad');
  const loupe = document.getElementById('cloupe');
  const img = document.getElementById('cimg');
  if (!wrap || !svg) return;

  const ZOOM = 3;

  const paintLoupe = idx => {
    if (!loupe || !img) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const x = CROP.corners[idx][0] / CROP.imgW * w;
    const y = CROP.corners[idx][1] / CROP.imgH * h;
    const R = 58;
    loupe.style.backgroundImage = `url("${CROP.queue[CROP.idx].url}")`;
    loupe.style.backgroundSize = `${Math.round(w * ZOOM)}px ${Math.round(h * ZOOM)}px`;
    loupe.style.backgroundPosition = `${Math.round(R - x * ZOOM)}px ${Math.round(R - y * ZOOM)}px`;
    loupe.classList.add('on');
    loupe.classList.toggle('low', y / h < 0.4);
  };

  wrap.querySelectorAll('.hdl').forEach(el => {
    const i = +el.dataset.i;
    let dragging = false;

    const move = e => {
      if (!dragging) return;
      const r = wrap.getBoundingClientRect();
      const nx = Math.max(0, Math.min(CROP.imgW, (e.clientX - r.left) / r.width * CROP.imgW));
      const ny = Math.max(0, Math.min(CROP.imgH, (e.clientY - r.top) / r.height * CROP.imgH));
      CROP.corners[i] = [Math.round(nx), Math.round(ny)];
      el.style.left = (nx / CROP.imgW * 100).toFixed(3) + '%';
      el.style.top = (ny / CROP.imgH * 100).toFixed(3) + '%';
      if (poly) poly.setAttribute('points', cropPolyPoints());
      paintLoupe(i);
    };

    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      el.classList.add('grab');
      try { el.setPointerCapture(e.pointerId); } catch (err) { }
      paintLoupe(i);
    });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', e => {
      dragging = false;
      el.classList.remove('grab');
      if (loupe) loupe.classList.remove('on');
    });
    el.addEventListener('pointercancel', () => {
      dragging = false;
      el.classList.remove('grab');
      if (loupe) loupe.classList.remove('on');
    });
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
