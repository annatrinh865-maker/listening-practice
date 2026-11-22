/* ===== 40-ui.js — 畫面 ===== */
const app = document.getElementById('app');
const S = {
  sets: [], set: null, screen: 'home',
  q: 0, filter: 'all', detailNo: null, overlay: null,
  reader: { page: 0, s: 1, tx: 0, ty: 0, col: 'full', bright: 100, contrast: 100 },
  imp: { pages: [], name: '', qFrom: 1, qTo: 30, busy: false, note: '' }
};

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

let _saveT = null;
function save() {
  if (!S.set) return;
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    const copy = S.set;
    dbPut(copy).catch(() => toast('儲存失敗'));
    const i = S.sets.findIndex(x => x.id === copy.id);
    if (i >= 0) S.sets[i] = { ...copy, pageCount: copy.pages.length, pages: [] };
  }, 120);
}

/* ---------- 首頁 ---------- */
function setCard(s) {
  const list = qlist(s), total = list.length;
  const ans = list.filter(n => s.answers[n]).length;
  const keyed = list.filter(n => s.key[n]).length;
  const ls = s.lastScore;
  const pct = total ? Math.round(ans / total * 100) : 0;
  const pill = ls
    ? `<span class="pill ${ls.ok / ls.keyed >= 0.8 ? 'good' : 'warn'}">上次 ${ls.ok}/${ls.keyed}</span>`
    : `<span class="pill grey">還沒批改</span>`;
  const done = ans === total;
  return `<button class="setcard" data-act="open" data-id="${s.id}">
    <div class="nm">${esc(s.name)} ${done ? '<span class="pill good">已作答</span>' : (ans ? `<span class="pill warn">作答中 ${ans}/${total}</span>` : '')}</div>
    <div class="meta"><span>第 ${s.qFrom}–${s.qTo} 題</span><span>${(s.pages && s.pages.length) || s.pageCount || 0} 張圖</span><span>正解 ${keyed}/${total}</span>${pill}</div>
    <div class="bar"><i style="width:${pct}%"></i></div>
  </button>`;
}

function viewHome() {
  return `
  <div class="scroll">
    <div class="hero">
      <div class="big">聽力練習</div>
      <p>截圖存進來 → 手機作答 → 自動批改 → 看詳解。</p>
    </div>
    ${S.sets.length ? S.sets.map(setCard).join('') : `<div class="empty">還沒有題組。<br><br>按下面「新增題組」，<br>一次選好幾張題目截圖就可以開始。</div>`}
  </div>
  <div class="fabwrap"><button class="btn primary" data-act="new"><span class="ic">＋</span>新增題組</button></div>`;
}

/* ---------- 題組主頁 ---------- */
function viewSet() {
  const st = S.set, list = qlist(st), total = list.length;
  const ans = list.filter(n => st.answers[n]).length;
  const keyed = list.filter(n => st.key[n]).length;
  const ls = st.lastScore;
  const canGrade = keyed > 0 && ans > 0;
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="home">‹</button>
    <h1>${esc(st.name)}</h1>
    <button class="iconbtn" data-act="more">⋯</button>
  </div>
  <div class="scroll">
    <div class="hubhead">
      <div class="stats">
        <div class="stat"><b>${total}</b><span>題數</span></div>
        <div class="stat"><b>${ans}/${total}</b><span>已作答</span></div>
        <div class="stat"><b>${ls ? ls.ok + '/' + ls.keyed : '—'}</b><span>${ls ? '上次分數' : '未批改'}</span></div>
      </div>
    </div>
    <div class="menu">
      <button class="btn primary" data-act="quiz"><span class="ic">✏️</span><span class="lbl">開始作答<small>${ans ? `從第 ${nextUnanswered()} 題繼續` : '一題一個畫面，按 A B C D'}</small></span><span class="chev">›</span></button>
      <button class="btn" data-act="readerOpen"><span class="ic">📖</span><span class="lbl">讀題（放大看圖）<small>可放大、可只顯示左半或右半</small></span><span class="chev">›</span></button>
      <button class="btn" data-act="keys"><span class="ic">🔑</span><span class="lbl">設定正解<small>${keyed ? `已設定 ${keyed} / ${total} 題` : '照書上解答點一次就好'}</small></span><span class="chev">›</span></button>
      <button class="btn" data-act="grade" ${canGrade ? '' : 'disabled'}><span class="ic">✅</span><span class="lbl">批改<small>${canGrade ? '看成績與錯題' : (keyed ? '先作答才能批改' : '要先設定正解')}</small></span><span class="chev">›</span></button>
    </div>
  </div>`;
}
function nextUnanswered() {
  const list = qlist(S.set);
  for (let i = 0; i < list.length; i++) if (!S.set.answers[list[i]]) return list[i];
  return list[0];
}

/* ---------- 作答 / 正解 ---------- */
function viewQuiz(isKey) {
  const st = S.set, list = qlist(st), total = list.length;
  S.q = Math.max(0, Math.min(total - 1, S.q));
  const n = list[S.q];
  const cur = (isKey ? st.key : st.answers)[n] || '';
  const ans = list.filter(x => (isKey ? st.key : st.answers)[x]).length;
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="backSet">✕</button>
    <h1>${isKey ? '設定正解' : '作答'}<span class="sub"> 第 ${S.q + 1} / ${total} 題</span></h1>
    <button class="iconbtn" data-act="jump">☰</button>
  </div>
  <div class="pad"><div class="bar"><i style="width:${ans / total * 100}%"></i></div></div>
  <div class="qwrap">
    <div class="qhead">
      <div class="qno">${n}<small> 題</small></div>
      <button class="btn" style="width:auto;padding:9px 13px;font-size:13px" data-act="readerOpen"><span class="ic">📄</span>看原圖</button>
    </div>
    ${st.pages.length ? `<div class="peek">
      <div class="peek-lbl">題目頁面 · 點一下放大</div>
      <div class="peekrow">${st.pages.map((p, i) => `<button class="peekth ${i === S.reader.page ? 'on' : ''}" data-act="openPage" data-v="${i}"><img src="${p.url}" alt="第 ${i + 1} 頁"></button>`).join('')}</div>
    </div>` : ''}
    <div class="optgrid">
      ${LETTERS.map(L => `<button class="opt big ${cur === L ? 'on' : ''}" data-act="${isKey ? 'setKey' : 'pick'}" data-v="${L}">${L}</button>`).join('')}
    </div>
    <div class="navrow">
      <button class="btn" data-act="prevQ" ${S.q === 0 ? 'disabled' : ''}>‹ 上一題</button>
      ${S.q >= total - 1
        ? (isKey
          ? `<button class="btn primary" data-act="backSet">完成</button>`
          : `<button class="btn primary" data-act="doGrade">交卷批改</button>`)
        : `<button class="btn" data-act="nextQ">下一題 ›</button>`}
    </div>
  </div>`;
}

/* ---------- 批改 ---------- */
function gradeOf(st) {
  const list = qlist(st);
  let ok = 0, keyed = 0, ans = 0;
  list.forEach(n => {
    if (st.key[n]) keyed++;
    if (st.answers[n]) ans++;
    if (st.key[n] && st.answers[n] === st.key[n]) ok++;
  });
  return { ok, keyed, ans, total: list.length };
}

function viewGrade() {
  const st = S.set, list = qlist(st), g = gradeOf(st);
  const pct = g.keyed ? Math.round(g.ok / g.keyed * 100) : 0;
  const rows = list.filter(n => {
    if (S.filter === 'wrong') return !(st.key[n] && st.answers[n] === st.key[n]);
    return true;
  });
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="backSet">‹</button>
    <h1>批改結果</h1>
  </div>
  <div class="scroll">
    <div class="score">
      <div class="big">${pct}<small>%</small></div>
      <div class="txt">答對 ${g.ok} 題 / 正解已設定 ${g.keyed} 題　·　答了 ${g.ans} 題</div>
      ${g.keyed < g.total ? `<div class="small" style="color:var(--warn);margin-top:8px">還有 ${g.total - g.keyed} 題沒設定正解，不會列入計分。<button style="text-decoration:underline;font-weight:800;color:var(--warn)" data-act="keys">去設定</button></div>` : ''}
    </div>
    <div class="seg">
      <button class="${S.filter === 'all' ? 'on' : ''}" data-act="filter" data-v="all">全部 ${g.total} 題</button>
      <button class="${S.filter === 'wrong' ? 'on' : ''}" data-act="filter" data-v="wrong">只看錯的 ${g.total - g.ok} 題</button>
    </div>
    ${rows.map(n => {
      const k = st.key[n], a = st.answers[n];
      const good = k && a === k;
      return `<button class="grow ${good ? 'ok' : 'ng'}" data-act="detail" data-v="${n}">
        <span class="n">${n}</span>
        <span class="ab">你 <b>${a || '—'}</b>　正解 <b>${k || '?'}</b>${!k ? '<span class="pend"> 未設定</span>' : ''}</span>
        <span class="mark">${good ? '✓' : (a ? '✗' : '·')}</span>
      </button>`;
    }).join('')}
    <div class="pad" style="margin-top:16px;display:grid;gap:10px">
      <button class="btn" data-act="quiz"><span class="ic">✏️</span>重新作答</button>
    </div>
  </div>`;
}

/* ---------- 單題詳解 ---------- */
function viewDetail() {
  const st = S.set, list = qlist(st), n = S.detailNo;
  const i = list.indexOf(n);
  const k = st.key[n], a = st.answers[n];
  const good = k && a === k;
  const note = (st.notes && st.notes[n]) || '';
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="grade">‹</button>
    <h1>第 ${n} 題<span class="sub"> 詳解</span></h1>
  </div>
  <div class="scroll">
    <div class="detail">
      <div class="dcard">
        <h3>答案</h3>
        <div class="kv">
          <span class="chip ${good ? 'good' : (a ? 'bad' : '')}">${a || '—'}</span><span class="small muted">你的答案</span>
          <span style="width:18px"></span>
          <span class="chip ${k ? 'good' : ''}">${k || '?'}</span><span class="small muted">正解</span>
          <span style="margin-left:auto;font-weight:900;color:${good ? 'var(--good)' : 'var(--bad)'}">${good ? '✓ 答對' : (a ? '✗ 答錯' : '未作答')}</span>
        </div>
      </div>
      <div class="dcard">
        <h3>看題目原圖</h3>
        <button class="btn" data-act="readerOpen"><span class="ic">📄</span>開啟圖片（可放大）</button>
      </div>
      <div class="dcard">
        <h3>我的詳解筆記</h3>
        <textarea class="notes" id="note" placeholder="例：男子說 after your trip，所以是旅行後再申請 → B">${esc(note)}</textarea>
        <div class="tiny muted" style="margin-top:8px">邊聽邊寫，會自動儲存；批改後每題都看得到。</div>
      </div>
      <div class="row2">
        <button class="btn" data-act="detailPrev" ${i <= 0 ? 'disabled' : ''}>‹ 上一題</button>
        <button class="btn" data-act="detailNext" ${i >= list.length - 1 ? 'disabled' : ''}>下一題 ›</button>
      </div>
    </div>
  </div>`;
}

/* ---------- 新增題組 ---------- */
function viewImport() {
  const im = S.imp;
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="home">✕</button>
    <h1>新增題組</h1>
  </div>
  <div class="scroll">
    <div class="pad">
      <div class="pickzone" data-act="pickfiles">
        <span class="ic">🖼</span>
        ${im.busy ? `<b>${esc(im.note || '處理中…')}</b>` : (im.pages.length ? `已選 <b>${im.pages.length}</b> 張，再按這裡可以繼續加` : '按這裡選截圖<br><span class="tiny">（一次可以選很多張，順序就是頁面順序）</span>')}
      </div>
      <input type="file" id="fileIn" accept="image/*" multiple hidden>
      ${im.pages.length ? `<div class="thumbs">${im.pages.map((p, i) => `<div class="th"><img src="${p.url}" alt=""><div class="n">${i + 1}</div><div class="x" data-act="rmpage" data-v="${i}">✕</div></div>`).join('')}</div>` : ''}
      <div class="field">
        <label>題組名稱</label>
        <input type="text" id="impName" value="${esc(im.name)}" placeholder="例：Test 1 Part 3–4">
      </div>
      <div class="row2">
        <div class="field"><label>第幾題開始</label><input type="number" id="impFrom" value="${im.qFrom}" inputmode="numeric"></div>
        <div class="field"><label>第幾題結束</label><input type="number" id="impTo" value="${im.qTo}" inputmode="numeric"></div>
      </div>
      <div class="tiny muted" style="margin-bottom:18px">例：這幾頁是 65 到 76 題，就填 65 和 76。作答時一題一個畫面。</div>
    </div>
  </div>
  <div class="fabwrap">
    <button class="btn primary" data-act="create" ${im.pages.length && !im.busy ? '' : 'disabled'}>建立題組（${im.pages.length} 張圖）</button>
  </div>`;
}

/* ---------- 更多設定 ---------- */
function viewMore() {
  const st = S.set;
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="backSet">‹</button>
    <h1>設定</h1>
  </div>
  <div class="scroll">
    <div class="pad">
      <div class="field"><label>題組名稱</label><input type="text" id="mName" value="${esc(st.name)}"></div>
      <div class="row2">
        <div class="field"><label>第幾題開始</label><input type="number" id="mFrom" value="${st.qFrom}" inputmode="numeric"></div>
        <div class="field"><label>第幾題結束</label><input type="number" id="mTo" value="${st.qTo}" inputmode="numeric"></div>
      </div>
      <button class="btn primary" data-act="saveMore" style="margin-bottom:22px">儲存</button>
      <h3 class="small" style="margin:0 0 8px">頁面（${st.pages.length} 張）</h3>
      <div class="thumbs">${st.pages.map((p, i) => `<div class="th"><img src="${p.url}" alt=""><div class="n">${i + 1}</div><div class="x" data-act="rmPage" data-v="${i}">✕</div></div>`).join('')}</div>
      <button class="btn" data-act="addPage" style="margin-top:6px"><span class="ic">＋</span>加頁面</button>
      <input type="file" id="fileIn2" accept="image/*" multiple hidden>
      <button class="btn ghost" data-act="delSet" style="margin-top:8px;color:var(--bad);border-color:#eccdc9">刪除這個題組</button>
    </div>
  </div>`;
}

/* ---------- 圖片閱讀器 ---------- */
function readerHTML() {
  const st = S.reader, pages = S.set.pages;
  if (!pages.length) return '';
  st.page = Math.max(0, Math.min(pages.length - 1, st.page));
  const p = pages[st.page];
  return `
  <div class="reader">
    <div class="rbar">
      <button class="btn2" data-act="closeReader">✕ 關閉</button>
      <div style="flex:1;text-align:center">第 ${st.page + 1} / ${pages.length} 頁</div>
      <button class="btn2" data-act="adjust">☀ 調整</button>
    </div>
    <div class="stage"><img id="rimg" src="${p.url}" alt="題目"></div>
    <div class="rfoot">
      <button class="btn2" data-act="readerPrev" ${st.page === 0 ? 'disabled' : ''}>‹</button>
      <div class="seg2">
        <button data-act="col" data-v="full" class="${st.col === 'full' ? 'on' : ''}">整頁</button>
        <button data-act="col" data-v="left" class="${st.col === 'left' ? 'on' : ''}">左半</button>
        <button data-act="col" data-v="right" class="${st.col === 'right' ? 'on' : ''}">右半</button>
      </div>
      <button class="btn2" data-act="readerNext" ${st.page === pages.length - 1 ? 'disabled' : ''}>›</button>
    </div>
  </div>`;
}

function jumpHTML() {
  const st = S.set, list = qlist(st), isKey = S.screen === 'key';
  const src = isKey ? st.key : st.answers;
  return `<div class="sheetback" data-act="closeSheet"><div class="sheet" data-stop="1">
    <h2>跳到第幾題</h2>
    <div class="jump">${list.map(n => {
      const cls = [src[n] ? 'done' : '', n === list[S.q] ? 'cur' : ''].join(' ');
      return `<button class="${cls}" data-act="goto" data-v="${n}">${n}</button>`;
    }).join('')}</div>
  </div></div>`;
}

function adjustHTML() {
  const st = S.reader;
  return `<div class="sheetback" data-act="closeSheet"><div class="sheet" data-stop="1">
    <h2>畫面調整</h2>
    <div class="field">
      <label>亮度 <span id="lbB">${st.bright}%</span></label>
      <input type="range" id="rgB" min="60" max="160" value="${st.bright}" style="width:100%">
    </div>
    <div class="field">
      <label>對比 <span id="lbC">${st.contrast}%</span></label>
      <input type="range" id="rgC" min="60" max="200" value="${st.contrast}" style="width:100%">
    </div>
    <button class="btn primary" data-act="closeSheet">好了</button>
  </div></div>`;
}

/* ---------- render ---------- */
function render() {
  let html = '';
  if (S.overlay === 'reader') html = readerHTML();
  else if (S.overlay === 'jump') html = jumpHTML();
  else if (S.overlay === 'adjust') html = adjustHTML();
  else if (S.screen === 'home') html = viewHome();
  else if (S.screen === 'set') html = viewSet();
  else if (S.screen === 'quiz') html = viewQuiz(false);
  else if (S.screen === 'key') html = viewQuiz(true);
  else if (S.screen === 'grade') html = viewGrade();
  else if (S.screen === 'detail') html = viewDetail();
  else if (S.screen === 'import') html = viewImport();
  else if (S.screen === 'more') html = viewMore();
  app.innerHTML = html;
  app.dataset.rendered = '1';
  after();
}

function after() {
  // 閱讀器
  const rimg = document.getElementById('rimg');
  if (rimg) {
    const boot = () => { readerFit(rimg); applyTransform(); };
    if (rimg.complete && rimg.naturalWidth) boot(); else rimg.onload = boot;
    bindReaderGestures();
  }
  // 調整滑桿
  const rgB = document.getElementById('rgB'), rgC = document.getElementById('rgC');
  if (rgB) rgB.oninput = () => { S.reader.bright = +rgB.value; document.getElementById('lbB').textContent = rgB.value + '%'; applyTransform(); };
  if (rgC) rgC.oninput = () => { S.reader.contrast = +rgC.value; document.getElementById('lbC').textContent = rgC.value + '%'; applyTransform(); };
  // 新增題組的欄位
  const impName = document.getElementById('impName');
  if (impName) {
    impName.oninput = () => { S.imp.name = impName.value; };
    const fi = document.getElementById('impFrom'), ft = document.getElementById('impTo');
    fi.oninput = () => { S.imp.qFrom = +fi.value || 1; };
    ft.oninput = () => { S.imp.qTo = +ft.value || 1; };
  }
  const f1 = document.getElementById('fileIn');
  if (f1) f1.onchange = e => handleFiles(e.target.files, false);
  const f2 = document.getElementById('fileIn2');
  if (f2) f2.onchange = e => handleFiles(e.target.files, true);
  // 詳解筆記
  const note = document.getElementById('note');
  if (note) {
    note.oninput = () => {
      if (!S.set.notes) S.set.notes = {};
      S.set.notes[S.detailNo] = note.value;
      save();
    };
    note.onblur = () => toast('筆記已儲存');
  }
}

/* ---------- 閱讀器：縮放 / 拖曳 ---------- */
const R = { W: 0, H: 0, Hc: 0 };
function readerFit(img) {
  const stage = img.parentElement;
  R.W = stage.clientWidth;
  R.Hc = stage.clientHeight;
  R.H = img.naturalHeight * (R.W / img.naturalWidth);
  img.style.width = R.W + 'px';
  img.style.height = 'auto';
}
function applyTransform() {
  const img = document.getElementById('rimg');
  if (!img || !R.W) return;
  const st = S.reader;
  const cw = R.W * st.s, ch = R.H * st.s;
  const minTx = Math.min(0, R.W - cw), minTy = Math.min(0, R.Hc - ch);
  st.tx = Math.max(minTx, Math.min(0, st.tx));
  st.ty = Math.max(minTy, Math.min(0, st.ty));
  img.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`;
  img.style.filter = `brightness(${st.bright}%) contrast(${st.contrast}%)`;
}
function setCol(col) {
  const st = S.reader;
  st.col = col;
  if (col === 'full') { st.s = 1; st.tx = 0; st.ty = 0; }
  else { st.s = 2; st.tx = col === 'left' ? 0 : -R.W; st.ty = 0; }
  applyTransform();
  document.querySelectorAll('.seg2 button').forEach(b => b.classList.toggle('on', b.dataset.v === col));
}
function bindReaderGestures() {
  const stage = document.querySelector('.reader .stage');
  const img = document.getElementById('rimg');
  if (!stage || !img) return;
  const ptrs = new Map();
  let pinchBase = 0, lastDist = 0, lastTap = 0, moved = false;

  const dist = () => {
    const [a, b] = [...ptrs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const mid = () => {
    const [a, b] = [...ptrs.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (ptrs.size === 2) { lastDist = dist(); pinchBase = S.reader.s; }
  });
  stage.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) {
      const d = dist();
      if (lastDist > 0 && d > 0) {
        const rect = stage.getBoundingClientRect();
        const m = mid();
        const fx = m.x - rect.left, fy = m.y - rect.top;
        const ratio = d / lastDist;
        const ns = Math.max(1, Math.min(6, S.reader.s * ratio));
        const realRatio = ns / S.reader.s;
        S.reader.tx = fx - (fx - S.reader.tx) * realRatio;
        S.reader.ty = fy - (fy - S.reader.ty) * realRatio;
        S.reader.s = ns;
      }
      lastDist = d;
    } else if (S.reader.s > 1) {
      S.reader.tx += dx; S.reader.ty += dy;
    }
    applyTransform();
  });
  const end = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) lastDist = 0;
    if (ptrs.size === 0 && !moved) {
      const now = Date.now();
      if (now - lastTap < 320) {
        const rect = stage.getBoundingClientRect();
        const fx = e.clientX - rect.left, fy = e.clientY - rect.top;
        if (S.reader.s > 1.2) { S.reader.s = 1; S.reader.tx = 0; S.reader.ty = 0; }
        else {
          const ns = 2.6, k = ns / S.reader.s;
          S.reader.s = ns;
          S.reader.tx = fx - fx * k; S.reader.ty = fy - fy * k;
        }
        applyTransform();
        lastTap = 0;
      } else lastTap = now;
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  // 桌機方便：滾輪縮放
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const fx = e.clientX - rect.left, fy = e.clientY - rect.top;
    const ns = Math.max(1, Math.min(6, S.reader.s * (e.deltaY < 0 ? 1.12 : 0.89)));
    const k = ns / S.reader.s;
    S.reader.tx = fx - (fx - S.reader.tx) * k;
    S.reader.ty = fy - (fy - S.reader.ty) * k;
    S.reader.s = ns;
    applyTransform();
  }, { passive: false });
}

/* ---------- 選圖 / 建檔 ---------- */
async function handleFiles(files, appendToSet) {
  const arr = [...(files || [])];
  if (!arr.length) return;
  if (appendToSet) {
    S.imp.busy = true;
    for (let i = 0; i < arr.length; i++) {
      try {
        const p = await compressFile(arr[i]);
        S.set.pages.push(p);
      } catch (e) { toast('有圖片讀不進來'); }
    }
    save();
    S.imp.busy = false;
    render();
    toast('已加入頁面');
    return;
  }
  S.imp.busy = true;
  for (let i = 0; i < arr.length; i++) {
    S.imp.note = `處理中 ${i + 1} / ${arr.length}…`;
    render();
    try {
      const p = await compressFile(arr[i]);
      S.imp.pages.push(p);
    } catch (e) { /* 跳過壞圖 */ }
  }
  S.imp.busy = false;
  S.imp.note = '';
  render();
}

/* ---------- 動作 ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (el.disabled) return;

  switch (act) {
    case 'home': S.screen = 'home'; S.set = null; render(); break;
    case 'new': {
      const sorted = S.sets.slice().sort((a, b) => b.qTo - a.qTo);
      const from = sorted.length ? sorted[0].qTo + 1 : 1;
      S.imp = { pages: [], name: '', qFrom: from, qTo: from + 29, busy: false, note: '' };
      S.screen = 'import'; render(); break;
    }
    case 'pickfiles': { const f = document.getElementById('fileIn'); if (f) f.click(); break; }
    case 'addPage': { const f = document.getElementById('fileIn2'); if (f) f.click(); break; }
    case 'rmpage': { S.imp.pages.splice(+v, 1); render(); break; }
    case 'rmPage': {
      if (S.set.pages.length <= 1) return toast('至少要留一張圖');
      S.set.pages.splice(+v, 1); save(); render(); break;
    }
    case 'create': {
      if (!S.imp.pages.length) return;
      const set = {
        id: uid(),
        name: S.imp.name.trim() || ('題組 ' + new Date().toLocaleDateString('zh-TW')),
        createdAt: Date.now(), updatedAt: Date.now(),
        qFrom: Math.max(1, S.imp.qFrom), qTo: Math.max(Math.max(1, S.imp.qFrom), S.imp.qTo),
        pages: S.imp.pages.slice(),
        key: {}, answers: {}, notes: {}, lastScore: null
      };
      await dbPut(set);
      S.sets.unshift({ ...set, pageCount: set.pages.length, pages: [] });
      S.imp = { pages: [], name: '', qFrom: 1, qTo: 30, busy: false, note: '' };
      S.set = set; S.screen = 'set'; S.q = 0;
      render();
      toast('題組建立好了');
      break;
    }
    case 'open': {
      const full = await dbGet(el.dataset.id);
      if (!full) return toast('找不到這個題組');
      S.set = full; S.screen = 'set'; S.q = 0; S.reader = { page: 0, s: 1, tx: 0, ty: 0, col: 'full', bright: 100, contrast: 100 };
      render(); break;
    }
    case 'backSet': S.screen = 'set'; S.overlay = null; render(); break;
    case 'more': S.screen = 'more'; render(); break;
    case 'saveMore': {
      const nm = document.getElementById('mName').value.trim();
      const a = +document.getElementById('mFrom').value, b = +document.getElementById('mTo').value;
      if (nm) S.set.name = nm;
      if (a >= 1 && b >= a) { S.set.qFrom = a; S.set.qTo = b; }
      save(); S.screen = 'set'; render(); toast('已儲存'); break;
    }
    case 'delSet': {
      if (!confirm('確定刪除「' + S.set.name + '」？這個動作不能復原。')) return;
      await dbDel(S.set.id);
      S.sets = S.sets.filter(x => x.id !== S.set.id);
      S.set = null; S.screen = 'home'; render(); break;
    }
    case 'quiz': S.screen = 'quiz'; S.q = Math.max(0, qlist(S.set).indexOf(nextUnanswered())); render(); break;
    case 'keys': S.screen = 'key'; S.q = Math.max(0, qlist(S.set).findIndex(n => !S.set.key[n])); render(); break;
    case 'pick': {
      const n = qlist(S.set)[S.q];
      S.set.answers[n] = v; save();
      el.classList.add('on');
      const total = qlist(S.set).length;
      if (S.q < total - 1) setTimeout(() => { S.q++; render(); }, 150);
      else { render(); setTimeout(() => toast('最後一題了，按「交卷批改」'), 60); }
      break;
    }
    case 'setKey': {
      const n = qlist(S.set)[S.q];
      S.set.key[n] = v; save();
      el.classList.add('on');
      const total = qlist(S.set).length;
      if (S.q < total - 1) setTimeout(() => { S.q++; render(); }, 150); else render();
      break;
    }
    case 'prevQ': S.q = Math.max(0, S.q - 1); render(); break;
    case 'nextQ': S.q++; render(); break;
    case 'jump': S.overlay = 'jump'; render(); break;
    case 'goto': {
      const i = qlist(S.set).indexOf(+v);
      S.q = i < 0 ? 0 : i;
      S.overlay = null; render(); break;
    }
    case 'closeSheet': S.overlay = null; render(); break;
    case 'doGrade':
    case 'grade': {
      const g = gradeOf(S.set);
      S.set.lastScore = { ok: g.ok, keyed: g.keyed, at: Date.now() };
      save();
      S.screen = 'grade'; S.filter = 'all'; S.overlay = null; render(); break;
    }
    case 'filter': S.filter = v; render(); break;
    case 'detail': S.detailNo = +v; S.screen = 'detail'; render(); break;
    case 'detailPrev': { const l = qlist(S.set), i = l.indexOf(S.detailNo); S.detailNo = l[Math.max(0, i - 1)]; render(); break; }
    case 'detailNext': { const l = qlist(S.set), i = l.indexOf(S.detailNo); S.detailNo = l[Math.min(l.length - 1, i + 1)]; render(); break; }
    case 'readerOpen': S.overlay = 'reader'; render(); break;
    case 'openPage': S.reader.page = +v; S.reader.s = 1; S.reader.tx = 0; S.reader.ty = 0; S.reader.col = 'full'; S.overlay = 'reader'; render(); break;
    case 'closeReader': S.overlay = null; render(); break;
    case 'adjust': S.overlay = 'adjust'; render(); break;
    case 'readerPrev': S.reader.page = Math.max(0, S.reader.page - 1); S.reader.s = 1; S.reader.tx = 0; S.reader.ty = 0; render(); break;
    case 'readerNext': S.reader.page = Math.min(S.set.pages.length - 1, S.reader.page + 1); S.reader.s = 1; S.reader.tx = 0; S.reader.ty = 0; render(); break;
    case 'col': setCol(v); break;
  }
});


