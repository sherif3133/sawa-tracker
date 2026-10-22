/* Silent test of Feedback & Dev (Home → Feedback & Dev in /app) on the local WordPress Playground: the roadmap,
   posting with the "tell us more" check, votes, replies, hidden names, admin moderation, and the 💬 Beta sheet's check.
   Students are users 3 and 5 (past the first-step gate) (as_user cookie), the admin is user 1. Phone size with touch, then a computer.
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/board-test.js <outdir> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const OUT = process.argv[2] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };
const DESK = { width: 1280, height: 860 };
const stamp = Date.now().toString(36);

async function open(br, uid, size, hash) {
	const ctx = await br.createBrowserContext();
	const p = await ctx.newPage();
	await p.setViewport(size);
	await p.evaluateOnNewDocument(() => { window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [], onvoiceschanged: null }; HTMLMediaElement.prototype.play = () => Promise.resolve(); });
	p.errs = [];
	p.on('pageerror', (e) => p.errs.push(e.message));
	p.on('dialog', (d) => d.accept());
	await p.setCookie({ name: 'as_user', value: String(uid), url: B });
	await p.goto(B + '/app/?t=' + Date.now() + '#' + (hash || 'dev'), { waitUntil: 'networkidle2', timeout: 60000 });
	await p.waitForSelector('.sb .sb-tabs', { timeout: 30000 }).catch(() => {});
	await sleep(600);
	return p;
}
const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const click = async (p, sel) => { await p.waitForSelector(sel, { timeout: 15000 }); await p.click(sel); await sleep(700); };
async function tab(p, t) { await click(p, '.sb-tabs [data-tab="' + t + '"]'); await p.waitForSelector(t === 'road' ? '[data-col]' : '.sb-chip[data-sort]', { timeout: 30000 }); await sleep(300); }
async function post(p, kind, text, anon) {
	if (await p.$('[data-compose]')) await click(p, '[data-compose]');
	await click(p, '.sb-new [data-kind="' + kind + '"]');
	await p.$eval('.sb-new textarea', (t, v) => { t.value = v; t.dispatchEvent(new Event('input')); }, text);
	if (anon) await p.$eval('.sb-new [data-anon]', (c) => { c.checked = true; c.dispatchEvent(new Event('change')); });
	await click(p, '.sb-new [data-post]');
	await settle(p);
}
const settle = async (p) => { await p.waitForFunction(() => !document.querySelector('.sb-new button[disabled]') && !/Loading/.test((document.querySelector('.sb-in') || {}).innerText || ''), { timeout: 45000 }); await sleep(400); };
const score = (p, id, want) => p.waitForFunction((id, w) => { const e = document.querySelector('.sb-item[data-id="' + id + '"] .sb-vote b'); return e && e.textContent === w; }, { timeout: 30000 }, id, want).then(() => true, () => false);
const openItem = async (p, id) => { await p.waitForSelector('.sb-item[data-id="' + id + '"] [data-open]', { timeout: 30000 }); await p.$eval('.sb-item[data-id="' + id + '"] [data-open]', (e) => e.click()); await p.waitForSelector('[data-reply]', { timeout: 30000 }); await sleep(300); };
const saved = (p, re) => p.waitForFunction((src) => new RegExp(src).test((document.querySelector('.sb-in') || {}).innerText || ''), { timeout: 30000 }, re.source).then(() => true, () => false);
const itemByText = (p, t) => p.evaluate((t) => { const c = [...document.querySelectorAll('.sb-item')].find((e) => e.innerText.indexOf(t) >= 0); return c ? +c.dataset.id : 0; }, t);

(async () => {
	const br = await puppeteer.launch({ headless: 'new', args: ['--mute-audio', '--autoplay-policy=user-gesture-required'] });

	// ── Student 3 on a phone: the roadmap
	let a = await open(br, 3, PHONE);
	ok(/Feedback & Dev/.test(await txt(a, 'main')), 'Feedback & Dev opens in the app (#dev)');
	await tab(a, 'road');
	const cols = await a.$$eval('[data-col]', (b) => b.map((x) => x.innerText));
	ok(cols.length === 5 && /Live · \d+/.test(cols[0]) && /In progress · [1-9]/.test(cols[1]), 'roadmap columns with counts: ' + cols.join(' | '));
	ok(/Learning path|Fights|Chrome Web Store/.test(await txt(a, '.sb-in')), 'In progress shows what is being built');
	await a.screenshot({ path: OUT + '/board-1-roadmap-phone.png' });
	await click(a, '[data-col="live"]');
	ok(/FSRS|Review cards|Stories for you/.test(await txt(a, '.sb-in')), 'Live lists shipped features');
	ok(!/Behind the scenes|admins only/.test(await txt(a, '.sb-in')), 'admin-only items are hidden from students');

	// ── Posting: vague → "tell us more", still vague → "Post anyway", then a clear one
	await tab(a, 'board');
	const vague = 'it doesnt work ' + stamp;
	await post(a, 'bug', vague);
	let w = await txt(a, '.sb-warn');
	ok(/tell us a bit more/i.test(w) && /What did you do/.test(w) && /what did you expect/i.test(w), 'a vague bug is not posted; the warning asks what is missing');
	ok(!(await a.$('[data-force]')), 'no "Post anyway" before one try to clarify');
	await a.screenshot({ path: OUT + '/board-2-clarify-phone.png' });
	await a.$eval('.sb-new textarea', (t, v) => { t.value = v; t.dispatchEvent(new Event('input')); }, 'game broken ' + stamp);
	await click(a, '.sb-new [data-post]'); await settle(a);
	ok(!!(await a.$('[data-force]')), 'after one try, "Post anyway" appears');
	await click(a, '.sb-new [data-force]'); await settle(a);
	ok((await itemByText(a, 'game broken ' + stamp)) > 0, '"Post anyway" posts it');
	const clear = 'On the Review page I tapped Good on the last card and the page went blank instead of saying all done ' + stamp;
	await post(a, 'bug', clear);
	const bugId = await itemByText(a, clear);
	ok(bugId > 0, 'a clear bug is posted at once (#' + bugId + ')');
	const idea = 'Please add a dark mode for reading at night in bed ' + stamp;
	await post(a, 'idea', idea, true);
	const ideaId = await itemByText(a, idea);
	ok(ideaId > 0, 'a clear idea posted with the name hidden (#' + ideaId + ')');
	ok(/yours/.test(await txt(a, '.sb-item[data-id="' + bugId + '"]')), 'no vote buttons on your own post');

	// ── Student 5 on a computer: votes, a reply, the hidden name
	let b = await open(br, 5, DESK);
	await tab(b, 'board');
	ok(/A student/.test(await txt(b, '.sb-item[data-id="' + ideaId + '"]')), 'the hidden name shows as "A student" to others');
	await click(b, '.sb-item[data-id="' + bugId + '"] [data-v="1"]');
	ok(await score(b, bugId, '1'), 'an upvote makes the score 1');
	await click(b, '.sb-item[data-id="' + bugId + '"] [data-v="-1"]');
	ok(await score(b, bugId, '-1'), 'changing to a downvote makes it −1 (one vote each)');
	await click(b, '.sb-item[data-id="' + bugId + '"] [data-v="-1"]');
	ok(await score(b, bugId, '0'), 'tapping again takes the vote back');
	await click(b, '.sb-item[data-id="' + bugId + '"] [data-v="1"]'); await score(b, bugId, '1');
	await openItem(b, bugId);
	await b.$eval('[data-reply]', (t) => { t.value = 'Same for me on my phone!'; });
	await click(b, '[data-send]');
	ok(await saved(b, /Replies · 1[\s\S]*Same for me on my phone/), 'a reply shows in the thread');
	ok(!(await b.$('.sb-adm')), 'students see no admin tools');
	await b.screenshot({ path: OUT + '/board-3-thread-desktop.png', fullPage: true });

	// ── Admin: official reply + status, link the roadmap, hide a reply, merge
	let c = await open(br, 1, PHONE);
	await tab(c, 'board');
	const adminSees = await txt(c, '.sb-item[data-id="' + ideaId + '"]');
	ok(!/A student/.test(adminSees), 'the admin sees the real name of a hidden-name post');
	await openItem(c, bugId);
	await c.select('[data-st]', 'progress');
	await c.$eval('[data-oreply]', (t) => { t.value = 'Thanks! Fixing it this week.'; });
	await click(c, '[data-save-st]');
	ok(await saved(c, /In progress[\s\S]*Thanks! Fixing it this week/), 'status + official reply saved');
	await c.$eval('[data-reply]', (t) => { t.value = 'We found the cause.'; });
	await click(c, '[data-send]');
	ok(await saved(c, /Official[\s\S]*We found the cause/), "Sherif's reply in the thread is marked Official");
	await c.$eval('[data-road]', (t) => { t.value = 'lens-fsrs-6-scheduling-fewer-reviews-late'; });
	await click(c, '[data-save-road]');
	ok(await saved(c, /On the roadmap/), 'linked to a roadmap item');
	const rh = await c.$eval('.sb-rep:not(.off) [data-rh]', (b) => b.dataset.rh).catch(() => '');
	if (rh) await click(c, '[data-rh="' + rh + '"]');
	ok(await saved(c, /Same for me on my phone![\s\S]*Show reply/), 'the admin hid a reply');
	await c.screenshot({ path: OUT + '/board-4-admin-phone.png', fullPage: true });
	await click(c, '[data-back]'); await settle(c);
	await c.waitForSelector('.sb-item', { timeout: 30000 });
	const forcedId = await itemByText(c, 'game broken ' + stamp);
	await openItem(c, forcedId);
	await c.$eval('[data-into]', (t, v) => { t.value = v; }, String(bugId));
	await click(c, '[data-merge]');
	ok(await saved(c, /Merged #/), 'merging moves the post into the other one (a note in its thread)');

	// ── Student 5 again: the merged post and the hidden reply are gone, the roadmap shows the link
	await b.goto(B + '/app/?t=' + Date.now() + '#dev', { waitUntil: 'networkidle2' });
	await b.waitForSelector('.sb-tabs'); await tab(b, 'board');
	await b.waitForSelector('.sb-item', { timeout: 30000 });
	ok(!(await itemByText(b, 'game broken ' + stamp)), 'the merged post is gone from the board');
	await openItem(b, bugId);
	ok(!/Same for me on my phone/.test(await txt(b, '.sb-in')), 'a hidden reply is hidden from students');
	await tab(b, 'road');
	await click(b, '[data-col="live"]');
	ok(/🙋 \d+ student post/.test(await txt(b, '.sb-in')), 'the roadmap item shows the linked student post');

	// ── The 💬 Beta sheet asks "tell us more" too, and can share on the board
	const s = await open(br, 3, PHONE, 'today');
	await s.waitForFunction(() => window.SawaBetaUI, { timeout: 20000 }).catch(() => {});
	const sheet = await s.evaluate(async () => {
		const R = document.querySelector('.sawa-beta').shadowRoot;
		window.SawaBetaUI.open({ kind: 'bug' });
		await new Promise((r) => setTimeout(r, 300));
		const ta = R.querySelector('textarea'); ta.value = 'bad'; ta.dispatchEvent(new Event('input'));
		const share = !!R.querySelector('[data-share]');
		R.querySelector('[data-send]').click();
		await new Promise((r) => setTimeout(r, 2500));
		return { share, warn: (R.querySelector('.warn') || {}).innerText || '' };
	});
	ok(sheet.share, 'the Beta sheet offers "Share on the Feedback & Dev board" for bugs');
	ok(/tell us a bit more|تفاصيل/.test(sheet.warn), 'the Beta sheet asks for more on a vague bug: ' + sheet.warn.replace(/\s+/g, ' ').slice(0, 70));
	ok(!/where were you/i.test(sheet.warn), 'it doesn\'t ask "where" (the screen is already known)');

	// ── Layout: no sideways scrolling on a phone, no script errors
	const wide = await a.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
	ok(!wide, 'no sideways scrolling at 390 px');
	const errs = [a, b, c, s].reduce((x, p) => x.concat(p.errs), []);
	ok(!errs.length, 'no script errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
	await b.setViewport(DESK); await tab(b, 'board'); await b.screenshot({ path: OUT + '/board-5-desktop.png' });
	await br.close();
	console.log(bad ? bad + ' FAILED' : 'all passed');
	process.exit(bad ? 1 : 0);
})();
