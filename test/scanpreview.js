const puppeteer = require('C:/Users/User/Documents/concept-social-app/app/test/node_modules/puppeteer-core');
const fs = require('fs');
const SHOTS = 'C:/Users/User/Documents/listening-practice/test/shots/';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/User/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe',
    args: ['--no-sandbox'], headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 780, height: 1688, deviceScaleFactor: 1 });
  await page.goto('file:///C:/Users/User/Documents/listening-practice/index.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));
  const b64 = fs.readFileSync('C:/Users/User/Documents/listening-practice/probe/p1.jpg').toString('base64');
  const out = await page.evaluate(async (b64) => {
    const im = await loadImage('data:image/jpeg;base64,' + b64);
    const src = canvasOf(im);
    const corners = detectCorners(src);
    const res = { corners, orig: src.toDataURL('image/jpeg', 0.8) };
    for (const m of ['gray', 'bw']) {
      const w = warpPerspective(src, corners, 1600);
      enhanceCanvas(w, m);
      res[m] = w.toDataURL('image/jpeg', 0.85);
    }
    return res;
  }, b64);
  for (const k of ['orig', 'gray', 'bw']) {
    fs.writeFileSync(SHOTS + 'scan-' + k + '.jpg', Buffer.from(out[k].split(',')[1], 'base64'));
  }
  console.log('corners', JSON.stringify(out.corners));
  await browser.close();
})();
