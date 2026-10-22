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
  /** The caravanserai the whole community builds this week, drawn at its stage (0–4). */
  function drawSerai(th, stage) {
    var c = cnv(64, 52), g = c.getContext('2d'), out = '#1e1620', wall = th.wall || '#c4864f', body = th.bodyC || '#e9dcc0', roof = th.roofC || '#b85a36', wood = '#8a5a32';
    ell(g, 32, 49, 30, 3, 'rgba(0,0,0,.25)');
    if (stage === 0) { for (var i = 0; i < 7; i++) { px(g, 6 + i * 8, 42 + (i % 2) * 2, out, 7, 5); px(g, 7 + i * 8, 43 + (i % 2) * 2, '#a89574', 5, 3); } px(g, 28, 30, wood, 2, 14); px(g, 22, 26, '#f6ecd4', 14, 6); px(g, 23, 27, '#e2513a', 12, 1); return c; }
    var h = [0, 10, 20, 26, 26][stage];
    px(g, 4, 47 - h, out, 56, h + 2); px(g, 5, 48 - h, body, 54, h); for (var y = 48 - h; y < 48; y += 4) px(g, 5, y, wall, 54, 1);
    if (stage >= 2) { px(g, 26, 34, out, 12, 14); px(g, 27, 35, '#5b3a22', 10, 13); }
    if (stage === 2) { for (var x = 4; x <= 58; x += 9) px(g, x, 12, wood, 2, 36); px(g, 4, 18, wood, 56, 2); px(g, 4, 30, wood, 56, 2); }
    if (stage >= 3) { px(g, 2, 20, out, 60, 4); px(g, 3, 21, roof, 58, 2); for (var k = 0; k < 4; k++) { px(g, 8 + k * 14, 26, out, 6, 6); px(g, 9 + k * 14, 27, '#ffd36b', 4, 4); } }
    if (stage === 3) { px(g, 44, 6, wood, 2, 16); px(g, 30, 6, wood, 16, 2); }
    if (stage === 4) { px(g, 26, 6, out, 12, 16); px(g, 27, 7, roof, 10, 14); px(g, 31, 0, out, 2, 8); px(g, 33, 1, '#e2513a', 7, 4); [10, 50].forEach(function (x) { px(g, x, 8, out, 2, 14); px(g, x + 2, 9, '#e7c873', 6, 4); }); }
    return c;
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
    var hr = w.hero || { level: 1, hp: 100, hpMax: 100, mana: 0, manaMax: 50, xp: 0, xpFrom: 0, xpNext: 100, title: '' };
    var bars = '<div class="sg-hbars"><div class="sg-hpb me" data-bar="hp"><i style="width:' + (hr.hp / hr.hpMax * 100) + '%"></i><span>❤ ' + hr.hp + '/' + hr.hpMax + '</span></div>' + (hr.level >= 2 ? '<div class="sg-mpb" data-bar="mp"><i style="width:' + (hr.mana / hr.manaMax * 100) + '%"></i><span>💧 ' + hr.mana + '/' + hr.manaMax + '</span></div>' : '') + '<div class="sg-xpb" data-bar="xp"><i style="width:' + Math.min(100, (hr.xp - hr.xpFrom) / Math.max(1, hr.xpNext - hr.xpFrom) * 100) + '%"></i><span>Lv ' + hr.level + ' · ' + (hr.xpNext - hr.xp) + ' XP to next</span></div></div>';
    if (GAME.lastLv && hr.level > GAME.lastLv) GAME.levelUp(hr); GAME.lastLv = hr.level;
    $('.sg-top').innerHTML = '<div class="sg-who"><span class="sg-face">' + (me.avatar ? '<img src="' + esc(me.avatar) + '" alt="">' : '') + '<em class="sg-lv">' + hr.level + '</em></span><div><b>' + esc(me.name) + '</b><small>' + esc(w.town.icon + ' ' + w.town.name + ' · ' + w.town.level) + ' · ' + esc(hr.title) + '</small>' + bars + '</div></div>'
      + '<div class="sg-stats"><span title="Coins">🪙 ' + w.coins + '</span>' + (w.elixirs ? '<span title="Elixirs">⚗ ' + w.elixirs + '</span>' : '') + '<span title="Fights left today">⚡ ' + w.stamina.left + '/' + w.stamina.max + '</span>' + (w.stamina.clanDown ? '<span class="sg-wnd" data-bar="clan" title="A clanmate is hurt">🛡−' + w.stamina.clanDown + '</span>' : '') + (w.wound && w.wound.level ? '<span class="sg-wnd" data-bar="wound">' + (w.wound.fallen ? '💤 fallen' : '🩹 ' + w.wound.days + 'd') + '</span>' : '') + '</div>';
    var ready = w.daily.filter(function (q) { return q.done && !q.claimed; }).length + w.story.filter(function (s) { return s.state === 'claim'; }).length;
    var MAIN = { today: 1, cards: 1, quests: 1, caravan: 1, chat: 1, more: 1 }, cv = CARAVAN.s ? CARAVAN.s.badge : 0;
    var ev = $('.sg-event'); if (ev) { ev.textContent = w.event ? '🎉 ' + w.event : ''; ev.classList.toggle('on', !!w.event); }
    $('.sg-menu').classList.toggle('more', !!GAME.more); $('.sg-menu').innerHTML = [['today', '📅', 'Today', 0], ['cards', '🃏', 'Cards', 0], ['ranks', '🏆', 'Ranks', 0], ['quests', '📜', 'Quests', ready], ['caravan', '🐫', 'Caravan', cv], ['party', '⚔', 'Party', 0], ['chat', '💬', 'Chat', 0], ['emote', '🙂', 'Emote', 0], ['note', '✍', 'Note', 0], ['map', '🗺', 'Map', 0], ['journal', '📖', 'Journal', 0], ['share', '📣', 'Share', 0], ['report', '📰', 'This week', 0], ['voices', SFX.on() ? '🗣' : '🔇', 'Voices', 0], ['music', MUSIC.ctx ? '🎵' : '🔇', 'Music', 0], ['help', '?', 'Help', 0], ['list', '☰', 'List view', 0], ['exit', '✕', 'Exit', 0], ['more', GAME.more ? '▴' : '⋯', GAME.more ? 'Less' : 'More', 0]].filter(function (b) { return GAME.more || MAIN[b[0]]; }).map(function (b) {
      return '<button class="sg-mb" data-g="' + b[0] + '" aria-label="' + b[2] + '"><span>' + b[1] + '</span><small>' + b[2] + '</small>' + (b[3] ? '<i>' + b[3] + '</i>' : '') + '</button>';
    }).join('');
    ROAD.strip();
  }
  function moment(key) { try { window.dispatchEvent(new CustomEvent('sawa:moment', { detail: { key: key } })); } catch (e) { /* old browser */ } }
  function say(msg, ms) { var t = $('.sg-hint'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(function () { t.classList.remove('on'); }, ms || 3200); }
  function dialog(name, text, buttons, portrait, onBye) {
    var d = $('.sg-dlg'); if (!d) return; d.innerHTML = '<div class="sg-box">' + (portrait ? '<span class="sg-por">' + portrait + '</span>' : '') + '<div class="sg-txt"><b>' + esc(name) + '</b><p></p><div class="sg-opts">' + (buttons || []).map(function (b, i) { return '<button data-o="' + i + '"' + (b.primary ? ' class="pri"' : '') + '>' + esc(b.label) + '</button>'; }).join('') + '<button data-o="x">Bye</button></div></div></div>';
    d.classList.add('on');
    var p = d.querySelector('p'), i = 0, full = text;
    if (dialog.who) { VOICE.act(dialog.who, text); dialog.who = null; }
    clearInterval(dialog.t); dialog.t = setInterval(function () { i += 2; p.textContent = full.slice(0, i); if (i >= full.length) { clearInterval(dialog.t); p.innerHTML = wrapWords(full) + ' ' + VOICE.btn(full); } }, 18);
    d.querySelectorAll('[data-o]').forEach(function (b) { b.onclick = function () { clearInterval(dialog.t); var o = b.dataset.o; d.classList.remove('on'); d.innerHTML = ''; if (o !== 'x' && buttons[+o]) buttons[+o].run(); else if (o === 'x' && onBye) onBye(); }; });
  }
  function busyNow() {
    if (!ROOT) return false;
    if ($('.sg-dlg.on') || $('.sg-panel.on') || $('.sg-word.on') || $('.sg-battle.on') || $('.sg-levelup')) return true;
    var m = ROOT.parentNode && ROOT.parentNode.querySelector('#modal'); if (m && m.innerHTML.trim()) return true;
    var fb = document.querySelector('.sawa-beta'); return !!(fb && fb.shadowRoot && fb.shadowRoot.querySelector('.sheet.on, .banner.on'));
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
    guard: ['Gate guard', '💂', 'The road east is closed until the beast of this land is defeated.'],
    teller: ['Rawi the storyteller', '🧓', 'Sit by the fire, traveller. Every evening I tell a story — in English, at your level.']
  };

  /* ================================================================ the world scene */
  function makeScenes(Phaser) {
    var World = new Phaser.Class({
      Extends: Phaser.Scene,
      initialize: function World() { Phaser.Scene.call(this, { key: 'World' }); },
      init: function (d) { this.spawn = d && d.spawn; this.pos = d && d.pos; },
      create: function () {
        var S = this, w = H.world(), t = w.at, th = THEMES[t] || THEMES[1];
        S.frozen = false; S.fighting = null; S.leaving = false; S.cool = 0; // the scene object is reused on restart
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
        S.hurt = (w.clanHurt || []).slice(0, 4).map(function (c, k) { var key = ensureChar(S, c.avatar || { look: {} }); var sp = S.add.sprite((5.2 + k * 1.5) * TS, 19.4 * TS, key, 0).setOrigin(0.5, 0.5).setAngle(90).setAlpha(c.wound.fallen ? 0.55 : 0.9); sp.setDepth(sp.y); return { spr: sp, c: c }; });
        if (w.reached <= t) npc('guard', 37.5, 18.4, { skin: 4, hair: 0, hairc: 0, outfit: 1 }, 'thief');
        if (H.lens && window.SAWA_LENS && window.SAWA_LENS.readers) npc('teller', 16.5, 18.4, { skin: 2, hair: 3, hairc: 4, outfit: 2 }, ''); // camp stories (Sawa Lens "Stories for you")
        // the caravanserai the community builds this week (it grows as the week goes on)
        S.serai = function (pct) {
          var st = pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 45 ? 2 : pct >= 15 ? 1 : 0, key = 'serai' + t + '_' + st;
          if (!S.textures.exists(key)) addTex(S, key, drawSerai(th, st));
          if (!S.seraiSpr) { S.seraiSpr = S.add.image(30.5 * TS, 24.6 * TS, key).setOrigin(0.5, 1); S.seraiSpr.setDepth(S.seraiSpr.y); solid(30.5 * TS, 24.6 * TS - 8, 54, 14); }
          else S.seraiSpr.setTexture(key);
          S.seraiPct = pct;
        };
        if (CARAVAN.s) S.serai(CARAVAN.s.project.pct);
        // the boss of the town, in its lair east of the pond
        var b = w.town.boss;
        if (!b.beaten || b.rematch) { // a beaten boss comes back stronger once a week
          var bk = ensureMonster(S, b.name, 40), bs = S.physics.add.sprite(64 * TS, 31 * TS, bk, 0).setOrigin(0.5, 1).setScale(1.25).setImmovable(true);
          bs.play(bk + '_a'); bs.body.setSize(28, 14).setOffset(6, 24); bs.setDepth(bs.y); bs.boss = true; S.boss = bs;
          S.lights.push({ x: 64 * TS, y: 30 * TS, r: 0.8, c: 0xff5a5a });
        }
        // the learning road: a camp for each of today's stations, between the east gate and the boss
        S.camps = ROAD.data().stations.map(function (st) { var x = ROAD.x[st.k] * TS, y = ROAD.y(ROAD.x[st.k]) * TS, key = 'camp_' + st.k; if (!S.textures.exists(key)) addTex(S, key, drawCamp(st.k)); var sp = S.add.image(x, y, key).setOrigin(0.5, 1); sp.setDepth(y); S.lights.push({ x: x + 8, y: y - 4, r: 0.4, c: 0xffa040 }); return { k: st.k, spr: sp }; });
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
        var sp = S.pos ? S.pos : !S.spawn && w.pos ? w.pos : S.spawn === 'east' ? { x: 68 * TS, y: 21 * TS } : S.spawn === 'west' ? { x: 4 * TS, y: 21 * TS } : { x: 19 * TS, y: 23 * TS };
        S.aura = function (lv) { var c = lv >= 30 ? 0x56c596 : lv >= 20 ? 0xf2c94c : lv >= 10 ? 0xc6ced6 : 0; if (!c) return null; var a = S.add.image(0, 0, 'light').setTint(c).setBlendMode(Phaser.BlendModes.ADD).setScale(0.22, 0.09).setAlpha(0.8); S.tweens.add({ targets: a, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 }); return a; };
        var pl = S.physics.add.sprite(sp.x, sp.y, key, 0).setOrigin(0.5, 1);
        pl.aura = S.aura((w.hero || {}).level || 1); pl.body.setSize(10, 6).setOffset(3, 18); pl.setCollideWorldBounds(true); pl.key = key; pl.dir = 0; S.pl = pl;
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
        S.cool = S.now() + 4000; // a moment to look around before any monster comes over
        S.time.delayedCall(3500, ROAD.intro);
      },
      now: function () { return this.game.loop.time; }, // the same clock update() gets, even right after a pause
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
        pl.setDepth(pl.y); if (pl.aura) pl.aura.setPosition(pl.x, pl.y - 1).setDepth(pl.y - 1);
        // exits
        if (pl.x > (MW - 1.6) * TS) S.leave(S.t + 1, 'west'); else if (pl.x < 1.2 * TS && S.t > 1) S.leave(S.t - 1, 'east');
        // monsters wander and chase
        var tired = H.world().stamina.left < 1;
        if (!S.busyAt || time - S.busyAt > 250) { S.busyAt = time; S.busy = busyNow(); }
        S.safe = (S.camps || []).some(function (c) { return Math.hypot(pl.x - c.spr.x, pl.y - c.spr.y) < 56; }); // monsters never attack at a camp
        S.monsters.forEach(function (m) {
          if (!m.active) return;
          var dx = pl.x - m.x, dy = pl.y - m.y, dd = Math.hypot(dx, dy);
          if (m.flee > time) { m.setVelocity(-dx / dd * 40, -dy / dd * 40); m.setAlpha(0.6); }
          else if (!tired && !S.busy && !S.safe && dd < 70 && S.cool < time) m.setVelocity(dx / dd * 34, dy / dd * 34);
          else { if (!m.wt || m.wt < time) { m.wt = time + 1500 + Math.random() * 2500; var a = Math.random() * 7; var back = Math.hypot(m.home.x - m.x, m.home.y - m.y) > 90; m.setVelocity(back ? (m.home.x - m.x) / 4 : Math.cos(a) * 18, back ? (m.home.y - m.y) / 4 : Math.sin(a) * 18); if (Math.random() < 0.4) m.setVelocity(0, 0); } }
          m.setDepth(m.y); if (!(m.flee > time)) m.setAlpha(tired ? 0.6 : 1); m.setFlipX(m.body.velocity.x < 0);
        });
        S.npcs.forEach(function (n) { n.setVelocity(0, 0); });
        // what's near (for the action button)
        var near = null, best = 30;
        S.npcs.forEach(function (n) { var dn = Phaser.Math.Distance.Between(pl.x, pl.y, n.x, n.y); if (dn < best) { best = dn; near = { kind: 'npc', obj: n }; } });
        (S.camps || []).forEach(function (c) { if (Phaser.Math.Distance.Between(pl.x, pl.y, c.spr.x, c.spr.y + 8) < 26) near = { kind: 'camp', obj: c }; });
        if (S.board && Phaser.Math.Distance.Between(pl.x, pl.y, S.board.x, S.board.y) < 28) near = { kind: 'board' };
        S.notes.forEach(function (n) { if (Phaser.Math.Distance.Between(pl.x, pl.y, n.spr.x, n.spr.y) < 20) near = { kind: 'note', obj: n }; });
        (S.hurt || []).forEach(function (h) { if (Phaser.Math.Distance.Between(pl.x, pl.y, h.spr.x, h.spr.y) < 22) near = { kind: 'hurt', obj: h }; });
        if (S.seraiSpr && Phaser.Math.Distance.Between(pl.x, pl.y, S.seraiSpr.x, S.seraiSpr.y + 4) < 34) near = { kind: 'serai' };
        Object.keys(S.others).forEach(function (id) { var o = S.others[id]; if (Phaser.Math.Distance.Between(pl.x, pl.y, o.spr.x, o.spr.y) < 24) near = { kind: 'player', obj: o }; });
        if ((near && near.kind) !== (S.near && S.near.kind) || (near && S.near && near.obj !== S.near.obj)) { S.near = near; var ab = $('.sg-act'); if (ab) { ab.classList.toggle('on', !!near); ab.textContent = !near ? '' : (TOUCH ? '' : 'E · ') + (near.kind === 'npc' ? 'Talk' : near.kind === 'board' ? 'Caravan board' : near.kind === 'note' ? 'Read note' : near.kind === 'hurt' ? 'Help' : near.kind === 'serai' ? 'Build' : near.kind === 'camp' ? 'Open' : 'Meet'); } }
        // others glide to their last position
        Object.keys(S.others).forEach(function (id) { var o = S.others[id], s = o.spr; var dx = o.tx - s.x, dy = o.ty - s.y, dd = Math.hypot(dx, dy); if (dd > 1) { var st = Math.min(dd, 1.4 * dt / 16); s.x += dx / dd * st; s.y += dy / dd * st; var dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); s.anims.play(s.texture.key + '_w' + dir, true); } else { s.anims.stop(); s.setFrame(o.d * 3); } s.setDepth(s.y); if (o.aura) o.aura.setPosition(s.x, s.y - 1).setDepth(s.y - 1); });
        // light and dark
        var cam = S.cameras.main, v = cam.worldView, dl = S.dayLight();
        S.paintDark(dl, v, cam.zoom, time);
        if (S.amb) S.amb.setPosition(v.x, v.y);
        // labels over characters (HTML)
        S.paintLabels();
        // sync with the server: every 3 s with others around, every 8 s alone
        if (time - (S.lastCar || 0) > 60000) { S.lastCar = time; CARAVAN.load().catch(function () {}); }
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
        (S.hurt || []).forEach(function (h) { if (Math.abs(x - h.spr.x) < 14 && Math.abs(y - h.spr.y) < 10) hit = { kind: 'hurt', obj: h }; });
        if (S.seraiSpr && Math.abs(x - S.seraiSpr.x) < 30 && y < S.seraiSpr.y + 2 && y > S.seraiSpr.y - 50) hit = { kind: 'serai' };
        (S.camps || []).forEach(function (c) { if (Math.abs(x - c.spr.x) < 12 && y < c.spr.y + 4 && y > c.spr.y - 30) hit = { kind: 'camp', obj: c }; });
        return hit;
      },
      tap: function (hit) { this.near = hit; this.interact(); },
      interact: function () {
        var S = this, n = S.near; if (!n || S.frozen) return;
        if (n.kind === 'board') return CARAVAN.show();
        if (n.kind === 'note') return S.readNote(n.obj);
        if (n.kind === 'hurt') return S.helpHurt(n.obj);
        if (n.kind === 'serai') return CARAVAN.show('build');
        if (n.kind === 'player') return S.meet(n.obj);
        if (n.kind === 'camp') return Phaser.Math.Distance.Between(S.pl.x, S.pl.y, n.obj.spr.x, n.obj.spr.y) > 48 ? ROAD.goTo(n.obj.k, true) : ROAD.open(n.obj.k); // a far camp: go there first
        var w = H.world(), id = n.obj.npc, L = NPC[id];
        dialog.who = id;
        if (id === 'elder') {
          var st = w.story, cur = st.filter(function (s) { return s.state !== 'done'; })[0];
          if (!cur) return dialog(L[0], 'You defeated the beast of ' + w.town.name + '. The road is open — go on to the next town, brave one!', [], L[1]);
          var txt = cur.state === 'claim' ? 'Well done! You finished: "' + cur.text + '". Take your reward.' : 'Your task: ' + cur.text + '. (' + cur.count + ' of ' + cur.n + ')';
          var btns = cur.state === 'claim' ? [{ label: 'Take the reward', primary: true, run: function () { H.api('/world/claim', { method: 'POST', body: { quest: 'story' } }).then(function (j) { H.setWorld(j.world); hud(); SFX.quest(); say('+' + j.got.coins + ' 🪙' + (j.got.elixirs ? ' +' + j.got.elixirs + ' ⚗' : '')); S.interact(); }, function (x) { say(x.message); }); } }]
            : cur.go === 'caravan' ? [{ label: 'Open the caravan board', primary: true, run: function () { CARAVAN.show('help'); } }] : cur.go === 'review' ? [{ label: 'Review cards now', primary: true, run: function () { REV.show(); } }] : cur.go === 'chat' ? [{ label: 'Open the town chat', primary: true, run: function () { CHAT.show(); } }] : cur.go === 'today' ? [{ label: 'Today\'s plan', primary: true, run: function () { TODAY.show(); } }] : cur.go && cur.go !== 'map' ? [{ label: 'Show me where', primary: true, run: function () { H.go(cur.go); } }] : [];
          return dialog(L[0], L[2] + ' ' + txt, btns.concat([{ label: 'All quests', run: function () { H.panel('quests'); } }]), L[1]);
        }
        if (id === 'inn') return dialog(L[0], L[2] + ' Or have a cup of healing tea: 25 coins.', [{ label: 'Review my cards', primary: true, run: function () { REV.show(); } }, { label: '🍵 Healing tea (25 🪙)', run: function () { H.api('/world/tea', { method: 'POST' }).then(function (j) { if (j.world) H.setWorld(j.world); hud(); SFX.heal(); say('🍵 Ahh, warm tea! +40% health. ' + j.left + (j.left === 1 ? ' cup' : ' cups') + ' left today.', 4000); }, function (x) { say(x.message, 4000); }); } }, { label: 'Today\'s plan', run: function () { TODAY.show(); } }], L[1]);
        if (id === 'smith') return H.stage() >= 4 ? dialog(L[0], L[2], [{ label: 'Open the forge', primary: true, run: function () { H.panel('forge'); } }], L[1]) : dialog(L[0], 'Come back when you are ready to carry a weapon. (Jobs and gear open at stage 4.)', [], L[1]);
        if (id === 'crier') return dialog(L[0], L[2] + ' And if a word is hard, ask the caravan — someone will explain it.', [{ label: 'Open the town chat', primary: true, run: function () { CHAT.show(); } }, { label: '🐫 Caravan board', run: function () { CARAVAN.show(); } }], L[1]);
        if (id === 'guard') return dialog(L[0], L[2] + ' Speak with Elder Wen to learn how.', [], L[1]);
        if (id === 'teller') { // camp stories: today's story or the next chapter, and a gift once you've read one today
          H.lens.api('readers').then(function (h) {
            var sr = h.series && !h.series.tomorrow ? h.series : null, st = h.today, btns = [];
            var txt = h.readToday ? 'You read a story today! Stories make a traveller wise. Take my gift for the road.'
              : sr ? 'Do you remember “' + sr.title + '”? Chapter ' + sr.next + ' is waiting for you tonight.'
                : st ? 'Tonight’s story is called “' + st.title + '”. ' + (st.teaser || '') : 'You have heard all my stories! New ones are coming soon.';
            if (h.readToday) btns.push({ label: '🎁 Take the gift', primary: true, run: function () { H.api('/world/story', { method: 'POST' }).then(function (j) { if (j.world) H.setWorld(j.world); hud(); SFX.quest(); say('+' + j.coins + ' 🪙 +' + j.elixirs + ' ⚗'); }, function (x) { say(x.message); }); } });
            if (sr) btns.push({ label: '📚 Read chapter ' + sr.next, primary: !h.readToday, run: function () { H.go('stories'); } });
            else if (st && !h.readToday) btns.push({ label: '📖 Read it (' + st.minutes + ' min)', primary: true, run: function () { H.go('story-' + st.id); } });
            btns.push({ label: 'All stories', run: function () { H.go('stories'); } });
            dialog.who = 'teller'; dialog(L[0], txt, btns, L[1]);
          }, function () { dialog(L[0], L[2], [{ label: 'All stories', primary: true, run: function () { H.go('stories'); } }], L[1]); });
          return;
        }
      },
      encounter: function (mo) {
        var S = this, now = S.now(); if (S.frozen || S.busy || S.safe || busyNow() || S.cool > now || mo.flee > now) return;
        var w = H.world();
        if (w.stamina.left < 1) { S.cool = now + 4000; S.pl.setVelocity(0); say('You are too tired to fight. Every step of today\'s plan gives you one more fight.'); return; }
        if (!w.ready) { S.cool = now + 4000; say('Battles open soon.'); return; }
        S.cool = now + 99999; S.frozen = true; mo.setVelocity(0, 0); S.pl.setVelocity(0, 0);
        var mon = w.town.monsters[mo.m] || {}, kind = (SHAPES[mon.name] || ['beast'])[0], style = MOB_STYLE[mon.name];
        SFX.growl(mon.name); setTimeout(function () { SFX.laugh(kind); }, 450);
        var away = function () { var t = S.now(); S.frozen = false; S.cool = t + 2500; mo.flee = t + 12000; };
        dialog(mon.name, '“' + (GAME.lastTaunt = pickOne(TAUNTS.intro[kind] || TAUNTS.intro.beast)) + '”' + (style ? ' ' + style : '') + ' Fight it? (⚡ ' + w.stamina.left + ' fights left today)',
          [{ label: '⚔ Fight', primary: true, run: function () { S.fighting = mo; S.cameras.main.flash(250, 255, 255, 255); S.cameras.main.shake(200, 0.004); S.time.delayedCall(220, function () { G.battle('/world/fight', { kind: 'monster', m: mo.m }, mo); }); } }, { label: 'Walk away', run: away }], mon.icon || '👾', away);
      },
      bossTouch: function () {
        var S = this, w = H.world(), b = w.town.boss; if (S.frozen || busyNow() || S.cool > S.now()) return; S.cool = S.now() + 2500;
        dialog.who = 'boss';
        if (b.beaten) return dialog(b.name, 'The ' + b.name + ' is back — stronger than before! An elite rematch: harder English, more health, bigger rewards' + (w.titles.indexOf('Champion of ' + w.town.name) < 0 ? ', and the title Champion of ' + w.town.name : '') + '. Once a week.', [{ label: '⚔ Elite rematch', primary: true, run: function () { S.frozen = true; G.battle('/world/rematch', {}, S.boss); } }, { label: '📣 Call for help', run: function () { CARAVAN.call('boss', 0, b.name); } }], b.icon);
        if (!b.ready) return dialog(b.name, 'The ' + b.name + ' looks down at you. You are not ready. (Finish Elder Wen\'s tasks first.)', [], b.icon);
        if (!b.tries) return dialog(b.name, 'The ' + b.name + ' is resting. Come back tomorrow.', [], b.icon);
        var cs = CARAVAN.s, mc = cs && cs.myCall && !cs.myCall.used && cs.myCall.foe.name === b.name ? cs.myCall : null;
        dialog(b.name, (mc && mc.helpers.length ? '⚔ ' + mc.helpers.length + (mc.helpers.length > 1 ? ' allies' : ' ally') + ' will fight with you! ' : '') + 'The ' + b.name + ' rises! Up to ' + (b.questions || 10) + ' questions at ' + w.town.level + ' level: bring its health to 0 before they run out. It gets angry at half health. ' + b.tries + (b.tries === 1 ? ' try' : ' tries') + ' left today.', [{ label: 'Fight!', primary: true, run: function () { S.frozen = true; G.battle('/world/fight', { kind: 'boss' }, S.boss); } }].concat(mc ? [] : [{ label: '📣 Call for help', run: function () { CARAVAN.call('boss', 0, b.name); } }]), b.icon);
      },
      afterBattle: function (r) {
        var S = this, now = S.now(); S.frozen = false; S.cool = now + 6000; // the scene clock stood still during the battle: use the game's clock
        S.monsters.forEach(function (mm) { if (mm.active && Phaser.Math.Distance.Between(S.pl.x, S.pl.y, mm.x, mm.y) < 90) mm.flee = now + 15000; });
        if (r && r.won && S.fighting) { var m = S.fighting; S.tweens.add({ targets: m, alpha: 0, scale: 1.6, duration: 300, onComplete: function () { m.disableBody(true, true); S.time.delayedCall(25000, function () { if (m.scene) m.enableBody(true, m.home.x, m.home.y, true, true).setAlpha(1).setScale(1); }); } }); }
        S.fighting = null; hud();
        if (r && r.ko) { S.cameras.main.fadeOut(250); S.time.delayedCall(300, function () { S.pl.setPosition(11.5 * TS, 17.6 * TS); S.cameras.main.fadeIn(400); say('You wake up at the inn. Review cards here to heal faster.', 5000); }); }
        if (r && (r.kind === 'boss' || r.kind === 'elite') && r.won) S.time.delayedCall(600, function () { S.scene.restart({ spawn: r.kind === 'boss' ? 'east' : null }); });
      },
      leave: function (to, spawn) {
        var S = this, w = H.world(); if (S.leaving) return;
        if (to > w.reached) { S.pl.x -= 8; return say('The road ahead is closed. Defeat the ' + w.town.boss.name + ' first.'); }
        S.leaving = true; S.cameras.main.fadeOut(300);
        H.api('/world/travel', { method: 'POST', body: { town: to } }).then(function (j) { H.setWorld(j); hud(); S.scene.restart({ spawn: spawn }); S.leaving = false; }, function (x) { S.leaving = false; S.cameras.main.fadeIn(200); say(x.message); });
      },
      // ---------------------------------------------------------- others (live and echoes)
      sync: function () {
        var S = this; if (S.syncing) { S.again = true; return; } S.syncing = true; // a sync asked for meanwhile (a camp opened or closed) runs right after
        H.api('/play/sync', { method: 'POST', body: { x: Math.round(S.pl.x), y: Math.round(S.pl.y), d: S.pl.dir, st: ROAD.cur || '' } }).then(function (j) {
          S.syncing = false; if (S.again) { S.again = false; S.lastSync = 0; } if (!running || !S.scene || !S.sys || !S.pl || !S.pl.active) return; // left or restarted meanwhile
          var seen = {};
          j.live.concat(j.echoes).forEach(function (p) {
            seen[p.id] = 1; var o = S.others[p.id], live = p.ago <= 60;
            if (!o) { var key = ensureChar(S, p); var s = S.add.sprite(p.x, p.y, key, p.d * 3).setOrigin(0.5, 1); o = S.others[p.id] = { spr: s, aura: S.aura((p.hero || {}).level || 1) }; }
            o.p = p; o.live = live; o.tx = p.x; o.ty = p.y; o.d = p.d; o.spr.setAlpha(live ? 1 : 0.55);
            if (!live) { o.spr.x = p.x; o.spr.y = p.y; }
            if (p.emote) o.emote = { e: p.emote, until: Date.now() + 5000 };
          });
          Object.keys(S.others).forEach(function (id) { if (!seen[id]) { S.others[id].spr.destroy(); if (S.others[id].aura) S.others[id].aura.destroy(); delete S.others[id]; } });
          j.bubbles.forEach(function (b) { if (S.seenB && S.seenB[b.id]) return; S.seenB = S.seenB || {}; S.seenB[b.id] = 1; var o = b.user === H.me().id ? { me: true } : S.others[b.user]; if (o) (o.me ? S : o).bubble = { text: b.text, until: Date.now() + 7000 }; });
          var n = j.live.length; var c = $('.sg-online'); if (c) c.textContent = n ? n + ' online here' : (j.echoes.length ? j.echoes.length + (j.echoes.length === 1 ? ' traveller was' : ' travellers were') + ' here today' : 'Only you here right now');
        }, function () { S.syncing = false; S.again = false; });
      },
      paintLabels: function () {
        var S = this, cam = S.cameras.main, v = cam.worldView, z = cam.zoom, lay = $('.sg-labels'); if (!lay) return;
        var r = ROOT.querySelector('.sg-cv').getBoundingClientRect(), k = r.width / S.scale.width, keep = {};
        function tag(id, x, y, html, cls) { keep[id] = 1; var e = S.labels[id]; if (!e) { e = S.labels[id] = el('div', 'sg-lb'); lay.appendChild(e); } if (e._h !== html) { e.innerHTML = '<div class="in">' + html + '</div>'; e._h = html; } e.className = 'sg-lb ' + (cls || ''); e.style.transform = 'translate(' + Math.round((x - v.x) * z * k) + 'px,' + Math.round((y - v.y) * z * k) + 'px)'; }
        var now = Date.now(), me = H.me();
        Object.keys(S.others).forEach(function (id) { var o = S.others[id], p = o.p, s = o.spr; var ago = p.ago > 60 ? (p.ago < 3600 ? Math.round(p.ago / 60) + ' min ago' : Math.round(p.ago / 3600) + ' h ago') : ''; var ph = p.hero || {}; tag('o' + id, s.x, s.y - 27, '<span class="nm' + (p.wanted ? ' wanted' : '') + '"><em class="lvb">' + (ph.level || 1) + '</em>' + (p.wanted ? '⚠ ' : '') + esc(p.name.split(' ')[0]) + (ph.rank && ph.rank !== 'Bronze' ? ' <i class="rk ' + esc(ph.rank.toLowerCase()) + '">' + esc(ph.rank) + '</i>' : '') + '</span>' + (p.st && ROAD.verb[p.st] ? '<small>' + ROAD.icon[p.st] + ' ' + ROAD.verb[p.st] + (ago ? ' · ' + ago : '') + '</small>' : ago ? '<small>' + ago + '</small>' : ''), o.live ? '' : 'echo'); if (o.bubble && o.bubble.until > now) tag('b' + id, s.x, s.y - 40, '<span class="bub">' + esc(o.bubble.text) + '</span>', 'bubble'); if (o.emote && o.emote.until > now) tag('e' + id, s.x, s.y - 34, '<span class="emo">' + EMO[o.emote.e] + '</span>', 'bubble'); });
        var mh = H.world().hero || {}; tag('me', S.pl.x, S.pl.y - 27, '<span class="nm me"><em class="lvb">' + (mh.level || 1) + '</em>' + esc(me.name.split(' ')[0]) + '</span><span class="tbar"><i style="width:' + ((mh.hp || 1) / (mh.hpMax || 1) * 100) + '%"></i></span>');
        if (S.bubble && S.bubble.until > now) tag('bme', S.pl.x, S.pl.y - 40, '<span class="bub">' + esc(S.bubble.text) + '</span>', 'bubble');
        if (S.emote && S.emote.until > now) tag('eme', S.pl.x, S.pl.y - 34, '<span class="emo">' + EMO[S.emote.e] + '</span>', 'bubble');
        S.npcs.forEach(function (n) { tag('n' + n.npc, n.x, n.y - 27, '<span class="nm npc">' + esc(NPC[n.npc][0]) + '</span>'); });
        (S.camps || []).forEach(function (c) { var s = ROAD.st(c.k); if (!s || (s.state !== 'open' && Phaser.Math.Distance.Between(S.pl.x, S.pl.y, c.spr.x, c.spr.y) > 220)) return; tag('rc' + c.k, c.spr.x, c.spr.y - 30, '<span class="nm camp ' + s.state + '">' + (s.state === 'done' ? '✓ ' : s.state === 'locked' ? '🔒 ' : '') + s.icon + ' ' + esc(s.name) + '</span>'); });
        if (S.board) { var cs = CARAVAN.s; tag('board', S.board.x, S.board.y - 30, '<span class="nm npc">🐫 Caravan board' + (cs && cs.badge ? ' <i class="sg-dotn">' + cs.badge + '</i>' : cs && cs.todo ? ' · ' + cs.todo + ' ?' : '') + '</span>'); }
        if (S.seraiSpr && Phaser.Math.Distance.Between(S.pl.x, S.pl.y, S.seraiSpr.x, S.seraiSpr.y) < 140) tag('serai', S.seraiSpr.x, S.seraiSpr.y - 54, '<span class="nm npc">' + (S.seraiPct >= 100 ? '🏰 Caravanserai — built!' : '🏗 Caravanserai ' + S.seraiPct + '%') + '</span>');
        (S.hurt || []).forEach(function (h) { var c = h.c; tag('h' + c.id, h.spr.x, h.spr.y - 14, '<span class="nm hurt">' + (c.wound.fallen ? '💤 ' : '🩹 ') + esc(c.name.split(' ')[0]) + ' · ' + c.wound.days + 'd</span>'); });
        if (S.boss) tag('boss', S.boss.x, S.boss.y - 52, '<span class="nm boss">' + (H.world().town.boss.beaten ? '⭐ Elite ' : '') + esc(H.world().town.boss.name) + '</span>');
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
      /** A hurt clanmate at the inn: heal them, or revive them if they have fallen (it costs mana from studying). */
      helpHurt: function (h) {
        var S = this, c = h.c, first = c.name.split(' ')[0], fallen = c.wound.fallen;
        var txt = first + ' has not studied for ' + c.wound.days + ' day' + (c.wound.days > 1 ? 's' : '') + (fallen ? ' and has fallen. Two revives from the clan bring them back (a Healer\'s counts twice).' : ' and is wounded: their health is ' + Math.round(c.wound.cap * 100) + '% of normal.') + (c.wound.level >= 2 ? ' Your clan has one fight less a day until they are back.' : '') + ' Studying is the real cure — send them a message!';
        var act = function (path, label) { return { label: label, primary: true, run: function () { H.api(path, { method: 'POST', body: { user: c.id } }).then(function (j) { H.refreshWorld().then(function () { hud(); }); SFX.heal(); say(path === '/clan/heal' ? '💚 You healed ' + first + ' (+' + j.pct + '% health).' : j.back ? '✨ ' + first + ' is back on their feet!' : '✨ One revive done. One more clanmate is needed.', 4500); c.helped = true; }, function (x) { say(x.message, 4500); }); } }; };
        var btns = c.helped ? [] : [fallen ? act('/clan/revive', '✨ Revive (−30 💧)') : act('/clan/heal', '💚 Heal (−20 💧)')];
        btns.push({ label: '💬 Send a message', run: function () { CHAT.show(); } });
        dialog(c.name, (c.helped ? 'You already helped ' + first + ' today. ' : '') + txt, btns, fallen ? '💤' : '🩹');
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
        inputBox('Say something to everyone (English)', 'Hello! Where are you from?', function (v, err, done) {
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
    A.hero = hero; A.foe = foe; A.allies = [];
    ((b.me && b.me.allies) || []).forEach(function (al, k) { var c = frameCanvas(drawChar(al.avatar || { look: {} }), 2 * 3 * 16, 16, 24); c.className = 'sg-ally a' + k; c.title = al.name; A.el.appendChild(c); A.allies.push(c); });
    A.el.appendChild(el('div', 'sg-ashadow h')); A.el.appendChild(el('div', 'sg-ashadow f'));
    A.el.appendChild(hero); A.el.appendChild(foe);
    ROOT.insertBefore(A.el, ROOT.querySelector('.sg-top'));
    requestAnimationFrame(function () { A.el.classList.add('on'); });
  }
  Arena.prototype.anim1 = function (node, kf, ms) { try { return node.animate(kf, { duration: ms, easing: 'ease-out' }); } catch (e) { return null; } };
  Arena.prototype.pop = function (node, txt, cls) { if (!this.el.isConnected) return; var r = node.getBoundingClientRect(), a = this.el.getBoundingClientRect(), p = el('span', 'sg-pop ' + (cls || ''), esc(txt)); p.style.left = (r.left - a.left + r.width / 2) + 'px'; p.style.top = (r.top - a.top) + 'px'; this.el.appendChild(p); setTimeout(function () { p.remove(); }, 1000); };
  Arena.prototype.hit = function (ok, per, fx) {
    var A = this; fx = fx || {};
    if (ok && fx.quick) setTimeout(function () { A.pop(A.hero, 'Quick!', 'quick'); }, 60);
    if (ok && fx.combo >= 3) setTimeout(function () { A.pop(A.foe, 'Combo ×' + fx.combo, 'combo'); }, 420);
    if (!ok && fx.blocked) { A.pop(A.hero, 'Blocked!', 'quick'); return; }
    if (fx.enrage) setTimeout(function () { A.foe.classList.add('rage'); A.pop(A.foe, 'ENRAGED', 'miss'); }, 600);
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
        A.pop(A.hero, '-' + per, 'miss');
      }, 190);
    }
  };
  Arena.prototype.taunt = function (text) {
    if (!this.el.isConnected || !text) return; var old = this.el.querySelector('.sg-taunt'); if (old) old.remove();
    var r = this.foe.getBoundingClientRect(), a = this.el.getBoundingClientRect(), t = el('div', 'sg-taunt', wrapWords(text));
    t.style.right = Math.max(6, a.right - r.right - 10) + 'px'; t.style.bottom = Math.max(60, a.bottom - r.top + 6) + 'px'; this.el.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 2600);
  };
  Arena.prototype.heal = function () { this.hero.classList.add('healed'); var h = this.hero; setTimeout(function () { h.classList.remove('healed'); }, 700); this.pop(this.hero, '+❤', 'heal'); };
  Arena.prototype.charge = function () { this.hero.classList.add('charged'); this.pop(this.hero, 'Power!', 'quick'); };
  Arena.prototype.finish = function (won) { (won ? this.foe : this.hero).classList.add(won ? 'gone' : 'down'); };
  Arena.prototype.close = function () { clearInterval(this.anim); var e = this.el; e.classList.remove('on'); setTimeout(function () { e.remove(); }, 250); };

  /* ================================================================ battle UI (HTML) and flow */
  var GAME = {
    battle: function (path, body, monster) {
      var world = G.phaser.scene.getScene('World');
      H.api(path, { method: 'POST', body: body || {} }).then(function (b) {
        closeDialog(); LENS.close();
        world.scene.pause(); $('.sg-labels').style.visibility = 'hidden'; MUSIC.battle(true); var arena = GAME.arena = new Arena(b); GAME.battleUI(b, arena);
        var kind = mobKind(b.foe); SFX.growl(b.foe.name);
        ((b.me && b.me.allies) || []).forEach(function (al, k) { setTimeout(function () { var A = arena; if (!A.el.isConnected) return; A.pop(A.allies[k] || A.hero, al.name + ': ' + al.help, 'say'); if (al.fire) { A.pop(A.foe, '🔥 -' + al.fire, 'dmg'); SFX.power(); } else SFX.sparkle(); }, 1400 + k * 1100); });
        setTimeout(function () { var lines = (b.foe.shadow ? TAUNTS.intro.shadow : b.foe.boss || b.kind === 'pboss' ? TAUNTS.intro.boss : TAUNTS.intro[kind] || TAUNTS.intro.beast).filter(function (x) { return x !== GAME.lastTaunt; }); arena.taunt(pickOne(lines)); SFX.laugh(kind); }, 500);
      }, function (x) { world.frozen = false; world.cool = world.now() + 2500; say(x.message, 4500); });
    },
    battleUI: function (b, scene) {
      var box = $('.sg-battle'), n = b.questions.length, i = 0, timer = null, t0 = 0, busy = false;
      var me = b.me, foe = { hp: b.foe.hp, max: b.foe.hpMax || b.foe.hp }, combo = 0, phase = 1, mana = me.mana, used = {}, stat = {}, spooked = false, lowSaid = false, leaveArmed = 0, kind = mobKind(b.foe);
      box.classList.add('on');
      function bars() {
        return '<div class="sg-duo"><div class="sg-side"><b>' + esc(H.me().name.split(' ')[0]) + ' <small>Lv ' + me.level + '</small></b><div class="sg-hpb me"><i style="width:' + Math.max(0, me.hp / me.hpMax * 100) + '%"></i><span>❤ ' + me.hp + '/' + me.hpMax + '</span></div><div class="sg-mpb"><i style="width:' + Math.max(0, mana / me.manaMax * 100) + '%"></i><span>💧 ' + mana + '</span></div></div>'
          + '<div class="sg-combo' + (combo >= 3 ? ' hot' : '') + '">' + (combo >= 2 ? '×' + combo + '<small>combo</small>' : '') + '</div>'
          + '<div class="sg-side foe"><b>' + esc(b.foe.icon) + ' ' + esc(b.foe.name) + (phase === 2 ? ' <small class="rage">ENRAGED</small>' : '') + '</b>' + (b.kind === 'support' ? '<small>🤝 For ' + esc(b.foe.for || 'a traveller') + ': every right answer helps</small>' : '<div class="sg-hpb"><i style="width:' + Math.max(0, foe.hp / foe.max * 100) + '%"></i><span>❤ ' + foe.hp + '/' + foe.max + '</span></div>') + '</div></div>'
          + '<div class="sg-styles"><span>' + (me.styles || []).map(function (s) { return '<i title="' + esc(s.text) + '">' + s.icon + ' ' + esc(s.name) + '</i>'; }).join('') + (stat.poison ? '<i class="bad">☠ Poison ' + stat.poison + '</i>' : '') + (stat.burn ? '<i class="bad">🔥 Burning ' + stat.burn + '</i>' : '') + (stat.ice ? '<i class="good">❄ Foe frozen</i>' : '') + '</span>'
          + (b.foe.style ? '<span class="foe"><i title="' + esc(b.foe.style.text) + '">' + b.foe.style.icon + ' ' + esc(b.foe.style.name) + '</i>' + (stat.rage ? '<i class="bad">🐾 Angry ×' + stat.rage + '</i>' : '') + (stat.charged ? '<i class="bad blink">⚡ Charging!</i>' : '') + '</span>' : '') + '</div>';
      }
      function skillBar() {
        if (me.level < 2) return '<p class="small sg-skills-soon">✨ Battle skills open at level 2.</p>';
        return '<div class="sg-skills">' + b.skills.map(function (s) { var off = mana < s.cost || used[s.id]; return '<button data-sk="' + s.id + '"' + (off ? ' disabled' : '') + ' title="' + esc(s.text) + '"><b>' + esc(s.name) + '</b><small>💧' + s.cost + '</small></button>'; }).join('') + '</div>';
      }
      function paintBars() { var x = box.querySelector('.sg-duo'); if (x) x.outerHTML = bars(); var y = box.querySelector('.sg-skills'); if (y) { y.outerHTML = skillBar(); bindSkills(); } }
      function body(it) {
        if (it.type === 'order') return '<div class="sg-order"><div class="sg-line" data-line></div><div class="sg-chips">' + it.tokens.map(function (t, k) { return '<button data-tok="' + k + '">' + esc(t) + '</button>'; }).join('') + '</div><div class="sg-opts"><button data-reset>Start again</button><button class="pri" data-done>Check</button></div></div>';
        if (it.type === 'type') return '<div class="sg-typer"><input maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + Array(it.len + 1).join('_ ') + '" dir="ltr"><button class="pri" data-done>Check</button></div>';
        return '<div class="sg-ops">' + it.options.map(function (o, k) { return '<button data-k="' + k + '"><span>' + 'ABCD'[k] + '</span>' + esc(o) + '</button>'; }).join('') + '</div>';
      }
      function q() {
        clearInterval(timer); used = {}; busy = false;
        if (i >= n) return end();
        var it = b.questions[i], secs = b.seconds + (it.type === 'type' || it.type === 'order' ? 10 : 0) - (spooked ? 6 : 0), left = secs;
        GAME.cur = { kind: b.kind, foe: b.foe.name, q: (i + 1) + '/' + n, type: it.type, point: it.point || '', text: it.q };
        var label = { listen: '🎧 Listen', type: '⌨ Type the missing word', order: '🧩 Build the sentence', mc: '' }[it.type] || '';
        var qtext = it.type === 'listen' ? '<p class="sg-listen"><button class="sg-bigsay" data-say="' + esc(it.say) + '">🔊</button> ' + esc(it.q) + '</p>' : '<p>' + wrapWords(it.q, null, true) + ' ' + VOICE.btn(it.q) + '</p>';
        box.innerHTML = '<div class="sg-bp"><button class="sg-leave" data-leave aria-label="Leave the battle">🏃 Leave</button>' + bars() + (stat.charged ? '<p class="sg-warn">⚡ ' + esc(b.foe.name) + ' is charging a heavy blow! A miss now hurts double; a right answer breaks it.</p>' : spooked ? '<p class="sg-warn">😱 Spooked: less time for this one!</p>' : '') + '<div class="sg-tm"><i></i></div><div class="sg-qn"><small>' + (i + 1) + ' / ' + n + (label ? ' · ' + label : '') + (it.point ? ' · ' + esc(it.point) : '') + '</small>' + qtext + (it.src ? '<small class="src">from ' + esc(it.src) + '</small>' : '') + '<p class="sg-hint" hidden></p></div>' + body(it) + skillBar() + '</div>';
        if (it.type === 'listen') setTimeout(function () { VOICE.say(it.say); }, 350);
        var bar = box.querySelector('.sg-tm i');
        box.querySelectorAll('[data-k]').forEach(function (btn) { btn.onclick = function () { pick({ choice: +btn.dataset.k }, btn); }; });
        if (it.type === 'type') { var inp = box.querySelector('.sg-typer input'); inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') pick({ text: inp.value }); }; box.querySelector('[data-done]').onclick = function () { pick({ text: inp.value }); }; setTimeout(function () { inp.focus(); }, 50); }
        if (it.type === 'order') {
          var line = box.querySelector('[data-line]'), picked = [];
          var paint = function () { line.innerHTML = picked.map(function (k) { return '<span>' + esc(it.tokens[k]) + '</span>'; }).join(' ') || '<small>Tap the words in order</small>'; box.querySelectorAll('[data-tok]').forEach(function (c) { c.disabled = picked.indexOf(+c.dataset.tok) >= 0; }); };
          box.querySelectorAll('[data-tok]').forEach(function (c) { c.onclick = function () { picked.push(+c.dataset.tok); paint(); }; });
          box.querySelector('[data-reset]').onclick = function () { picked = []; paint(); };
          box.querySelector('[data-done]').onclick = function () { pick({ text: picked.map(function (k) { return it.tokens[k]; }).join(' ') }); };
          paint();
        }
        bindSkills(); bindLeave(); spooked = false;
        t0 = Date.now();
        timer = setInterval(function () { left -= 0.1; bar.style.width = Math.max(0, left / secs * 100) + '%'; bar.classList.toggle('low', left < 5); if (left <= 0) pick({ choice: -1, text: '' }, null); }, 100);
        G.keyPick = it.type === 'mc' || it.type === 'listen' ? function (k) { var bt = box.querySelector('[data-k="' + k + '"]'); if (bt && !bt.disabled) pick({ choice: k }, bt); } : null;
      }
      function bindLeave() {
        var lb = box.querySelector('[data-leave]'); if (!lb) return;
        if (Date.now() < leaveArmed) lb.textContent = 'Tap again to leave'; // still armed after the next question appears
        lb.onclick = function () {
          if (Date.now() > leaveArmed) { leaveArmed = Date.now() + 4000; lb.textContent = 'Tap again to leave'; setTimeout(function () { var x = box.querySelector('[data-leave]'); if (x && Date.now() > leaveArmed) x.textContent = '🏃 Leave'; }, 4100); return; }
          clearInterval(timer); busy = true; G.keyPick = null;
          H.api('/world/flee', { method: 'POST', body: { battle: b.battle } }).then(function (r) { if (r.world) H.setWorld(r.world); scene.taunt(pickOne(TAUNTS.flee)); SFX.laugh(kind); setTimeout(function () { close({ kind: b.kind, fled: true, won: false }); say(r.refund ? 'You left the battle. The fight was given back.' : 'You left the battle. Take your time!', 4000); }, 900); }, function () { close({ kind: b.kind, fled: true, won: false }); });
        };
      }
      function fxText(f) { return { frost: '❄ Frost: it missed!', shield: '🛡 Shield took ' + f.n, allyheal: '💚 Ally heals +' + f.n, poison: '☠ -' + f.n, burn: '🔥 -' + f.n, poisoned: '☠ Poisoned!', burning: '🔥 On fire!', stole: '🫳 -' + f.n + ' 💧', spooked: '😱 Spooked!', smash: '💥 SMASH ×2', stagger: '💫 Guard broken!', swoop: '🪶 Too slow: half damage', riddle: '❓ It healed +' + f.n, mend: '💚 +' + f.n, spell: '🔮 Spell!', freeze: '❄ Frozen!', frozen: '❄ Its attack missed!', frenzy: '🐾 Angrier!' }[f.k] || ''; }
      function bindSkills() {
        box.querySelectorAll('[data-sk]').forEach(function (s) {
          s.onclick = function () {
            if (busy) return; var id = s.dataset.sk; s.disabled = true;
            H.api('/world/skill', { method: 'POST', body: { battle: b.battle, skill: id } }).then(function (r) {
              mana = r.mana; used[id] = 1;
              if (r.remove != null) { var x = box.querySelector('[data-k="' + r.remove + '"]'); if (x) { x.disabled = true; x.classList.add('gone'); } }
              if (r.hint || r.lemma) { var h = box.querySelector('.sg-hint'); h.hidden = false; var ar = r.lemma && H.lens ? H.lens.meanings(H.lens.lemmaOf(r.lemma)) : []; h.innerHTML = '💡 ' + esc(r.hint || '') + (ar.length ? ' <span dir="rtl">' + esc(ar[0].ar) + '</span>' : ''); }
              if (r.hp != null) { me.hp = r.hp; scene.heal(); SFX.heal(); } else if (id === 'power') { scene.charge(); SFX.power(); } else SFX.sparkle();
              VOICE.bark(id);
              paintBars();
            }, function (x) { s.disabled = false; say(x.message); });
          };
        });
      }
      function pick(ans, btn) {
        if (busy) return; busy = true;
        clearInterval(timer); G.keyPick = null; box.querySelectorAll('.sg-ops button, .sg-chips button, .sg-typer button, .sg-order button, .sg-skills button').forEach(function (x) { x.disabled = true; });
        H.api('/world/step', { method: 'POST', body: Object.assign({ battle: b.battle, i: i, ms: Date.now() - t0 }, ans) }).then(function (r) {
          if (btn) btn.classList.add(r.correct ? 'ok' : 'no');
          if (!r.correct) box.querySelectorAll('[data-k]').forEach(function (x) { if (x.textContent.slice(1) === r.right) x.classList.add('ok'); });
          foe.hp = r.foeHp; me.hp = r.hp; combo = r.combo; phase = r.phase; if (r.mana != null) mana = r.mana;
          stat = Object.assign({}, r.status || {}, { charged: r.charged, ice: (r.fx || []).some(function (f) { return f.k === 'freeze'; }) }); spooked = !!r.spooked;
          (r.fx || []).forEach(function (f, k) { var t = fxText(f); if (t) setTimeout(function () { scene.pop(/^(mend|poison|burn|poisoned|burning|stole|spooked|smash|frozen|frost|shield|allyheal)$/.test(f.k) ? scene.hero : scene.foe, t, /^(mend|freeze|frozen|stagger|spell|frost|shield|allyheal)$/.test(f.k) ? 'heal' : 'miss'); }, 500 + k * 380); });
          var taunt = !r.correct ? (ans.choice === -1 && !ans.text ? TAUNTS.slow : TAUNTS.miss) : r.combo >= 3 ? TAUNTS.combo : TAUNTS.hit;
          if (!r.correct || r.combo >= 3 || Math.random() < 0.45) setTimeout(function () { scene.taunt(pickOne(taunt)); if (r.correct) SFX.scream(kind, true); else SFX.laugh(kind); }, r.correct ? 700 : 520);
          if (!lowSaid && foe.hp > 0 && foe.hp < foe.max * 0.3) { lowSaid = true; setTimeout(function () { scene.taunt(pickOne(TAUNTS.low)); SFX.scream(kind); }, 1500); }
          scene.hit(r.correct, r.correct ? r.dmg : r.taken, { quick: r.quick, combo: r.combo, blocked: r.blocked, enrage: r.enrage });
          if (r.correct) { setTimeout(SFX.slash, 170); VOICE.bark(r.combo >= 3 ? 'combo' : r.quick ? 'quick' : 'hit'); }
          else if (r.blocked) SFX.blocked();
          else { setTimeout(function () { SFX.growl(b.foe.name); SFX.hurt(); }, 190); VOICE.bark('hurt'); }
          if (r.enrage) setTimeout(function () { SFX.growl(b.foe.name); SFX.laugh('dragon'); scene.taunt(pickOne(BOSS_LINES.rage)); }, 1900);
          paintBars();
          if (!r.correct) { var fb = el('div', 'sg-fb', '✗ <b>' + wrapWords(r.right) + '</b>' + (r.why ? ' — ' + wrapWords(r.why) : '') + ' ' + VOICE.btn(r.right)); var bp = box.querySelector('.sg-bp'); if (bp) bp.appendChild(fb); }
          i++;
          setTimeout(r.done ? end : q, r.correct ? 1000 : 2400);
        }, function (x) { say(x.message); i++; setTimeout(q, 600); });
      }
      function end() {
        clearInterval(timer);
        box.innerHTML = '<div class="sg-bp"><p class="sg-wait">…</p></div>';
        H.api('/world/answer', { method: 'POST', body: { battle: b.battle } }).then(function (r) {
          if (r.world) H.setWorld(r.world);
          scene.finish(r.won && !r.ko);
          if (r.ko) { SFX.sad(); SFX.laugh(kind); scene.taunt(pickOne(TAUNTS.win)); } else if (r.won) { SFX.scream(kind); scene.taunt(pickOne(r.foe.boss ? BOSS_LINES.fall : TAUNTS.fall)); setTimeout(r.foe.boss ? SFX.fanfare : SFX.coin, 500); } else { SFX.sad(); SFX.laugh(kind); scene.taunt(pickOne(TAUNTS.escape)); }
          var leveled = r.hero && r.hero.level > me.level;
          var pb = r.kind === 'pboss', duel = r.kind === 'duel';
          var sup = r.kind === 'support';
          var title = sup ? '🤝 You fought for ' + esc(r.for || 'a traveller') + '!' : r.ko ? '💫 You were knocked out' : pb ? (r.won ? '🏆 The party boss is down!' : '💥 ' + r.attack + ' damage to the party boss') : duel ? (r.won ? '🏆 You beat the shadow!' : '💨 The shadow was stronger') : r.won ? (r.foe.boss ? '🏆 ' + esc(r.foe.name) + ' defeated!' : '⚔ Victory!') : '💨 The ' + esc(r.foe.name) + ' got away';
          var gains = (r.coins ? '+' + r.coins + ' 🪙 ' : '') + (r.xp ? '+' + r.xp + ' XP ' : '') + (r.elixirs ? '+' + r.elixirs + ' ⚗' : '');
          var hero = r.hero || {};
          box.innerHTML = '<div class="sg-bp sg-res"><h3>' + title + '</h3><p>' + r.right + ' of ' + r.total + ' right · ' + r.attack + ' damage dealt' + (r.best >= 3 ? ' · best combo ×' + r.best : '') + '</p>'
            + (sup ? '<p>' + (r.help ? 'You give them <b>' + esc(r.help) + '</b> for their next fight.' : 'Thank you!') + ' You get more XP and coins when they win.</p>' : '')
            + (r.allies ? '<p class="small">⚔ ' + r.allies + (r.allies > 1 ? ' allies' : ' ally') + ' fought with you' + (r.won ? ' — they share the win!' : '.') + '</p>' : '')
            + (r.ko ? '<p>You wake up at the inn. Review some cards there to heal faster.</p>' : '')
            + (gains ? '<p class="sg-gain">' + gains + (r.partyBonus ? '<small> · party bonus +20%</small>' : '') + '</p>' : '')
            + (duel && r.rating != null ? '<p>Arena: ' + (r.rating >= 0 ? '+' : '') + r.rating + ' · rank <b>' + esc(r.rank) + '</b></p>' : '')
            + (hero.level ? '<div class="sg-xpbar"><span>Lv ' + hero.level + '</span><div><i style="width:' + Math.min(100, (hero.xp - hero.xpFrom) / Math.max(1, hero.xpNext - hero.xpFrom) * 100) + '%"></i></div><span>' + (hero.xpNext - hero.xp) + ' XP to Lv ' + (hero.level + 1) + '</span></div>' : '')
            + (r.title ? '<p>🏅 New title: <b>' + esc(r.title) + '</b>' + (r.next ? '<br>The road to <b>' + esc(r.next) + '</b> is open!' : '') + '</p>' : '')
            + (function () { var miss = (r.review || []).filter(function (x) { return !x.ok; }).slice(0, 4); return miss.length ? '<div class="sg-miss"><small>Learn from it:</small>' + miss.map(function (x) { return '<p>✗ ' + wrapWords(x.q, null, true) + ' → <b>' + wrapWords(x.right) + '</b>' + (x.why ? '<br><small>' + esc(x.why) + '</small>' : '') + '</p>'; }).join('') + '</div>' : ''; })()
            + (r.missedWords ? '<p class="small">📇 ' + r.missedWords + ' word' + (r.missedWords > 1 ? 's' : '') + ' you missed will come back in your review cards today.</p>' : '')
            + ((r.title || leveled) ? '<button data-share="1">📣 Share it</button> ' : '') + (!r.won && !sup && (r.kind === 'boss' || r.kind === 'elite' || r.kind === 'monster') && !(CARAVAN.s && CARAVAN.s.myCall && !CARAVAN.s.myCall.used) ? '<button data-callhelp="1">📣 Call for help</button> ' : '') + '<button class="pri" data-x="1">Continue</button></div>';
          box.querySelector('[data-x]').onclick = function () { close(r); };
          var ch = box.querySelector('[data-callhelp]'); if (ch) ch.onclick = function () { ch.disabled = true; var w = H.world(), mi = w.town.monsters.map(function (m) { return m.name; }).indexOf(r.foe.name); CARAVAN.call(r.kind === 'boss' || r.kind === 'elite' ? 'boss' : 'monster', Math.max(0, mi), r.foe.name); };
          var sb = box.querySelector('[data-share]'); if (sb) sb.onclick = function () { close(r); SHARE.show(r.title ? 'I became ' + r.title : 'I reached level ' + r.hero.level); };
          G.keyPick = function () { close(r); };
        }, function (x) { say(x.message); close(null); });
      }
      function close(r) {
        G.keyPick = null; box.classList.remove('on'); box.innerHTML = ''; GAME.cur = null; GAME.arena = null; clearInterval(timer);
        if (close.done) return; close.done = true;
        if (r && !r.fled) setTimeout(function () { moment(r.kind === 'boss' ? 'first_boss' : 'first_battle'); }, 900);
        var world = G.phaser.scene.getScene('World'); scene.close(); world.scene.resume(); MUSIC.battle(false);
        if (GAME.needRebuild) { GAME.needRebuild = false; setTimeout(rebuild, 300); } $('.sg-labels').style.visibility = ''; world.afterBattle(r);
        if (r && r.kind === 'pboss') H.refreshParty();
      }
      q();
    },
    levelUp: function (hr) {
      var d = el('div', 'sg-levelup', '<div><small>LEVEL UP</small><b>' + hr.level + '</b><span>' + esc(hr.title) + '</span><p>❤ +8 · 💧 +5 · +' + (10 * hr.level) + ' 🪙</p></div>');
      if (!ROOT) return; ROOT.appendChild(d); setTimeout(function () { d.classList.add('on'); }, 30);
      SFX.fanfare(); setTimeout(function () { VOICE.bark('level'); }, 600); setTimeout(function () { moment('first_level'); }, 9000); setTimeout(function () { say('📣 Tap Share to show your new level in the community!', 5000); }, 3800); setTimeout(function () { d.classList.remove('on'); setTimeout(function () { d.remove(); }, 500); }, 3600);
    },
    emote: function (e) { var w = G.phaser.scene.getScene('World'); w.emote = { e: e, until: Date.now() + 5000 }; H.api('/play/emote', { method: 'POST', body: { e: e } }).catch(function () {}); },
    look: function (first) {
      var L = Object.assign({}, H.avatar().look), d = $('.sg-dlg'), role = H.avatar().role || 'guardian';
      function prev() { var c = drawChar({ look: L, job: H.world().job }), p = d.querySelector('canvas'), g = p.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 144); g.drawImage(c, 0, 0, 16, 24, 0, 0, 96, 144); }
      var rows = [['skin', 'Skin', 5], ['hair', 'Hair', 4], ['hairc', 'Hair colour', 6], ['outfit', 'Clothes', 6]];
      d.innerHTML = '<div class="sg-box sg-look"><canvas width="96" height="144"></canvas><div class="sg-txt"><b>' + (first ? 'Create your traveller' : 'Your look') + '</b><p>' + (first ? 'This is you on the Silk Road. Your job and the gear you earn will show on you too.' : 'Change how you look.') + '</p>'
        + rows.map(function (r) { return '<div class="sg-lr"><span>' + r[1] + '</span><button data-l="' + r[0] + '" data-v="-1" aria-label="Previous">‹</button><button data-l="' + r[0] + '" data-v="1" aria-label="Next">›</button></div>'; }).join('')
        + '<p class="sg-rolet"><b>Your role</b> · how you fight, and how you help others</p><div class="sg-roles">' + ROLES.map(function (x) { return '<button data-role="' + x[0] + '"' + (x[0] === role ? ' class="on"' : '') + '><span>' + x[1] + '</span>' + esc(x[2]) + '</button>'; }).join('') + '</div><p class="small sg-roled"></p>'
        + '<div class="sg-opts"><button class="pri" data-o="save">Start my journey</button></div></div></div>';
      d.classList.add('on'); prev();
      var roleTxt = function () { var x = ROLES.filter(function (y) { return y[0] === role; })[0]; d.querySelector('.sg-roled').innerHTML = '<b>' + x[1] + ' ' + esc(x[2]) + '</b>: ' + esc(x[3]) + '<br>Helping others: ' + esc(x[4]); d.querySelectorAll('[data-role]').forEach(function (b) { b.classList.toggle('on', b.dataset.role === role); }); };
      d.querySelectorAll('[data-role]').forEach(function (b) { b.onclick = function () { role = b.dataset.role; roleTxt(); }; }); roleTxt();
      var w0 = G.phaser && G.phaser.scene.getScene('World'); if (w0) w0.frozen = true; // nothing attacks while you dress up
      d.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { var r = rows.filter(function (x) { return x[0] === b.dataset.l; })[0]; L[r[0]] = ((L[r[0]] || 0) + +b.dataset.v + r[2]) % r[2]; prev(); }; });
      d.querySelector('[data-o="save"]').onclick = function () { H.api('/play/look', { method: 'POST', body: Object.assign({ role: role }, L) }).then(function (j) { H.setLook(j.look); H.avatar().role = j.role; d.classList.remove('on'); d.innerHTML = ''; var w = G.phaser.scene.getScene('World'); w.scene.restart({}); if (first) setTimeout(GAME.welcome, 900); }, function (x) { say(x.message); }); };
    },
    welcome: function () {
      var steps = [
        (TOUCH ? 'Drag your thumb anywhere on the map to walk.' : 'Walk with the arrow keys or W A S D.') + ' ' + (TOUCH ? 'Tap the red button' : 'Press E') + ' to talk to people and read signs.',
        'Monsters live on the road east of town. Walk into one to fight it with your English: your own words, your mistakes and your weakest grammar.',
        'Your bars: ❤ health — a monster hits you when you answer wrong. 💧 mana — you get it when you study (cards, your plan, writing), and you use it for battle skills. Your level goes up with XP from everything you learn.',
        'Other students walk here too. If they studied earlier today, you still see their echo — tap it to duel their shadow or invite them.',
        'Leave short English notes for the next traveller ✍, and talk to Elder Wen for your next task. Have a good journey!'
      ];
      (function show(i) { if (i >= steps.length) return; dialog.who = 'elder'; dialog('Elder Wen', steps[i], [{ label: i + 1 < steps.length ? 'Next' : 'Let\'s go!', primary: true, run: function () { show(i + 1); } }], '👴'); })(0);
    },
    menu: function (k) {
      var w = G.phaser.scene.getScene('World');
      if (k !== 'more' && GAME.more) { GAME.more = false; hud(); } // fold the long menu away after a choice
      if (k === 'exit') return window.SawaGame.stop(true);
      if (k === 'list') return window.SawaGame.stop(true, 'list');
      if (k === 'quests' || k === 'party' || k === 'help') return H.panel(k);
      if (k === 'chat') return CHAT.show();
      if (k === 'caravan') return CARAVAN.show();
      if (k === 'today') return TODAY.show();
      if (k === 'ranks') return RANKS.show();
      if (k === 'more') { GAME.more = !GAME.more; return hud(); }
      if (k === 'journal') return JOURNAL.show();
      if (k === 'share') return SHARE.show();
      if (k === 'report') return REPORT.show();
      if (k === 'voices') return SFX.toggle();
      if (k === 'cards') return REV.show();
      if (k === 'music') return MUSIC.toggle();
      if (k === 'note') return w.writeNote();
      if (k === 'emote') { return dialog('Emote', 'Show how you feel. Everyone here sees it for a few seconds.', Object.keys(EMO_LIST).map(function (e) { return { label: EMO_LIST[e] + ' ' + e, run: function () { GAME.emote(e); } }; }).concat([{ label: '🎨 Change my look', run: function () { GAME.look(false); } }]), '🙂'); }
      if (k === 'map') {
        var wd = H.world();
        return dialog('The Silk Road', 'Travel to any town you have opened. Walk out of the east gate to go further — after its boss falls.', wd.towns.filter(function (t) { return t.open && t.id !== wd.at; }).map(function (t) { return { label: t.icon + ' ' + t.name + ' (' + t.level + ')', run: function () { w.leave(t.id, 'center'); } }; }), '🗺');
      }
    }
  };
  /** Silk Road roles: [id, icon, name, in battle, when helping others]. The server has the same list (Sawa_Tracker_Combat::ROLES). */
  var ROLES = [
    ['guardian', '🛡', 'Guardian', 'a tank: you take 25% less damage', 'a shield that takes the first hits'],
    ['healer', '💚', 'Healer', 'every right answer heals you, and cleans off poison and fire', 'heals when their health is low'],
    ['mage', '🔮', 'Mage', 'typing and sentence questions hit 40% harder', 'a fireball at the start of the fight'],
    ['trickster', '❄', 'Trickster', '3 right answers in a row freeze the monster: its next attack misses', 'frost, so the monster\'s first attacks miss']
  ];
  var EMO_LIST = { wave: '👋', cheer: '🎉', clap: '👏', heart: '❤️', laugh: '😂', bow: '🙇' };

  /* ================================================================ sound: read-aloud (the browser's own voices) and calm music
     Music is generated live with WebAudio (soft pads and a slow pentatonic melody, a different mode in every town),
     so there are no audio files to download. It starts after the student enters the world and can be muted. */
  var VOICE = {
    pick: function () {
      if (!window.speechSynthesis) return null;
      var vs = speechSynthesis.getVoices().filter(function (v) { return /^en[-_]/i.test(v.lang); });
      return vs.filter(function (v) { return /natural|neural|google us|samantha|aria|jenny/i.test(v.name); })[0] || vs.filter(function (v) { return /en[-_]us/i.test(v.lang); })[0] || vs[0] || null;
    },
    say: function (text) {
      if (!window.speechSynthesis || !text) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/_{2,}/g, ' blank ')); u.lang = 'en-US'; u.rate = 0.92;
      var v = VOICE.pick(); if (v) u.voice = v;
      MUSIC.duck(true); u.onend = u.onerror = function () { MUSIC.duck(false); };
      speechSynthesis.speak(u);
    },
    btn: function (text) { return window.speechSynthesis ? '<button class="sg-say" data-say="' + esc(text) + '" aria-label="Listen">🔊</button>' : ''; }
  };
  var MODES = { 1: [0, 2, 4, 7, 9], 2: [0, 1, 4, 5, 7], 3: [0, 2, 3, 7, 9], 4: [0, 2, 3, 7, 10], 5: [0, 1, 4, 7, 8], 6: [0, 2, 3, 7, 8] };
  var ROOTS = { 1: 57, 2: 55, 3: 52, 4: 53, 5: 50, 6: 52 };
  var MUSIC = {
    ctx: null, on: true, t: null, step: 0, fast: false,
    pref: function () { try { return localStorage.getItem('sawaMusic') !== '0'; } catch (e) { return true; } },
    start: function () {
      MUSIC.on = MUSIC.pref(); if (!MUSIC.on || MUSIC.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var c = MUSIC.ctx = new AC(); MUSIC.master = c.createGain(); MUSIC.master.gain.value = 0;
      // a soft room: a generated reverb tail
      var len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      var rev = c.createConvolver(); rev.buffer = ir; var wet = c.createGain(); wet.gain.value = 0.55;
      MUSIC.bus = c.createBiquadFilter(); MUSIC.bus.type = 'lowpass'; MUSIC.bus.frequency.value = 2400;
      MUSIC.bus.connect(MUSIC.master); MUSIC.bus.connect(rev); rev.connect(wet); wet.connect(MUSIC.master); MUSIC.master.connect(c.destination);
      MUSIC.master.gain.linearRampToValueAtTime(0.07, c.currentTime + 3);
      MUSIC.loop();
    },
    hz: function (m) { return 440 * Math.pow(2, (m - 69) / 12); },
    note: function (midi, when, dur, type, vol) {
      var c = MUSIC.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = MUSIC.hz(midi);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + Math.min(0.9, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
      o.connect(g); g.connect(MUSIC.bus); o.start(when); o.stop(when + dur + 0.1);
    },
    loop: function () {
      var c = MUSIC.ctx; if (!c) return;
      var t = H && H.world ? H.world().at : 1, mode = MODES[t] || MODES[1], root = ROOTS[t] || 57, now = c.currentTime + 0.05, beat = MUSIC.fast ? 0.42 : 0.75;
      if (MUSIC.step % 16 === 0) { var deg = [0, 3, 2, 4][(MUSIC.step / 16) % 4]; [0, 2, 4].forEach(function (k) { var s = mode[(deg + k) % 5] + ((deg + k) >= 5 ? 12 : 0); MUSIC.note(root - 12 + s, now, beat * 16, 'sine', 0.05); MUSIC.note(root + s, now + 0.02, beat * 16, 'triangle', 0.018); }); }
      if (MUSIC.fast) { // battle: a kick on every beat, a hi-hat between, a bass line
        MUSIC.drum(now, 'kick'); MUSIC.drum(now + beat / 2, 'hat'); if (MUSIC.step % 4 === 2) MUSIC.drum(now, 'snare');
        if (MUSIC.step % 2 === 0) MUSIC.note(root - 24 + mode[[0, 0, 3, 4][(MUSIC.step / 2) % 4]], now, beat * 1.8, 'square', 0.03);
      }
      if (Math.random() < (MUSIC.fast ? 0.55 : 0.32)) { var n = mode[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0); MUSIC.note(root + 12 + n, now, beat * 3, 'triangle', 0.035); }
      MUSIC.step++;
      MUSIC.t = setTimeout(MUSIC.loop, beat * 1000);
    },
    drum: function (when, k) {
      var c = MUSIC.ctx, o = c.createOscillator(), g = c.createGain();
      if (k === 'kick') { o.type = 'sine'; o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.16); g.gain.setValueAtTime(0.32, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.2); o.connect(g); g.connect(MUSIC.master); o.start(when); o.stop(when + 0.22); return; }
      var n = c.createBufferSource(), len = c.sampleRate * 0.2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var fl = c.createBiquadFilter(); fl.type = k === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = k === 'hat' ? 7000 : 1800; n.buffer = buf;
      g.gain.setValueAtTime(k === 'hat' ? 0.05 : 0.14, when); g.gain.exponentialRampToValueAtTime(0.001, when + (k === 'hat' ? 0.05 : 0.15)); n.connect(fl); fl.connect(g); g.connect(MUSIC.master); n.start(when); n.stop(when + 0.2);
    },
    level: function () { return MUSIC.fast ? 0.11 : 0.07; },
    battle: function (on) { MUSIC.fast = on; if (MUSIC.ctx) { if (MUSIC.ctx.state === 'suspended') MUSIC.ctx.resume(); MUSIC.master.gain.linearRampToValueAtTime(MUSIC.level(), MUSIC.ctx.currentTime + 0.5); } },
    duck: function (on) { if (!MUSIC.ctx) return; clearTimeout(MUSIC.dt); MUSIC.master.gain.linearRampToValueAtTime(on ? 0.02 : MUSIC.level(), MUSIC.ctx.currentTime + 0.3); if (on) MUSIC.dt = setTimeout(function () { MUSIC.duck(false); }, 6000); }, // speech may never say it ended
    toggle: function () {
      MUSIC.on = !MUSIC.ctx; try { localStorage.setItem('sawaMusic', MUSIC.on ? '1' : '0'); } catch (e) { /* private mode */ }
      if (MUSIC.on) MUSIC.start(); else MUSIC.stop();
      say(MUSIC.on ? '🎵 Music on' : '🔇 Music off'); hud();
    },
    stop: function () { clearTimeout(MUSIC.t); if (MUSIC.ctx) { var c = MUSIC.ctx; MUSIC.ctx = null; try { c.close(); } catch (e) { /* closed */ } } }
  };

  /* ================================================================ voice acting and sound effects
     Characters speak with the browser's own English voices (each one with its own pitch and speed: simple
     English, so it is listening practice too). Monsters growl, swords hit, spells shimmer: all made live with
     WebAudio, no audio files. "Voices" in the menu switches voices and effects off; music has its own switch. */
  var CAST = {
    me: { pitch: 1.05, rate: 1.05 }, elder: { pitch: 0.75, rate: 0.85 }, inn: { pitch: 1.3, rate: 0.98 }, smith: { pitch: 0.6, rate: 0.9 },
    crier: { pitch: 1.1, rate: 1.08 }, guard: { pitch: 0.7, rate: 0.95 }, teller: { pitch: 0.8, rate: 0.82 }, boss: { pitch: 0.45, rate: 0.82 }, bandit: { pitch: 0.65, rate: 1.05 }, shadow: { pitch: 0.55, rate: 0.9 }
  };
  var BARKS = {
    hit: ['Take that!', 'Yes!', 'Got it!', 'Easy!', 'Here we go!'], quick: ['Too fast for you!', 'Lightning!'], combo: ['Combo!', 'I am on fire!', 'Keep going!'],
    hurt: ['Ouch!', 'That hurt!', 'Oh no!'], win: ['Victory!', 'We did it!', 'Yes! I won!'], lose: ['I need to rest.', 'Next time!'], level: ['Level up!', 'I feel stronger!'],
    focus: ['Focus!'], hint: ['Insight!'], power: ['Power strike!'], heal: ['I feel better.']
  };
  function mobKind(f) { return f.shadow ? 'shadow' : f.boss ? 'boss' : (SHAPES[f.name] || ['beast'])[0]; }
  var MOB_STYLE = { 'Sand Scorpion': 'Its sting poisons you when you miss.', 'Desert Wyrm': 'Its bite poisons you when you miss.', 'Night Assassin': 'Its blade is poisoned.', 'Lantern Ghost': 'It spooks you: less time to answer.', 'Cave Bat': 'It spooks you: less time to answer.', 'Shadow Khan': 'It spooks you: less time to answer.', 'Rice Rat': 'It steals your mana when you miss.', 'Dune Bandit': 'It steals your mana when you miss.', 'Bazaar Trickster': 'It steals your mana when you miss.', 'Stone Golem': 'Watch out when it charges up!', 'Iron Boar': 'Watch out when it charges up!', 'Brass Automaton': 'Watch out when it charges up!', 'Varangian Guard': 'Watch out when it charges up!', 'Fire Djinn': 'Its fire keeps burning you.', 'Fire Drake': 'Its fire keeps burning you.', 'Roc Chick': 'Answer fast: slow answers only do half damage.', 'Hippodrome Champion': 'Answer fast: slow answers only do half damage.', 'Riddling Sphinx': 'A miss heals it.', 'Paper Tiger': 'Every miss makes it angrier.', 'Mountain Wolf': 'Every miss makes it angrier.' };
  var TAUNTS = {
    intro: {
      beast: ['Grrr! Your words look tasty!', 'I am hungry for verbs!', 'Roar! Do you even know the past tense?'],
      bandit: ['Hand over your vocabulary!', 'This road is mine, little student!', 'Your words or your coins!'],
      spirit: ['Boooo! Did I scare your grammar?', 'Wooo… I eat forgotten words!', 'Hee hee! Can you see me?'],
      golem: ['I… am… rock. You… are… small.', 'Stone… never… forgets… words.', 'Crush… your… English!'],
      bug: ['Click-click! I will sting your verbs!', 'Tiny but dangerous! Like irregular verbs!', 'Bzzzt! Spell it, if you can!'],
      flyer: ['Squawk! Catch me if you can spell!', 'Too slow! Too slow!', 'Caw! Answer fast or cry!'],
      dragon: ['Ha ha ha! Another tiny traveller!', 'I have eaten many dictionaries!', 'Your English smells like a beginner!'],
      boss: ['Mwa-ha-ha! You came to ME?', 'Turn back, little scholar!', 'I have beaten a hundred students today!'],
      shadow: ['I fight just like you. Show me!', 'I know all your mistakes!', 'Ha! I am you, but better.']
    },
    miss: ['Ha! Nice try!', 'Ooh, so close… NOT!', 'My grandmother knows that one!', 'Wrong! I love it!', 'Was that a guess?', 'Even my tail knows that!', 'Hee hee! Try again, friend!', 'Oops! Did your brain take a nap?'],
    hit: ['Ouch! Lucky shot!', 'Hey! That hurt!', 'Okay, okay, you know that one.', 'Grr… not bad!', 'Ow! Who taught you that?'],
    combo: ['Stop! Stop! You are too good!', 'Who are you, a teacher?!', 'No fair! You studied!', 'Help! This one reads books!'],
    slow: ['Zzz… are you sleeping?', 'Tick-tock, traveller!', 'Hello? Anybody there?'],
    low: ['Wait! Let us be friends!', 'I will tell my mother!', 'Please! I have a family of verbs!'],
    fall: ['Nooo! I will study harder!', 'You… speak… too well…', 'Not fair! You did your homework!', 'Okay, you win. Teach me?'],
    win: ['Ha ha! Go and review your cards!', 'Come back when you know more words!', 'Sleep well, little scholar!'],
    escape: ['See you next time, slowpoke!', 'Ha! My English is better today!'],
    flee: ['Running away? Ha ha! Come back soon!', 'Go! Go and study! I will wait!', 'Bye-bye! Bring better words next time!']
  };
  var BOSS_LINES = { rage: ['Enough! Now I am REALLY angry!', 'You made me angry! Big mistake!', 'Grrraaah! My real power!'], fall: ['No! Impossible! Who taught you?!', 'You… are… a real scholar!', 'I will be back… after I study!'] };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  var SFX = {
    ctx: null,
    on: function () { try { return localStorage.getItem('sawaVoices') !== '0'; } catch (e) { return true; } },
    ac: function () {
      if (!SFX.on()) return null;
      if (!SFX.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; SFX.ctx = new AC(); SFX.out = SFX.ctx.createGain(); SFX.out.gain.value = 0.35; SFX.out.connect(SFX.ctx.destination); var n = SFX.ctx.sampleRate; SFX.noiseBuf = SFX.ctx.createBuffer(1, n, n); var d = SFX.noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
      if (SFX.ctx.state === 'suspended') SFX.ctx.resume();
      return SFX.ctx;
    },
    tone: function (type, f1, f2, dur, vol, when) {
      var c = SFX.ac(); if (!c) return; var t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(SFX.out); o.start(t); o.stop(t + dur + 0.05);
    },
    noise: function (type, f1, f2, dur, vol, when) {
      var c = SFX.ac(); if (!c) return; var t = c.currentTime + (when || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = SFX.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f1, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(SFX.out); s.start(t); s.stop(t + dur + 0.05);
    },
    slash: function () { SFX.noise('highpass', 4000, 700, 0.18, 0.5); SFX.tone('sine', 140, 55, 0.18, 0.5, 0.05); },
    hurt: function () { SFX.tone('square', 220, 90, 0.22, 0.18); SFX.noise('lowpass', 800, 200, 0.2, 0.4); },
    blocked: function () { SFX.tone('triangle', 1200, 900, 0.15, 0.25); SFX.tone('triangle', 1800, 1500, 0.12, 0.15, 0.03); },
    heal: function () { [523, 659, 784, 1047].forEach(function (f, i) { SFX.tone('sine', f, 0, 0.35, 0.18, i * 0.07); }); },
    power: function () { SFX.tone('sawtooth', 160, 900, 0.35, 0.12); SFX.noise('bandpass', 400, 3000, 0.35, 0.25); },
    sparkle: function () { [1319, 1568, 1976].forEach(function (f, i) { SFX.tone('sine', f, 0, 0.18, 0.12, i * 0.05); }); },
    coin: function () { SFX.tone('square', 988, 0, 0.08, 0.12); SFX.tone('square', 1319, 0, 0.18, 0.12, 0.08); },
    fanfare: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { SFX.tone('triangle', f, 0, i === 5 ? 0.6 : 0.16, 0.22, i * 0.12); }); },
    quest: function () { SFX.tone('sine', 784, 0, 0.3, 0.2); SFX.tone('sine', 1175, 0, 0.5, 0.2, 0.15); },
    sad: function () { [392, 349, 311].forEach(function (f, i) { SFX.tone('triangle', f, 0, 0.35, 0.18, i * 0.22); }); },
    growl: function (name) {
      var k = (SHAPES[name] || ['spirit'])[0];
      if (k === 'beast') { SFX.tone('sawtooth', 110, 70, 0.55, 0.16); SFX.noise('lowpass', 600, 200, 0.5, 0.35); }
      else if (k === 'spirit') { SFX.tone('sine', 420, 260, 0.7, 0.15); SFX.tone('sine', 433, 270, 0.7, 0.1); }
      else if (k === 'bug') { for (var i = 0; i < 5; i++) SFX.noise('highpass', 3000, 2500, 0.03, 0.4, i * 0.06); }
      else if (k === 'flyer') { SFX.tone('square', 1400, 700, 0.3, 0.08); }
      else if (k === 'golem') { SFX.tone('square', 70, 50, 0.6, 0.16); SFX.noise('lowpass', 300, 120, 0.6, 0.4); }
      else if (k === 'dragon') { SFX.tone('sawtooth', 75, 45, 1.0, 0.2); SFX.noise('lowpass', 900, 150, 1.0, 0.4); }
      else { SFX.tone('sawtooth', 160, 120, 0.25, 0.1); }
    },
    /** An evil (or silly) laugh: "ha-ha-ha" from a buzzing voice through two vowel filters. */
    laugh: function (kind) {
      var c = SFX.ac(); if (!c) return;
      var base = { dragon: 88, golem: 80, boss: 92, shadow: 120, beast: 125, bandit: 165, spirit: 300, bug: 470, flyer: 540 }[kind] || 150, n = kind === 'spirit' || kind === 'bug' ? 6 : kind === 'golem' ? 3 : 5, gap = kind === 'golem' ? 0.26 : kind === 'bug' ? 0.11 : 0.17;
      for (var i = 0; i < n; i++) {
        var t = c.currentTime + i * gap, f = base * (1.3 - i * 0.07) * (i === n - 1 ? 1.15 : 1), o = c.createOscillator(), g = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f * 0.86, t + gap * 0.8);
        if (kind === 'spirit') { var lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 9; lg.gain.value = f * 0.06; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + gap); }
        f1.type = 'bandpass'; f1.frequency.value = kind === 'spirit' ? 600 : 780; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1220; f2.Q.value = 7;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + gap * 0.85);
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(SFX.out); o.start(t); o.stop(t + gap);
        SFX.noise('highpass', 2600, 1400, 0.035, 0.16, i * gap);
      }
    },
    /** A cartoon scream ("aaah!"), or a short yelp when it is hit. */
    scream: function (kind, short) {
      var c = SFX.ac(); if (!c) return;
      var base = { dragon: 110, golem: 90, boss: 120, beast: 180, bandit: 240, spirit: 420, bug: 700, flyer: 820, shadow: 160 }[kind] || 200, d = short ? 0.28 : 0.75, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (short ? 1.8 : 2.4), t + d * 0.35); o.frequency.exponentialRampToValueAtTime(base * 0.7, t + d);
      f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 4; f2.type = 'bandpass'; f2.frequency.value = 1400; f2.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(SFX.out); o.start(t); o.stop(t + d + 0.05);
      SFX.noise('bandpass', 1800, 900, d * 0.8, 0.12);
    },
    toggle: function () { var on = !SFX.on(); try { localStorage.setItem('sawaVoices', on ? '1' : '0'); } catch (e) { /* private mode */ } if (!on && window.speechSynthesis) speechSynthesis.cancel(); say(on ? '🗣 Voices and sounds on' : '🔇 Voices and sounds off'); hud(); }
  };
  /** A character says a line (voices on): its own pitch and speed. */
  VOICE.act = function (who, text) {
    if (!SFX.on() || !window.speechSynthesis || !text) return;
    var c = CAST[who] || CAST.me; speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.pitch = c.pitch; u.rate = c.rate; var v = VOICE.pick(); if (v) u.voice = v;
    MUSIC.duck(true); u.onend = u.onerror = function () { MUSIC.duck(false); }; speechSynthesis.speak(u);
  };
  VOICE.bark = function (kind) { var A = GAME.arena; if (A && A.el.isConnected && Math.random() < (kind === 'hit' || kind === 'hurt' ? 0.35 : 0.8)) A.pop(A.hero, pickOne(BARKS[kind] || BARKS.hit), 'say'); };

  /* ================================================================ the share card: a picture to post on Skool */
  var SHARE = {};
  SHARE.make = function (why) {
    var w = H.world(), hr = w.hero || {}, me = H.me(), a = H.avatar(), c = cnv(600, 600), g = c.getContext('2d'), th = THEMES[w.at] || THEMES[1];
    var gr = g.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, '#14193a'); gr.addColorStop(1, '#2b3168'); g.fillStyle = gr; g.fillRect(0, 0, 600, 600);
    g.fillStyle = th.sky[1]; g.globalAlpha = 0.18; g.fillRect(0, 380, 600, 220); g.globalAlpha = 1;
    g.strokeStyle = '#e7c873'; g.lineWidth = 6; g.strokeRect(14, 14, 572, 572);
    var ch = drawChar(a); g.imageSmoothingEnabled = false; g.drawImage(ch, 0, 0, 16, 24, 210, 150, 180, 270);
    if (hr.aura) { g.globalAlpha = 0.35; g.fillStyle = { silver: '#c6ced6', gold: '#f2c94c', jade: '#56c596' }[hr.aura]; g.beginPath(); g.ellipse(300, 420, 110, 22, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
    g.textAlign = 'center'; g.fillStyle = '#ffe39a'; g.font = '700 26px Georgia, serif'; g.fillText(why || 'My journey on the Silk Road', 300, 70);
    g.fillStyle = '#ffffff'; g.font = '700 40px Georgia, serif'; g.fillText(me.name, 300, 118);
    g.fillStyle = '#e7c873'; g.beginPath(); g.arc(470, 190, 46, 0, 7); g.fill(); g.fillStyle = '#14193a'; g.font = '800 40px Georgia, serif'; g.fillText(hr.level || 1, 470, 204); g.font = '700 14px sans-serif'; g.fillText('LEVEL', 470, 160);
    g.fillStyle = '#ffe39a'; g.font = '600 24px Georgia, serif'; g.fillText((hr.title || 'Traveller') + ' · ' + w.town.name + ' (' + w.town.level + ')', 300, 465);
    g.fillStyle = '#d8cfb8'; g.font = '20px sans-serif';
    g.fillText('📚 ' + (w.words || 0) + ' words learning   ⚔ ' + (hr.kills || 0) + ' monsters   🏰 ' + (hr.bosses || 0) + ' bosses', 300, 505);
    g.fillText('🏆 Arena: ' + (hr.rank || 'Bronze') + '   ' + (w.titles.length ? '🏅 ' + w.titles[w.titles.length - 1] : ''), 300, 538);
    g.fillStyle = '#ffffff'; g.font = '700 18px sans-serif'; g.fillText('Sawa English · learning English together', 300, 572);
    return c;
  };
  SHARE.show = function (why) {
    var c = SHARE.make(why), url = c.toDataURL('image/png'), w = H.world(), hr = w.hero || {};
    var text = (why ? why + '! ' : '') + 'I am level ' + (hr.level || 1) + ' (' + (hr.title || 'Traveller') + ') on the Sawa English Silk Road, in ' + w.town.name + '. I am learning ' + (w.words || 0) + ' words right now. ' + (H.stage() >= 5 ? 'Who wants to join my party? ⚔' : 'Who else is on the road? 🐫');
    var b = panel('sg-sharep', '📣 Share your journey', '<img class="sg-card-img" src="' + url + '" alt="Your Silk Road card"><textarea rows="3" dir="ltr">' + esc(text) + '</textarea><div class="sg-opts"><button class="pri" data-s="skool">Post on Skool</button><a class="sg-dl" href="' + url + '" download="sawa-silk-road.png">⬇ Save picture</a>' + (navigator.share ? '<button data-s="native">Share…</button>' : '') + '</div><p class="small">Copy the text, save the picture, then post both in the community. Sharing counts for this week\'s quest.</p>');
    var ta = b.querySelector('textarea'); ta.onkeydown = function (e) { e.stopPropagation(); };
    b.querySelector('[data-s="skool"]').onclick = function () {
      try { navigator.clipboard.writeText(ta.value); } catch (e) { /* copy by hand */ }
      H.api('/world/shared', { method: 'POST' }).then(function (j) { H.setWorld(j); }, function () {});
      window.open(H.skool() || 'https://www.skool.com', '_blank', 'noopener'); say('Text copied. Paste it in your Skool post with the picture!', 5000);
    };
    var ns = b.querySelector('[data-s="native"]');
    if (ns) ns.onclick = function () { c.toBlob(function (blob) { var f = new File([blob], 'sawa-silk-road.png', { type: 'image/png' }); var data = { text: ta.value }; if (navigator.canShare && navigator.canShare({ files: [f] })) data.files = [f]; navigator.share(data).then(function () { H.api('/world/shared', { method: 'POST' }).catch(function () {}); }, function () {}); }); };
  };

  /* ================================================================ the weekly report and the explorer's journal */
  var REPORT = {};
  REPORT.show = function () {
    var b = panel('sg-reportp', '📰 This week on the Silk Road', '<p class="sg-wait">…</p>');
    H.api('/world/report').then(function (d) {
      var lines = [];
      b.innerHTML = '<h4>⭐ Most XP this week</h4><ol class="sg-rank">' + d.xp.map(function (p, k) { lines.push((k + 1) + '. ' + p.name + ' — ' + p.week + ' XP'); return '<li><span>' + (k + 1) + '</span><div><b>' + esc(p.name) + '</b><small>Lv ' + p.level + '</small></div><em>' + p.week + ' XP</em></li>'; }).join('') + '</ol>'
        + (d.helpers && d.helpers.length ? '<h4>🤝 Best helpers in the chat</h4><p>' + d.helpers.map(function (p) { return esc(p.name) + ' (' + p.n + ' replies)'; }).join(' · ') + '</p>' : '')
        + (d.words.length ? '<h4>📚 Most new words</h4><p>' + d.words.map(function (p) { return esc(p.name) + ' (' + p.words + ')'; }).join(' · ') + '</p>' : '')
        + (d.moments.length ? '<h4>🏆 Big moments</h4><ul class="sg-moments">' + d.moments.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '<p class="small">No big moments yet this week. Be the first!</p>')
        + (H.isAdmin() ? '<div class="sg-opts"><button class="pri" data-r="copy">Copy as a Skool post</button></div>' : '<div class="sg-opts"><button class="pri" data-r="share">Share my card</button></div>');
      var cp = b.querySelector('[data-r="copy"]');
      if (cp) cp.onclick = function () { var t = '🐫 This week on the Silk Road!\n\n⭐ Most XP:\n' + lines.join('\n') + (d.helpers && d.helpers.length ? '\n\n🤝 Best helpers in the chat: ' + d.helpers.map(function (p) { return p.name + ' (' + p.n + ' replies)'; }).join(', ') : '') + (d.words.length ? '\n\n📚 Most new words: ' + d.words.map(function (p) { return p.name + ' (' + p.words + ')'; }).join(', ') : '') + (d.moments.length ? '\n\n🏆 Big moments:\n' + d.moments.map(function (m) { return '• ' + m; }).join('\n') : '') + '\n\nWho will be on top next week? Comment with your level! ⚔'; try { navigator.clipboard.writeText(t); say('Copied. Paste it on Skool!'); } catch (e) { say('Copy did not work in this browser.'); } };
      var sh = b.querySelector('[data-r="share"]'); if (sh) sh.onclick = function () { SHARE.show(); };
    }, function (x) { b.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };
  var JOURNAL = {};
  JOURNAL.show = function () {
    var b = panel('sg-journalp', '📖 Explorer\'s journal', '<p class="sg-wait">…</p>');
    var w = H.world(), hr = w.hero || {};
    (H.lens ? H.lens.api('journey') : Promise.resolve({})).then(function (j) {
      var towns = w.towns.map(function (t) { return '<span class="' + (t.beaten ? 'done' : t.id === w.at ? 'here' : t.open ? 'open' : '') + '">' + (t.open ? t.icon : '🔒') + '<small>' + esc(t.level) + '</small></span>'; }).join('<i></i>');
      b.innerHTML = '<div class="sg-road">' + towns + '</div><p class="small">From early A2 (Chang\'an) to late B1 (Constantinople). Beat each town\'s boss to move on.</p>'
        + '<h4>Your English</h4><div class="sg-stats2"><div><b>' + (j.learning || 0) + '</b><small>words learning</small></div><div><b>' + (j.known || 0) + '</b><small>words known</small></div><div><b>' + (j.saved || 0) + '</b><small>sentences saved</small></div><div><b>' + (j.reviews || 0) + '</b><small>cards reviewed</small></div><div><b>' + (j.writings || 0) + '</b><small>texts written</small></div><div><b>' + (j.speaks || 0) + '</b><small>times you spoke</small></div></div>'
        + '<h4>Your journey</h4><div class="sg-stats2"><div><b>' + (hr.level || 1) + '</b><small>level · ' + esc(hr.title || '') + '</small></div><div><b>' + (hr.kills || 0) + '</b><small>monsters beaten</small></div><div><b>' + (hr.bosses || 0) + '</b><small>bosses beaten</small></div><div><b>' + esc(hr.rank || 'Bronze') + '</b><small>arena rank</small></div><div><b>' + ((hr.duels || {}).won || 0) + '</b><small>duels won</small></div><div><b>' + w.titles.length + '</b><small>titles</small></div></div>'
        + '<div class="sg-opts"><button class="pri" data-j="share">Share my card</button><button data-j="report">This week</button></div>';
      b.querySelector('[data-j="share"]').onclick = function () { SHARE.show(); };
      b.querySelector('[data-j="report"]').onclick = function () { REPORT.show(); };
    }, function (x) { b.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };
  /** Tap a bar in the HUD: what it means, in simple English. */
  var BAR_HELP = {
    hp: ['❤ Health', 'A monster hits you when you answer wrong. When health is 0, you wake up at the inn. Health comes back by itself — faster when you review cards.'],
    mp: ['💧 Mana', 'You get mana when you study: review cards, do your plan, write or speak. Use it in fights for skills like Focus (it removes a wrong answer).'],
    wound: ['🩹 Wounded', 'Every full day without studying, your hero loses a quarter of their health. After 4 days you fall and cannot fight. Study today (5 minutes or more) and the wound is gone. Your clan can heal you a little, or revive you.'],
    clan: ['🛡 Your clan is hurt', 'A clanmate has not studied for 2 days or more, so everyone in your clan has one fight less today. Find them lying at the inn: heal or revive them with your mana, and send them a message!'],
    xp: ['⭐ Level', 'You get XP when you use English: chat messages, writing, speaking, helping other travellers and winning fights. (Review cards give mana and health.) More XP = a higher level, more health, new gear and titles.']
  };

  /* ================================================================ Language Lens inside the game: tap any English word */
  function wrapWords(text, sentence, gap) {
    // words are found in the raw text and escaped piece by piece (escaping first turned &quot; into a tappable “quot”)
    var t = String(text == null ? '' : text), re = /[A-Za-z]+(?:['’][A-Za-z]+)?/g, out = '', last = 0, m, P = function (x) { return gap ? esc(x).replace(/_{2,}/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>') : esc(x); };
    while ((m = re.exec(t))) { out += P(t.slice(last, m.index)) + '<span class="lw">' + esc(m[0]) + '</span>'; last = re.lastIndex; }
    return '<span class="lws" data-s="' + esc(sentence || t) + '">' + out + P(t.slice(last)) + '</span>';
  }
  var LENS = {
    sel: null,
    /** Tap a word: its card. Tap another word in the same sentence while the card is open: the phrase between them ("looks down"). */
    word: function (span) {
      if (!H.lens) return;
      var holder = span.closest('[data-s]') || span.parentNode, list = [].slice.call(holder.querySelectorAll('.lw')), k = list.indexOf(span), S0 = LENS.sel;
      if (S0 && S0.holder === holder && $('.sg-word.on') && k !== S0.a) { S0.a = Math.min(S0.a, k); S0.b = Math.max(S0.b, k); if (S0.b - S0.a > 5) S0.a = S0.b - 5; }
      else LENS.sel = { holder: holder, list: list, a: k, b: k };
      LENS.show();
    },
    show: function () {
      var L = H.lens, sel = LENS.sel, spans = sel.list.slice(sel.a, sel.b + 1), sentence = sel.holder.dataset.s || spans.map(function (x) { return x.textContent; }).join(' ');
      ROOT.querySelectorAll('.lw.on').forEach(function (x) { x.classList.remove('on'); }); spans.forEach(function (x) { x.classList.add('on'); });
      var box = $('.sg-word'); box.classList.add('on'); box.innerHTML = '<div class="sg-wbox"><p class="sg-wait">…</p></div>';
      L.lex().then(function () {
        var words = spans.map(function (x) { return x.textContent; }), many = words.length > 1, said = words.join(' ');
        var lemma = many ? words.map(function (w) { return L.lemmaOf(w); }).join(' ') : L.lemmaOf(said), ms = L.meanings(lemma);
        if (many && !ms.length) { var raw = said.toLowerCase(); ms = L.meanings(raw); if (ms.length) lemma = raw; }
        var save = many && !ms.length ? said.toLowerCase() : lemma, town = H.world().town;
        box.innerHTML = '<div class="sg-wbox"><div class="sg-wh">' + (sel.a > 0 ? '<button class="sg-wx" data-w="left" aria-label="Add the word before">◀ +</button>' : '') + '<b>' + esc(many ? said : lemma) + '</b>' + (sel.b < sel.list.length - 1 ? '<button class="sg-wx" data-w="right" aria-label="Add the next word">+ ▶</button>' : '') + '<button class="sg-x" data-w="x" aria-label="Close">✕</button></div>'
          + (many && lemma !== said.toLowerCase() && ms.length ? '<small>' + esc(lemma) + '</small>' : '')
          + (ms.length ? ms.slice(0, 2).map(function (m) { return '<div class="sg-wm"><small>' + esc(m.pos) + (m.level ? ' · ' + esc(m.level) : '') + '</small><p class="ar" dir="rtl">' + esc(m.ar) + '</p>' + (m.en ? '<p class="en">' + esc(m.en) + '</p>' : '') + '</div>'; }).join('') : '<p class="en">' + (many ? 'This phrase is not in the dictionary — tap “Meaning here”.' : 'Not in the dictionary yet.') + '</p>')
          + '<div class="sg-wai"></div><p class="sg-wctx">“' + esc(sentence.replace(/_{2,}/g, '___').slice(0, 160)) + '”</p>'
          + '<p class="small sg-whint">' + (many ? 'Tap a word in the sentence to change the phrase.' : 'Tap another word in the sentence to look up the phrase (like “looks down”).') + '</p>'
          + '<div class="sg-opts"><button class="pri" data-w="learn">+ Learning</button><button data-w="ai">' + (ms.length ? 'Meaning here (AI)' : 'Explain (AI)') + '</button>' + (many ? '<button data-w="one">Just “' + esc(words[words.length - 1]) + '”</button>' : '') + '</div></div>';
        var on = function (k, fn) { var b = box.querySelector('[data-w="' + k + '"]'); if (b) b.onclick = fn; };
        on('x', LENS.close);
        on('left', function () { sel.a--; LENS.show(); }); on('right', function () { sel.b++; LENS.show(); }); on('one', function () { sel.a = sel.b; LENS.show(); });
        on('learn', function () { var b = this; b.disabled = true; L.api('library/word', { body: { lemma: save, status: 'learning', sentence: sentence, title: 'Silk Road · ' + town.name } }).then(function () { b.textContent = '✓ In your review cards'; say('“' + save + '” is now a review card — it may attack you later!'); }, function (x) { b.disabled = false; say(x.message); }); });
        on('ai', function () { var b = this, out = box.querySelector('.sg-wai'); b.disabled = true; b.textContent = 'Explaining…'; L.api('library/explain', { body: { word: said, sentence: sentence } }).then(function (x) { b.remove(); out.innerHTML = '<p class="ar" dir="rtl">' + esc(x.meaning) + '</p>' + (x.note ? '<p class="ar small" dir="rtl">' + esc(x.note) + '</p>' : ''); }, function (x) { b.disabled = false; b.textContent = 'Try again'; say(x.message); }); });
      });
    },
    close: function () { LENS.sel = null; var b = $('.sg-word'); if (b) { b.classList.remove('on'); b.innerHTML = ''; } if (ROOT) ROOT.querySelectorAll('.lw.on').forEach(function (x) { x.classList.remove('on'); }); }
  };

  /* ================================================================ panels inside the game (chat, review cards, today's plan) */
  function panel(cls, title, html) {
    ROAD.media();
    var p = $('.sg-panel'); p.className = 'sg-panel on ' + cls;
    p.innerHTML = '<div class="sg-pbox"><div class="sg-ph"><b>' + title + '</b><button class="sg-x" data-p="x" aria-label="Close">✕</button></div><div class="sg-pb">' + html + '</div></div>';
    p.querySelector('[data-p="x"]').onclick = closePanel;
    var w = G.phaser && G.phaser.scene.getScene('World'); if (w) w.frozen = true;
    return p.querySelector('.sg-pb');
  }
  function closePanel() {
    var p = $('.sg-panel'); if (p) { p.className = 'sg-panel'; p.innerHTML = ''; }
    clearTimeout(CHAT.t); CHAT.open = false; LENS.close(); ROAD.media(); if (ROAD.cur) { ROAD.cur = ''; var ws = G && G.phaser && G.phaser.scene.getScene('World'); if (ws) ws.lastSync = 0; }
    var w = G.phaser && G.phaser.scene.getScene('World'); if (w) { w.frozen = false; w.cool = w.now() + 800; }
    if (H) H.refreshWorld().then(function () { hud(); }, function () {});
  }

  /* -------- chat: town and party, never leaving the world; Arabic or Franco-Arabic goes through translation */
  /* threads: tap "Reply" (or "N replies") under a message to open its thread inside the same panel; replies count toward today's reply goal */
  var CHAT = { room: 0, rooms: [], msgs: [], t: null, open: false, threads: {}, th: 0, thMsgs: [], thRoot: null, goal: null };
  function agoEn(iso) { var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; }
  CHAT.goalPaint = function () {
    var el = $('.sg-goal'), g = CHAT.goal || (H.world() || {}).replyGoal; if (!el || !g) return;
    el.innerHTML = '<button class="sg-goalb' + (g.done ? ' done' : '') + '">↩ ' + (g.done ? 'Reply goal done!' : 'Replies today') + ' <b>' + Math.min(g.n, g.goal) + '/' + g.goal + '</b><i><i style="width:' + Math.min(100, Math.round(g.n / g.goal * 100)) + '%"></i></i></button>';
    el.querySelector('button').onclick = function () { say('Reply to other travellers (3+ English words, or a 5-second voice note): +' + g.xp + ' XP each, and +' + g.bonus + ' XP and ' + g.coins + ' coins at ' + g.goal + '. Replies to yourself, stickers, copies and very fast replies don\'t count.', 7000); };
  };
  CHAT.show = function (roomId) {
    var w = H.world(); CHAT.open = true; CHAT.th = 0;
    CHAT.rooms = [{ id: w.town.room, name: '💬 Community' }]; // one chat for the whole community
    var go = function () {
      CHAT.room = roomId || CHAT.room && CHAT.rooms.some(function (r) { return r.id === CHAT.room; }) && CHAT.room || CHAT.rooms[0].id;
      var b = panel('sg-chatp', '💬 Chat', '<div class="sg-goal"></div><div class="sg-tabs">' + CHAT.rooms.map(function (r) { return '<button data-room="' + r.id + '"' + (r.id === CHAT.room ? ' class="on"' : '') + '>' + esc(r.name) + '</button>'; }).join('') + '</div><div class="sg-msgs"><p class="sg-wait">…</p></div><div class="sg-tr"></div><div class="sg-mp"></div><div class="sg-send"><input maxlength="500" placeholder="Write in English — or in Arabic to get help" dir="auto"><button class="pri">Send</button></div>');
      b.querySelectorAll('[data-room]').forEach(function (x) { x.onclick = function () { CHAT.show(+x.dataset.room); }; });
      var inp = b.querySelector('.sg-send input');
      inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') CHAT.send(); };
      inp.oninput = function () { CHAT.mentionInput(inp); };
      b.querySelector('.sg-send button').onclick = CHAT.send;
      CHAT.msgs = []; CHAT.threads = {}; CHAT.goalPaint(); CHAT.load();
      H.api('/chat/rooms').then(function (j) { if (j.replyGoal) { CHAT.goal = j.replyGoal; CHAT.goalPaint(); } }, function () {});
    };
    if (w.party) H.api('/party').then(function (j) { if (j.party) CHAT.rooms.push({ id: j.party.room, name: '⚔ ' + j.party.name }); go(); }, go); else go();
  };
  CHAT.load = function () {
    if (!CHAT.open) return;
    if (CHAT.th) return CHAT.loadThread();
    var after = CHAT.msgs.length ? CHAT.msgs[CHAT.msgs.length - 1].id : 0, room = CHAT.room;
    H.api('/chat/rooms/' + room + '/messages', after ? { query: { after: after } } : {}).then(function (j) {
      if (!CHAT.open || room !== CHAT.room || CHAT.th) return;
      var before = JSON.stringify(CHAT.threads); Object.keys(j.threads || {}).forEach(function (k) { CHAT.threads[k] = j.threads[k]; });
      var me = H.me().id, ping = after && j.messages.filter(function (m) { return m.pingsMe && m.who && m.who.id !== me; })[0];
      if (ping) say('🔔 ' + ping.who.name.split(' ')[0] + (ping.ping === 'everyone' ? ' mentioned everyone' : ' mentioned you') + ' in the chat', 5000);
      if (j.messages.length || !after || JSON.stringify(CHAT.threads) !== before) { CHAT.msgs = after ? CHAT.msgs.concat(j.messages) : j.messages; CHAT.paint(); }
      clearTimeout(CHAT.t); CHAT.t = setTimeout(CHAT.load, 4000);
    }, function () { clearTimeout(CHAT.t); CHAT.t = setTimeout(CHAT.load, 8000); });
  };
  CHAT.msgHtml = function (m, me, inThread) {
    var mine = m.who && m.who.id === me, txt = m.gone ? '<i>removed</i>' : m.body ? wrapWords(m.body) : m.audio ? '🎤 voice message' + (m.transcript ? ': ' + wrapWords(m.transcript) : '') : m.kind === 'gif' ? 'GIF' : m.kind === 'sticker' ? 'Sticker' : '';
    var th = !inThread && CHAT.threads[m.id] && CHAT.threads[m.id].n ? CHAT.threads[m.id] : null;
    var foot = inThread || m.gone ? '' : '<div class="sg-mf">' + (th ? '<button class="sg-thr' + (th.unread ? ' new' : '') + '" data-th="' + m.id + '">💬 ' + th.n + (th.n === 1 ? ' reply' : ' replies') + ' · ' + agoEn(th.last) + (th.unread ? ' <em>' + th.unread + ' new</em>' : '') + '</button>' : '<button class="sg-thr" data-th="' + m.id + '">↩ Reply</button>') + '</div>';
    return '<div class="sg-m' + (mine ? ' me' : '') + (m.pingsMe ? ' ping' : '') + '"><b>' + esc(m.who ? m.who.name.split(' ')[0] : '') + (m.pingsMe ? ' 🔔' : '') + '</b><p>' + txt + (m.translated ? ' <small>🌐 translated</small>' : '') + '</p>' + foot + '</div>';
  };
  CHAT.bindThreads = function (box) { box.querySelectorAll('[data-th]').forEach(function (x) { x.onclick = function (e) { e.stopPropagation(); CHAT.openThread(+x.dataset.th); }; }); };
  CHAT.paint = function () {
    var box = $('.sg-msgs'); if (!box || CHAT.th) return; var me = H.me().id;
    box.innerHTML = CHAT.msgs.length ? CHAT.msgs.slice(-40).map(function (m) { return CHAT.msgHtml(m, me); }).join('') : '<p class="sg-empty">No messages yet. Say hello in English!</p>';
    CHAT.bindThreads(box);
    box.scrollTop = box.scrollHeight;
  };
  CHAT.openThread = function (id) {
    CHAT.th = id; CHAT.thMsgs = []; CHAT.thRoot = CHAT.msgs.filter(function (m) { return m.id === id; })[0] || null;
    var tabs = $('.sg-chatp .sg-tabs'); if (tabs) tabs.innerHTML = '<button data-thx="1">← Back to the chat</button><span class="sg-thl">🧵 Thread</span>';
    var bk = tabs && tabs.querySelector('[data-thx]'); if (bk) bk.onclick = CHAT.closeThread;
    var inp = $('.sg-send input'); if (inp) inp.placeholder = 'Reply in the thread, in English';
    CHAT.paintThread(); clearTimeout(CHAT.t); CHAT.loadThread();
  };
  CHAT.closeThread = function () { CHAT.th = 0; CHAT.show(CHAT.room); };
  CHAT.loadThread = function () {
    var id = CHAT.th; if (!CHAT.open || !id) return;
    var after = CHAT.thMsgs.length ? CHAT.thMsgs[CHAT.thMsgs.length - 1].id : 0;
    H.api('/chat/threads/' + id, after ? { query: { after: after } } : {}).then(function (j) {
      if (!CHAT.open || CHAT.th !== id) return;
      CHAT.thRoot = j.root; if (j.replyGoal) { CHAT.goal = j.replyGoal; CHAT.goalPaint(); }
      if (j.messages.length || !after) { CHAT.thMsgs = CHAT.thMsgs.concat(j.messages); CHAT.paintThread(); }
      if (CHAT.threads[id]) CHAT.threads[id].unread = 0;
      clearTimeout(CHAT.t); CHAT.t = setTimeout(CHAT.load, 4000);
    }, function (x) { say(x.message); CHAT.closeThread(); });
  };
  CHAT.paintThread = function () {
    var box = $('.sg-msgs'); if (!box || !CHAT.th) return; var me = H.me().id, n = CHAT.thMsgs.length;
    box.innerHTML = (CHAT.thRoot ? CHAT.msgHtml(CHAT.thRoot, me, true) : '') + '<p class="sg-thd">' + (n ? n + (n === 1 ? ' reply' : ' replies') : 'No replies yet — be the first!') + '</p>' + CHAT.thMsgs.map(function (m) { return CHAT.msgHtml(m, me, true); }).join('');
    box.scrollTop = box.scrollHeight;
  };
  CHAT.send = function () {
    var inp = $('.sg-send input'); if (!inp) return; var v = inp.value.trim(); if (!v) return;
    if (H.needsTr(v)) return CHAT.translate(v);
    CHAT.post({ body: v }, inp);
  };
  /* @mentions: type @ and a name; @everyone for admins (the game chats are town and party rooms, so no @clan here) */
  CHAT.picks = [];
  CHAT.mentionInput = function (inp) {
    var box = $('.sg-mp'); if (!box) return;
    var m = inp.value.slice(0, inp.selectionStart || inp.value.length).match(/(^|\s)@([^\s@]{0,20})$/);
    if (!m) { box.innerHTML = ''; return; }
    var q = m[2].toLowerCase(), room = CHAT.room;
    clearTimeout(CHAT.mt);
    CHAT.mt = setTimeout(function () {
      H.api('/members', { query: { q: q, room: room } }).then(function (j) {
        var b = $('.sg-mp'); if (!b) return;
        var opts = (H.isAdmin() && 'everyone'.indexOf(q) === 0 ? [{ name: 'everyone', id: 0 }] : []).concat(j.members.slice(0, 5));
        b.innerHTML = opts.map(function (p) { return '<button data-mid="' + p.id + '" data-mname="' + esc(p.name) + '">@' + esc(p.name) + '</button>'; }).join('');
        b.querySelectorAll('[data-mid]').forEach(function (x) { x.onclick = function () {
          var v = inp.value, pos = inp.selectionStart || v.length, start = v.slice(0, pos).replace(/@([^\s@]{0,20})$/, '@' + x.dataset.mname + ' ');
          inp.value = start + v.slice(pos); inp.focus();
          if (+x.dataset.mid) CHAT.picks.push({ id: +x.dataset.mid, name: x.dataset.mname });
          b.innerHTML = '';
        }; });
      }, function () {});
    }, 200);
  };
  CHAT.takeMentions = function (text) {
    var low = String(text || '').toLowerCase(), ids = CHAT.picks.filter(function (p) { return low.indexOf('@' + p.name.toLowerCase()) >= 0; }).map(function (p) { return p.id; });
    CHAT.picks = []; var b = $('.sg-mp'); if (b) b.innerHTML = '';
    return ids;
  };
  CHAT.post = function (body, inp) {
    var th = CHAT.th;
    body.mentions = CHAT.takeMentions(body.body);
    if (th) {
      var tafter = CHAT.thMsgs.length ? CHAT.thMsgs[CHAT.thMsgs.length - 1].id : 0;
      return H.api('/chat/threads/' + th, { method: 'POST', body: body, query: { after: tafter } }).then(function (j) {
        if (inp) inp.value = ''; var tr = $('.sg-tr'); if (tr) tr.innerHTML = '';
        if (CHAT.th === th) { CHAT.thMsgs = CHAT.thMsgs.concat(j.messages || []); CHAT.paintThread(); }
        CHAT.replySay(j);
      }, function (x) { say(x.message, 4500); });
    }
    var after = CHAT.msgs.length ? CHAT.msgs[CHAT.msgs.length - 1].id : 0, room = CHAT.room;
    H.api('/chat/rooms/' + room + '/messages', { method: 'POST', body: body, query: { after: after } }).then(function (j) {
      if (inp) inp.value = ''; var tr = $('.sg-tr'); if (tr) tr.innerHTML = '';
      CHAT.msgs = CHAT.msgs.concat(j.messages || []); CHAT.paint();
      var w = G.phaser.scene.getScene('World'); if (w && room === H.world().town.room) w.bubble = { text: body.body, until: Date.now() + 7000 };
      CHAT.replySay(j);
    }, function (x) { say(x.message, 4500); });
  };
  /** XP toast after sending, and how the reply did on today's reply goal. */
  CHAT.replySay = function (j) {
    if (j.replyGoal) { CHAT.goal = j.replyGoal; CHAT.goalPaint(); }
    var r = j.reply, xp = (j.xp && (j.xp.gained || j.xp)) || 0;
    if (r && r.counted) { xp += r.xp || 0; say(r.bonus ? '🎉 Reply goal done! +' + xp + ' XP and ' + r.coins + ' coins' : '+' + xp + ' XP · reply counted: ' + Math.min(r.n, r.goal) + '/' + r.goal, 4500); }
    else if (r && r.why && r.why !== 'sticker') say({ short: 'Sent! To count for your reply goal, write 3+ English words.', same: 'Sent — but the same reply again doesn\'t count for the goal.', fast: 'Sent! Very fast replies in a row don\'t count — take your time.', person: 'You replied to this person 4 times today. Reply to someone else to count.' }[r.why] || '', 5000);
    else if (xp) say('+' + xp + ' XP for writing in English');
  };
  CHAT.translate = function (text) {
    var tr = $('.sg-tr'); tr.innerHTML = '<p class="sg-wait">Translating…</p>';
    H.api('/chat/translate', { method: 'POST', body: { text: text } }).then(function (j) {
      tr.innerHTML = '<p class="small">Your message in English — check it, change it if you like, then send:</p><textarea rows="2" dir="ltr" maxlength="1000">' + esc(j.english) + '</textarea>'
        + (j.phrases && j.phrases.length ? '<p class="small">Learn from it: ' + j.phrases.map(function (p) { return '<b>' + esc(p.en) + '</b> <span dir="rtl">' + esc(p.ar) + '</span>'; }).join(' · ') + '</p>' : '')
        + '<div class="sg-opts"><button class="pri" data-t="send">Send in English</button><button data-t="x">Edit again</button></div>';
      var ta = tr.querySelector('textarea'); ta.onkeydown = function (e) { e.stopPropagation(); };
      tr.querySelector('[data-t="x"]').onclick = function () { tr.innerHTML = ''; };
      tr.querySelector('[data-t="send"]').onclick = function () { var en = ta.value.trim(); if (!en) return; if (H.needsTr(en) && !H.isAdmin()) return say('Send it in English — change the Arabic words.'); CHAT.post({ body: en, orig: text }, $('.sg-send input')); };
    }, function (x) { tr.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };

  /* -------- review cards (the same cards as the Review tab), done at the inn or anywhere */
  var REV = { q: [], i: 0, done: 0 };
  REV.show = function () {
    if (!H.lens) return H.go('review');
    var b = panel('sg-revp', '🃏 Review cards', '<p class="sg-wait">Loading your cards…</p>');
    Promise.all([H.lens.api('review'), H.lens.lex()]).then(function (r) {
      REV.q = r[0].cards; REV.done = 0; REV.stats = r[0].stats || {}; REV.change = REV.stats.level && REV.stats.level.change || '';
      if (REV.change === 'up') say('🎉 Card level up! You get more new cards a day now.', 5000);
      REV.card();
    }, function (x) { b.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };
  REV.front = function (c) {
    if (c.type === 'word') return '<small>Word · what does it mean?</small><p class="sg-cw">' + esc(c.lemma) + '</p>' + (c.text ? '<p class="sg-cs">“' + wrapWords(c.text) + '”</p>' : '') + (c.title ? '<small>from ' + esc(c.title) + '</small>' : '');
    if (c.type === 'mistake') return '<small>Your mistake · fix it in your head</small><p class="sg-cs">' + wrapWords(c.sentence) + '</p>';
    return '<small>' + (c.type === 'phrase' ? 'Phrase' : 'Sentence') + ' · do you understand it?</small>' + (c.focus ? '<p class="sg-cw">' + esc(c.focus) + '</p>' : '') + '<p class="sg-cs">' + wrapWords(c.text || '') + '</p>';
  };
  REV.back = function (c) {
    if (c.type === 'word') { var ms = H.lens.meanings(c.lemma); return ms.length ? ms.slice(0, 3).map(function (m) { return '<div class="sg-wm"><small>' + esc(m.pos) + (m.level ? ' · ' + esc(m.level) : '') + '</small><p class="ar" dir="rtl">' + esc(m.ar) + '</p>' + (m.en ? '<p class="en">' + esc(m.en) + '</p>' : '') + '</div>'; }).join('') : '<p class="en">Not in the dictionary — tap the word in the sentence for help.</p>'; }
    if (c.type === 'mistake') return '<p class="sg-cs ok">✓ ' + wrapWords(c.fixed) + '</p>' + (c.why ? '<p class="en">' + esc(c.why) + '</p>' : '') + (c.why_ar ? '<p class="ar" dir="rtl">' + esc(c.why_ar) + '</p>' : '');
    return c.ar ? '<p class="ar" dir="rtl">' + esc(c.ar) + '</p>' : '<button data-r="ar">Show the Arabic translation</button><p class="ar" dir="rtl" data-r="arout"></p>';
  };
  /** Card level and memory (FSRS on the Sawa Lens side): level dots, new cards a day, % remembered this week, catch-up mode. */
  REV.head = function () {
    var s = REV.stats || {}, L = s.level; if (!L || typeof L !== 'object') return '';
    var dots = ''; for (var i = 1; i <= (L.levels || L.level); i++) dots += '<i' + (i <= L.level ? ' class="on"' : '') + '></i>';
    return '<div class="sg-rvl"><div class="sg-rvl1"><b>Card level ' + L.level + '</b><span class="sg-dots" aria-hidden="true">' + dots + '</span><span>' + L.newPerDay + ' new card' + (L.newPerDay === 1 ? '' : 's') + ' a day</span></div>'
      + (s.retention != null ? '<small>🧠 ' + s.retention + '% remembered this week</small>' : '<small>🧠 Review a few days to see how much you remember</small>')
      + (L.catchup ? '<p class="sg-catch">⏳ Catch-up time: finish your reviews, then new cards come back.</p>' : '')
      + (REV.change === 'up' ? '<p class="sg-lvch up">🎉 Level up! Now ' + L.newPerDay + ' new cards a day.</p>' : REV.change === 'down' ? '<p class="sg-lvch down">Level ' + L.level + ' for now: fewer new cards (' + L.newPerDay + ' a day), so reviews stay easy to finish. Keep going and it comes back up.</p>' : '')
      + '</div>';
  };
  REV.card = function () {
    var b = $('.sg-revp .sg-pb'); if (!b) return;
    var c = REV.q[0];
    if (!c) {
      b.innerHTML = REV.head() + '<div class="sg-card"><p class="sg-cw">' + (REV.done ? '✓ ' + REV.done + ' card' + (REV.done > 1 ? 's' : '') + ' done' : 'No cards due right now') + '</p><p class="en">' + (REV.done ? 'Well done, traveller. Your plan step counts, and the words you review are the ones monsters attack with.' : 'Save new words — tap any word in the game and press “+ Learning”.') + '</p><div class="sg-opts"><button class="pri" data-p="x">Back to the road</button></div></div>';
      b.querySelector('[data-p="x"]').onclick = closePanel;
      if (ROAD.cur === 'cards') ROAD.finish('cards', b);
      return;
    }
    b.innerHTML = REV.head() + '<p class="small">' + REV.q.length + ' left · ' + REV.done + ' done</p><div class="sg-card">' + REV.front(c) + '<div class="sg-back"></div></div><div class="sg-opts sg-ra"><button class="pri" data-r="flip">Show answer</button></div>';
    b.querySelector('[data-r="flip"]').onclick = function () {
      var bk = b.querySelector('.sg-back'); bk.innerHTML = '<hr>' + REV.back(c);
      var ar = bk.querySelector('[data-r="ar"]'); if (ar) ar.onclick = function () { ar.disabled = true; H.lens.api('library/translate', { body: { uuid: c.uuid } }).then(function (j) { ar.remove(); bk.querySelector('[data-r="arout"]').textContent = j.ar; }, function (x) { say(x.message); ar.disabled = false; }); };
      var nx = c.next || ['again', '', '', ''];
      b.querySelector('.sg-ra').innerHTML = [['Again', 1], ['Hard', 2], ['Good', 3], ['Easy', 4]].map(function (g, k) { return '<button data-g2="' + g[1] + '"' + (g[1] === 3 ? ' class="pri"' : '') + '>' + g[0] + (nx[k] && nx[k] !== 'again' ? '<small> ' + esc(nx[k]) + '</small>' : '') + '</button>'; }).join('');
      b.querySelectorAll('[data-g2]').forEach(function (gb) { gb.onclick = function () { b.querySelectorAll('[data-g2]').forEach(function (x) { x.disabled = true; }); H.lens.api('review', { body: { key: c.key, grade: +gb.dataset.g2 } }).then(function (j) { REV.q.shift(); if (+gb.dataset.g2 === 1) REV.q.push(c); else REV.done++; if (j.known) say('🎉 “' + c.lemma + '” is now a known word!'); REV.card(); }, function (x) { say(x.message); b.querySelectorAll('[data-g2]').forEach(function (x2) { x2.disabled = false; }); }); }; });
    };
  };

  /* -------- rankings: level, this week, arena */
  var RANKS = {};
  RANKS.show = function (tab) {
    tab = tab || 'level';
    var b = panel('sg-ranksp', '🏆 Rankings', '<p class="sg-wait">…</p>');
    H.api('/world/ranks').then(function (d) {
      var bd = d[tab], label = { level: 'Level', week: 'This week', arena: 'Arena' };
      b.innerHTML = '<div class="sg-tabs">' + Object.keys(label).map(function (k) { return '<button data-rt="' + k + '"' + (k === tab ? ' class="on"' : '') + '>' + label[k] + '</button>'; }).join('') + '</div>'
        + '<p class="small">' + (tab === 'level' ? 'Your level grows with every word you learn and write.' : tab === 'week' ? 'XP earned since the start of the week. Everyone starts again on Saturday.' : 'Shadow duels move your arena rating up or down.') + (bd.me ? ' You are <b>#' + bd.me + '</b>.' : '') + '</p>'
        + '<ol class="sg-rank">' + bd.top.map(function (p, k) { var v = tab === 'level' ? 'Lv ' + p.level : tab === 'week' ? p.week + ' XP' : p.rating + ' · ' + p.rank; return '<li class="' + (p.id === H.me().id ? 'me' : '') + '"><span>' + (k < 3 ? ['🥇', '🥈', '🥉'][k] : k + 1) + '</span>' + (p.avatar ? '<img src="' + esc(p.avatar) + '" alt="">' : '') + '<div><b>' + esc(p.name) + '</b><small>' + esc(p.title) + '</small></div><em>' + esc(v) + '</em></li>'; }).join('') + '</ol>';
      b.querySelectorAll('[data-rt]').forEach(function (x) { x.onclick = function () { RANKS.show(x.dataset.rt); }; });
    }, function (x) { b.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };

  /* -------- today's plan (the same plan as the Today tab) */
  var TODAY = {};
  /** The daily reply goal under the plan (from the tracker; it isn't a plan step, so it doesn't change fights). */
  TODAY.replyRow = function () {
    var g = CHAT.goal || (H.world() || {}).replyGoal; if (!g) return '';
    return '<li class="' + (g.done ? 'done' : '') + '"><span>' + (g.done ? '✓' : '↩') + '</span><div><b>Reply to ' + g.goal + ' messages from other travellers</b><small>' + Math.min(g.n, g.goal) + '/' + g.goal + ' today · +' + g.xp + ' XP each, +' + g.bonus + ' XP at the end</small></div>' + (g.done ? '' : '<button data-go="reply" class="pri">Do it here</button>') + '</li>';
  };
  TODAY.show = function () {
    if (!H.lens) return H.go('today');
    var b = panel('sg-todayp', '📅 Today\'s plan', '<p class="sg-wait">…</p>');
    H.lens.api('today').then(function (d) {
      var inGame = { review: 1, use: 1, log: 1 };
      b.innerHTML = '<p class="small">Every step gives you one more fight today' + (d.perfect ? ' — and you had a perfect day! 🌟' : '.') + '</p><ul class="sg-plan">' + d.items.map(function (it) {
        return '<li class="' + (it.done ? 'done' : '') + '"><span>' + (it.done ? '✓' : '○') + '</span><div><b>' + esc(it.t) + '</b><small>' + esc(it.sub || '') + '</small></div>' + (it.done ? '' : '<button data-go="' + esc(it.k) + '" data-to="' + esc(it.go || '') + '"' + (inGame[it.k] ? ' class="pri"' : '') + '>' + (inGame[it.k] ? 'Do it here' : 'Go') + '</button>') + '</li>';
      }).join('') + TODAY.replyRow() + '</ul>';
      b.querySelectorAll('[data-go]').forEach(function (x) { x.onclick = function () { var k = x.dataset.go; if (k === 'reply') CHAT.show(); else if (k === 'review') REV.show(); else if (k === 'use') CHAT.show(); else if (k === 'log') { closePanel(); H.log(); } else H.go(x.dataset.to || (k === 'collect' ? 'scan' : k)); }; });
    }, function (x) { b.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };

  /* ================================================================ the learning road: five camps between the east gate and the boss
     📺 video → 🎵 song → 📖 story → 🃏 the day's cards → ✍️ write, once a day. Each camp opens a Sawa Lens feature here in the game
     (Sawa Lens counts the study itself: XP, study minutes, the tracker log); finishing one opens the next. Monsters never attack at a camp. */
  var ROAD = { cur: '', v: null, x: { video: 42, song: 46.5, story: 51, cards: 55.5, write: 60 }, verb: { video: 'watching', song: 'singing', story: 'reading', cards: 'reviewing', write: 'writing' } };
  ROAD.icon = { video: '📺', song: '🎵', story: '📖', cards: '🃏', write: '✍️' };
  /** Once: the Elder shows the new road (guidance inside the game). */
  ROAD.intro = function () {
    var r = ROAD.data(); if (!running || !r.total || busyNow()) return;
    try { if (localStorage.getItem('sawaRoadIntro')) return; localStorage.setItem('sawaRoadIntro', '1'); } catch (e) { return; }
    var nx = ROAD.st(r.next) || r.stations[0];
    dialog.who = 'elder';
    dialog('Elder Wen', 'Traveller, look east! Between our gate and the beast there are ' + r.total + ' camps now: ' + r.stations.map(function (x) { return x.icon + ' ' + x.name.toLowerCase(); }).join(', ') + '. Walk the road every day: finish a camp and the next one opens. All you study there counts by itself — no need to report it anywhere. The strip at the bottom takes you to any camp.', [{ label: nx.icon + ' Take me to the first camp', primary: true, run: function () { ROAD.goTo(nx.k, true); } }], '👴');
  };
  var CAMP_C = { video: '#c0392b', song: '#8e44ad', story: '#2e86c1', cards: '#c99a2e', write: '#239b56' };
  var PROMPTS = ['Tell a traveller about your day yesterday. What did you do?', 'Describe your town or city to a traveller who has never been there.', 'What do you like to do at the weekend, and why?', 'Write about someone in your family. What are they like?', 'Where do you want to travel one day? Why there?', 'What is your favourite food, and how do you make it?', 'What did you learn on the road today? Use two of your new words.', 'Write a short message to a friend: invite them to do something with you this week.'];
  function drawCamp(k) {
    var c = cnv(24, 28), g = c.getContext('2d'), col = CAMP_C[k] || '#c98a2e';
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(2, 26, 20, 2);
    g.fillStyle = col; g.beginPath(); g.moveTo(12, 7); g.lineTo(22, 26); g.lineTo(2, 26); g.closePath(); g.fill();
    g.fillStyle = tone(col, -0.35); g.beginPath(); g.moveTo(12, 7); g.lineTo(22, 26); g.lineTo(16, 26); g.closePath(); g.fill();
    g.fillStyle = '#2b2233'; g.beginPath(); g.moveTo(12, 15); g.lineTo(15.5, 26); g.lineTo(8.5, 26); g.closePath(); g.fill();
    px(g, 11, 1, '#5a3a22', 1, 7); px(g, 12, 1, '#ffe39a', 6, 2); px(g, 12, 3, '#e7c873', 4, 1);
    px(g, 19, 23, '#5a3a22', 4, 2); px(g, 20, 21, '#ff9a3a', 2, 2); px(g, 20, 20, '#ffe08a', 1, 1); // a small campfire
    return c;
  }
  ROAD.data = function () { var r = H && H.lens && H.world() && H.world().road; return r && r.stations ? r : { stations: [], total: 0, done: 0, next: '' }; };
  ROAD.st = function (k) { return ROAD.data().stations.filter(function (s) { return s.k === k; })[0]; };
  ROAD.y = function (x) { return 19 + Math.round(Math.sin(Math.floor(x) / 5) * 2); }; // the road's top row there (see buildMap)
  ROAD.scene = function () { return G && G.phaser && G.phaser.scene.getScene('World'); };
  /** The strip at the bottom of the screen: today's camps, tap one to go there. */
  ROAD.strip = function () {
    if (!ROOT) return;
    var r = ROAD.data(), box = $('.sg-road');
    if (!box) { box = el('div', 'sg-road'); ROOT.insertBefore(box, $('.sg-battle')); }
    box.classList.toggle('on', !!r.total);
    if (!r.total) { box.innerHTML = ''; return; }
    var b = H.world().town.boss;
    box.innerHTML = '<small>' + (r.complete ? '✓ Today\'s road is done!' : 'Today\'s road · ' + r.done + '/' + r.total) + '</small><div>' + r.stations.map(function (s) {
      return '<button data-road="' + s.k + '" class="' + s.state + '" aria-label="' + esc(s.name) + ' camp: ' + s.state + '">' + s.icon + (s.state === 'done' ? '<i>✓</i>' : '') + '</button>';
    }).join('') + '<button data-road="boss" class="boss" aria-label="The boss">' + esc(b.icon) + '</button></div>';
  };
  ROAD.tapStrip = function (k) {
    if (GAME.cur || $('.sg-battle.on') || $('.sg-panel.on')) return;
    if (k === 'boss') return ROAD.toBoss();
    var s = ROAD.st(k); if (!s) return;
    if (s.state === 'locked') return ROAD.open(k);
    ROAD.goTo(k, true);
  };
  /** Walk (quickly) to a camp: the character stands at the camp, so other travellers see where you are. */
  ROAD.goTo = function (k, open) {
    var S = ROAD.scene(); if (!S || !S.pl) return;
    closeDialog();
    var x = ROAD.x[k] * TS, y = (ROAD.y(ROAD.x[k]) + 1.4) * TS;
    S.cameras.main.fadeOut(180);
    S.time.delayedCall(200, function () { S.pl.setPosition(x, y); S.pl.dir = 3; S.cameras.main.fadeIn(300); S.cool = S.now() + 3000; S.lastSync = 0; if (open) ROAD.open(k); });
  };
  ROAD.toBoss = function () {
    var S = ROAD.scene(), b = H.world().town.boss; if (!S || !S.pl) return;
    if (b.beaten && !b.rematch) return say('You defeated the ' + b.name + '. The road east is open!', 4000);
    S.cameras.main.fadeOut(180);
    S.time.delayedCall(200, function () { S.pl.setPosition(61 * TS, 27.5 * TS); S.pl.dir = 2; S.cameras.main.fadeIn(300); S.cool = S.now() + 3000; say('The ' + b.name + ' waits in its lair, just south-east of here.', 4000); });
  };
  ROAD.open = function (k) {
    var s = ROAD.st(k); if (!s) return;
    if (s.state === 'locked') {
      var nx = ROAD.st(ROAD.data().next) || s;
      return dialog('Road sign', 'The ' + s.icon + ' ' + s.name.toLowerCase() + ' camp opens after the ' + nx.icon + ' ' + nx.name.toLowerCase() + ' camp. One camp at a time, traveller!', [{ label: 'Take me to the ' + nx.name.toLowerCase() + ' camp', primary: true, run: function () { ROAD.goTo(nx.k, true); } }], '🪧');
    }
    ROAD.cur = k; var S = ROAD.scene(); if (S) S.lastSync = 0; // tell the others where you are now
    ROAD[k](s);
  };
  /** Stop the video and the song (when the panel closes or changes). */
  ROAD.media = function () {
    var V = ROAD.v; if (V) { clearInterval(V.tm); try { if (V.p && V.p.destroy) V.p.destroy(); } catch (e) { /* gone */ } ROAD.v = null; }
    if (ROOT) ROOT.querySelectorAll('.sg-panel audio').forEach(function (a) { try { a.pause(); } catch (e) { /* gone */ } });
  };
  ROAD.err = function (b) { return function (x) { if (b && b.isConnected) b.innerHTML = '<p class="sg-err">' + esc(x && x.message || 'Something went wrong. Try again.') + '</p>'; }; };
  /** A camp finished: the next one opens (the server checks the order). The whole road: a bonus, a line in the feed, the share card. */
  ROAD.finish = function (k, b) {
    var s = ROAD.st(k);
    if (!s || s.state === 'done') { if (b) ROAD.after(b, null); return Promise.resolve(null); }
    return H.api('/world/road', { method: 'POST', body: { station: k } }).then(function (j) {
      if (j.world) H.setWorld(j.world); hud(); SFX.quest();
      var nx = ROAD.st(j.road.next);
      say(j.complete ? '🎉 You walked the whole road today! +' + j.coins + ' 🪙 +1 ⚗' : '✓ ' + s.icon + ' ' + s.name + ' camp done! +' + j.coins + ' 🪙' + (nx ? ' · next: ' + nx.icon + ' ' + nx.name : ''), 5000);
      if (b) ROAD.after(b, j);
      return j;
    }, function (x) { say(x.message, 4500); });
  };
  /** Under a finished camp: the way on (the next camp, or the boss and the share card when the road is done). */
  ROAD.after = function (b, j) {
    if (!b.isConnected || b.querySelector('.sg-ron')) return;
    var r = ROAD.data(), nx = ROAD.st(r.next), d = el('div', 'sg-ron');
    d.innerHTML = j && j.complete
      ? '<b>🎉 You walked the whole road today!</b><p class="small">+' + j.coins + ' 🪙 +1 ⚗' + (j.xp ? ' +' + j.xp + ' XP' : '') + '. Your study counts by itself: the minutes are in your log already, no need to report them.</p><div class="sg-opts"><button class="pri" data-rn="boss">' + esc(H.world().town.boss.icon) + ' To the boss</button><button data-rn="share">📣 Share it on Skool</button></div>'
      : nx ? '<p class="small">Next on your road:</p><div class="sg-opts"><button class="pri" data-rn="' + nx.k + '">' + nx.icon + ' ' + esc(nx.name) + ' camp →</button></div>'
        : '<p class="small">✓ Today\'s road is done. Doing a camp again still counts as study.</p>';
    b.appendChild(d);
    d.querySelectorAll('[data-rn]').forEach(function (x) {
      x.onclick = function () { var k = x.dataset.rn; if (k === 'share') return SHARE.show('I walked the whole learning road today'); closePanel(); if (k === 'boss') ROAD.toBoss(); else ROAD.goTo(k, true); };
    });
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  /** Words you can tap (the Lens word card), paragraph by paragraph. */
  ROAD.paras = function (list) { return list.map(function (p) { return '<p>' + wrapWords(p) + '</p>'; }).join(''); };
  ROAD.targets = function (b, targets, src, title) {
    if (!targets || !targets.length) return '';
    setTimeout(function () {
      b.querySelectorAll('[data-tw]').forEach(function (x) {
        x.onclick = function () { var t = targets[+x.dataset.tw]; x.disabled = true; H.lens.api('library/word', { body: { lemma: H.lens.lemmaOf(t.word), status: 'learning', sentence: (src.filter(function (p) { return p.toLowerCase().indexOf(t.word.toLowerCase()) >= 0; })[0] || '').slice(0, 600), title: title } }).then(function () { x.textContent = '✓'; say('“' + t.word + '” is now a review card.'); }, function (e) { x.disabled = false; say(e.message); }); };
      });
    }, 0);
    return '<h4>New words</h4><ul class="sg-tw">' + targets.map(function (t, i) { return '<li><b dir="ltr">' + esc(t.word) + '</b><small dir="ltr">' + esc(t.en || '') + '</small><span dir="rtl">' + esc(t.ar || '') + '</span><button data-tw="' + i + '" aria-label="Add to review cards">＋</button></li>'; }).join('') + '</ul>';
  };
  /** Multiple-choice questions, one after another; done(right, total). */
  ROAD.quiz = function (box, qs, done) {
    var i = 0, right = 0;
    (function one() {
      if (i >= qs.length) return done(right, qs.length);
      var q = qs[i];
      box.innerHTML = '<p class="small">' + (i + 1) + ' / ' + qs.length + '</p><p><b>' + wrapWords(q.q, null, true) + '</b></p><div class="sg-vops">' + q.options.map(function (o, k) { return '<button data-k="' + k + '" dir="ltr">' + esc(o) + '</button>'; }).join('') + '</div>';
      box.querySelectorAll('[data-k]').forEach(function (x) {
        x.onclick = function () {
          var ok = +x.dataset.k === +q.answer; if (ok) right++;
          box.querySelectorAll('[data-k]').forEach(function (y) { y.disabled = true; if (+y.dataset.k === +q.answer) y.classList.add('ok'); });
          if (!ok) x.classList.add('no');
          if (ok) SFX.coin(); else SFX.blocked();
          i++; setTimeout(one, ok ? 700 : 1600);
        };
      });
    })();
  };

  /* -------- 📺 the video camp: Sherif's video quizzes (Sawa Lens lessons) in the official YouTube player */
  ROAD.yt = function () {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    return new Promise(function (ok, no) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) { try { prev(); } catch (e) { /* theirs */ } } ok(window.YT); };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) { var sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = function () { no(new Error('The video player could not load. Check your internet and try again.')); }; document.head.appendChild(sc); }
      var n = 0, w = setInterval(function () { if (window.YT && window.YT.Player) { clearInterval(w); ok(window.YT); } else if (++n > 60) { clearInterval(w); no(new Error('The video player could not load. Try again.')); } }, 250);
    });
  };
  ROAD.video = function () {
    var b = panel('sg-roadp sg-vidp', '📺 Video camp', '<p class="sg-wait">Loading the videos…</p>');
    H.lens.api('videos').then(function (d) {
      var list = d.lessons || [];
      if (!list.length) { b.innerHTML = '<p>No videos at this camp yet. Sherif adds new ones often!</p>'; return; }
      ROAD.watch(b, (list.filter(function (l) { return l.answered < l.total; })[0] || list[0]).id, list);
    }, ROAD.err(b));
  };
  ROAD.watch = function (b, id, list) {
    ROAD.media();
    b.innerHTML = '<p class="sg-wait">Loading the video…</p>';
    Promise.all([H.lens.api('video?id=' + id), ROAD.yt(), H.lens.lex()]).then(function (r) {
      if (!b.isConnected) return;
      var L = r[0], V = ROAD.v = { L: L, played: 0, last: 0, asking: null, tm: null, p: null, fresh: false, fin: false };
      b.innerHTML = '<h4>' + esc(L.title || 'Video') + '</h4><div class="sg-yt"><div></div></div><div class="sg-qm"></div><div class="sg-vq"></div>'
        + '<p class="small">The video stops for a few questions about the words you need. Missed words go to your review cards.</p>'
        + (list.length > 1 ? '<details class="sg-more"><summary>Other videos</summary>' + list.map(function (l) { return l.id === L.id ? '' : '<button data-vid="' + l.id + '">' + esc(l.title || 'Video') + ' · ' + l.correct + '/' + l.total + '</button>'; }).join('') + '</details>' : '');
      b.querySelectorAll('[data-vid]').forEach(function (x) { x.onclick = function () { ROAD.watch(b, +x.dataset.vid, list); }; });
      ROAD.marks();
      V.p = new window.YT.Player(b.querySelector('.sg-yt > div'), {
        videoId: L.videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, cc_load_policy: 1, cc_lang_pref: 'en' },
        events: { onReady: function () { V.tm = setInterval(ROAD.tick, 300); } }
      });
    }, ROAD.err(b));
  };
  ROAD.marks = function () {
    var V = ROAD.v, m = V && $('.sg-qm'); if (!m) return;
    var qs = V.L.questions, A = V.L.answers;
    m.innerHTML = qs.map(function (q) { var a = A[q.id]; return '<i class="' + (a ? (a.ok ? 'ok' : 'no') : '') + '">' + (a ? (a.ok ? '✓' : '✗') : '?') + '</i>'; }).join('') + '<small>' + Object.keys(A).filter(function (k) { return A[k].ok; }).length + '/' + qs.length + ' right</small>';
  };
  ROAD.tick = function () {
    var V = ROAD.v; if (!V || !V.p || !V.p.getCurrentTime) return;
    if (!$('.sg-vidp')) return ROAD.media();
    var t = V.p.getCurrentTime() || 0, st = V.p.getPlayerState ? V.p.getPlayerState() : -1, dur = V.p.getDuration ? V.p.getDuration() : 0;
    if (st === 1 && t > V.last && t - V.last < 2) V.played += t - V.last;
    V.last = t;
    var qs = V.L.questions, all = qs.every(function (q) { return V.L.answers[q.id]; });
    // done: every question answered now, or most of the video watched (a quiz done on another day can still be watched again)
    if (!V.fin && ((all && V.fresh) || V.played >= Math.min(150, (dur || 180) * 0.8) || (!qs.length && st === 0))) { V.fin = true; ROAD.finish('video', $('.sg-vidp .sg-pb')); }
    if (V.asking || st !== 1) return;
    var q = qs.filter(function (x) { return !V.L.answers[x.id] && x.t <= t; })[0];
    if (q) { V.p.pauseVideo(); ROAD.ask(q); }
  };
  ROAD.ask = function (q) {
    var V = ROAD.v, box = $('.sg-vq'); if (!box) return;
    V.asking = q;
    var opts = q.type === 'blank' ? '<div class="sg-typer"><input maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" placeholder="Type the word"><button class="pri" data-ok>Check</button></div>'
      : '<div class="sg-vops">' + q.options.map(function (o, k) { return '<button data-k="' + k + '" dir="ltr">' + esc(o) + '</button>'; }).join('') + '</div>';
    box.innerHTML = '<div class="sg-vcard"><p><b>' + wrapWords(q.q, null, true) + '</b></p>' + opts + '<div class="sg-vwhy"></div></div>';
    var send = function (a, btn) {
      box.querySelectorAll('button, input').forEach(function (x) { x.disabled = true; });
      H.lens.api('video/answer', { body: { id: V.L.id, qid: q.id, a: a } }).then(function (r) {
        V.L.answers[q.id] = { a: a, ok: r.ok }; V.fresh = true; ROAD.marks();
        if (btn) btn.classList.add(r.ok ? 'ok' : 'no');
        if (q.type !== 'blank') { var rb = box.querySelector('[data-k="' + r.answer + '"]'); if (rb) rb.classList.add('ok'); }
        if (r.ok) SFX.coin(); else SFX.blocked();
        var why = box.querySelector('.sg-vwhy');
        why.innerHTML = (r.ok ? '<p class="ok">✓ Right! +5 XP</p>' : '<p>✗ ' + (q.type === 'blank' ? 'It is <b>' + esc(r.answer) + '</b>. ' : '') + (q.word ? 'This word goes to your review cards.' : '') + '</p>') + (r.why ? '<p>' + wrapWords(r.why) + '</p>' : '') + (r.why_ar ? '<p class="ar" dir="rtl">' + esc(r.why_ar) + '</p>' : '') + '<div class="sg-opts"><button class="pri" data-go>Continue the video ▶</button></div>';
        why.querySelector('[data-go]').onclick = function () { box.innerHTML = ''; V.asking = null; try { V.p.playVideo(); } catch (e) { /* gone */ } };
      }, function (x) { say(x.message); V.asking = null; box.innerHTML = ''; });
    };
    box.querySelectorAll('[data-k]').forEach(function (x) { x.onclick = function () { send(+x.dataset.k, x); }; });
    var inp = box.querySelector('input');
    if (inp) { inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') send(inp.value.trim()); }; box.querySelector('[data-ok]').onclick = function () { send(inp.value.trim()); }; setTimeout(function () { inp.focus(); }, 50); }
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /* -------- 🎵 the song camp: "My songs" from Sawa Lens (the new words you saved, sung), with a fill-the-gaps game */
  ROAD.song = function () {
    var b = panel('sg-roadp sg-songp', '🎵 Song camp', '<p class="sg-wait">Loading your songs…</p>');
    Promise.all([H.lens.api('songs'), H.lens.lex()]).then(function (res) {
      var r = res[0], ready = r.songs.filter(function (s) { return s.status === 'ready' && s.audio; }), st = r.state || {};
      var making = r.songs.filter(function (s) { return ['queued', 'writing', 'singing'].indexOf(s.status) >= 0; })[0];
      if (ready.length) return ROAD.sing(b, ready[0], ready, st);
      if (making) { b.innerHTML = '<p>✍️ Your song is being written and sung right now. It takes about a minute: walk around and come back to this camp.</p>'; return; }
      if (st.can) {
        b.innerHTML = '<p>You saved enough new words for a song! A singer sings your new words in simple English, slowly.</p><div class="sg-opts"><button class="pri" data-mk>🎵 Make my song</button></div><p class="sg-err"></p>';
        b.querySelector('[data-mk]').onclick = function () { var x = this; x.disabled = true; H.lens.api('songs', { body: { style: (st.styles || ['pop'])[0], slow: 1 } }).then(function () { b.innerHTML = '<p>✍️ Your song is being written and sung. It takes about a minute: walk around and come back to this camp.</p>'; }, function (e) { x.disabled = false; b.querySelector('.sg-err').textContent = e.message; }); };
        return;
      }
      b.innerHTML = '<p>' + ({ more: 'Save ' + Math.max(1, (st.need || 10) - (st.new || 0)) + ' more new words (tap any word in the game and press “+ Learning”) and your first song is ready to make.', today: 'One new song a day: come back tomorrow.', budget: 'New songs are paused until next month.', off: 'Songs are not switched on yet.' }[st.why] || 'No song here yet.') + '</p>';
    }, ROAD.err(b));
  };
  ROAD.sing = function (b, s, ready, st) {
    var lines = String(s.lyrics || '').split(/\n/).map(function (t) { return t.trim(); }).filter(function (t) { return t && !/^\[.*\]$/.test(t); });
    b.innerHTML = '<h4>' + esc(s.title || 'Your song') + '</h4><audio controls preload="none" src="' + esc(s.audio) + '"></audio><p class="small">Listen, then sing along. Tap any word for its meaning.</p>'
      + '<div class="sg-lyr">' + lines.map(function (t) { return '<p>' + wrapWords(t) + '</p>'; }).join('') + '</div>'
      + '<div class="sg-opts"><button class="pri" data-gap>🎯 Fill the gaps</button>' + (ready.length > 1 ? '<button data-other>Another song</button>' : '') + (st && st.can ? '<button data-mk>🎵 Make a new song</button>' : '') + '</div><div class="sg-gapq"></div>';
    var other = b.querySelector('[data-other]'); if (other) other.onclick = function () { ROAD.media(); ROAD.sing(b, ready[(ready.indexOf(s) + 1) % ready.length], ready, st); };
    var mk = b.querySelector('[data-mk]'); if (mk) mk.onclick = function () { mk.disabled = true; H.lens.api('songs', { body: { style: (st.styles || ['pop'])[0], slow: 1 } }).then(function () { say('✍️ Your new song is being made: about a minute.', 4000); }, function (e) { mk.disabled = false; say(e.message); }); };
    b.querySelector('[data-gap]').onclick = function () {
      var words = (s.words || []).map(function (w) { return String(w.word || '').toLowerCase(); }).filter(Boolean), qs = [], used = {};
      lines.forEach(function (t) {
        if (qs.length >= 6) return;
        var hit = (t.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).filter(function (w) { return words.indexOf(w.toLowerCase()) >= 0 && !used[w.toLowerCase()]; })[0];
        if (!hit) return; used[hit.toLowerCase()] = 1;
        var pool = words.filter(function (w) { return w !== hit.toLowerCase(); }).sort(function () { return Math.random() - 0.5; }).slice(0, 2);
        ['road', 'light', 'friend', 'water'].forEach(function (w) { if (pool.length < 2 && w !== hit.toLowerCase()) pool.push(w); });
        var opts = pool.concat([hit.toLowerCase()]).sort(function () { return Math.random() - 0.5; });
        qs.push({ q: t.replace(new RegExp('\\b' + hit + '\\b'), '_____'), options: opts, answer: opts.indexOf(hit.toLowerCase()) });
      });
      var box = b.querySelector('.sg-gapq'); this.disabled = true;
      if (!qs.length) { box.innerHTML = '<p>Sing it once more, and the camp is done!</p>'; return ROAD.finish('song', b); }
      ROAD.quiz(box, qs, function (right, total) {
        H.lens.api('songs/played', { body: { id: s.id, right: right, total: total } }).then(function (x) {
          box.innerHTML = '<p><b>' + right + ' of ' + total + ' right' + (right === total ? ' — you know this song! 🎉' : '') + '</b>' + (x.xp ? ' · +' + x.xp + ' XP' : '') + '</p>';
          ROAD.finish('song', b);
        }, ROAD.err(box));
      });
    };
  };

  /* -------- 📖 the story camp: tonight's story from "Stories for you" (or the next chapter), and your own text at your level */
  ROAD.story = function () {
    var b = panel('sg-roadp sg-storyp', '📖 Story camp', '<p class="sg-wait">Choosing your story…</p>');
    H.lens.api('readers').then(function (h) {
      var sr = h.series && !h.series.tomorrow ? h.series : null;
      var one = sr ? H.lens.api('readers/next', { body: { series: sr.id } }) : h.today ? H.lens.api('readers/' + h.today.id) : H.lens.api('readers/next', { body: {} });
      return Promise.all([one, H.lens.lex()]).then(function (x) { if (b.isConnected) ROAD.read(b, x[0], h); });
    }).catch(function (x) {
      if (!b.isConnected) return;
      b.innerHTML = '<p>' + esc(x.message) + '</p><div class="sg-opts"><button class="pri" data-ad>✨ Read your own text at your level</button></div>';
      b.querySelector('[data-ad]').onclick = function () { ROAD.adapt(b); };
    });
  };
  ROAD.read = function (b, r, h) {
    var qs = r.questions || [];
    b.innerHTML = '<p class="small">' + esc((r.cat && r.cat.emoji || '📖') + ' ' + (r.format === 'series' ? 'Chapter ' + r.chapter + ' of ' + r.of : r.cat && r.cat.name || 'Story')) + ' · ' + esc(r.level) + ' · ' + r.minutes + ' min' + (h && h.streak ? ' · 🔥 ' + h.streak + '-day reading streak' : '') + '</p>'
      + '<h4>' + esc(r.title) + '</h4><div class="sg-read">' + ROAD.paras(r.paragraphs) + '</div>'
      + ROAD.targets(b, r.targets, r.paragraphs, r.title)
      + '<div class="sg-stq">' + (r.done ? '<p>✓ You read this one before.</p><div class="sg-opts"><button class="pri" data-fin>Done reading</button></div>' : '<div class="sg-opts"><button class="pri" data-fin>✓ I finished reading</button></div><p class="small">' + (qs.length ? qs.length + ' quick questions, then +10 XP (+5 for getting them right)' : '+10 XP') + '</p>') + '</div>'
      + '<div class="sg-opts"><button data-ad>✨ Read your own text at your level</button></div>';
    b.querySelector('[data-ad]').onclick = function () { ROAD.adapt(b); };
    b.querySelector('[data-fin]').onclick = function () {
      var box = b.querySelector('.sg-stq');
      var end = function (right, total) {
        H.lens.api('readers/done', { body: { id: r.id, right: right, total: total } }).then(function (x) {
          box.innerHTML = '<p><b>' + (total ? right + ' of ' + total + ' right' + (right === total ? ' — great reading! 🎉' : '') : 'Well done! 🎉') + '</b>' + (x.xp ? ' · +' + x.xp + ' XP' : '') + (x.streak ? ' · 🔥 ' + x.streak + '-day reading streak' : '') + '</p>' + (x.nextChapter ? '<p class="small">Chapter ' + x.nextChapter + ' opens tomorrow.</p>' : '');
          ROAD.finish('story', b);
        }, ROAD.err(box));
      };
      if (r.done || !qs.length) return end(r.done ? r.score || 0 : 0, r.done ? qs.length : 0);
      ROAD.quiz(box, qs, end);
    };
  };
  /** Graded reading: paste any English text and it is rewritten at your level (Sawa Lens "Adapt to my level"). */
  ROAD.adapt = function (b) {
    b.innerHTML = '<h4>✨ Your own text, at your level</h4><p class="small">Paste an English text: a news story, a post, song lyrics. It is rewritten at your level with your Learning words, and you can tap every word.</p><textarea rows="6" dir="ltr" maxlength="3500" placeholder="Paste the English text here…"></textarea><p class="sg-err"></p><div class="sg-opts"><button class="pri" data-go>✨ Adapt to my level</button><button data-back>← Back to the story</button></div><div class="sg-adout"></div>';
    var ta = b.querySelector('textarea'), er = b.querySelector('.sg-err'), go = b.querySelector('[data-go]');
    ta.onkeydown = function (e) { e.stopPropagation(); };
    b.querySelector('[data-back]').onclick = function () { ROAD.story(); };
    go.onclick = function () {
      var t = ta.value.trim(); er.textContent = '';
      if ((t.match(/[A-Za-z]+/g) || []).length < 20) { er.textContent = 'Paste a longer English text (at least a few sentences).'; return; }
      go.disabled = true; go.textContent = '✨ Rewriting…';
      Promise.all([H.lens.api('adapt', { body: { text: t.split(/\s+/).slice(0, 550).join(' ') } }), H.lens.lex()]).then(function (x) {
        var r = x[0], lv = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][(r.levelNum || 2) - 1], out = b.querySelector('.sg-adout');
        go.disabled = false; go.textContent = '✨ Adapt to my level';
        out.innerHTML = '<p class="small">✨ Rewritten for ' + lv + '</p><div class="sg-read">' + ROAD.paras(r.paragraphs || []) + '</div>' + ROAD.targets(out, r.targets || [], r.paragraphs || [], 'My text');
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, function (e) { go.disabled = false; go.textContent = '✨ Adapt to my level'; er.textContent = e.message; });
    };
  };

  /* -------- 🃏 the cards camp: today's review cards (the same panel as the Cards menu; REV.card finishes the camp) */
  ROAD.cards = function () { REV.show(); };

  /* -------- ✍️ the writing camp: a few sentences, checked like the writing checker (on a phone, the keyboard's 🎤 turns speaking into text) */
  ROAD.write = function () {
    var day = Math.floor(Date.now() / 864e5), pr = PROMPTS[(day + H.world().at) % PROMPTS.length];
    var b = panel('sg-roadp sg-writep', '✍️ Writing camp', '<p class="sg-wq">' + wrapWords(pr) + '</p><textarea rows="5" dir="ltr" maxlength="1500" placeholder="Write 3 to 5 sentences in English…"></textarea><p class="small">🎤 On a phone you can tap the microphone on your keyboard and speak instead of typing.</p><p class="sg-err"></p><div class="sg-opts"><button class="pri" data-wr>Check my English</button></div><div class="sg-wres"></div>');
    var ta = b.querySelector('textarea'), er = b.querySelector('.sg-err'), go = b.querySelector('[data-wr]');
    ta.onkeydown = function (e) { e.stopPropagation(); };
    go.onclick = function () {
      var t = ta.value.trim(); er.textContent = '';
      if (/[؀-ۿ]/.test(t)) { er.textContent = 'Write in English here. Simple words and short sentences are fine!'; return; }
      if ((t.match(/[A-Za-z]+/g) || []).length < 8) { er.textContent = 'Write a little more: at least two sentences.'; return; }
      go.disabled = true; go.textContent = 'Checking…';
      H.lens.api('write', { body: { text: t } }).then(function (j) {
        var res = j.result || {}, errs = res.errors || [], out = b.querySelector('.sg-wres');
        go.textContent = '✓ Checked'; ta.readOnly = true;
        out.innerHTML = (res.praise ? '<p>' + wrapWords(res.praise) + '</p>' : '') + (errs.length ? '<h4>' + errs.length + ' thing' + (errs.length > 1 ? 's' : '') + ' to fix</h4><ul class="sg-fix">' + errs.map(function (e) { return '<li><span><s dir="ltr">' + esc(e.wrong) + '</s> → <b dir="ltr">' + esc(e.right) + '</b></span>' + (e.why ? '<small>' + esc(e.why) + '</small>' : '') + (e.why_ar ? '<small class="ar" dir="rtl">' + esc(e.why_ar) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '<p><b>No mistakes — great English! 🎉</b></p>')
          + (res.tip ? '<p class="small">💡 ' + esc(res.tip) + '</p>' : '') + (j.xp ? '<p class="small">+' + j.xp + ' XP · your mistakes go to your skill tree, so practice finds them.</p>' : '');
        ROAD.finish('write', b);
      }, function (e) { go.disabled = false; go.textContent = 'Check my English'; er.textContent = e.message; });
    };
  };

  /* -------- the caravan: help each other (at any time of day), build the caravanserai, guides for newcomers */
  var CARAVAN = { s: null, tab: 'help' };
  CARAVAN.load = function () { return H.api('/coop').then(function (j) { CARAVAN.s = j; if (ROOT) { hud(); CARAVAN.thanks(j.thanks || []); var w = G && G.phaser && G.phaser.scene.getScene('World'); if (w && w.serai && j.project && w.seraiPct !== j.project.pct) w.serai(j.project.pct); } return j; }); };
  CARAVAN.thanks = function (list) {
    var seen; try { seen = JSON.parse(localStorage.getItem('sawaThanks') || '{}'); } catch (e) { seen = {}; }
    var fresh = list.filter(function (t) { return !seen[t.id]; }); if (!fresh.length) return;
    fresh.forEach(function (t) { seen[t.id] = 1; }); try { localStorage.setItem('sawaThanks', JSON.stringify(seen)); } catch (e) { /* shown again next time */ }
    var t = fresh[0]; SFX.quest(); say('🤝 ' + t.by + ' says your explanation' + (t.lemma ? ' of “' + t.lemma + '”' : '') + ' helped!' + (fresh.length > 1 ? ' (and ' + (fresh.length - 1) + ' more)' : '') + ' +XP +🪙', 6000);
  };
  CARAVAN.ago = function (t) { var s = Math.max(1, Math.round(Date.now() / 1000 - t)); return s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
  CARAVAN.show = function (tab) {
    CARAVAN.tab = tab || CARAVAN.tab; setTimeout(function () { moment('first_caravan'); }, 4000);
    var b = panel('sg-carp', '🐫 The caravan board', '<p class="sg-wait">…</p>');
    CARAVAN.load().then(function () { CARAVAN.paint(); }, function (x) { b.innerHTML = '<p class="sg-err">' + esc(x.message) + '</p>'; });
  };
  CARAVAN.paint = function () {
    var b = $('.sg-carp .sg-pb'), s = CARAVAN.s; if (!b || !s) return;
    var tabs = [['help', '⚔ Calls for help', s.todo], ['mine', '📣 My call', s.myCall && s.myCall.helpers.length && !s.myCall.used ? s.myCall.helpers.length : 0], ['build', '🏗 Caravanserai', 0], ['guide', '🧭 Guide', 0]];
    var html = '<div class="sg-tabs">' + tabs.map(function (t) { return '<button data-ct="' + t[0] + '"' + (t[0] === CARAVAN.tab ? ' class="on"' : '') + '>' + t[1] + (t[2] ? ' <i class="sg-dotn">' + t[2] + '</i>' : '') + '</button>'; }).join('') + '</div>';
    var ctx = function (a) { return (a.lemma ? '<p class="sg-cw">' + esc(a.lemma) + '</p>' : '') + '<p>' + wrapWords(a.q) + '</p>' + (a.ctx ? '<p class="sg-cs">“' + wrapWords(a.ctx, null, true) + '”</p>' : '') + (a.src ? '<small>from ' + esc(a.src) + '</small>' : ''); };
    var ROLE = {}; ROLES.forEach(function (x) { ROLE[x[0]] = x; });
    var helpers = function (c) { return c.helpers.length ? '<div class="sg-allies">' + c.helpers.map(function (h) { var r = ROLE[h.role] || ['', '🙂', '']; return '<span title="' + esc(r[2]) + '">' + r[1] + ' ' + esc(h.name) + '</span>'; }).join('') + '</div>' : ''; };
    if (CARAVAN.tab === 'help') {
      var me = ROLE[s.role] || ROLES[0];
      html += '<p class="small">Travellers who are stuck call the caravan. Fight a short support battle (4 questions) and, as a <b>' + me[1] + ' ' + esc(me[2]) + '</b>, you give them <b>' + esc(me[4]) + '</b> in their next battle. You get <b>+10 XP and 5 🪙</b> now, and <b>+20 XP and 15 🪙</b> more when they win.</p>'
        + (s.calls.length ? s.calls.map(function (c) {
          return '<div class="sg-ask' + (c.mate ? ' tome' : '') + '"><div class="sg-askh">' + (c.avatar ? '<img src="' + esc(c.avatar) + '" alt="">' : '') + '<b>' + esc(c.by) + '</b><small>' + (c.mate ? 'your clan · ' : '') + CARAVAN.ago(c.at) + ' · ' + c.helpers.length + '/3 helpers</small></div>'
            + '<p>' + (ROLE[c.role] ? ROLE[c.role][1] + ' ' : '') + 'needs help against <b>' + esc(c.foe.icon + ' ' + c.foe.name) + '</b> in ' + esc(c.foe.town) + (c.foe.kind === 'boss' ? ' (the town boss!)' : '') + '</p>' + (c.msg ? '<p class="sg-cs">“' + wrapWords(c.msg) + '”</p>' : '') + helpers(c)
            + (c.helped ? '<p class="small ok">✓ You are in! You will hear how the battle goes.</p>' : c.full ? '<p class="small">This call has 3 helpers.</p>' : '<div class="sg-opts"><button class="pri" data-help="' + esc(c.id) + '">⚔ Help ' + esc(c.by) + '</button></div>') + '</div>';
        }).join('') : '<p class="sg-empty">Nobody needs help right now. When you are stuck on a boss, call the caravan from here or at the boss.</p>')
        + '<p class="small">' + s.helpsLeft + (s.helpsLeft === 1 ? ' help' : ' helps') + ' left today.</p>';
    } else if (CARAVAN.tab === 'mine') {
      var mc = s.myCall, w = H.world(), tb = w.town.boss;
      if (mc && !mc.used) {
        html += '<div class="sg-ask"><p>📣 You called for help against <b>' + esc(mc.foe.icon + ' ' + mc.foe.name) + '</b>.</p>' + (mc.helpers.length ? helpers(mc) + '<p class="small">Your helpers join your <b>next fight</b> against the ' + esc(mc.foe.name) + (mc.foe.kind === 'boss' ? ': talk to it in its lair.' : ': walk into one on the road.') + '</p>' : '<p class="small">Waiting for helpers. Travellers play at different times — your clan has been told. You get a notification when someone joins.</p>') + '<div class="sg-opts"><button data-cancel="1">Cancel the call</button></div></div>';
      } else {
        html += (mc && mc.used ? '<p class="small">' + (mc.won ? '🏆 You beat the ' + esc(mc.foe.name) + ' with your helpers!' : 'Your last call is over.') + '</p>' : '')
          + '<p class="small">Stuck? Call the caravan. Other travellers fight a short support battle for you, and their roles help in your next fight: a Guardian\'s shield, a Healer\'s heals, a Mage\'s fireball, a Trickster\'s frost.</p>'
          + '<input class="sg-callmsg" maxlength="120" dir="ltr" placeholder="A short message in English (optional): Please help me!">'
          + '<div class="sg-opts">' + (!tb.beaten && tb.ready ? '<button class="pri" data-call="boss">📣 Help against the ' + esc(tb.name) + '</button>' : '') + w.town.monsters.map(function (m, k) { return '<button data-call="monster" data-m="' + k + '">' + esc(m.icon + ' ' + m.name) + '</button>'; }).join('') + '</div>';
      }
    } else if (CARAVAN.tab === 'build') {
      var p = s.project;
      html += '<div class="sg-build"><div class="sg-buildbar"><i style="width:' + p.pct + '%"></i><span>' + p.pct + '%</span></div><p class="small">The whole community builds <b>' + esc(p.name) + '</b> this week. It needs all three materials — and battles won together only come from calls for help. Everyone who brings something gets <b>' + esc(p.reward) + '</b>' + (p.done ? '. <b>Built! 🎉</b>' : ' when it is finished.') + ' ' + p.builders + ' builder' + (p.builders === 1 ? '' : 's') + ' so far.</p>'
        + p.materials.map(function (m) { return '<div class="sg-mat"><b>' + m.icon + ' ' + esc(m.name) + '</b><small>from ' + esc(m.from) + '</small><div class="sg-buildbar"><i style="width:' + Math.round(m.have / m.goal * 100) + '%"></i><span>' + m.have + ' / ' + m.goal + '</span></div><small>' + (m.top.length ? m.top.map(function (t) { return esc(t.name) + ' ' + t.n; }).join(' · ') : 'Nobody yet — be the first!') + '</small></div>'; }).join('')
        + '<p class="small">You this week: 🧱 ' + s.myWeek.bricks + ' · 🏮 ' + s.myWeek.lanterns + ' · ⚔ ' + s.myWeek.lessons + '</p>' + (s.donate && s.donate.left && !p.done ? '<div class="sg-opts"><button data-donate="1">🪙 Give ' + s.donate.coins + ' coins = 10 bricks (' + s.donate.left + ' left this week)</button></div>' : '') + '</div>';
    } else {
      var pr = s.pair, row = function (q) { var w = q.with, seen = w.seen == null ? '' : w.seen < 120 ? ' · playing now' : ' · played ' + CARAVAN.ago(Date.now() / 1000 - w.seen); return '<div class="sg-ask"><div class="sg-askh">' + (w.avatar ? '<img src="' + esc(w.avatar) + '" alt="">' : '') + '<b>' + esc(w.name) + '</b><small>' + (q.role === 'newcomer' ? 'your guide' : 'new on the road') + ' · Lv ' + w.level + ' · ' + esc(w.town) + seen + '</small></div><ul class="sg-plan">' + q.steps.map(function (st) { return '<li class="' + (st.done ? 'done' : '') + '"><span>' + (st.done ? '✓' : '○') + '</span><div><b>' + esc(st.text) + '</b><small>' + (st.key === 'days' ? q.days + ' / 3 · ' : '') + '+' + st.coins + ' 🪙 each</small></div></li>'; }).join('') + '</ul><small>' + q.daysLeft + ' days left together.</small>' + '' + '</div>'; };
      html += pr ? row(pr) : '';
      html += s.guiding.map(row).join('');
      html += !pr && !s.guiding.length ? '<p class="small">Guides are travellers further down the road. Every newcomer gets one for their first two weeks: they answer your calls for help, study on the same days as you, and celebrate your first boss with you.</p>' : '';
      html += s.guide.can ? '<div class="sg-opts"><button class="' + (s.guide.on ? '' : 'pri') + '" data-guide="' + (s.guide.on ? 0 : 1) + '">' + (s.guide.on ? 'Stop guiding new travellers' : '🧭 Become a guide') + '</button></div>' + (s.guide.on ? '<p class="small">You are a guide. New travellers are matched with you (up to 3 at a time). Finish all three steps with one and you get the title <b>Guide of the Road</b>.</p>' : '') : (!pr ? '<p class="small">You can become a guide after you beat two town bosses (or reach level 5).</p>' : '');
    }
    b.innerHTML = html;
    b.querySelectorAll('[data-ct]').forEach(function (x) { x.onclick = function () { CARAVAN.tab = x.dataset.ct; CARAVAN.paint(); }; });
    b.querySelectorAll('textarea, input').forEach(function (t) { t.onkeydown = function (e) { e.stopPropagation(); }; });
    var post = function (path, body, btn, then) { if (btn) btn.disabled = true; H.api(path, { method: 'POST', body: body }).then(function (j) { CARAVAN.s = j; hud(); CARAVAN.paint(); if (then) then(j); }, function (x) { if (btn) btn.disabled = false; say(x.message, 4500); }); };
    b.querySelectorAll('[data-help]').forEach(function (x) { x.onclick = function () { closePanel(); var w = G.phaser.scene.getScene('World'); w.frozen = true; G.battle('/coop/help', { id: x.dataset.help }, null); }; });
    b.querySelectorAll('[data-call]').forEach(function (x) { x.onclick = function () { var m = b.querySelector('.sg-callmsg'); post('/coop/call', { kind: x.dataset.call, m: +(x.dataset.m || 0), msg: m ? m.value.trim() : '' }, x, function () { SFX.quest(); say('📣 Your call is on the board. Your clan has been told!', 4500); }); }; });
    b.querySelectorAll('[data-donate]').forEach(function (x) { x.onclick = function () { post('/coop/donate', {}, x, function () { SFX.coin(); say('🧱 +10 bricks for the caravanserai. Thank you!', 3500); }); }; });
    b.querySelectorAll('[data-cancel]').forEach(function (x) { x.onclick = function () { post('/coop/call/cancel', {}, x); }; });
    b.querySelectorAll('[data-guide]').forEach(function (x) { x.onclick = function () { post('/coop/guide', { on: +x.dataset.guide }, x); }; });
  };
  /** Ask the caravan about a word (from the word popup) or a question for one student (from their echo). */
  CARAVAN.call = function (kind, m, foe) {
    H.api('/coop/call', { method: 'POST', body: { kind: kind, m: m || 0 } }).then(function (j) { CARAVAN.s = j; hud(); SFX.quest(); say('📣 You called the caravan for help against the ' + foe + '. Your clan has been told!', 5000); }, function (x) { say(x.message, 4500); });
  };
  /** One feature at a time: the caravan is introduced on a later day, not in the first-day welcome. */
  CARAVAN.intro = function () {
    var day = new Date().toISOString().slice(0, 10), first;
    try { first = localStorage.getItem('sawaRoadDay1'); if (!first) localStorage.setItem('sawaRoadDay1', first = day); if (first === day || localStorage.getItem('sawaCaravanIntro')) return; localStorage.setItem('sawaCaravanIntro', '1'); } catch (e) { return; }
    setTimeout(function () { if (!running || $('.sg-dlg.on') || $('.sg-panel.on')) return; dialog.who = 'crier'; dialog('Town crier', 'News, traveller! The caravan board is open. Stuck on a boss? Call the caravan: other travellers fight for you, and their roles help you in your next battle. Help them too, for XP and coins. And this week we all build the caravanserai together!', [{ label: 'Open the caravan board', primary: true, run: function () { CARAVAN.show('help'); } }], '📣'); }, 2500);
  };

  /* ================================================================ start / stop */
  window.SawaGame = {
    running: function () { return running; },
    /** The character drawn big, facing you (plain canvas, no game engine): for the card on the Today screen. */
    portrait: function (a, scale) { var k = scale || 6, c = cnv(16 * k, 24 * k), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(drawChar(a), 0, 0, 16, 24, 0, 0, 16 * k, 24 * k); return c; },
    start: function (mount, hooks) {
      if (running) return Promise.resolve();
      H = hooks; running = true;
      ROOT = el('div', 'sg-root');
      ROOT.innerHTML = '<div class="sg-cv"></div><canvas class="sg-dark"></canvas><div class="sg-labels"></div><div class="sg-top"></div><div class="sg-online"></div><div class="sg-event"></div><div class="sg-menu"></div><div class="sg-hint"></div><div class="sg-joy"><i></i></div><button class="sg-act"></button><div class="sg-battle"></div><div class="sg-dlg"></div><div class="sg-panel"></div><div class="sg-word"></div><div class="sg-load"><p>Loading the Silk Road…</p></div>';
      mount.appendChild(ROOT);
      ROOT.addEventListener('click', function (e) {
        var bh = e.target.closest('[data-bar]'); if (bh) { e.stopPropagation(); var x = BAR_HELP[bh.dataset.bar]; return dialog(x[0], x[1], [], '💡'); }
        var w = e.target.closest('.lw'); if (w) { e.stopPropagation(); return LENS.word(w); }
        var rd = e.target.closest('[data-road]'); if (rd) { e.stopPropagation(); return ROAD.tapStrip(rd.dataset.road); }
        var sp = e.target.closest('[data-say]'); if (sp) { e.stopPropagation(); return VOICE.say(sp.dataset.say); }
        var b = e.target.closest('[data-g]'); if (b) GAME.menu(b.dataset.g);
      }, true);
      ROOT.querySelector('.sg-act').onclick = function () { var w = G && G.phaser.scene.getScene('World'); if (w) w.interact(); };
      G = GAME;
      G.keys = function (e) { if (!running) return; if (G.keyPick && /^[1-4]$/.test(e.key)) { G.keyPick(+e.key - 1); e.preventDefault(); } else if (G.keyPick && e.key === 'Enter' && $('.sg-res')) G.keyPick(); };
      window.addEventListener('keydown', G.keys);
      return loadPhaser().then(function () {
        var P = window.Phaser, cv = ROOT.querySelector('.sg-cv');
        GAME.phaser = new P.Game({ type: P.AUTO, parent: cv, pixelArt: true, roundPixels: true, backgroundColor: '#1e1620', scale: { mode: P.Scale.RESIZE, width: cv.clientWidth || 800, height: cv.clientHeight || 600 }, physics: { default: 'arcade', arcade: { debug: false } }, input: { keyboard: { target: window } }, scene: makeScenes(P), banner: false, audio: { noAudio: true } });
        var restored = function () { clearTimeout(GAME.rt); GAME.rt = setTimeout(rebuild, 80); };
        GAME.phaser.events.on('contextrestored', restored);
        MUSIC.start();
        GAME.phaser.events.once('ready', function () { if (GAME.phaser.renderer && GAME.phaser.renderer.on) GAME.phaser.renderer.on('restorewebgl', restored); var l = ROOT.querySelector('.sg-load'); if (l) l.remove(); hud(); CARAVAN.load().then(function () { if (H.avatar().look.set) CARAVAN.intro(); }, function () {}); if (!H.avatar().look.set) setTimeout(function () { GAME.look(true); }, 400); });
      }, function (x) { ROOT.querySelector('.sg-load').innerHTML = '<p>' + esc(x.message) + '</p><button data-g="list">Use the list view</button>'; });
    },
    stop: function (back, mode) {
      if (!running) return;
      try { var w0 = GAME.phaser && GAME.phaser.scene.getScene('World'); if (w0 && w0.pl) H.api('/play/sync', { method: 'POST', body: { x: Math.round(w0.pl.x), y: Math.round(w0.pl.y), d: w0.pl.dir } }).catch(function () {}); } catch (e) { /* leaving anyway */ }
      running = false; closePanel(); MUSIC.stop(); if (window.speechSynthesis) speechSynthesis.cancel();
      window.removeEventListener('keydown', G.keys);
      try { if (GAME.phaser) GAME.phaser.destroy(true); } catch (e) { /* already gone */ }
      if (ROOT) ROOT.remove(); ROOT = null; GAME.phaser = null;
      if (back && H) H.exit(mode);
    },
    battle: function (path, body) { if (!running) return false; var w = GAME.phaser.scene.getScene('World'); w.frozen = true; GAME.battle(path, body, null); return true; },
    hud: function () { if (running) hud(); },
    scene: function () { return GAME.phaser && GAME.phaser.scene.getScene('World'); }, // for tests
    /** Where the student is, for beta feedback: a short area name plus details. */
    context: function () {
      if (!running) return null;
      var w = H.world() || {}, p = $('.sg-panel.on'), d = $('.sg-dlg.on b'), hr = w.hero || {};
      var pn = p ? ({ 'sg-carp': 'caravan board', 'sg-chatp': 'chat', 'sg-revp': 'review cards', 'sg-todayp': 'today\'s plan', 'sg-ranksp': 'rankings', 'sg-journalp': 'journal', 'sg-reportp': 'weekly report', 'sg-sharep': 'share card', 'sg-roadp': 'road camp: ' + (ROAD.cur || '?') }[[].filter.call(p.classList, function (c) { return /^sg-.+p$/.test(c) && c !== 'sg-panel'; })[0]] || 'panel') : '';
      var modal = ROOT && ROOT.parentNode && ROOT.parentNode.querySelector('#modal'), mh = modal && modal.innerHTML ? (modal.querySelector('h2, h3') || {}).textContent : '';
      var area = GAME.cur ? (GAME.cur.kind === 'boss' ? 'boss battle' : GAME.cur.kind === 'pboss' ? 'party boss battle' : GAME.cur.kind === 'duel' ? 'shadow duel' : 'battle') : $('.sg-res') ? 'battle result' : pn || (mh ? 'panel: ' + mh.trim().slice(0, 30) : $('.sg-look') ? 'character creator' : d ? 'talking to ' + d.textContent : $('.sg-word.on') ? 'word popup' : 'map');
      return { area: area, town: (w.town || {}).name, battle: GAME.cur || undefined, level: hr.level, hp: hr.hp, stamina: w.stamina ? w.stamina.left + '/' + w.stamina.max : '' };
    },
    pause: function (on) { var s = running && GAME.phaser && GAME.phaser.scene.getScene('World'); if (s && !GAME.cur) { if (on) { s.betaWas = s.frozen; s.frozen = true; } else { s.frozen = !!s.betaWas && !!$('.sg-panel.on'); s.cool = s.now() + 1500; } } }
  };
})();
