/* 用她的原始書頁照片測四角偵測，畫出結果拼成一張檢查圖 */
const puppeteer = require('C:/Users/User/Documents/concept-social-app/app/test/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CACHE = 'C:/Users/User/AppData/Local/hermes/cache/images/';
const SHOTS = 'C:/Users/User/Documents/listening-practice/test/shots/';

const LIST = [
  'img_6ae09eac2603.jpeg', 'img_bdb3b2b9b2c2.jpeg', 'img_d1f47c9d2662.jpeg', 'img_616d21dd6ec4.jpeg',
  'img_9cc1e0a23f43.jpeg', 'img_64d6055b4fc7.jpeg', 'img_c0e3ae41058f.jpeg', 'img_7fd31efe76b8.jpeg',
  'img_0abc0d064519.jpeg', 'img_2b5da00ba6cd.jpeg', 'img_ffb65f919e78.jpeg', 'img_34b76d038beb.jpeg',
  'img_adbb3545d554.jpeg', 'img_5840dd2a3517.jpeg', 'img_139cc5b8143c.jpeg', 'img_d8dada6c5965.jpeg',
  'img_744f0465bf58.jpeg', 'img_9edd88e084bc.jpeg', 'img_47c98c6dbb72.jpeg', 'img_a312062053f6.jpeg',
  'img_b3fe114728fb.jpeg', 'img_85ecb0f3d911.jpeg', 'img_cf6f7502b56c.jpeg'
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/User/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe',
    args: ['--no-sandbox'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1200 });
  await page.goto('file:///C:/Users/User/Documents/listening-practice/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));

  const results = [];
  for (const name of LIST) {
    const b64 = fs.readFileSync(CACHE + name).toString('base64');
    const r = await page.evaluate(async (b64) => {
      const im = await loadImage('data:image/jpeg;base64,' + b64);
      const src = canvasOf(im);
      const t0 = performance.now();
      const pts = detectCorners(src);
      const ms = Math.round(performance.now() - t0);
      // 縮圖 + 畫框
      const TW = 240, TH = Math.round(src.height * TW / src.width);
      const c = document.createElement('canvas'); c.width = TW; c.height = TH;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0, TW, TH);
      const k = TW / src.width;
      x.lineWidth = 2.5; x.strokeStyle = '#00ff88';
      x.beginPath();
      pts.forEach((p, i) => { const px = p[0] * k, py = p[1] * k; i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.closePath(); x.stroke();
      pts.forEach(p => { x.beginPath(); x.arc(p[0] * k, p[1] * k, 5, 0, 7); x.fillStyle = '#ff3366'; x.fill(); });
      return { pts, ms, w: src.width, h: src.height, thumb: c.toDataURL('image/jpeg', 0.82) };
    }, b64);
    results.push({ name, ...r });
    console.log(name, r.ms + 'ms', JSON.stringify(r.pts));
  }
  fs.writeFileSync(SHOTS + 'corners.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
