/* Silent test of the learning road in the Silk Road (📺 → 🎵 → 📖 → 🃏 → ✍️ → boss), on the local WordPress Playground:
   muted, speech stubbed, media play() stubbed, and a fake YouTube player (no video is loaded or played).
   Needs the test mu-plugins (?mk_lesson2, ?road_reset, the AI mocks). Phone size with touch, then a desktop check.
   Run from language-lens/tools (for puppeteer): node ../../sawa-tracker/tools/road-test.js <outdir> */
const puppeteer = require(require.resolve('puppeteer', { paths: [process.cwd()] }));
const B = 'http://127.0.0.1:9410';
const OUT = process.argv[2] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

async function open(br, size) {
	const p = await br.newPage();
	await p.setViewport(size);
	await p.evaluateOnNewDocument(() => {
		window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [], onvoiceschanged: null };
		HTMLMediaElement.prototype.play = () => Promise.resolve();
		// A fake YouTube IFrame player: time runs 10× faster while "playing"; nothing is loaded from YouTube.
		window.YT = { Player: function (el, o) { const me = this; let t = 0, st = -1, last = Date.now(); const tick = () => { const n = Date.now(); if (st === 1) t += (n - last) / 100; last = n; };
			me.getCurrentTime = () => { tick(); return t; }; me.getPlayerState = () => st; me.getDuration = () => 200;
			me.playVideo = () => { tick(); st = 1; }; me.pauseVideo = () => { tick(); st = 2; }; me.destroy = () => { st = -1; me.gone = true; };
			window.__yt = me; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 50); } };
		let P;
		Object.defineProperty(window, 'Phaser', { configurable: true, get() { return P; }, set(v) { const G = v.Game; v.Game = function (c) { const g = new G(c); window.__pg = g; return g; }; v.Game.prototype = G.prototype; P = v; } });
		window.__enter = () => { const walk = (root) => { for (const b of root.querySelectorAll('button')) if (/Enter the world/.test(b.textContent)) return b; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; } return null; }; const b = walk(document); if (b) b.click(); return !!b; };
		window.__q = (sel) => { const walk = (root) => { const hit = root.querySelector(sel); if (hit) return hit; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; } return null; }; return walk(document); };
		try { localStorage.setItem('sawaRoadIntro', ''); } catch (e) { /* fresh */ }
	});
	const errs = [];
	p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split(String.fromCharCode(10)).slice(1, 3).join(' | ')));
	const syncs = [];
	p.on('request', (r) => { if (/play\/sync/.test(r.url()) && r.postData()) syncs.push(r.postData()); });
	await p.goto(B + '/app/?as=1&t=' + Date.now() + '#community', { waitUntil: 'networkidle2' });
	await p.waitForFunction(() => window.__enter(), { timeout: 30000 });
	await p.waitForFunction(() => window.__pg && window.__pg.scene.getScene('World') && window.__pg.scene.getScene('World').camps, { timeout: 60000 });
	await sleep(1500);
	return { p, errs, syncs };
}

(async () => {
	console.log(await fetch(B + '/?mk_lesson2=1').then((r) => r.text()), '|', await fetch(B + '/?road_reset=1').then((r) => r.text()));
	const br = await puppeteer.launch({ headless: 'new', args: ['--mute-audio', '--autoplay-policy=user-gesture-required', '--use-gl=swiftshader'] });
	const { p, errs, syncs } = await open(br, { width: 390, height: 844, isMobile: true, hasTouch: true });
	const q = (sel) => p.evaluate((s) => { const e = window.__q(s); return e ? e.innerText : ''; }, sel);
	const click = (sel) => p.evaluate((s) => { const e = window.__q(s); if (e) e.click(); return !!e; }, sel);
	const road = () => p.evaluate(() => window.__pg.scene.getScene('World') && JSON.parse(JSON.stringify((window.__q('.sg-road') && window.__q('.sg-road').innerText) || '')));
	const st = (k) => p.evaluate((k) => { const b = window.__q('.sg-road [data-road="' + k + '"]'); return b ? b.className : ''; }, k);

	// The Elder's first-time intro shows the road, then everything else is cleared.
	const intro = await p.waitForFunction(() => { const d = window.__q('.sg-dlg.on'); return d && /camps now/.test(d.innerText) && d.innerText; }, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => '');
	ok(/Between our gate and the beast/.test(intro), 'the Elder introduces the road once (' + intro.replace(/\s+/g, ' ').slice(0, 90) + '…)');
	await p.screenshot({ path: `${OUT}/road-0-intro.png` });
	await p.evaluate(() => { const d = window.__q('.sg-dlg.on [data-o="x"]'); if (d) d.click(); });
	for (let i = 0; i < 10; i++) { const did = await p.evaluate(() => { const d = window.__q('.sg-dlg.on'); if (!d) return false; const b = d.querySelector('[data-o="save"]') || d.querySelector('[data-o="x"]'); if (b) b.click(); return !!b; }); if (!did) break; await sleep(800); }

	const camps = await p.evaluate(() => window.__pg.scene.getScene('World').camps.map((c) => c.k));
	ok(camps.join() === 'video,song,story,cards,write', 'five camps along the road: ' + camps.join(' → '));
	ok(/Today's road · 0\/5/.test(await road()), 'the strip shows today\'s road (' + (await road()).replace(/\s+/g, ' ') + ')');
	ok(/open/.test(await st('video')) && /locked/.test(await st('song')), 'only the first camp is open');

	// Safe at a camp: a monster walking into you there does not start a fight.
	await p.evaluate(() => { const S = window.__pg.scene.getScene('World'), c = S.camps[2]; S.pl.setPosition(c.spr.x, c.spr.y + 20); });
	await sleep(400);
	const safe = await p.evaluate(() => { const S = window.__pg.scene.getScene('World'), m = S.monsters[0]; S.cool = 0; m.flee = 0; S.encounter(m); return { safe: S.safe, dlg: !!window.__q('.sg-dlg.on') }; });
	ok(safe.safe && !safe.dlg, 'monsters never attack at a camp');

	// A locked camp: the road sign sends you to the open one.
	await click('.sg-road [data-road="story"]');
	await sleep(1500);
	ok(/opens after the 📺 video camp/.test(await q('.sg-dlg.on')), 'a locked camp says which camp comes first');
	await click('.sg-dlg.on [data-o="0"]');

	// 📺 video: the fake player plays, stops at each question, and the camp is done when both are answered.
	await p.waitForFunction(() => window.__q('.sg-vidp .sg-yt'), { timeout: 15000 });
	await sleep(800);
	const atVideo = await p.evaluate(() => { const S = window.__pg.scene.getScene('World'), c = S.camps[0]; return Math.hypot(S.pl.x - c.spr.x, S.pl.y - c.spr.y) < 40; });
	ok(atVideo, 'the character stands at the video camp');
	await sleep(3500);
	ok(syncs.some((s) => /"st":"video"/.test(s)), 'others are told you are at the video camp (sync st=video)');
	await p.evaluate(() => window.__yt.playVideo());
	await p.waitForFunction(() => window.__q('.sg-vq .sg-vcard'), { timeout: 15000 });
	ok(/conference/.test(await q('.sg-vq')), 'the video stops at the first question');
	await p.screenshot({ path: `${OUT}/road-1-video.png` });
	await click('.sg-vq [data-k="1"]');
	await p.waitForFunction(() => window.__q('.sg-vq [data-go]'), { timeout: 10000 });
	ok(/Right/.test(await q('.sg-vq')), 'right answer: ✓ +5 XP');
	await click('.sg-vq [data-go]');
	await p.waitForFunction(() => window.__q('.sg-vq input'), { timeout: 20000 });
	await p.type('.sg-root .sg-vq input', 'themes').catch(async () => { await p.evaluate(() => { window.__q('.sg-vq input').value = 'themes'; }); });
	await p.evaluate(() => { const i = window.__q('.sg-vq input'); if (!i.value) i.value = 'themes'; window.__q('.sg-vq [data-ok]').click(); });
	await p.waitForFunction(() => window.__q('.sg-vidp .sg-ron'), { timeout: 15000 });
	ok(/Song camp/.test(await q('.sg-vidp .sg-ron')), 'video done → the song camp is next');
	ok(/done/.test(await st('video')) && /open/.test(await st('song')), 'the strip: video ✓, song open');

	// 🎵 song: lyrics with tappable words and the fill-the-gaps game.
	await click('.sg-ron [data-rn="song"]');
	await p.waitForFunction(() => window.__q('.sg-songp [data-gap]'), { timeout: 15000 });
	ok(await p.evaluate(() => !!window.__q('.sg-songp .sg-lyr .lw') && !!window.__q('.sg-songp audio')), 'the song: player + lyrics with tappable words');
	await p.evaluate(() => window.__q('.sg-songp .sg-lyr .lw').click());
	await p.waitForFunction(() => window.__q('.sg-word.on .sg-wh'), { timeout: 10000 }).catch(() => {});
	ok(!!(await q('.sg-word.on')), 'tapping a lyric word opens the Lens word card');
	await p.evaluate(() => { const x = window.__q('.sg-word.on [data-w="x"]'); if (x) x.click(); });
	await p.screenshot({ path: `${OUT}/road-2-song.png` });
	await click('.sg-songp [data-gap]');
	for (let i = 0; i < 8; i++) {
		const more = await p.waitForFunction(() => window.__q('.sg-gapq [data-k]:not(:disabled)') || window.__q('.sg-songp .sg-ron'), { timeout: 10000 }).then(() => p.evaluate(() => { const b = window.__q('.sg-gapq [data-k]:not(:disabled)'); if (b) b.click(); return !!b; })).catch(() => false);
		if (!more) break; await sleep(1800);
	}
	await p.waitForFunction(() => window.__q('.sg-songp .sg-ron'), { timeout: 15000 }).catch(() => {});
	ok(/Story camp/.test(await q('.sg-songp .sg-ron')), 'song done → the story camp is next (' + (await q('.sg-gapq')).replace(/\s+/g, ' ').slice(0, 60) + ')');

	// 📖 story: read, quick check, done.
	await click('.sg-ron [data-rn="story"]');
	await p.waitForFunction(() => window.__q('.sg-storyp [data-fin]'), { timeout: 30000 });
	ok(await p.evaluate(() => window.__q('.sg-storyp .sg-read').querySelectorAll('.lw').length > 20), 'the story: paragraphs with tappable words');
	await p.screenshot({ path: `${OUT}/road-3-story.png` });
	await click('.sg-storyp [data-fin]');
	for (let i = 0; i < 6; i++) {
		const more = await p.waitForFunction(() => window.__q('.sg-stq [data-k]:not(:disabled)') || window.__q('.sg-storyp .sg-ron'), { timeout: 10000 }).then(() => p.evaluate(() => { const b = window.__q('.sg-stq [data-k]:not(:disabled)'); if (b) b.click(); return !!b; })).catch(() => false);
		if (!more) break; await sleep(1800);
	}
	await p.waitForFunction(() => window.__q('.sg-storyp .sg-ron'), { timeout: 15000 }).catch(() => {});
	ok(/Cards camp/.test(await q('.sg-storyp .sg-ron')), 'story done → the cards camp is next (' + (await q('.sg-stq')).replace(/\s+/g, ' ').slice(0, 70) + ')');

	// 🃏 cards: today's cards, then the camp is done.
	await click('.sg-ron [data-rn="cards"]');
	await p.waitForFunction(() => window.__q('.sg-revp [data-r="flip"]') || window.__q('.sg-revp .sg-ron'), { timeout: 20000 });
	await p.screenshot({ path: `${OUT}/road-4-cards.png` });
	for (let t0 = Date.now(); Date.now() - t0 < 150000;) {
		const did = await p.evaluate(() => { const f = window.__q('.sg-revp [data-r="flip"]'); if (f) { f.click(); return 'flip'; } const g = window.__q('.sg-revp [data-g2="3"]:not(:disabled)'); if (g) { g.click(); return 'grade'; } return window.__q('.sg-revp .sg-ron') ? 'end' : 'wait'; });
		if (did === 'end') break; await sleep(did === 'wait' ? 600 : 350);
	}
	await p.waitForFunction(() => window.__q('.sg-revp .sg-ron'), { timeout: 15000 }).catch(() => {});
	ok(/Write camp/.test(await q('.sg-revp .sg-ron')), 'cards done → the writing camp is next');

	// ✍️ write: checked, then the whole road is done.
	await click('.sg-ron [data-rn="write"]');
	await p.waitForFunction(() => window.__q('.sg-writep textarea'), { timeout: 15000 });
	await p.evaluate(() => { window.__q('.sg-writep textarea').value = 'Yesterday I go to the market with my brother. He very tall and he buy many fruit for us.'; window.__q('.sg-writep [data-wr]').click(); });
	await p.waitForFunction(() => window.__q('.sg-writep .sg-ron'), { timeout: 20000 }).catch(() => {});
	const fin = await q('.sg-writep .sg-pb');
	ok(/to fix|No mistakes/.test(fin), 'the writing is checked (' + fin.replace(/\s+/g, ' ').slice(fin.indexOf('Checked'), fin.indexOf('Checked') + 0) + (fin.match(/\d+ things? to fix/) || [''])[0] + ')');
	ok(/whole road today/.test(fin) && /To the boss/.test(fin) && /Share it on Skool/.test(fin), 'the whole road: bonus, to the boss, share on Skool');
	ok(/✓ Today's road is done/.test(await road()), 'the strip says the road is done');
	await p.screenshot({ path: `${OUT}/road-5-done.png` });
	const feed = await p.evaluate(() => fetch(SAWA_LENS.root.replace('sawa-lens/v1/app/', 'sawa-tracker/v1/feed'), { credentials: 'same-origin', headers: { 'X-WP-Nonce': SAWA_LENS.nonce } }).then((r) => r.json()));
	ok(JSON.stringify(feed).indexOf('"road"') >= 0, 'the feed has a line for the whole road');
	const again = await p.evaluate(() => fetch(SAWA_LENS.root.replace('sawa-lens/v1/app/', 'sawa-tracker/v1/world/road'), { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': SAWA_LENS.nonce, 'Content-Type': 'application/json' }, body: JSON.stringify({ station: 'video' }) }).then((r) => r.json()));
	ok(again.coins === 0, 'a camp done twice pays only once');
	await click('.sg-ron [data-rn="boss"]');
	await sleep(1200);
	const nearBoss = await p.evaluate(() => { const S = window.__pg.scene.getScene('World'); return Math.round(Math.hypot(S.pl.x - 64 * 16, S.pl.y - 31 * 16)); });
	ok(nearBoss < 80, 'To the boss: the character stands near the boss lair (' + nearBoss + ' px)');
	await sleep(4000);
	ok(!syncs.slice(-1)[0] || /"st":""/.test(syncs.slice(-1)[0]), 'after closing the camp, sync says no camp');
	ok(!errs.length, 'no page errors (phone) ' + errs.join(' / '));
	await p.close();

	// Desktop: the strip and the camps are there, no errors.
	const d = await open(br, { width: 1280, height: 800 });
	await sleep(2000);
	const dt = await d.p.evaluate(() => { const r = window.__q('.sg-road'); const b = r && r.getBoundingClientRect(); return { txt: r ? r.innerText : '', w: b ? b.width : 0, on: r && getComputedStyle(r).display !== 'none' }; });
	ok(dt.on && /road is done/.test(dt.txt), 'desktop: the strip is shown (' + Math.round(dt.w) + ' px wide)');
	await d.p.screenshot({ path: `${OUT}/road-6-desktop.png` });
	ok(!d.errs.length, 'no page errors (desktop) ' + d.errs.join(' / '));
	await br.close();
	console.log(bad ? bad + ' FAILED' : 'ALL OK');
	process.exit(bad ? 1 : 0);
})();
