# 聽力練習

把聽力題目截圖變成手機可作答、可自動批改、可寫詳解的網頁。單一 `index.html`，資料存在瀏覽器（IndexedDB）。

- `src/` 分片原始碼，`python build.py` 串成 `index.html`
- `test/smoke.js` 手機尺寸的自動測試（puppeteer-core）
