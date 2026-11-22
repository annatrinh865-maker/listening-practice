const puppeteer = require('C:/Users/User/Documents/concept-social-app/app/test/node_modules/puppeteer-core');
const fs = require('fs');
const CACHE = 'C:/Users/User/AppData/Local/hermes/cache/images/';
const SHOTS = 'C:/Users/User/Documents/listening-practice/test/shots/';
const LIST = ['img_6ae09eac2603.jpeg', 'img_bdb3b2b9b2c2.jpeg', 'img_d1f47c9d2662.jpeg',
  'img_9cc1e0a23f43.jpeg', 'img_2b5da00ba6cd.jpeg', 'img_adbb3545d554.jpeg', 'img_47c98c6dbb72.jpeg'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/User/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe',
    args: ['--no-sandbox'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });
  await page.goto('file:///C:/Users/User/Documents/listening-practice/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));

  // 1) 合成測試：文字行轉 4 度
  const syn = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 700;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 700);
    x.fillStyle = '#222';
    for (let y = 40; y < 660; y += 28) x.fillRect(60, y, 700, 8);
    const r = document.createElement('canvas'); r.width = 900; r.height = 700;
    const rx = r.getContext('2d');
    rx.fillStyle = '#fff'; rx.fillRect(0, 0, 900, 700);
    rx.translate(450, 350); rx.rotate(4 * Math.PI / 180); rx.drawImage(c, -450, -350);
    const a1 = autoDeskewAngle(r);
    const fixed = rotateCanvas(r, -a1);
    const a2 = autoDeskewAngle(fixed);
    return { a1, a2 };
  });
  console.log('合成：偵測角度=' + syn.a1 + ' 校正後殘留=' + syn.a2);

  // 2) 真圖
  const out = [];
  for (const name of LIST) {
    const b64 = fs.readFileSync(CACHE + name).toString('base64');
    const r = await page.evaluate(async (b64) => {
      const url = 'data:image/jpeg;base64,' + b64;
      const im = await loadImage(url);
      const src = canvasOf(im);
      const t0 = performance.now();
      const corners = detectCorners(src);
      const tDet = performance.now();
      const res = await scanPage(url, corners, 'gray');
      const t1 = performance.now();
      return { det: Math.round(tDet - t0), total: Math.round(t1 - t0), w: res.w, h: res.h, out: res.url };
    }, b64);
    fs.writeFileSync(SHOTS + 'out-' + name.replace('.jpeg', '') + '.jpg', Buffer.from(r.out.split(',')[1], 'base64'));
    fs.copyFileSync(CACHE + name, SHOTS + 'in-' + name.replace('.jpeg', '') + '.jpg');
    out.push({ name, ...r });
    console.log(name, '偵測 ' + r.det + 'ms  全流程 ' + r.total + 'ms  ' + r.w + 'x' + r.h);
  }
  await browser.close();
})();
