/* ===== 90-boot.js — 啟動 ===== */
(async function boot() {
  try {
    const all = await dbAll();
    S.sets = all.map(s => ({ ...s, pageCount: (s.pages || []).length, pages: [] }));
  } catch (e) {
    S.sets = [];
    setTimeout(() => toast('這個瀏覽器無法離線儲存，重新整理後資料會消失'), 400);
  }
  S.screen = 'home';
  render();
})();
