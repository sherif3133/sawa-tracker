/* Silent headless test: attach a YouTube video (search by title) and a pasted link to a logged activity.
   Muted Chrome, no audio. Run from language-lens/tools: node ../../sawa-tracker/tools/links-ui-test.js <outdir> <uid> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410', OUT = process.argv[2] || '.', UID = process.argv[3] || '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, label, x) => { console.log((c ? 'PASS ' : 'FAIL ') + label + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); if (!c) fails++; };
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  for (const [name, w, h] of [['phone', 390, 844], ['desk', 1280, 860]]) {
    const p = await br.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluateOnNewDocument(() => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: { speak() {}, cancel() {}, getVoices: () => [], addEventListener() {} }, configurable: true }); } catch (e) {}
      window.R = () => { const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('#app')); return h ? h.shadowRoot : document; };
    });
    await p.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
    await p.setCookie({ name: 'as_user', value: UID, url: B });
    await p.goto(B + '/app/?t=' + Date.now() + '#today', { waitUntil: 'networkidle2', timeout: 120000 });
    const btn = await p.waitForSelector('pierce/[data-act=log-activity]', { timeout: 60000 }); await btn.evaluate((x) => x.click()); await sleep(800);
    await p.evaluate(() => { const r = R(); r.querySelector('#f-log [name=activity]').checked = true; r.querySelector('#l-min').value = '25'; });
    const q = await p.waitForSelector('pierce/.lp-q');
    await q.type('j cole love yourz'); await p.waitForFunction(() => R().querySelector('.lp-it') || /found|ملقيناش|rror/.test(R().querySelector('.lp-res').textContent), { timeout: 30000 }).catch(() => {});
    const res = await p.evaluate(() => [...R().querySelectorAll('.lp-it b')].map((b) => b.textContent).slice(0, 3));
    ok(res.length > 0, name + ': search shows videos', res.length ? res : await p.evaluate(() => { const r = R().querySelector('.lp-res'); return [r ? r.innerHTML.slice(0, 300) : 'no box', R().querySelector('.lp-q') ? R().querySelector('.lp-q').value : 'no input']; }));
    await p.evaluate(() => R().querySelector('.lp-it').click()); await sleep(300);
    await q.type('https://youtu.be/dQw4w9WgXcQ'); await p.waitForFunction(() => R().querySelector('.lp-it') || /found|ملقيناش|rror/.test(R().querySelector('.lp-res').textContent), { timeout: 30000 }).catch(() => {});
    await p.evaluate(() => { const it = R().querySelector('.lp-it'); if (it) it.click(); }); await sleep(300);
    await q.type('https://www.bbc.co.uk/learningenglish'); await p.waitForFunction(() => R().querySelector('.lp-it'), { timeout: 30000 }).catch(() => {});
    await p.evaluate(() => { const it = R().querySelector('.lp-it'); if (it) it.click(); }); await sleep(300);
    const chips = await p.evaluate(() => [...R().querySelectorAll('.lp-chip')].map((c) => c.textContent.replace('×', '').trim()));
    ok(chips.length === 3, name + ': 3 links attached', chips);
    await p.screenshot({ path: OUT + '/links-' + name + '.png' });
    await p.evaluate(() => R().querySelector('#f-log [type=submit]').click()); await p.waitForFunction(() => !R().querySelector('#f-log'), { timeout: 30000 }).catch(() => {});
    const me = await p.evaluate(async (B) => { const r = await fetch(B + '/wp-json/sawa-tracker/v1/me', { credentials: 'same-origin' }); return r.json(); }, B);
    const rec = (me.recent || (me.data && me.data.recent) || [])[0] || {};
    ok((rec.links || []).length === 3, name + ': saved with the log', (rec.links || []).map((l) => l.title));
    console.log(name + ' errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
    if (rec.id) await p.evaluate(async (B, id) => { await fetch(B + '/wp-json/sawa-tracker/v1/log/' + id, { method: 'DELETE', credentials: 'same-origin' }); }, B, rec.id); // tidy up
    await p.close();
  }
  await br.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
