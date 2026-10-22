/* Silent headless UI test of chat threads and the reply goal: the app chat (/app, English build) on a computer
   and a phone, and the in-game chat on the Silk Road. Muted Chrome, speechSynthesis stubbed, no audio is played.
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/thread-ui-test.js <outdir> <uidA> <uidB> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const OUT = process.argv[2] || '.';
const A = process.argv[3], Bb = process.argv[4];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, label, x) => { console.log((c ? 'PASS ' : 'FAIL ') + label + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); if (!c) fails++; };

(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=user-gesture-required', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = async (uid, w, h) => {
    const ctx = await br.createBrowserContext(); // one cookie jar per student
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('wp-json')) errs.push('HTTP ' + r.status() + ' ' + r.url().replace(B, '')); });
    p.errs = errs;
    await p.evaluateOnNewDocument(() => {
      const quiet = { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices: () => [], speaking: false, pending: false, addEventListener() {}, onvoiceschanged: null };
      try { Object.defineProperty(window, 'speechSynthesis', { value: quiet, configurable: true }); } catch (e) { /* ignore */ }
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) { /* ignore */ }
      window.R = () => { const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('#app, .sg-root')); return h ? h.shadowRoot : document; };
    });
    await p.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
    await p.setCookie({ name: 'as_user', value: String(uid), url: B });
    return p;
  };
  const clk = async (p, sel) => { const e = await p.waitForSelector('pierce/' + sel, { visible: true, timeout: 60000 }); await e.evaluate((x) => x.click()); await sleep(600); };
  const txt = (p, sel) => p.evaluate((s) => { const e = R().querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const toast = (p) => txt(p, '.toast');

  // A writes a question in the main chat (computer, /app English build).
  const a = await page(A, 1280, 860);
  await a.goto(B + '/app/?t=' + Date.now() + '#chat', { waitUntil: 'networkidle2', timeout: 120000 });
  await clk(a, '[data-act=open-room]');
  await a.waitForFunction(() => R().querySelector('#msgs') && !R().querySelector('#msgs li.loading'), { timeout: 30000 });
  ok(!!(await txt(a, '#goal-rooms .goal-pill')), 'goal pill in the room list', await txt(a, '#goal-rooms .goal-pill'));
  const q = 'Which English podcast do you listen to? ' + Date.now();
  await a.evaluate((t) => { R().querySelector('#m-body').value = t; }, q);
  await clk(a, '.send-btn');
  await a.waitForFunction((t) => [...R().querySelectorAll('#msgs li.msg')].some((x) => x.innerText.includes(t)), { timeout: 30000 }, q).catch(() => {});
  const qid = await a.evaluate((t) => { const l = [...R().querySelectorAll('#msgs li.msg')].find((x) => x.innerText.includes(t)); return l ? +l.dataset.id : 0; }, q);
  ok(qid > 0, 'question posted', qid || [await toast(a), await txt(a, '.convo-h'), a.errs]);

  // B (phone) opens it as a thread and replies.
  const b = await page(Bb, 390, 844);
  await b.goto(B + '/app/?t=' + Date.now() + '#chat', { waitUntil: 'networkidle2', timeout: 120000 });
  await clk(b, '[data-act=open-room]');
  await b.waitForFunction((id) => !!R().querySelector('#msgs li.msg[data-id="' + id + '"]'), { timeout: 30000 }, qid);
  ok(!!(await txt(b, '#goal-convo .goal-pill')), 'goal pill above the chat on a phone', await txt(b, '#goal-convo .goal-pill'));
  const tapH = await b.evaluate((id) => { const x = R().querySelector('#msgs li.msg[data-id="' + id + '"] [data-act=open-thread]'); return x ? Math.round(x.getBoundingClientRect().height) : 0; }, qid);
  ok(tapH >= 28, '"Reply in thread" button is visible on a phone (no hover needed)', tapH);
  await b.evaluate((id) => R().querySelector('#msgs li.msg[data-id="' + id + '"] [data-act=open-thread]').click(), qid);
  await b.waitForFunction(() => { const t = R().querySelector('#thread-pane'); return t && !t.hidden && R().querySelector('#th-body'); }, { timeout: 30000 });
  const paneBox = await b.evaluate(() => { const r = R().querySelector('#thread-pane').getBoundingClientRect(); const c = R().querySelector('.convo'); return { w: Math.round(r.width), convoHidden: getComputedStyle(c).display === 'none' }; });
  ok(paneBox.w >= 340 && paneBox.convoHidden, 'thread fills the screen on a phone', paneBox);
  await b.waitForFunction(() => !R().querySelector('#th-msgs .th-div .spin'), { timeout: 60000 });
  await b.screenshot({ path: OUT + '/t1-phone-thread-empty.png' });
  await b.evaluate(() => { R().querySelector('#th-body').value = 'I listen to the BBC Learning English podcast every morning.'; });
  await clk(b, '#f-th .send-btn');
  await b.waitForFunction(() => R().querySelectorAll('#th-msgs li.msg').length >= 2, { timeout: 30000 });
  const t1 = await toast(b);
  ok(/reply counted: 1\/10/.test(t1), 'reply counted toast', t1);
  ok(/1\/10/.test(await txt(b, '#goal-thread .goal-pill')), 'goal pill shows 1/10 in the thread', await txt(b, '#goal-thread .goal-pill'));
  await b.screenshot({ path: OUT + '/t2-phone-thread-reply.png' });
  // near-empty reply: sent but not counted
  await sleep(1500);
  await b.evaluate(() => { R().querySelector('#th-body').value = 'yes yes'; });
  await clk(b, '#f-th .send-btn');
  await b.waitForFunction(() => /English words/.test(R().querySelector('.toast').textContent), { timeout: 30000 }).catch(() => {});
  ok(/3 English words/.test(await toast(b)), 'near-empty reply explains why it did not count', await toast(b));
  // Arabic in a thread goes through translation (AI mock)
  await sleep(1500);
  await b.evaluate(() => { R().querySelector('#th-body').value = 'انا بسمع بودكاست كل يوم'; });
  await clk(b, '#f-th .send-btn');
  await b.waitForFunction(() => { const p = R().querySelector('#th-tr'); return p && !p.hidden && !p.querySelector('.spin'); }, { timeout: 30000 }).catch(() => {});
  const tr = await b.evaluate(() => { const p = R().querySelector('#th-tr'); return p && !p.hidden ? p.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''; });
  ok(!!tr, 'Arabic in the thread opens the translate box', tr);
  if (tr) { await clk(b, '#th-tr [data-act=tr-cancel]'); }
  await clk(b, '[data-act=close-thread]');
  await b.waitForFunction((id) => { const s = R().querySelector('#msgs li.msg[data-id="' + id + '"] .th-sum'); return s && /repl/.test(s.innerText); }, { timeout: 20000 }, qid).catch(() => {});
  const sum = await b.evaluate((id) => { const s = R().querySelector('#msgs li.msg[data-id="' + id + '"] .th-sum'); return s ? s.innerText.replace(/\s+/g, ' ') : ''; }, qid);
  ok(/2 replies.*last reply/.test(sum), '"N replies · last reply …" under the message', sum);
  await b.screenshot({ path: OUT + '/t3-phone-summary.png' });

  // A (computer) gets the unread marker without reloading, opens the thread beside the chat.
  await a.bringToFront(); // a hidden tab doesn't poll
  await a.waitForFunction((id) => { const s = R().querySelector('#msgs li.msg[data-id="' + id + '"] .th-sum'); return s && s.classList.contains('new'); }, { timeout: 30000 }, qid).catch(() => {});
  const aSum = await a.evaluate((id) => { const s = R().querySelector('#msgs li.msg[data-id="' + id + '"] .th-sum'); return s ? { t: s.innerText.replace(/\s+/g, ' '), isNew: s.classList.contains('new') } : null; }, qid);
  ok(aSum && aSum.isNew, 'thread starter sees new replies marked (live poll)', aSum);
  await a.evaluate((id) => R().querySelector('#msgs li.msg[data-id="' + id + '"] .th-sum').click(), qid);
  await a.waitForFunction(() => !R().querySelector('#th-msgs .th-div .spin'), { timeout: 60000 });
  await a.waitForFunction(() => R().querySelectorAll('#th-msgs li.msg').length >= 2, { timeout: 30000 });
  const side = await a.evaluate(() => ({ convo: getComputedStyle(R().querySelector('.convo')).display !== 'none', pane: Math.round(R().querySelector('#thread-pane').getBoundingClientRect().width) }));
  ok(side.convo && side.pane > 250, 'thread opens in a side panel on a computer', side);
  await a.screenshot({ path: OUT + '/t4-desktop-thread.png' });
  await clk(a, '[data-act=thread-follow]');
  ok(/Follow/.test(await txt(a, '[data-act=thread-follow]')), 'follow toggle works', await txt(a, '[data-act=thread-follow]'));
  await clk(a, '[data-act=thread-follow]');
  // bell notification
  await a.goto(B + '/app/?t=' + Date.now() + '#chat', { waitUntil: 'networkidle2', timeout: 120000 });
  ok(a.errs.length === 0, 'no script errors on the computer', a.errs);
  ok(b.errs.length === 0, 'no script errors on the phone', b.errs);

  // In-game chat: open the world, the chat panel, the thread, reply without leaving the game.
  const g = await page(Bb, 390, 844);
  await g.goto(B + '/app/?t=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  await clk(g, '[data-act="w-open"]');
  await g.waitForSelector('pierce/.sg-root canvas', { timeout: 120000 });
  await g.waitForFunction(() => { const r = R(); return r.querySelector('.sg-root') && !r.querySelector('.sg-load'); }, { timeout: 120000 });
  await sleep(1500);
  if (await txt(g, '.sg-look')) { await clk(g, '[data-o="save"]'); await sleep(2500); }
  // put the question into the town chat for this test
  await g.evaluate(() => { const m = R().querySelector('.sg-menu [data-g="chat"]'); if (m) m.click(); });
  await sleep(500);
  if (!(await txt(g, '.sg-chatp'))) { await g.evaluate(() => { const b = [...R().querySelectorAll('.sg-menu button')].find((x) => /Chat/.test(x.innerText)); if (b) b.click(); }); }
  await g.waitForSelector('pierce/.sg-chatp .sg-msgs', { timeout: 30000 });
  await g.waitForFunction(() => !R().querySelector('.sg-msgs .sg-wait'), { timeout: 30000 });
  ok(/Replies today/.test(await txt(g, '.sg-goal')), 'goal bar in the game chat', await txt(g, '.sg-goal'));
  const hasReply = await g.evaluate(() => R().querySelectorAll('.sg-msgs [data-th]').length);
  ok(hasReply > 0 || /No messages/.test(await txt(g, '.sg-msgs')), 'Reply buttons under game chat messages', hasReply);
  if (hasReply) {
    await g.evaluate(() => { const l = [...R().querySelectorAll('.sg-msgs [data-th]')]; l[l.length - 1].click(); });
    await g.waitForFunction(() => /Thread/.test(R().querySelector('.sg-chatp .sg-tabs').innerText), { timeout: 20000 });
    await sleep(1200);
    await g.evaluate(() => { R().querySelector('.sg-send input').value = 'Good question, I like learning English with podcasts too.'; R().querySelector('.sg-send button').click(); });
    await g.waitForFunction(() => !R().querySelector('.sg-send input').value, { timeout: 40000 }).catch(() => {});
    await sleep(300);
    const hint = await txt(g, '.sg-hint');
    ok(/reply counted|Very fast|XP/.test(hint), 'thread reply from inside the game', hint);
    ok(/Back to the chat/.test(await txt(g, '.sg-chatp .sg-tabs')), 'still inside the game panel', await txt(g, '.sg-chatp .sg-tabs'));
    await g.screenshot({ path: OUT + '/t5-game-thread.png' });
    await clk(g, '[data-thx]');
    await g.waitForFunction(() => /repl/.test(R().querySelector('.sg-msgs').innerText), { timeout: 40000 }).catch(() => {});
    ok(/repl/.test(await txt(g, '.sg-msgs')), 'game chat shows the reply count', (await txt(g, '.sg-msgs')).slice(-120));
    await g.screenshot({ path: OUT + '/t6-game-chat.png' });
  }
  ok(g.errs.length === 0, 'no script errors in the game', g.errs);
  await br.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(2); });
