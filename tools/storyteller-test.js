/* Silent test of Rawi the storyteller in the Silk Road (camp stories from Sawa Lens "Stories for you"), on the
   local WordPress Playground: muted, speech stubbed. Needs the readers test mu-plugin (?readers_setup=1).
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/storyteller-test.js <outdir> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const OUT = process.argv[2] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

(async () => {
	console.log(await fetch(B + '/?readers_setup=1').then((r) => r.text()));
	const br = await puppeteer.launch({ headless: 'new', args: ['--mute-audio', '--autoplay-policy=user-gesture-required', '--use-gl=swiftshader'] });
	const p = await br.newPage();
	await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
	await p.evaluateOnNewDocument(() => {
		window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [], onvoiceschanged: null };
		HTMLMediaElement.prototype.play = () => Promise.resolve();
		// Catch the Phaser game when it is created, so the test can reach the World scene.
		let P;
		Object.defineProperty(window, 'Phaser', { configurable: true, get() { return P; }, set(v) { const G = v.Game; v.Game = function (c) { const g = new G(c); window.__pg = g; return g; }; v.Game.prototype = G.prototype; P = v; } });
		// Find elements inside shadow roots too.
		window.__enter = () => { const walk = (root) => { for (const b of root.querySelectorAll('button')) if (/Enter the world/.test(b.textContent)) return b; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; } return null; }; const b = walk(document); if (b) b.click(); return !!b; };
		window.__q = (sel) => { const walk = (root) => { const hit = root.querySelector(sel); if (hit) return hit; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; } return null; }; return walk(document); };
	});
	const errs = [];
	p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split(String.fromCharCode(10)).slice(1, 4).join(' | ')));
	const api = (path, body) => p.evaluate((path, body) => fetch(SAWA_LENS.root + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-WP-Nonce': SAWA_LENS.nonce, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()), path, body);
	// First visit: make the traveller and click through the Elder's welcome, so nothing covers Rawi's dialog.
	const clear = async () => { await sleep(4000); for (let i = 0; i < 12; i++) { const did = await p.evaluate(() => { const d = window.__q('.sg-dlg.on'); if (!d) return false; const b = d.querySelector('[data-o="save"]') || d.querySelector('[data-o="0"]') || d.querySelector('[data-o="x"]'); if (b) b.click(); return !!b; }); if (!did) return; await sleep(1500); } };
	const talk = async () => { await clear(); await p.evaluate(() => { const s = window.__pg.scene.getScene('World'); const t = s.npcs.find((n) => n.npc === 'teller'); s.near = { kind: 'npc', obj: t }; s.interact(); }); };
	const dlg = async () => { await p.waitForFunction(() => { const d = window.__q('.sg-dlg.on'); return d && /Rawi/.test(d.innerText) && d.querySelector('[data-o]'); }, { timeout: 20000 }).catch(() => {}); await sleep(2500); return p.evaluate(() => { const d = window.__q('.sg-dlg.on'); return d ? d.innerText : ''; }); };

	await p.goto(B + '/app/?as=1&t=' + Date.now() + '#community', { waitUntil: 'networkidle2' });
	await p.waitForFunction(() => window.__enter(), { timeout: 30000 });
	await p.waitForFunction(() => window.__pg && window.__pg.scene.getScene('World') && window.__pg.scene.getScene('World').npcs, { timeout: 60000 }).catch(() => {});
	const has = await p.evaluate(() => !!(window.__pg && window.__pg.scene.getScene('World').npcs.some((n) => n.npc === 'teller')));
	ok(has, 'Rawi the storyteller stands in town');
	if (!has) { await p.screenshot({ path: `${OUT}/teller-0.png` }); await br.close(); process.exit(1); }

	await talk();
	let t = await dlg();
	ok(/Rawi the storyteller/.test(t) && /(Tonight’s story is called|Chapter \d+ is waiting)/.test(t) && /Read it|Read chapter/.test(t), 'before reading: he offers tonight\'s story (' + t.replace(/\s+/g, ' ').slice(0, 120) + '…)');
	await p.screenshot({ path: `${OUT}/teller-1.png` });
	const before = await api('readers');
	await p.evaluate(() => window.__q('.sg-dlg.on [data-o="0"]').click());
	await sleep(2500);
	ok(/#story-\d+|#stories/.test(await p.evaluate(() => location.hash)), '“Read it” opens the story in the app (' + (await p.evaluate(() => location.hash)) + ')');
	const id = before.today.id;
	await api('readers/' + id);
	await api('readers/done', { id, right: 4, total: 4 });

	await p.goto(B + '/app/?as=1&t=' + Date.now() + '#community', { waitUntil: 'networkidle2' });
	await p.waitForFunction(() => window.__enter(), { timeout: 30000 });
	await p.waitForFunction(() => window.__pg && window.__pg.scene.getScene('World') && window.__pg.scene.getScene('World').npcs, { timeout: 60000 });
	await talk();
	t = await dlg();
	ok(/You read a story today/.test(t) && /Take the gift/.test(t), 'after reading: he offers a gift');
	await p.evaluate(() => window.__q('.sg-dlg.on [data-o="0"]').click());
	const hint = await p.waitForFunction(() => { const h = window.__q('.sg-hint'); return h && /🪙/.test(h.textContent) && h.textContent; }, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => '');
	ok(/\+20 🪙 \+1 ⚗/.test(hint), 'the gift: +20 coins and an elixir (' + hint + ')');
	const again = await p.evaluate(() => fetch(SAWA_LENS.root.replace('sawa-lens/v1/app/', 'sawa-tracker/v1/world/story'), { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': SAWA_LENS.nonce } }).then((r) => r.json()));
	ok(/tomorrow/.test(again.message || ''), 'only once a day (' + (again.message || JSON.stringify(again).slice(0, 80)) + ')');
	await p.screenshot({ path: `${OUT}/teller-2.png` });
	ok(!errs.length, 'no page errors ' + errs.join(' / '));
	await br.close();
	console.log(bad ? bad + ' FAILED' : 'ALL OK');
	process.exit(bad ? 1 : 0);
})();
