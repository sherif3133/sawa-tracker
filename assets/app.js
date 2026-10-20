/* Sawa Tracker: the student app. Renders into a shadow root so the site theme can't break it. */
(function () {
  'use strict';
  var host = document.querySelector('.sawa-tracker-app');
  if (!host || host.shadowRoot) return;
  var cfgEl = host.nextElementSibling;
  var cfg = JSON.parse(cfgEl.textContent);

  if (!document.getElementById('sawa-tr-fonts')) {
    var lf = document.createElement('link');
    lf.id = 'sawa-tr-fonts'; lf.rel = 'stylesheet';
    lf.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=Cairo:wght@400;600;700&display=swap';
    document.head.appendChild(lf);
  }

  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<link rel="stylesheet" href="' + cfg.css + '"><div class="app" id="app" aria-live="polite"><div class="loading"><span class="spin"></span>Loading your tracker…</div></div><div id="modal"></div><div class="toast" id="toast" role="status"></div>';
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

  /* ------------------------------------------------------------ helpers */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?'; }
  function hue(id) { return (Number(id) * 47) % 360; }
  function avatar(p, size) {
    size = size || 40;
    var st = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px';
    if (p && p.avatar) return '<img class="av" src="' + esc(p.avatar) + '" alt="" style="' + st + '" loading="lazy">';
    return '<span class="av" aria-hidden="true" style="' + st + ';background:hsl(' + hue(p ? p.id : 0) + ' 55% 46%)">' + esc(initials(p && p.name)) + '</span>';
  }
  function hm(min) { min = Math.round(min || 0); var h = Math.floor(min / 60), m = min % 60; return h ? h + 'h ' + m + 'm' : m + 'm'; }
  function act(name) { for (var i = 0; i < cfg.activities.length; i++) if (cfg.activities[i].name === name) return cfg.activities[i]; return { name: name, emoji: '📝', color: '#8a8f98' }; }
  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 45) return 'just now';
    var units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800]], u = units[0];
    for (var i = 0; i < units.length; i++) if (s >= units[i][1]) u = units[i];
    var n = Math.round(s / u[1]);
    return rtf ? rtf.format(-n, u[0]) : n + ' ' + u[0] + 's ago';
  }
  function fmtDay(d, opts) { return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' }); }
  function healthColor(h) { return h >= 70 ? 'var(--good)' : h >= 40 ? 'var(--warn)' : 'var(--bad)'; }
  function url(path, q) {
    var u = cfg.rest + path, qs = q ? Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&') : '';
    return qs ? u + (u.indexOf('?') >= 0 ? '&' : '?') + qs : u;
  }
  function api(path, o) {
    o = o || {};
    var opt = { method: o.method || 'GET', credentials: 'same-origin', headers: {} };
    if (cfg.nonce) opt.headers['X-WP-Nonce'] = cfg.nonce;
    if (o.body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(o.body); }
    if (o.form) opt.body = o.form;
    return fetch(url(path, o.query), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 || (j && j.code === 'rest_cookie_invalid_nonce')) { throw new Error('Your session expired. Reload the page to continue.'); }
        if (!r.ok || j.ok === false) throw new Error((j && j.message) || 'Something went wrong. Please try again.');
        return j;
      });
    }, function () { throw new Error('No connection. Check your internet and try again.'); });
  }
  var toastT;
  function toast(msg, kind) {
    var t = $('#toast'); t.className = 'toast show ' + (kind || ''); t.textContent = msg;
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 3600);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin sm"></span>' + (label || 'Saving…'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  /* ------------------------------------------------------------ state */
  var S = { data: null, board: { tab: 'consistency', rows: [], total: 0, me: null }, feed: [], lastId: 0, oldestId: 0, feedDone: false, timers: [] };

  /* ------------------------------------------------------------ signed-out, pending */
  function renderGuest() {
    $('#app').innerHTML = '<div class="auth">'
      + '<section class="auth-hero"><div class="brand big"><span class="logo">S</span>Sawa Tracker</div>'
      + '<h1>Level up your English, together.</h1>'
      + '<ul class="perks"><li><span>🔥</span>Build a daily study streak and keep your habit health high</li>'
      + '<li><span>⚔️</span>Choose a class and use skills to protect and heal your classmates</li>'
      + '<li><span>🐉</span>Fight a weekly boss with the whole community: every minute you study is a hit</li>'
      + '<li><span>🏆</span>Earn badges and climb the consistency leaderboard</li></ul></section>'
      + '<section class="card auth-card">'
      + '<div class="seg" role="tablist"><button data-act="auth-tab" data-tab="in" aria-pressed="true">Sign in</button><button data-act="auth-tab" data-tab="join" aria-pressed="false">Ask to join</button></div>'
      + '<form class="stack" id="f-in" method="post" action="' + esc(cfg.loginUrl) + '">'
      + '<label class="f">Email or username<input name="log" autocomplete="username" required></label>'
      + '<label class="f">Password<input name="pwd" type="password" autocomplete="current-password" required></label>'
      + '<label class="chk"><input type="checkbox" name="rememberme" value="forever" checked> Keep me signed in</label>'
      + '<input type="hidden" name="redirect_to" value="' + esc(cfg.here) + '">'
      + '<button class="btn primary wide" type="submit">Sign in</button>'
      + '<a class="muted small" href="' + esc(cfg.lostUrl) + '">Forgot your password?</a></form>'
      + '<form class="stack" id="f-join" hidden>'
      + '<p class="muted small">The tracker is for Sawa English community members. Ask to join, and you can sign in as soon as you\'re approved.</p>'
      + '<label class="f">Your name<input name="name" autocomplete="name" required dir="auto"></label>'
      + '<label class="f">Email<input name="email" type="email" autocomplete="email" required></label>'
      + '<label class="f">Password <small>at least 8 characters</small><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>'
      + '<label class="f">Your name in the Skool community <small>helps us find you</small><input name="note" dir="auto"></label>'
      + '<input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'
      + '<p class="err" role="alert"></p>'
      + '<button class="btn primary wide" type="submit">Ask to join</button></form>'
      + '</section></div>';
    $('#f-join').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('button[type=submit]'), err = f.querySelector('.err');
      err.textContent = '';
      var body = {}; ['name', 'email', 'password', 'note', 'website'].forEach(function (k) { body[k] = f.querySelector('[name=' + k + ']').value.trim(); });
      if (body.password.length < 8) { err.textContent = 'Choose a password with at least 8 characters.'; return; }
      busy(btn, true, 'Sending…');
      api('/request', { method: 'POST', body: body }).then(function () { location.reload(); }, function (x) { busy(btn, false); err.textContent = x.message; });
    });
  }
  function renderWaiting(denied) {
    $('#app').innerHTML = '<div class="center-card card">'
      + '<div class="big-emoji">' + (denied ? '🔒' : '⏳') + '</div>'
      + (denied
        ? '<h2>Your tracker access isn\'t active</h2><p class="muted">If you think this is a mistake, message Sherif in the Skool community.</p>'
        : '<h2>Thanks, ' + esc(cfg.name.split(' ')[0]) + '! You\'re on the list.</h2><p class="muted">Your request is waiting for approval. You\'ll get an email as soon as you\'re in. Usually within a day.</p>')
      + '<a class="btn" href="' + esc(cfg.logoutUrl) + '">Sign out</a></div>';
  }

  /* ------------------------------------------------------------ class choice */
  function renderClassPick(changing) {
    var cls = cfg.classes;
    var html = '<div class="center-card card wide-card"><h2>' + (changing ? 'Change your class' : 'Choose your class') + '</h2>'
      + '<p class="muted">Your class decides which skills you can use to help yourself and your classmates. ' + (changing ? 'You can change once every 30 days.' : 'You can change it later.') + '</p><div class="classes">';
    Object.keys(cls).forEach(function (k) {
      html += '<button class="class-card" data-act="pick-class" data-class="' + k + '"><span class="class-icon">' + cls[k].icon + '</span><b>' + esc(cls[k].name) + '</b><span>' + esc(cls[k].tagline) + '</span></button>';
    });
    html += '</div>' + (changing ? '<button class="btn ghost" data-act="close">Keep my class</button>' : '') + '</div>';
    if (changing) openModal(html, 'wide'); else $('#app').innerHTML = html;
  }

  /* ------------------------------------------------------------ dashboard */
  function renderDash() { renderView(); }
  function renderView() {
    if (S.view === 'clan') { $('#app').innerHTML = header() + '<div id="view">' + clanView() + '</div>'; if (!S.clanLoading) loadClan(); return; }
    if (S.view === 'chat') { $('#app').innerHTML = header() + '<div id="view"></div>'; paintChat(); return; }
    renderHome();
  }
  function renderHome() {
    var d = S.data, s = d.stats, me = d.me;
    var goalPct = Math.min(100, Math.round(s.todayMinutes / s.goal * 100));
    var sub = s.todayMinutes >= s.goal ? 'Daily goal reached. Great work! 🎉'
      : s.studiedToday ? hm(s.goal - s.todayMinutes) + ' more to reach today\'s goal of ' + hm(s.goal) + '.'
        : s.streak > 0 ? 'Log an activity today to keep your ' + s.streak + '-day streak alive.' : 'Log your first activity today to start a streak!';
    $('#app').innerHTML = header()
      + '<section class="hello"><div class="who">' + avatar(me, 56) + '<div><h1>Hey, ' + esc(me.firstName) + '! 👋</h1><p class="muted">' + esc(sub) + '</p>'
      + '<button class="btn ghost sm-btn" data-act="share">📣 Share to Skool</button></div></div>'
      + '<div class="ring" style="--p:' + goalPct + '" role="img" aria-label="Today ' + s.todayMinutes + ' of ' + s.goal + ' minutes"><span><b>' + s.todayMinutes + '</b>/' + s.goal + ' min</span></div></section>'
      + statCards(s)
      + '<div class="grid"><div class="col main">' + questCard() + characterCard() + bossCard() + trendCard() + '<div class="two">' + breakdownCard() + heatCard() + '</div>' + badgesCard() + recentCard() + '</div>'
      + '<div class="col side">' + boardCard() + feedCard() + '</div></div>';
    paintBoard(); paintFeed();
  }

  function questCard() {
    var q = S.data.quest; if (!q) return '';
    return '<section class="card quest' + (q.done ? ' done' : '') + '"><div class="quest-row"><span class="q-badge" aria-hidden="true">🎯</span><div class="quest-main"><span class="eyebrow">Today\'s quest from Sherif</span><p class="quest-text" dir="auto">' + esc(q.text) + '</p></div>'
      + (q.done ? '<span class="pill good">Done ✅</span>' : '<span class="pill sp">+' + q.sp + ' SP</span>') + '</div>'
      + (q.done ? '' : '<form class="quest-form" id="f-quest"><input id="q-note" maxlength="200" placeholder="How did it go? (optional)" dir="auto" aria-label="Note about the quest"><button class="btn primary" type="submit">Mark done</button></form>') + '</section>';
  }

  function header() {
    var d = S.data, v = S.view || 'home', cu = S.chatUnread || 0;
    var nav = '<nav class="nav" aria-label="Sections">'
      + [['home', '🏠', 'Home'], ['clan', '🛡️', 'Clan'], ['chat', '💬', 'Chat']].map(function (t) {
        return '<button data-act="view" data-view="' + t[0] + '" aria-current="' + (v === t[0] ? 'page' : 'false') + '">' + t[1] + ' <span>' + t[2] + '</span>' + (t[0] === 'chat' && cu ? '<i>' + cu + '</i>' : '') + '</button>';
      }).join('') + '</nav>';
    return '<header class="top"><div class="brand"><span class="logo">S</span><span class="hide-xs">Sawa Tracker</span></div>' + nav + '<div class="top-actions">'
      + '<button class="btn primary" data-act="log-day">📅 <span class="hide-xs">Log day</span></button>'
      + '<button class="btn" data-act="log-activity">＋ <span class="hide-sm">Log activity</span></button>'
      + '<button class="icon-btn bell" data-act="notifs" aria-label="Notifications' + (d.unread ? ', ' + d.unread + ' new' : '') + '">🔔' + (d.unread ? '<i>' + d.unread + '</i>' : '') + '</button>'
      + '<button class="icon-btn me-btn" data-act="settings" aria-label="Your settings">' + avatar(d.me, 34) + '</button>'
      + '</div></header>';
  }

  function statCards(s) {
    var shielded = s.shieldUntil && s.shieldUntil >= S.data.today;
    return '<section class="stats">'
      + '<div class="card stat"><span class="stat-ic fire">🔥</span><b>' + s.streak + '</b><span>Day streak</span><small>Best ' + s.bestStreak + (s.freezes ? ' · ❄️ ' + s.freezes + ' freeze' + (s.freezes > 1 ? 's' : '') : '') + '</small></div>'
      + '<div class="card stat"><span class="stat-ic heart">❤️</span><b style="color:' + healthColor(s.health) + '">' + s.health + '%</b><span>Habit health</span>'
      + '<div class="bar hp"><i style="width:' + s.health + '%;background:' + healthColor(s.health) + '"></i></div>'
      + '<small>' + (shielded ? '🛡️ Shielded until ' + fmtDay(s.shieldUntil) : s.health >= 70 ? 'Strong. Keep it up!' : s.health >= 40 ? 'Study today to raise it' : 'Low. A short session helps!') + '</small></div>'
      + '<div class="card stat"><span class="stat-ic clock">⏱️</span><b>' + hm(s.totalMinutes) + '</b><span>Total study time</span><small>' + (s.totalCards ? s.totalCards.toLocaleString() + ' flashcards' : '&nbsp;') + '</small></div>'
      + '<div class="card stat"><span class="stat-ic cal">📆</span><b>' + s.studyDays + '</b><span>Study days</span><small>Level ' + s.level + ' · ' + esc(s.title) + '</small></div>'
      + '</section>';
  }

  function characterCard() {
    var d = S.data, s = d.stats, c = cfg.classes[d.me.class] || {};
    var pct = s.next ? Math.round((s.studyDays - s.from) / (s.next - s.from) * 100) : 100;
    var skills = d.skills.map(function (k) {
      var st = k.locked ? 'locked' : k.readyOn ? 'cooling' : s.sp < k.cost ? 'poor' : 'ready';
      var tip = k.description + (k.locked ? ' · Unlocks at level ' + k.unlock : k.readyOn ? ' · Ready ' + fmtDay(k.readyOn) : ' · Costs ' + k.cost + ' SP');
      return '<button class="skill ' + st + '" data-act="skill-info" data-skill="' + k.id + '" title="' + esc(tip) + '">'
        + '<span class="sk-ic">' + (k.locked ? '🔒' : k.icon) + '</span><span class="sk-name">' + esc(k.locked ? 'Lv ' + k.unlock : k.name) + '</span>'
        + (!k.locked ? '<span class="sk-cost">' + (k.readyOn ? '⏳' : k.cost + ' SP') + '</span>' : '') + '</button>';
    }).join('');
    return '<section class="card char"><div class="char-top">'
      + '<div class="char-av">' + avatar(d.me, 72) + '<span class="class-badge" title="' + esc(c.name) + '">' + (c.icon || '') + '</span></div>'
      + '<div class="char-info"><div class="char-line"><h2>Level ' + s.level + '</h2><span class="tag">' + esc(s.title) + '</span><button class="tag link" data-act="change-class">' + (c.icon || '') + ' ' + esc(c.name || 'Pick a class') + '</button></div>'
      + '<div class="bars"><div class="lbl"><span>Progress to ' + (s.nextLevel ? 'Level ' + s.nextLevel : 'the top') + '</span><span>' + (s.next ? s.studyDays + ' / ' + s.next + ' study days' : 'Max level') + '</span></div>'
      + '<div class="bar xp"><i style="width:' + pct + '%"></i></div>'
      + '<div class="lbl"><span>Skill points</span><span>' + s.sp + ' SP' + (s.spBonus ? ' · +' + s.spBonus + ' bonus waiting ✨' : '') + '</span></div></div></div></div>'
      + '<div class="skills">' + skills + '</div>'
      + '<p class="muted small">Tap a skill to use it. Skills that help classmates can also be used from the ⚡ button next to their name on the leaderboard.</p></section>';
  }

  function bossCard() {
    var b = S.data.boss, left = Math.max(0, b.hp - b.damage), pct = Math.round(left / b.hp * 100);
    var daysLeft = Math.max(0, Math.round((new Date(b.ends + 'T23:59:59') - Date.now()) / 86400000));
    var top = b.top.map(function (p, i) { return '<li>' + avatar(p, 26) + '<span dir="auto">' + esc(p.name) + '</span><b>' + p.minutes + '</b></li>'; }).join('');
    return '<section class="card boss' + (b.defeated ? ' won' : '') + '"><div class="boss-top"><span class="boss-ic" aria-hidden="true">' + b.icon + '</span>'
      + '<div class="boss-info"><span class="eyebrow">Weekly community boss</span><h2>' + esc(b.name) + '</h2>'
      + (b.defeated
        ? '<p class="win">Defeated! Everyone who fought earned +3 SP and the Boss slayer badge. A new boss arrives ' + (daysLeft ? 'in ' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') : 'tomorrow') + '.</p>'
        : '<div class="bar boss-hp"><i style="width:' + pct + '%"></i><em>' + left.toLocaleString() + ' / ' + b.hp.toLocaleString() + ' HP</em></div>'
          + '<p class="muted small">Every minute anyone studies is 1 damage. ' + b.fighters + ' student' + (b.fighters === 1 ? '' : 's') + ' fighting · ' + (daysLeft ? daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' left' : 'last day!') + '</p>')
      + '</div></div>' + (top ? '<div class="boss-top5"><span class="eyebrow">Top damage this week (minutes)</span><ol>' + top + '</ol></div>' : '') + '</section>';
  }

  function trendCard() {
    var t = S.data.trend;
    if (t.length < 2) return '<section class="card"><h3>Habit health trend</h3><p class="muted">Your health line appears after your first full day.</p></section>';
    var W = 640, H = 170, P = { l: 34, r: 12, t: 12, b: 26 }, n = t.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * (n === 1 ? 0 : i / (n - 1)); };
    var y = function (v) { return P.t + (H - P.t - P.b) * (1 - v / 100); };
    var pts = t.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.health).toFixed(1); });
    var grid = [0, 50, 100].map(function (v) { return '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (P.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + v + '%</text>'; }).join('');
    var lbls = [0, Math.floor((n - 1) / 2), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '" class="ax">' + (i === n - 1 ? 'Today' : fmtDay(t[i].day)) + '</text>'; }).join('');
    var miss = t.map(function (d, i) { return d.state === 'missed' ? '<circle cx="' + x(i) + '" cy="' + y(d.health) + '" r="3" class="miss"><title>' + fmtDay(d.day) + ': missed</title></circle>' : ''; }).join('');
    var last = t[n - 1], first = t[Math.max(0, n - 8)];
    var dir = last.health - first.health;
    return '<section class="card"><div class="card-h"><h3>Habit health trend</h3><span class="trend ' + (dir > 2 ? 'up' : dir < -2 ? 'down' : '') + '">' + (dir > 2 ? '↗ Rising' : dir < -2 ? '↘ Falling' : '→ Steady') + '</span></div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Habit health over the last ' + n + ' days, now ' + last.health + '%">'
      + '<defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".28"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>'
      + grid + '<polygon points="' + x(0) + ',' + y(0) + ' ' + pts.join(' ') + ' ' + x(n - 1) + ',' + y(0) + '" fill="url(#hg)"/>'
      + '<polyline points="' + pts.join(' ') + '" class="line"/>' + miss
      + '<circle cx="' + x(n - 1) + '" cy="' + y(last.health) + '" r="5" class="end"/>' + lbls + '</svg>'
      + '<p class="muted small">Health goes up when you study (more when you reach your goal) and down on days you miss.</p></section>';
  }

  function breakdownCard() {
    var b = S.data.breakdown, tot = b.reduce(function (a, r) { return a + r.minutes; }, 0);
    if (!tot) return '<section class="card"><h3>Activity breakdown</h3><p class="muted">Log activities to see where your time goes.</p></section>';
    var R = 52, C = 2 * Math.PI * R, off = 0;
    var arcs = b.map(function (r) {
      var len = r.minutes / tot * C, a = act(r.activity);
      var s = '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + a.color + '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"><title>' + esc(r.activity) + ': ' + hm(r.minutes) + '</title></circle>';
      off += len; return s;
    }).join('');
    var legend = b.map(function (r) { var a = act(r.activity); return '<li><i style="background:' + a.color + '"></i><span>' + a.emoji + ' ' + esc(r.activity) + '</span><b>' + hm(r.minutes) + '</b><em>' + Math.round(r.minutes / tot * 100) + '%</em></li>'; }).join('');
    return '<section class="card"><h3>Activity breakdown</h3><div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Time by activity"><g transform="rotate(-90 70 70)">' + arcs + '</g><text x="70" y="66" text-anchor="middle" class="d-big">' + hm(tot) + '</text><text x="70" y="84" text-anchor="middle" class="ax">total</text></svg><ul class="legend">' + legend + '</ul></div></section>';
  }

  function heatCard() {
    var map = {}; S.data.heat.forEach(function (h) { map[h[0]] = h[1]; });
    var goal = S.data.stats.goal, today = new Date(S.data.today + 'T12:00:00');
    var end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay()));
    var cells = '';
    for (var w = 11; w >= 0; w--) {
      cells += '<div class="hw">';
      for (var d = 0; d < 7; d++) {
        var dt = new Date(end); dt.setDate(end.getDate() - w * 7 - (6 - d));
        var key = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
        var m = map[key] || 0, lvl = dt > today ? 'f' : m === 0 ? 0 : m < goal / 2 ? 1 : m < goal ? 2 : 3;
        cells += '<i class="h' + lvl + '" title="' + fmtDay(key) + ': ' + (m ? hm(m) : 'no study') + '"></i>';
      }
      cells += '</div>';
    }
    return '<section class="card"><h3>Last 12 weeks</h3><div class="heat" role="img" aria-label="Study days in the last 12 weeks">' + cells + '</div>'
      + '<div class="heat-key"><span>Less</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><span>Goal met</span></div></section>';
  }

  function badgesCard() {
    var b = S.data.badges, got = b.filter(function (x) { return x.on; }).length;
    return '<section class="card"><div class="card-h"><h3>Badges</h3><span class="muted small">' + got + ' of ' + b.length + '</span></div><div class="badges">'
      + b.map(function (x) { return '<div class="badge' + (x.on ? '' : ' off') + '" title="' + esc(x.about) + (x.on ? ' · earned ' + fmtDay(x.on) : '') + '"><span>' + x.icon + '</span><b>' + esc(x.name) + '</b></div>'; }).join('') + '</div></section>';
  }

  function recentCard() {
    var r = S.data.recent;
    if (!r.length) return '<section class="card"><h3>Recent activity</h3><p class="muted">Nothing yet. Click <b>Log activity</b> to add your first one.</p></section>';
    return '<section class="card"><h3>Recent activity</h3><ul class="recent">' + r.map(function (x) {
      var a = act(x.activity);
      return '<li><span class="r-ic" style="background:' + a.color + '22;color:' + a.color + '">' + a.emoji + '</span><div><b>' + esc(x.activity) + '</b><small>' + fmtDay(x.day, { weekday: 'short', day: 'numeric', month: 'short' }) + (x.cards ? ' · ' + x.cards + ' cards' : '') + (x.notes ? ' · <span dir="auto">' + esc(x.notes) + '</span>' : '') + '</small></div>'
        + '<span class="r-min">' + hm(x.minutes) + '</span>' + (x.canDelete ? '<button class="icon-btn sm" data-act="del-log" data-id="' + x.id + '" aria-label="Remove this activity" title="Remove">✕</button>' : '<span class="icon-btn sm ghost"></span>') + '</li>';
    }).join('') + '</ul></section>';
  }

  /* ------------------------------------------------------------ leaderboard */
  function boardCard() {
    return '<section class="card board"><div class="card-h"><h3>🏆 Leaderboard</h3><span class="muted small" id="b-total"></span></div>'
      + '<div class="seg small-seg" role="tablist" aria-label="Leaderboard">'
      + [['consistency', 'Consistency'], ['week', 'This week'], ['all', 'All time']].map(function (t) { return '<button data-act="board-tab" data-tab="' + t[0] + '" aria-pressed="' + (S.board.tab === t[0]) + '">' + t[1] + '</button>'; }).join('')
      + '</div><ol class="rows" id="b-rows"><li class="muted small pad">Loading…</li></ol><div id="b-me"></div></section>';
  }
  function canHelp() { return S.data.skills.some(function (k) { return k.target === 'other' && !k.locked; }); }
  function boardRow(r) {
    var me = r.id === S.data.me.id, metric = S.board.tab === 'consistency'
      ? '<div class="bar mini"><i style="width:' + r.health + '%;background:' + healthColor(r.health) + '"></i></div><span class="pc">' + r.health + '%</span>'
      : '<span class="pc wide">' + hm(r.minutes) + '</span>';
    return '<li class="row' + (me ? ' me' : '') + '"><span class="rank r' + Math.min(r.rank, 4) + '">' + r.rank + '</span>' + avatar(r, 36)
      + '<div class="r-main"><div class="r-name"><span dir="auto">' + esc(r.name) + '</span>' + (me ? '<small>(you)</small>' : '') + '<span title="' + esc((cfg.classes[r.class] || {}).name || '') + '">' + r.icon + '</span>' + (r.today ? '<span class="dot-today" title="Studied today"></span>' : '') + '</div>'
      + '<div class="r-meta"><span class="lv">Lv ' + r.level + '</span>' + metric + '<span class="st">🔥 ' + r.streak + '</span></div></div>'
      + '<div class="r-acts">' + (!me && canHelp() ? '<button class="icon-btn sm" data-act="cast-on" data-id="' + r.id + '" aria-label="Use a skill on ' + esc(r.name) + '" title="Use a skill">⚡</button>' : '')
      + '<button class="icon-btn sm" data-act="profile" data-id="' + r.id + '" aria-label="See ' + esc(r.name) + '\'s profile" title="Profile">ⓘ</button></div></li>';
  }
  function paintBoard() {
    var el = $('#b-rows'); if (!el) return;
    var b = S.board;
    if (!b.rows.length) { el.innerHTML = '<li class="muted small pad">' + (b.loaded ? 'No one on the board yet. Log an activity to be first!' : 'Loading…') + '</li>'; return; }
    el.innerHTML = b.rows.slice(0, b.showAll ? 100 : 15).map(boardRow).join('') + (b.rows.length > 15 && !b.showAll ? '<li class="pad"><button class="btn ghost wide" data-act="board-more">Show top ' + Math.min(100, b.rows.length) + '</button></li>' : '');
    $('#b-total').textContent = b.total + ' student' + (b.total === 1 ? '' : 's');
    var visible = b.rows.slice(0, b.showAll ? 100 : 15).some(function (r) { return r.id === S.data.me.id; });
    $('#b-me').innerHTML = b.me && !visible ? '<ol class="rows pinned">' + boardRow(b.me) + '</ol>' : '';
  }
  function loadBoard() {
    return api('/board', { query: { tab: S.board.tab } }).then(function (j) {
      S.board.rows = j.rows; S.board.total = j.total; S.board.me = j.me; S.board.loaded = true; paintBoard();
    }, function () { S.board.loaded = true; paintBoard(); });
  }

  /* ------------------------------------------------------------ live feed */
  function feedCard() {
    return '<section class="card feed"><div class="card-h"><h3>Activity feed</h3><span class="live"><i></i>Live</span></div><ul class="events" id="f-list"><li class="muted small pad">Loading…</li></ul>'
      + '<button class="btn ghost wide" data-act="feed-more" id="f-more" hidden>Show older</button></section>';
  }
  function name(p) { return p ? '<b dir="auto">' + esc(p.name) + '</b>' : '<b>Someone</b>'; }
  function eventText(e) {
    var d = e.data || {};
    switch (e.type) {
      case 'log': var a = act(d.activity); return name(e.who) + ' logged ' + d.minutes + ' min of ' + a.emoji + ' ' + esc(d.activity) + (d.cards ? ' (' + d.cards + ' cards)' : '');
      case 'day_done': return name(e.who) + ' finished Day ' + d.day + (d.mood ? ' feeling ' + d.mood + '/10' : '') + (d.up > 0 ? ' <span class="up">mood ↑' + d.up + '</span>' : '') + ' ✅';
      case 'skill': return name(e.who) + ' used ' + esc(d.icon) + ' ' + esc(d.name) + ' on ' + (e.target && e.who && e.target.id === e.who.id ? 'themselves' : name(e.target));
      case 'level_up': return name(e.who) + ' reached <b>Level ' + d.level + '</b> · ' + esc(d.title) + ' 🎉';
      case 'badge': return name(e.who) + ' earned the ' + esc(d.icon) + ' <b>' + esc(d.name) + '</b> badge';
      case 'boss_down': return '<b>' + esc(d.icon) + ' The community defeated ' + esc(d.name) + '!</b> ' + d.fighters + ' fighters each earned +3 SP';
      case 'streak_lost': return name(e.who) + ' lost a ' + d.streak + '-day streak. Send some support 💚';
      case 'freeze_used': return name(e.who) + ' kept a ' + d.streak + '-day streak with a freeze ❄️';
      case 'joined': var c = cfg.classes[d.class] || {}; return name(e.who) + ' joined as a ' + (c.icon || '') + ' ' + esc(c.name || '') + '. Welcome!';
      case 'quest_done': return name(e.who) + ' finished today\'s quest 🎯' + (d.note ? ': <span dir="auto">“' + esc(d.note) + '”</span>' : '');
      case 'group_invite': return name(e.who) + ' added you to the group <b dir="auto">' + esc(d.name) + '</b> 💬';
    }
    return name(e.who) + ' did something';
  }
  var REACTS = ['👏', '🔥', '💪', '❤️'];
  function eventItem(e) {
    var big = e.type === 'boss_down' || e.type === 'level_up' || e.type === 'badge';
    var reacts = REACTS.map(function (r) {
      var n = (e.reactions && e.reactions[r]) || 0, on = (e.mine || []).indexOf(r) >= 0;
      return '<button class="react' + (on ? ' on' : '') + (n ? ' has' : '') + '" data-act="react" data-id="' + e.id + '" data-emoji="' + r + '" aria-pressed="' + on + '" aria-label="React ' + r + '">' + r + (n ? '<span>' + n + '</span>' : '') + '</button>';
    }).join('');
    return '<li class="ev' + (big ? ' big' : '') + '" data-id="' + e.id + '">' + (e.who ? avatar(e.who, 32) : '<span class="av sys" style="width:32px;height:32px">' + esc((e.data && e.data.icon) || '⭐') + '</span>')
      + '<div class="ev-main"><p>' + eventText(e) + '</p><div class="ev-foot"><time datetime="' + esc(e.at) + '">' + ago(e.at) + '</time><span class="reacts">' + reacts + '</span></div></div></li>';
  }
  function paintFeed() {
    var el = $('#f-list'); if (!el) return;
    el.innerHTML = S.feed.length ? S.feed.map(eventItem).join('') : '<li class="muted small pad">' + (S.feedLoaded ? 'Quiet so far. Your next activity will show up here.' : 'Loading…') + '</li>';
    var more = $('#f-more'); if (more) more.hidden = S.feedDone || S.feed.length < 30;
  }
  function loadFeed(mode) {
    var q = mode === 'new' && S.lastId ? { after: S.lastId } : mode === 'old' ? { before: S.oldestId } : null;
    return api('/feed', { query: q }).then(function (j) {
      var ev = j.events;
      if (mode === 'new') { if (!ev.length) { refreshTimes(); return; } S.feed = ev.concat(S.feed).slice(0, 150); }
      else if (mode === 'old') { if (ev.length < 30) S.feedDone = true; S.feed = S.feed.concat(ev); }
      else S.feed = ev;
      S.feedLoaded = true;
      if (S.feed.length) { S.lastId = S.feed[0].id; S.oldestId = S.feed[S.feed.length - 1].id; }
      paintFeed();
      if (mode === 'new') { var first = $('#f-list .ev'); if (first) first.classList.add('fresh'); }
    }, function () { S.feedLoaded = true; paintFeed(); });
  }
  function refreshTimes() { $$('#f-list time').forEach(function (t) { t.textContent = ago(t.getAttribute('datetime')); }); }

  /* ------------------------------------------------------------ modals */
  var lastFocus = null;
  function openModal(html, size) {
    lastFocus = root.activeElement;
    $('#modal').innerHTML = '<div class="overlay" data-act="overlay"><div class="modal ' + (size || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    var f = $('#modal [autofocus]') || $('#modal button, #modal input'); if (f) f.focus();
  }
  function closeModal() { $('#modal').innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function mHead(title, sub) { return '<div class="m-head"><div><h2>' + title + '</h2>' + (sub ? '<p class="muted small">' + sub + '</p>' : '') + '</div><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>'; }

  function actChips(name, selected) {
    return '<div class="chips" role="radiogroup">' + cfg.activities.map(function (a) {
      return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(a.name) + '"' + (selected === a.name ? ' checked' : '') + '><span>' + a.emoji + ' ' + esc(a.name) + '</span></label>';
    }).join('') + '</div>';
  }
  function minuteInput(id, val) {
    return '<div class="mins"><input type="number" id="' + id + '" min="1" max="720" inputmode="numeric" placeholder="e.g. 30" value="' + (val || '') + '" aria-label="Minutes">'
      + '<div class="quick">' + [10, 20, 30, 45, 60].map(function (m) { return '<button type="button" data-act="quick-min" data-target="' + id + '" data-min="' + m + '">' + m + '</button>'; }).join('') + '</div></div>';
  }

  function openLogActivity(pre) {
    openModal(mHead('Log study activity', 'Each activity earns 1 skill point.')
      + '<form class="stack" id="f-log"><div class="f"><span>Activity</span>' + actChips('activity', pre) + '</div>'
      + '<div class="f"><span>Time spent (minutes)</span>' + minuteInput('l-min') + '</div>'
      + '<label class="f" id="l-cards-row" hidden>Cards reviewed <small>optional</small><input type="number" id="l-cards" min="0" max="5000" inputmode="numeric"></label>'
      + '<div class="f"><span>Day</span><div class="seg"><button type="button" data-act="day-pick" data-day="' + S.data.today + '" aria-pressed="true">Today</button><button type="button" data-act="day-pick" data-day="' + S.data.yesterday + '" aria-pressed="false">Yesterday</button></div></div>'
      + '<label class="f">What did you work on? <small>optional</small><input id="l-notes" maxlength="300" placeholder="e.g. Watched a podcast episode, reviewed my Anki deck" dir="auto"></label>'
      + '<p class="err" role="alert"></p><button class="btn primary wide" type="submit">Save activity</button></form>');
    var form = $('#f-log'), day = S.data.today;
    function syncCards() { var c = form.querySelector('[name=activity]:checked'); $('#l-cards-row').hidden = !(c && act(c.value).cards); }
    form.addEventListener('change', syncCards); syncCards();
    form.addEventListener('click', function (e) { var b = e.target.closest('[data-act=day-pick]'); if (b) { day = b.dataset.day; form.querySelectorAll('[data-act=day-pick]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = form.querySelector('[name=activity]:checked'), err = form.querySelector('.err'), btn = form.querySelector('[type=submit]');
      var min = parseInt($('#l-min').value, 10);
      if (!c) { err.textContent = 'Choose an activity.'; return; }
      if (!(min >= 1 && min <= 720)) { err.textContent = 'Enter the minutes you spent, from 1 to 720.'; return; }
      busy(btn, true);
      api('/log', { method: 'POST', body: { activity: c.value, minutes: min, cards: parseInt($('#l-cards').value, 10) || 0, notes: $('#l-notes').value.trim(), day: day } })
        .then(function (j) { closeModal(); afterAction(j, 'Activity logged!' + (j.sp ? ' +' + j.sp + ' SP' : '')); }, function (x) { busy(btn, false); err.textContent = x.message; });
    });
  }

  /* Log your day: one step per activity, then a reflection, then a review. */
  function openLogDay() {
    var steps = cfg.activities.map(function (a) { return { type: 'act', a: a }; }).concat([{ type: 'reflect' }, { type: 'review' }]);
    var st = { i: 0, entries: {}, moodBefore: 0, moodAfter: 0, note: '', day: S.data.today };
    function moodPick(key, label) {
      var v = st[key];
      return '<div class="f"><span>' + label + '</span><div class="mood" role="radiogroup">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" data-act="mood" data-key="' + key + '" data-n="' + n + '" aria-pressed="' + (v === n) + '">' + n + '</button>'; }).join('') + '</div><div class="mood-ends"><span>😞 Low</span><span>Great 😄</span></div></div>';
    }
    function draw() {
      var s = steps[st.i], n = steps.length, body = '';
      if (s.type === 'act') {
        var e = st.entries[s.a.name];
        body = '<div class="q"><span class="q-ic">' + s.a.emoji + '</span><h3>Did you do ' + esc(s.a.name) + ' ' + (st.day === S.data.today ? 'today' : 'yesterday') + '?</h3></div>'
          + (e ? '<div class="stack"><div class="f"><span>Minutes</span>' + minuteInput('d-min', e.minutes) + '</div>'
            + (s.a.cards ? '<label class="f">Cards reviewed <small>optional</small><input type="number" id="d-cards" min="0" max="5000" value="' + (e.cards || '') + '"></label>' : '')
            + '<label class="f">Notes <small>optional</small><input id="d-notes" maxlength="300" value="' + esc(e.notes || '') + '" dir="auto"></label>'
            + '<div class="row-btns"><button class="btn ghost" data-act="d-no">I didn\'t</button><button class="btn primary" data-act="d-next">Next →</button></div></div>'
            : '<div class="row-btns big"><button class="btn primary" data-act="d-yes">Yes</button><button class="btn" data-act="d-no">No</button></div>');
      } else if (s.type === 'reflect') {
        body = '<div class="q"><span class="q-ic">💭</span><h3>How did you feel?</h3></div>' + moodPick('moodBefore', 'Before studying') + moodPick('moodAfter', 'After studying')
          + '<label class="f">A note for your teacher <small>optional, only Sherif sees this</small><textarea id="d-note" rows="3" maxlength="2000" dir="auto" placeholder="Anything you struggled with or are proud of?">' + esc(st.note) + '</textarea></label>'
          + '<div class="row-btns"><button class="btn ghost" data-act="d-back">← Back</button><button class="btn primary" data-act="d-next">Review →</button></div>';
      } else {
        var list = Object.keys(st.entries).map(function (k) { var e = st.entries[k], a = act(k); return '<li><span>' + a.emoji + ' ' + esc(k) + (e.cards ? ' · ' + e.cards + ' cards' : '') + '</span><b>' + hm(e.minutes) + '</b></li>'; });
        var tot = Object.keys(st.entries).reduce(function (a, k) { return a + st.entries[k].minutes; }, 0);
        body = '<div class="q"><span class="q-ic">📋</span><h3>Your day</h3></div>'
          + (list.length ? '<ul class="review">' + list.join('') + '<li class="tot"><span>Total</span><b>' + hm(tot) + '</b></li></ul>' : '<p class="err">You haven\'t added any activities. Go back and choose Yes for what you did.</p>')
          + (st.moodAfter ? '<p class="muted small">Mood: ' + (st.moodBefore ? st.moodBefore + ' → ' : '') + st.moodAfter + '/10</p>' : '')
          + '<p class="err" role="alert"></p><div class="row-btns"><button class="btn ghost" data-act="d-back">← Back</button><button class="btn primary" data-act="d-submit"' + (list.length ? '' : ' disabled') + '>Finish my day ✅</button></div>';
      }
      openModal(mHead('Log your day', fmtDay(st.day, { weekday: 'long', day: 'numeric', month: 'short' }))
        + '<div class="steps-h"><span>Step ' + (st.i + 1) + ' of ' + n + '</span><span>' + (s.type === 'act' ? esc(s.a.name) : s.type === 'reflect' ? 'Reflection' : 'Review') + '</span></div><div class="bar step"><i style="width:' + Math.round((st.i + 1) / n * 100) + '%"></i></div>'
        + (st.i === 0 ? '<div class="seg center"><button data-act="d-day" data-day="' + S.data.today + '" aria-pressed="' + (st.day === S.data.today) + '">Today</button><button data-act="d-day" data-day="' + S.data.yesterday + '" aria-pressed="' + (st.day === S.data.yesterday) + '">Yesterday</button></div>' : '')
        + '<div class="step-body">' + body + '</div>');
    }
    function saveStep() {
      var s = steps[st.i];
      if (s.type === 'act' && st.entries[s.a.name]) {
        var m = parseInt($('#d-min').value, 10);
        if (!(m >= 1 && m <= 720)) { toast('Enter the minutes, from 1 to 720.', 'bad'); return false; }
        st.entries[s.a.name] = { activity: s.a.name, minutes: m, cards: $('#d-cards') ? parseInt($('#d-cards').value, 10) || 0 : 0, notes: $('#d-notes').value.trim() };
      }
      if (s.type === 'reflect') st.note = $('#d-note').value;
      return true;
    }
    S.dayWizard = {
      handle: function (a, el) {
        var s = steps[st.i];
        if (a === 'd-yes') { st.entries[s.a.name] = { activity: s.a.name, minutes: 0 }; draw(); var mi = $('#d-min'); if (mi) mi.focus(); }
        else if (a === 'd-no') { delete st.entries[s.a.name]; st.i++; draw(); }
        else if (a === 'd-next') { if (saveStep()) { st.i++; draw(); } }
        else if (a === 'd-back') { saveStep(); st.i = Math.max(0, st.i - 1); draw(); }
        else if (a === 'd-day') { st.day = el.dataset.day; draw(); }
        else if (a === 'mood') { if (st.i < steps.length && steps[st.i].type === 'reflect') st.note = $('#d-note').value; st[el.dataset.key] = +el.dataset.n; draw(); }
        else if (a === 'd-submit') {
          var entries = Object.keys(st.entries).map(function (k) { return st.entries[k]; });
          busy(el, true, 'Saving your day…');
          api('/day', { method: 'POST', body: { day: st.day, entries: entries, moodBefore: st.moodBefore, moodAfter: st.moodAfter, note: st.note } }).then(function (j) {
            S.dayWizard = null; recap(j, entries, st); afterAction(j, null);
          }, function (x) { busy(el, false); var er = $('#modal .err'); if (er) er.textContent = x.message; });
        }
      }
    };
    draw();
  }
  function recap(j, entries, st) {
    var tot = entries.reduce(function (a, e) { return a + e.minutes; }, 0);
    var cards = entries.reduce(function (a, e) { return a + (e.cards || 0); }, 0);
    openModal('<div class="recap"><div class="big-emoji">🎉</div><h2>Day ' + j.dayNumber + ' complete!</h2>'
      + '<p class="muted">⏱️ ' + hm(tot) + ' · ' + entries.length + ' activit' + (entries.length === 1 ? 'y' : 'ies') + (cards ? ' · 🃏 ' + cards + ' cards' : '') + '</p>'
      + (st.moodAfter ? '<p>Mood ' + st.moodAfter + '/10' + (st.moodBefore ? (st.moodAfter >= st.moodBefore ? ' (up from ' + st.moodBefore + ') 📈' : ' (from ' + st.moodBefore + ')') : '') + '</p>' : '')
      + '<div class="pills"><span class="pill sp">+' + j.sp + ' SP</span>' + (j.levelUp ? '<span class="pill lv">Level ' + j.levelUp + '! 🎉</span>' : '') + (j.badges || []).map(function (b) { var x = S.data.badges.filter(function (y) { return y.id === b; })[0]; return x ? '<span class="pill bd">' + x.icon + ' ' + esc(x.name) + '</span>' : ''; }).join('') + '</div>'
      + '<button class="btn primary wide" data-act="close" autofocus>Done</button></div>', 'narrow');
  }

  /* Skills */
  function openSkill(id) {
    var k = S.data.skills.filter(function (x) { return x.id === id; })[0]; if (!k) return;
    var s = S.data.stats, why = k.locked ? 'Unlocks at level ' + k.unlock + '. You are level ' + s.level + '.' : k.readyOn ? 'Resting. Ready again on ' + fmtDay(k.readyOn) + '.' : s.sp < k.cost ? 'You need ' + k.cost + ' SP and have ' + s.sp + '. Log activities to earn more.' : '';
    var others = k.target === 'other';
    openModal(mHead(k.icon + ' ' + esc(k.name), k.target === 'self' ? 'Used on yourself' : 'Used on a classmate')
      + '<p>' + esc(k.description) + '</p><p class="muted ar" dir="rtl" lang="ar">' + esc(k.descriptionAr) + '</p>'
      + '<div class="pills"><span class="pill sp">' + k.cost + ' SP</span><span class="pill">Rests ' + k.cooldown + ' day' + (k.cooldown > 1 ? 's' : '') + ' after use</span></div>'
      + (why ? '<p class="note">' + esc(why) + '</p>' : others ? '<div class="f"><span>Choose a classmate</span><input id="t-search" placeholder="Search by name" autocomplete="off"><ul class="pick-list" id="t-list"></ul></div>' : '')
      + '<p class="err" role="alert"></p>'
      + (!why && !others ? '<button class="btn primary wide" data-act="cast" data-skill="' + k.id + '" data-target="0">Use ' + esc(k.name) + '</button>' : ''));
    if (!why && others) {
      var draw = function () {
        var q = ($('#t-search').value || '').toLowerCase();
        var rows = S.board.rows.filter(function (r) { return r.id !== S.data.me.id && r.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 30);
        rows.sort(function (a, b) { return a.health - b.health; });
        $('#t-list').innerHTML = rows.length ? rows.map(function (r) { return '<li><button class="pick" data-act="cast" data-skill="' + k.id + '" data-target="' + r.id + '">' + avatar(r, 30) + '<span dir="auto">' + esc(r.name) + '</span><small>❤️ ' + r.health + '% · 🔥 ' + r.streak + (r.today ? ' · studied today' : '') + '</small></button></li>'; }).join('') : '<li class="muted small pad">No one found.</li>';
      };
      $('#t-search').addEventListener('input', draw); draw();
      $('#t-list').insertAdjacentHTML('beforebegin', '<p class="muted small">Students with the lowest health are listed first.</p>');
    }
  }
  function openCastOn(targetId) {
    var t = S.board.rows.filter(function (r) { return r.id === targetId; })[0] || { id: targetId, name: 'this student' };
    var list = S.data.skills.filter(function (k) { return k.target === 'other'; }).map(function (k) {
      var s = S.data.stats, dis = k.locked || k.readyOn || s.sp < k.cost;
      var why = k.locked ? 'Level ' + k.unlock : k.readyOn ? 'Ready ' + fmtDay(k.readyOn) : s.sp < k.cost ? 'Need ' + k.cost + ' SP' : k.cost + ' SP';
      return '<li><button class="pick skillpick" data-act="cast" data-skill="' + k.id + '" data-target="' + targetId + '"' + (dis ? ' disabled' : '') + '><span class="sk-ic">' + (k.locked ? '🔒' : k.icon) + '</span><span><b>' + esc(k.name) + '</b><small>' + esc(k.description) + '</small></span><em>' + esc(why) + '</em></button></li>';
    }).join('');
    openModal(mHead('Help ' + esc(t.name), 'You have ' + S.data.stats.sp + ' SP') + '<ul class="pick-list">' + list + '</ul><p class="err" role="alert"></p>');
  }
  function doCast(btn) {
    busy(btn, true, 'Casting…');
    api('/cast', { method: 'POST', body: { skill: btn.dataset.skill, target: +btn.dataset.target } }).then(function (j) {
      closeModal(); afterAction(j, j.skill.icon + ' ' + j.skill.name + ' used!');
    }, function (x) { busy(btn, false); var er = $('#modal .err'); if (er) er.textContent = x.message; });
  }

  function openProfile(id) {
    openModal('<div class="pad center"><span class="spin"></span></div>', 'narrow');
    api('/student/' + id).then(function (p) {
      var c = cfg.classes[p.class] || {}, shield = p.shieldUntil && p.shieldUntil >= S.data.today;
      openModal(mHead('', '') + '<div class="profile">' + avatar(p, 84) + '<h2 dir="auto">' + esc(p.name) + '</h2><p class="muted">Level ' + p.level + ' · ' + esc(p.title) + ' · ' + (c.icon || '') + ' ' + esc(c.name || '') + '</p>'
        + '<div class="mini-stats"><div><b style="color:' + healthColor(p.health) + '">' + p.health + '%</b><span>Health' + (shield ? ' 🛡️' : '') + '</span></div><div><b>' + p.streak + '</b><span>Streak' + (p.freezes ? ' ❄️' + p.freezes : '') + '</span></div><div><b>' + p.studyDays + '</b><span>Study days</span></div><div><b>' + hm(p.totalMinutes) + '</b><span>Total</span></div></div>'
        + (p.badges.length ? '<div class="pills center">' + p.badges.map(function (b) { return '<span class="pill" title="' + esc(b.name) + '">' + b.icon + ' ' + esc(b.name) + '</span>'; }).join('') + '</div>' : '')
        + (p.recent.length ? '<ul class="recent small">' + p.recent.map(function (r) { var a = act(r.activity); return '<li><span class="r-ic" style="background:' + a.color + '22">' + a.emoji + '</span><div><b>' + esc(r.activity) + '</b><small>' + fmtDay(r.day) + '</small></div><span class="r-min">' + hm(r.minutes) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">No activities yet.</p>')
        + (p.id !== S.data.me.id && canHelp() ? '<button class="btn primary wide" data-act="cast-on" data-id="' + p.id + '">⚡ Use a skill on ' + esc(p.name.split(' ')[0]) + '</button>' : '') + '</div>', 'narrow');
    }, function (x) { closeModal(); toast(x.message, 'bad'); });
  }

  function openNotifs() {
    var n = S.data.notifications;
    var text = function (e) {
      var d = e.data || {};
      if (e.type === 'skill') {
        var effects = { rally: 'cheered you on: time to study! 📣', heal: '(+15% health)', inner_peace: '', war_cry: '(+10% health)', shield_ally: '(+1 streak freeze ❄️)', fortify: '(2 days of health protection 🛡️)', unbreakable: '(a freeze and 3 days of protection)', empower: '(+2 SP on your next activity ✨)', revitalize: '(+10% health and a freeze)', sanctuary: '(3 days of protection 🛡️)', guardian_angel: '(+20% health and 3 days of protection)' };
        return name(e.who) + (d.skill === 'rally' ? ' ' + effects.rally : ' used ' + esc(d.icon) + ' ' + esc(d.name) + ' on you ' + (effects[d.skill] || ''));
      }
      return eventText(e);
    };
    openModal(mHead('Notifications', 'When classmates use skills on you') + (n.length ? '<ul class="events">' + n.map(function (e) { return '<li class="ev">' + (e.who ? avatar(e.who, 32) : '') + '<div class="ev-main"><p>' + text(e) + '</p><div class="ev-foot"><time>' + ago(e.at) + '</time></div></div></li>'; }).join('') + '</ul>' : '<p class="muted">Nothing yet. When someone heals you, shields you or sends a Rally, it shows up here.</p>'), 'narrow');
    if (S.data.unread && n.length) { api('/notifications/seen', { method: 'POST', body: { id: n[0].id } }).then(function () { S.data.unread = 0; var b = $('.bell i'); if (b) b.remove(); var bell = $('.bell'); if (bell) bell.setAttribute('aria-label', 'Notifications'); }); }
  }

  function openSettings() {
    var d = S.data;
    openModal(mHead('Your settings') + '<div class="stack">'
      + '<div class="f"><span>Profile photo</span><div class="photo-row">' + avatar(d.me, 64) + '<button class="btn" data-act="pick-avatar">Change photo</button><input type="file" id="av-file" accept="image/*" hidden></div></div>'
      + '<label class="f">Daily goal (minutes) <small>reaching it gives your health a bigger boost</small><input type="number" id="goal" min="5" max="600" value="' + d.stats.goal + '"></label>'
      + '<button class="btn primary" data-act="save-goal">Save goal</button>'
      + '<label class="f">Email reminder <small>sent only on days you haven\'t studied yet</small><select id="remind">'
      + '<option value="">Off</option>' + [7, 9, 12, 15, 17, 18, 19, 20, 21, 22].map(function (h) { return '<option value="' + h + '"' + (String(h) === String(d.remindHour) ? ' selected' : '') + '>' + (h < 12 ? h + ':00 am' : h === 12 ? '12:00 pm' : (h - 12) + ':00 pm') + '</option>'; }).join('')
      + '</select></label>'
      + '<hr><button class="btn ghost" data-act="change-class">Change class</button>'
      + '<a class="btn ghost" href="' + esc(cfg.logoutUrl) + '">Sign out</a></div>', 'narrow');
  }
  function uploadAvatar(file) {
    var img = new Image(), u = URL.createObjectURL(file);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); URL.revokeObjectURL(u);
      c.toBlob(function (b) {
        var fd = new FormData(); fd.append('avatar', b, 'avatar.jpg');
        toast('Uploading photo…');
        api('/profile', { method: 'POST', form: fd }).then(function (j) { S.data = j.data; closeModal(); renderDash(); loadBoard(); toast('Photo updated'); }, function (x) { toast(x.message, 'bad'); });
      }, 'image/jpeg', 0.88);
    };
    img.onerror = function () { toast('That photo could not be read. Try a JPG or PNG.', 'bad'); };
    img.src = u;
  }

  /* ------------------------------------------------------------ clan */
  function loadClan() {
    S.clanLoading = true;
    return api('/clan').then(function (j) { S.clanData = j; S.clanLoading = false; if (S.view === 'clan') { var v = $('#view'); if (v) v.innerHTML = clanView(); } }, function (x) { S.clanLoading = false; toast(x.message, 'bad'); });
  }
  function weekDots(goalDays, weekStart) {
    var out = '', d0 = new Date(weekStart + 'T12:00:00'), today = S.data.today;
    for (var i = 0; i < 7; i++) {
      var d = new Date(d0); d.setDate(d0.getDate() + i);
      var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      var on = goalDays.indexOf(k) >= 0;
      out += '<i class="wd' + (on ? ' on' : '') + (k > today ? ' future' : '') + (k === today ? ' now' : '') + '" title="' + fmtDay(k, { weekday: 'short', day: 'numeric' }) + (on ? ': goal reached' : '') + '"></i>';
    }
    return '<span class="wdots" aria-label="' + goalDays.length + ' goal days this week">' + out + '</span>';
  }
  function clanView() {
    var j = S.clanData;
    if (!j) return '<div class="loading"><span class="spin"></span>Loading your clan…</div>';
    var c = j.clan, st = j.standings;
    var standings = st.length ? '<section class="card"><div class="card-h"><h3>🏁 Clan race this week</h3><span class="muted small">Average goal days per member</span></div><ol class="rows">'
      + st.map(function (r) { return '<li class="row' + (c && r.id === c.id ? ' me' : '') + '"><span class="rank r' + Math.min(r.rank, 4) + '">' + r.rank + '</span><span class="clan-em">' + esc(r.emoji) + '</span><div class="r-main"><div class="r-name"><span dir="auto">' + esc(r.name) + '</span></div><div class="r-meta"><span>' + r.size + ' members</span><span class="st">🔥 ' + r.streak + '</span></div></div><b class="score">' + r.score.toFixed(1) + '</b></li>'; }).join('')
      + '</ol></section>' : '';
    if (!c) return '<div class="grid clan-grid"><div class="col main"><section class="card center-card"><div class="big-emoji">🛡️</div><h2>You\'re not in a clan yet</h2><p class="muted">Clans are small teams that keep a streak together. Sherif assigns them, so yours will appear here soon.</p></section></div><div class="col side">' + standings + '</div></div>';
    var rank = st.filter(function (r) { return r.id === c.id; })[0];
    var members = c.members.map(function (m) {
      var me = m.id === S.data.me.id;
      return '<li class="row' + (me ? ' me' : '') + '">' + avatar(m, 38) + '<div class="r-main"><div class="r-name"><span dir="auto">' + esc(m.name) + '</span>' + (me ? '<small>(you)</small>' : '') + '<span>' + m.icon + '</span></div>'
        + '<div class="r-meta"><span class="lv">Lv ' + m.level + '</span><div class="bar mini"><i style="width:' + m.health + '%;background:' + healthColor(m.health) + '"></i></div><span class="st">🔥 ' + m.streak + '</span>' + weekDots(m.goalDays, j.weekStart) + '</div></div>'
        + '<span class="today-chip ' + (m.today ? 'yes' : 'no') + '">' + (m.today ? '✓ ' + m.todayMin + 'm' : 'not yet') + '</span>'
        + '<div class="r-acts">' + (!me && canHelp() ? '<button class="icon-btn sm" data-act="cast-on" data-id="' + m.id + '" aria-label="Use a skill on ' + esc(m.name) + '">⚡</button>' : '') + '<button class="icon-btn sm" data-act="profile" data-id="' + m.id + '" aria-label="Profile">ⓘ</button></div></li>';
    }).join('');
    var left = Math.max(0, c.need - c.today);
    return '<div class="grid clan-grid"><div class="col main">'
      + '<section class="card clan-hero"><span class="clan-big" aria-hidden="true">' + esc(c.emoji) + '</span><div class="clan-info"><span class="eyebrow">Your clan</span><h2 dir="auto">' + esc(c.name) + '</h2>'
      + '<div class="pills"><span class="pill">🔥 ' + c.streak + '-day clan streak</span><span class="pill">' + c.score.toFixed(1) + ' goal days per member</span>' + (rank ? '<span class="pill lv">#' + rank.rank + ' of ' + st.length + ' clans</span>' : '') + '</div>'
      + '<p class="muted small">' + c.today + ' of ' + c.size + ' studied today. ' + (left ? left + ' more needed to keep the clan streak going.' : 'The clan streak is safe for today! 🎉') + '</p></div>'
      + '<button class="btn primary" data-act="open-clan-chat">💬 Clan chat</button></section>'
      + '<section class="card"><div class="card-h"><h3>Members</h3><span class="muted small">Dots = days this week you reached your goal</span></div><ol class="rows">' + members + '</ol></section>'
      + '</div><div class="col side">' + standings + '</div></div>';
  }

  /* ------------------------------------------------------------ chat */
  var C = { rooms: null, room: null, msgs: [], loadingRoom: false, enabled: true, muted: '', admin: false, rec: null };
  function loadRooms() {
    return api('/chat/rooms').then(function (j) {
      C.rooms = j.rooms; C.enabled = j.enabled; C.muted = j.muted; C.admin = j.admin;
      S.chatUnread = j.unread;
      var badge = $('.nav [data-view=chat] i');
      if (S.view !== 'chat') { if (badge) badge.textContent = j.unread; else if (j.unread) { var b = $('.nav [data-view=chat]'); if (b) b.insertAdjacentHTML('beforeend', '<i>' + j.unread + '</i>'); } if (!j.unread && badge) badge.remove(); }
      if (S.view === 'chat') paintRoomList();
      if (C.pending) { var p = C.pending; C.pending = 0; openRoom(p); }
    }, function () {});
  }
  function roomIcon(r) { return r.type === 'public' ? '🌍' : r.type === 'clan' ? esc(r.emoji || '🛡️') : '👥'; }
  function paintChat() {
    var v = $('#view'); if (!v) return;
    v.innerHTML = '<section class="card chat' + (C.room ? ' has-room' : '') + '"><aside class="rooms"><div class="rooms-h"><h3>Chats</h3><button class="btn sm-btn" data-act="new-group">＋ Group</button></div><ul id="room-list"></ul>'
      + '<p class="muted small rules">Be kind and keep it about learning. Sherif can review reported messages.</p></aside><div class="convo" id="convo"></div></section>';
    paintRoomList(); paintConvo();
    if (!C.rooms) loadRooms();
  }
  function paintRoomList() {
    var el = $('#room-list'); if (!el) return;
    if (!C.rooms) { el.innerHTML = '<li class="muted small pad">Loading…</li>'; return; }
    el.innerHTML = C.rooms.map(function (r) {
      return '<li><button class="room' + (C.room && C.room.id === r.id ? ' on' : '') + '" data-act="open-room" data-id="' + r.id + '"><span class="room-ic">' + roomIcon(r) + '</span><span class="room-main"><b dir="auto">' + esc(r.name) + '</b><small dir="auto">' + (r.last ? esc(r.last.who.split(' ')[0]) + ': ' + esc(r.last.text) : r.type === 'group' ? 'Say hi to your group 👋' : 'No messages yet') + '</small></span>'
        + (r.unread ? '<i class="unread">' + r.unread + '</i>' : '') + '</button></li>';
    }).join('') + (C.rooms.filter(function (r) { return r.type === 'group'; }).length ? '' : '<li class="muted small pad">Start a private group of 3–5 classmates to study together.</li>');
  }
  function linkify(t) { return esc(t).replace(/\bhttps?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener nofollow">' + u + '</a>'; }); }
  function msgHtml(m, prev) {
    var mine = m.who.id === S.data.me.id;
    var grouped = prev && prev.who.id === m.who.id && (new Date(m.at) - new Date(prev.at)) < 5 * 60000;
    var body = m.gone ? '<em class="muted">Message deleted</em>' : (m.audio ? '<audio controls preload="none" src="' + esc(m.audio) + '"></audio>' : '') + (m.body ? '<p dir="auto">' + linkify(m.body) + '</p>' : '');
    var menu = m.gone ? '' : '<span class="m-acts">' + (mine || C.admin ? '<button class="icon-btn sm" data-act="msg-del" data-id="' + m.id + '" title="Delete" aria-label="Delete message">🗑</button>' : '') + (!mine ? '<button class="icon-btn sm" data-act="msg-report" data-id="' + m.id + '" title="Report" aria-label="Report message">⚑</button>' : '') + '</span>';
    return '<li class="msg' + (mine ? ' mine' : '') + (grouped ? ' grouped' : '') + '" data-id="' + m.id + '">' + (grouped ? '<span class="av-gap"></span>' : avatar(m.who, 32))
      + '<div class="bubble">' + (grouped ? '' : '<div class="m-head"><b dir="auto">' + esc(m.who.name) + '</b> ' + esc(m.who.icon || '') + '<time>' + new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</time></div>') + body + '</div>' + menu + '</li>';
  }
  function paintMessages(keepScroll) {
    var list = $('#msgs'); if (!list) return;
    var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = (C.msgs.length >= 50 && !C.noOlder ? '<li class="center"><button class="btn ghost sm-btn" data-act="older">Load earlier messages</button></li>' : '')
      + (C.msgs.length ? C.msgs.map(function (m, i) { return msgHtml(m, C.msgs[i - 1]); }).join('') : '<li class="empty-chat muted">No messages yet. Start the conversation! 👋</li>');
    if (!keepScroll || nearBottom) list.scrollTop = list.scrollHeight;
  }
  function paintConvo() {
    var el = $('#convo'); if (!el) return;
    var r = C.room;
    if (!r) { el.innerHTML = '<div class="convo-empty"><div class="big-emoji">💬</div><p class="muted">Pick a chat on the left.</p></div>'; return; }
    var head = '<div class="convo-h"><button class="icon-btn back" data-act="close-room" aria-label="Back to chats">←</button><span class="room-ic">' + roomIcon(r) + '</span><div class="room-main"><b dir="auto">' + esc(r.name) + '</b><small>'
      + (r.type === 'public' ? 'Everyone in the tracker' : r.type === 'clan' ? 'Your clan' : r.members.map(function (m) { return esc(m.name.split(' ')[0]); }).join(', ')) + '</small></div>'
      + (r.type === 'group' ? (r.owner === S.data.me.id && r.members.length < 5 ? '<button class="btn sm-btn" data-act="group-add">＋ Add</button>' : '') + '<button class="btn ghost sm-btn" data-act="group-leave">Leave</button>' : '') + '</div>';
    var canSend = C.admin || (C.enabled && !(C.muted && C.muted >= S.data.today));
    var composer = canSend
      ? '<form class="composer" id="f-msg"><button type="button" class="icon-btn mic" data-act="mic" aria-label="Record a voice message" title="Voice message">🎤</button><div class="rec-bar" hidden><span class="rec-dot"></span><span id="rec-t">0:00</span><button type="button" class="btn ghost sm-btn" data-act="rec-cancel">Cancel</button><button type="button" class="btn primary sm-btn" data-act="rec-send">Send voice</button></div>'
        + '<textarea id="m-body" rows="1" maxlength="1000" placeholder="Write a message… (Enter to send)" dir="auto" aria-label="Message"></textarea><button class="btn primary" type="submit" aria-label="Send">➤</button></form>'
      : '<p class="note">' + (C.enabled ? 'You can read the chat but can\'t send messages until ' + fmtDay(C.muted) + '.' : 'Chat is paused right now.') + '</p>';
    el.innerHTML = head + '<ul class="msgs" id="msgs"><li class="loading"><span class="spin"></span></li></ul>' + composer;
    var ta = $('#m-body');
    if (ta) {
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(); } });
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
      $('#f-msg').addEventListener('submit', function (e) { e.preventDefault(); sendMsg(); });
    }
    if (C.msgs.length && C.msgs.roomId === r.id) paintMessages(); else loadMsgs();
  }
  function loadMsgs() {
    var r = C.room; if (!r) return;
    api('/chat/rooms/' + r.id + '/messages').then(function (j) { if (!C.room || C.room.id !== r.id) return; C.msgs = j.messages; C.msgs.roomId = r.id; C.noOlder = j.messages.length < 50; paintMessages(); markRoomRead(r.id); }, function (x) { toast(x.message, 'bad'); });
  }
  function pollMsgs() {
    var r = C.room; if (!r || S.view !== 'chat' || document.hidden) return;
    var last = C.msgs.length ? C.msgs[C.msgs.length - 1].id : 0;
    api('/chat/rooms/' + r.id + '/messages', { query: { after: last } }).then(function (j) {
      if (!C.room || C.room.id !== r.id || !j.messages.length) return;
      var have = {}; C.msgs.forEach(function (m) { have[m.id] = 1; });
      j.messages.forEach(function (m) { if (!have[m.id]) C.msgs.push(m); });
      paintMessages(true); markRoomRead(r.id);
    }, function () {});
  }
  function markRoomRead(id) { (C.rooms || []).forEach(function (x) { if (x.id === id) x.unread = 0; }); S.chatUnread = (C.rooms || []).reduce(function (a, x) { return a + x.unread; }, 0); paintRoomList(); }
  function sendMsg(form) {
    var ta = $('#m-body'), r = C.room; if (!r) return;
    var body = ta ? ta.value.trim() : '';
    if (!body && !form) return;
    var last = C.msgs.length ? C.msgs[C.msgs.length - 1].id : 0;
    var opt = form ? { method: 'POST', form: form } : { method: 'POST', body: { body: body } };
    opt.query = { after: last };
    if (ta && !form) { ta.value = ''; ta.style.height = 'auto'; }
    api('/chat/rooms/' + r.id + '/messages', opt).then(function (j) {
      var have = {}; C.msgs.forEach(function (m) { have[m.id] = 1; });
      j.messages.forEach(function (m) { if (!have[m.id]) C.msgs.push(m); });
      paintMessages(); loadRooms();
    }, function (x) { if (ta && !form) ta.value = body; toast(x.message, 'bad'); });
  }
  function openRoom(id) {
    var r = (C.rooms || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    C.room = r; C.msgs = []; S.view = 'chat';
    if (!$('#convo')) renderView(); else { paintRoomList(); paintConvo(); $('.chat').classList.add('has-room'); }
  }
  /* voice notes */
  function startRec() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) return toast('Voice messages aren\'t supported in this browser.', 'bad');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'], type = '';
      for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { type = types[i]; break; }
      var rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream), chunks = [], t0 = Date.now();
      C.rec = { rec: rec, stream: stream, send: false };
      rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); }); clearInterval(C.rec.tick);
        var bar = $('.rec-bar'), ta = $('#m-body'), mic = $('.mic'); if (bar) bar.hidden = true; if (ta) ta.hidden = false; if (mic) mic.hidden = false;
        if (C.rec.send && chunks.length) {
          var mt = (rec.mimeType || type || 'audio/webm').split(';')[0], fd = new FormData();
          fd.append('audio', new Blob(chunks, { type: mt }), 'voice.' + (/mp4/.test(mt) ? 'm4a' : /ogg/.test(mt) ? 'ogg' : 'webm'));
          fd.append('body', ''); toast('Sending voice message…'); sendMsg(fd);
        }
        C.rec = null;
      };
      rec.start();
      var bar = $('.rec-bar'), ta = $('#m-body'), mic = $('.mic'); if (bar) bar.hidden = false; if (ta) ta.hidden = true; if (mic) mic.hidden = true;
      C.rec.tick = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000), el = $('#rec-t'); if (el) el.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); if (s >= 120) { C.rec.send = true; rec.stop(); } }, 250);
    }, function () { toast('Allow microphone access in your browser to send voice messages.', 'bad'); });
  }
  /* groups */
  function openPeoplePicker(title, maxPick, exclude, onDone, withName) {
    var picked = {};
    openModal(mHead(title, 'Pick up to ' + maxPick + ' classmate' + (maxPick > 1 ? 's' : ''))
      + '<div class="stack">' + (withName ? '<label class="f">Group name<input id="g-name" maxlength="40" placeholder="e.g. Morning shadowing crew" dir="auto"></label>' : '')
      + '<div class="f"><span>Add classmates</span><input id="g-q" placeholder="Search by name" autocomplete="off"><div class="chips" id="g-picked"></div><ul class="pick-list" id="g-list"><li class="muted small pad">Loading…</li></ul></div>'
      + '<p class="err" role="alert"></p><button class="btn primary wide" id="g-go" disabled>' + (withName ? 'Create group' : 'Add to group') + '</button></div>', 'narrow');
    var list = [], t;
    function draw() {
      var n = Object.keys(picked).length;
      $('#g-picked').innerHTML = Object.keys(picked).map(function (id) { return '<button class="chip-x" data-pick="' + id + '">' + esc(picked[id].name) + ' ✕</button>'; }).join('');
      $('#g-list').innerHTML = list.filter(function (p) { return exclude.indexOf(p.id) < 0; }).map(function (p) { return '<li><button class="pick" data-pick="' + p.id + '"' + (!picked[p.id] && n >= maxPick ? ' disabled' : '') + '>' + avatar(p, 28) + '<span dir="auto">' + esc(p.name) + '</span><em>' + (picked[p.id] ? '✓' : '＋') + '</em></button></li>'; }).join('') || '<li class="muted small pad">No one found.</li>';
      $('#g-go').disabled = withName ? n < 2 : n < 1;
      $('#g-go').textContent = (withName ? 'Create group' : 'Add to group') + (n ? ' (' + (withName ? n + 1 : n) + (withName ? ' people' : '') + ')' : '');
    }
    function search() { api('/members', { query: { q: $('#g-q').value.trim() } }).then(function (j) { list = j.members; draw(); }); }
    $('#g-q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(search, 250); });
    $('#modal .modal').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]'); if (!b) return;
      var id = +b.dataset.pick, p = list.filter(function (x) { return x.id === id; })[0] || picked[id];
      if (picked[id]) delete picked[id]; else if (Object.keys(picked).length < maxPick) picked[id] = p;
      draw();
    });
    $('#g-go').addEventListener('click', function () { var btn = $('#g-go'); busy(btn, true); onDone(Object.keys(picked).map(Number), withName ? $('#g-name').value.trim() : '', function (msg) { busy(btn, false); var er = $('#modal .err'); if (er) er.textContent = msg; }); });
    search();
  }
  function reportMsg(id) {
    openModal(mHead('Report this message', 'Sherif will review it. The author won\'t know who reported it.')
      + '<div class="stack"><label class="f">What\'s wrong? <small>optional</small><input id="rep-why" maxlength="200" placeholder="e.g. rude, spam, off-topic" dir="auto"></label><button class="btn primary" data-act="do-report" data-id="' + id + '">Send report</button></div>', 'narrow');
  }

  /* ------------------------------------------------------------ share to Skool */
  function shareText() {
    var s = S.data.stats;
    return (s.dayFinished ? 'Day ' + s.studyDays + ' ✅ ' : '') + '🔥 ' + s.streak + '-day streak'
      + (s.todayMinutes ? ' · ⏱️ ' + hm(s.todayMinutes) + ' today' : '') + ' · Level ' + s.level + ' ' + s.title + ' ' + ((cfg.classes[S.data.me.class] || {}).icon || '')
      + (S.data.clan ? ' · ' + S.data.clan.emoji + ' ' + S.data.clan.name : '') + '\n#SawaTracker';
  }
  function drawCard() {
    var s = S.data.stats, c = document.createElement('canvas'); c.width = c.height = 1080;
    var g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 1080, 1080);
    grd.addColorStop(0, '#1b1d33'); grd.addColorStop(1, '#3d3bb8'); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1080);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (var i = 0; i < 9; i++) { g.beginPath(); g.arc(900 - i * 40, 160 + i * 30, 120 + i * 20, 0, 7); g.fill(); }
    var F = function (w, sz) { return w + ' ' + sz + 'px Fredoka, Nunito, "Segoe UI", sans-serif'; };
    g.fillStyle = '#ae1e20'; g.beginPath(); g.roundRect ? g.roundRect(80, 80, 72, 72, 18) : g.rect(80, 80, 72, 72); g.fill();
    g.fillStyle = '#fff'; g.font = F(700, 44); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('S', 116, 118);
    g.textAlign = 'left'; g.font = F(600, 40); g.fillText('Sawa Tracker', 176, 118);
    g.font = F(600, 52); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(S.data.me.name, 80, 300);
    g.font = '200px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.fillText('🔥', 70, 500);
    g.fillStyle = '#fff'; g.font = F(700, 240); g.fillText(String(s.streak), 300, 500);
    g.font = F(600, 56); g.fillStyle = '#f5c242'; g.fillText('day streak', 310, 640);
    var stats = [[hm(s.todayMinutes), 'today'], [hm(s.totalMinutes), 'total'], ['Lv ' + s.level, s.title]];
    stats.forEach(function (st, k) {
      var x = 80 + k * 320; g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.roundRect ? g.roundRect(x, 760, 290, 170, 28) : g.rect(x, 760, 290, 170); g.fill();
      g.fillStyle = '#fff'; g.font = F(700, 64); g.fillText(st[0], x + 30, 830); g.font = F(500, 34); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(st[1], x + 30, 895);
    });
    g.font = F(500, 32); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(new Date(S.data.today + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + (S.data.clan ? '  ·  ' + S.data.clan.name : ''), 80, 1000);
    return c;
  }
  function openShare() {
    var make = function () {
      var c = drawCard(), url = c.toDataURL('image/png');
      openModal(mHead('Share to Skool', 'Post it in today\'s check-in thread') + '<img class="share-img" src="' + url + '" alt="Your progress card">'
        + '<textarea id="share-t" rows="3" readonly dir="auto">' + esc(shareText()) + '</textarea>'
        + '<div class="row-btns"><button class="btn" data-act="copy-share">📋 Copy text</button><a class="btn" href="' + url + '" download="sawa-progress-' + S.data.today + '.png">⬇️ Save image</a><a class="btn primary" href="' + esc(S.data.skoolUrl) + '" target="_blank" rel="noopener">Open Skool ↗</a></div>');
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(make);
  }

  /* ------------------------------------------------------------ after actions */
  function afterAction(j, msg) {
    if (j.data) S.data = j.data;
    renderDash(); loadBoard(); loadFeed('new');
    if (j.levelUp) celebrate('🎉 Level up! You reached level ' + j.levelUp + '.');
    else if (j.badges && j.badges.length) { var x = S.data.badges.filter(function (b) { return b.id === j.badges[0]; })[0]; if (x) celebrate(x.icon + ' New badge: ' + x.name); }
    else if (msg) toast(msg, 'good');
  }
  function celebrate(msg) {
    toast(msg, 'good');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = document.createElement('div'); box.className = 'confetti';
    for (var i = 0; i < 40; i++) { var p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = ['#f5a524', '#3d3bb8', '#2aa876', '#e5484d', '#2f8fd8'][i % 5]; p.style.animationDelay = Math.random() * 0.4 + 's'; box.appendChild(p); }
    root.appendChild(box); setTimeout(function () { box.remove(); }, 2200);
  }

  /* ------------------------------------------------------------ events */
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act;
    if (S.dayWizard && /^(d-|mood)/.test(a)) { e.preventDefault(); return S.dayWizard.handle(a, el); }
    switch (a) {
      case 'overlay': if (e.target === el) { S.dayWizard = null; closeModal(); } break;
      case 'close': S.dayWizard = null; closeModal(); break;
      case 'auth-tab': $$('[data-act=auth-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); }); $('#f-in').hidden = el.dataset.tab !== 'in'; $('#f-join').hidden = el.dataset.tab !== 'join'; break;
      case 'pick-class':
        $$('.class-card').forEach(function (b) { b.disabled = true; });
        api('/class', { method: 'POST', body: { class: el.dataset.class } }).then(function (j) { S.data = j; closeModal(); start(); toast('Welcome, ' + cfg.classes[el.dataset.class].name + '!', 'good'); }, function (x) { $$('.class-card').forEach(function (b) { b.disabled = false; }); toast(x.message, 'bad'); });
        break;
      case 'change-class': renderClassPick(true); break;
      case 'log-activity': openLogActivity(); break;
      case 'log-day': openLogDay(); break;
      case 'quick-min': var t = $('#' + el.dataset.target); if (t) t.value = el.dataset.min; break;
      case 'del-log':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Remove?'; el.classList.add('confirm'); setTimeout(function () { if (el.isConnected) { el.dataset.confirm = ''; el.textContent = '✕'; el.classList.remove('confirm'); } }, 3000); break; }
        api('/log/' + el.dataset.id, { method: 'DELETE' }).then(function (j) { afterAction(j, 'Activity removed'); }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'skill-info': openSkill(el.dataset.skill); break;
      case 'cast': doCast(el); break;
      case 'cast-on': openCastOn(+el.dataset.id); break;
      case 'profile': openProfile(+el.dataset.id); break;
      case 'board-tab': S.board.tab = el.dataset.tab; S.board.showAll = false; $$('[data-act=board-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); }); S.board.rows = []; S.board.loaded = false; paintBoard(); loadBoard(); break;
      case 'board-more': S.board.showAll = true; paintBoard(); break;
      case 'feed-more': loadFeed('old'); break;
      case 'react':
        var id = +el.dataset.id, em = el.dataset.emoji;
        api('/react', { method: 'POST', body: { event: id, emoji: em } }).then(function (j) {
          S.feed.forEach(function (ev) { if (ev.id === id) { ev.reactions = ev.reactions || {}; ev.reactions[em] = j.count; ev.mine = (ev.mine || []).filter(function (x) { return x !== em; }); if (j.on) ev.mine.push(em); } });
          paintFeed();
        }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'view':
        S.view = el.dataset.view; if (S.view !== 'chat' && C.rec) { C.rec.send = false; C.rec.rec.stop(); }
        try { history.replaceState(null, '', S.view === 'home' ? location.pathname + location.search : '#' + S.view); } catch (x) {}
        renderView(); if (S.view === 'chat') loadRooms(); if (S.view === 'home') { loadBoard(); paintFeed(); }
        break;
      case 'share': openShare(); break;
      case 'copy-share':
        var st = $('#share-t'); st.select();
        (navigator.clipboard ? navigator.clipboard.writeText(st.value) : Promise.reject()).then(function () { toast('Copied. Paste it in Skool!', 'good'); }, function () { document.execCommand('copy'); toast('Copied', 'good'); });
        break;
      case 'open-clan-chat':
        S.view = 'chat'; renderView();
        loadRooms().then(function () { var r = (C.rooms || []).filter(function (x) { return x.type === 'clan'; })[0]; if (r) openRoom(r.id); });
        break;
      case 'open-room': openRoom(+el.dataset.id); break;
      case 'close-room': C.room = null; C.msgs = []; paintChat(); break;
      case 'older':
        if (!C.room || !C.msgs.length) break;
        api('/chat/rooms/' + C.room.id + '/messages', { query: { before: C.msgs[0].id } }).then(function (j) { if (j.messages.length < 50) C.noOlder = true; var roomId = C.msgs.roomId; C.msgs = j.messages.concat(C.msgs); C.msgs.roomId = roomId; var list = $('#msgs'), h = list.scrollHeight; paintMessages(true); list.scrollTop = list.scrollHeight - h; });
        break;
      case 'new-group':
        openPeoplePicker('New private group', 4, [], function (ids, nm, fail) {
          api('/chat/groups', { method: 'POST', body: { name: nm, members: ids } }).then(function (j) { closeModal(); C.rooms = j.rooms; S.view = 'chat'; openRoom(j.room); toast('Group created', 'good'); }, function (x) { fail(x.message); });
        }, true);
        break;
      case 'group-add':
        var have = C.room.members.map(function (m) { return m.id; });
        openPeoplePicker('Add to ' + C.room.name, 5 - have.length, have, function (ids, nm, fail) {
          api('/chat/groups/' + C.room.id + '/members', { method: 'POST', body: { members: ids } }).then(function (j) { closeModal(); C.rooms = j.rooms; var id = C.room.id; C.room = null; openRoom(id); toast('Added', 'good'); }, function (x) { fail(x.message); });
        }, false);
        break;
      case 'group-leave':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Leave group?'; el.classList.add('danger-btn'); break; }
        api('/chat/groups/' + C.room.id + '/leave', { method: 'POST' }).then(function (j) { C.rooms = j.rooms; C.room = null; C.msgs = []; paintChat(); toast('You left the group'); }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'msg-del':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Delete?'; el.classList.add('confirm'); break; }
        api('/chat/messages/' + el.dataset.id, { method: 'DELETE' }).then(function () { C.msgs.forEach(function (m) { if (m.id === +el.dataset.id) { m.gone = true; m.body = ''; m.audio = ''; } }); paintMessages(true); }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'msg-report': reportMsg(+el.dataset.id); break;
      case 'do-report':
        busy(el, true, 'Sending…');
        api('/chat/messages/' + el.dataset.id + '/report', { method: 'POST', body: { reason: $('#rep-why').value.trim() } }).then(function () { closeModal(); toast('Thanks. Sherif will review it.', 'good'); }, function (x) { busy(el, false); toast(x.message, 'bad'); });
        break;
      case 'mic': startRec(); break;
      case 'rec-cancel': if (C.rec) { C.rec.send = false; C.rec.rec.stop(); } break;
      case 'rec-send': if (C.rec) { C.rec.send = true; C.rec.rec.stop(); } break;
      case 'notifs': openNotifs(); break;
      case 'settings': openSettings(); break;
      case 'pick-avatar': $('#av-file').click(); break;
      case 'save-goal':
        busy(el, true);
        api('/profile', { method: 'POST', body: { goal: parseInt($('#goal').value, 10) || 30 } }).then(function (j) { S.data = j.data; closeModal(); renderDash(); toast('Daily goal saved', 'good'); }, function (x) { busy(el, false); toast(x.message, 'bad'); });
        break;
    }
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'av-file' && e.target.files[0]) uploadAvatar(e.target.files[0]);
    if (e.target.id === 'remind') {
      api('/reminder', { method: 'POST', body: { hour: e.target.value } }).then(function (j) { S.data = j.data; toast(e.target.value === '' ? 'Reminders turned off' : 'Reminder saved. We\'ll only email you on days you haven\'t studied yet.', 'good'); }, function (x) { toast(x.message, 'bad'); });
    }
  });
  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'f-quest') return;
    e.preventDefault();
    var btn = e.target.querySelector('button'); busy(btn, true);
    api('/quest', { method: 'POST', body: { note: $('#q-note').value.trim() } }).then(function (j) { afterAction(j, 'Quest done! +' + j.sp + ' SP 🎯'); }, function (x) { busy(btn, false); toast(x.message, 'bad'); });
  });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#modal').innerHTML) { S.dayWizard = null; closeModal(); } });

  /* ------------------------------------------------------------ start */
  function poll() {
    S.timers.forEach(clearInterval);
    S.timers = [
      setInterval(function () { if (!document.hidden && S.view !== 'chat') loadFeed('new'); }, 15000),
      setInterval(pollMsgs, 4000),
      setInterval(function () { if (!document.hidden) loadRooms(); }, 20000),
      setInterval(function () { if (!document.hidden && !$('#modal').innerHTML) loadBoard(); }, 60000),
      setInterval(function () { if (!document.hidden && !$('#modal').innerHTML) api('/me').then(function (j) { var u = j.unread !== S.data.unread || j.stats.health !== S.data.stats.health; S.data = j; if (u && S.view === 'home') renderDash(); }, function () {}); }, 120000)
    ];
    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.data) { loadFeed('new'); } });
  }
  function start() {
    if (!S.data.me.class) return renderClassPick(false);
    var h = (location.hash || '').slice(1);
    S.view = ['home', 'clan', 'chat'].indexOf(h) >= 0 ? h : 'home';
    if (/^chat-\d+$/.test(h)) { S.view = 'chat'; C.pending = +h.slice(5); }
    renderDash(); loadBoard(); loadFeed(); loadRooms(); poll();
  }
  if (cfg.status === 'guest') renderGuest();
  else if (cfg.status === 'pending') renderWaiting(false);
  else if (cfg.status === 'denied') renderWaiting(true);
  else api('/me').then(function (j) { S.data = j; start(); }, function (x) {
    $('#app').innerHTML = '<div class="center-card card"><div class="big-emoji">⚠️</div><h2>The tracker couldn\'t load</h2><p class="muted">' + esc(x.message) + '</p><button class="btn primary" onclick="location.reload()">Try again</button></div>';
  });
})();
