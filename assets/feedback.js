/* Sawa English beta feedback: a button on every screen of the app and the game.
   One tap for a reaction, a short note in Arabic or English, and "Show me" to tap the thing you mean.
   Where the student was (screen, game town/panel/battle) is saved with it. Follow-up questions follow The Mom Test:
   they ask what the student was doing and expected, not what they would like.
   Short questions after first-time moments (sawa:moment events), at most one a day. Script errors are reported too. */
(function () {
  'use strict';
  if (window.SawaBetaUI || !window.SawaBeta) return;
  var C = window.SawaBeta;
  var KINDS = [
    ['confused', '😕', 'I don\'t understand', 'مش فاهم', 'What did you expect to happen? · كنت متوقع يحصل إيه؟'],
    ['what', '❓', 'What does this do?', 'ده بيعمل إيه؟', 'What were you trying to do? · كنت بتحاول تعمل إيه؟'],
    ['like', '👍', 'I like this', 'عاجبني', 'What exactly did you like? · إيه بالظبط اللي عجبك؟'],
    ['dislike', '👎', 'I don\'t like this', 'مش عاجبني', 'What happened just before? · إيه اللي حصل قبلها؟'],
    ['boring', '😴', 'Boring', 'ممل', 'What would you rather do right now? · كنت تحب تعمل إيه دلوقتي بدل كده؟'],
    ['bug', '🐞', 'Something broke', 'فيه حاجة باظت', 'What did you do, and what happened? · عملت إيه وحصل إيه؟'],
    ['idea', '💡', 'Idea', 'فكرة', 'When did you last need this? What did you do instead? · آخر مرة احتجت ده كانت إمتى؟ وعملت إيه ساعتها؟']
  ];
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function post(body) {
    return fetch(C.rest.replace(/\/$/, '') + '/feedback', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': C.nonce }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || 'Could not send. Try again.'); return j; }); });
  }
  function game() { var g = window.SawaGame; return g && g.running && g.running() ? g : null; }
  /** Where the student is right now. */
  function where() {
    var g = game(), gc = g && g.context ? g.context() : null, view = (location.hash.replace(/^#/, '') || 'today').split(/[\/?&]/)[0];
    return {
      area: gc ? 'Silk Road › ' + gc.area : 'App › ' + view,
      ctx: { page: location.pathname + location.hash, game: gc || undefined, screen: innerWidth + '×' + innerHeight, device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'phone' : 'computer', lang: navigator.language }
    };
  }
  function pause(on) { var g = game(); if (g && g.pause) g.pause(on); }

  var host = document.createElement('div'); host.className = 'sawa-beta'; document.body.appendChild(host);
  var R = host.attachShadow({ mode: 'open' });
  R.innerHTML = '<style>'
    + ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}'
    + '.fab{position:fixed;left:10px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:2147483000;border:2px solid #e7c873;background:#14193a;color:#fff;border-radius:99px;padding:7px 12px;font:700 13px/1 inherit;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer;opacity:.92}'
    + '.fab.game{left:8px;bottom:auto;top:calc(150px + env(safe-area-inset-top,0px));padding:7px 9px}.fab.game small{display:none}.fab:hover{opacity:1}.fab small{font-weight:600;color:#e7c873;margin-left:4px}'
    + '.sheet{position:fixed;inset:auto 0 0 0;margin:0 auto;max-width:520px;z-index:2147483001;background:#fffaf0;color:#2b2233;border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.35);padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));max-height:85vh;overflow:auto;display:none}'
    + '.sheet.on{display:block}.h{display:flex;align-items:center;justify-content:space-between;gap:8px}.h b{font-size:17px}.x{border:0;background:none;font-size:22px;cursor:pointer;color:#6b5f7a}'
    + '.sub{margin:4px 0 10px;color:#6b5f7a;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}'
    + '.k{border:2px solid #e3d8bd;background:#fff;border-radius:10px;padding:8px;text-align:left;cursor:pointer;font-size:14px;color:#2b2233}.k small{display:block;color:#6b5f7a;font-size:12px;direction:rtl;text-align:left}.k.on{border-color:#c99a2e;background:#fff3cf}'
    + 'textarea{width:100%;min-height:84px;margin-top:10px;border:2px solid #e3d8bd;border-radius:10px;padding:9px;font-size:15px;resize:vertical;color:#2b2233;background:#fff}'
    + '.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}.b{border:2px solid #2b2233;background:#fff;color:#2b2233;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:14px}.b.p{background:#2b2233;color:#fff}.b:disabled{opacity:.5}'
    + '.ctx{font-size:12px;color:#6b5f7a;margin-top:8px}.tap{background:#fff3cf;border-radius:8px;padding:6px 8px;font-size:13px;margin-top:8px}.err{color:#b8392c;font-size:13px}.ok{font-size:16px;text-align:center;padding:18px 0}'
    + '.banner{position:fixed;top:0;left:0;right:0;z-index:2147483002;background:#14193a;color:#fff;padding:12px;text-align:center;font-size:15px;display:none}.banner.on{display:block}.banner button{margin-left:10px}'
    + '.ask{position:fixed;left:10px;right:10px;bottom:calc(124px + env(safe-area-inset-bottom,0px));max-width:420px;z-index:2147483000;background:#14193a;color:#fff;border:2px solid #e7c873;border-radius:12px;padding:10px 12px;display:none;box-shadow:0 6px 20px rgba(0,0,0,.4)}.ask.on{display:block}.ask p{margin:0 0 8px;font-size:14px}.ask .b{background:#fffaf0;border-color:#e7c873;padding:6px 10px;font-size:13px}.ask .b.p{background:#e7c873;color:#2b2233}'
    + '</style><button class="fab" aria-label="Beta feedback">💬<small>Beta</small></button><div class="sheet" role="dialog" aria-label="Beta feedback"></div><div class="banner"></div><div class="ask"></div>';
  var fab = R.querySelector('.fab'), sheet = R.querySelector('.sheet'), banner = R.querySelector('.banner'), ask = R.querySelector('.ask');
  var st = { kind: '', text: '', target: '', prompt: '', at: null };

  function open(o) {
    o = o || {};
    if (o.kind) st.kind = o.kind;
    if (o.prompt) st.prompt = o.prompt;
    if (!st.at) st.at = where(); // where they were when they opened it
    pause(true); paint(); sheet.classList.add('on');
  }
  function close() { sheet.classList.remove('on'); pause(false); }
  function reset() { st = { kind: '', text: '', target: '', prompt: '', at: null }; }
  function paint(msg) {
    var k = KINDS.filter(function (x) { return x[0] === st.kind; })[0];
    sheet.innerHTML = '<div class="h"><b>💬 Beta feedback · رأيك</b><button class="x" data-x aria-label="Close">×</button></div>'
      + '<p class="sub">Tell us what you see, in Arabic or English. Every note is read. · اكتب بالعربي أو بالإنجليزي، كل رسالة بتتقري.</p>'
      + '<div class="grid">' + KINDS.map(function (x) { return '<button class="k' + (x[0] === st.kind ? ' on' : '') + '" data-k="' + x[0] + '">' + x[1] + ' ' + esc(x[2]) + '<small>' + esc(x[3]) + '</small></button>'; }).join('') + '</div>'
      + (k ? '<textarea dir="auto" maxlength="2000" placeholder="' + esc(k[4]) + '">' + esc(st.text) + '</textarea>' : '')
      + (st.target ? '<div class="tap">👆 You tapped: <b>' + esc(st.target) + '</b></div>' : '')
      + '<div class="row"><button class="b" data-show>👆 Point at it · وريني فين</button><button class="b p" data-send' + (k ? '' : ' disabled') + '>Send · ابعت</button></div>'
      + (st.target ? '' : '<p class="ctx">👆 Point at it: then tap the button or part of the screen your note is about. · بعدها اضغط على الحاجة اللي تقصدها.</p>') + (msg ? '<p class="err">' + esc(msg) + '</p>' : '')
      + '<p class="ctx">Saved with it: ' + esc(st.at ? st.at.area : '') + ' · your level and stage</p>';
    var ta = sheet.querySelector('textarea');
    if (ta) { ta.oninput = function () { st.text = ta.value; }; ['keydown', 'keyup', 'keypress'].forEach(function (ev) { ta.addEventListener(ev, function (e) { e.stopPropagation(); }); }); setTimeout(function () { ta.focus(); }, 30); }
    sheet.querySelector('[data-x]').onclick = function () { close(); };
    sheet.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { st.kind = b.dataset.k; paint(); }; });
    sheet.querySelector('[data-show]').onclick = point;
    sheet.querySelector('[data-send]').onclick = send;
  }
  function send() {
    var b = sheet.querySelector('[data-send]'); b.disabled = true;
    post({ kind: st.kind, text: st.text, area: st.at.area, ctx: st.at.ctx, target: st.target, prompt: st.prompt, stage: +window.SawaAppStage || 0 }).then(function (j) {
      sheet.innerHTML = '<div class="ok">🙏 Thank you! · شكرًا!' + (j.coins ? '<br><small>+' + j.coins + ' 🪙 for your first feedback today</small>' : '') + '<br><small>We read every note. When we change something because of it, you get a notification.</small></div>';
      reset(); setTimeout(close, 2600);
    }, function (x) { paint(x.message); });
  }

  /* "Show me": the next tap picks the thing they mean (inside the app, the tracker and the game, through shadow roots). */
  var picking = false;
  function label(path) {
    for (var i = 0; i < path.length; i++) {
      var e = path[i]; if (!e || !e.tagName) continue;
      if (e === host) return null;
      if (e.tagName === 'CANVAS') return 'the game map';
      if (/^(BUTTON|A|LABEL|H1|H2|H3|H4|SELECT|INPUT|LI)$/.test(e.tagName) || e.getAttribute('role') === 'button' || e.dataset && (e.dataset.g || e.dataset.act || e.dataset.go)) {
        var t = (e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || e.value || e.placeholder || '').replace(/\s+/g, ' ').trim();
        if (t) return t.slice(0, 80) + (e.dataset && (e.dataset.g || e.dataset.act) ? ' [' + (e.dataset.g || e.dataset.act) + ']' : '');
      }
    }
    var f = path[0]; return f && f.innerText ? f.innerText.replace(/\s+/g, ' ').trim().slice(0, 80) : (f && f.tagName ? f.tagName.toLowerCase() : 'something');
  }
  function swallow(e) { if (!picking && !banner.dataset.tail) return; if (e.composedPath().indexOf(host) >= 0) return; e.preventDefault(); e.stopImmediatePropagation(); }
  function picked(e) {
    if (!picking) return; var path = e.composedPath(); if (path.indexOf(host) >= 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var el = path[0]; st.target = label(path) || 'something';
    try { var o = el.style.outline; el.style.outline = '3px solid #e2513a'; setTimeout(function () { el.style.outline = o; }, 1200); } catch (x) { /* not an element */ }
    banner.dataset.tail = '1'; stopPick(); setTimeout(function () { delete banner.dataset.tail; open(); }, 420);
  }
  var SWALLOW = ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'mouseup', 'click'];
  function stopPick() { picking = false; banner.classList.remove('on'); window.removeEventListener('pointerup', picked, true); setTimeout(function () { SWALLOW.forEach(function (t) { window.removeEventListener(t, swallow, true); }); }, 400); } // the tap's own click comes after pointerup
  function point() {
    sheet.classList.remove('on'); picking = true;
    banner.innerHTML = '👆 Tap the thing you mean · اضغط على الحاجة اللي تقصدها <button class="b">Cancel</button>'; banner.classList.add('on');
    banner.querySelector('button').onclick = function () { stopPick(); open(); };
    SWALLOW.forEach(function (t) { window.addEventListener(t, swallow, { capture: true, passive: false }); });
    window.addEventListener('pointerup', picked, true);
  }
  setInterval(function () { fab.classList.toggle('game', !!game()); }, 1000); // in the game: a small icon at the top left, away from battles and dialogs
  fab.onclick = function () { if (!st.kind) reset(); st.at = where(); open(); }; // a started note is kept, the place is always where you are now

  /* Short questions after first-time moments: the game and the app send window "sawa:moment" events.
     Each moment is asked once, and never more than one question a day. */
  var ASKS = {
    first_battle: 'Your first battle! Was anything confusing? · أول معركة! فيه حاجة كانت مش واضحة؟',
    first_caravan: 'You opened the caravan board. Was it clear what to do here? · كان واضح تعمل إيه هنا؟',
    first_boss: 'You met a town boss. Did you know what you needed to do? · كنت عارف المطلوب منك؟',
    first_level: 'Level up! Do you know what your new level gives you? · عارف المستوى الجديد بيديك إيه؟',
    first_week: 'You have been on the road for a week. What made you come back today? · إيه اللي خلاك ترجع النهارده؟'
  };
  window.addEventListener('sawa:moment', function (e) {
    var key = e.detail && e.detail.key, q = ASKS[key], today = new Date().toISOString().slice(0, 10);
    if (!q || ls.get('sawaBetaQ_' + key) || ls.get('sawaBetaQday') === today || sheet.classList.contains('on')) return;
    ls.set('sawaBetaQ_' + key, '1'); ls.set('sawaBetaQday', today);
    setTimeout(function () {
      var open1 = key === 'first_week';
      ask.innerHTML = '<p>' + esc(q) + '</p><div class="row">' + (open1 ? '<button class="b p" data-a="idea">✍ Tell us · احكيلنا</button>' : '<button class="b p" data-a="confused">😕 Yes, something · أيوه</button><button class="b" data-a="clear">👍 It was clear · واضح</button>') + '<button class="b" data-a="later">Later</button></div>';
      ask.classList.add('on');
      ask.querySelectorAll('[data-a]').forEach(function (b) {
        b.onclick = function () {
          ask.classList.remove('on'); var a = b.dataset.a;
          if (a === 'later') return;
          if (a === 'clear') { var w = where(); post({ kind: 'like', text: '✓ It was clear', area: w.area, ctx: w.ctx, prompt: key, stage: +window.SawaAppStage || 0 }).catch(function () {}); return; }
          reset(); st.at = where(); open({ kind: a === 'idea' ? 'idea' : 'confused', prompt: key });
        };
      });
      setTimeout(function () { ask.classList.remove('on'); }, 20000);
    }, e.detail.delay || 1200);
  });
  // a week after the first visit
  (function () { var first = ls.get('sawaBetaFirst'), now = Date.now(); if (!first) ls.set('sawaBetaFirst', String(now)); else if (now - +first > 7 * 864e5) setTimeout(function () { window.dispatchEvent(new CustomEvent('sawa:moment', { detail: { key: 'first_week', delay: 8000 } })); }, 1000); })();

  /* Script errors from our own files, a few per visit (testers rarely report these). */
  var errs = {}, nErr = 0;
  window.addEventListener('error', function (e) {
    var f = e.filename || ''; if (!/sawa|game\.js|app\.js|app-en\.js/i.test(f) || nErr >= 3) return;
    var m = String(e.message || '').slice(0, 300); if (errs[m]) return; errs[m] = 1; nErr++;
    var w = where(); post({ kind: 'error', text: m + '\n' + f.replace(/\?.*$/, '').split('/').slice(-2).join('/') + ':' + e.lineno + ':' + e.colno, area: w.area, ctx: w.ctx, stage: +window.SawaAppStage || 0 }).catch(function () {});
  });
  window.SawaBetaUI = { open: open, where: where }; // for tests
})();
