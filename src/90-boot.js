/* ===== 90-boot.js — 啟動 ===== */
(async function boot() {
  try {
    const all = await dbAll();
    S.sets = all.map(s => ({ ...s, pageCount: (s.pages || []).length, pages: [] }));
  } catch (e) {
    S.sets = [];
    setTimeout(() => toast('這個瀏覽器無法離線儲存，重新整理後資料會消失'), 400);
  }
  // 第一次打開：把內建題組放進去
  if (!S.sets.some(s => s.builtin)) {
    try {
      const b = builtinSet();
      if (b) {
        await dbPut(b);
        S.sets.unshift({ ...b, pageCount: b.pages.length, pages: [] });
      }
    } catch (e) { /* 沒有內建資料就照常開 */ }
  }
  S.screen = 'home';
  render();
})();
