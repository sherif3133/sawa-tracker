/* Sawa English — the walkable Silk Road (Phaser 3).
   The tracker loads this file when a student enters the world and calls
   window.SawaGame.start(mount, H) with hooks (api, world data, panels, battles…).
   All art is drawn in code (pixel art with Sea of Stars–style colour, light and atmosphere) so a bought sprite
   pack can replace it later: everything goes through the ART functions below. */
(function () {
  'use strict';
  var PHASER_URL = 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js';
  var TS = 16, MW = 72, MH = 42;
  var H = null, G = null, ROOT = null, running = false;
  var TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  /* ================================================================ helpers */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cnv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function tone(h, k) { var c = hex(h); var f = function (v) { return Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); }; return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')'; }
  function px(g, x, y, c, w, h) { g.fillStyle = c; g.fillRect(x, y, w || 1, h || 1); }
  function ell(g, cx, cy, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel) { return ROOT ? ROOT.querySelector(sel) : null; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  /* Every texture and animation the game makes is remembered, so they can be rebuilt if the graphics
     context is lost and restored (phones do this when the app goes to the background). */
  var MADE = {}, ANIMS = [];
  function addTex(scene, key, canvas) { MADE[key] = 1; return scene.textures.addCanvas(key, canvas); }
  function anim(key) { ANIMS.push(key); return key; }
  function rebuild() {
    var P = GAME.phaser; if (!P) return;
    if ($('.sg-arena')) { GAME.needRebuild = true; return; } // after the battle
    var w = P.scene.getScene('World'), pos = w && w.pl ? { x: w.pl.x, y: w.pl.y } : null;
    ANIMS.forEach(function (k) { if (P.anims.exists(k)) P.anims.remove(k); });
    Object.keys(MADE).forEach(function (k) { if (P.textures.exists(k)) P.textures.remove(k); });
    MADE = {}; ANIMS = [];
    if (w) w.scene.restart({ pos: pos });
  }
  function loadPhaser() {
    if (window.Phaser) return Promise.resolve();
    return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = PHASER_URL; s.onload = ok; s.onerror = function () { bad(new Error('The game engine could not load. Check your connection and try again.')); }; document.head.appendChild(s); });
  }

  /* ================================================================ themes (one per town) */
  var THEMES = {
    1: { ground: ['#6f9d4c', '#79a955', '#628f43'], tuft: '#4d7a35', flower: ['#f2a7c3', '#fff3c4'], path: '#c7b089', stone: '#a89574', plaza: '#b9ae9a', wall: '#8c8378', water: '#3e86bd', roof: 'pagoda', roofC: '#b8392c', bodyC: '#f0e2c4', trim: '#5b2b22', tree: 'blossom', sky: ['#9fd2f0', '#f8d9b0'], hills: '#7a9e6a', amb: 'petals' },
    2: { ground: ['#e3b873', '#dbad66', '#e9c486'], tuft: '#b98a49', flower: ['#9c7a4a', '#c79a5c'], path: '#c89a5c', stone: '#a97c45', plaza: '#d8b98a', wall: '#c4864f', water: '#3a9cb6', roof: 'adobe', roofC: '#a7683b', bodyC: '#d9a066', trim: '#7a4523', tree: 'palm', sky: ['#f6c27a', '#fbe3b4'], hills: '#d39a58', amb: 'dust' },
    3: { ground: ['#8da862', '#97b26b', '#809a57'], tuft: '#62803f', flower: ['#ffffff', '#e9d36b'], path: '#b7a07c', stone: '#8e8169', plaza: '#c3b59a', wall: '#9a8c74', water: '#4b8fc0', roof: 'dome', roofC: '#d9b65c', bodyC: '#e6d6b4', trim: '#6b5634', tree: 'poplar', sky: ['#a8d3ee', '#e9f2f6'], hills: '#9aa7b3', amb: 'snow' },
    4: { ground: ['#9fb46c', '#a8bd75', '#90a65f'], tuft: '#6f8a45', flower: ['#7fd1e3', '#f6e27a'], path: '#a9b3b8', stone: '#7f8c94', plaza: '#cfd8dc', wall: '#d8c7a2', water: '#2f95b0', roof: 'dome', roofC: '#2aa1a8', bodyC: '#e9dcc0', trim: '#215e7a', tree: 'cypress', sky: ['#8fd0f0', '#f3e6c8'], hills: '#b9a27c', amb: 'leaves' },
    5: { ground: ['#b9a26c', '#c2ab75', '#ab955f'], tuft: '#8c7646', flower: ['#f0c75a', '#e8865a'], path: '#cdb486', stone: '#a08a5e', plaza: '#ddc9a0', wall: '#c9b38a', water: '#2f86b5', roof: 'dome', roofC: '#e3b23c', bodyC: '#efe2c4', trim: '#6b4c1f', tree: 'palm', sky: ['#4b3b78', '#f0a46a'], hills: '#8a6f55', amb: 'fireflies' },
    6: { ground: ['#7d9c5b', '#87a664', '#718f50'], tuft: '#557539', flower: ['#ffffff', '#c9a0e6'], path: '#a8a296', stone: '#857f74', plaza: '#bdb6aa', wall: '#a49b8d', water: '#2c74b0', roof: 'tile', roofC: '#b85a36', bodyC: '#ece4d4', trim: '#5c4535', tree: 'olive', sky: ['#9ccbea', '#f1e9dc'], hills: '#8fa3a8', amb: 'birds' }
  };
  var SKIN = ['#f6d3b3', '#e9b48a', '#c98d62', '#9c6440', '#6e4428'];
  var HAIRC = ['#2a1d16', '#5a3a22', '#a8642c', '#d8b25a', '#7a2f2a', '#3b3b46'];
  var OUTFIT = ['#3f6fb5', '#b8493a', '#3d8a5a', '#7a4fa0', '#c98a2e', '#3d4a5c'];
  var GRADE = ['', '#c27c3a', '#8f959c', '#c6ced6', '#e7ecf2', '#f2c94c', '#56c596'];
  var JOBC = { thief: '#4a3560', hunter: '#3f6a3a', trader: '#b8862e' };

  /* ================================================================ ART: tiles */
  // 0 g0, 1 g1, 2 g-flower, 3 path, 4 path2, 5 water, 6 wall top, 7 wall face, 8 plaza, 9 patch, 10 rock (solid), 11 tuft
  var SOLID = [5, 6, 7, 10];
  function drawTiles(th, seed) {
    var c = cnv(TS * 12, TS), g = c.getContext('2d'), R = rng(seed);
    function ground(o, base) { px(g, o, 0, base, TS, TS); for (var i = 0; i < 18; i++) px(g, o + Math.floor(R() * TS), Math.floor(R() * TS), R() < 0.5 ? th.ground[1] : th.ground[2]); for (var k = 0; k < 3; k++) { var x = o + 2 + Math.floor(R() * 12), y = 3 + Math.floor(R() * 10); px(g, x, y, th.tuft); px(g, x + 1, y - 1, th.tuft); } }
    ground(0, th.ground[0]); ground(TS, th.ground[1]);
    ground(TS * 2, th.ground[0]); for (var f = 0; f < 4; f++) { var fx = TS * 2 + 2 + Math.floor(R() * 12), fy = 2 + Math.floor(R() * 12), fc = th.flower[f % 2]; px(g, fx, fy, fc); px(g, fx - 1, fy, tone(fc, -0.25)); px(g, fx + 1, fy, tone(fc, -0.25)); px(g, fx, fy + 1, th.tuft); }
    function path(o, alt) { px(g, o, 0, th.path, TS, TS); for (var i = 0; i < 7; i++) { var sx = o + Math.floor(R() * 13), sy = Math.floor(R() * 13), w = 2 + Math.floor(R() * 3); px(g, sx, sy, th.stone, w, 2); px(g, sx, sy, tone(th.stone, 0.25), w, 1); } if (alt) for (var j = 0; j < 10; j++) px(g, o + Math.floor(R() * TS), Math.floor(R() * TS), tone(th.path, -0.12)); }
    path(TS * 3, false); path(TS * 4, true);
    px(g, TS * 5, 0, th.water, TS, TS); for (var w = 0; w < 4; w++) { var wx = TS * 5 + Math.floor(R() * 11), wy = 2 + w * 4; px(g, wx, wy, tone(th.water, 0.35), 4, 1); px(g, wx + 1, wy + 1, tone(th.water, -0.15), 3, 1); }
    // wall top (battlements)
    px(g, TS * 6, 0, tone(th.wall, -0.05), TS, TS); for (var b = 0; b < 4; b++) { px(g, TS * 6 + b * 4, 0, tone(th.wall, 0.18), 3, 4); px(g, TS * 6 + b * 4, 4, tone(th.wall, -0.25), 3, 1); } px(g, TS * 6, 6, tone(th.wall, 0.1), TS, 1); for (var s = 0; s < 3; s++) px(g, TS * 6, 9 + s * 3, tone(th.wall, -0.15), TS, 1);
    // wall face (bricks)
    px(g, TS * 7, 0, tone(th.wall, -0.18), TS, TS); for (var r = 0; r < 4; r++) for (var q = 0; q < 3; q++) { var ox = TS * 7 + q * 6 - (r % 2) * 3; px(g, ox + 1, r * 4 + 1, tone(th.wall, -0.05), 4, 2); px(g, ox + 1, r * 4 + 1, tone(th.wall, 0.08), 4, 1); } px(g, TS * 7, 14, tone(th.wall, -0.45), TS, 2);
    // plaza
    px(g, TS * 8, 0, th.plaza, TS, TS); for (var py = 0; py < 2; py++) for (var pq = 0; pq < 2; pq++) { var bx = TS * 8 + pq * 8, by = py * 8; px(g, bx, by, tone(th.plaza, 0.12), 7, 1); px(g, bx, by, tone(th.plaza, 0.12), 1, 7); px(g, bx + 7, by, tone(th.plaza, -0.18), 1, 8); px(g, bx, by + 7, tone(th.plaza, -0.18), 8, 1); }
    // patch (dirt/sand)
    px(g, TS * 9, 0, tone(th.ground[0], -0.12), TS, TS); for (var d = 0; d < 20; d++) px(g, TS * 9 + Math.floor(R() * TS), Math.floor(R() * TS), tone(th.ground[0], -0.22 + R() * 0.15));
    // rock
    px(g, TS * 10, 0, th.ground[0], TS, TS); ell(g, TS * 10 + 8, 9, 7, 6, '#7d7a76'); ell(g, TS * 10 + 7, 7, 5, 4, '#9a9792'); px(g, TS * 10 + 5, 5, '#b9b6b0', 3, 1); px(g, TS * 10 + 2, 14, 'rgba(0,0,0,.25)', 12, 1);
    // tuft-heavy grass
    ground(TS * 11, th.ground[2]); for (var t = 0; t < 8; t++) { var tx = TS * 11 + 1 + Math.floor(R() * 14), ty = 4 + Math.floor(R() * 10); px(g, tx, ty, tone(th.tuft, -0.1), 1, 2); px(g, tx + 1, ty - 1, th.tuft); }
    return c;
  }

  /* ================================================================ ART: characters (layered paper doll) */
  // 16×24 frames; rows of the sheet: dir 0 down, 1 left, 2 right, 3 up; 3 frames each (idle, step a, step b)
  function drawChar(a) {
    var L = a.look || {}, c = cnv(16 * 12, 24), g = c.getContext('2d');
    var skin = SKIN[L.skin || 0], hair = HAIRC[L.hairc || 0], cloth = a.job && JOBC[a.job] ? JOBC[a.job] : OUTFIT[L.outfit || 0];
    var trim = a.armor ? GRADE[a.armor] : tone(cloth, 0.3), out = '#1e1620';
    for (var dir = 0; dir < 4; dir++) for (var fr = 0; fr < 3; fr++) {
      var o = (dir * 3 + fr) * 16, step = fr === 0 ? 0 : fr === 1 ? 1 : -1, bob = fr === 0 ? 0 : 1;
      ell(g, o + 8, 22.5, 5, 1.6, 'rgba(0,0,0,.28)');
      // legs
      var lx = dir === 1 || dir === 2 ? 0 : 1;
      px(g, o + 5, 17 - bob, out, 6, 6);
      px(g, o + 6 - (dir < 3 ? 0 : 0), 17 - bob, tone(cloth, -0.45), 2, 5 + (step > 0 ? 0 : -1 * lx));
      px(g, o + 9, 17 - bob, tone(cloth, -0.45), 2, 5 + (step < 0 ? 0 : -1 * lx));
      px(g, o + 6 + (step > 0 ? -lx : 0), 21 - bob + (step > 0 ? 0 : 0), '#3a2a20', 2, 1); px(g, o + 9 + (step < 0 ? lx : 0), 21 - bob, '#3a2a20', 2, 1);
      // body
      px(g, o + 4, 10 - bob, out, 8, 8); px(g, o + 5, 10 - bob, cloth, 6, 7); px(g, o + 5, 10 - bob, tone(cloth, 0.2), 6, 1); px(g, o + 5, 15 - bob, trim, 6, 1);
      if (a.armor) { px(g, o + 5, 11 - bob, tone(trim, -0.1), 6, 1); px(g, o + 7, 12 - bob, trim, 2, 2); }
      // arms
      var sw = step * 1;
      if (dir !== 1) { px(g, o + 3, 11 - bob + sw, out, 2, 5); px(g, o + 3, 11 - bob + sw, tone(cloth, -0.15), 1, 4); px(g, o + 3, 15 - bob + sw, skin, 1, 1); }
      if (dir !== 2) { px(g, o + 11, 11 - bob - sw, out, 2, 5); px(g, o + 12, 11 - bob - sw, tone(cloth, -0.15), 1, 4); px(g, o + 12, 15 - bob - sw, skin, 1, 1); }
      // head
      px(g, o + 4, 2 - bob, out, 8, 8); px(g, o + 5, 3 - bob, skin, 6, 6); px(g, o + 5, 8 - bob, tone(skin, -0.18), 6, 1);
      if (dir === 0) { px(g, o + 6, 6 - bob, '#1e1620'); px(g, o + 9, 6 - bob, '#1e1620'); px(g, o + 6, 5 - bob, '#ffffff'); px(g, o + 9, 5 - bob, '#ffffff'); px(g, o + 7, 8 - bob, tone(skin, -0.3), 2, 1); }
      if (dir === 1) px(g, o + 5, 6 - bob, '#1e1620'); if (dir === 2) px(g, o + 10, 6 - bob, '#1e1620');
      // hair styles: 0 short, 1 long, 2 bun, 3 scarf
      var hs = L.hair || 0, hc = hs === 3 ? tone(cloth, 0.35) : hair;
      px(g, o + 4, 1 - bob, hc, 8, 3); px(g, o + 5, 1 - bob, tone(hc, 0.25), 4, 1);
      if (dir === 3) px(g, o + 4, 3 - bob, hc, 8, 6);
      if (dir === 1) px(g, o + 9, 3 - bob, hc, 3, 4); if (dir === 2) px(g, o + 4, 3 - bob, hc, 3, 4);
      if (dir === 0) { px(g, o + 4, 3 - bob, hc, 1, 3); px(g, o + 11, 3 - bob, hc, 1, 3); }
      if (hs === 1) { px(g, o + 3, 3 - bob, hc, 1, 8); px(g, o + 12, 3 - bob, hc, 1, 8); if (dir === 3) px(g, o + 4, 9 - bob, hc, 8, 3); }
      if (hs === 2) { px(g, o + 6, -0 - bob < 0 ? 0 : 0, hc, 4, 1); ell(g, o + 8, 0.5 - bob + 0.5, 2, 1.4, hc); }
      if (hs === 3) { px(g, o + 3, 2 - bob, hc, 1, 9); px(g, o + 12, 2 - bob, hc, 1, 9); if (dir === 3) px(g, o + 4, 8 - bob, hc, 8, 4); px(g, o + 4, 1 - bob, tone(hc, -0.2), 8, 1); }
      // weapon by job (colour = gear grade)
      var wc = a.weapon ? GRADE[a.weapon] : '#9aa3ab';
      if (a.job === 'hunter') { if (dir !== 0) { px(g, o + (dir === 2 ? 3 : 11), 9 - bob, '#6b4a2a', 2, 8); px(g, o + (dir === 2 ? 2 : 12), 9 - bob, wc, 1, 2); } else { px(g, o + 2, 12 - bob, '#6b4a2a', 3, 1); px(g, o + 2, 11 - bob, wc, 1, 3); } }
      else if (a.job === 'trader') { var sx = dir === 1 ? 2 : 13; px(g, o + sx, 4 - bob, '#7a5230', 1, 15); px(g, o + sx - 1, 3 - bob, wc, 3, 2); }
      else if (a.job === 'thief' || a.weapon) { var dx = dir === 1 ? 1 : 13; if (dir !== 3) { px(g, o + dx, 13 - bob + sw, wc, 1, 4); px(g, o + dx - 1, 15 - bob + sw, '#5a3a22', 3, 1); } }
    }
    return c;
  }
  function charKey(a) { var L = a.look || {}; return 'ch_' + [L.skin, L.hair, L.hairc, L.outfit, a.job || '', a.weapon || 0, a.armor || 0].join('_'); }
  function ensureChar(scene, a) {
    var key = charKey(a);
    if (!scene.textures.exists(key)) {
      var t = addTex(scene, key, drawChar(a));
      for (var i = 0; i < 12; i++) t.add(i, 0, i * 16, 0, 16, 24);
      [0, 1, 2, 3].forEach(function (d) {
        scene.anims.create({ key: anim(key + '_w' + d), frames: [1, 0, 2, 0].map(function (f) { return { key: key, frame: d * 3 + f }; }), frameRate: 8, repeat: -1 });
      });
    }
    return key;
  }

  /* ================================================================ ART: monsters */
  var SHAPES = { 'Paper Tiger': ['beast', '#e8a33c', '#fff1d0'], 'Lantern Ghost': ['spirit', '#ff8a4c', '#ffe08a'], 'Rice Rat': ['beast', '#9b8a7a', '#e6d9c8'], 'Jade Dragon': ['dragon', '#3fae7f', '#d8f5e3'],
    'Sand Scorpion': ['bug', '#c4762f', '#f2c27e'], 'Dune Bandit': ['bandit', '#6b4a8a', '#e1c79b'], 'Cave Bat': ['flyer', '#5a4a6a', '#c9b6e0'], 'Desert Wyrm': ['dragon', '#c08a3a', '#f3dc9a'],
    'Mountain Wolf': ['beast', '#7d8a96', '#e2e8ee'], 'Stone Golem': ['golem', '#8a8578', '#c9c3b2'], 'Bazaar Trickster': ['bandit', '#b0384a', '#f2d06b'], 'Snow Leopard King': ['beast', '#d9dde2', '#6a7480'],
    'Night Assassin': ['bandit', '#2e2f45', '#9aa0c0'], 'Fire Djinn': ['spirit', '#e2513a', '#ffd36b'], 'Iron Boar': ['beast', '#6a5a50', '#b0a49a'], 'Shadow Khan': ['bandit', '#26223a', '#d24a5a'],
    'Roc Chick': ['flyer', '#c9873c', '#f6e0a8'], 'Brass Automaton': ['golem', '#c9a03c', '#f5e1a0'], 'Riddling Sphinx': ['beast', '#d4b06a', '#3a5a8a'], 'Grand Vizier': ['bandit', '#5a2e7a', '#f2c94c'],
    'Varangian Guard': ['bandit', '#8a2e2e', '#c6ced6'], 'Fire Drake': ['dragon', '#d2452e', '#ffcf6b'], 'Hippodrome Champion': ['bandit', '#2e5a8a', '#f2c94c'], 'Iron Emperor': ['golem', '#5b4b7a', '#f2c94c'] };
  function drawMonster(name, size) {
    var s = SHAPES[name] || ['spirit', '#d24a3a', '#ffd0c0'], k = s[0], c1 = s[1], c2 = s[2], S = size, c = cnv(S * 2, S), out = '#1e1620';
    var g = c.getContext('2d');
    for (var fr = 0; fr < 2; fr++) {
      var o = fr * S, b = fr, u = S / 24;
      g.save(); g.translate(o, 0); g.scale(u, u);
      ell(g, 12, 22.5, 9, 1.8, 'rgba(0,0,0,.3)');
      if (k === 'beast') { ell(g, 12, 15 - b, 8, 5, out); ell(g, 12, 15 - b, 7, 4, c1); ell(g, 12, 13.5 - b, 6, 2, tone(c1, 0.25)); px(g, 6, 18 - b, out, 3, 4); px(g, 15, 18 - b, out, 3, 4); px(g, 7, 18 - b, tone(c1, -0.2), 1, 3); px(g, 16, 18 - b, tone(c1, -0.2), 1, 3); ell(g, 5, 11 - b, 4.5, 4, out); ell(g, 5, 11 - b, 3.6, 3.2, c1); px(g, 2, 6 - b, out, 2, 3); px(g, 6, 6 - b, out, 2, 3); px(g, 3, 10 - b, '#fff'); px(g, 3, 10 - b, '#1e1620', 1, 1); ell(g, 3, 13 - b, 2, 1.2, c2); px(g, 19, 10 - b + b, out, 4, 2); px(g, 9, 13 - b, c2, 6, 1); }
      else if (k === 'spirit') { ell(g, 12, 11 - b * 1.5, 8, 8, out); ell(g, 12, 11 - b * 1.5, 7, 7, c1); ell(g, 10, 8 - b * 1.5, 3, 2.5, c2); for (var t = 0; t < 4; t++) px(g, 6 + t * 3, 17 - b + (t % 2), c1, 2, 3); px(g, 9, 11 - b, '#1e1620', 2, 2); px(g, 13, 11 - b, '#1e1620', 2, 2); px(g, 9, 11 - b, '#fff'); px(g, 13, 11 - b, '#fff'); }
      else if (k === 'bug') { ell(g, 12, 16 - b, 7, 4, out); ell(g, 12, 16 - b, 6, 3, c1); for (var l = 0; l < 3; l++) { px(g, 6 + l * 4, 19 - b, out, 1, 3); } px(g, 2, 12 - b, out, 4, 3); px(g, 18, 12 - b, out, 4, 3); px(g, 3, 13 - b, c2, 2, 1); px(g, 19, 13 - b, c2, 2, 1); px(g, 11, 6 - b, out, 3, 9); px(g, 12, 7 - b, c1, 1, 7); ell(g, 13, 5 - b, 2.5, 2, c2); px(g, 10, 15 - b, '#1e1620'); px(g, 14, 15 - b, '#1e1620'); }
      else if (k === 'flyer') { var wv = b ? 3 : 0; g.fillStyle = out; g.beginPath(); g.moveTo(12, 12); g.lineTo(1, 6 + wv); g.lineTo(4, 15); g.closePath(); g.fill(); g.beginPath(); g.moveTo(12, 12); g.lineTo(23, 6 + wv); g.lineTo(20, 15); g.closePath(); g.fill(); g.fillStyle = c1; g.beginPath(); g.moveTo(12, 12.5); g.lineTo(3, 8 + wv); g.lineTo(5, 14); g.closePath(); g.fill(); g.beginPath(); g.moveTo(12, 12.5); g.lineTo(21, 8 + wv); g.lineTo(19, 14); g.closePath(); g.fill(); ell(g, 12, 13, 4, 5, out); ell(g, 12, 13, 3, 4, c2); px(g, 10, 11, '#1e1620'); px(g, 13, 11, '#1e1620'); }
      else if (k === 'golem') { px(g, 5, 6 - b, out, 14, 16); px(g, 6, 7 - b, c1, 12, 14); px(g, 6, 7 - b, tone(c1, 0.25), 12, 2); px(g, 2, 10 - b, out, 4, 9); px(g, 18, 10 - b, out, 4, 9); px(g, 3, 11 - b, c1, 2, 7); px(g, 19, 11 - b, c1, 2, 7); px(g, 8, 10 - b, c2, 3, 2); px(g, 13, 10 - b, c2, 3, 2); px(g, 9, 16 - b, tone(c1, -0.3), 6, 1); px(g, 7, 20, out, 4, 2); px(g, 13, 20, out, 4, 2); }
      else if (k === 'bandit') { px(g, 7, 2 - b, out, 10, 8); px(g, 8, 3 - b, c2, 8, 6); px(g, 7, 2 - b, c1, 10, 3); px(g, 8, 6 - b, c1, 8, 2); px(g, 9, 6 - b, '#fff'); px(g, 14, 6 - b, '#fff'); px(g, 6, 10 - b, out, 12, 9); px(g, 7, 10 - b, c1, 10, 8); px(g, 7, 13 - b, c2, 10, 1); px(g, 4, 11 - b, out, 3, 6); px(g, 17, 11 - b, out, 3, 6); px(g, 19, 8 - b, '#c6ced6', 1, 8); px(g, 18, 15 - b, '#6b4a2a', 3, 1); px(g, 8, 19, out, 3, 3); px(g, 13, 19, out, 3, 3); }
      else { // dragon / serpent
        for (var i = 0; i < 6; i++) { var sx = 3 + i * 3, sy = 16 - Math.sin((i + b) * 1.2) * 3; ell(g, sx, sy, 3, 3, out); ell(g, sx, sy, 2.2, 2.2, i % 2 ? c1 : tone(c1, 0.15)); }
        ell(g, 20, 9 - b, 4, 3.5, out); ell(g, 20, 9 - b, 3.2, 2.8, c1); px(g, 17, 4 - b, c2, 1, 3); px(g, 22, 4 - b, c2, 1, 3); px(g, 21, 8 - b, '#fff'); px(g, 21, 8 - b, '#ff4d4d', 1, 1); px(g, 22, 11 - b, c2, 3, 1);
      }
      g.restore();
    }
    return c;
  }
  function ensureMonster(scene, name, size) {
    var key = 'mo_' + name.replace(/\W/g, '') + '_' + size;
    if (!scene.textures.exists(key)) { var t = addTex(scene, key, drawMonster(name, size)); t.add(0, 0, 0, 0, size, size); t.add(1, 0, size, 0, size, size); scene.anims.create({ key: anim(key + '_a'), frames: [{ key: key, frame: 0 }, { key: key, frame: 1 }], frameRate: 3, repeat: -1 }); }
    return key;
  }

  /* ================================================================ ART: buildings and props */
  function drawBuilding(th, w, h, big, R) {
    var c = cnv(w, h), g = c.getContext('2d'), wallTop = Math.round(h * (th.roof === 'pagoda' ? 0.5 : th.roof === 'adobe' ? 0.28 : 0.45));
    ell(g, w / 2, h - 2, w / 2 - 1, 3, 'rgba(0,0,0,.25)');
    // walls
    px(g, 3, wallTop, '#1e1620', w - 6, h - wallTop - 3); px(g, 4, wallTop, th.bodyC, w - 8, h - wallTop - 4);
    px(g, 4, wallTop, tone(th.bodyC, 0.15), w - 8, 2); px(g, 4, h - 8, tone(th.bodyC, -0.15), w - 8, 4);
    for (var i = 0; i < 25; i++) px(g, 4 + Math.floor(R() * (w - 8)), wallTop + 2 + Math.floor(R() * (h - wallTop - 8)), tone(th.bodyC, -0.08));
    // door
    var dw = big ? 10 : 8, dx = Math.round(w / 2 - dw / 2); px(g, dx - 1, h - 17, '#1e1620', dw + 2, 14); px(g, dx, h - 16, th.trim, dw, 12); px(g, dx + 1, h - 15, tone(th.trim, 0.2), dw - 2, 1); px(g, dx + dw - 3, h - 10, '#f2c94c');
    // windows (lit at night: positions returned)
    var lights = [];
    [Math.round(w * 0.22), Math.round(w * 0.78) - 6].forEach(function (wx) { var wy = Math.max(wallTop + 4, h - 20); px(g, wx - 1, wy - 1, '#1e1620', 8, 8); px(g, wx, wy, '#ffd98a', 6, 6); px(g, wx, wy, '#fff3c4', 3, 2); px(g, wx + 2, wy, '#1e1620', 1, 6); lights.push([wx + 3, wy + 3]); });
    // roofs
    if (th.roof === 'pagoda') {
      for (var tier = 0; tier < (big ? 2 : 1); tier++) {
        var ry = wallTop - 10 - tier * 13, inset = tier * 8;
        g.fillStyle = '#1e1620'; g.beginPath(); g.moveTo(inset - 1, ry + 11); g.quadraticCurveTo(w / 2, ry - 6, w - inset + 1, ry + 11); g.lineTo(w - inset - 6, ry + 13); g.lineTo(inset + 6, ry + 13); g.closePath(); g.fill();
        g.fillStyle = th.roofC; g.beginPath(); g.moveTo(inset + 1, ry + 10); g.quadraticCurveTo(w / 2, ry - 4, w - inset - 1, ry + 10); g.lineTo(w - inset - 6, ry + 11); g.lineTo(inset + 6, ry + 11); g.closePath(); g.fill();
        for (var s = inset + 6; s < w - inset - 6; s += 3) px(g, s, ry + 4, tone(th.roofC, -0.2), 1, 6);
        px(g, inset + 6, ry + 10, tone(th.roofC, -0.35), w - 2 * inset - 12, 2);
        px(g, 4 + inset, ry + 12, th.trim, 2, wallTop - ry - 12 + (tier ? 0 : 2)); px(g, w - 6 - inset, ry + 12, th.trim, 2, wallTop - ry - 12 + (tier ? 0 : 2));
      }
      px(g, 4, wallTop, '#a8352a', 2, h - wallTop - 4); px(g, w - 6, wallTop, '#a8352a', 2, h - wallTop - 4);
    } else if (th.roof === 'adobe') {
      px(g, 2, wallTop - 4, '#1e1620', w - 4, 6); px(g, 3, wallTop - 3, th.roofC, w - 6, 4); px(g, 3, wallTop - 3, tone(th.roofC, 0.2), w - 6, 1);
      for (var p = 4; p < w - 6; p += 6) { px(g, p - 1, wallTop - 8, '#1e1620', 5, 5); px(g, p, wallTop - 7, th.roofC, 3, 4); }
      px(g, 6, h - 22, tone(th.trim, 0.4), w - 12, 2); for (var aw = 6; aw < w - 6; aw += 4) px(g, aw, h - 20, aw % 8 ? '#d8573a' : '#f2e2b0', 4, 3);
    } else if (th.roof === 'tile') {
      g.fillStyle = '#1e1620'; g.beginPath(); g.moveTo(0, wallTop + 2); g.lineTo(w / 2, wallTop - 16); g.lineTo(w, wallTop + 2); g.closePath(); g.fill();
      g.fillStyle = th.roofC; g.beginPath(); g.moveTo(3, wallTop + 1); g.lineTo(w / 2, wallTop - 14); g.lineTo(w - 3, wallTop + 1); g.closePath(); g.fill();
      for (var tr = 0; tr < 5; tr++) px(g, 6 + tr * 2, wallTop - 2 - tr * 2.6, tone(th.roofC, -0.2), w - 12 - tr * 4, 1);
    } else { // dome
      var dr = Math.round(w * (big ? 0.3 : 0.26));
      px(g, 2, wallTop - 3, '#1e1620', w - 4, 4); px(g, 3, wallTop - 2, tone(th.bodyC, -0.1), w - 6, 2);
      ell(g, w / 2, wallTop - 2, dr + 1, dr * 0.95 + 1, '#1e1620'); ell(g, w / 2, wallTop - 2, dr, dr * 0.95, th.roofC);
      ell(g, w / 2 - dr * 0.35, wallTop - dr * 0.5, dr * 0.3, dr * 0.25, tone(th.roofC, 0.35)); px(g, w / 2 - 1, wallTop - dr - 6, '#1e1620', 3, 6); px(g, w / 2, wallTop - dr - 8, '#f2c94c', 1, 3);
      px(g, Math.round(w / 2 - dr), wallTop - 3, '#1e1620', dr * 2, 1);
      if (big) { px(g, w - 8, wallTop - 22, '#1e1620', 6, 22); px(g, w - 7, wallTop - 21, th.bodyC, 4, 21); ell(g, w - 5, wallTop - 23, 3, 3, th.roofC); for (var tb = 0; tb < 3; tb++) px(g, w - 7, wallTop - 18 + tb * 6, th.roofC, 4, 1); }
    }
    return { canvas: c, lights: lights };
  }
  function drawTree(kind, th) {
    var c = cnv(32, 44), g = c.getContext('2d');
    ell(g, 16, 41, 10, 3, 'rgba(0,0,0,.28)');
    if (kind === 'palm') {
      g.strokeStyle = '#1e1620'; g.lineWidth = 4; g.beginPath(); g.moveTo(16, 41); g.quadraticCurveTo(12, 26, 17, 12); g.stroke(); g.strokeStyle = '#9a6b3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(16, 41); g.quadraticCurveTo(12, 26, 17, 12); g.stroke();
      for (var r = 0; r < 6; r++) { var a = -Math.PI / 2 + (r - 2.5) * 0.6; g.strokeStyle = '#1e1620'; g.lineWidth = 4; g.beginPath(); g.moveTo(17, 12); g.quadraticCurveTo(17 + Math.cos(a) * 8, 6 + Math.sin(a) * 4, 17 + Math.cos(a) * 14, 14 + Math.sin(a) * 6); g.stroke(); g.strokeStyle = r % 2 ? '#4f9a3c' : '#6fb84e'; g.lineWidth = 2; g.stroke(); }
      ell(g, 16, 13, 2, 2, '#7a4a2a');
    } else if (kind === 'cypress' || kind === 'poplar') {
      px(g, 15, 32, '#1e1620', 3, 10); px(g, 16, 32, '#6b4a2a', 1, 9);
      var col = kind === 'cypress' ? '#2f6b3c' : '#7fa84a'; ell(g, 16, 18, 7, 16, '#1e1620'); ell(g, 16, 18, 6, 15, col); ell(g, 14, 13, 3, 7, tone(col, 0.25)); for (var i = 0; i < 6; i++) px(g, 13 + (i % 3) * 3, 10 + i * 4, tone(col, -0.2), 2, 1);
    } else {
      px(g, 14, 28, '#1e1620', 5, 14); px(g, 15, 28, '#7a5232', 3, 13); px(g, 15, 28, '#946a42', 1, 13);
      var col2 = kind === 'blossom' ? '#f0a2c0' : kind === 'olive' ? '#8aa05a' : '#5c9a42';
      [[16, 17, 12, 10], [9, 21, 7, 6], [23, 21, 7, 6], [16, 11, 8, 6]].forEach(function (b) { ell(g, b[0], b[1], b[2] + 1, b[3] + 1, '#1e1620'); });
      [[16, 17, 12, 10], [9, 21, 7, 6], [23, 21, 7, 6], [16, 11, 8, 6]].forEach(function (b) { ell(g, b[0], b[1], b[2], b[3], col2); });
      ell(g, 13, 12, 6, 4, tone(col2, 0.25)); ell(g, 20, 24, 6, 3, tone(col2, -0.18));
      if (kind === 'blossom') for (var p = 0; p < 10; p++) px(g, 6 + Math.round(Math.random() * 20), 8 + Math.round(Math.random() * 18), '#fff0f6');
    }
    return c;
  }
  function drawProp(kind, th) {
    var c, g;
    if (kind === 'lantern') { c = cnv(10, 26); g = c.getContext('2d'); ell(g, 5, 25, 4, 1.3, 'rgba(0,0,0,.25)'); px(g, 4, 8, '#1e1620', 2, 17); px(g, 1, 2, '#1e1620', 8, 8); px(g, 2, 3, '#ffcf6b', 6, 6); px(g, 2, 3, '#fff3c4', 3, 2); px(g, 1, 1, th.trim, 8, 2); return c; }
    if (kind === 'stall') { c = cnv(36, 30); g = c.getContext('2d'); ell(g, 18, 28, 16, 2.5, 'rgba(0,0,0,.25)'); px(g, 3, 10, '#1e1620', 2, 18); px(g, 31, 10, '#1e1620', 2, 18); px(g, 2, 17, '#1e1620', 32, 9); px(g, 3, 18, '#8a5a32', 30, 7); for (var i = 0; i < 6; i++) ell(g, 7 + i * 4.5, 17, 2, 1.6, ['#e85a3a', '#f2c94c', '#7ac74f', '#b04ad2'][i % 4]); px(g, 0, 4, '#1e1620', 36, 8); for (var s = 0; s < 9; s++) px(g, 1 + s * 4, 5, s % 2 ? '#f2e2b0' : th.roofC, 4, 6); return c; }
    if (kind === 'well') { c = cnv(32, 30); g = c.getContext('2d'); ell(g, 16, 26, 14, 4, 'rgba(0,0,0,.25)'); ell(g, 16, 20, 13, 6, '#1e1620'); ell(g, 16, 19, 12, 5, th.plaza); ell(g, 16, 18, 9, 3.5, th.water); ell(g, 13, 17, 3, 1, tone(th.water, 0.4)); px(g, 4, 3, '#1e1620', 2, 16); px(g, 26, 3, '#1e1620', 2, 16); px(g, 2, 1, '#1e1620', 28, 4); px(g, 3, 2, th.roofC, 26, 2); return c; }
    if (kind === 'board') { c = cnv(26, 28); g = c.getContext('2d'); ell(g, 13, 27, 10, 1.6, 'rgba(0,0,0,.25)'); px(g, 5, 14, '#1e1620', 2, 13); px(g, 19, 14, '#1e1620', 2, 13); px(g, 1, 2, '#1e1620', 24, 15); px(g, 2, 3, '#a8763f', 22, 13); px(g, 4, 5, '#f3ead2', 7, 5); px(g, 13, 4, '#f3ead2', 8, 6); px(g, 6, 11, '#f3ead2', 9, 4); px(g, 7, 5, '#d24a3a', 1, 1); px(g, 16, 4, '#d24a3a', 1, 1); return c; }
    if (kind === 'anvil') { c = cnv(22, 18); g = c.getContext('2d'); ell(g, 11, 16, 9, 2, 'rgba(0,0,0,.25)'); px(g, 3, 4, '#1e1620', 16, 5); px(g, 4, 5, '#6d737a', 14, 3); px(g, 4, 5, '#9aa3ab', 14, 1); px(g, 8, 9, '#1e1620', 6, 6); px(g, 9, 9, '#5a6066', 4, 5); px(g, 1, 13, '#ff7a3a', 3, 2); return c; }
    if (kind === 'note') { c = cnv(12, 14); g = c.getContext('2d'); ell(g, 6, 13, 4, 1, 'rgba(0,0,0,.25)'); px(g, 1, 1, '#1e1620', 10, 11); px(g, 2, 2, '#fff3c4', 8, 9); px(g, 3, 4, '#a8763f', 6, 1); px(g, 3, 6, '#a8763f', 5, 1); px(g, 3, 8, '#a8763f', 6, 1); return c; }
    if (kind === 'crate') { c = cnv(14, 14); g = c.getContext('2d'); px(g, 0, 0, '#1e1620', 14, 13); px(g, 1, 1, '#a8763f', 12, 11); px(g, 1, 1, '#c79560', 12, 1); px(g, 1, 6, '#7a5230', 12, 1); px(g, 6, 1, '#7a5230', 1, 11); return c; }
    if (kind === 'gate') { c = cnv(16, 48); g = c.getContext('2d'); px(g, 2, 0, '#1e1620', 12, 48); px(g, 3, 1, th.trim, 10, 46); for (var y = 4; y < 46; y += 6) px(g, 3, y, tone(th.trim, -0.3), 10, 1); return c; }
    return cnv(1, 1);
  }
  function lightTex(scene) {
    if (scene.textures.exists('light')) return;
    var c = cnv(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    addTex(scene, 'light', c);
    var d = cnv(4, 4), dg = d.getContext('2d'); dg.fillStyle = '#fff'; dg.fillRect(0, 0, 4, 4); addTex(scene, 'dot', d);
    var p = cnv(5, 4), pg = p.getContext('2d'); pg.fillStyle = '#ffc4d8'; pg.fillRect(1, 0, 3, 4); pg.fillRect(0, 1, 5, 2); addTex(scene, 'petal', p);
  }

  /* ================================================================ the map of a town */
  function buildMap(t, reached) {
    var R = rng(1000 + t * 77), grid = [], i, x, y;
    for (y = 0; y < MH; y++) { grid.push([]); for (x = 0; x < MW; x++) grid[y].push(R() < 0.18 ? 1 : R() < 0.06 ? 2 : R() < 0.05 ? 11 : 0); }
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < MW && y < MH) grid[y][x] = v; }
    function rect(x0, y0, x1, y1, v) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) set(xx, yy, v); }
    // the edges of the world: rocks
    for (x = 0; x < MW; x++) { set(x, 0, 10); set(x, MH - 1, 10); if (R() < 0.6) set(x, 1, 10); if (R() < 0.6) set(x, MH - 2, 10); }
    for (y = 0; y < MH; y++) { set(MW - 1, y, 10); set(0, y, 10); }
    // town walls with gates
    for (x = 2; x <= 36; x++) { set(x, 4, 6); set(x, 5, 7); set(x, 36, 6); }
    for (y = 4; y <= 36; y++) { set(2, y, 6); set(36, y, 6); }
    rect(3, 6, 35, 35, 0);
    for (y = 6; y <= 35; y++) for (x = 3; x <= 35; x++) if (R() < 0.12) set(x, y, 1);
    rect(13, 14, 25, 26, 8); // plaza
    rect(3, 19, 70, 21, 3); // main road
    rect(18, 6, 20, 35, 3); // north–south street
    for (y = 19; y <= 21; y++) { set(36, y, 3); set(2, y, t > 1 ? 3 : 6); }
    for (x = 0; x <= 1; x++) for (y = 19; y <= 21; y++) set(x, y, t > 1 ? 3 : 10);
    // the road through the wilds wiggles
    for (x = 37; x < MW - 1; x++) { var off = Math.round(Math.sin(x / 5) * 2); for (y = 19 + off; y <= 21 + off; y++) set(x, y, R() < 0.3 ? 4 : 3); }
    for (y = 18; y <= 22; y++) set(MW - 1, y, reached > t ? 3 : 10);
    // patches, flowers and rocks in the wilds
    for (i = 0; i < 18; i++) { var cx = 39 + Math.floor(R() * 30), cy = 3 + Math.floor(R() * 36), rr = 1 + Math.floor(R() * 2); for (y = cy - rr; y <= cy + rr; y++) for (x = cx - rr; x <= cx + rr; x++) if (grid[y] && grid[y][x] === 0) set(x, y, 9); }
    for (i = 0; i < 26; i++) { x = 38 + Math.floor(R() * 32); y = 3 + Math.floor(R() * 36); if (Math.abs(y - 20) > 3 && grid[y][x] !== 3) set(x, y, 10); }
    // water: a pond, or the sea north of Constantinople
    if (t === 6) { rect(38, 2, 70, 7, 5); } else { for (y = 26; y <= 33; y++) for (x = 46; x <= 58; x++) if (((x - 52) * (x - 52)) / 36 + ((y - 29.5) * (y - 29.5)) / 12 < 1) set(x, y, 5); }
    // keep the paths around the gates clear
    rect(37, 19, 39, 21, 3);
    return grid;
  }

  /* ================================================================ HUD (HTML over the canvas) */
  function hud() {
    if (!ROOT) return;
    var w = H.world(), me = H.me();
    $('.sg-top').innerHTML = '<div class="sg-who"><span class="sg-face">' + (me.avatar ? '<img src="' + esc(me.avatar) + '" alt="">' : '') + '</span><div><b>' + esc(me.name) + '</b><small>' + esc(w.town.icon + ' ' + w.town.name + ' · ' + w.town.level) + (w.titles.length ? ' · ' + esc(w.titles[w.titles.length - 1]) : '') + '</small></div></div>'
      + '<div class="sg-stats"><span title="Coins">🪙 ' + w.coins + '</span><span title="Elixirs">⚗ ' + w.elixirs + '</span><span title="Fights left today">⚡ ' + w.stamina.left + '/' + w.stamina.max + '</span></div>';
    var ready = w.daily.filter(function (q) { return q.done && !q.claimed; }).length + w.story.filter(function (s) { return s.state === 'claim'; }).length;
    $('.sg-menu').innerHTML = [['quests', '📜', 'Quests', ready], ['party', '⚔', 'Party', 0], ['chat', '💬', 'Say', 0], ['emote', '🙂', 'Emote', 0], ['note', '✍', 'Note', 0], ['map', '🗺', 'Map', 0], ['help', '?', 'Help', 0], ['list', '☰', 'List view', 0], ['exit', '✕', 'Exit', 0]].map(function (b) {
      return '<button class="sg-mb" data-g="' + b[0] + '" aria-label="' + b[2] + '"><span>' + b[1] + '</span><small>' + b[2] + '</small>' + (b[3] ? '<i>' + b[3] + '</i>' : '') + '</button>';
    }).join('');
  }
  function say(msg, ms) { var t = $('.sg-hint'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(function () { t.classList.remove('on'); }, ms || 3200); }
  function dialog(name, text, buttons, portrait) {
    var d = $('.sg-dlg'); if (!d) return; d.innerHTML = '<div class="sg-box">' + (portrait ? '<span class="sg-por">' + portrait + '</span>' : '') + '<div class="sg-txt"><b>' + esc(name) + '</b><p></p><div class="sg-opts">' + (buttons || []).map(function (b, i) { return '<button data-o="' + i + '"' + (b.primary ? ' class="pri"' : '') + '>' + esc(b.label) + '</button>'; }).join('') + '<button data-o="x">Bye</button></div></div></div>';
    d.classList.add('on');
    var p = d.querySelector('p'), i = 0, full = text;
    clearInterval(dialog.t); dialog.t = setInterval(function () { i += 2; p.textContent = full.slice(0, i); if (i >= full.length) clearInterval(dialog.t); }, 18);
    d.querySelectorAll('[data-o]').forEach(function (b) { b.onclick = function () { clearInterval(dialog.t); var o = b.dataset.o; d.classList.remove('on'); d.innerHTML = ''; if (o !== 'x' && buttons[+o]) buttons[+o].run(); }; });
  }
  function closeDialog() { var d = $('.sg-dlg'); if (d) { d.classList.remove('on'); d.innerHTML = ''; } }
  function inputBox(title, ph, ok) {
    var d = $('.sg-dlg'); if (!d) return; d.innerHTML = '<div class="sg-box"><div class="sg-txt"><b>' + esc(title) + '</b><input maxlength="140" placeholder="' + esc(ph) + '" dir="ltr"><p class="sg-err"></p><div class="sg-opts"><button class="pri" data-o="ok">Send</button><button data-o="x">Cancel</button></div></div></div>'; d.classList.add('on');
    var inp = d.querySelector('input'), err = d.querySelector('.sg-err'); inp.focus(); inp.oninput = function () { err.textContent = ''; };
    function go() { var v = inp.value.trim(); if (!v) { err.textContent = 'Write something first'; return; } ok(v, function (m) { err.textContent = m; }, function () { d.classList.remove('on'); d.innerHTML = ''; }); }
    inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') { d.classList.remove('on'); d.innerHTML = ''; } };
    d.querySelector('[data-o="ok"]').onclick = go; d.querySelector('[data-o="x"]').onclick = function () { d.classList.remove('on'); d.innerHTML = ''; };
  }

  /* ================================================================ NPC lines (simple English, by town) */
  var NPC = {
    elder: ['Elder Wen', '👴', 'Welcome, traveller. The road to the West is long. Learn our words, and the road will open for you.'],
    inn: ['Innkeeper Lina', '👩', 'Tired? Rest here and review your word cards. A rested mind fights better — every plan step gives you one more fight.'],
    smith: ['Smith Bayram', '🧔', 'Good steel follows good English. Bring me coins and I will forge you something worthy of your level.'],
    crier: ['Town crier', '📣', 'Hear ye! Speak with the travellers of this town — but only in English!'],
    guard: ['Gate guard', '💂', 'The road east is closed until the beast of this land is defeated.']
  };

  /* ================================================================ the world scene */
  function makeScenes(Phaser) {
    var World = new Phaser.Class({
      Extends: Phaser.Scene,
      initialize: function World() { Phaser.Scene.call(this, { key: 'World' }); },
      init: function (d) { this.spawn = d && d.spawn; this.pos = d && d.pos; },
      create: function () {
        var S = this, w = H.world(), t = w.at, th = THEMES[t] || THEMES[1];
        S.t = t; S.th = th; S.lights = []; S.others = {}; S.labels = {}; S.notes = []; S.near = null; S.cool = 0; S.monsters = [];
        lightTex(S);
        // ground
        var tk = 'tiles' + t; if (!S.textures.exists(tk)) addTex(S, tk, drawTiles(th, t * 31));
        var grid = buildMap(t, w.reached);
        var map = S.make.tilemap({ data: grid, tileWidth: TS, tileHeight: TS });
        var ts = map.addTilesetImage(tk, tk, TS, TS, 0, 0);
        var layer = map.createLayer(0, ts, 0, 0); layer.setCollision(SOLID); layer.setDepth(0); S.layer = layer;
        S.physics.world.setBounds(0, 0, MW * TS, MH * TS);
        S.solids = S.physics.add.staticGroup();
        var R = rng(500 + t);
        function solid(x, y, wd, ht) { var z = S.add.zone(x, y, wd, ht); S.physics.add.existing(z, true); S.solids.add(z); return z; }
        function sprite(key, x, y, depthY) { var s = S.add.image(x, y, key).setOrigin(0.5, 1); s.setDepth(depthY || y); return s; }
        // buildings
        var B = [['elder', 19.5, 12.6, 72, 64, true], ['inn', 8.5, 15.6, 60, 52, true], ['forge', 8.5, 30.6, 52, 46, false], ['house', 29.5, 12.6, 48, 44, false], ['house', 29.5, 30.6, 48, 44, false], ['house', 14.5, 34.6, 44, 40, false], ['house', 24.5, 34.6, 44, 40, false]];
        B.forEach(function (b, i) {
          var key = 'b' + t + '_' + i; var art = drawBuilding(th, b[3], b[4], b[5], R); if (!S.textures.exists(key)) addTex(S, key, art.canvas);
          var bx = b[1] * TS, by = b[2] * TS, img = sprite(key, bx, by);
          solid(bx, by - b[4] * 0.28, b[3] - 8, b[4] * 0.5);
          art.lights.forEach(function (l) { S.lights.push({ x: bx - b[3] / 2 + l[0], y: by - b[4] + l[1], r: 0.35 }); });
          if (b[0] === 'forge') { var an = 'anvil'; if (!S.textures.exists(an)) addTex(S, an, drawProp('anvil', th)); sprite(an, bx + 30, by + 6); S.lights.push({ x: bx + 22, y: by + 2, r: 0.5, c: 0xff7a3a }); }
        });
        // props: well, board, stalls, lanterns, crates
        function prop(kind, x, y, solidW) { var key = kind + t; if (!S.textures.exists(key)) addTex(S, key, drawProp(kind, th)); var s = sprite(key, x, y); if (solidW) solid(x, y - 4, solidW, 8); return s; }
        prop('well', 16 * TS, 17.6 * TS, 26); S.board = prop('board', 23 * TS, 17.4 * TS, 20);
        [15, 19.5, 24].forEach(function (x) { prop('stall', x * TS, 26 * TS, 32); });
        [[5, 18.4], [11, 18.4], [27, 18.4], [33, 18.4], [5, 23.4], [11, 23.4], [27, 23.4], [33, 23.4], [17, 9], [21.5, 9], [17, 31], [21.5, 31], [40, 18], [44, 23]].forEach(function (p) { prop('lantern', p[0] * TS, p[1] * TS, 6); S.lights.push({ x: p[0] * TS, y: p[1] * TS - 20, r: 0.6, c: 0xffc06b }); });
        [[12, 29], [13, 29.6], [31, 24]].forEach(function (p) { prop('crate', p[0] * TS, p[1] * TS, 12); });
        // trees inside the walls and in the wilds
        var treeKey = 'tree' + t; if (!S.textures.exists(treeKey)) addTex(S, treeKey, drawTree(th.tree, th));
        var spots = [[4.5, 8], [34, 8], [4.5, 34], [34, 34], [12, 8], [26, 8.2], [4.5, 27], [34, 27]];
        for (var k = 0; k < 34; k++) { var tx = 39 + R() * 31, ty = 3 + R() * 36; if (Math.abs(ty - 20) > 4 && grid[Math.floor(ty)][Math.floor(tx)] < 3) spots.push([tx, ty]); }
        spots.forEach(function (p) { sprite(treeKey, p[0] * TS, p[1] * TS); solid(p[0] * TS, p[1] * TS - 3, 8, 6); });
        // gates
        if (!S.textures.exists('gate' + t)) addTex(S, 'gate' + t, drawProp('gate', th));
        // NPCs
        S.npcs = [];
        function npc(id, x, y, look, job) { var a = { look: look, job: job }; var key = ensureChar(S, a); var s = S.physics.add.sprite(x * TS, y * TS, key, 0).setOrigin(0.5, 1).setImmovable(true); s.body.setSize(10, 6).setOffset(3, 18); s.setDepth(s.y); s.npc = id; S.npcs.push(s); S.physics.add.collider(s, S.solids); return s; }
        npc('elder', 19.5, 14.2, { skin: 1, hair: 3, hairc: 5, outfit: 4 }, ''); npc('inn', 11.5, 16.4, { skin: 2, hair: 1, hairc: 1, outfit: 1 }, '');
        npc('smith', 12, 31.2, { skin: 3, hair: 0, hairc: 0, outfit: 5 }, 'hunter'); npc('crier', 14.5, 23, { skin: 0, hair: 2, hairc: 2, outfit: 3 }, 'trader');
        if (w.reached <= t) npc('guard', 37.5, 18.4, { skin: 4, hair: 0, hairc: 0, outfit: 1 }, 'thief');
        // the boss of the town, in its lair east of the pond
        var b = w.town.boss;
        if (!b.beaten) {
          var bk = ensureMonster(S, b.name, 40), bs = S.physics.add.sprite(64 * TS, 31 * TS, bk, 0).setOrigin(0.5, 1).setScale(1.25).setImmovable(true);
          bs.play(bk + '_a'); bs.body.setSize(28, 14).setOffset(6, 24); bs.setDepth(bs.y); bs.boss = true; S.boss = bs;
          S.lights.push({ x: 64 * TS, y: 30 * TS, r: 0.8, c: 0xff5a5a });
        }
        // roaming monsters
        var mons = w.town.monsters;
        for (var m = 0; m < 8; m++) {
          var mi = m % mons.length, mk = ensureMonster(S, mons[mi].name, 24), mx = (41 + R() * 26) * TS, my = (5 + R() * 32) * TS;
          var ms = S.physics.add.sprite(mx, my, mk, 0).setOrigin(0.5, 1); ms.play(mk + '_a'); ms.body.setSize(14, 8).setOffset(5, 15); ms.m = mi; ms.home = { x: mx, y: my }; ms.setDepth(my);
          S.monsters.push(ms);
        }
        S.monGroup = S.physics.add.group(S.monsters);
        S.physics.add.collider(S.monGroup, layer); S.physics.add.collider(S.monGroup, S.solids);
        // the player
        var me = H.avatar();
        var key = ensureChar(S, me);
        var sp = S.pos ? S.pos : S.spawn === 'east' ? { x: 68 * TS, y: 21 * TS } : S.spawn === 'west' ? { x: 4 * TS, y: 21 * TS } : { x: 19 * TS, y: 23 * TS };
        var pl = S.physics.add.sprite(sp.x, sp.y, key, 0).setOrigin(0.5, 1); pl.body.setSize(10, 6).setOffset(3, 18); pl.setCollideWorldBounds(true); pl.key = key; pl.dir = 0; S.pl = pl;
        S.physics.add.collider(pl, layer); S.physics.add.collider(pl, S.solids); S.npcs.forEach(function (n) { S.physics.add.collider(pl, n); });
        S.physics.add.overlap(pl, S.monGroup, function (p, mo) { S.encounter(mo); });
        if (S.boss) S.physics.add.collider(pl, S.boss, function () { S.bossTouch(); });
        // camera
        var cam = S.cameras.main; cam.setBounds(0, 0, MW * TS, MH * TS); cam.startFollow(pl, true, 0.14, 0.14); S.fitZoom(); cam.fadeIn(400, 0, 0, 0);
        S.scale.on('resize', S.fitZoom, S);
        // atmosphere: light, particles, water glints
        S.darkC = $('.sg-dark');
        S.glows = S.lights.map(function (l) { return S.add.image(l.x, l.y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(l.c || 0xffd38a).setScale(l.r).setDepth(20001).setAlpha(0); });
        S.ambient();
        for (var gl = 0; gl < 26; gl++) { var gx, gy, tries = 0; do { gx = Math.floor(R() * MW); gy = Math.floor(R() * MH); tries++; } while (grid[gy][gx] !== 5 && tries < 200); if (grid[gy][gx] === 5) { var gsp = S.add.image(gx * TS + R() * 12, gy * TS + R() * 12, 'dot').setScale(0.5, 0.25).setAlpha(0).setDepth(1); S.tweens.add({ targets: gsp, alpha: { from: 0, to: 0.8 }, duration: 900 + R() * 900, yoyo: true, repeat: -1, delay: R() * 2000 }); } }
        // input
        S.keys = S.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,E');
        S.input.keyboard.on('keydown-SPACE', function () { S.interact(); }); S.input.keyboard.on('keydown-E', function () { S.interact(); });
        S.joy = { on: false, dx: 0, dy: 0 };
        S.input.on('pointerdown', function (p) {
          var hit = S.pickAt(p.worldX, p.worldY); if (hit) { S.tap(hit); return; }
          if (p.wasTouch || window.matchMedia('(pointer: coarse)').matches) { S.joy = { on: true, id: p.id, x0: p.x, y0: p.y, dx: 0, dy: 0 }; S.showJoy(p.x, p.y, 0, 0); }
        });
        S.input.on('pointermove', function (p) { if (S.joy.on && p.id === S.joy.id) { var dx = p.x - S.joy.x0, dy = p.y - S.joy.y0, d = Math.hypot(dx, dy), m = 46; if (d > m) { dx = dx / d * m; dy = dy / d * m; } S.joy.dx = dx / m; S.joy.dy = dy / m; S.showJoy(S.joy.x0, S.joy.y0, dx, dy); } });
        S.input.on('pointerup', function (p) { if (S.joy.on && p.id === S.joy.id) { S.joy = { on: false, dx: 0, dy: 0 }; S.showJoy(); } });
        // others, notes
        S.syncT = 0; S.lastSync = 0; S.sync(); S.loadNotes();
        S.events.on('shutdown', function () { S.scale.off('resize', S.fitZoom, S); Object.keys(S.labels).forEach(function (k) { S.labels[k].remove(); }); });
        say(w.town.icon + ' ' + w.town.name + ' — ' + (t === 1 ? 'the start of the Silk Road' : 'level ' + w.town.level), 3000);
      },
      fitZoom: function () { var c = this.cameras.main, w = this.scale.width, h = this.scale.height; c.setZoom(Math.max(2, Math.min(4, Math.round(Math.min(w / (TS * 20), h / (TS * 12)) * 2) / 2))); },
      ambient: function () {
        var S = this, a = S.th.amb, cfg = { petals: ['petal', 0xffffff, 1], dust: ['dot', 0xf3d29a, 0.5], snow: ['dot', 0xffffff, 0.6], leaves: ['petal', 0xa3c95a, 0.9], fireflies: ['dot', 0xfff08a, 0.5], birds: ['dot', 0xffffff, 0.45] }[a] || ['dot', 0xffffff, 0.5];
        S.amb = S.add.particles(0, 0, cfg[0], { x: { min: 0, max: 400 }, y: { min: -10, max: 0 }, lifespan: 7000, speedX: a === 'dust' ? { min: 20, max: 40 } : { min: -8, max: 12 }, speedY: a === 'fireflies' ? { min: -6, max: 6 } : { min: 10, max: 22 }, scale: { min: cfg[2] * 0.6, max: cfg[2] }, alpha: { start: 0.9, end: 0 }, tint: cfg[1], frequency: a === 'fireflies' ? 260 : 220, quantity: 1, rotate: a === 'petals' || a === 'leaves' ? { min: 0, max: 360 } : 0, blendMode: a === 'fireflies' ? 'ADD' : 'NORMAL' });
        S.amb.setDepth(19000);
      },
      showJoy: function (x, y, dx, dy) { var j = $('.sg-joy'); if (!j) return; if (x == null) { j.classList.remove('on'); return; } j.classList.add('on'); var r = ROOT.querySelector('.sg-cv').getBoundingClientRect(), k = r.width / this.scale.width; j.style.left = (x * k - 50) + 'px'; j.style.top = (y * k - 50) + 'px'; j.firstChild.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)'; },
      dayLight: function () { var h = new Date().getHours() + new Date().getMinutes() / 60; if (window.SawaGameHour != null) h = window.SawaGameHour; if (h >= 7.5 && h < 17) return [0, 0x000000]; if (h >= 17 && h < 19) return [0.25 + (h - 17) * 0.12, 0x4a2c5e]; if (h >= 5.5 && h < 7.5) return [0.35 - (h - 5.5) * 0.15, 0x4a3a6e]; return [0.58, 0x0c1238]; },
      update: function (time, dt) {
        var S = this, pl = S.pl; if (!pl) return;
        var k = S.keys, vx = 0, vy = 0;
        if (!S.frozen) {
          if (k.LEFT.isDown || k.A.isDown) vx -= 1; if (k.RIGHT.isDown || k.D.isDown) vx += 1; if (k.UP.isDown || k.W.isDown) vy -= 1; if (k.DOWN.isDown || k.S.isDown) vy += 1;
          if (S.joy.on) { vx = S.joy.dx; vy = S.joy.dy; if (Math.hypot(vx, vy) < 0.2) vx = vy = 0; }
        }
        var sp = 82, d = Math.hypot(vx, vy); if (d > 1) { vx /= d; vy /= d; }
        pl.setVelocity(vx * sp, vy * sp);
        if (vx || vy) { pl.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : (vy < 0 ? 3 : 0); pl.anims.play(pl.key + '_w' + pl.dir, true); } else { pl.anims.stop(); pl.setFrame(pl.dir * 3); }
        pl.setDepth(pl.y);
        // exits
        if (pl.x > (MW - 1.6) * TS) S.leave(S.t + 1, 'west'); else if (pl.x < 1.2 * TS && S.t > 1) S.leave(S.t - 1, 'east');
        // monsters wander and chase
        var tired = H.world().stamina.left < 1;
        S.monsters.forEach(function (m) {
          if (!m.active) return;
          var dx = pl.x - m.x, dy = pl.y - m.y, dd = Math.hypot(dx, dy);
          if (!tired && dd < 70 && S.cool < time) m.setVelocity(dx / dd * 34, dy / dd * 34);
          else { if (!m.wt || m.wt < time) { m.wt = time + 1500 + Math.random() * 2500; var a = Math.random() * 7; var back = Math.hypot(m.home.x - m.x, m.home.y - m.y) > 90; m.setVelocity(back ? (m.home.x - m.x) / 4 : Math.cos(a) * 18, back ? (m.home.y - m.y) / 4 : Math.sin(a) * 18); if (Math.random() < 0.4) m.setVelocity(0, 0); } }
          m.setDepth(m.y); m.setAlpha(tired ? 0.6 : 1); m.setFlipX(m.body.velocity.x < 0);
        });
        S.npcs.forEach(function (n) { n.setVelocity(0, 0); });
        // what's near (for the action button)
        var near = null, best = 30;
        S.npcs.forEach(function (n) { var dn = Phaser.Math.Distance.Between(pl.x, pl.y, n.x, n.y); if (dn < best) { best = dn; near = { kind: 'npc', obj: n }; } });
        if (S.board && Phaser.Math.Distance.Between(pl.x, pl.y, S.board.x, S.board.y) < 28) near = { kind: 'board' };
        S.notes.forEach(function (n) { if (Phaser.Math.Distance.Between(pl.x, pl.y, n.spr.x, n.spr.y) < 20) near = { kind: 'note', obj: n }; });
        Object.keys(S.others).forEach(function (id) { var o = S.others[id]; if (Phaser.Math.Distance.Between(pl.x, pl.y, o.spr.x, o.spr.y) < 24) near = { kind: 'player', obj: o }; });
        if ((near && near.kind) !== (S.near && S.near.kind) || (near && S.near && near.obj !== S.near.obj)) { S.near = near; var ab = $('.sg-act'); if (ab) { ab.classList.toggle('on', !!near); ab.textContent = !near ? '' : (TOUCH ? '' : 'E · ') + (near.kind === 'npc' ? 'Talk' : near.kind === 'board' ? 'Read' : near.kind === 'note' ? 'Read note' : 'Meet'); } }
        // others glide to their last position
        Object.keys(S.others).forEach(function (id) { var o = S.others[id], s = o.spr; var dx = o.tx - s.x, dy = o.ty - s.y, dd = Math.hypot(dx, dy); if (dd > 1) { var st = Math.min(dd, 1.4 * dt / 16); s.x += dx / dd * st; s.y += dy / dd * st; var dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); s.anims.play(s.texture.key + '_w' + dir, true); } else { s.anims.stop(); s.setFrame(o.d * 3); } s.setDepth(s.y); });
        // light and dark
        var cam = S.cameras.main, v = cam.worldView, dl = S.dayLight();
        S.paintDark(dl, v, cam.zoom, time);
        if (S.amb) S.amb.setPosition(v.x, v.y);
        // labels over characters (HTML)
        S.paintLabels();
        // sync with the server: every 3 s with others around, every 8 s alone
        if (time - S.lastSync > (Object.keys(S.others).some(function (id) { return S.others[id].live; }) ? 3000 : 8000)) { S.lastSync = time; S.sync(); }
      },
      paintDark: function (dl, v, z, time) {
        var S = this, c = S.darkC; if (!c) return;
        var w = c.clientWidth, h = c.clientHeight; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        var g = c.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
        if (dl[0] <= 0) { S.glows.forEach(function (gl) { gl.setAlpha(0); }); return; }
        var k = w / S.scale.width, col = dl[1], flick = 0.92 + Math.sin(time / 130) * 0.04;
        g.fillStyle = 'rgba(' + (col >> 16 & 255) + ',' + (col >> 8 & 255) + ',' + (col & 255) + ',' + dl[0] + ')'; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'destination-out';
        function hole(x, y, rad) { var sx = (x - v.x) * z * k, sy = (y - v.y) * z * k, sr = rad * z * k; if (sx < -sr || sy < -sr || sx > w + sr || sy > h + sr) return; var gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
        S.lights.forEach(function (l, i) { hole(l.x, l.y, 64 * l.r * 1.6 * flick); S.glows[i].setAlpha(dl[0] * 0.8 * flick); S.glows[i].setScale(l.r * flick); });
        hole(S.pl.x, S.pl.y - 12, 70);
        g.globalCompositeOperation = 'source-over';
      },
      pickAt: function (x, y) {
        var S = this, hit = null;
        Object.keys(S.others).forEach(function (id) { var s = S.others[id].spr; if (Math.abs(x - s.x) < 10 && y < s.y + 2 && y > s.y - 26) hit = { kind: 'player', obj: S.others[id] }; });
        S.npcs.forEach(function (n) { if (Math.abs(x - n.x) < 10 && y < n.y + 2 && y > n.y - 26 && Phaser.Math.Distance.Between(S.pl.x, S.pl.y, n.x, n.y) < 60) hit = { kind: 'npc', obj: n }; });
        S.notes.forEach(function (n) { if (Math.abs(x - n.spr.x) < 9 && Math.abs(y - n.spr.y + 6) < 10) hit = { kind: 'note', obj: n }; });
        return hit;
      },
      tap: function (hit) { this.near = hit; this.interact(); },
      interact: function () {
        var S = this, n = S.near; if (!n || S.frozen) return;
        if (n.kind === 'board') return H.panel('quests');
        if (n.kind === 'note') return S.readNote(n.obj);
        if (n.kind === 'player') return S.meet(n.obj);
        var w = H.world(), id = n.obj.npc, L = NPC[id];
        if (id === 'elder') {
          var st = w.story, cur = st.filter(function (s) { return s.state !== 'done'; })[0];
          if (!cur) return dialog(L[0], 'You defeated the beast of ' + w.town.name + '. The road is open — go on to the next town, brave one!', [], L[1]);
          var txt = cur.state === 'claim' ? 'Well done! You finished: "' + cur.text + '". Take your reward.' : 'Your task: ' + cur.text + '. (' + cur.count + ' of ' + cur.n + ')';
          var btns = cur.state === 'claim' ? [{ label: 'Take the reward', primary: true, run: function () { H.api('/world/claim', { method: 'POST', body: { quest: 'story' } }).then(function (j) { H.setWorld(j.world); hud(); say('+' + j.got.coins + ' 🪙' + (j.got.elixirs ? ' +' + j.got.elixirs + ' ⚗' : '')); S.interact(); }, function (x) { say(x.message); }); } }]
            : cur.go && cur.go !== 'map' ? [{ label: 'Show me where', primary: true, run: function () { H.go(cur.go); } }] : [];
          return dialog(L[0], L[2] + ' ' + txt, btns.concat([{ label: 'All quests', run: function () { H.panel('quests'); } }]), L[1]);
        }
        if (id === 'inn') return dialog(L[0], L[2], [{ label: 'Review my cards', primary: true, run: function () { H.go('review'); } }, { label: 'Today\'s plan', run: function () { H.go('today'); } }], L[1]);
        if (id === 'smith') return H.stage() >= 4 ? dialog(L[0], L[2], [{ label: 'Open the forge', primary: true, run: function () { H.panel('forge'); } }], L[1]) : dialog(L[0], 'Come back when you are ready to carry a weapon. (Jobs and gear open at stage 4.)', [], L[1]);
        if (id === 'crier') return dialog(L[0], L[2], [{ label: 'Say something', primary: true, run: function () { S.chat(); } }, { label: 'Open the town chat', run: function () { H.room(w.town.room); } }], L[1]);
        if (id === 'guard') return dialog(L[0], L[2] + ' Speak with Elder Wen to learn how.', [], L[1]);
      },
      encounter: function (mo) {
        var S = this, now = S.time.now; if (S.frozen || S.cool > now) return;
        var w = H.world();
        if (w.stamina.left < 1) { S.cool = now + 4000; S.pl.setVelocity(0); say('You are too tired to fight. Every step of today\'s plan gives you one more fight.'); return; }
        if (!w.ready) { S.cool = now + 4000; say('Battles open soon.'); return; }
        S.cool = now + 99999; S.frozen = true; S.fighting = mo;
        S.cameras.main.flash(250, 255, 255, 255); S.cameras.main.shake(200, 0.004);
        S.time.delayedCall(260, function () { G.battle('/world/fight', { kind: 'monster', m: mo.m }, mo); });
      },
      bossTouch: function () {
        var S = this, w = H.world(), b = w.town.boss; if (S.frozen || S.cool > S.time.now) return; S.cool = S.time.now + 2500;
        if (!b.ready) return dialog(b.name, 'The ' + b.name + ' looks down at you. You are not ready. (Finish Elder Wen\'s tasks first.)', [], b.icon);
        if (!b.tries) return dialog(b.name, 'The ' + b.name + ' is resting. Come back tomorrow.', [], b.icon);
        dialog(b.name, 'The ' + b.name + ' rises! 6 questions at ' + w.town.level + ' level. You need about 5 right. ' + b.tries + ' tries left today.', [{ label: 'Fight!', primary: true, run: function () { S.frozen = true; G.battle('/world/fight', { kind: 'boss' }, S.boss); } }], b.icon);
      },
      afterBattle: function (r) {
        var S = this; S.frozen = false; S.cool = S.time.now + 2200;
        if (r && r.won && S.fighting) { var m = S.fighting; S.tweens.add({ targets: m, alpha: 0, scale: 1.6, duration: 300, onComplete: function () { m.disableBody(true, true); S.time.delayedCall(25000, function () { if (m.scene) m.enableBody(true, m.home.x, m.home.y, true, true).setAlpha(1).setScale(1); }); } }); }
        S.fighting = null; hud();
        if (r && r.kind === 'boss' && r.won) S.time.delayedCall(600, function () { S.scene.restart({ spawn: 'east' }); });
      },
      leave: function (to, spawn) {
        var S = this, w = H.world(); if (S.leaving) return;
        if (to > w.reached) { S.pl.x -= 8; return say('The road ahead is closed. Defeat the ' + w.town.boss.name + ' first.'); }
        S.leaving = true; S.cameras.main.fadeOut(300);
        H.api('/world/travel', { method: 'POST', body: { town: to } }).then(function (j) { H.setWorld(j); hud(); S.scene.restart({ spawn: spawn }); S.leaving = false; }, function (x) { S.leaving = false; S.cameras.main.fadeIn(200); say(x.message); });
      },
      // ---------------------------------------------------------- others (live and echoes)
      sync: function () {
        var S = this; if (S.syncing) return; S.syncing = true;
        H.api('/play/sync', { method: 'POST', body: { x: Math.round(S.pl.x), y: Math.round(S.pl.y), d: S.pl.dir } }).then(function (j) {
          S.syncing = false; if (!running || !S.scene || !S.sys || !S.pl || !S.pl.active) return; // left or restarted meanwhile
          var seen = {};
          j.live.concat(j.echoes).forEach(function (p) {
            seen[p.id] = 1; var o = S.others[p.id], live = p.ago <= 60;
            if (!o) { var key = ensureChar(S, p); var s = S.add.sprite(p.x, p.y, key, p.d * 3).setOrigin(0.5, 1); o = S.others[p.id] = { spr: s }; }
            o.p = p; o.live = live; o.tx = p.x; o.ty = p.y; o.d = p.d; o.spr.setAlpha(live ? 1 : 0.55);
            if (!live) { o.spr.x = p.x; o.spr.y = p.y; }
            if (p.emote) o.emote = { e: p.emote, until: Date.now() + 5000 };
          });
          Object.keys(S.others).forEach(function (id) { if (!seen[id]) { S.others[id].spr.destroy(); delete S.others[id]; } });
          j.bubbles.forEach(function (b) { if (S.seenB && S.seenB[b.id]) return; S.seenB = S.seenB || {}; S.seenB[b.id] = 1; var o = b.user === H.me().id ? { me: true } : S.others[b.user]; if (o) (o.me ? S : o).bubble = { text: b.text, until: Date.now() + 7000 }; });
          var n = j.live.length; var c = $('.sg-online'); if (c) c.textContent = n ? n + ' online here' : (j.echoes.length ? j.echoes.length + (j.echoes.length === 1 ? ' traveller was' : ' travellers were') + ' here today' : 'Only you here right now');
        }, function () { S.syncing = false; });
      },
      paintLabels: function () {
        var S = this, cam = S.cameras.main, v = cam.worldView, z = cam.zoom, lay = $('.sg-labels'); if (!lay) return;
        var r = ROOT.querySelector('.sg-cv').getBoundingClientRect(), k = r.width / S.scale.width, keep = {};
        function tag(id, x, y, html, cls) { keep[id] = 1; var e = S.labels[id]; if (!e) { e = S.labels[id] = el('div', 'sg-lb'); lay.appendChild(e); } if (e._h !== html) { e.innerHTML = '<div class="in">' + html + '</div>'; e._h = html; } e.className = 'sg-lb ' + (cls || ''); e.style.transform = 'translate(' + Math.round((x - v.x) * z * k) + 'px,' + Math.round((y - v.y) * z * k) + 'px)'; }
        var now = Date.now(), me = H.me();
        Object.keys(S.others).forEach(function (id) { var o = S.others[id], p = o.p, s = o.spr; var ago = p.ago > 60 ? (p.ago < 3600 ? Math.round(p.ago / 60) + ' min ago' : Math.round(p.ago / 3600) + ' h ago') : ''; tag('o' + id, s.x, s.y - 27, '<span class="nm' + (p.wanted ? ' wanted' : '') + '">' + (p.wanted ? '⚠ ' : '') + esc(p.name.split(' ')[0]) + '</span>' + (ago ? '<small>' + ago + '</small>' : ''), o.live ? '' : 'echo'); if (o.bubble && o.bubble.until > now) tag('b' + id, s.x, s.y - 40, '<span class="bub">' + esc(o.bubble.text) + '</span>', 'bubble'); if (o.emote && o.emote.until > now) tag('e' + id, s.x, s.y - 34, '<span class="emo">' + EMO[o.emote.e] + '</span>', 'bubble'); });
        tag('me', S.pl.x, S.pl.y - 27, '<span class="nm me">' + esc(me.name.split(' ')[0]) + '</span>');
        if (S.bubble && S.bubble.until > now) tag('bme', S.pl.x, S.pl.y - 40, '<span class="bub">' + esc(S.bubble.text) + '</span>', 'bubble');
        if (S.emote && S.emote.until > now) tag('eme', S.pl.x, S.pl.y - 34, '<span class="emo">' + EMO[S.emote.e] + '</span>', 'bubble');
        S.npcs.forEach(function (n) { tag('n' + n.npc, n.x, n.y - 27, '<span class="nm npc">' + esc(NPC[n.npc][0]) + '</span>'); });
        if (S.boss) tag('boss', S.boss.x, S.boss.y - 52, '<span class="nm boss">' + esc(H.world().town.boss.name) + '</span>');
        S.notes.forEach(function (n) { if (Phaser.Math.Distance.Between(S.pl.x, S.pl.y, n.spr.x, n.spr.y) < 80) tag('t' + n.id, n.spr.x, n.spr.y - 18, '<span class="nt">✍ ' + esc(n.by.split(' ')[0]) + '</span>'); });
        Object.keys(S.labels).forEach(function (id) { if (!keep[id]) { S.labels[id].remove(); delete S.labels[id]; } });
      },
      meet: function (o) {
        var S = this, p = o.p;
        H.api('/play/profile', { query: { user: p.id } }).then(function (pr) {
          var job = { thief: '🗡 Thief', hunter: '🏹 Hunter', trader: '🐪 Trader' }[pr.job] || 'Traveller', btns = [];
          btns.push({ label: '👋 Wave', run: function () { G.emote('wave'); } });
          if (pr.duelsLeft > 0) btns.push({ label: '⚔ Duel their shadow', primary: true, run: function () { S.frozen = true; G.battle('/play/duel', { user: p.id }, null); } });
          if (H.stage() >= 5 && !pr.party) btns.push({ label: '+ Invite to party', run: function () { H.api('/party/invite', { method: 'POST', body: { user: p.id } }).then(function () { say('Invitation sent to ' + pr.name.split(' ')[0]); }, function (x) { say(x.message); }); } });
          var my = H.world().job;
          if (H.stage() >= 4 && my === 'thief' && pr.job !== 'thief' && !pr.clan) btns.push({ label: '🗡 Raid', run: function () { H.raid(p.id); } });
          if (H.stage() >= 4 && my === 'hunter' && p.wanted) btns.push({ label: '🏹 Hunt this thief', run: function () { H.wanted(); } });
          var mins = Math.max(1, Math.round(p.ago / 60)), hrs = Math.max(1, Math.round(p.ago / 3600)), when = p.ago <= 60 ? 'is here now' : 'was here ' + (p.ago < 3600 ? mins + (mins === 1 ? ' minute' : ' minutes') : hrs + (hrs === 1 ? ' hour' : ' hours')) + ' ago';
          dialog(pr.name, pr.name.split(' ')[0] + ' ' + when + '. ' + job + ' · ' + pr.level + (pr.title ? ' · ' + pr.title : '') + (pr.accuracy != null ? ' · battles: ' + pr.accuracy + '% right' : '') + (p.wanted ? ' · ⚠ wanted for theft' : '') + (p.ago > 60 ? '. You can still duel their shadow — it fights like they do.' : '.'), btns, pr.photo ? '<img src="' + esc(pr.photo) + '" alt="">' : '🙂');
        }, function (x) { say(x.message); });
      },
      // ---------------------------------------------------------- notes
      loadNotes: function () { var S = this; H.api('/play/notes').then(function (j) { if (running && S.sys && S.pl && S.pl.active) S.setNotes(j.notes); }, function () {}); },
      setNotes: function (list) {
        var S = this; S.notes.forEach(function (n) { n.spr.destroy(); }); var key = 'note' + S.t; if (!S.textures.exists(key)) addTex(S, key, drawProp('note', S.th));
        S.notes = list.map(function (n) { var s = S.add.image(n.x, n.y, key).setOrigin(0.5, 1).setDepth(n.y); S.tweens.add({ targets: s, y: n.y - 2, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); return { id: n.id, spr: s, n: n, by: n.by }; });
      },
      readNote: function (o) {
        var S = this, n = o.n, btns = [];
        if (!n.mine && !n.liked) btns.push({ label: '👍 Helpful', primary: true, run: function () { H.api('/play/notes/like', { method: 'POST', body: { id: n.id } }).then(function (j) { S.setNotes(j.notes); say('Thanks! ' + n.by.split(' ')[0] + ' gets 2 coins.'); }, function (x) { say(x.message); }); } });
        if (n.mine) btns.push({ label: 'Remove my note', run: function () { H.api('/play/notes/delete', { method: 'POST', body: { id: n.id } }).then(function (j) { S.setNotes(j.notes); }, function (x) { say(x.message); }); } });
        dialog('A note from ' + n.by, '"' + n.text + '"' + (n.likes ? '  — ' + n.likes + ' found this helpful' : ''), btns, '✍');
      },
      writeNote: function () {
        var S = this;
        inputBox('Leave a note here for other travellers (English, 3+ words)', 'Tip: the scorpion asks about past tense!', function (v, err, done) {
          if (/[؀-ۿ]/.test(v)) return err('Notes are in English. Use the Chat tab if you want help translating.');
          H.api('/play/notes', { method: 'POST', body: { text: v, x: Math.round(S.pl.x), y: Math.round(S.pl.y) } }).then(function (j) { done(); S.setNotes(j.notes); say('Your note is on the map. Travellers will find it later.'); }, function (x) { err(x.message); });
        });
      },
      chat: function () {
        var S = this, room = H.world().town.room;
        inputBox('Say something to ' + H.world().town.name + ' (English)', 'Hello! Where are you from?', function (v, err, done) {
          if (/[؀-ۿ]/.test(v)) return err('Write in English here. In the Chat tab you can write Arabic and get it translated.');
          H.api('/chat/rooms/' + room + '/messages', { method: 'POST', body: { body: v } }).then(function () { done(); S.bubble = { text: v, until: Date.now() + 7000 }; }, function (x) { err(x.message); });
        });
      }
    });
    var EMO = { wave: '👋', cheer: '🎉', clap: '👏', heart: '❤️', laugh: '😂', bow: '🙇' };

    return [World];
  }

  /* ================================================================ the battle arena (its own layer, Sea of Stars–style)
     Drawn with the same pixel art on plain canvases over the paused town, so the town never has to be torn down. */
  function frameCanvas(sheet, fx, fw, fh) { var c = cnv(fw, fh); c.getContext('2d').drawImage(sheet, fx, 0, fw, fh, 0, 0, fw, fh); return c; }
  function Arena(b) {
    var th = THEMES[H.world().at] || THEMES[1], A = this, f = b.foe;
    A.b = b; A.hp = f.hp; A.dmg = 0;
    var bg = cnv(160, 90), g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 60), RB = rng(7);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 160, 90);
    g.fillStyle = tone(th.hills, -0.1); for (var x = 0; x < 160; x++) g.fillRect(x, 44 + Math.sin(x / 9) * 5 + Math.sin(x / 3.7) * 2, 1, 90);
    g.fillStyle = th.hills; for (var x2 = 0; x2 < 160; x2++) g.fillRect(x2, 52 + Math.sin(x2 / 13 + 2) * 4, 1, 90);
    g.fillStyle = th.ground[0]; g.fillRect(0, 60, 160, 30); g.fillStyle = th.ground[2]; for (var i = 0; i < 60; i++) g.fillRect(RB() * 160, 60 + RB() * 30, 2, 1);
    g.fillStyle = th.path; g.beginPath(); g.ellipse(80, 76, 70, 9, 0, 0, 7); g.fill();
    var night = G.phaser.scene.getScene('World').dayLight()[0];
    A.el = el('div', 'sg-arena');
    A.el.appendChild(bg); bg.className = 'sg-abg';
    if (night > 0.3) A.el.appendChild(el('div', 'sg-anight'));
    var me = H.avatar(), hero = frameCanvas(drawChar(me), 2 * 3 * 16, 16, 24); hero.className = 'sg-hero';
    var foe;
    if (f.shadow && f.avatar) { foe = frameCanvas(drawChar(f.avatar), 1 * 3 * 16, 16, 24); foe.className = 'sg-foe shadow'; }
    else {
      var size = f.boss || b.kind === 'pboss' ? 40 : 24, sheet = drawMonster(f.name, size);
      foe = frameCanvas(sheet, 0, size, size); foe.className = 'sg-foe' + (size === 40 ? ' big' : '');
      var f2 = frameCanvas(sheet, size, size, size), k = 0;
      A.anim = setInterval(function () { k = 1 - k; foe.getContext('2d').clearRect(0, 0, size, size); foe.getContext('2d').drawImage(k ? f2 : frameCanvas(sheet, 0, size, size), 0, 0); }, 420);
    }
    A.hero = hero; A.foe = foe;
    A.el.appendChild(el('div', 'sg-ashadow h')); A.el.appendChild(el('div', 'sg-ashadow f'));
    A.el.appendChild(hero); A.el.appendChild(foe);
    ROOT.insertBefore(A.el, ROOT.querySelector('.sg-top'));
    requestAnimationFrame(function () { A.el.classList.add('on'); });
  }
  Arena.prototype.anim1 = function (node, kf, ms) { try { return node.animate(kf, { duration: ms, easing: 'ease-out' }); } catch (e) { return null; } };
  Arena.prototype.pop = function (node, txt, cls) { var r = node.getBoundingClientRect(), a = this.el.getBoundingClientRect(), p = el('span', 'sg-pop ' + (cls || ''), esc(txt)); p.style.left = (r.left - a.left + r.width / 2) + 'px'; p.style.top = (r.top - a.top) + 'px'; this.el.appendChild(p); setTimeout(function () { p.remove(); }, 1000); };
  Arena.prototype.hit = function (ok, per) {
    var A = this;
    if (ok) {
      A.anim1(A.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(28vw)' }, { transform: 'translateX(0)' }], 360);
      setTimeout(function () {
        A.foe.classList.add('flash'); setTimeout(function () { A.foe.classList.remove('flash'); }, 120);
        A.anim1(A.el, [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], 180);
        var s = el('div', 'sg-slash'); var r = A.foe.getBoundingClientRect(), a = A.el.getBoundingClientRect(); s.style.left = (r.left - a.left + r.width / 2) + 'px'; s.style.top = (r.top - a.top + r.height / 2) + 'px'; A.el.appendChild(s); setTimeout(function () { s.remove(); }, 400);
        A.pop(A.foe, '-' + per, 'dmg');
      }, 170);
    } else {
      A.anim1(A.foe, [{ transform: 'none' }, { transform: 'translateX(-28vw)' }, { transform: 'none' }], 380);
      setTimeout(function () {
        A.hero.classList.add('hurt'); setTimeout(function () { A.hero.classList.remove('hurt'); }, 160);
        A.anim1(A.el, [{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,3px)' }, { transform: 'translate(7px,-3px)' }, { transform: 'translate(0,0)' }], 260);
        A.pop(A.hero, 'Miss', 'miss');
      }, 190);
    }
  };
  Arena.prototype.finish = function (won) { (won ? this.foe : this.hero).classList.add(won ? 'gone' : 'down'); };
  Arena.prototype.close = function () { clearInterval(this.anim); var e = this.el; e.classList.remove('on'); setTimeout(function () { e.remove(); }, 250); };

  /* ================================================================ battle UI (HTML) and flow */
  var GAME = {
    battle: function (path, body, monster) {
      var world = G.phaser.scene.getScene('World');
      H.api(path, { method: 'POST', body: body || {} }).then(function (b) {
        world.scene.pause(); $('.sg-labels').style.visibility = 'hidden'; GAME.battleUI(b, new Arena(b));
      }, function (x) { world.frozen = false; world.cool = world.time.now + 2500; say(x.message, 4500); });
    },
    battleUI: function (b, scene) {
      var box = $('.sg-battle'), n = b.questions.length, i = 0, timer = null, right = 0, per = 20;
      box.classList.add('on');
      function head() { var left = Math.max(0, scene.hp - scene.dmg); return '<div class="sg-bh"><b>' + esc(b.foe.icon) + ' ' + esc(b.foe.name) + '</b><span>❤ ' + left + ' / ' + scene.hp + '</span></div><div class="sg-hpb"><i style="width:' + Math.max(0, left / scene.hp * 100) + '%"></i></div>'; }
      function q() {
        clearInterval(timer);
        if (i >= n) return end();
        var it = b.questions[i], left = b.seconds;
        box.innerHTML = '<div class="sg-bp">' + head() + '<div class="sg-tm"><i></i></div><div class="sg-qn"><small>' + (i + 1) + ' / ' + n + (it.point ? ' · ' + esc(it.point) : '') + '</small><p>' + esc(it.q).replace(/_{2,}/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>') + '</p>' + (it.src ? '<small class="src">from ' + esc(it.src) + '</small>' : '') + '</div><div class="sg-ops">' + it.options.map(function (o, k) { return '<button data-k="' + k + '"><span>' + 'ABCD'[k] + '</span>' + esc(o) + '</button>'; }).join('') + '</div></div>';
        var bar = box.querySelector('.sg-tm i');
        box.querySelectorAll('[data-k]').forEach(function (btn) { btn.onclick = function () { pick(+btn.dataset.k, btn); }; });
        timer = setInterval(function () { left -= 0.1; bar.style.width = Math.max(0, left / b.seconds * 100) + '%'; if (left <= 0) pick(-1, null); }, 100);
        G.keyPick = function (k) { var bt = box.querySelector('[data-k="' + k + '"]'); if (bt) pick(k, bt); };
      }
      function pick(k, btn) {
        clearInterval(timer); G.keyPick = null; box.querySelectorAll('[data-k]').forEach(function (x) { x.disabled = true; });
        H.api('/world/step', { method: 'POST', body: { battle: b.battle, i: i, choice: k } }).then(function (r) {
          per = r.per || per;
          if (btn) btn.classList.add(r.correct ? 'ok' : 'no');
          if (!r.correct) box.querySelectorAll('[data-k]').forEach(function (x) { if (x.textContent.slice(1) === r.right) x.classList.add('ok'); });
          if (r.correct) { right++; scene.dmg += per; }
          scene.hit(r.correct, per);
          var head2 = box.querySelector('.sg-bh'); if (head2) { var tmp = el('div', '', head()); box.querySelector('.sg-bh').replaceWith(tmp.firstChild); box.querySelector('.sg-hpb').replaceWith(tmp.lastChild); }
          if (!r.correct) { var fb = el('div', 'sg-fb', '✗ <b>' + esc(r.right) + '</b>' + (r.why ? ' — ' + esc(r.why) : '')); box.querySelector('.sg-bp').appendChild(fb); }
          i++; setTimeout(q, r.correct ? 900 : 2300);
        }, function (x) { say(x.message); i++; setTimeout(q, 600); });
      }
      function end() {
        box.innerHTML = '<div class="sg-bp"><p class="sg-wait">…</p></div>';
        H.api('/world/answer', { method: 'POST', body: { battle: b.battle } }).then(function (r) {
          if (r.world) H.setWorld(r.world);
          scene.finish(r.won);
          var pb = r.kind === 'pboss', duel = r.kind === 'duel';
          var title = pb ? (r.won ? '🏆 The party boss is down!' : '💥 ' + r.damage + ' damage to the party boss') : duel ? (r.won ? '🏆 You beat the shadow!' : '💨 The shadow was stronger') : r.won ? (r.foe.boss ? '🏆 ' + esc(r.foe.name) + ' defeated!' : '⚔ Victory!') : '💨 The ' + esc(r.foe.name) + ' was too strong';
          var gains = (r.coins ? '+' + r.coins + ' 🪙 ' : '') + (r.elixirs ? '+' + r.elixirs + ' ⚗' : '');
          box.innerHTML = '<div class="sg-bp sg-res"><h3>' + title + '</h3><p>' + r.right + ' of ' + r.total + ' right · attack ' + r.attack + (pb ? '' : ' vs ' + (duel ? r.shadow : r.foe.hp)) + '</p>'
            + (gains ? '<p class="sg-gain">' + gains + '</p>' : '') + (r.title ? '<p>🏅 New title: <b>' + esc(r.title) + '</b>' + (r.next ? '<br>The road to <b>' + esc(r.next) + '</b> is open!' : '') + '</p>' : '')
            + (r.missedWords ? '<p class="small">📇 ' + r.missedWords + ' word' + (r.missedWords > 1 ? 's' : '') + ' you missed will come back in your review cards today.</p>' : '')
            + '<button class="pri" data-x="1">Continue</button></div>';
          box.querySelector('[data-x]').onclick = function () { close(r); };
          G.keyPick = function () { close(r); };
        }, function (x) { say(x.message); close(null); });
      }
      function close(r) {
        G.keyPick = null; box.classList.remove('on'); box.innerHTML = '';
        if (close.done) return; close.done = true;
        var world = G.phaser.scene.getScene('World'); scene.close(); world.scene.resume();
        if (GAME.needRebuild) { GAME.needRebuild = false; setTimeout(rebuild, 300); } $('.sg-labels').style.visibility = ''; world.afterBattle(r);
        if (r && r.kind === 'pboss') H.refreshParty();
      }
      q();
    },
    emote: function (e) { var w = G.phaser.scene.getScene('World'); w.emote = { e: e, until: Date.now() + 5000 }; H.api('/play/emote', { method: 'POST', body: { e: e } }).catch(function () {}); },
    look: function (first) {
      var L = Object.assign({}, H.avatar().look), d = $('.sg-dlg');
      function prev() { var c = drawChar({ look: L, job: H.world().job }), p = d.querySelector('canvas'), g = p.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 144); g.drawImage(c, 0, 0, 16, 24, 0, 0, 96, 144); }
      var rows = [['skin', 'Skin', 5], ['hair', 'Hair', 4], ['hairc', 'Hair colour', 6], ['outfit', 'Clothes', 6]];
      d.innerHTML = '<div class="sg-box sg-look"><canvas width="96" height="144"></canvas><div class="sg-txt"><b>' + (first ? 'Create your traveller' : 'Your look') + '</b><p>' + (first ? 'This is you on the Silk Road. Your job and the gear you earn will show on you too.' : 'Change how you look.') + '</p>'
        + rows.map(function (r) { return '<div class="sg-lr"><span>' + r[1] + '</span><button data-l="' + r[0] + '" data-v="-1" aria-label="Previous">‹</button><button data-l="' + r[0] + '" data-v="1" aria-label="Next">›</button></div>'; }).join('')
        + '<div class="sg-opts"><button class="pri" data-o="save">Start my journey</button></div></div></div>';
      d.classList.add('on'); prev();
      d.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { var r = rows.filter(function (x) { return x[0] === b.dataset.l; })[0]; L[r[0]] = ((L[r[0]] || 0) + +b.dataset.v + r[2]) % r[2]; prev(); }; });
      d.querySelector('[data-o="save"]').onclick = function () { H.api('/play/look', { method: 'POST', body: L }).then(function (j) { H.setLook(j.look); d.classList.remove('on'); d.innerHTML = ''; var w = G.phaser.scene.getScene('World'); w.scene.restart({}); if (first) setTimeout(GAME.welcome, 900); }, function (x) { say(x.message); }); };
    },
    welcome: function () {
      var steps = [
        (TOUCH ? 'Drag your thumb anywhere on the map to walk.' : 'Walk with the arrow keys or W A S D.') + ' ' + (TOUCH ? 'Tap the red button' : 'Press E') + ' to talk to people and read signs.',
        'Monsters live on the road east of town. Walk into one to fight it with your English: your own words, your mistakes and your weakest grammar.',
        'Other students walk here too. If they studied earlier today, you still see their echo — tap it to duel their shadow or invite them.',
        'Leave short English notes for the next traveller ✍, and talk to Elder Wen for your next task. Have a good journey!'
      ];
      (function show(i) { if (i >= steps.length) return; dialog('Elder Wen', steps[i], [{ label: i + 1 < steps.length ? 'Next' : 'Let\'s go!', primary: true, run: function () { show(i + 1); } }], '👴'); })(0);
    },
    menu: function (k) {
      var w = G.phaser.scene.getScene('World');
      if (k === 'exit') return window.SawaGame.stop(true);
      if (k === 'list') return window.SawaGame.stop(true, 'list');
      if (k === 'quests' || k === 'party' || k === 'help') return H.panel(k);
      if (k === 'chat') return w.chat();
      if (k === 'note') return w.writeNote();
      if (k === 'emote') { return dialog('Emote', 'Show how you feel. Everyone here sees it for a few seconds.', Object.keys(EMO_LIST).map(function (e) { return { label: EMO_LIST[e] + ' ' + e, run: function () { GAME.emote(e); } }; }).concat([{ label: '🎨 Change my look', run: function () { GAME.look(false); } }]), '🙂'); }
      if (k === 'map') {
        var wd = H.world();
        return dialog('The Silk Road', 'Travel to any town you have opened. Walk out of the east gate to go further — after its boss falls.', wd.towns.filter(function (t) { return t.open && t.id !== wd.at; }).map(function (t) { return { label: t.icon + ' ' + t.name + ' (' + t.level + ')', run: function () { w.leave(t.id, 'center'); } }; }), '🗺');
      }
    }
  };
  var EMO_LIST = { wave: '👋', cheer: '🎉', clap: '👏', heart: '❤️', laugh: '😂', bow: '🙇' };

  /* ================================================================ start / stop */
  window.SawaGame = {
    running: function () { return running; },
    start: function (mount, hooks) {
      if (running) return Promise.resolve();
      H = hooks; running = true;
      ROOT = el('div', 'sg-root');
      ROOT.innerHTML = '<div class="sg-cv"></div><canvas class="sg-dark"></canvas><div class="sg-labels"></div><div class="sg-top"></div><div class="sg-online"></div><div class="sg-menu"></div><div class="sg-hint"></div><div class="sg-joy"><i></i></div><button class="sg-act"></button><div class="sg-battle"></div><div class="sg-dlg"></div><div class="sg-load"><p>Loading the Silk Road…</p></div>';
      mount.appendChild(ROOT);
      ROOT.addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (b) GAME.menu(b.dataset.g); });
      ROOT.querySelector('.sg-act').onclick = function () { var w = G && G.phaser.scene.getScene('World'); if (w) w.interact(); };
      G = GAME;
      G.keys = function (e) { if (!running) return; if (G.keyPick && /^[1-4]$/.test(e.key)) { G.keyPick(+e.key - 1); e.preventDefault(); } else if (G.keyPick && e.key === 'Enter' && $('.sg-res')) G.keyPick(); };
      window.addEventListener('keydown', G.keys);
      return loadPhaser().then(function () {
        var P = window.Phaser, cv = ROOT.querySelector('.sg-cv');
        GAME.phaser = new P.Game({ type: P.AUTO, parent: cv, pixelArt: true, roundPixels: true, backgroundColor: '#1e1620', scale: { mode: P.Scale.RESIZE, width: cv.clientWidth || 800, height: cv.clientHeight || 600 }, physics: { default: 'arcade', arcade: { debug: false } }, input: { keyboard: { target: window } }, scene: makeScenes(P), banner: false, audio: { noAudio: true } });
        var restored = function () { clearTimeout(GAME.rt); GAME.rt = setTimeout(rebuild, 80); };
        GAME.phaser.events.on('contextrestored', restored);
        GAME.phaser.events.once('ready', function () { if (GAME.phaser.renderer && GAME.phaser.renderer.on) GAME.phaser.renderer.on('restorewebgl', restored); var l = ROOT.querySelector('.sg-load'); if (l) l.remove(); hud(); if (!H.avatar().look.set) setTimeout(function () { GAME.look(true); }, 400); });
      }, function (x) { ROOT.querySelector('.sg-load').innerHTML = '<p>' + esc(x.message) + '</p><button data-g="list">Use the list view</button>'; });
    },
    stop: function (back, mode) {
      if (!running) return; running = false;
      window.removeEventListener('keydown', G.keys);
      try { if (GAME.phaser) GAME.phaser.destroy(true); } catch (e) { /* already gone */ }
      if (ROOT) ROOT.remove(); ROOT = null; GAME.phaser = null;
      if (back && H) H.exit(mode);
    },
    battle: function (path, body) { if (!running) return false; var w = GAME.phaser.scene.getScene('World'); w.frozen = true; GAME.battle(path, body, null); return true; },
    hud: function () { if (running) hud(); },
    scene: function () { return GAME.phaser && GAME.phaser.scene.getScene('World'); } // for tests
  };
})();
