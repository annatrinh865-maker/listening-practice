const puppeteer = require('C:/Users/User/Documents/concept-social-app/app/test/node_modules/puppeteer-core');
const fs = require('fs');
const CACHE = 'C:/Users/User/AppData/Local/hermes/cache/images/';
const SHOTS = 'C:/Users/User/Documents/listening-practice/test/shots/';
const LIST = ['img_6ae09eac2603.jpeg', 'img_bdb3b2b9b2c2.jpeg', 'img_d1f47c9d2662.jpeg',
  'img_636_dummy', 'img_9cc1e0a23f43.jpeg', 'img_2b5da00ba6cd.jpeg', 'img_adbb3545d554.jpeg']
  .filter(n => fs.existsSync(CACHE + n));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/User/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe',
    args: ['--no-sandbox'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });
  await page.goto('file:///C:/Users/User/Documents/listening-practice/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));
  const out = [];
  for (const name of LIST) {
    const b64 = fs.readFileSync(CACHE + name).toString('base64');
    const r = await page.evaluate(async (b64) => {
      const url = 'data:image/jpeg;base64,' + b64;
      const im = await loadImage(url);
      const src = canvasOf(im);
      const corners = detectCorners(src);
      const t0 = performance.now();
      const ang = autoDeskewAngle(src);
      const res = await scanPage(url, corners, 'gray');
      return { ms: Math.round(performance.now() - t0), ang, w: res.w, h: res.h, out: res.url,
               srcW: src.width, srcH: src.height, corners };
    }, b64);
    out.push({ name, ...r });
    console.log(name, r.ms + 'ms', 'angle=' + r.ang, r.srcW + 'x' + r.srcH, '->', r.w + 'x' + r.h);
  }
  fs.writeFileSync(SHOTS + 'scanout.json', JSON.stringify(out));
  await browser.close();
})();
