/* ===== 20-store.js — 資料層 ===== */
const LETTERS = ['A', 'B', 'C', 'D'];
const DB_NAME = 'lp-db';
const DB_VER = 1;
let _db = null;

function openDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    if (!window.indexedDB) return rej(new Error('這個瀏覽器不支援離線儲存'));
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('sets')) d.createObjectStore('sets', { keyPath: 'id' });
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function dbAll() {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction('sets', 'readonly').objectStore('sets').getAll();
    req.onsuccess = () => res((req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    req.onerror = () => rej(req.error);
  });
}
async function dbGet(id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction('sets', 'readonly').objectStore('sets').get(id);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}
async function dbPut(s) {
  const d = await openDB();
  s.updatedAt = Date.now();
  return new Promise((res, rej) => {
    const req = d.transaction('sets', 'readwrite').objectStore('sets').put(s);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}
async function dbDel(id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction('sets', 'readwrite').objectStore('sets').delete(id);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function qlist(set) {
  const out = [];
  for (let n = set.qFrom; n <= set.qTo; n++) out.push(n);
  return out;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* 圖片壓縮：長邊上限 2200px、JPEG 0.85，一張約 300–600KB */
async function compressFile(file) {
  const bitmap = await (async () => {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) { /* fall through */ } }
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('這張圖片讀不進來'));
      img.src = URL.createObjectURL(file);
    });
  })();
  const w0 = bitmap.width, h0 = bitmap.height;
  const MAX = 2200;
  const k = Math.min(1, MAX / Math.max(w0, h0));
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(bitmap, 0, 0, w, h);
  const url = cv.toDataURL('image/jpeg', 0.85);
  return { id: uid(), url, w, h, bytes: Math.round(url.length * 0.75) };
}
