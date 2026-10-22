/* Feedback & Dev: the roadmap and the students' board, inside the Sawa English app (Home → Feedback & Dev).
   SawaBoard.mount(el, { rest, nonce, lang }) — lang 'en' or 'ar' is the language of the "tell us more" check.
   Roadmap: what's live, in progress, planned, later and won't do (data/roadmap.json, the same list as FEATURES.md).
   Board: ideas, bugs and requests; vote ▲/▼ (one each, can change), reply in a short thread, Sherif's replies are
   official. A note that can't be acted on yet gets a friendly "tell us more" first; "Post anyway" after one try.
   Admins: status + official reply, hide/show, merge, link a roadmap item, edit, hide a reply. Phone first. */
(function () {
  'use strict';
  if (window.SawaBoard) return;
  var ST = { new: ['New', '#6b6878', '#efede8'], planned: ['Planned', '#4a3aa8', '#ece9ff'], progress: ['In progress', '#8a5a00', '#fdf0c4'], done: ['Done', '#1f6b3a', '#dcf3e3'], later: ['Later', '#5b5866', '#f1efe9'], wontdo: ['Won\'t do', '#8a2f25', '#fbe3df'] };
  var ADMIN_ST = [['new', 'New'], ['planned', 'Planned'], ['progress', 'In progress'], ['fixed', 'Done'], ['later', 'Later'], ['wontdo', 'Won\'t do']];
  var COLS = [['live', '✅ Live', ['live', 'beta']], ['progress', '🔨 In progress', ['progress']], ['planned', '🗓 Planned', ['planned']], ['later', '💭 Later', ['later']], ['wontdo', '🚫 Won\'t do', ['wontdo']]];
  var KINDS = { idea: ['💡', 'Idea'], bug: ['🐞', 'Bug'], request: ['🙋', 'Request'] };
  var CSS = '.sb{display:flex;flex-direction:column;gap:14px;--ink:#14141a;--mut:#6b6878;--line:#e3e0da;--card:#fff;--soft:#f1efe9;--acc:#fde68a;--pur:#6250d6}'
    + '.sb *{box-sizing:border-box}.sb button{font:inherit;color:inherit;cursor:pointer}.sb .sb-tabs{display:flex;gap:6px;background:var(--soft);border-radius:999px;padding:4px}'
    + '.sb .sb-tabs button{flex:1;border:0;background:none;border-radius:999px;min-height:44px;font-weight:700}.sb .sb-tabs button[aria-pressed=true]{background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.12)}'
    + '.sb .sb-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;-webkit-overflow-scrolling:touch}.sb .sb-chip{flex:none;border:2px solid var(--line);background:var(--card);border-radius:999px;padding:8px 14px;min-height:40px;font-weight:600;white-space:nowrap}'
    + '.sb .sb-chip[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:#fff}.sb .sb-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px}'
    + '.sb .sb-muted{color:var(--mut);font-size:14px}.sb .sb-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:13px;font-weight:700}.sb h3{margin:0;font-size:17px}.sb p{margin:0}'
    + '.sb details{background:var(--card);border:1px solid var(--line);border-radius:16px}.sb summary{padding:14px;font-weight:700;min-height:48px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:8px}.sb summary::-webkit-details-marker{display:none}'
    + '.sb .sb-rl{list-style:none;margin:0;padding:0 14px 8px}.sb .sb-rl li{padding:10px 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:4px}'
    + '.sb .sb-item{flex-direction:row;align-items:flex-start;gap:10px}.sb .sb-vote{display:flex;flex-direction:column;align-items:center;gap:0;flex:none;width:48px}'
    + '.sb .sb-vote button{border:0;background:none;width:44px;height:36px;font-size:18px;border-radius:10px;color:var(--mut)}.sb .sb-vote button[aria-pressed=true]{background:var(--ink);color:#fff}.sb .sb-vote b{font-size:17px}'
    + '.sb .sb-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;text-align:start;border:0;background:none;padding:0}.sb .sb-text{white-space:pre-wrap;word-break:break-word;font-size:16px;line-height:1.45}'
    + '.sb .sb-clamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.sb .sb-meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px;color:var(--mut)}'
    + '.sb .sb-off{background:#fff8dc;border:2px solid var(--acc);border-radius:12px;padding:10px;font-size:14px}.sb .sb-off b{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b4e00;margin-bottom:2px}'
    + '.sb .sb-btn{border:2px solid var(--ink);background:var(--ink);color:#fff;border-radius:999px;min-height:44px;padding:8px 18px;font-weight:700}.sb .sb-btn.ghost{background:var(--card);color:var(--ink)}.sb .sb-btn:disabled{opacity:.5}'
    + '.sb textarea,.sb input[type=text],.sb select{width:100%;border:2px solid var(--line);border-radius:12px;padding:10px;font:inherit;font-size:16px;background:#fff;color:var(--ink)}.sb textarea{min-height:110px;resize:vertical}'
    + '.sb .sb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sb label.sb-check{display:flex;gap:8px;align-items:center;min-height:44px;font-size:15px}.sb label.sb-check input{width:22px;height:22px}'
    + '.sb .sb-warn{background:#fff3cf;border:2px solid #e7c873;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}.sb .sb-warn ul{margin:0;padding-inline-start:20px}.sb .sb-warn li{margin:3px 0}'
    + '.sb .sb-rep{border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:4px}.sb .sb-rep.off{background:#fff8dc;border:2px solid var(--acc);border-radius:12px;padding:10px}.sb .sb-rep.hid,.sb .sb-item.hid{opacity:.5}'
    + '.sb .sb-link{border:0;background:none;padding:0;color:var(--pur);font-weight:700;text-decoration:underline;min-height:32px}.sb .sb-err{color:#b8392c;font-size:14px}.sb .sb-adm{border:2px dashed var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(iso) {
    var s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
  }
  function pill(st) { var x = ST[st] || ST.new; return '<span class="sb-pill" style="color:' + x[1] + ';background:' + x[2] + '">' + x[0] + '</span>'; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function mount(el, o) {
    var S = { tab: ls('sawaBoardTab') || 'board', col: 'progress', sort: ls('sawaBoardSort') || 'top', road: null, items: null, admin: false, open: 0, draft: { kind: 'idea', text: '', anon: false, tries: 0 } };
    function api(path, body) {
      var init = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-WP-Nonce': o.nonce } };
      if (body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
      return fetch(o.rest.replace(/\/$/, '') + path, init).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.message || 'Something went wrong. Try again.'); return j; }); });
    }
    if (!document.getElementById('sb-css')) { var st = document.createElement('style'); st.id = 'sb-css'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = '<div class="sb"></div>';
    var root = el.firstChild;

    function paint() {
      root.innerHTML = '<div class="sb-tabs" role="group"><button data-tab="board" aria-pressed="' + (S.tab === 'board') + '">💬 Ideas &amp; bugs</button><button data-tab="road" aria-pressed="' + (S.tab === 'road') + '">🗺 Roadmap</button></div><div class="sb-in"></div>';
      root.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { S.tab = b.dataset.tab; S.open = 0; ls('sawaBoardTab', S.tab); paint(); }; });
      var box = root.querySelector('.sb-in');
      if (S.open) return detail(box, S.open);
      return S.tab === 'road' ? roadmap(box) : board(box);
    }

    /* ── Roadmap ── */
    function roadmap(box) {
      if (!S.road) { box.innerHTML = '<p class="sb-muted">Loading the roadmap…</p>'; api('/roadmap').then(function (r) { S.road = r; paint(); }, function (e) { box.innerHTML = '<p class="sb-err">' + esc(e.message) + '</p>'; }); return; }
      var R = S.road, col = COLS.filter(function (c) { return c[0] === S.col; })[0];
      var rows = R.items.filter(function (i) { return col[2].indexOf(i.status) >= 0; });
      var html = '<p class="sb-muted">What we\'ve built, what we\'re building now and what\'s next. Ideas from the board that are on the roadmap show how many students asked.</p>'
        + '<div class="sb-chips" role="group">' + COLS.map(function (c) { var n = R.items.filter(function (i) { return c[2].indexOf(i.status) >= 0; }).length; return '<button class="sb-chip" data-col="' + c[0] + '" aria-pressed="' + (c[0] === S.col) + '">' + c[1] + ' · ' + n + '</button>'; }).join('') + '</div>';
      if (!rows.length) html += '<div class="sb-card"><p class="sb-muted">Nothing here yet.</p></div>';
      var apps = Object.keys(R.apps).filter(function (a) { return rows.some(function (i) { return i.app === a; }); });
      apps.forEach(function (a, n) {
        var mine = rows.filter(function (i) { return i.app === a; });
        html += '<details' + (n === 0 || S.col !== 'live' ? ' open' : '') + '><summary><span>' + esc(R.apps[a]) + '</span><span class="sb-muted">' + mine.length + '</span></summary><ul class="sb-rl">' + mine.map(function (i) {
          return '<li><span>' + esc(i.title) + (i.status === 'beta' ? ' <span class="sb-pill" style="background:#ece9ff;color:#4a3aa8">beta</span>' : '') + '</span>'
            + (i.desc ? '<span class="sb-muted">' + esc(i.desc) + '</span>' : '')
            + '<span class="sb-meta">' + (i.ver ? '<span>v' + esc(String(i.ver).replace(/^v/, '')) + '</span>' : '') + (i.date ? '<span>' + esc(i.date) + '</span>' : '') + (i.note ? '<span>' + esc(i.note) + '</span>' : '')
            + (i.asks ? '<span>🙋 ' + i.asks.n + ' student post' + (i.asks.n > 1 ? 's' : '') + ' · ▲ ' + i.asks.votes + '</span>' : '') + '</span></li>';
        }).join('') + '</ul></details>';
      });
      if (R.updated) html += '<p class="sb-muted">Updated ' + esc(R.updated) + '.</p>';
      box.innerHTML = html;
      box.querySelectorAll('[data-col]').forEach(function (b) { b.onclick = function () { S.col = b.dataset.col; paint(); }; });
    }

    /* ── Board ── */
    function composer() {
      var d = S.draft, w = d.warn;
      return '<div class="sb-card sb-new"><h3>Post an idea, bug or request</h3>'
        + '<div class="sb-chips" role="group">' + Object.keys(KINDS).map(function (k) { return '<button class="sb-chip" data-kind="' + k + '" aria-pressed="' + (d.kind === k) + '">' + KINDS[k][0] + ' ' + KINDS[k][1] + '</button>'; }).join('') + '</div>'
        + '<textarea dir="auto" maxlength="2000" placeholder="' + (d.kind === 'bug' ? 'Where were you, what did you do, what happened, and what did you expect?' : 'What would you like, and when would you use it?') + '">' + esc(d.text) + '</textarea>'
        + (w ? '<div class="sb-warn" dir="' + (w.lang === 'ar' ? 'rtl' : 'ltr') + '" role="alert"><b>' + esc(w.msg) + '</b><ul>' + w.prompts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '')
        + '<label class="sb-check"><input type="checkbox" data-anon' + (d.anon ? ' checked' : '') + '> Hide my name</label>'
        + '<div class="sb-row"><button class="sb-btn" data-post>' + (w ? 'Post my changes' : 'Post') + '</button>' + (w && w.canForce ? '<button class="sb-btn ghost" data-force>Post anyway</button>' : '') + '</div><p class="sb-err" data-err></p></div>';
    }
    function card(i) {
      var k = KINDS[i.kind] || ['💬', ''];
      return '<div class="sb-card sb-item' + (i.hidden ? ' hid' : '') + '" data-id="' + i.id + '">'
        + '<div class="sb-vote">' + (i.mine ? '<span class="sb-muted" style="font-size:12px">yours</span>' : '<button data-v="1" aria-label="Vote up" aria-pressed="' + (i.my === 1) + '">▲</button>') + '<b>' + i.score + '</b>' + (i.mine ? '' : '<button data-v="-1" aria-label="Vote down" aria-pressed="' + (i.my === -1) + '">▼</button>') + '</div>'
        + '<button class="sb-body" data-open="' + i.id + '"><span class="sb-meta">' + k[0] + ' ' + k[1] + ' ' + pill(i.status) + (i.hidden ? ' <span>hidden</span>' : '') + '</span>'
        + '<span class="sb-text sb-clamp" dir="auto">' + esc(i.text) + '</span>'
        + (i.reply ? '<span class="sb-off" dir="auto"><b>Sherif</b>' + esc(i.reply) + '</span>' : '')
        + (i.road ? '<span class="sb-meta">🗺 On the roadmap: ' + esc(i.road.title.slice(0, 70)) + '</span>' : '')
        + '<span class="sb-meta"><span>' + (i.who ? esc(i.who) : 'A student') + '</span><span>' + ago(i.when) + '</span><span>💬 ' + i.n + '</span><span>#' + i.id + '</span></span></button></div>';
    }
    function board(box) {
      if (!S.items) { box.innerHTML = '<p class="sb-muted">Loading…</p>'; load(); return; }
      box.innerHTML = '<p class="sb-muted">Tell us what to build or fix. Vote for the posts you agree with. Sherif reads every one.</p>'
        + (S.composing ? composer() : '<button class="sb-btn" data-compose>＋ Post an idea or a bug</button>')
        + '<div class="sb-chips" role="group">' + [['top', '🔥 Top'], ['new', '🆕 New'], ['status', '📌 By status']].map(function (s) { return '<button class="sb-chip" data-sort="' + s[0] + '" aria-pressed="' + (S.sort === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div>'
        + (S.items.length ? S.items.map(card).join('') : '<div class="sb-card"><p class="sb-muted">No posts yet. Be the first!</p></div>');
      box.querySelectorAll('[data-sort]').forEach(function (b) { b.onclick = function () { S.sort = b.dataset.sort; ls('sawaBoardSort', S.sort); S.items = null; paint(); }; });
      var c = box.querySelector('[data-compose]'); if (c) c.onclick = function () { S.composing = true; paint(); var t = root.querySelector('.sb-new textarea'); if (t) t.focus(); };
      bindComposer(box);
      bindVotes(box);
      box.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { S.open = +b.dataset.open; paint(); window.scrollTo(0, 0); }; });
    }
    function load() {
      api('/ideas?sort=' + S.sort).then(function (r) { S.items = r.items; S.admin = r.admin; paint(); }, function (e) { root.querySelector('.sb-in').innerHTML = '<p class="sb-err">' + esc(e.message) + '</p>'; });
    }
    function bindComposer(box) {
      var n = box.querySelector('.sb-new'); if (!n) return;
      var d = S.draft, ta = n.querySelector('textarea');
      ta.oninput = function () { d.text = ta.value; };
      n.querySelector('[data-anon]').onchange = function (e) { d.anon = e.target.checked; };
      n.querySelectorAll('[data-kind]').forEach(function (b) { b.onclick = function () { d.kind = b.dataset.kind; d.warn = null; d.tries = 0; paint(); }; });
      function send(force) {
        var err = n.querySelector('[data-err]'); err.textContent = '';
        if (d.text.trim().length < 3) { err.textContent = 'Write your post first.'; return; }
        n.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        api('/ideas', { kind: d.kind, text: d.text, anon: d.anon ? 1 : 0, tries: d.tries, force: force ? 1 : 0, lang: o.lang }).then(function (r) {
          if (r.unclear) { d.warn = r; d.tries++; paint(); var t = root.querySelector('.sb-new textarea'); if (t) t.focus(); return; }
          S.draft = { kind: 'idea', text: '', anon: false, tries: 0 }; S.composing = false; S.items = null; S.sort = 'new';
          paint();
          if (r.coins) toast('🙏 Thank you! +' + r.coins + ' 🪙');
        }, function (e) { paint(); var x = root.querySelector('.sb-new [data-err]'); if (x) x.textContent = e.message; });
      }
      n.querySelector('[data-post]').onclick = function () { send(false); };
      var f = n.querySelector('[data-force]'); if (f) f.onclick = function () { send(true); };
    }
    function bindVotes(box) {
      box.querySelectorAll('[data-v]').forEach(function (b) {
        b.onclick = function () {
          var id = +b.closest('[data-id]').dataset.id, it = (S.items || []).concat(S.cur ? [S.cur.item] : []).filter(function (x) { return x.id === id; })[0];
          var v = +b.dataset.v; if (it && it.my === v) v = 0; // tap again to take the vote back
          api('/ideas/vote', { id: id, v: v }).then(function (r) {
            (S.items || []).concat(S.cur ? [S.cur.item] : []).forEach(function (x) { if (x.id === id) { x.score = r.score; x.my = r.my; } });
            paint();
          }, function (e) { toast(e.message); });
        };
      });
    }

    /* ── One post and its thread ── */
    function detail(box, id) {
      if (!S.cur || S.cur.item.id !== id) {
        box.innerHTML = '<p class="sb-muted">Loading…</p>';
        api('/ideas/item?id=' + id).then(function (r) { S.cur = r; S.admin = r.admin; paint(); }, function (e) { box.innerHTML = '<button class="sb-link" data-back>← All posts</button><p class="sb-err">' + esc(e.message) + '</p>'; box.querySelector('[data-back]').onclick = back; });
        return;
      }
      var i = S.cur.item, reps = S.cur.replies;
      box.innerHTML = '<button class="sb-link" data-back>← All posts</button>' + card(i).replace('sb-clamp', '')
        + '<div class="sb-card"><h3>Replies · ' + reps.filter(function (p) { return !p.hidden; }).length + '</h3>'
        + (reps.length ? reps.map(function (p) {
          return '<div class="sb-rep' + (p.official ? ' off' : '') + (p.hidden ? ' hid' : '') + '"><span class="sb-meta"><b style="color:var(--ink)">' + esc(p.who) + '</b>' + (p.official ? '<span class="sb-pill" style="background:var(--acc);color:#14141a">Official</span>' : '') + '<span>' + ago(p.when) + '</span>' + (p.hidden ? '<span>hidden</span>' : '') + '</span><span class="sb-text" dir="auto">' + esc(p.text) + '</span>'
            + (S.admin ? '<span><button class="sb-link" data-rh="' + p.id + '" data-act="' + (p.hidden ? 'show' : 'hide') + '">' + (p.hidden ? 'Show reply' : 'Hide reply') + '</button></span>' : '') + '</div>';
        }).join('') : '<p class="sb-muted">No replies yet. Do you have the same problem or a better idea? Say it here.</p>')
        + '<textarea dir="auto" maxlength="600" data-reply placeholder="Write a reply in English or Arabic"></textarea><div class="sb-row"><button class="sb-btn" data-send>Reply</button></div><p class="sb-err" data-err></p></div>'
        + (S.admin ? adminBox(i) : '');
      box.querySelector('[data-back]').onclick = back;
      box.querySelector('.sb-body').onclick = null;
      bindVotes(box);
      box.querySelector('[data-send]').onclick = function () {
        var t = box.querySelector('[data-reply]').value.trim(), err = box.querySelector('[data-err]');
        if (t.length < 2) { err.textContent = 'Write a reply first.'; return; }
        this.disabled = true;
        api('/ideas/reply', { id: i.id, text: t }).then(function (r) { S.cur = r; if (S.items) S.items.forEach(function (x) { if (x.id === i.id) x.n = r.item.n; }); paint(); }, function (e) { err.textContent = e.message; box.querySelector('[data-send]').disabled = false; });
      };
      box.querySelectorAll('[data-rh]').forEach(function (b) { b.onclick = function () { mod({ id: i.id, rid: +b.dataset.rh, action: b.dataset.act }); }; });
      if (S.admin) bindAdmin(box, i);
    }
    function back() { S.open = 0; S.cur = null; S.items = null; paint(); }
    function mod(body) {
      return api('/ideas/mod', body).then(function (r) { if (r.into) { S.open = r.into; S.cur = null; } else S.cur = r; S.items = null; paint(); toast('Saved'); }, function (e) { toast(e.message); });
    }
    function adminBox(i) {
      var cur = { new: 'new', planned: 'planned', progress: 'progress', done: 'fixed', later: 'later', wontdo: 'wontdo' }[i.status];
      return '<div class="sb-adm"><h3>Admin</h3>'
        + '<select data-st>' + ADMIN_ST.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === cur ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>'
        + '<input type="text" dir="auto" data-oreply placeholder="Official reply under the post (Planned, In progress and Done notify the student)" value="' + esc(i.reply) + '">'
        + '<div class="sb-row"><button class="sb-btn" data-save-st>Save status</button><button class="sb-btn ghost" data-hide>' + (i.hidden ? 'Show post' : 'Hide post') + '</button></div>'
        + '<input type="text" data-road placeholder="Roadmap item id (empty to unlink)" list="sb-road" value="' + esc(i.road ? i.road.id : '') + '"><datalist id="sb-road"></datalist><button class="sb-btn ghost" data-save-road>Link to the roadmap</button>'
        + '<div class="sb-row"><input type="text" inputmode="numeric" data-into placeholder="Merge into post #" style="flex:1"><button class="sb-btn ghost" data-merge>Merge</button></div>'
        + '<textarea dir="auto" data-edit>' + esc(i.text) + '</textarea><button class="sb-btn ghost" data-save-edit>Save the text</button>'
        + '<p class="sb-muted">Posted from: ' + esc(i.area) + (i.anon ? ' · name hidden from students (' + esc(i.who) + ')' : '') + '</p></div>';
    }
    function bindAdmin(box, i) {
      var q = function (s) { return box.querySelector(s); };
      q('[data-save-st]').onclick = function () { mod({ id: i.id, action: 'status', value: q('[data-st]').value, reply: q('[data-oreply]').value }); };
      q('[data-hide]').onclick = function () { mod({ id: i.id, action: i.hidden ? 'show' : 'hide' }); };
      q('[data-save-road]').onclick = function () { mod({ id: i.id, action: 'road', value: q('[data-road]').value.trim() }); };
      q('[data-merge]').onclick = function () { var n = +q('[data-into]').value.replace(/\D/g, ''); if (n && confirm('Merge #' + i.id + ' into #' + n + '? Its votes move there.')) mod({ id: i.id, action: 'merge', value: n }); };
      q('[data-save-edit]').onclick = function () { mod({ id: i.id, action: 'edit', value: q('[data-edit]').value }); };
      var fill = function () { q('#sb-road').innerHTML = S.road.items.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.title.slice(0, 80)) + '</option>'; }).join(''); };
      if (S.road) fill(); else api('/roadmap').then(function (r) { S.road = r; if (q('#sb-road')) fill(); }).catch(function () {});
    }
    function toast(m) {
      var t = document.createElement('div'); t.textContent = m;
      t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(90px + env(safe-area-inset-bottom,0px));background:#14141a;color:#fff;padding:10px 16px;border-radius:999px;z-index:2147483000;font-weight:600;max-width:90vw';
      document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2400);
    }
    paint();
    return { reload: function () { S.items = null; S.road = null; paint(); }, open: function (id) { S.open = id; S.cur = null; paint(); } };
  }
  window.SawaBoard = { mount: mount };
})();
