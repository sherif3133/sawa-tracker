/* Silent headless UI test of @mentions: the app chat (/app) and the in-game chat. Muted Chrome, speechSynthesis stubbed.
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/mention-ui-test.js <outdir> <uidA> <uidB> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const [OUT, A, Bb] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, label, x) => { console.log((c ? 'PASS ' : 'FAIL ') + label + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); if (!c) fails++; };

(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = async (uid, w, h) => {
    const p = await (await br.createBrowserContext()).newPage();
    p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.evaluateOnNewDocument(() => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: { speak() {}, cancel() {}, getVoices: () => [], addEventListener() {} }, configurable: true }); } catch (e) { /* ignore */ }
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) { /* ignore */ }
      window.R = () => { const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('#app, .sg-root')); return h ? h.shadowRoot : document; };
    });
    await p.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
    await p.setCookie({ name: 'as_user', value: String(uid), url: B });
    return p;
  };
  const me = async (uid) => (await (await fetch(B + '/wp-json/sawa-tracker/v1/me?as=' + uid)).json()).me.name;
  const nameB = await me(Bb);

  // A types "@" + the first letters of B's name, picks B from the list, sends.
  const a = await page(A, 390, 844);
  await a.goto(B + '/app/?t=' + Date.now() + '#chat', { waitUntil: 'networkidle2', timeout: 120000 });
  await (await a.waitForSelector('pierce/[data-act=open-room]', { timeout: 60000 })).evaluate((x) => x.click());
  await a.waitForSelector('pierce/#m-body', { timeout: 30000 });
  await a.focus('pierce/#m-body');
  await a.keyboard.type('Good morning @' + nameB.slice(0, 3), { delay: 30 });
  await a.waitForFunction((n) => { const b = R().querySelector('#mp-main'); return b && [...b.querySelectorAll('[data-act=mention-pick]')].some((x) => x.dataset.name === n); }, { timeout: 30000 }, nameB).catch(() => {});
  const list = await a.evaluate(() => { const b = R().querySelector('#mp-main'); return b ? [...b.querySelectorAll('button')].map((x) => x.innerText.trim()) : []; });
  ok(list.includes(nameB), 'typing @ shows matching classmates', list);
  const tapH = await a.evaluate(() => { const x = R().querySelector('#mp-main button'); return x ? Math.round(x.getBoundingClientRect().height) : 0; });
  ok(tapH >= 40, 'suggestions are big enough to tap on a phone', tapH);
  await a.screenshot({ path: OUT + '/m1-suggest.png' });
  await a.evaluate((n) => [...R().querySelectorAll('#mp-main [data-act=mention-pick]')].find((x) => x.dataset.name === n).click(), nameB);
  ok((await a.evaluate(() => R().querySelector('#m-body').value)) === 'Good morning @' + nameB + ' ', 'picking fills in the full name', await a.evaluate(() => R().querySelector('#m-body').value));
  await a.keyboard.type('are you ready for the speaking club?');
  await a.evaluate(() => R().querySelector('.send-btn').click());
  await a.waitForFunction(() => !!R().querySelector('#msgs li.msg.mine .mention'), { timeout: 30000 }).catch(() => {});
  ok(await a.evaluate(() => !!R().querySelector('#msgs li.msg.mine .mention')), 'the @Name is highlighted in the sent message');

  // B sees the @ badge on the room and the message marked for them.
  const b = await page(Bb, 1280, 860);
  await b.goto(B + '/app/?t=' + Date.now() + '#chat', { waitUntil: 'networkidle2', timeout: 120000 });
  await b.waitForSelector('pierce/[data-act=open-room]', { timeout: 60000 });
  ok(await b.evaluate(() => !!R().querySelector('[data-act=open-room] .at-unread')), 'the room shows an @ badge');
  await b.evaluate(() => R().querySelector('[data-act=open-room]').click());
  await b.waitForFunction(() => !!R().querySelector('#msgs li.msg.pinged'), { timeout: 30000 }).catch(() => {});
  ok(await b.evaluate(() => !!R().querySelector('#msgs li.msg.pinged')), 'the message is highlighted for the mentioned student');
  await b.screenshot({ path: OUT + '/m2-pinged.png' });
  await b.goto(B + '/app/?t=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 }); // the bell is on Home and Community
  await (await b.waitForSelector('pierce/.bell', { timeout: 60000 })).evaluate((x) => x.click());
  await b.waitForSelector('pierce/#modal .events', { timeout: 30000 }).catch(() => {});
  const note = await b.evaluate(() => { const e = R().querySelector('#modal .events'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 200) : ''; });
  ok(/mentioned you/.test(note), 'bell notification says who mentioned you', note);

  // In the game: @ suggestions in the chat panel.
  const g = await page(A, 390, 844);
  await g.goto(B + '/app/?t=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  await (await g.waitForSelector('pierce/[data-act="w-open"]', { timeout: 60000 })).evaluate((x) => x.click());
  await g.waitForFunction(() => { const r = R(); return r.querySelector('.sg-root canvas') && !r.querySelector('.sg-load'); }, { timeout: 120000 });
  await sleep(1500);
  await g.evaluate(() => { const m = R().querySelector('.sg-menu [data-g="chat"]'); if (m) m.click(); });
  await g.waitForSelector('pierce/.sg-send input', { timeout: 30000 });
  await g.focus('pierce/.sg-send input');
  await g.keyboard.type('Hello @' + nameB.slice(0, 3), { delay: 30 });
  await g.waitForFunction(() => R().querySelectorAll('.sg-mp [data-mid]').length > 0, { timeout: 30000 }).catch(() => {});
  const gl = await g.evaluate(() => [...R().querySelectorAll('.sg-mp [data-mid]')].map((x) => x.innerText));
  ok(gl.includes('@' + nameB), 'game chat suggests classmates after @', gl);
  if (gl.includes('@' + nameB)) {
    await g.evaluate((n) => [...R().querySelectorAll('.sg-mp [data-mid]')].find((x) => x.dataset.mname === n).click(), nameB);
    ok((await g.evaluate(() => R().querySelector('.sg-send input').value)) === 'Hello @' + nameB + ' ', 'game: picking fills in the name');
    await g.screenshot({ path: OUT + '/m3-game-suggest.png' });
  }
  ok(!a.errs.length && !b.errs.length && !g.errs.length, 'no script errors', a.errs.concat(b.errs, g.errs));
  await br.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(2); });
