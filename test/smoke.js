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
  await sleep(900);
  check('首頁出現', await page.$eval('.hero .big', el => el.textContent).then(t => t === '聽力練習'));
  const cards0 = await page.$$eval('.setcard', els => els.length);
  check('內建題組自動載入', cards0 === 1, 'cards=' + cards0);
  await page.screenshot({ path: path.join(SHOTS, '01-home.png') });

  // ---- 內建題組：文字題 ----
  await page.click('.setcard');
  await sleep(500);
  const hubName = await page.$eval('.topbar h1', el => el.textContent.trim());
  check('開啟內建題組', /Test 1/.test(hubName), hubName);
  const keySmall = await page.$$eval('.menu .btn small', els => els.map(e => e.textContent).join(' | '));
  check('正解已內建 73 題', /73 \/ 73/.test(keySmall), keySmall.slice(0, 80));
  await page.screenshot({ path: path.join(SHOTS, '02-set.png') });

  await page.click('[data-act="quiz"]');
  await sleep(400);
  const qtext = (await page.$eval('.qtext', el => el.textContent)).trim();
  check('作答畫面有題目文字', qtext.length > 10, qtext.slice(0, 60));
  const optCount = await page.$$eval('.optrow', els => els.length);
  check('選項文字 3-4 個', optCount >= 3, 'opts=' + optCount);
  await page.screenshot({ path: path.join(SHOTS, '03-quiz-text.png') });

  // 中文切換
  await page.click('[data-act="zh"]');
  await sleep(250);
  check('中文翻譯可切換', !!(await page.$('.zhtext')));
  await page.screenshot({ path: path.join(SHOTS, '04-quiz-zh.png') });
  await page.click('[data-act="zh"]');
  await sleep(200);

  // 第 1-5 題：正解 A B A B A，故意錯 3 題
  const picks = ['A', 'B', 'C', 'B', 'D'];
  for (let i = 0; i < picks.length; i++) {
    await page.click(`.optrow[data-v="${picks[i]}"]`);
    await sleep(220);
  }
  await sleep(200);
  await page.click('[data-act="jump"]');
  await sleep(300);
  const jumpCount = await page.$$eval('.jump button', els => els.length);
  check('跳題面板列出 73 題', jumpCount === 73, 'btn=' + jumpCount);
  await page.click('[data-act="closeSheet"]');
  await sleep(200);

  // 原圖：第 6 題（現在在第 6 題）應在 p160
  await page.click('[data-act="openQ"]');
  await sleep(700);
  const readerSrc = await page.$eval('#rimg', el => el.getAttribute('src'));
  check('原圖跳到正確頁面', /p160\.jpg/.test(readerSrc), readerSrc);
  await page.click('[data-act="closeReader"]');
  await sleep(300);

  // 第 2 大題（Q7+）：純聽力，作答只顯示 A B C D
  await page.click('[data-act="jump"]');
  await sleep(300);
  await page.click('.jump button:nth-child(7)');
  await sleep(400);
  const hasHint = !!(await page.$('.audiohint'));
  const rows7 = await page.$$eval('.optrow', els => els.length);
  const tiles7 = await page.$$eval('.optgrid .opt', els => els.length);
  check('第 2 大題只顯示 ABCD', hasHint && rows7 === 0 && tiles7 === 4, `hint=${hasHint} rows=${rows7} tiles=${tiles7}`);
  check('第 2 大題不顯示題目文字', !(await page.$('.qtext')));
  await page.screenshot({ path: path.join(SHOTS, '05-quiz-part2.png') });
  await page.click('[data-act="stem"]');
  await sleep(350);
  const rows7b = await page.$$eval('.optrow', els => els.length);
  check('按「顯示」才出現題目與選項文字', !!(await page.$('.qtext')) && rows7b === 3, 'rows=' + rows7b);
  await page.screenshot({ path: path.join(SHOTS, '06-quiz-part2-shown.png') });
  await page.click('[data-act="stem"]');
  await sleep(250);

  await page.click('[data-act="jump"]');
  await sleep(300);
  await page.click('.jump button:nth-child(73)');
  await sleep(350);
  await page.click('[data-act="doGrade"]');
  await sleep(700);
  const pct = await page.$eval('.score .big', el => el.textContent);
  check('分數以 73 題計分母', /^3%$/.test(pct), 'pct=' + pct);
  await page.screenshot({ path: path.join(SHOTS, '05-grade.png') });

  await page.click('[data-act="filter"][data-v="wrong"]');
  await sleep(300);
  await page.click('.grow');
  await sleep(400);
  const dqText = await page.$$eval('.dq', els => els.map(e => e.textContent).join(' | '));
  check('詳解有英中對照', /[\u4e00-\u9fa5]/.test(dqText) && dqText.length > 10, dqText.slice(0, 70));
  const rightTag = await page.$$eval('.dopt.right', els => els.length);
  check('詳解標出正解選項', rightTag >= 2, 'right=' + rightTag);
  await page.screenshot({ path: path.join(SHOTS, '06-detail.png') });
  await page.type('#note', '這題關鍵字在 second paragraph');
  await sleep(300);
  await page.click('[data-act="grade"]');
  await sleep(300);

  // ---- 自己上傳的題組（圖片流程） ----
  await page.click('[data-act="backSet"]');
  await sleep(300);
  await page.click('[data-act="home"]');
  await sleep(400);
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
  await page.type('#impName', '我的截圖題組');
  await page.click('#impFrom', { clickCount: 3 });
  await page.type('#impFrom', '65');
  await page.click('#impTo', { clickCount: 3 });
  await page.type('#impTo', '76');
  await page.click('[data-act="create"]');
  await sleep(700);
  check('建立後進到題組頁', await page.$eval('.topbar h1', el => el.textContent.trim()) === '我的截圖題組');

  await page.click('[data-act="keys"]');
  await sleep(300);
  const keyLetters = ['A', 'B', 'B', 'D', 'C', 'C', 'C', 'A', 'D', 'B', 'C', 'A'];
  for (const k of keyLetters) {
    await page.click(`.optgrid .opt[data-v="${k}"]`);
    await sleep(190);
  }
  await sleep(200);
  await page.click('[data-act="backSet"]');
  await sleep(300);
  const keyNote = await page.$eval('.menu .btn:nth-child(3) small', el => el.textContent);
  check('正解已存 12 題', /12 \/ 12/.test(keyNote), keyNote);

  await page.click('[data-act="quiz"]');
  await sleep(300);
  const answers = keyLetters.slice(0, 10).concat(['B', 'D']);
  for (let i = 0; i < answers.length; i++) {
    await page.click(`.optgrid .opt[data-v="${answers[i]}"]`);
    await sleep(220);
  }
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '07-quiz-letters.png') });

  await page.click('[data-act="openQ"]');
  await sleep(600);
  check('閱讀器有圖', !!(await page.$('#rimg')));
  const t0 = await page.$eval('#rimg', el => el.style.transform);
  await page.click('.seg2 button[data-v="left"]');
  await sleep(250);
  const t1 = await page.$eval('#rimg', el => el.style.transform);
  check('左半欄放大了 2 倍', /scale\(2\)/.test(t1) && t0 !== t1, t1);
  await page.screenshot({ path: path.join(SHOTS, '08-reader-left.png') });
  await page.click('.seg2 button[data-v="full"]');
  await page.click('[data-act="closeReader"]');
  await sleep(300);

  await page.click('[data-act="doGrade"]');
  await sleep(600);
  const pct2 = await page.$eval('.score .big', el => el.textContent);
  check('圖片題組 10/12 = 83%', pct2.startsWith('83'), 'pct=' + pct2);

  await page.reload({ waitUntil: 'load' });
  await sleep(900);
  const cards = await page.$$eval('.setcard', els => els.length);
  check('重整後兩個題組都在', cards === 2, 'cards=' + cards);
  await page.screenshot({ path: path.join(SHOTS, '09-home-after.png') });

  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('360 寬沒有橫向溢出', !overflow);

  check('沒有 JS 錯誤', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
  process.exit(fails ? 1 : 0);
})();
