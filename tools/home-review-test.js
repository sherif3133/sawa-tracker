/* Silent headless check of the Home leaderboard (stats + top 5 before the character card) and the card level /
   memory header on the game's review screen. Muted Chrome, speechSynthesis stubbed.
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/home-review-test.js <outdir> <uid> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const [OUT, UID] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, label, x) => { console.log((c ? 'PASS ' : 'FAIL ') + label + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); if (!c) fails++; };

(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await (await br.createBrowserContext()).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(() => {
    try { Object.defineProperty(window, 'speechSynthesis', { value: { speak() {}, cancel() {}, getVoices: () => [], addEventListener() {} }, configurable: true }); } catch (e) { /* ignore */ }
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) { /* ignore */ }
    window.R = () => { const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('#app, .sg-root')); return h ? h.shadowRoot : document; };
  });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'as_user', value: String(UID), url: B });

  // Home: stats, then the compact leaderboard, then the character card and quests.
  await p.goto(B + '/app/?t=' + Date.now() + '#today', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.waitForFunction(() => !!R().querySelector('.board.compact #b-rows .row, .board.compact #b-rows li'), { timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => R().querySelectorAll('.board.compact #b-rows .row').length > 0, { timeout: 30000 }).catch(() => {});
  const home = await p.evaluate(() => {
    const r = R(), all = [...r.querySelectorAll('.stats, .board.compact, #hero-card')];
    const top = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1);
    return { stats: top(r.querySelector('.stats')), board: top(r.querySelector('.board.compact')), hero: top(r.querySelector('#hero-card')), rows: r.querySelectorAll('.board.compact #b-rows .row').length, more: !!r.querySelector('.board.compact [data-act=board-more]'), found: all.length };
  });
  ok(home.board > 0 && home.board > home.stats && (home.hero < 0 || home.board < home.hero), 'leaderboard right after the stat cards, before the character card', home);
  ok(home.rows >= 1 && home.rows <= 6, 'compact: top 5 (plus you if lower)', home.rows);
  await p.screenshot({ path: OUT + '/h1-home.png', fullPage: true });

  // Game review cards: card level, new cards a day, memory.
  await p.goto(B + '/app/?t=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  await (await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 60000 })).evaluate((x) => x.click());
  await p.waitForFunction(() => { const r = R(); return r.querySelector('.sg-root canvas') && !r.querySelector('.sg-load'); }, { timeout: 120000 });
  await sleep(1500);
  await p.evaluate(() => { const m = R().querySelector('.sg-menu [data-g="cards"]'); if (m) m.click(); });
  await p.waitForFunction(() => { const b = R().querySelector('.sg-revp .sg-pb'); return b && !b.querySelector('.sg-wait'); }, { timeout: 60000 }).catch(() => {});
  const rev = await p.evaluate(() => { const h = R().querySelector('.sg-rvl'); return h ? h.innerText.replace(/\s+/g, ' ') : (R().querySelector('.sg-revp') || {}).innerText; });
  ok(/Card level \d+/.test(rev || '') && /new cards? a day/.test(rev || ''), 'review screen shows card level and new cards a day', rev);
  ok(/remembered this week|see how much you remember/.test(rev || ''), 'review screen shows memory this week', rev);
  const dots = await p.evaluate(() => R().querySelectorAll('.sg-rvl .sg-dots i').length);
  ok(dots >= 1, 'level dots', dots);
  await p.screenshot({ path: OUT + '/h2-review.png' });
  ok(!errs.length, 'no script errors', errs);
  await br.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(2); });
