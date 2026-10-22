/* Silent test of the action fights (roaming monsters) and the 📚 500 most common words, on the local Playground:
   phone size with touch, muted, speech stubbed. Needs the test mu-plugin sawa-road-test.php (?road_reset).
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/action-test.js <outdir> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const OUT = process.argv[2] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

(async () => {
	console.log(await fetch(B + '/?road_reset=1&week=1').then((r) => r.text()));
	const br = await puppeteer.launch({ headless: 'new', args: ['--mute-audio', '--autoplay-policy=user-gesture-required', '--use-gl=swiftshader'] });
	const p = await br.newPage();
	await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
	await p.evaluateOnNewDocument(() => {
		window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [], onvoiceschanged: null };
		HTMLMediaElement.prototype.play = () => Promise.resolve();
		let P;
		Object.defineProperty(window, 'Phaser', { configurable: true, get() { return P; }, set(v) { const G = v.Game; v.Game = function (c) { const g = new G(c); window.__pg = g; return g; }; v.Game.prototype = G.prototype; P = v; } });
		window.__enter = () => { const walk = (root) => { for (const b of root.querySelectorAll('button')) if (/Enter the world/.test(b.textContent)) return b; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; } return null; }; const b = walk(document); if (b) b.click(); return !!b; };
		window.__q = (sel) => { const walk = (root) => { const hit = root.querySelector(sel); if (hit) return hit; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; } return null; }; return walk(document); };
		try { localStorage.setItem('sawaRoadIntro', '1'); } catch (e) { /* fresh */ }
	});
	const errs = [];
	p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split(String.fromCharCode(10)).slice(1, 3).join(' | ')));
	const q = (sel) => p.evaluate((s) => { const e = window.__q(s); return e ? e.innerText : ''; }, sel);
	const api = (path, body) => p.evaluate((path, body) => fetch(SAWA_LENS.root.replace('sawa-lens/v1/app/', 'sawa-tracker/v1/') + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-WP-Nonce': SAWA_LENS.nonce, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()), path, body);
	await p.goto(B + '/app/?as=1&t=' + Date.now() + '#community', { waitUntil: 'networkidle2' });
	await p.waitForFunction(() => window.__enter(), { timeout: 30000 });
	await p.waitForFunction(() => window.__pg && window.__pg.scene.getScene('World') && window.__pg.scene.getScene('World').camps, { timeout: 60000 });
	await sleep(2500);
	for (let i = 0; i < 10; i++) { const did = await p.evaluate(() => { const d = window.__q('.sg-dlg.on'); if (!d) return false; const b = d.querySelector('[data-o="save"]') || d.querySelector('[data-o="x"]'); if (b) b.click(); return !!b; }); if (!did) break; await sleep(800); }

	// A camp gives one more fight today.
	const w0 = await api('world');
	await api('world/road', { station: 'reels' });
	const w1 = await api('world');
	ok(w1.stamina.max === w0.stamina.max + 1, 'a finished camp gives one more ⚔ fight (' + w0.stamina.max + ' → ' + w1.stamina.max + ')');

	// A monster walks in: the fight is an action fight.
	await p.evaluate(() => { const S = window.__pg.scene.getScene('World'); S.pl.setPosition(50 * 16, 12 * 16); S.cool = 0; });
	await sleep(500);
	await p.evaluate(() => { const S = window.__pg.scene.getScene('World'), m = S.monsters.find((x) => x.active); m.flee = 0; S.cool = 0; S.encounter(m); });
	await p.waitForFunction(() => window.__q('.sg-dlg.on [data-o="0"]'), { timeout: 10000 });
	await p.evaluate(() => window.__q('.sg-dlg.on [data-o="0"]').click());
	await p.waitForFunction(() => window.__q('.sg-actp .sg-afield'), { timeout: 20000 });
	await sleep(800);
	const ui = await p.evaluate(() => ({ stick: !!window.__q('.sg-astick'), hit: !!window.__q('.sg-abtn [data-a="hit"]'), sp: (window.__q('.sg-abtn [data-a="sp"]') || {}).innerText, hud: window.__q('.sg-ahud').innerText, arena: getComputedStyle(window.__q('.sg-arena')).display }));
	ok(ui.stick && ui.hit && ui.sp && /❤/.test(ui.hud) && ui.arena === 'none', 'the action fight: field, stick, ⚔ hit, role move (' + String(ui.sp).replace(/\s+/g, ' ') + '), health bars');
	await p.screenshot({ path: `${OUT}/action-1.png` });
	// a red mark lands where you stand: it hurts
	const S0 = await p.evaluate(() => { const w = window.__q('.sg-afield'); return !!w; });
	ok(S0, 'the field is drawn');
	const hxA = await p.evaluate(() => window.SawaGame.action().S.hx);
	await p.keyboard.down('d'); await sleep(500); await p.keyboard.up('d');
	ok(await p.evaluate((x) => window.SawaGame.action().S.hx > x + 10, hxA), 'D (or →) moves the hero');
	// Hits: stand next to the monster, hit when the ring is small.
	await p.evaluate(() => { window.SawaGame.action().S.foe = 9999; }); // a strong monster for the test, so 4 hits don't end it
	for (let i = 0; i < 4; i++) {
		await p.evaluate(() => { const A = window.SawaGame.action(); A.S.hx = A.S.fx; A.S.hy = A.S.fy + 30; A.S.ring = 0.86; A.S.cd = 0; A.S.zones = []; });
		await p.evaluate(() => window.__q('.sg-abtn [data-a="hit"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
		await sleep(250);
	}
	const after = await p.evaluate(() => { const A = window.SawaGame.action(); return { dealt: A.S.dealt, combo: A.S.best }; });
	ok(after.dealt > 0 && after.combo >= 3, 'timed hits deal damage and build a combo (' + after.dealt + ' damage, ×' + after.combo + ')');
	await p.waitForFunction(() => window.__q('.sg-apow.on'), { timeout: 5000 }).catch(() => {});
	const pw = await q('.sg-apow.on');
	ok(/Power word/.test(pw), 'after 4 good hits: a power word (English) pauses the fight');
	await p.screenshot({ path: `${OUT}/action-2-power.png` });
	await p.evaluate(() => { const b = window.__q('.sg-apow [data-k="0"]'); if (b) b.click(); else { const i = window.__q('.sg-apow input'); if (i) { i.value = 'x'; window.__q('.sg-apow [data-ok]').click(); } else window.__q('.sg-apow [data-ok]').click(); } });
	await p.waitForFunction(() => !window.__q('.sg-apow.on'), { timeout: 10000 }).catch(() => {});
	ok(!(await q('.sg-apow.on')), 'the power word is answered and the fight goes on');
	// A red mark where you stand hurts; the role move works.
	const hp0 = await p.evaluate(() => window.SawaGame.action().S.hp);
	await p.evaluate(() => { const A = window.SawaGame.action(); A.S.inv = 0; A.S.shield = 0; A.S.zones.push({ c: 1, x: A.S.hx, y: A.S.hy - 6, r: 22, t: 0.05, full: 0.5 }); });
	await sleep(400);
	const hp1 = await p.evaluate(() => window.SawaGame.action().S.hp);
	ok(hp1 < hp0, 'standing in the red hurts (' + hp0 + ' → ' + hp1 + ')');
	await p.evaluate(() => window.__q('.sg-abtn [data-a="sp"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
	await sleep(300);
	ok(await p.evaluate(() => window.__q('.sg-abtn [data-a="sp"]').disabled), 'the role move fires and cools down');
	// Win: the result screen is the usual one (coins, XP, what to learn).
	await sleep(4000);
	await p.evaluate(() => { const A = window.SawaGame.action(); A.S.foe = 1; A.S.hx = A.S.fx; A.S.hy = A.S.fy + 30; A.S.ring = 0.86; A.S.cd = 0; A.S.zones = []; });
	await p.evaluate(() => window.__q('.sg-abtn [data-a="hit"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
	await p.waitForFunction(() => window.__q('.sg-res'), { timeout: 20000 }).catch(() => {});
	const res = await q('.sg-res');
	ok(/Victory|defeated/.test(res) && /🪙|XP/.test(res), 'won: the usual result screen with rewards (' + res.replace(/\s+/g, ' ').slice(0, 80) + ')');
	await p.screenshot({ path: `${OUT}/action-3-result.png` });
	await p.evaluate(() => { const x = window.__q('.sg-res [data-x]'); if (x) x.click(); });
	await sleep(1000);
	ok(!(await q('.sg-battle.on')) && await p.evaluate(() => !window.__pg.scene.getScene('World').scene.isPaused()), 'back on the map');

	// 📚 the 500 most common words.
	await p.evaluate(() => window.__q('.sg-road [data-road="band"]').click());
	await p.waitForFunction(() => window.__q('.sg-bandp [data-bw]') || window.__q('.sg-bandp .sg-err'), { timeout: 20000 });
	const band = await q('.sg-bandp');
	ok(/\d+ of 500 words you know/.test(band) && /Today's 10 words/.test(band), 'the 📚 panel: your words of the 500, and today\'s 10 (' + (band.match(/\d+ of 500/) || [''])[0] + ')');
	await p.evaluate(() => window.__q('.sg-bandp [data-bw="0"]').click());
	await p.waitForFunction(() => /✓/.test(window.__q('.sg-bandp [data-bw="0"]').innerText), { timeout: 15000 }).catch(() => {});
	ok(/✓/.test(await q('.sg-bandp [data-bw="0"]')), '＋ adds a word to the review cards');
	await p.screenshot({ path: `${OUT}/action-4-band.png` });
	ok(!errs.length, 'no page errors ' + errs.join(' / '));
	await br.close();
	console.log(bad ? bad + ' FAILED' : 'ALL OK');
	process.exit(bad ? 1 : 0);
})();
