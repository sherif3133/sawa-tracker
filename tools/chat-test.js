/* End-to-end test of the tracker chat on the local Playground (mocked AI, transcription and GIPHY).
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/chat-test.js <outdir> <photo.png> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const OUT = process.argv[2] || '.';
const PHOTO = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
	const br = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
	const ctx = br.defaultBrowserContext();
	await ctx.overridePermissions(B, ['microphone']);
	const p = await br.newPage();
	await p.evaluateOnNewDocument(() => { window.R = () => { const h = document.querySelector('.sawa-tracker-app'); return h && h.shadowRoot ? h.shadowRoot : document; }; });
	await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
	const errs = [];
	p.on('pageerror', (e) => errs.push(e.message));
	const as = async (id) => { await p.setCookie({ name: 'as_user', value: String(id), url: B }); };
	const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
	const toastText = () => p.evaluate(() => { const t = R().querySelector('.toast'); return t ? t.textContent : ''; });
	const click = async (sel) => { sel = sel.indexOf('pierce/') === 0 ? sel : 'pierce/' + sel; await p.waitForSelector(sel, { visible: true, timeout: 25000 }); await p.click(sel); await sleep(500); };
	const send = async (text) => { await p.evaluate((t) => { R().querySelector('#m-body').value = t; }, text); const n0 = await p.evaluate(() => R().querySelectorAll('#msgs li.msg').length); await p.click('pierce/.send-btn'); await p.waitForFunction((n) => R().querySelectorAll('#msgs li.msg').length > n || !!R().querySelector('.toast.bad'), { timeout: 20000 }, n0).catch(() => {}); await sleep(300); };
	const lastMsg = () => p.evaluate(() => { const l = [...R().querySelectorAll('#msgs li.msg')]; return l.length ? l[l.length - 1].innerText.replace(/\s+/g, ' ').slice(0, 120) : ''; });

	// 1) Photo gate
	await as(2);
	await p.goto(B + '/tracker/', { waitUntil: 'networkidle0' });
	await sleep(800);
	await shot('1-photo-gate');
	console.log('photo gate:', await p.evaluate(() => !!R().querySelector('.photo-gate')));
	const input = await p.$('pierce/#av-file');
	await input.uploadFile(PHOTO);
	await sleep(2500);
	console.log('after upload, dashboard:', await p.evaluate(() => !R().querySelector('.photo-gate') && !!R().querySelector('.nav')));

	// 2) Chat: text + feedback
	await click('.nav [data-view=chat]');
	await click('[data-act=open-room]');
	await p.waitForSelector('pierce/#m-body'); await p.waitForFunction(() => !R().querySelector('#msgs li.loading'), { timeout: 20000 });
	await send('I dont know what i go to do tomorow.');
	console.log('text sent:', await lastMsg(), '| toast:', await toastText()); await shot('1b-chat');
	await p.evaluate(() => { const b = [...R().querySelectorAll('#msgs li.msg.mine [data-act=feedback]')].pop(); b.click(); });
	await p.waitForFunction(() => !!R().querySelector('.fb-errs, .fb-good, .toast.bad'), { timeout: 40000 }); console.log('fb toast:', await toastText());
	await sleep(400);
	await shot('2-feedback');
	console.log('feedback items:', await p.$$eval('pierce/.fb-errs li', (l) => l.length), '| locked:', await p.$$eval('pierce/.fb-errs li', (l) => l.filter((x) => /unlocks/.test(x.textContent)).length));
	await click('#modal [data-act=close]');

	// 3) Sticker + GIF
	await click('[data-act=tray]');
	await shot('3-stickers');
	await click('[data-act=send-sticker][data-s=welldone]'); await p.waitForFunction(() => !!R().querySelector('#msgs li.msg:last-child .sticker'), { timeout: 20000 });
	console.log('sticker:', await lastMsg());
	await click('[data-act=tray]');
	await click('[data-act=tray-tab][data-tab=gif]');
	await p.waitForFunction(() => !!R().querySelector('.gif-pick, #gif-grid .err, #gif-grid p'), { timeout: 30000 }).catch(() => {}); await shot('3b-gifs'); console.log('gif tray:', await p.evaluate(() => { const t = R().querySelector('#tray'); return t ? t.innerText.slice(0, 120) + ' | picks ' + t.querySelectorAll('.gif-pick').length : 'no tray'; }));
	await click('.gif-pick'); await p.waitForFunction(() => !!R().querySelector('#msgs li.msg:last-child img.gif'), { timeout: 20000 }).catch(() => {});
	console.log('gif sent:', await p.evaluate(() => !!R().querySelector('#msgs li.msg:last-child img.gif')));

	// 4) Voice note (fake mic, 3 s), transcript
	await click('[data-act=mic]');
	await sleep(3200);
	console.log('timer shows:', await p.$eval('pierce/#rec-t', (e) => e.textContent));
	await click('[data-act=rec-send]');
	await p.waitForFunction(() => !!R().querySelector('#msgs li.msg:last-child audio'), { timeout: 25000 }).catch(() => {});
	console.log('voice sent:', await p.evaluate(() => !!R().querySelector('#msgs li.msg:last-child audio')), '| dur:', await p.evaluate(() => { const d = R().querySelector('#msgs li.msg:last-child .v-dur'); return d ? d.textContent : ''; }));
	await p.evaluate(() => R().querySelector('#msgs li.msg:last-child [data-act=transcribe]').click());
	await p.waitForFunction(() => !!R().querySelector('#msgs li.msg:last-child .v-text') || !!R().querySelector('.toast.bad'), { timeout: 60000 });
	console.log('transcript:', await p.evaluate(() => { const v = R().querySelector('#msgs li.msg:last-child .v-text'); return v ? v.textContent : 'none'; }), '| toast:', await toastText());
	await shot('4-voice');

	// 5) Spam limit: 4 in a row so far → 5th ok, 6th blocked
	await send('Number five.');
	await send('Number six.');
	console.log('spam toast:', await toastText());

	// 6) Omar replies to Mona's first message and reacts
	const firstId = await p.evaluate(() => R().querySelector('#msgs li.msg.mine').dataset.id);
	await as(3);
	await p.goto(B + '/tracker/#chat', { waitUntil: 'networkidle0' }); await sleep(2000); await shot('5a-omar'); console.log('omar sees:', await p.evaluate(() => R().querySelector('#app') ? R().querySelector('#app').innerText.slice(0, 150).replace(/s+/g, " ") : "no app"));
	if (!(await p.evaluate(() => !!R().querySelector('#m-body')))) await click('[data-act=open-room]');
	await p.waitForSelector(`pierce/#msgs li[data-id="${firstId}"]`, { timeout: 20000 });
	await p.evaluate((id) => R().querySelector(`#msgs li[data-id="${id}"] [data-act=msg-reply]`).click(), firstId);
	await sleep(300);
	console.log('reply bar:', await p.$eval('pierce/#reply-bar', (e) => e.innerText.replace(/\s+/g, ' ')));
	await send('Do you mean "what I am going to do"?');
	await p.evaluate((id) => R().querySelector(`#msgs li[data-id="${id}"] [data-act=react-pick]`).click(), firstId);
	await sleep(300);
	await p.evaluate(() => R().querySelector('.react-pick [data-e="❤️"]').click());
	await p.waitForFunction((id) => !!R().querySelector('#msgs li[data-id="' + id + '"] .rx'), { timeout: 20000 }, firstId).catch(() => {});
	await shot('5-reply-react');
	console.log('quote in reply:', await p.evaluate(() => !!R().querySelector('#msgs li.msg:last-child .m-quote')), '| reaction:', await p.evaluate((id) => { const r = R().querySelector(`#msgs li[data-id="${id}"] .rx`); return r ? r.textContent : ''; }, firstId));

	// 7) Mona gets a notification and opens it
	await as(2);
	await p.goto(B + '/tracker/', { waitUntil: 'networkidle0' });
	await sleep(1500);
	console.log('bell count:', await p.evaluate(() => { const b = R().querySelector('.bell i'); return b ? b.textContent : '0'; }));
	await click('[data-act=notifs]');
	await shot('6-notifs');
	console.log('notif:', await p.evaluate(() => { const n = R().querySelector('.ev-link'); return n ? n.innerText.replace(/\s+/g, ' ') : ''; }));
	await click('.ev-link');
	await p.waitForFunction(() => !!R().querySelector('#msgs li.flash'), { timeout: 25000 }).catch(() => {});
	await shot('7-opened');
	console.log('opened room, flashed:', await p.evaluate(() => !!R().querySelector('#msgs li.flash')));
	console.log('JS errors:', errs.length ? errs : 'none');
	await br.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
