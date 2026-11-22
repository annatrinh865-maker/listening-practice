const puppeteer = require('C:/Users/User/Documents/concept-social-app/app/test/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8799/';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails++;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Users/User/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text()); });

  await page.goto(BASE, { waitUntil: 'load' });
  await sleep(400);
  check('首頁出現', await page.$eval('.hero .big', el => el.textContent).then(t => t === '聽力練習'));
  await page.screenshot({ path: path.join(SHOTS, '01-home.png') });

  // 上傳三張圖
  await page.click('[data-act="new"]');
  await sleep(300);
  const input = await page.$('#fileIn');
  await input.uploadFile(
    'C:/Users/User/Documents/listening-practice/probe/p1.jpg',
    'C:/Users/User/Documents/listening-practice/probe/p2.jpg',
    'C:/Users/User/Documents/listening-practice/probe/p3.jpg'
  );
  for (let i = 0; i < 40; i++) {
    const n = await page.$$eval('.thumbs .th', els => els.length).catch(() => 0);
    if (n === 3) break;
    await sleep(500);
  }
  const thumbs = await page.$$eval('.thumbs .th', els => els.length);
  check('三張縮圖都進來', thumbs === 3, 'thumbs=' + thumbs);

  await page.click('#impName', { clickCount: 3 });
  await page.type('#impName', 'Test 1 Q65-76');
  await page.click('#impFrom', { clickCount: 3 });
  await page.type('#impFrom', '65');
  await page.click('#impTo', { clickCount: 3 });
  await page.type('#impTo', '76');
  await page.screenshot({ path: path.join(SHOTS, '02-import.png') });
  await page.click('[data-act="create"]');
  await sleep(600);
  check('建立後進到題組頁', await page.$eval('.topbar h1', el => el.textContent.trim()) === 'Test 1 Q65-76');
  await page.screenshot({ path: path.join(SHOTS, '03-set.png') });

  // 設定正解 65..76 -> A B C D 循環
  await page.click('[data-act="keys"]');
  await sleep(300);
  const keys = ['A', 'B', 'B', 'D', 'C', 'C', 'C', 'A', 'D', 'B', 'C', 'A'];
  for (const k of keys) {
    await page.click(`.optgrid .opt[data-v="${k}"]`);
    await sleep(200);
  }
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '04-keys.png') });
  await page.click('[data-act="backSet"]');
  await sleep(300);
  const keyNote = await page.$eval('.menu .btn:nth-child(3) small', el => el.textContent);
  check('正解已存 12 題', /12 \/ 12/.test(keyNote), keyNote);

  // 作答：前 10 題照正解，最後 2 題故意答錯
  await page.click('[data-act="quiz"]');
  await sleep(300);
  const answers = keys.slice(0, 10).concat(['B', 'D']);
  for (let i = 0; i < answers.length; i++) {
    await page.click(`.optgrid .opt[data-v="${answers[i]}"]`);
    await sleep(230);
  }
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '05-quiz-last.png') });

  // 看原圖（閱讀器）
  await page.click('[data-act="readerOpen"]');
  await sleep(500);
  const hasImg = await page.$('#rimg');
  check('閱讀器有圖', !!hasImg);
  const t0 = await page.$eval('#rimg', el => el.style.transform);
  await page.click('.seg2 button[data-v="left"]');
  await sleep(220);
  const t1 = await page.$eval('#rimg', el => el.style.transform);
  check('左半欄放大了 2 倍', /scale\(2\)/.test(t1) && t0 !== t1, t1);
  await page.screenshot({ path: path.join(SHOTS, '06-reader-left.png') });
  await page.click('.seg2 button[data-v="full"]');
  await page.click('[data-act="closeReader"]');
  await sleep(300);
  check('關掉閱讀器回到同一題', !!await page.$('.optgrid'));

  // 交卷
  await page.click('[data-act="doGrade"]');
  await sleep(600);
  const pct = await page.$eval('.score .big', el => el.textContent);
  check('分數 10/12 = 83%', pct.startsWith('83'), 'pct=' + pct);
  const gradeRows = await page.$$eval('.grow', els => els.length);
  check('列出 12 題', gradeRows === 12, 'rows=' + gradeRows);
  await page.screenshot({ path: path.join(SHOTS, '07-grade.png') });

  // 只看錯的
  await page.click('[data-act="filter"][data-v="wrong"]');
  await sleep(300);
  const wrongRows = await page.$$eval('.grow', els => els.length);
  check('只看錯的 2 題', wrongRows === 2, 'rows=' + wrongRows);

  // 詳解 + 筆記
  await page.click('.grow');
  await sleep(300);
  await page.type('#note', '男子說 after your trip 再打來 → B');
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '08-detail.png') });
  await page.click('[data-act="grade"]');
  await sleep(300);

  // 重新整理後資料還在
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  const cards = await page.$$eval('.setcard', els => els.length);
  check('重整後題組還在', cards === 1, 'cards=' + cards);
  const cardMeta = await page.$eval('.setcard .meta', el => el.textContent);
  check('首頁卡片顯示 12 張圖/正解', /3 張圖/.test(cardMeta) && /12\/12/.test(cardMeta), cardMeta.replace(/\s+/g, ' '));
  await page.screenshot({ path: path.join(SHOTS, '09-home-after.png') });

  await page.click('.setcard');
  await sleep(600);
  const note = await page.evaluate(async () => {
    const st = window.S && window.S.set;
    return st && st.notes ? st.notes[75] : null;
  });
  const notesOk = await page.evaluate(() => {
    // 走 UI：從批改進詳解看筆記有沒有回來
    return true;
  });
  await page.click('[data-act="grade"]');
  await sleep(400);
  await page.click('[data-act="filter"][data-v="wrong"]');
  await sleep(300);
  await page.click('.grow');
  await sleep(400);
  const noteVal = await page.$eval('#note', el => el.value);
  check('筆記存回來了', /after your trip/.test(noteVal), JSON.stringify(noteVal.slice(0, 30)));

  // 360 寬不會橫向溢出
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('360 寬沒有橫向溢出', !overflow);
  await page.screenshot({ path: path.join(SHOTS, '10-detail-360.png') });

  check('沒有 JS 錯誤', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
  process.exit(fails ? 1 : 0);
})();
