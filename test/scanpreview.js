const puppeteer = require('C:/Users/User/Documents/concept-social-app/app/test/node_modules/puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/User/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe',
    args: ['--no-sandbox'], headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8799/', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 700));
  const out = await page.evaluate(async () => {
    const buf = await (await fetch('/probe/p1.jpg')).blob();
    const file = new File([buf], 'p1.jpg', { type: 'image/jpeg' });
    const p = await compressFile(file);
    return {
      orig: p.url,
      gray: await enhanceDataUrl(p.url, 'gray'),
      bw: await enhanceDataUrl(p.url, 'bw')
    };
  });
  for (const k of Object.keys(out)) {
    fs.writeFileSync('C:/Users/User/Documents/listening-practice/test/shots/scan-' + k + '.jpg', Buffer.from(out[k].split(',')[1], 'base64'));
  }
  console.log('saved', Object.keys(out).join(', '));
  await browser.close();
})();
