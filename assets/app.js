/* Sawa Tracker: the student app. Arabic, RTL, Sawa visual identity.
   Renders into a shadow root so the site theme can't break it. */
(function () {
  'use strict';
  var host = document.querySelector('.sawa-tracker-app');
  if (!host || host.shadowRoot) return;
  var cfgEl = host.nextElementSibling;
  var cfg = JSON.parse(cfgEl.textContent);
  /* Embedded in the one Sawa English app (/app): the app owns the menu; it shows one part at a time with
     window.SawaTracker.show(view) and hears back through 'sawa-tracker' events on document. */
  var EMB = !!cfg.embedded;
  function emit(detail) { if (EMB) { try { document.dispatchEvent(new CustomEvent('sawa-tracker', { detail: detail })); } catch (e) { /* old browser */ } } }

  if (!document.getElementById('sawa-brand-fonts-tr')) {
    var lf = document.createElement('link');
    lf.id = 'sawa-brand-fonts-tr'; lf.rel = 'stylesheet';
    lf.href = 'https://fonts.googleapis.com/css2?family=Changa:wght@500;800&family=IBM+Plex+Sans+Arabic:wght@400;600&family=Instrument+Serif:ital@0;1&display=swap';
    document.head.appendChild(lf);
  }

  var root = host.attachShadow({ mode: 'open' });
  if (EMB) host.classList.add('emb');
  root.innerHTML = '<link rel="stylesheet" href="' + cfg.css + '"><div class="app" id="app" dir="rtl" lang="ar" aria-live="polite"><div class="loading"><span class="spin"></span>بنجهز التراكر…</div></div><div id="modal" dir="rtl" lang="ar"></div><div class="toast" id="toast" role="status" dir="rtl"></div>';
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

  /* ------------------------------------------------------------ icons (line icons, currentColor) */
  var P = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    chat: 'M4 5h16v11H9l-5 4z',
    cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    plus: 'M12 5v14M5 12h14',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
    flame: 'M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5.5.5 2 1.5 3 2.5 3.5 1-2 .5-5 0-8.5z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.1',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
    mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM18 11a6 6 0 0 1-12 0M12 17v4',
    reply: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v5',
    smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
    text: 'M4 6h16M4 12h16M4 18h10',
    globe2: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
    mega: 'M3 10v4h4l9 5V5l-9 5zM19 9a4 4 0 0 1 0 6',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2.5.6 4 2.6 4 6',
    x: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12l5 5 9-10',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z',
    sword: 'M14.5 3.5H20.5V9.5L9 21 3 15zM6 12l6 6M3 21l3-3',
    spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
    lotus: 'M12 21c-4-3-7-7-7-12 4 0 7 3 7 7 0-4 3-7 7-7 0 5-3 9-7 12z',
    crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
    medal: 'M8 3l4 6 4-6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8',
    cards: 'M8 3h12v14H8zM4 7v14h12',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    headph: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
    music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    pen: 'M4 20h4L19 9l-4-4L4 16z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    snow: 'M12 2v20M3.5 7l17 10M20.5 7l-17 10',
    boss: 'M12 3C7 3 4 6 4 11c0 3 2 5 3 6v4h10v-4c1-1 3-3 3-6 0-5-3-8-8-8zM9 11.5h.01M15 11.5h.01M10 21v-3M14 21v-3',
    tower: 'M5 21V9h14v12M5 9V5h3v2h3V5h2v2h3V5h3v4M10 21v-4h4v4',
    gem: 'M6 3h12l3 6-9 12L3 9zM3 9h18M9 3l3 18M15 3l-3 18',
    columns: 'M3 9l9-5 9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 21h18',
    wings: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 10v10M12 12c-3-3-7-3-10-1 2 4 6 5 10 4M12 12c3-3 7-3 10-1-2 4-6 5-10 4',
    heartplus: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 9v5M9.5 11.5h5',
    back: 'M9 6l6 6-6 6',
    send: 'M20 4L3 11l7 2.5L12.5 21z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    flat: 'M5 12h14'
  };
  function ico(n, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[n] || P.spark) + '"/></svg>'; }

  var ACT = {
    'Flashcards': { ic: 'cards', ar: 'فلاش كاردز' },
    'Active Immersion': { ic: 'eye', ar: 'تعرّض نشط' },
    'Passive Immersion': { ic: 'headph', ar: 'تعرّض سلبي' },
    'Music': { ic: 'music', ar: 'مزيكا' },
    'Pronunciation/Grammar': { ic: 'mic', ar: 'نطق وجرامر' },
    'Others': { ic: 'pen', ar: 'حاجة تانية' }
  };
  var GRAYS = ['#0F0F10', '#3D3B3A', '#625F5E', '#8A8584', '#B3AEAB', '#D6D2CF'];
  var CLASS = {
    warrior: { ic: 'sword', ar: 'المحارب', tag: 'بيحمي الستريك. بيدافع عن زمايله عشان محدش يخسر تقدمه.' },
    healer: { ic: 'heart', ar: 'المعالج', tag: 'بيرجّع الصحة. بيشد زمايله اللي بيقعوا ويرجعهم للطريق.' }
  };
  var SKILL_IC = { battle_stance: 'shield', shield_ally: 'shield', rally: 'mega', war_cry: 'sword', fortify: 'tower', unbreakable: 'gem', inner_peace: 'lotus', heal: 'heart', empower: 'spark', revitalize: 'heartplus', sanctuary: 'columns', guardian_angel: 'wings' };
  var BADGE = {
    first_log: ['lotus', 'أول خطوة', 'سجّلت أول نشاط'],
    streak_7: ['flame', 'ستريك ٧ أيام', 'ذاكرت ٧ أيام ورا بعض'],
    streak_30: ['bolt', 'ستريك ٣٠ يوم', 'ذاكرت ٣٠ يوم ورا بعض'],
    streak_100: ['crown', 'ستريك ١٠٠ يوم', 'ذاكرت ١٠٠ يوم ورا بعض'],
    hours_10: ['clock', '١٠ ساعات', '١٠ ساعات مذاكرة في المجموع'],
    hours_50: ['medal', '٥٠ ساعة', '٥٠ ساعة مذاكرة في المجموع'],
    hours_100: ['trophy', '١٠٠ ساعة', '١٠٠ ساعة مذاكرة في المجموع'],
    cards_1000: ['cards', '١٠٠٠ كارت', 'راجعت ١٠٠٠ فلاش كارد'],
    helper_10: ['users', 'إيد بتساعد', 'استخدمت ١٠ مهارات على زمايلك'],
    boss_slayer: ['sword', 'هازم الوحش', 'ساعدت في هزيمة وحش الأسبوع']
  };
  var BOSS_AR = {
    'The Procrastination Dragon': 'تنين التسويف', 'The Grammar Goblin': 'عفريت الجرامر', 'The Silent Ghost': 'شبح السكوت', 'The Forgetful Fog': 'ضباب النسيان',
    'The Accent Ogre': 'غول اللكنة', 'The Scroll Serpent': 'تعبان السكرول', 'The Perfectionist Golem': 'تمثال الكمالية', 'The Fear Kraken': 'أخطبوط الخوف'
  };
  function bossName(n) { return BOSS_AR[n] || n; }
  function badgeInfo(id, fallbackName) { var b = BADGE[id]; return b ? { ic: b[0], name: b[1], about: b[2] } : { ic: 'medal', name: fallbackName || '', about: '' }; }
  function badgeByName(n) { for (var k in BADGE) if (BADGE.hasOwnProperty(k)) { var en = { first_log: 'First step', streak_7: '7-day streak', streak_30: '30-day streak', streak_100: '100-day streak', hours_10: '10 hours', hours_50: '50 hours', hours_100: '100 hours', cards_1000: '1,000 cards', helper_10: 'Helping hand', boss_slayer: 'Boss slayer' }[k]; if (en === n) return badgeInfo(k); } return { ic: 'medal', name: n }; }
  function cls(k) { return CLASS[k] || { ic: 'spark', ar: '', tag: '' }; }

  /* ------------------------------------------------------------ helpers */
  var LOC = 'ar-EG-u-nu-latn';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?'; }
  function avatar(p, size) {
    size = size || 40;
    var st = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px';
    if (p && p.avatar) return '<img class="av" src="' + esc(p.avatar) + '" alt="" style="' + st + '" loading="lazy">';
    return '<span class="av" aria-hidden="true" style="' + st + '">' + esc(initials(p && p.name)) + '</span>';
  }
  function hm(min) { min = Math.round(min || 0); var h = Math.floor(min / 60), m = min % 60; return h ? h + 'س ' + m + 'د' : m + 'د'; }
  function act(name) { var a = ACT[name] || { ic: 'pen', ar: name }; for (var i = 0; i < cfg.activities.length; i++) if (cfg.activities[i].name === name) return { name: name, ic: a.ic, ar: a.ar, cards: cfg.activities[i].cards }; return { name: name, ic: a.ic, ar: a.ar }; }
  function actLabel(name) { var a = act(name); return '<span class="act">' + ico(a.ic) + '<span>' + esc(a.ar) + '</span></span>'; }
  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(LOC, { numeric: 'auto' }) : null;
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 45) return 'دلوقتي';
    var units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800]], u = units[0];
    for (var i = 0; i < units.length; i++) if (s >= units[i][1]) u = units[i];
    var n = Math.round(s / u[1]);
    return rtf ? rtf.format(-n, u[0]) : 'من ' + n;
  }
  function fmtDay(d, opts) { return new Date(d + 'T12:00:00').toLocaleDateString(LOC, opts || { day: 'numeric', month: 'short' }); }
  function low(h) { return h < 30; }
  function hpFill(h) { return low(h) ? 'var(--red)' : 'var(--fg)'; }
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
        if (r.status === 401 || (j && j.code === 'rest_cookie_invalid_nonce')) { throw new Error('الجلسة خلصت. اعمل ريفريش للصفحة وكمّل.'); }
        if (!r.ok || j.ok === false) throw new Error((j && j.message) || 'حصلت مشكلة. جرب تاني.');
        return j;
      });
    }, function () { throw new Error('مفيش نت. اتأكد من الاتصال وجرب تاني.'); });
  }
  var toastT;
  function toast(msg, kind) {
    var t = $('#toast'); t.className = 'toast show ' + (kind || ''); t.textContent = msg;
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 3600);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin sm"></span>' + (label || 'بيتحفظ…'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  function plural(n, one, two, many) { return n === 1 ? one : n === 2 ? two : n + ' ' + many; }

  /* ------------------------------------------------------------ state */
  var S = { data: null, board: { tab: 'consistency', rows: [], total: 0, me: null }, feed: [], lastId: 0, oldestId: 0, feedDone: false, timers: [] };

  /* ------------------------------------------------------------ signed-out, pending */
  function brand(big) { return '<div class="brand' + (big ? ' big' : '') + '"><span class="wm">سوا</span><span class="wm-en">Tracker</span></div>'; }
  function renderGuest() {
    $('#app').innerHTML = '<div class="auth">'
      + '<section class="auth-hero">' + brand(true)
      + '<h1>اتعلم الانجليزي، <span class="red">سوا</span>.</h1>'
      + '<ul class="perks"><li>' + ico('flame') + '<span>ابني ستريك مذاكرة يومي وحافظ على صحة العادة عالية</span></li>'
      + '<li>' + ico('shield') + '<span>اختار كلاس واستخدم مهارات تحمي بيها زمايلك وتشدهم</span></li>'
      + '<li>' + ico('boss') + '<span>حارب وحش الأسبوع مع المجتمع كله: كل دقيقة مذاكرة ضربة</span></li>'
      + '<li>' + ico('trophy') + '<span>اكسب أوسمة واطلع في ترتيب الاستمرارية</span></li></ul></section>'
      + '<section class="card auth-card">'
      + '<div class="seg" role="tablist"><button data-act="auth-tab" data-tab="in" aria-pressed="true">تسجيل الدخول</button><button data-act="auth-tab" data-tab="join" aria-pressed="false">اطلب تدخل</button></div>'
      + '<form class="stack" id="f-in" method="post" action="' + esc(cfg.loginUrl) + '">'
      + '<label class="f">الإيميل أو اسم المستخدم<input name="log" autocomplete="username" required dir="ltr"></label>'
      + '<label class="f">الباسورد<input name="pwd" type="password" autocomplete="current-password" required dir="ltr"></label>'
      + '<label class="chk"><input type="checkbox" name="rememberme" value="forever" checked> افتكرني</label>'
      + '<input type="hidden" name="redirect_to" value="' + esc(cfg.here) + '">'
      + '<button class="btn primary wide" type="submit">ادخل</button>'
      + '<a class="muted small" href="' + esc(cfg.lostUrl) + '">نسيت الباسورد؟</a></form>'
      + '<form class="stack" id="f-join" hidden>'
      + '<p class="muted small">التراكر لأعضاء مجتمع سوا انجليش. اطلب تدخل، وأول ما نوافق تقدر تدخل على طول.</p>'
      + '<label class="f">اسمك<input name="name" autocomplete="name" required dir="auto"></label>'
      + '<label class="f">الإيميل<input name="email" type="email" autocomplete="email" required dir="ltr"></label>'
      + '<label class="f">الباسورد <small>٨ حروف على الأقل</small><input name="password" type="password" autocomplete="new-password" minlength="8" required dir="ltr"></label>'
      + '<label class="f">اسمك في مجتمع Skool <small>عشان نلاقيك</small><input name="note" dir="auto"></label>'
      + '<input name="website" class="hpot" tabindex="-1" autocomplete="off" aria-hidden="true">'
      + '<p class="err" role="alert"></p>'
      + '<button class="btn primary wide" type="submit">اطلب تدخل</button></form>'
      + '</section></div>';
    $('#f-join').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('button[type=submit]'), err = f.querySelector('.err');
      err.textContent = '';
      var body = {}; ['name', 'email', 'password', 'note', 'website'].forEach(function (k) { body[k] = f.querySelector('[name=' + k + ']').value.trim(); });
      if (body.password.length < 8) { err.textContent = 'اختار باسورد ٨ حروف على الأقل.'; return; }
      busy(btn, true, 'بيتبعت…');
      api('/request', { method: 'POST', body: body }).then(function () { location.reload(); }, function (x) { busy(btn, false); err.textContent = x.message; });
    });
  }
  function renderWaiting(denied) {
    $('#app').innerHTML = '<div class="center-card card">'
      + '<div class="big-ic">' + ico(denied ? 'lock' : 'hourglass') + '</div>'
      + (denied
        ? '<h2>دخولك على التراكر مش متفعل</h2><p class="muted">لو شايف إن في غلط، ابعت لشريف في مجتمع Skool.</p>'
        : '<h2>شكرًا يا ' + esc(cfg.name.split(' ')[0]) + '. طلبك وصل.</h2><p class="muted">طلبك مستني الموافقة. هيوصلك إيميل أول ما تتفعل، غالبًا خلال يوم.</p>')
      + '<a class="btn" href="' + esc(cfg.logoutUrl) + '">اخرج</a></div>';
  }

  /* ------------------------------------------------------------ class choice */
  function renderClassPick(changing) {
    if (!changing) emit({ gate: 'class' });
    var html = '<div class="center-card card wide-card"><h2>' + (changing ? 'غيّر الكلاس بتاعك' : 'اختار الكلاس بتاعك') + '</h2>'
      + '<p class="muted">الكلاس بيحدد المهارات اللي تقدر تساعد بيها نفسك وزمايلك. ' + (changing ? 'تقدر تغيّره مرة كل ٣٠ يوم.' : 'تقدر تغيّره بعدين.') + '</p><div class="classes">';
    Object.keys(cfg.classes).forEach(function (k) {
      var c = cls(k);
      html += '<button class="class-card" data-act="pick-class" data-class="' + k + '"><span class="class-icon">' + ico(c.ic) + '</span><b>' + esc(c.ar) + '</b><span>' + esc(c.tag) + '</span></button>';
    });
    html += '</div>' + (changing ? '<button class="btn ghost" data-act="close">خليني على الكلاس بتاعي</button>' : '') + '</div>';
    if (changing) openModal(html, 'wide'); else $('#app').innerHTML = html;
  }

  /** Every student needs a real photo of themselves before using the tracker. */
  function renderPhotoGate() {
    emit({ gate: 'photo' });
    $('#app').innerHTML = '<div class="center-card card"><div class="photo-gate">' + avatar(S.data.me, 96) + '</div><h2>ارفع صورتك</h2>'
      + '<p class="muted">كل الطلاب في التراكر بيحطوا صورة شخصية ليهم، عشان المجتمع يبقى حقيقي وتعرفوا بعض. لازم ترفع صورة عشان تكمل.</p>'
      + '<button class="btn primary wide" data-act="pick-avatar">' + ico('plus') + ' اختار صورة</button><input type="file" id="av-file" accept="image/*" hidden>'
      + '<p class="small muted">صورة واضحة لوشك. تقدر تغيّرها بعدين من الإعدادات.</p></div>';
  }

  /* ------------------------------------------------------------ dashboard */
  function renderDash() { renderView(); }
  function renderView() {
    if (EMB) {
      emit({ view: S.view });
      if (S.view === 'today') return renderToday();
      if (S.view === 'community') { $('#app').innerHTML = header() + '<div id="world-card"></div><div id="raids">' + (stage() >= 4 ? '<div class="card"><p class="muted small">Loading…</p></div>' : '<section class="card" dir="ltr"><p class="small muted">🔒 <b>Jobs, gear and raids</b> open at stage 4 (Speak). Until then: fight monsters and finish quests in the Silk Road.</p></section>') + '</div><div id="view">' + clanView() + '</div><div class="grid"><div class="col main">' + feedCard() + '</div><div class="col side">' + boardCard() + '</div></div>'; if (!S.clanLoading) loadClan(); paintBoard(); paintFeed(); if (stage() >= 4) loadRaids(); loadWorldCard(); return; }
      if (S.view === 'world') { openWorld(); return; }
      if (S.view === 'me') { $('#app').innerHTML = header() + '<div class="grid one">' + xpCard() + helpCard() + trendCard() + '<div class="two">' + breakdownCard() + heatCard() + '</div>' + badgesCard() + recentCard() + '</div>'; return; }
      if (S.view === 'chat') { $('#app').innerHTML = '<div id="view"></div>'; paintChat(); return; }
    }
    if (S.view === 'clan') { $('#app').innerHTML = header() + '<div id="view">' + clanView() + '</div>'; if (!S.clanLoading) loadClan(); return; }
    if (S.view === 'chat') { $('#app').innerHTML = header() + '<div id="view"></div>'; paintChat(); return; }
    renderHome();
  }
  /* ------------------------------------------------------------ raids (inside the one app) */
  var RD = null;
  function loadRaids() {
    api('/raids').then(function (j) { RD = j; paintRaids(); }, function (x) { var el = $('#raids'); if (el) el.innerHTML = '<div class="card"><p class="err">' + esc(x.message) + '</p></div>'; });
  }
  function paintRaids() {
    var el = $('#raids'); if (!el || !RD) return;
    var r = RD, safeLeft = Math.max(0, r.coins - r.safe);
    var shield = r.shield ? '<span class="pill">🛡 Raid-proof until ' + new Date(r.shield * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</span>' : '';
    var log = r.log.slice(0, 5).map(function (e) {
      var d = e.data || {}, mine = e.who && e.who.id === S.data.me.id;
      if (e.type !== 'raid') return '';
      return '<li class="rd-log">' + (mine ? '⚔ You raided ' + esc(e.target ? e.target.name : '') + (d.won ? ' and took <b>' + d.loot + ' 🪙</b>' : ' — their defence held') : '🛡 ' + esc(e.who ? e.who.name : '') + (d.won ? ' raided you and took <b>' + d.loot + ' 🪙</b>' : ' tried to raid you — your defence held')) + ' <time>' + ago(e.at) + '</time></li>';
    }).join('');
    var g = r.rpg || {}, J = g.jobs || {}, job = g.job;
    var who = job ? '<div class="sr-who"><span class="sr-job">' + J[job][0] + ' ' + J[job][1] + '</span><span class="small muted">' + esc(J[job][2]) + '</span>' + (g.canJob ? '<button class="btn ghost sm-btn" data-act="sr-jobs" style="justify-self:start">Change job</button>' : '') + '</div>'
      : '<div class="stack"><b>Choose your job</b><div class="sr-jobs">' + Object.keys(J).map(function (k) { return '<button class="sr-jobc" data-act="sr-job" data-job="' + k + '"><b>' + J[k][0] + ' ' + J[k][1] + '</b><span class="small">' + esc(J[k][2]) + '</span></button>'; }).join('') + '</div></div>';
    var gear = '<div class="sr-gear">' + Object.keys(g.gear || {}).map(function (k) { var x = g.gear[k]; return '<button class="sr-slot' + (x.grade ? ' g' + x.grade : '') + '" data-act="sr-forge" data-slot="' + k + '"><span class="small muted">' + esc(x.slot) + '</span><b>' + (x.grade ? esc(x.name) : 'Empty') + '</b><span class="small">' + (x.grade ? '+' + x.bonus + '% ' + esc(x.stat) : 'Tap to get one') + '</span></button>'; }).join('') + '</div>'
      + '<p class="small muted">⚗ ' + (g.elixirs || 0) + ' elixirs (for upgrades) · Your English: ' + ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'][g.english ? g.english.level : 1] + ', ' + (g.english ? g.english.mastered : 0) + ' points mastered — better English unlocks better gear.</p>';
    var skills = '<div class="sr-skills"><b class="small">Combat skills</b> <span class="small muted">(up to 3 · unlocked by mastering English points)</span><div class="sr-sk">' + (g.skills || []).map(function (k) { return '<button class="sr-skb' + (k.on ? ' on' : '') + (k.unlocked ? '' : ' locked') + '" data-act="sr-skill" data-id="' + k.id + '" title="' + esc(k.text) + '"' + (k.unlocked ? '' : ' disabled') + '><b>' + esc(k.name) + '</b><span>' + (k.unlocked ? esc(k.text) : '🔒 Master ' + k.need + ' ' + ({ grammar: 'grammar', pron: 'pronunciation', tone: 'tone' }[k.track]) + ' point' + (k.need > 1 ? 's' : '')) + '</span></button>'; }).join('') + '</div></div>';
    el.innerHTML = '<section class="card raids"><div class="card-h"><h3>🐫 Silk Road</h3><span class="rd-coins">' + r.coins + ' 🪙</span></div>'
      + who + (job ? gear + skills : '')
      + '<p class="small muted">Your first ' + r.safe + ' coins are always safe' + (safeLeft ? '; ' + safeLeft + ' can be stolen.' : '.') + '</p>'
      + '<div class="rd-def"><div class="row-between"><b>Your defence ' + r.defence + '</b>' + shield + '</div><div class="bar"><i style="width:' + r.defence + '%;background:var(--fg)"></i></div>'
      + '<p class="small muted">Raise it with English today: every step of today\'s plan adds 10, your streak adds armour, and a perfect day makes you raid-proof until midnight.' + '</p></div>'
      + (r.peace ? '<p class="note">🕊 Peace mode is on: you can\'t raid or be raided.</p>'
        : !r.canBattle ? '<p class="note">Raids open soon.</p>'
        : !job ? ''
        : job === 'thief' ? '<div class="rd-acts"><button class="btn primary" data-act="rd-find"' + (r.raidsLeft ? '' : ' disabled') + '>🗡 Raid someone</button><span class="small muted">' + r.raidsLeft + ' raid' + (r.raidsLeft === 1 ? '' : 's') + ' left today</span></div>'
        : job === 'hunter' ? '<div class="rd-acts"><button class="btn primary" data-act="sr-wanted"' + (r.raidsLeft ? '' : ' disabled') + '>🏹 Wanted board</button><span class="small muted">' + r.raidsLeft + ' hunt' + (r.raidsLeft === 1 ? '' : 's') + ' left today</span></div>'
        : '<p class="note">🐪 Traders don\'t fight: you earn 25% more coins from learning. Keep your defence high!</p>'
          + (r.revenge.length ? '<div class="rd-rev"><span class="small">Revenge (free):</span>' + r.revenge.map(function (p) { return '<button class="btn sm-btn" data-act="rd-start" data-id="' + p.id + '">' + avatar(p, 22) + ' ' + esc(p.name.split(' ')[0]) + '</button>'; }).join('') + '</div>' : ''))
      + '<div class="rd-shop"><span class="small muted">Shop:</span>' + Object.keys(r.shop).map(function (k) { return '<button class="btn ghost sm-btn" data-act="rd-buy" data-item="' + k + '"' + (r.coins < r.shop[k][0] ? ' disabled' : '') + '>' + (k === 'shield' ? '🛡 ' : '❄ ') + esc(r.shop[k][1]) + ' · ' + r.shop[k][0] + ' 🪙</button>'; }).join('') + '</div>'
      + (log ? '<ul class="rd-logs">' + log + '</ul>' : '')
      + (r.clanWar.length ? '<div class="rd-war"><b class="small">Clan war this week</b><ol>' + r.clanWar.map(function (c) { return '<li>' + esc(c.emoji) + ' ' + esc(c.name) + ' <b>' + c.loot + ' 🪙</b></li>'; }).join('') + '</ol></div>' : '')
      + '<label class="small rd-peace"><input type="checkbox" data-act="rd-peace"' + (r.peace ? ' checked' : '') + '> Peace mode (no raids for me)</label></section>';
  }
  function raidFind(btn) {
    busy(btn, true, 'Looking…');
    api('/raids/find', { method: 'POST' }).then(function (j) {
      busy(btn, false);
      openModal(mHead('Choose your opponent', 'Students from other clans, at about your level') + (j.opponents.length ? '<ul class="pick-list">' + j.opponents.map(function (p) {
        return '<li><button class="pick" data-act="rd-start" data-id="' + p.id + '">' + avatar(p, 36) + '<span><b>' + esc(p.name) + '</b><br><small>' + esc(p.clan || '') + ' · defence ' + p.defence + ' · up to ' + p.loot + ' 🪙</small></span><em>⚔</em></button></li>';
      }).join('') + '</ul><p class="small muted">To win, your attack (20 per right answer) must beat their defence.</p>' : '<p class="muted">Nobody can be raided right now — everyone is protected. Try later!</p>'), 'narrow');
    }, function (x) { busy(btn, false); toast(x.message, 'bad'); });
  }
  function srForge(slot) {
    var g = RD.rpg, x = g.gear[slot], items = g.shop.filter(function (i) { return i.slot === slot; });
    openModal(mHead('🔨 Forge · ' + x.slot, 'Better grades need better English: your level and mastered points') + '<div class="stack" dir="ltr">'
      + (x.grade ? '<div class="card row-between"><div><b>' + esc(x.name) + '</b><br><span class="small muted">+' + x.bonus + '% ' + esc(x.stat) + '</span></div>' + (x.next ? '<button class="btn sm-btn" data-act="sr-up" data-slot="' + slot + '">Upgrade to +' + x.next + ' · ' + x.next + ' ⚗</button>' : '<span class="pill">Max +5</span>') + '</div>' : '')
      + '<ul class="sr-shop">' + items.map(function (i) {
        var have = x.grade >= i.grade;
        return '<li class="sr-it g' + i.grade + (i.ok ? '' : ' locked') + '"><div><b>' + esc(i.name) + '</b><span class="small muted">+' + i.bonus + '% ' + esc(x.stat) + (i.ok ? '' : ' · 🔒 needs ' + i.need.level + (i.need.mastered ? ' and ' + i.need.mastered + ' points mastered' : '')) + '</span></div>'
          + (have ? '<span class="pill">Owned</span>' : '<button class="btn sm-btn" data-act="sr-buy" data-slot="' + slot + '" data-grade="' + i.grade + '"' + (i.ok && RD.coins >= i.price ? '' : ' disabled') + '>' + i.price + ' 🪙</button>') + '</li>';
      }).join('') + '</ul></div>', 'narrow');
  }
  function srWanted(btn) {
    busy(btn, true, 'Looking…');
    api('/raids/wanted').then(function (j) {
      busy(btn, false);
      openModal(mHead('🏹 Wanted board', 'Thieves who stole in the last 24 hours') + (j.wanted.length ? '<ul class="pick-list">' + j.wanted.map(function (w) {
        return '<li><button class="pick" data-act="sr-hunt" data-ev="' + w.event + '">' + avatar(w.thief, 36) + '<span><b>' + esc(w.thief.name) + '</b><br><small>stole ' + w.loot + ' 🪙 from ' + esc(w.victim.name) + ' · defence ' + w.thief.defence + '</small></span><em>🏹</em></button></li>';
      }).join('') + '</ul><p class="small muted">Win and the coins go back: half to the victim, half to you as a bounty.</p>' : '<p class="muted">No wanted thieves right now. The streets are safe!</p>'), 'narrow');
    }, function (x) { busy(btn, false); toast(x.message, 'bad'); });
  }
  function srPost(path, body) { return api(path, { method: 'POST', body: body }).then(function (j) { RD = j; paintRaids(); return j; }, function (x) { toast(x.message, 'bad'); throw x; }); }

  /** The battle: 5 questions, 20 seconds each. */
  function raidBattle(target, hunt) {
    api('/raids/start', { method: 'POST', body: hunt ? { hunt: hunt } : { target: target } }).then(function (b) {
      var i = 0, ans = [], timer = null;
      function q() {
        clearInterval(timer);
        if (i >= b.questions.length) return finish();
        var it = b.questions[i], left = b.seconds;
        openModal('<div class="battle" dir="ltr"><div class="row-between"><b>' + (b.hunt ? '🏹 Hunting ' : '⚔ vs ') + esc(b.defender.name) + '</b><span class="small muted">' + (i + 1) + ' / ' + b.questions.length + '</span></div>'
          + '<div class="bar bt-time"><i style="width:100%"></i></div><p class="bt-q">' + esc(it.q).replace(/_{2,}/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>') + '</p>'
          + '<div class="bt-opts">' + it.options.map(function (o, k) { return '<button class="btn ghost" data-bt="' + k + '">' + esc(o) + '</button>'; }).join('') + '</div></div>', 'narrow');
        $$('[data-bt]').forEach(function (x) { x.onclick = function () { ans.push(+x.dataset.bt); i++; q(); }; });
        timer = setInterval(function () { left -= 0.25; var bar = $('.bt-time i'); if (bar) bar.style.width = Math.max(0, left / b.seconds * 100) + '%'; if (left <= 0) { ans.push(-1); i++; q(); } }, 250);
      }
      function finish() {
        clearInterval(timer);
        openModal('<div class="battle" dir="ltr"><p class="muted">Fighting…</p></div>', 'narrow');
        api('/raids/answer', { method: 'POST', body: { battle: b.battle, answers: ans } }).then(function (r) {
          RD = r; paintRaids();
          openModal(mHead(r.won ? (r.hunt ? '🏹 Thief caught!' : '🏆 You won!') : (r.hunt ? '💨 The thief got away' : '🛡 Their defence held'), r.right + ' of 5 right · attack ' + r.attack + ' vs defence ' + r.defence)
            + '<div class="stack" dir="ltr">' + (r.won ? '<p class="rd-big">+' + r.loot + ' 🪙 ' + (r.hunt ? 'bounty' : 'loot') + '</p>' + (r.hunt ? '<p class="small">' + r.returned + ' 🪙 went back to the victim.</p>' : '') : '<p class="muted">Get more answers right to beat higher defences.</p>') + '<p class="small muted">+' + r.bonus + ' 🪙 for fighting in English</p>'
            + '<ul class="bt-review">' + r.review.map(function (x) { return '<li class="' + (x.ok ? 'ok' : 'no') + '">' + (x.ok ? '✓ ' : '✗ ') + esc(x.q) + (x.ok ? '' : ' → <b>' + esc(x.right) + '</b>') + '</li>'; }).join('') + '</ul>'
            + '<button class="btn primary wide" data-act="close">Done</button></div>', 'narrow');
        }, function (x) { closeModal(); toast(x.message, 'bad'); });
      }
      q();
    }, function (x) { toast(x.message, 'bad'); });
  }

  /* ------------------------------------------------------------ the Silk Road world (map, quests, party) */
  var W = { tab: 'map', data: null, party: null, live: null, liveT: null };
  /** The app's stage (1–5). Stage 3: map, monsters, quests. Stage 4: jobs, gear, raids. Stage 5: parties. */
  function stage() { return EMB ? (+window.SawaAppStage || 5) : 5; }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var JOB_IC = { thief: '🗡', hunter: '🏹', trader: '🐪' };
  function loadWorldCard() {
    api('/world').then(function (j) { W.data = j; paintWorldCard(); }, function () { var el = $('#world-card'); if (el) el.innerHTML = ''; });
  }
  function paintWorldCard() {
    var el = $('#world-card'), w = W.data; if (!el || !w) return;
    var ready = w.daily.filter(function (q) { return q.done && !q.claimed; }).length + w.story.filter(function (s) { return s.state === 'claim'; }).length;
    el.innerHTML = '<section class="card wd-card" dir="ltr"><div class="row-between"><div><h3>🗺 The Silk Road</h3><p class="small muted">You are in ' + w.town.icon + ' <b>' + esc(w.town.name) + '</b> (' + w.town.level + ') · ⚡ ' + w.stamina.left + ' fights left today' + (w.words ? ' · ' + w.words + ' of your words are hiding in monsters' : '') + (ready ? ' · <b>' + ready + ' reward' + (ready > 1 ? 's' : '') + ' to claim</b>' : '') + '</p></div>'
      + '<button class="btn primary" data-act="w-open">Enter the world</button></div>'
      + '<div class="wd-mini">' + w.towns.map(function (t) { return '<span class="wd-dot' + (t.id === w.at ? ' here' : t.open ? ' open' : '') + '" title="' + esc(t.name) + '">' + (t.open ? t.icon : '🔒') + '</span>'; }).join('<i></i>') + '</div></section>';
  }
  function openWorld(tab) {
    W.tab = tab || W.tab || 'map'; S.view = 'world';
    emit({ view: 'community' }); // the world lives in the app's Community tab
    $('#app').innerHTML = '<div id="world" dir="ltr"><div class="card"><p class="muted small">Loading the Silk Road…</p></div></div>';
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    Promise.all([api('/world'), api('/party')]).then(function (r) { W.data = r[0]; W.party = r[1]; paintWorld(); if (!lsGet('sawaWorldTour')) worldTour(0); }, function (x) { $('#world').innerHTML = '<div class="card"><p class="err">' + esc(x.message) + '</p><button class="btn" data-act="w-back">Back</button></div>'; });
  }
  function bar(v, max, color) { return '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, v / Math.max(1, max) * 100)) + '%;background:' + (color || 'var(--fg)') + '"></i></div>'; }
  function paintWorld() {
    var el = $('#world'), w = W.data; if (!el || !w || gameRunning()) return;
    var tabs = [['map', '🗺 Map'], ['quests', '📜 Quests'], ['party', '⚔ Party']].map(function (t) { return '<button data-act="w-tab" data-tab="' + t[0] + '" aria-pressed="' + (W.tab === t[0]) + '">' + t[1] + '</button>'; }).join('');
    el.innerHTML = '<div class="wd-top"><button class="btn ghost sm-btn" data-act="w-back">← Community</button><span class="pill">🪙 ' + w.coins + '</span><span class="pill">⚗ ' + w.elixirs + '</span><span class="pill" title="Fights left today. Every step of today\'s plan gives one more.">⚡ ' + w.stamina.left + '/' + w.stamina.max + '</span><button class="icon-btn wd-help" data-act="w-help" aria-label="How the Silk Road works">?</button></div>'
      + '<div class="seg wd-tabs" role="tablist">' + tabs + '</div><div id="wd-body">' + (W.tab === 'quests' ? worldQuests() : W.tab === 'party' ? worldParty() : worldMap()) + '</div>';
  }
  function worldMap() {
    var w = W.data, t = w.town, b = t.boss;
    var route = '<div class="wd-route">' + w.towns.map(function (x) {
      return '<button class="wd-town' + (x.id === w.at ? ' here' : '') + (x.open ? '' : ' locked') + '" data-act="w-travel" data-town="' + x.id + '"' + (x.open ? '' : ' disabled') + '><span class="wd-ic">' + (x.open ? x.icon : '🔒') + '</span><b>' + esc(x.name) + '</b><span class="small">' + x.level + (x.beaten ? ' ✓' : '') + '</span><span class="small muted">' + x.travelers + ' 👤</span>' + (x.id === w.at ? '<em>You</em>' : '') + '</button>';
    }).join('') + '</div>';
    var people = t.people.length ? '<div class="wd-people">' + t.people.map(function (p) { return '<span title="' + esc(p.name) + '">' + avatar(p, 30) + (p.job ? '<i>' + JOB_IC[p.job] + '</i>' : '') + '</span>'; }).join('') + '</div>' : '<p class="small muted">Nobody else is here yet.</p>';
    var mons = '<div class="wd-mons">' + t.monsters.map(function (m, i) {
      return '<div class="wd-mon"><span class="wd-big">' + m.icon + '</span><b>' + esc(m.name) + '</b><span class="small muted">❤ ' + m.hp + ' HP</span><button class="btn sm-btn" data-act="w-fight" data-m="' + i + '"' + (w.stamina.left && w.ready ? '' : ' disabled') + '>Fight ⚡1</button></div>';
    }).join('') + '</div>';
    var boss = '<div class="wd-boss' + (b.beaten ? ' beaten' : '') + '"><span class="wd-big">' + b.icon + '</span><div><b>Boss: ' + esc(b.name) + '</b><p class="small muted">❤ ' + b.hp + ' HP · 6 questions at ' + t.level + ' level · win with about 5 right' + (w.weapon ? ' (your weapon adds ' + w.weapon + '%)' : '') + '</p></div>'
      + (b.beaten ? '<span class="pill">✓ Defeated</span>' : b.ready ? '<button class="btn primary sm-btn" data-act="w-boss"' + (b.tries && w.ready ? '' : ' disabled') + '>Fight · ' + b.tries + ' tries left</button>' : '<span class="small muted">🔒 Finish the story quests first</span>') + '</div>';
    return route
      + '<section class="card"><div class="row-between"><h3>' + t.icon + ' ' + esc(t.name) + ' <span class="small muted">' + t.level + '</span></h3><button class="btn ghost sm-btn" data-act="w-room" data-id="' + t.room + '">💬 Town chat</button></div>' + people + '</section>'
      + worldBossCard()
      + '<section class="card"><h3>Monsters</h3><p class="small muted">Monsters attack with <b>your own English</b>: words from your flashcards and the videos and texts you saved, and the skill points you\'re weakest at. Win if your attack (20 per right answer + gear) reaches their HP. Words you miss come back in your review cards.' + (w.ready ? '' : ' Battles open soon.') + '</p>' + mons + boss + '</section>'
      + (w.job || stage() < 4 ? '' : '<p class="note">Tip: choose a job (Thief, Hunter or Trader) in the Silk Road card in Community, then buy a weapon at the forge to hit harder.</p>');
  }
  function worldBossCard() {
    var b = S.data.boss; if (!b) return '';
    var left = Math.max(0, b.hp - b.damage), days = Math.max(0, Math.round((new Date(b.ends + 'T23:59:59') - Date.now()) / 86400000));
    return '<section class="card"><h3>🌍 World boss: ' + esc(bossName(b.name)) + '</h3>'
      + (b.defeated ? '<p class="note">🏆 Defeated this week! Everyone who studied got +9 🪙. A new one comes ' + (days ? 'in ' + days + ' day' + (days > 1 ? 's' : '') : 'tomorrow') + '.</p>'
        : bar(left, b.hp, 'var(--red)') + '<p class="small muted">' + left + ' / ' + b.hp + ' HP · ' + b.fighters + (b.fighters === 1 ? ' student' : ' students') + ' fighting · every minute anyone studies this week is a hit. Ends ' + (days ? 'in ' + days + ' day' + (days > 1 ? 's' : '') : 'today') + '.</p>')
      + '</section>';
  }
  function sherifQuest() {
    var q = S.data.quest; if (!q) return '';
    return '<section class="card wd-sq"><h3>⭐ Today\'s quest from Sherif</h3><p dir="auto">' + esc(q.text) + '</p>'
      + (q.done ? '<span class="pill">✓ Done</span>' : '<div class="row"><input id="w-qnote" maxlength="200" placeholder="How did you do it? (optional)" dir="auto"><button class="btn primary" data-act="w-squest">Done · +' + q.sp + ' 🪙</button></div>') + '</section>';
  }
  var HELP = [
    ['🗺', 'The map', 'Six towns from Chang\'an to Constantinople, one for each English level (A1 → C2). You start in the town of your level test. Beat a town\'s boss to open the road to the next one — or retake the level test.'],
    ['⚔', 'Monsters', 'Every fight is 5 English questions: words from <b>your</b> flashcards in the sentence where you found them, your own past mistakes, and the skill points you\'re weakest at. 20 attack per right answer (plus your weapon). Words you miss come back in today\'s review cards.'],
    ['⭐', 'Level, health and mana', 'Your level goes up with XP — from cards, writing, chat and fights. Every level gives more health and mana, coins, new gear and titles (and a glowing aura from level 10). ❤ Health goes down when a monster hits you after a wrong answer; it comes back by itself, faster when you review cards at the inn. 💧 Mana comes only from studying today.'],
    ['✨', 'Battle skills', 'Focus removes a wrong answer, Insight gives a hint, Power strike doubles your next hit, Second breath heals you. They cost mana. Fast answers hit harder, and 3 right answers in a row start a combo.'],
    ['🏆', 'Rankings', 'See who has the highest level, who earned the most XP this week, and the best duel fighters (arena ranks from Bronze to Legend).'],
    ['⚡', 'Fights a day', '5 fights a day, plus one for every step of today\'s plan and one for a perfect day. Studying gives you more game.'],
    ['📜', 'Quests', 'Each town has a story: monsters → a learning task (cards, practice, chat, video quizzes…) → the boss. Daily and weekly quests pay coins and elixirs. Tap <b>Go</b> to jump to the right place in the app.'],
    ['🚶', 'Walking the world', 'Walk with the arrow keys (or drag your thumb on a phone). Press E or tap the red button to talk to people, read the notice board and leave notes. Monsters roam the road east of every town; the boss waits in its lair.'],
    ['👥', 'Other travellers', 'Students who are online walk around with you. Students who were here earlier today stay as echoes where they left — you can still tap them: wave, invite them, or duel their shadow, which fights as well as they really do. They get a notification later.'],
    ['✍', 'Notes', 'Leave a short English note on the map for the next traveller (3 a day). When someone finds it helpful, you get 2 coins.'],
    ['🌍', 'World boss', 'One boss for the whole community each week. Every minute anyone studies hits it.'],
    ['🪙', 'Coins and ⚗ elixirs', 'Coins come from learning (plan steps, quizzes, quests, fights). Spend them on gear, shields and helping classmates. Elixirs come from mastering skill points, perfect days and big wins; they upgrade your gear.'],
    ['🗡', 'Jobs, gear and raids (stage 4)', 'Thief, Hunter or Trader. Gear grades follow your English level: Bronze = A1 … Jade = C2. Thieves raid, hunters catch thieves, traders earn more from learning. Your first 20 coins are always safe, and peace mode turns raids off.'],
    ['👥', 'Parties (stage 5)', '2–4 friends: party chat, a 48-hour party boss, a weekly team goal and live battles where everyone answers the same question at the same time.'],
    ['📈', 'What never changes', 'The game never takes away learning progress: your streak, XP, cards and skill tree are safe whatever happens in a fight.']
  ];
  function worldHelp() {
    openModal(mHead('How the Silk Road works', 'Learning is the way to get stronger') + '<div class="stack wd-helpl" dir="ltr">' + HELP.map(function (h) { return '<div><b>' + h[0] + ' ' + h[1] + '</b><p class="small">' + h[2] + '</p></div>'; }).join('') + '<button class="btn ghost" data-act="w-tour">Show me the tour again</button></div>', 'narrow');
  }
  var TOUR = [
    ['🗺 Welcome to the Silk Road!', 'A journey from Chang\'an to Constantinople — one town for each English level. You start in the town of your level.'],
    ['⚔ Monsters use your English', 'They attack with the words you saved from videos and articles, your own mistakes and your weakest grammar. Every fight is a quick review.'],
    ['📜 Quests send you to learn', 'Review cards, practise, chat and watch — then beat the town\'s boss to travel on. Tap “Go” on a quest to jump there.'],
    ['⚡ Study = more game', 'You get 5 fights a day, plus one for each step of today\'s plan. Jobs and gear open at stage 4, parties at stage 5. Tap ? any time for help.']
  ];
  function worldTour(i) {
    lsSet('sawaWorldTour', '1');
    if (i >= TOUR.length) { closeModal(); return; }
    openModal('<div class="stack wd-tour" dir="ltr"><span class="small muted">' + (i + 1) + ' / ' + TOUR.length + '</span><h2>' + TOUR[i][0] + '</h2><p>' + TOUR[i][1] + '</p><div class="row-between"><button class="btn ghost" data-act="close">Skip</button><button class="btn primary" data-act="w-tour" data-i="' + (i + 1) + '">' + (i + 1 < TOUR.length ? 'Next' : 'Let\'s go!') + '</button></div></div>', 'narrow');
  }
  function questRow(q) {
    return '<li class="wd-q' + (q.claimed ? ' claimed' : '') + '"><div><b>' + esc(q.text) + '</b>' + bar(q.count, q.n) + '<span class="small muted">' + q.count + ' / ' + q.n + ' · ' + q.reward + '</span></div>'
      + (q.claimed ? '<span class="pill">✓</span>' : '<button class="btn sm-btn" data-act="w-claim" data-q="' + q.key + '"' + (q.done ? '' : ' disabled') + '>Claim</button>') + '</li>';
  }
  function storyRow(s) {
    var go = s.state === 'now' && s.go ? '<button class="btn sm-btn" data-act="w-go" data-go="' + s.go + '">Go</button>' : '';
    var prog = s.state === 'now' || s.state === 'claim' ? bar(s.count, s.n) + '<span class="small muted">' + s.count + ' / ' + s.n + ' · ' + s.reward + '</span>' : '<span class="small muted">' + s.reward + '</span>';
    var right = s.state === 'done' ? '<span class="pill">✓</span>' : s.state === 'claim' ? '<button class="btn primary sm-btn" data-act="w-claim" data-q="story">Claim</button>' : go;
    return '<li class="' + s.state + '"><div><b>' + esc(s.text) + '</b>' + prog + '</div>' + right + '</li>';
  }
  function worldQuests() {
    var w = W.data;
    return sherifQuest() + '<section class="card"><h3>' + w.town.icon + ' The story of ' + esc(w.town.name) + '</h3><p class="small muted">Quests count while you are in this town. Beat the boss to open the road to the next one.</p><ol class="wd-story">' + w.story.map(storyRow).join('') + '</ol></section>'
      + '<section class="card"><h3>Today</h3><ul class="wd-qs">' + w.daily.map(questRow).join('') + '</ul><p class="small muted">' + (w.dailyAll ? '✓ All three done — you got the bonus elixir!' : 'Claim all three for a bonus ⚗ elixir.') + '</p></section>'
      + '<section class="card"><h3>This week</h3><ul class="wd-qs">' + w.weekly.map(questRow).join('') + '</ul></section>'
      + (w.titles.length ? '<section class="card"><h3>Your titles</h3><div class="pills">' + w.titles.map(function (t) { return '<span class="pill">🏅 ' + esc(t) + '</span>'; }).join('') + '</div></section>' : '');
  }
  function worldParty() {
    var P = W.party || {}, p = P.party, me = S.data.me.id;
    if (stage() < 5) return '<section class="card"><h3>⚔ Parties</h3><p>🔒 Parties open at stage 5.</p><p class="small muted">Then you can play with 2–4 friends: a party chat, a big party boss you all hit for 48 hours, a weekly team goal and live battles on the words you are all learning. For now: fight monsters, finish quests and keep your daily plan going.</p></section>';
    if (!p) {
      return (P.invites && P.invites.length ? '<section class="card"><h3>Invitations</h3><ul class="wd-qs">' + P.invites.map(function (x) { return '<li class="wd-q"><div><b>' + esc(x.name) + '</b><div class="wd-people">' + x.members.map(function (m) { return avatar(m, 26); }).join('') + '</div></div><span><button class="btn primary sm-btn" data-act="w-join" data-id="' + x.id + '">Join</button> <button class="btn ghost sm-btn" data-act="w-decline" data-id="' + x.id + '">No thanks</button></span></li>'; }).join('') + '</ul></section>' : '')
        + '<section class="card"><h3>⚔ Start a party</h3><p class="small muted">Play with 2–4 friends: a private party chat, a big party boss you all hit for 48 hours, a weekly team goal, and live battles where everyone answers the same question at the same moment.</p>'
        + '<div class="row"><input id="w-pname" maxlength="30" placeholder="Party name (optional)" dir="auto"><button class="btn primary" data-act="w-create">Create</button></div></section>';
    }
    var lead = p.leader === me, b = p.boss, wk = p.weekly, L = p.live;
    var members = '<ul class="wd-members">' + p.members.map(function (m) {
      return '<li>' + avatar(m, 36) + '<div><b>' + esc(m.name) + (m.leader ? ' 👑' : '') + '</b><span class="small muted">' + (m.job ? JOB_IC[m.job] + ' ' : '') + esc(m.town) + (m.weapon ? ' · ⚔ +' + m.weapon + '%' : '') + (m.title ? ' · ' + esc(m.title) : '') + '</span></div>'
        + (lead && m.id !== me ? '<button class="btn ghost sm-btn" data-act="w-kick" data-id="' + m.id + '">Remove</button>' : '') + '</li>';
    }).join('') + (p.invited.length ? '<li class="small muted">Invited: ' + p.invited.map(function (x) { return esc(x.name); }).join(', ') + '</li>' : '') + '</ul>';
    var boss;
    if (!b || b.down || b.failed) {
      boss = (b ? '<p class="note">' + (b.down ? '🏆 Your party defeated the ' + esc(b.name) + '! Everyone who hit it got 40 🪙 + 2 ⚗.' : '💨 The ' + esc(b.name) + ' got away.') + '</p>' : '') + '<button class="btn primary" data-act="w-pboss">Summon a party boss (48 hours)</button>';
    } else {
      boss = '<div class="wd-boss"><span class="wd-big">' + b.icon + '</span><div style="flex:1"><b>' + esc(b.name) + '</b>' + bar(b.hp - b.damage, b.hp, 'var(--red)') + '<span class="small muted">' + (b.hp - b.damage) + ' / ' + b.hp + ' HP · ends ' + new Date(b.ends * 1000).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '</span>'
        + '<p class="small">' + b.top.map(function (x) { return esc(x.name.split(' ')[0]) + ' ' + x.damage; }).join(' · ') + '</p></div><button class="btn primary sm-btn" data-act="w-hit"' + (b.hitsLeft ? '' : ' disabled') + '>Hit it · ' + b.hitsLeft + ' left</button></div>';
    }
    var live = L && L.id && L.phase !== 'end'
      ? '<div class="row-between"><span>🔴 <b>' + esc(L.by) + '</b> started a live battle!</span><button class="btn primary sm-btn" data-act="w-live">' + (L.in ? 'Open' : 'Join') + '</button></div>'
      : '<div class="row-between"><span class="small muted">Everyone online? Fight together in real time: 8 questions from the words your party is learning, 15 seconds each. ' + (L ? (L.left || 0) : 0) + ' left today.</span><button class="btn sm-btn" data-act="w-live-start"' + (L && L.left > 0 ? '' : ' disabled') + '>Start live battle</button></div>';
    return '<section class="card"><div class="row-between"><h3>⚔ ' + esc(p.name) + '</h3><span><button class="btn ghost sm-btn" data-act="w-room" data-id="' + p.room + '">💬 Party chat</button>' + (p.members.length + p.invited.length < P.max ? ' <button class="btn sm-btn" data-act="w-invite">+ Invite</button>' : '') + '</span></div>' + members + '</section>'
      + '<section class="card"><h3>🔴 Live battle</h3>' + live + '</section>'
      + '<section class="card"><h3>Party boss</h3>' + boss + '</section>'
      + '<section class="card"><h3>Weekly goal</h3><p class="small">Answer ' + wk.goal + ' battle questions correctly together this week.</p>' + bar(wk.count, wk.goal) + '<div class="row-between"><span class="small muted">' + wk.count + ' / ' + wk.goal + ' · ' + wk.reward + ' each</span>' + (wk.claimed ? '<span class="pill">✓ Claimed</span>' : '<button class="btn sm-btn" data-act="w-weekly"' + (wk.count >= wk.goal ? '' : ' disabled') + '>Claim</button>') + '</div></section>'
      + '<button class="btn ghost" data-act="w-leave">Leave party</button>';
  }
  function wPost(path, body, then) {
    return api(path, { method: 'POST', body: body || {} }).then(function (j) {
      if (j.party !== undefined) W.party = j;
      if (j.world) W.data = j.world; else if (j.towns) W.data = j;
      paintWorld(); repaintPanel(); if (then) then(j); return j;
    }, function (x) { toast(x.message, 'bad'); });
  }
  function worldInvite() {
    api('/party/candidates').then(function (j) {
      openModal(mHead('Invite to your party', 'Your clan first') + (j.people.length ? '<ul class="pick-list">' + j.people.map(function (p) {
        return '<li><button class="pick" data-act="w-inv" data-id="' + p.id + '">' + avatar(p, 34) + '<span><b>' + esc(p.name) + '</b><br><small>' + (p.mate ? 'Your clan · ' : '') + esc(p.town) + '</small></span><em>+</em></button></li>';
      }).join('') + '</ul>' : '<p class="muted">Everyone is in a party already.</p>'), 'narrow');
    }, function (x) { toast(x.message, 'bad'); });
  }
  function qHtml(it) {
    return (it.point ? '<span class="pill">' + esc(it.point) + '</span>' : '') + '<p class="bt-q">' + esc(it.q).replace(/_{2,}/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>') + '</p>' + (it.src ? '<p class="small muted">From: ' + esc(it.src) + '</p>' : '');
  }
  /* ------------------------------------------------------------ the walkable game (assets/game.js) */
  function gameRunning() { return !!(window.SawaGame && window.SawaGame.running()); }
  function startGame() {
    var go = function () {
      api('/world').then(function (w) {
        W.data = w; S.view = 'world';
        var mount = $('#modal').parentNode;
        window.SawaGame.start(mount, {
          api: api, me: function () { return S.data.me; }, stage: stage,
          world: function () { return W.data; }, setWorld: function (x) { if (x && x.towns) W.data = x; },
          avatar: function () { return W.data.avatar; }, setLook: function (l) { W.data.avatar.look = l; },
          panel: worldPanel, go: function (v) { window.SawaGame.stop(false); S.view = 'community'; renderView(); emit({ go: v }); },
          room: function (id) { window.SawaGame.stop(false); S.view = 'chat'; C.pending = +id; renderView(); loadRooms(); },
          raid: function (id) { raidBattle(id); }, wanted: function () { srWanted(null); },
          refreshParty: function () { api('/party').then(function (j) { W.party = j; }, function () {}); },
          refreshWorld: function () { return api('/world').then(function (x) { W.data = x; return x; }); },
          lens: window.SawaLens || null, needsTr: needsTranslation, isAdmin: function () { return !!C.admin || !!S.data.isAdmin; },
          log: function () { openLogActivity(); },
          exit: function (mode) { S.view = 'community'; if (mode === 'list') openWorld('map'); else renderView(); }
        });
      }, function (x) { toast(x.message, 'bad'); });
    };
    if (window.SawaGame) return go();
    var sc = document.createElement('script'); sc.src = cfg.game; sc.onload = go; sc.onerror = function () { toast('The game could not load. Opening the list view.', 'bad'); openWorld('map'); }; document.head.appendChild(sc);
  }
  /** Quests, party, forge and help as panels over the game. */
  function worldPanel(kind) {
    W.panel = kind;
    if (kind === 'help') return worldHelp();
    if (kind === 'quests') return openModal(mHead('📜 Quests', W.data.town.icon + ' ' + esc(W.data.town.name)) + '<div class="wd-panel" dir="ltr">' + worldQuests() + '</div>', 'narrow');
    if (kind === 'party') return api('/party').then(function (j) { W.party = j; openModal(mHead('⚔ Party', '') + '<div class="wd-panel" dir="ltr">' + worldParty() + '</div>', 'narrow'); }, function (x) { toast(x.message, 'bad'); });
    if (kind === 'forge') { openModal(mHead('🔨 Forge and job', 'Better English unlocks better gear') + '<div class="wd-panel" dir="ltr"><div id="raids"><p class="muted small">Loading…</p></div></div>', 'narrow'); loadRaids(); }
  }
  function repaintPanel() {
    if (gameRunning()) window.SawaGame.hud();
    if (W.panel && $('#modal .wd-panel') && W.panel !== 'forge' && W.panel !== 'help') worldPanel(W.panel);
  }

  /** A solo battle (monster, boss) or a hit on the party boss: same quiz as raids, then the result. */
  function worldBattle(path, body) {
    if (gameRunning() && window.SawaGame.battle(path, body)) { closeModal(); return; }
    api(path, { method: 'POST', body: body || {} }).then(function (b) {
      var i = 0, ans = [], timer = null, n = b.questions.length;
      function q() {
        clearInterval(timer);
        if (i >= n) return finish();
        var it = b.questions[i], left = b.seconds;
        openModal('<div class="battle" dir="ltr"><div class="row-between"><b>' + b.foe.icon + ' ' + esc(b.foe.name) + '</b><span class="small muted">❤ ' + b.foe.hp + ' · ' + (i + 1) + ' / ' + n + '</span></div>'
          + '<div class="bar bt-time"><i style="width:100%"></i></div>' + qHtml(it)
          + '<div class="bt-opts">' + it.options.map(function (o, k) { return '<button class="btn ghost" data-bt="' + k + '">' + esc(o) + '</button>'; }).join('') + '</div></div>', 'narrow');
        $$('[data-bt]').forEach(function (x) { x.onclick = function () { ans.push(+x.dataset.bt); i++; q(); }; });
        timer = setInterval(function () { left -= 0.25; var bb = $('.bt-time i'); if (!bb) { clearInterval(timer); return; } bb.style.width = Math.max(0, left / b.seconds * 100) + '%'; if (left <= 0) { ans.push(-1); i++; q(); } }, 250);
      }
      function finish() {
        clearInterval(timer);
        openModal('<div class="battle" dir="ltr"><p class="muted">Fighting…</p></div>', 'narrow');
        api('/world/answer', { method: 'POST', body: { battle: b.battle, answers: ans } }).then(function (r) {
          if (r.world) W.data = r.world;
          var pb = r.kind === 'pboss';
          var head = pb ? (r.won ? '🏆 The party boss is down!' : '💥 ' + r.damage + ' damage!') : r.won ? (r.foe.boss ? '🏆 ' + esc(r.foe.name) + ' defeated!' : '⚔ Victory!') : '💨 The ' + esc(r.foe.name) + ' was too strong';
          var gains = (r.coins ? '+' + r.coins + ' 🪙 ' : '') + (r.elixirs ? '+' + r.elixirs + ' ⚗' : '');
          var tip = pb && !r.won ? '<p class="small muted">Your party can keep hitting it until it falls.</p>' : !r.won ? '<p class="small muted">Practise the points below and try again — or upgrade your weapon.</p>' : '';
          var review = r.review.map(function (x) { return '<li class="' + (x.ok ? 'ok' : 'no') + '">' + (x.ok ? '✓ ' : '✗ ') + esc(x.q) + (x.ok ? '' : ' → <b>' + esc(x.right) + '</b>' + (x.why ? '<br><small>' + esc(x.why) + '</small>' : '')) + '</li>'; }).join('');
          openModal(mHead(head, r.right + ' of ' + r.total + ' right · attack ' + r.attack + (pb ? '' : ' vs ' + r.foe.hp + ' HP'))
            + '<div class="stack" dir="ltr">' + (gains ? '<p class="rd-big">' + gains + '</p>' : '') + (r.title ? '<p>🏅 New title: <b>' + esc(r.title) + '</b>' + (r.next ? '<br>The road to <b>' + esc(r.next) + '</b> is open!' : '') + '</p>' : '')
            + tip + (r.missedWords ? '<p class="small">📇 ' + r.missedWords + ' word' + (r.missedWords > 1 ? 's' : '') + ' you missed will come back in your review cards today.</p>' : '')
            + '<ul class="bt-review">' + review + '</ul><button class="btn primary wide" data-act="close">Done</button></div>', 'narrow');
          if (pb) api('/party').then(function (j) { W.party = j; paintWorld(); }, function () {}); else paintWorld();
        }, function (x) { closeModal(); toast(x.message, 'bad'); });
      }
      q();
    }, function (x) { toast(x.message, 'bad'); });
  }
  /** Live party battle: poll every 1.5 s while it's open. */
  function liveOpen(L) {
    if (L) W.live = L;
    clearTimeout(W.liveT); W.liveAt = Date.now(); paintLive();
    W.liveT = setTimeout(livePoll, 1500);
  }
  function livePoll() {
    if (!$('#modal .live-b')) return; // closed
    api('/party/live').then(function (j) {
      if (!$('#modal .live-b')) return; // closed while the request was on its way
      W.live = j.live; W.liveAt = Date.now(); paintLive();
      if (W.live && W.live.id && W.live.phase !== 'end') W.liveT = setTimeout(livePoll, document.hidden ? 4000 : 1500);
      else api('/party').then(function (p) { W.party = p; paintWorld(); }, function () {});
    }, function () { if ($('#modal .live-b')) W.liveT = setTimeout(livePoll, 3000); });
  }
  function paintLive() {
    var L = W.live; if (!L || !L.id) { closeModal(); return; }
    var drift = (Date.now() - W.liveAt) / 1000, foe = L.foe, body;
    var people = '<div class="lv-people">' + L.joined.map(function (m) { return '<span class="' + (m.answered ? 'did' : '') + '" title="' + esc(m.name) + '">' + avatar(m, 30) + '<i>' + (m.answered ? '✓' : '') + '</i><small>' + m.marks.map(function (k) { return k === 1 ? '🟩' : k === 0 ? '🟥' : '⬜'; }).join('') + '</small></span>'; }).join('') + '</div>';
    var hpbar = '<div class="row-between"><b>' + foe.icon + ' ' + esc(foe.name) + '</b><span class="small">' + (L.hp - L.damage) + ' / ' + L.hp + ' HP</span></div>' + bar(L.hp - L.damage, L.hp, 'var(--red)');
    if (L.phase === 'lobby') {
      var s = Math.max(0, Math.round(L.t0 - L.now - drift));
      body = '<p class="lv-big">Starting in ' + s + 's</p>' + (L.in ? '<p class="small muted">You\'re in! Get ready: 8 questions, 15 seconds each.</p>' : '<button class="btn primary wide" data-act="w-live-join">Join the battle</button>');
    } else if (L.phase === 'question') {
      var q = L.q, left = Math.max(0, L.left - drift);
      body = '<div class="bar bt-time"><i style="width:' + (left / L.secs * 100) + '%"></i></div><span class="small muted">Question ' + (L.i + 1) + ' / ' + L.n + '</span>' + qHtml(q)
        + (L.in ? '<div class="bt-opts">' + q.options.map(function (o, k) { return '<button class="btn ' + (q.mine === k ? 'primary' : 'ghost') + '" data-act="w-live-ans" data-i="' + L.i + '" data-k="' + k + '"' + (q.mine !== null ? ' disabled' : '') + '>' + esc(o) + '</button>'; }).join('') + '</div>' : '<p class="small muted">You\'re watching — join the next one in the lobby.</p>');
    } else {
      body = '<p class="lv-big">' + (L.won ? '🏆 Victory!' : '💨 It got away') + '</p><p>' + L.damage + ' damage of ' + L.hp + ' needed.' + (L.reward ? ' You got <b>' + L.reward + '</b>.' : '') + '</p><button class="btn primary wide" data-act="close">Done</button>';
    }
    var last = L.last && L.phase !== 'lobby' ? '<p class="small lv-last">Last: ' + esc(L.last.q) + ' → <b>' + esc(L.last.right) + '</b>' + (L.last.mine === true ? ' ✓ you got it' : L.last.mine === false ? ' ✗' : '') + '</p>' : '';
    openModal('<div class="battle live-b" dir="ltr"><div class="row-between"><span class="pill">🔴 Live</span><button class="icon-btn" data-act="close" aria-label="Close">' + ico('x') + '</button></div>' + hpbar + people + body + last + '</div>', 'narrow');
  }

  /** The app's Today tab: how today is going, the quest, and the buttons to log it. */
  function renderToday() {
    var d = S.data, s = d.stats, me = d.me;
    var goalPct = Math.min(100, Math.round(s.todayMinutes / s.goal * 100));
    var sub = s.todayMinutes >= s.goal ? 'وصلت لهدف النهارده. شغل عظيم.'
      : s.studiedToday ? 'فاضلك ' + hm(s.goal - s.todayMinutes) + ' وتوصل لهدف النهارده (' + hm(s.goal) + ').'
        : s.streak > 0 ? 'سجّل أي نشاط النهارده عشان الستريك بتاعك (' + s.streak + ' يوم) ميقعش.' : 'سجّل أول نشاط النهارده وابدأ الستريك.';
    $('#app').innerHTML = header()
      + '<section class="hello"><div class="who">' + avatar(me, 56) + '<div><h1>أهلًا يا ' + esc(me.firstName) + '</h1><p class="muted">' + esc(sub) + '</p></div></div>'
      + '<div class="ring" style="--p:' + goalPct + '" role="img" aria-label="النهارده ' + s.todayMinutes + ' من ' + s.goal + ' دقيقة"><span><b>' + s.todayMinutes + '</b>من ' + s.goal + ' د</span></div></section>'
      + statCards(s) + questCard();
  }

  function renderHome() {
    var d = S.data, s = d.stats, me = d.me;
    var goalPct = Math.min(100, Math.round(s.todayMinutes / s.goal * 100));
    var sub = s.todayMinutes >= s.goal ? 'وصلت لهدف النهارده. شغل عظيم.'
      : s.studiedToday ? 'فاضلك ' + hm(s.goal - s.todayMinutes) + ' وتوصل لهدف النهارده (' + hm(s.goal) + ').'
        : s.streak > 0 ? 'سجّل أي نشاط النهارده عشان الستريك بتاعك (' + s.streak + ' يوم) ميقعش.' : 'سجّل أول نشاط النهارده وابدأ الستريك.';
    $('#app').innerHTML = header()
      + '<section class="hello"><div class="who">' + avatar(me, 56) + '<div><h1>أهلًا يا ' + esc(me.firstName) + '</h1><p class="muted">' + esc(sub) + '</p>'
      + '<button class="btn ghost sm-btn" data-act="share">' + ico('mega') + ' شارك على Skool</button></div></div>'
      + '<div class="ring" style="--p:' + goalPct + '" role="img" aria-label="النهارده ' + s.todayMinutes + ' من ' + s.goal + ' دقيقة"><span><b>' + s.todayMinutes + '</b>من ' + s.goal + ' د</span></div></section>'
      + statCards(s)
      + '<div class="grid"><div class="col main">' + questCard() + xpCard() + lensCard() + characterCard() + bossCard() + trendCard() + '<div class="two">' + breakdownCard() + heatCard() + '</div>' + badgesCard() + recentCard() + '</div>'
      + '<div class="col side">' + boardCard() + feedCard() + '</div></div>';
    paintBoard(); paintFeed(); loadLens();
  }

  function questCard() {
    var q = S.data.quest; if (!q) return '';
    return '<section class="card quest' + (q.done ? ' done' : '') + '"><div class="quest-row"><span class="q-badge">' + ico('target') + '</span><div class="quest-main"><span class="eyebrow">مهمة النهارده من شريف</span><p class="quest-text" dir="auto">' + esc(q.text) + '</p></div>'
      + (q.done ? '<span class="pill">' + ico('check') + ' خلصتها</span>' : '<span class="pill sp">+' + q.sp + ' 🪙</span>') + '</div>'
      + (q.done ? '' : '<form class="quest-form" id="f-quest"><input id="q-note" maxlength="200" placeholder="عملتها إزاي؟ (اختياري)" dir="auto" aria-label="ملاحظة عن المهمة"><button class="btn primary" type="submit">خلصتها</button></form>') + '</section>';
  }

  function header() {
    var d = S.data, v = S.view || 'home', cu = S.chatUnread || 0;
    if (EMB) {
      if (v === 'chat') return '';
      return '<div class="emb-bar">'
        + '<button class="btn primary" data-act="log-day">' + ico('cal') + '<span>سجّل يومك</span></button>'
        + '<button class="btn" data-act="log-activity">' + ico('plus') + '<span>نشاط</span></button>'
        + '<button class="icon-btn bell" data-act="notifs" aria-label="الإشعارات' + (d.unread ? '، ' + d.unread + ' جديد' : '') + '">' + ico('bell') + (d.unread ? '<i>' + d.unread + '</i>' : '') + '</button>'
        + '<button class="icon-btn me-btn" data-act="settings" aria-label="إعداداتك">' + avatar(d.me, 34) + '</button></div>';
    }
    var nav = '<nav class="nav" aria-label="الأقسام">'
      + [['home', 'home', 'الرئيسية'], ['clan', 'shield', 'الكلان'], ['chat', 'chat', 'الشات']].map(function (t) {
        return '<button data-act="view" data-view="' + t[0] + '" aria-current="' + (v === t[0] ? 'page' : 'false') + '">' + ico(t[1]) + '<span>' + t[2] + '</span>' + (t[0] === 'chat' && cu ? '<i>' + cu + '</i>' : '') + '</button>';
      }).join('') + '</nav>';
    return '<header class="top">' + brand(false) + nav + '<div class="top-actions">'
      + '<button class="btn primary" data-act="log-day">' + ico('cal') + '<span class="hide-xs">سجّل يومك</span></button>'
      + '<button class="btn" data-act="log-activity">' + ico('plus') + '<span class="hide-sm">نشاط</span></button>'
      + '<button class="icon-btn bell" data-act="notifs" aria-label="الإشعارات' + (d.unread ? '، ' + d.unread + ' جديد' : '') + '">' + ico('bell') + (d.unread ? '<i>' + d.unread + '</i>' : '') + '</button>'
      + '<button class="icon-btn me-btn" data-act="settings" aria-label="إعداداتك">' + avatar(d.me, 34) + '</button>'
      + '</div></header>';
  }

  function statCards(s) {
    var shielded = s.shieldUntil && s.shieldUntil >= S.data.today;
    return '<section class="stats">'
      + '<div class="card stat"><span class="stat-ic">' + ico('flame') + '</span><b>' + s.streak + '</b><span>يوم ستريك</span><small>أحسن ستريك ' + s.bestStreak + (s.freezes ? ' · ' + ico('snow', 'tiny') + ' ' + s.freezes + ' تجميد' : '') + '</small></div>'
      + '<div class="card stat' + (low(s.health) ? ' alert' : '') + '"><span class="stat-ic">' + ico('heart') + '</span><b>' + s.health + '%</b><span>صحة العادة</span>'
      + '<div class="bar hp"><i style="width:' + s.health + '%;background:' + hpFill(s.health) + '"></i></div>'
      + '<small>' + (shielded ? ico('shield', 'tiny') + ' محمي لحد ' + fmtDay(s.shieldUntil) : s.health >= 70 ? 'قوية. كمّل كده.' : s.health >= 30 ? 'ذاكر النهارده عشان تعلى' : 'واطية. جلسة قصيرة هتفرق.') + '</small></div>'
      + '<div class="card stat"><span class="stat-ic">' + ico('clock') + '</span><b>' + hm(s.totalMinutes) + '</b><span>إجمالي المذاكرة</span><small>' + (s.totalCards ? s.totalCards.toLocaleString(LOC) + ' فلاش كارد' : '&nbsp;') + '</small></div>'
      + '<div class="card stat"><span class="stat-ic">' + ico('cal') + '</span><b>' + s.studyDays + '</b><span>يوم مذاكرة</span><small dir="ltr">Lv ' + s.level + ' · ' + esc(s.title) + '</small></div>'
      + '</section>';
  }

  function characterCard() {
    var d = S.data, s = d.stats, c = cls(d.me.class);
    var pct = s.next ? Math.round((s.studyDays - s.from) / (s.next - s.from) * 100) : 100;
    var skills = d.skills.map(function (k) {
      var st = k.locked ? 'locked' : k.readyOn ? 'cooling' : s.sp < k.cost ? 'poor' : 'ready';
      var tip = (k.descriptionAr || k.description) + (k.locked ? ' · بتتفتح في مستوى ' + k.unlock : k.readyOn ? ' · جاهزة ' + fmtDay(k.readyOn) : ' · بـ ' + k.cost + ' 🪙');
      return '<button class="skill ' + st + '" data-act="skill-info" data-skill="' + k.id + '" title="' + esc(tip) + '">'
        + '<span class="sk-ic">' + ico(k.locked ? 'lock' : (SKILL_IC[k.id] || 'spark')) + '</span><span class="sk-name" dir="ltr">' + esc(k.locked ? 'Lv ' + k.unlock : k.name) + '</span>'
        + (!k.locked ? '<span class="sk-cost">' + (k.readyOn ? ico('hourglass', 'tiny') : k.cost + ' 🪙') + '</span>' : '') + '</button>';
    }).join('');
    return '<section class="card char"><div class="char-top">'
      + '<div class="char-av">' + avatar(d.me, 72) + '<span class="class-badge" title="' + esc(c.ar) + '">' + ico(c.ic) + '</span></div>'
      + '<div class="char-info"><div class="char-line"><h2 dir="ltr">Level ' + s.level + '</h2><span class="tag" dir="ltr">' + esc(s.title) + '</span><button class="tag link" data-act="change-class">' + ico(c.ic, 'tiny') + ' ' + esc(c.ar || 'اختار كلاس') + '</button></div>'
      + '<div class="bars"><div class="lbl"><span>' + (s.nextLevel ? 'لحد مستوى ' + s.nextLevel : 'أعلى مستوى') + '</span><span>' + (s.next ? s.studyDays + ' / ' + s.next + ' يوم مذاكرة' : 'وصلت للقمة') + '</span></div>'
      + '<div class="bar xp"><i style="width:' + pct + '%"></i></div>'
      + '<div class="lbl"><span>نقاط المهارة</span><span>' + s.sp + ' 🪙' + (s.spBonus ? ' · +' + s.spBonus + ' بونص مستنيك' : '') + '</span></div></div></div></div>'
      + '<div class="skills">' + skills + '</div>'
      + '<p class="muted small">دوس على المهارة عشان تستخدمها. المهارات اللي بتساعد زمايلك تقدر تستخدمها كمان من زرار ' + ico('bolt', 'tiny') + ' جنب اسمهم في الترتيب.</p></section>';
  }

  /** In the app: the old class skills, now paid with coins, as "help your classmates". */
  function helpCard() {
    var d = S.data, ready = d.skills.filter(function (k) { return !k.locked; });
    if (!d.skills.length) return '';
    return '<section class="card" dir="ltr"><div class="card-h"><h3>🤝 Help your classmates</h3><span class="rd-coins">' + d.stats.sp + ' 🪙</span></div>'
      + '<p class="small muted">Spend coins to cheer up or protect a classmate. Tap ⚡ next to a name in the leaderboard.</p><div class="skills">'
      + d.skills.map(function (k) {
        var st = k.locked ? 'locked' : k.readyOn ? 'cooling' : d.stats.sp < k.cost ? 'poor' : 'ready';
        return '<button class="skill ' + st + '" data-act="skill-info" data-skill="' + k.id + '" title="' + esc(k.description) + '"><span class="sk-ic">' + ico(k.locked ? 'lock' : (SKILL_IC[k.id] || 'spark')) + '</span><span class="sk-name">' + esc(k.name) + '</span><span class="sk-cost">' + (k.locked ? 'later' : k.readyOn ? ico('hourglass', 'tiny') : k.cost + ' 🪙') + '</span></button>';
      }).join('') + '</div>' + (ready.length ? '' : '<p class="small muted">More open as you keep studying.</p>') + '</section>';
  }

  function bossCard() {
    var b = S.data.boss, left = Math.max(0, b.hp - b.damage), pct = Math.round(left / b.hp * 100);
    var daysLeft = Math.max(0, Math.round((new Date(b.ends + 'T23:59:59') - Date.now()) / 86400000));
    var top = b.top.map(function (p) { return '<li>' + avatar(p, 26) + '<span dir="auto">' + esc(p.name) + '</span><b>' + p.minutes + '</b></li>'; }).join('');
    return '<section class="card boss' + (b.defeated ? ' won' : '') + '"><div class="boss-top"><span class="boss-ic">' + ico('boss') + '</span>'
      + '<div class="boss-info"><span class="eyebrow">وحش الأسبوع</span><h2>' + esc(bossName(b.name)) + '</h2>'
      + (b.defeated
        ? '<p class="win">اتهزم. كل اللي حاربوا خدوا +3 SP ووسام هازم الوحش. الوحش الجاي ' + (daysLeft ? 'بعد ' + daysLeft + ' يوم' : 'بكرة') + '.</p>'
        : '<div class="bar boss-hp"><i style="width:' + pct + '%"></i><em dir="ltr">' + left.toLocaleString(LOC) + ' / ' + b.hp.toLocaleString(LOC) + ' HP</em></div>'
          + '<p class="muted small">كل دقيقة مذاكرة من أي حد = ضربة. ' + b.fighters + ' بيحاربوا · ' + (daysLeft ? 'فاضل ' + daysLeft + ' يوم' : 'آخر يوم!') + '</p>')
      + '</div></div>' + (top ? '<div class="boss-top5"><span class="eyebrow">أكتر ناس ضربوا الأسبوع ده (دقايق)</span><ol>' + top + '</ol></div>' : '') + '</section>';
  }

  function trendCard() {
    var t = S.data.trend;
    if (t.length < 2) return '<section class="card"><h3>صحة العادة</h3><p class="muted">الخط هيظهر بعد أول يوم كامل.</p></section>';
    var W = 640, H = 170, P2 = { l: 12, r: 40, t: 12, b: 26 }, n = t.length;
    // RTL chart: today on the left, older days to the right.
    var x = function (i) { return W - P2.r - (W - P2.l - P2.r) * (n === 1 ? 0 : i / (n - 1)); };
    var y = function (v) { return P2.t + (H - P2.t - P2.b) * (1 - v / 100); };
    var pts = t.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.health).toFixed(1); });
    var grid = [0, 50, 100].map(function (v) { return '<line x1="' + P2.l + '" x2="' + (W - P2.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (W - P2.r + 6) + '" y="' + (y(v) + 4) + '" text-anchor="start" class="ax">' + v + '%</text>'; }).join('');
    var lbls = [0, Math.floor((n - 1) / 2), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'end' : i === n - 1 ? 'start' : 'middle') + '" class="ax">' + (i === n - 1 ? 'النهارده' : fmtDay(t[i].day)) + '</text>'; }).join('');
    var miss = t.map(function (d, i) { return d.state === 'missed' ? '<circle cx="' + x(i) + '" cy="' + y(d.health) + '" r="3" class="miss"><title>' + fmtDay(d.day) + ': مذاكرتش</title></circle>' : ''; }).join('');
    var last = t[n - 1], first = t[Math.max(0, n - 8)];
    var dir = last.health - first.health;
    return '<section class="card"><div class="card-h"><h3>صحة العادة</h3><span class="trend">' + (dir > 2 ? ico('up', 'tiny') + ' بتطلع' : dir < -2 ? ico('down', 'tiny') + ' بتنزل' : ico('flat', 'tiny') + ' ثابتة') + '</span></div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="صحة العادة آخر ' + n + ' يوم، دلوقتي ' + last.health + '%">'
      + grid + '<polyline points="' + pts.join(' ') + '" class="line"/>' + miss
      + '<circle cx="' + x(n - 1) + '" cy="' + y(last.health) + '" r="5" class="end"/>' + lbls + '</svg>'
      + '<p class="muted small">الصحة بتعلى لما تذاكر (أكتر لما توصل لهدفك) وبتنزل في الأيام اللي مش بتذاكر فيها. النقط الحمرا = أيام فاتتك.</p></section>';
  }

  function breakdownCard() {
    var b = S.data.breakdown, tot = b.reduce(function (a, r) { return a + r.minutes; }, 0);
    if (!tot) return '<section class="card"><h3>وقتك بيروح فين</h3><p class="muted">سجّل أنشطة وهتشوف وقتك بيروح فين.</p></section>';
    var R = 52, Cc = 2 * Math.PI * R, off = 0;
    var arcs = b.map(function (r, i) {
      var len = r.minutes / tot * Cc, col = GRAYS[i % GRAYS.length];
      var s = '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + col + '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + ' ' + (Cc - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"><title>' + esc(act(r.activity).ar) + ': ' + hm(r.minutes) + '</title></circle>';
      off += len; return s;
    }).join('');
    var legend = b.map(function (r, i) { return '<li><i style="background:' + GRAYS[i % GRAYS.length] + '"></i>' + actLabel(r.activity) + '<b>' + hm(r.minutes) + '</b><em>' + Math.round(r.minutes / tot * 100) + '%</em></li>'; }).join('');
    return '<section class="card"><h3>وقتك بيروح فين</h3><div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="الوقت حسب النشاط"><g transform="rotate(-90 70 70)">' + arcs + '</g><text x="70" y="70" text-anchor="middle" class="d-big">' + hm(tot) + '</text><text x="70" y="88" text-anchor="middle" class="ax">المجموع</text></svg><ul class="legend">' + legend + '</ul></div></section>';
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
        cells += '<i class="h' + lvl + '" title="' + fmtDay(key) + ': ' + (m ? hm(m) : 'مفيش مذاكرة') + '"></i>';
      }
      cells += '</div>';
    }
    return '<section class="card"><h3>آخر ١٢ أسبوع</h3><div class="heat" role="img" aria-label="أيام المذاكرة آخر ١٢ أسبوع">' + cells + '</div>'
      + '<div class="heat-key"><span>أقل</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><span>وصلت للهدف</span></div></section>';
  }

  function badgesCard() {
    var b = S.data.badges, got = b.filter(function (x) { return x.on; }).length;
    return '<section class="card"><div class="card-h"><h3>الأوسمة</h3><span class="muted small">' + got + ' من ' + b.length + '</span></div><div class="badges">'
      + b.map(function (x) { var bi = badgeInfo(x.id, x.name); return '<div class="badge' + (x.on ? '' : ' off') + '" title="' + esc(bi.about) + (x.on ? ' · ' + fmtDay(x.on) : '') + '">' + ico(bi.ic) + '<b>' + esc(bi.name) + '</b></div>'; }).join('') + '</div></section>';
  }

  function recentCard() {
    var r = S.data.recent;
    if (!r.length) return '<section class="card"><h3>آخر الأنشطة</h3><p class="muted">لسه مفيش. دوس <b>نشاط</b> فوق وسجّل أول واحد.</p></section>';
    return '<section class="card"><h3>آخر الأنشطة</h3><ul class="recent">' + r.map(function (x) {
      var a = act(x.activity);
      return '<li><span class="r-ic">' + ico(a.ic) + '</span><div><b>' + esc(a.ar) + '</b><small>' + fmtDay(x.day, { weekday: 'short', day: 'numeric', month: 'short' }) + (x.cards ? ' · ' + x.cards + ' كارت' : '') + (x.notes ? ' · <span dir="auto">' + esc(x.notes) + '</span>' : '') + '</small></div>'
        + '<span class="r-min">' + hm(x.minutes) + '</span>' + (x.canDelete ? '<button class="icon-btn sm" data-act="del-log" data-id="' + x.id + '" aria-label="امسح النشاط ده" title="امسح">' + ico('x') + '</button>' : '<span class="icon-btn sm ghost"></span>') + '</li>';
    }).join('') + '</ul></section>';
  }


  /* ------------------------------------------------------------ Language Lens (words learned and sentences saved) */
  function lensCard() {
    if (!cfg.lens) return '';
    return '<section class="card lens" id="lens-card"><div class="card-h"><h3>' + ico('eye') + ' Language Lens</h3><span class="muted small">آخر ١٤ يوم</span></div><div id="lens-body"><p class="muted small">بيحمّل…</p></div><div class="lens-links"><a class="btn primary" href="/app/#learn">افتح التطبيق (مراجعة، فيديوهات، كتابة)</a><a class="btn ghost" href="/guide/">الدليل خطوة بخطوة</a></div></section>';
  }
  function loadLens() {
    if (!cfg.lens) return;
    var opt = { credentials: 'same-origin', headers: {} };
    if (cfg.nonce) opt.headers['X-WP-Nonce'] = cfg.nonce;
    fetch(cfg.lens.progress, opt).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
      var el = $('#lens-body'); if (!el) return;
      if (!p) { el.innerHTML = '<p class="muted small">مش قادرين نجيب تقدمك في Language Lens دلوقتي.</p>'; return; }
      if (!p.wordsKnown && !p.wordsLearning && !p.sentences) {
        el.innerHTML = '<p>اتعلم كلمات من يوتيوب وأي موقع بالإنجليزي: معنى الكلمة بالعربي لما تقف عليها، وتحفظ الجمل كبطاقات مراجعة. كل كلمة وجملة بتظهر هنا.</p>'
          + (cfg.lens.install ? '<a class="btn primary" style="margin-top:12px" href="' + esc(cfg.lens.install) + '" target="_blank" rel="noopener">ثبّت Language Lens</a>' : '<p class="muted small" style="margin-top:8px">الإضافة في النسخة التجريبية دلوقتي.</p>');
        return;
      }
      var max = Math.max(1, Math.max.apply(null, p.daily.map(function (d) { return d.words + d.sentences; })));
      var bars = p.daily.map(function (d) {
        var h = Math.round((d.words + d.sentences) / max * 100);
        return '<i title="' + fmtDay(d.day) + ': ' + d.words + ' كلمة، ' + d.sentences + ' جملة"' + (d.day === S.data.today ? ' class="now"' : '') + '><b style="height:' + h + '%"></b></i>';
      }).join('');
      el.innerHTML = '<div class="lens-stats"><div><b>' + p.todayWords + '</b><span>كلمة النهارده</span></div><div><b>' + p.todaySentences + '</b><span>جملة النهارده</span></div><div><b>' + p.wordsKnown.toLocaleString(LOC) + '</b><span>كلمة بتعرفها</span></div><div><b>' + p.sentences.toLocaleString(LOC) + '</b><span>جملة محفوظة</span></div></div>'
        + '<div class="lens-bars" role="img" aria-label="كلمات وجمل آخر ١٤ يوم">' + bars + '</div>';
    }, function () {});
  }

  /* ------------------------------------------------------------ leaderboard */
  /** English XP: points for using English in chat and writing, plus bonuses for fixing your mistakes. */
  function xpCard() {
    var x = S.data.xp; if (!x) return '';
    var pct = Math.min(100, Math.round((x.total - x.from) / Math.max(1, x.to - x.from) * 100));
    var why = { chat: 'الشات', voice: 'رسايل صوتية', write: 'الكتابة', improve: 'تحسين أخطاءك', mastered: 'إتقان مهارة' };
    var max = Math.max.apply(null, x.days.concat([1]));
    return '<section class="card xp-card"><div class="card-h"><h3>' + ico('bolt') + ' نقاط الإنجليزي (XP)</h3></div>'
      + '<div class="xp-row"><b class="xp-big" dir="ltr">' + x.total.toLocaleString('en-US') + ' XP</b><span class="muted small"><b dir="ltr">+' + x.week + '</b> الأسبوع ده</span></div>'
      + '<div class="xp-today"><span>النهارده: <b dir="ltr">+' + x.today + '</b></span><span class="muted small">' + (x.base >= x.cap ? 'وصلت للحد اليومي للشات والكتابة 👏' : 'باقي ' + (x.cap - x.base) + ' XP من الشات والكتابة النهارده') + '</span></div>'
      + (Object.keys(x.why || {}).length ? '<p class="small muted">' + Object.keys(x.why).map(function (k) { return (why[k] || k) + ' +' + x.why[k]; }).join(' · ') + '</p>' : '')
      + '<div class="lens-bars" title="آخر ١٤ يوم">' + x.days.map(function (d, i) { return '<i' + (i === x.days.length - 1 ? ' class="now"' : '') + '><b style="height:' + Math.round(d / max * 100) + '%"></b></i>'; }).join('') + '</div>'
      + '<p class="small muted">اكتب بالإنجليزي في الشات أو ابعت رسايل صوتية عشان تجمع XP. لو اتحسنت في غلطة كانت بتتكرر منك، بتاخد XP زيادة.</p></section>';
  }
  function boardCard() {
    return '<section class="card board"><div class="card-h"><h3>' + ico('trophy') + ' الترتيب</h3><span class="muted small" id="b-total"></span></div>'
      + '<div class="seg small-seg" role="tablist" aria-label="الترتيب">'
      + [['consistency', 'الاستمرارية'], ['week', 'الأسبوع ده'], ['all', 'من الأول'], ['xp', 'XP الأسبوع']].map(function (t) { return '<button data-act="board-tab" data-tab="' + t[0] + '" aria-pressed="' + (S.board.tab === t[0]) + '">' + t[1] + '</button>'; }).join('')
      + '</div><ol class="rows" id="b-rows"><li class="muted small pad">بيحمّل…</li></ol><div id="b-me"></div></section>';
  }
  function canHelp() { return S.data.skills.some(function (k) { return k.target === 'other' && !k.locked; }); }
  function boardRow(r) {
    var me = r.id === S.data.me.id, metric = S.board.tab === 'xp' ? '<span class="pc wide" dir="ltr">' + r.xp + ' XP</span>' : S.board.tab === 'consistency'
      ? '<div class="bar mini"><i style="width:' + r.health + '%;background:' + hpFill(r.health) + '"></i></div><span class="pc">' + r.health + '%</span>'
      : '<span class="pc wide">' + hm(r.minutes) + '</span>';
    return '<li class="row' + (me ? ' me' : '') + '"><span class="rank r' + Math.min(r.rank, 4) + '">' + r.rank + '</span>' + avatar(r, 36)
      + '<div class="r-main"><div class="r-name"><span dir="auto">' + esc(r.name) + '</span>' + (me ? '<small>(إنت)</small>' : '') + '<span class="cl" title="' + esc(cls(r.class).ar) + '">' + ico(cls(r.class).ic, 'tiny') + '</span>' + (r.today ? '<span class="dot-today" title="ذاكر النهارده"></span>' : '') + '</div>'
      + '<div class="r-meta"><span class="lv" dir="ltr">Lv ' + r.level + '</span>' + metric + '<span class="st">' + ico('flame', 'tiny') + r.streak + '</span></div></div>'
      + '<div class="r-acts">' + (!me && canHelp() ? '<button class="icon-btn sm" data-act="cast-on" data-id="' + r.id + '" aria-label="استخدم مهارة على ' + esc(r.name) + '" title="استخدم مهارة">' + ico('bolt') + '</button>' : '')
      + '<button class="icon-btn sm" data-act="profile" data-id="' + r.id + '" aria-label="بروفايل ' + esc(r.name) + '" title="البروفايل">' + ico('info') + '</button></div></li>';
  }
  function paintBoard() {
    var el = $('#b-rows'); if (!el) return;
    var b = S.board;
    if (!b.rows.length) { el.innerHTML = '<li class="muted small pad">' + (b.loaded ? 'لسه محدش في الترتيب. سجّل نشاط وكن الأول!' : 'بيحمّل…') + '</li>'; return; }
    el.innerHTML = b.rows.slice(0, b.showAll ? 100 : 15).map(boardRow).join('') + (b.rows.length > 15 && !b.showAll ? '<li class="pad"><button class="btn ghost wide" data-act="board-more">اعرض أول ' + Math.min(100, b.rows.length) + '</button></li>' : '');
    $('#b-total').textContent = b.total + ' طالب';
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
    return '<section class="card feed"><div class="card-h"><h3>اللي بيحصل دلوقتي</h3><span class="live"><i></i>مباشر</span></div><ul class="events" id="f-list"><li class="muted small pad">بيحمّل…</li></ul>'
      + '<button class="btn ghost wide" data-act="feed-more" id="f-more" hidden>اعرض القديم</button></section>';
  }
  function name(p) { return p ? '<b dir="auto">' + esc(p.name) + '</b>' : '<b>حد</b>'; }
  function eventText(e) {
    var d = e.data || {};
    switch (e.type) {
      case 'log': return name(e.who) + ' سجّل ' + d.minutes + ' دقيقة ' + esc(act(d.activity).ar) + (d.cards ? ' (' + d.cards + ' كارت)' : '');
      case 'day_done': return name(e.who) + ' خلّص اليوم ' + d.day + (d.mood ? ' وحاسس بـ ' + d.mood + '/10' : '') + (d.up > 0 ? ' <span class="up">المود طلع ' + d.up + '</span>' : '');
      case 'skill': return name(e.who) + ' استخدم <span dir="ltr">' + esc(d.name) + '</span> على ' + (e.target && e.who && e.target.id === e.who.id ? 'نفسه' : name(e.target));
      case 'level_up': return name(e.who) + ' وصل <b dir="ltr">Level ' + d.level + '</b> · <span dir="ltr">' + esc(d.title) + '</span>';
      case 'badge': return name(e.who) + ' خد وسام <b>' + esc(badgeByName(d.name).name) + '</b>';
      case 'boss_down': return '<b>المجتمع هزم ' + esc(bossName(d.name)) + '!</b> ' + d.fighters + ' حاربوا وكل واحد خد +3 SP';
      case 'streak_lost': return name(e.who) + ' خسر ستريك ' + d.streak + ' يوم. ابعتله دعم.';
      case 'freeze_used': return name(e.who) + ' حافظ على ستريك ' + d.streak + ' يوم بتجميد';
      case 'joined': return name(e.who) + ' انضم كـ' + esc(cls(d.class).ar) + '. أهلًا بيه!';
      case 'quest_done': return name(e.who) + ' خلّص مهمة النهارده' + (d.note ? ': <span dir="auto">"' + esc(d.note) + '"</span>' : '');
      case 'group_invite': return name(e.who) + ' ضافك لجروب <b dir="auto">' + esc(d.name) + '</b>';
      case 'mastered': return name(e.who) + ' أتقن <b dir="ltr">' + esc(d.name) + '</b> 🏆';
      case 'hunt': return name(e.who) + (d.won ? ' (صياد) مسكك ورجّع ' + d.amount + ' 🪙 لصاحبها.' : ' (صياد) حاول يمسكك وهربت!');
      case 'returned': return name(e.who) + ' (صياد) مسك ' + esc(d.thief) + ' ورجّعلك ' + d.amount + ' 🪙!';
      case 'raid': return name(e.who) + (d.won ? ' هجم عليك وخد ' + d.loot + ' 🪙. اعمل خطة النهارده عشان دفاعك يعلى، وتقدر تنتقم!' : ' حاول يهجم عليك ودفاعك صدّه 🛡');
      case 'duel': return name(e.who) + (d.won ? ' beat your shadow in a duel ⚔ Fight more battles to make your shadow stronger!' : ' dueled your shadow and lost! Your shadow fights like you do 💪');
      case 'party_invite': return name(e.who) + ' invited you to the party <b dir="auto">' + esc(d.name) + '</b> ⚔';
      case 'party_live': return name(e.who) + ' started a live battle in <b dir="auto">' + esc(d.party) + '</b>. Join now! 🔴';
      case 'party_boss': return name(e.who) + ' summoned the ' + esc(d.boss) + '. Hit it with your party! ⚔';
      case 'party_win': return '🏆 Your party <b dir="auto">' + esc(d.party) + '</b> defeated the ' + esc(d.boss) + '! +' + d.coins + ' 🪙 +' + d.elixirs + ' ⚗';
      case 'party_down': return '⚔ The party <b dir="auto">' + esc(d.party) + '</b> defeated the ' + esc(d.boss) + (d.live ? ' in a live battle' : '') + '!';
      case 'town': return name(e.who) + ' defeated the ' + esc(d.boss) + ' in ' + esc(d.town) + (d.next ? ' and set off for ' + esc(d.next) : '') + ' 🐫';
      case 'reply': return name(e.who) + ' رد على رسالتك' + (d.voice ? ' برسالة صوتية' : d.sticker ? ' بـ ' + esc(d.sticker) : d.text ? ': <span dir="auto">"' + esc(d.text) + '"</span>' : '');
    }
    return name(e.who) + ' عمل حاجة';
  }
  function eventIcon(e) {
    var m = { log: 'pen', day_done: 'check', skill: 'bolt', level_up: 'up', badge: 'medal', boss_down: 'boss', streak_lost: 'flame', freeze_used: 'snow', joined: 'users', quest_done: 'target', group_invite: 'chat', reply: 'reply', mastered: 'medal', raid: 'shield', hunt: 'target', returned: 'check', town: 'trophy', party_down: 'sword', party_win: 'trophy', party_invite: 'users', party_live: 'bolt', party_boss: 'boss' };
    return m[e.type] || 'spark';
  }
  var REACTS = ['👏', '🔥', '💪', '❤️'];
  function eventItem(e) {
    var big = e.type === 'boss_down' || e.type === 'level_up' || e.type === 'badge';
    var reacts = REACTS.map(function (r) {
      var n = (e.reactions && e.reactions[r]) || 0, on = (e.mine || []).indexOf(r) >= 0;
      return '<button class="react' + (on ? ' on' : '') + (n ? ' has' : '') + '" data-act="react" data-id="' + e.id + '" data-emoji="' + r + '" aria-pressed="' + on + '" aria-label="تفاعل ' + r + '">' + r + (n ? '<span>' + n + '</span>' : '') + '</button>';
    }).join('');
    return '<li class="ev' + (big ? ' big' : '') + '" data-id="' + e.id + '">' + (e.who ? avatar(e.who, 32) : '<span class="av sys" style="width:32px;height:32px">' + ico(eventIcon(e)) + '</span>')
      + '<div class="ev-main"><p>' + eventText(e) + '</p><div class="ev-foot"><time datetime="' + esc(e.at) + '">' + ago(e.at) + '</time><span class="reacts">' + reacts + '</span></div></div></li>';
  }
  function paintFeed() {
    var el = $('#f-list'); if (!el) return;
    el.innerHTML = S.feed.length ? S.feed.map(eventItem).join('') : '<li class="muted small pad">' + (S.feedLoaded ? 'هادي لحد دلوقتي. نشاطك الجاي هيظهر هنا.' : 'بيحمّل…') + '</li>';
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
  function mHead(title, sub) { return '<div class="m-head"><div><h2>' + title + '</h2>' + (sub ? '<p class="muted small">' + sub + '</p>' : '') + '</div><button class="icon-btn" data-act="close" aria-label="اقفل">' + ico('x') + '</button></div>'; }

  function actChips(nm, selected) {
    return '<div class="chips" role="radiogroup">' + cfg.activities.map(function (a) {
      var m = act(a.name);
      return '<label class="chip"><input type="radio" name="' + nm + '" value="' + esc(a.name) + '"' + (selected === a.name ? ' checked' : '') + '><span>' + ico(m.ic) + esc(m.ar) + '</span></label>';
    }).join('') + '</div>';
  }
  function minuteInput(id, val) {
    return '<div class="mins"><input type="number" id="' + id + '" min="1" max="720" inputmode="numeric" placeholder="مثلًا 30" value="' + (val || '') + '" aria-label="الدقايق" dir="ltr">'
      + '<div class="quick">' + [10, 20, 30, 45, 60].map(function (m) { return '<button type="button" data-act="quick-min" data-target="' + id + '" data-min="' + m + '">' + m + '</button>'; }).join('') + '</div></div>';
  }

  function openLogActivity(pre) {
    openModal(mHead('سجّل نشاط', 'كل نشاط بيديك نقطة مهارة.')
      + '<form class="stack" id="f-log"><div class="f"><span>النشاط</span>' + actChips('activity', pre) + '</div>'
      + '<div class="f"><span>الوقت (بالدقيقة)</span>' + minuteInput('l-min') + '</div>'
      + '<label class="f" id="l-cards-row" hidden>عدد الكروت <small>اختياري</small><input type="number" id="l-cards" min="0" max="5000" inputmode="numeric" dir="ltr"></label>'
      + '<div class="f"><span>اليوم</span><div class="seg"><button type="button" data-act="day-pick" data-day="' + S.data.today + '" aria-pressed="true">النهارده</button><button type="button" data-act="day-pick" data-day="' + S.data.yesterday + '" aria-pressed="false">امبارح</button></div></div>'
      + '<label class="f">اشتغلت على إيه؟ <small>اختياري</small><input id="l-notes" maxlength="300" placeholder="مثلًا: بودكاست، أو راجعت الـ Anki deck" dir="auto"></label>'
      + '<p class="err" role="alert"></p><button class="btn primary wide" type="submit">احفظ النشاط</button></form>');
    var form = $('#f-log'), day = S.data.today;
    function syncCards() { var c = form.querySelector('[name=activity]:checked'); $('#l-cards-row').hidden = !(c && act(c.value).cards); }
    form.addEventListener('change', syncCards); syncCards();
    form.addEventListener('click', function (e) { var b = e.target.closest('[data-act=day-pick]'); if (b) { day = b.dataset.day; form.querySelectorAll('[data-act=day-pick]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = form.querySelector('[name=activity]:checked'), err = form.querySelector('.err'), btn = form.querySelector('[type=submit]');
      var min = parseInt($('#l-min').value, 10);
      if (!c) { err.textContent = 'اختار النشاط.'; return; }
      if (!(min >= 1 && min <= 720)) { err.textContent = 'اكتب الدقايق من 1 لـ 720.'; return; }
      busy(btn, true);
      api('/log', { method: 'POST', body: { activity: c.value, minutes: min, cards: parseInt($('#l-cards').value, 10) || 0, notes: $('#l-notes').value.trim(), day: day } })
        .then(function (j) { closeModal(); afterAction(j, 'اتسجّل!' + (j.sp ? ' +' + j.sp + ' 🪙' : '')); }, function (x) { busy(btn, false); err.textContent = x.message; });
    });
  }

  /* Log your day: one step per activity, then a reflection, then a review. */
  function openLogDay() {
    var steps = cfg.activities.map(function (a) { return { type: 'act', a: a }; }).concat([{ type: 'reflect' }, { type: 'review' }]);
    var st = { i: 0, entries: {}, moodBefore: 0, moodAfter: 0, note: '', day: S.data.today };
    function moodPick(key, label) {
      var v = st[key];
      return '<div class="f"><span>' + label + '</span><div class="mood" role="radiogroup" dir="ltr">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" data-act="mood" data-key="' + key + '" data-n="' + n + '" aria-pressed="' + (v === n) + '">' + n + '</button>'; }).join('') + '</div><div class="mood-ends" dir="ltr"><span>وحش</span><span>عظيم</span></div></div>';
    }
    function draw() {
      var s = steps[st.i], n = steps.length, body = '';
      if (s.type === 'act') {
        var e = st.entries[s.a.name], m = act(s.a.name);
        body = '<div class="q"><span class="q-ic">' + ico(m.ic) + '</span><h3>عملت ' + esc(m.ar) + (st.day === S.data.today ? ' النهارده' : ' امبارح') + '؟</h3></div>'
          + (e ? '<div class="stack"><div class="f"><span>الدقايق</span>' + minuteInput('d-min', e.minutes) + '</div>'
            + (s.a.cards ? '<label class="f">عدد الكروت <small>اختياري</small><input type="number" id="d-cards" min="0" max="5000" value="' + (e.cards || '') + '" dir="ltr"></label>' : '')
            + '<label class="f">ملاحظات <small>اختياري</small><input id="d-notes" maxlength="300" value="' + esc(e.notes || '') + '" dir="auto"></label>'
            + '<div class="row-btns"><button class="btn ghost" data-act="d-no">لأ معملتش</button><button class="btn primary" data-act="d-next">اللي بعده</button></div></div>'
            : '<div class="row-btns big"><button class="btn primary" data-act="d-yes">آه</button><button class="btn" data-act="d-no">لأ</button></div>');
      } else if (s.type === 'reflect') {
        body = '<div class="q"><span class="q-ic">' + ico('heart') + '</span><h3>كنت حاسس بإيه؟</h3></div>' + moodPick('moodBefore', 'قبل المذاكرة') + moodPick('moodAfter', 'بعد المذاكرة')
          + '<label class="f">رسالة لشريف <small>اختياري، شريف بس اللي بيشوفها</small><textarea id="d-note" rows="3" maxlength="2000" dir="auto" placeholder="حاجة صعبت عليك، أو حاجة فخور بيها؟">' + esc(st.note) + '</textarea></label>'
          + '<div class="row-btns"><button class="btn ghost" data-act="d-back">رجوع</button><button class="btn primary" data-act="d-next">راجع يومك</button></div>';
      } else {
        var list = Object.keys(st.entries).map(function (k) { var e2 = st.entries[k]; return '<li>' + actLabel(k) + (e2.cards ? '<small>' + e2.cards + ' كارت</small>' : '') + '<b>' + hm(e2.minutes) + '</b></li>'; });
        var tot = Object.keys(st.entries).reduce(function (a, k) { return a + st.entries[k].minutes; }, 0);
        body = '<div class="q"><span class="q-ic">' + ico('cal') + '</span><h3>يومك</h3></div>'
          + (list.length ? '<ul class="review">' + list.join('') + '<li class="tot"><span>المجموع</span><b>' + hm(tot) + '</b></li></ul>' : '<p class="err">مضفتش أي نشاط. ارجع واختار "آه" للي عملته.</p>')
          + (st.moodAfter ? '<p class="muted small">المود: <span dir="ltr">' + (st.moodBefore ? st.moodBefore + ' → ' : '') + st.moodAfter + '/10</span></p>' : '')
          + '<p class="err" role="alert"></p><div class="row-btns"><button class="btn ghost" data-act="d-back">رجوع</button><button class="btn primary" data-act="d-submit"' + (list.length ? '' : ' disabled') + '>خلّص يومي</button></div>';
      }
      openModal(mHead('سجّل يومك', fmtDay(st.day, { weekday: 'long', day: 'numeric', month: 'short' }))
        + '<div class="steps-h"><span>خطوة ' + (st.i + 1) + ' من ' + n + '</span><span>' + (s.type === 'act' ? esc(act(s.a.name).ar) : s.type === 'reflect' ? 'إحساسك' : 'المراجعة') + '</span></div><div class="bar step"><i style="width:' + Math.round((st.i + 1) / n * 100) + '%"></i></div>'
        + (st.i === 0 ? '<div class="seg center"><button data-act="d-day" data-day="' + S.data.today + '" aria-pressed="' + (st.day === S.data.today) + '">النهارده</button><button data-act="d-day" data-day="' + S.data.yesterday + '" aria-pressed="' + (st.day === S.data.yesterday) + '">امبارح</button></div>' : '')
        + '<div class="step-body">' + body + '</div>');
    }
    function saveStep() {
      var s = steps[st.i];
      if (s.type === 'act' && st.entries[s.a.name]) {
        var m = parseInt($('#d-min').value, 10);
        if (!(m >= 1 && m <= 720)) { toast('اكتب الدقايق من 1 لـ 720.', 'bad'); return false; }
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
          busy(el, true, 'بيتحفظ يومك…');
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
    openModal('<div class="recap"><div class="big-ic">' + ico('check') + '</div><h2>اليوم ' + j.dayNumber + ' خلص!</h2>'
      + '<p class="muted">' + hm(tot) + ' · ' + entries.length + ' نشاط' + (cards ? ' · ' + cards + ' كارت' : '') + '</p>'
      + (st.moodAfter ? '<p>المود <span dir="ltr">' + st.moodAfter + '/10</span>' + (st.moodBefore ? (st.moodAfter >= st.moodBefore ? ' (كان ' + st.moodBefore + ')' : ' (من ' + st.moodBefore + ')') : '') + '</p>' : '')
      + '<p class="serif">keep going.</p>'
      + '<div class="pills"><span class="pill sp">+' + j.sp + ' 🪙</span>' + (j.levelUp ? '<span class="pill lv" dir="ltr">Level ' + j.levelUp + '</span>' : '') + (j.badges || []).map(function (b) { var bi = badgeInfo(b); return '<span class="pill bd">' + ico(bi.ic, 'tiny') + ' ' + esc(bi.name) + '</span>'; }).join('') + '</div>'
      + '<button class="btn primary wide" data-act="close" autofocus>تمام</button></div>', 'narrow');
  }

  /* Skills */
  function openSkill(id) {
    var k = S.data.skills.filter(function (x) { return x.id === id; })[0]; if (!k) return;
    var s = S.data.stats, why = k.locked ? 'بتتفتح في مستوى ' + k.unlock + '. إنت في مستوى ' + s.level + '.' : k.readyOn ? 'بتستريح. جاهزة تاني ' + fmtDay(k.readyOn) + '.' : s.sp < k.cost ? 'محتاج ' + k.cost + ' SP ومعاك ' + s.sp + '. سجّل أنشطة عشان تجمع أكتر.' : '';
    var others = k.target === 'other';
    openModal(mHead('<span class="h-ic">' + ico(SKILL_IC[k.id] || 'spark') + '</span><span dir="ltr">' + esc(k.name) + '</span>', others ? 'بتتستخدم على زميل' : 'بتتستخدم على نفسك')
      + '<p dir="rtl">' + esc(k.descriptionAr || k.description) + '</p>'
      + '<div class="pills"><span class="pill sp">' + k.cost + ' 🪙</span><span class="pill">بتستريح ' + k.cooldown + ' يوم بعد ما تستخدمها</span></div>'
      + (why ? '<p class="note">' + esc(why) + '</p>' : others ? '<div class="f"><span>اختار زميل</span><input id="t-search" placeholder="دوّر بالاسم" autocomplete="off" dir="auto"><ul class="pick-list" id="t-list"></ul></div>' : '')
      + '<p class="err" role="alert"></p>'
      + (!why && !others ? '<button class="btn primary wide" data-act="cast" data-skill="' + k.id + '" data-target="0">استخدم <span dir="ltr">' + esc(k.name) + '</span></button>' : ''));
    if (!why && others) {
      var draw = function () {
        var q = ($('#t-search').value || '').toLowerCase();
        var rows = S.board.rows.filter(function (r) { return r.id !== S.data.me.id && r.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 30);
        rows.sort(function (a, b) { return a.health - b.health; });
        $('#t-list').innerHTML = rows.length ? rows.map(function (r) { return '<li><button class="pick" data-act="cast" data-skill="' + k.id + '" data-target="' + r.id + '">' + avatar(r, 30) + '<span dir="auto">' + esc(r.name) + '</span><small>صحة ' + r.health + '% · ستريك ' + r.streak + (r.today ? ' · ذاكر النهارده' : '') + '</small></button></li>'; }).join('') : '<li class="muted small pad">ملقيناش حد.</li>';
      };
      $('#t-search').addEventListener('input', draw); draw();
      $('#t-list').insertAdjacentHTML('beforebegin', '<p class="muted small">اللي صحتهم أوطى بيظهروا الأول.</p>');
    }
  }
  function openCastOn(targetId) {
    var t = S.board.rows.filter(function (r) { return r.id === targetId; })[0] || { id: targetId, name: 'الزميل ده' };
    var list = S.data.skills.filter(function (k) { return k.target === 'other'; }).map(function (k) {
      var s = S.data.stats, dis = k.locked || k.readyOn || s.sp < k.cost;
      var why = k.locked ? 'Lv ' + k.unlock : k.readyOn ? 'جاهزة ' + fmtDay(k.readyOn) : s.sp < k.cost ? 'محتاج ' + k.cost + ' 🪙' : k.cost + ' 🪙';
      return '<li><button class="pick skillpick" data-act="cast" data-skill="' + k.id + '" data-target="' + targetId + '"' + (dis ? ' disabled' : '') + '><span class="sk-ic">' + ico(k.locked ? 'lock' : (SKILL_IC[k.id] || 'spark')) + '</span><span><b dir="ltr">' + esc(k.name) + '</b><small>' + esc(k.descriptionAr || k.description) + '</small></span><em>' + esc(why) + '</em></button></li>';
    }).join('');
    openModal(mHead('ساعد ' + esc(t.name), 'معاك ' + S.data.stats.sp + ' 🪙') + '<ul class="pick-list">' + list + '</ul><p class="err" role="alert"></p>');
  }
  function doCast(btn) {
    busy(btn, true, 'بيتنفذ…');
    api('/cast', { method: 'POST', body: { skill: btn.dataset.skill, target: +btn.dataset.target } }).then(function (j) {
      closeModal(); afterAction(j, 'استخدمت ' + j.skill.name);
    }, function (x) { busy(btn, false); var er = $('#modal .err'); if (er) er.textContent = x.message; });
  }

  function openProfile(id) {
    openModal('<div class="pad center"><span class="spin"></span></div>', 'narrow');
    api('/student/' + id).then(function (p) {
      var c = cls(p.class), shield = p.shieldUntil && p.shieldUntil >= S.data.today;
      openModal(mHead('', '') + '<div class="profile">' + avatar(p, 84) + '<h2 dir="auto">' + esc(p.name) + '</h2><p class="muted"><span dir="ltr">Lv ' + p.level + ' · ' + esc(p.title) + '</span> · ' + esc(c.ar) + '</p>'
        + '<div class="mini-stats"><div><b class="' + (low(p.health) ? 'red' : '') + '">' + p.health + '%</b><span>الصحة' + (shield ? ' · محمي' : '') + '</span></div><div><b>' + p.streak + '</b><span>ستريك' + (p.freezes ? ' · ' + p.freezes + ' تجميد' : '') + '</span></div><div><b>' + p.studyDays + '</b><span>يوم مذاكرة</span></div><div><b>' + hm(p.totalMinutes) + '</b><span>المجموع</span></div></div>'
        + (p.badges.length ? '<div class="pills center">' + p.badges.map(function (b) { var bi = badgeByName(b.name); return '<span class="pill" title="' + esc(bi.name) + '">' + ico(bi.ic, 'tiny') + ' ' + esc(bi.name) + '</span>'; }).join('') + '</div>' : '')
        + (p.recent.length ? '<ul class="recent small">' + p.recent.map(function (r) { var a = act(r.activity); return '<li><span class="r-ic">' + ico(a.ic) + '</span><div><b>' + esc(a.ar) + '</b><small>' + fmtDay(r.day) + '</small></div><span class="r-min">' + hm(r.minutes) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">لسه مفيش أنشطة.</p>')
        + (p.id !== S.data.me.id && canHelp() ? '<button class="btn primary wide" data-act="cast-on" data-id="' + p.id + '">' + ico('bolt') + ' استخدم مهارة على ' + esc(p.name.split(' ')[0]) + '</button>' : '') + '</div>', 'narrow');
    }, function (x) { closeModal(); toast(x.message, 'bad'); });
  }

  function openNotifs() {
    var n = S.data.notifications;
    var text = function (e) {
      var d = e.data || {};
      if (e.type === 'skill') {
        var effects = { rally: 'بيشجعك: يلا نذاكر!', heal: '(+15% صحة)', inner_peace: '', war_cry: '(+10% صحة)', shield_ally: '(+1 تجميد للستريك)', fortify: '(حماية للصحة يومين)', unbreakable: '(تجميد + حماية ٣ أيام)', empower: '(+2 SP على نشاطك الجاي)', revitalize: '(+10% صحة وتجميد)', sanctuary: '(حماية ٣ أيام)', guardian_angel: '(+20% صحة وحماية ٣ أيام)' };
        return name(e.who) + (d.skill === 'rally' ? ' ' + effects.rally : ' استخدم <span dir="ltr">' + esc(d.name) + '</span> عليك ' + (effects[d.skill] || ''));
      }
      return eventText(e);
    };
    openModal(mHead('الإشعارات', 'الردود على رسايلك، والمهارات اللي زمايلك استخدموها عليك') + (n.length ? '<ul class="events">' + n.map(function (e) { var inner = (e.who ? avatar(e.who, 32) : '') + '<div class="ev-main"><p>' + text(e) + '</p><div class="ev-foot"><time>' + ago(e.at) + '</time></div></div>'; return /^party_/.test(e.type) ? '<li><button class="ev ev-link" data-act="notif-world" data-tab="party"' + (e.type === 'party_live' ? ' data-live="1"' : '') + '>' + inner + '</button></li>' : e.type === 'reply' && e.data && e.data.room ? '<li><button class="ev ev-link" data-act="notif-room" data-room="' + e.data.room + '" data-msg="' + (e.data.msg || 0) + '">' + inner + '</button></li>' : '<li class="ev">' + inner + '</li>'; }).join('') + '</ul>' : '<p class="muted">لسه مفيش. لما حد يرد على رسالتك أو يعالجك أو يبعتلك Rally، هيظهر هنا.</p>'), 'narrow');
    if (S.data.unread && n.length) { api('/notifications/seen', { method: 'POST', body: { id: n[0].id } }).then(function () { S.data.unread = 0; var b = $('.bell i'); if (b) b.remove(); var bell = $('.bell'); if (bell) bell.setAttribute('aria-label', 'الإشعارات'); }); }
  }

  function openSettings() {
    var d = S.data;
    var hr = function (h) { return h === 12 ? '12 الضهر' : h < 12 ? h + ' الصبح' : (h - 12) + (h < 17 ? ' العصر' : ' بالليل'); };
    openModal(mHead('إعداداتك') + '<div class="stack">'
      + '<div class="f"><span>صورتك</span><div class="photo-row">' + avatar(d.me, 64) + '<button class="btn" data-act="pick-avatar">غيّر الصورة</button><input type="file" id="av-file" accept="image/*" hidden></div></div>'
      + '<label class="f">هدفك اليومي (بالدقيقة) <small>لما توصله صحتك بتعلى أكتر</small><input type="number" id="goal" min="5" max="600" value="' + d.stats.goal + '" dir="ltr"></label>'
      + '<button class="btn primary" data-act="save-goal">احفظ الهدف</button>'
      + '<label class="f">تذكير على الإيميل <small>بيتبعت بس في الأيام اللي لسه مذاكرتش فيها</small><select id="remind">'
      + '<option value="">مقفول</option>' + [7, 9, 12, 15, 17, 18, 19, 20, 21, 22].map(function (h) { return '<option value="' + h + '"' + (String(h) === String(d.remindHour) ? ' selected' : '') + '>' + hr(h) + '</option>'; }).join('')
      + '</select></label>'
      + (EMB ? '' : '<hr><button class="btn ghost" data-act="change-class">غيّر الكلاس</button>')
      + '<a class="btn ghost" href="' + esc(cfg.logoutUrl) + '">اخرج</a></div>', 'narrow');
  }
  function uploadAvatar(file) {
    var img = new Image(), u = URL.createObjectURL(file);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); URL.revokeObjectURL(u);
      c.toBlob(function (b) {
        var fd = new FormData(); fd.append('avatar', b, 'avatar.jpg');
        toast('بنرفع الصورة…');
        api('/profile', { method: 'POST', form: fd }).then(function (j) { S.data = j.data; closeModal(); if (S.photoGate) { S.photoGate = false; start(); toast('أهلًا بيك! الصورة اتحفظت', 'good'); return; } renderDash(); loadBoard(); toast('الصورة اتغيرت'); }, function (x) { toast(x.message, 'bad'); });
      }, 'image/jpeg', 0.88);
    };
    img.onerror = function () { toast('الصورة دي مش راضية تفتح. جرب JPG أو PNG.', 'bad'); };
    img.src = u;
  }

  /* ------------------------------------------------------------ clan */
  function mono(nm) { var s = String(nm || '').replace(/^(the|al)\s+/i, '').replace(/^ال/, '').trim(); return esc(s.charAt(0) || '؟'); }
  function loadClan() {
    S.clanLoading = true;
    return api('/clan').then(function (j) { S.clanData = j; S.clanLoading = false; if (S.view === 'clan' || S.view === 'community') { var v = $('#view'); if (v) v.innerHTML = clanView(); } }, function (x) { S.clanLoading = false; toast(x.message, 'bad'); });
  }
  function weekDots(goalDays, weekStart) {
    var out = '', d0 = new Date(weekStart + 'T12:00:00'), today = S.data.today;
    for (var i = 0; i < 7; i++) {
      var d = new Date(d0); d.setDate(d0.getDate() + i);
      var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      var on = goalDays.indexOf(k) >= 0;
      out += '<i class="wd' + (on ? ' on' : '') + (k > today ? ' future' : '') + (k === today ? ' now' : '') + '" title="' + fmtDay(k, { weekday: 'short', day: 'numeric' }) + (on ? ': وصل للهدف' : '') + '"></i>';
    }
    return '<span class="wdots" aria-label="' + goalDays.length + ' يوم وصل فيهم للهدف الأسبوع ده">' + out + '</span>';
  }
  function clanView() {
    var j = S.clanData;
    if (!j) return '<div class="loading"><span class="spin"></span>بيحمّل الكلان…</div>';
    var c = j.clan, st = j.standings;
    var standings = st.length ? '<section class="card"><div class="card-h"><h3>سباق الكلانات الأسبوع ده</h3><span class="muted small">متوسط أيام الهدف لكل عضو</span></div><ol class="rows">'
      + st.map(function (r) { return '<li class="row' + (c && r.id === c.id ? ' me' : '') + '"><span class="rank r' + Math.min(r.rank, 4) + '">' + r.rank + '</span><span class="clan-mono">' + mono(r.name) + '</span><div class="r-main"><div class="r-name"><span dir="auto">' + esc(r.name) + '</span></div><div class="r-meta"><span>' + r.size + ' أعضاء</span><span class="st">' + ico('flame', 'tiny') + r.streak + '</span></div></div><b class="score">' + r.score.toFixed(1) + '</b></li>'; }).join('')
      + '</ol></section>' : '';
    if (!c) return '<div class="grid clan-grid"><div class="col main"><section class="card center-card"><div class="big-ic">' + ico('shield') + '</div><h2>لسه مش في كلان</h2><p class="muted">الكلان فريق صغير بيحافظ على ستريك سوا. شريف هو اللي بيوزع الكلانات، وكلانك هيظهر هنا قريب.</p></section></div><div class="col side">' + standings + '</div></div>';
    var rank = st.filter(function (r) { return r.id === c.id; })[0];
    var members = c.members.map(function (m) {
      var me = m.id === S.data.me.id;
      return '<li class="row' + (me ? ' me' : '') + '">' + avatar(m, 38) + '<div class="r-main"><div class="r-name"><span dir="auto">' + esc(m.name) + '</span>' + (me ? '<small>(إنت)</small>' : '') + '<span class="cl">' + ico(cls(m.class).ic, 'tiny') + '</span></div>'
        + '<div class="r-meta"><span class="lv" dir="ltr">Lv ' + m.level + '</span><div class="bar mini"><i style="width:' + m.health + '%;background:' + hpFill(m.health) + '"></i></div><span class="st">' + ico('flame', 'tiny') + m.streak + '</span>' + weekDots(m.goalDays, j.weekStart) + '</div></div>'
        + '<span class="today-chip ' + (m.today ? 'yes' : 'no') + '">' + (m.today ? ico('check', 'tiny') + hm(m.todayMin) : 'لسه') + '</span>'
        + '<div class="r-acts">' + (!me && canHelp() ? '<button class="icon-btn sm" data-act="cast-on" data-id="' + m.id + '" aria-label="استخدم مهارة على ' + esc(m.name) + '">' + ico('bolt') + '</button>' : '') + '<button class="icon-btn sm" data-act="profile" data-id="' + m.id + '" aria-label="البروفايل">' + ico('info') + '</button></div></li>';
    }).join('');
    var left = Math.max(0, c.need - c.today);
    return '<div class="grid clan-grid"><div class="col main">'
      + '<section class="card clan-hero"><span class="clan-big">' + mono(c.name) + '</span><div class="clan-info"><span class="eyebrow">الكلان بتاعك</span><h2 dir="auto">' + esc(c.name) + '</h2>'
      + '<div class="pills"><span class="pill">' + ico('flame', 'tiny') + ' ستريك الكلان ' + c.streak + ' يوم</span><span class="pill">' + c.score.toFixed(1) + ' يوم هدف لكل عضو</span>' + (rank ? '<span class="pill lv">رقم ' + rank.rank + ' من ' + st.length + '</span>' : '') + '</div>'
      + '<p class="muted small">' + c.today + ' من ' + c.size + ' ذاكروا النهارده. ' + (left ? (left === 1 ? 'محتاجين واحد كمان' : 'محتاجين ' + left + ' كمان') + ' عشان ستريك الكلان يكمل.' : 'ستريك الكلان في الأمان النهارده.') + '</p></div>'
      + '<button class="btn primary" data-act="open-clan-chat">' + ico('chat') + ' شات الكلان</button></section>'
      + '<section class="card"><div class="card-h"><h3>الأعضاء</h3><span class="muted small">المربعات = أيام وصلت فيها لهدفك الأسبوع ده</span></div><ol class="rows">' + members + '</ol></section>'
      + '</div><div class="col side">' + standings + '</div></div>';
  }

  /* ------------------------------------------------------------ chat */
  var C = { rooms: null, room: null, msgs: [], loadingRoom: false, enabled: true, muted: '', admin: false, rec: null, ai: {}, maxRow: 5, replyTo: null, stickers: {}, reactList: [], gifsOn: false, reacts: {}, tray: '' };
  function loadRooms() {
    return api('/chat/rooms').then(function (j) {
      C.rooms = j.rooms; C.enabled = j.enabled; C.muted = j.muted; C.admin = j.admin; emit({ unread: j.unread }); C.ai = j.ai || {}; C.maxRow = j.maxRow || 5; C.stickers = j.stickers || {}; C.reactList = j.reacts || []; C.gifsOn = !!j.gifs;
      S.chatUnread = j.unread;
      var badge = $('.nav [data-view=chat] i');
      if (S.view !== 'chat') { if (badge) badge.textContent = j.unread; else if (j.unread) { var b = $('.nav [data-view=chat]'); if (b) b.insertAdjacentHTML('beforeend', '<i>' + j.unread + '</i>'); } if (!j.unread && badge) badge.remove(); }
      if (S.view === 'chat') paintRoomList();
      if (C.pending) { var p = C.pending; C.pending = 0; openRoom(p); }
    }, function () {});
  }
  function roomName(r) { return r.type === 'public' ? 'المجتمع' : r.name; }
  function roomIcon(r) { return r.type === 'public' ? ico('globe') : r.type === 'clan' ? '<b class="mono">' + mono(r.name) + '</b>' : ico('users'); }
  function paintChat() {
    var v = $('#view'); if (!v) return;
    v.innerHTML = '<section class="card chat' + (C.room ? ' has-room' : '') + '"><aside class="rooms"><div class="rooms-h"><h3>الشات</h3><button class="btn sm-btn" data-act="new-group">' + ico('plus') + ' جروب</button></div><ul id="room-list"></ul>'
      + '<p class="muted small rules">خليك لطيف، وخلي الكلام عن التعلم. شريف بيراجع الرسايل اللي بيتعملها ريبورت.</p></aside><div class="convo" id="convo"></div></section>';
    paintRoomList(); paintConvo();
    if (!C.rooms) loadRooms();
  }
  function paintRoomList() {
    var el = $('#room-list'); if (!el) return;
    if (!C.rooms) { el.innerHTML = '<li class="muted small pad">بيحمّل…</li>'; return; }
    el.innerHTML = C.rooms.map(function (r) {
      return '<li><button class="room' + (C.room && C.room.id === r.id ? ' on' : '') + '" data-act="open-room" data-id="' + r.id + '"><span class="room-ic">' + roomIcon(r) + '</span><span class="room-main"><b dir="auto">' + esc(roomName(r)) + '</b><small dir="auto">' + (r.last ? esc(r.last.who.split(' ')[0]) + ': ' + esc(r.last.text === '🎤 Voice message' ? 'رسالة صوتية' : r.last.text) : r.type === 'group' ? 'قول أهلًا لجروبك' : 'لسه مفيش رسايل') + '</small></span>'
        + (r.unread ? '<i class="unread">' + r.unread + '</i>' : '') + '</button></li>';
    }).join('') + (C.rooms.filter(function (r) { return r.type === 'group'; }).length ? '' : '<li class="muted small pad">اعمل جروب خاص من ٣ لـ ٥ زمايل وذاكروا سوا.</li>');
  }
  function linkify(t) { return esc(t).replace(/\bhttps?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener nofollow" dir="ltr">' + u + '</a>'; }); }
  function msgHtml(m, prev) {
    var mine = m.who.id === S.data.me.id;
    var grouped = prev && prev.who.id === m.who.id && (new Date(m.at) - new Date(prev.at)) < 5 * 60000;
    var quote = m.reply && !m.gone ? '<button class="m-quote" data-act="goto-msg" data-id="' + m.reply.id + '"><b dir="auto">' + esc(m.reply.who) + '</b><span dir="auto">' + (m.reply.gone ? 'الرسالة اتمسحت' : m.reply.text ? esc(m.reply.text) : '🎤 رسالة صوتية') + '</span></button>' : '';
    var voice = m.audio ? '<audio controls preload="none" src="' + esc(m.audio) + '"></audio><div class="v-acts">' + (m.dur ? '<span class="v-dur" dir="ltr">' + fmtDur(m.dur) + '</span>' : '')
      + (C.ai.transcribe && !m.transcript ? '<button class="v-btn" data-act="transcribe" data-id="' + m.id + '">' + ico('text', 'tiny') + ' اكتبها نص</button>' : '')
      + (mine && C.ai.feedback ? '<button class="v-btn" data-act="feedback" data-id="' + m.id + '">' + ico('spark', 'tiny') + ' رأي في كلامي</button>' : '') + '</div>'
      + (m.transcript ? '<p class="v-text" dir="ltr">' + esc(m.transcript) + '</p>' : '') : '';
    var st = m.kind === 'sticker' && C.stickers[m.media] ? '<div class="sticker" dir="ltr"><span class="st-e">' + C.stickers[m.media][0] + '</span><span class="st-t">' + esc(C.stickers[m.media][1]) + '</span></div>' : '';
    var gif = m.kind === 'gif' && m.media ? '<img class="gif" src="' + esc(m.media) + '" alt="GIF" loading="lazy">' : '';
    var trl = m.translated && !m.gone ? '<div class="m-tr">' + (m.orig ? '<button class="m-tr-b" data-act="show-orig" data-id="' + m.id + '">' + ico('globe2', 'tiny') + ' مترجمة من العربي</button>' + (C.showOrig === m.id ? '<p class="m-orig" dir="auto">' + esc(m.orig) + '</p>' : '') : '<span>' + ico('globe2', 'tiny') + ' translated</span>') + '</div>' : '';
    var body = m.gone ? '<em class="muted">الرسالة اتمسحت</em>' : quote + voice + st + gif + (m.body ? '<p dir="auto">' + linkify(m.body) + '</p>' : '') + trl;
    var rs = (C.reacts[m.id] || []).filter(function (r) { return r.n > 0; });
    var reacts = !m.gone && rs.length ? '<div class="reacts">' + rs.map(function (r) { return '<button class="rx' + (r.mine ? ' on' : '') + '" data-act="msg-react" data-id="' + m.id + '" data-e="' + r.e + '">' + r.e + ' <b>' + r.n + '</b></button>'; }).join('') + '</div>' : '';
    var menu = m.gone ? '' : '<span class="m-acts"><button class="icon-btn sm" data-act="react-pick" data-id="' + m.id + '" title="ريأكشن" aria-label="ريأكشن">' + ico('smile') + '</button><button class="icon-btn sm" data-act="msg-reply" data-id="' + m.id + '" title="رد" aria-label="رد على الرسالة">' + ico('reply') + '</button>'
      + (mine && !m.audio && C.ai.feedback && /[a-z]{2}/i.test(m.body) ? '<button class="icon-btn sm" data-act="feedback" data-id="' + m.id + '" title="رأي في الإنجليزي بتاعي" aria-label="رأي في الإنجليزي بتاعي">' + ico('spark') + '</button>' : '') + (mine || C.admin ? '<button class="icon-btn sm" data-act="msg-del" data-id="' + m.id + '" title="امسح" aria-label="امسح الرسالة">' + ico('trash') + '</button>' : '') + (!mine ? '<button class="icon-btn sm" data-act="msg-report" data-id="' + m.id + '" title="ريبورت" aria-label="اعمل ريبورت للرسالة">' + ico('flag') + '</button>' : '') + '</span>';
    return '<li class="msg' + (mine ? ' mine' : '') + (grouped ? ' grouped' : '') + '" data-id="' + m.id + '">' + (grouped ? '<span class="av-gap"></span>' : avatar(m.who, 32))
      + '<div class="m-col"><div class="bubble' + (st || gif ? ' media' : '') + '">' + (grouped ? '' : '<div class="m-head"><b dir="auto">' + esc(m.who.name) + '</b>' + (m.who.class ? '<span class="cl">' + ico(cls(m.who.class).ic, 'tiny') + '</span>' : '') + '<time dir="ltr">' + new Date(m.at).toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit' }) + '</time></div>') + body + '</div>' + reacts + '</div>' + menu + '</li>';
  }
  function paintMessages(keepScroll) {
    var list = $('#msgs'); if (!list) return;
    var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = (C.msgs.length >= 50 && !C.noOlder ? '<li class="center"><button class="btn ghost sm-btn" data-act="older">اعرض رسايل أقدم</button></li>' : '')
      + (C.msgs.length ? C.msgs.map(function (m, i) { return msgHtml(m, C.msgs[i - 1]); }).join('') : '<li class="empty-chat muted">لسه مفيش رسايل. ابدأ إنت الكلام.</li>');
    if (!keepScroll || nearBottom) list.scrollTop = list.scrollHeight;
  }
  function paintConvo() {
    var el = $('#convo'); if (!el) return;
    var r = C.room;
    if (!r) { el.innerHTML = '<div class="convo-empty"><div class="big-ic">' + ico('chat') + '</div><p class="muted">اختار شات من القايمة.</p></div>'; return; }
    var head = '<div class="convo-h"><button class="icon-btn back" data-act="close-room" aria-label="ارجع للشاتات">' + ico('back') + '</button><span class="room-ic">' + roomIcon(r) + '</span><div class="room-main"><b dir="auto">' + esc(roomName(r)) + '</b><small>'
      + (r.type === 'public' ? 'كل اللي في التراكر' : r.type === 'clan' ? 'الكلان بتاعك' : r.members.map(function (m) { return esc(m.name.split(' ')[0]); }).join('، ')) + '</small></div>'
      + (r.type === 'group' ? (r.owner === S.data.me.id && r.members.length < 5 ? '<button class="btn sm-btn" data-act="group-add">' + ico('plus') + ' ضيف</button>' : '') + '<button class="btn ghost sm-btn" data-act="group-leave">اخرج</button>' : '') + '</div>';
    var canSend = C.admin || (C.enabled && !(C.muted && C.muted >= S.data.today));
    var composer = canSend
      ? '<div class="tray" id="tray" hidden></div><div class="tr-panel" id="tr-panel" hidden></div><p class="ar-hint" id="ar-hint" hidden>' + ico('globe2', 'tiny') + ' الشات بالإنجليزي: اكتب بالعربي عادي ودوس إرسال، وهنترجمها لك وتشوفها قبل ما تتبعت.</p><form class="composer" id="f-msg"><button type="button" class="icon-btn stk" data-act="tray" aria-label="ستيكرز و GIFs" title="ستيكرز و GIFs">' + ico('smile') + '</button><button type="button" class="icon-btn mic" data-act="mic" aria-label="سجّل رسالة صوتية" title="رسالة صوتية">' + ico('mic') + '</button><div class="rec-bar" hidden><span class="rec-dot"></span><span id="rec-t" dir="ltr">0:00 / 2:00</span><button type="button" class="btn ghost sm-btn" data-act="rec-cancel">إلغاء</button><button type="button" class="btn primary sm-btn" data-act="rec-send">ابعت الصوت</button></div>'
        + '<textarea id="m-body" rows="1" maxlength="1000" placeholder="اكتب رسالة… (Enter للإرسال)" dir="auto" aria-label="الرسالة"></textarea><button class="btn primary send-btn" type="submit" aria-label="ابعت">' + ico('send') + '</button></form>'
      : '<p class="note">' + (C.enabled ? 'تقدر تقرا الشات بس مش هتقدر تبعت لحد ' + fmtDay(C.muted) + '.' : 'الشات متوقف دلوقتي.') + '</p>';
    el.innerHTML = head + '<ul class="msgs" id="msgs"><li class="loading"><span class="spin"></span></li></ul>' + (canSend ? '<div class="reply-bar" id="reply-bar" hidden></div>' : '') + composer;
    paintReplyBar();
    var ta = $('#m-body');
    if (ta) {
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(); } });
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; var h = $('#ar-hint'); if (h) h.hidden = !(C.ai.translate && needsTranslation(ta.value)); });
      $('#f-msg').addEventListener('submit', function (e) { e.preventDefault(); sendMsg(); });
    }
    if (C.msgs.length && C.msgs.roomId === r.id) paintMessages(); else loadMsgs();
  }
  function loadMsgs() {
    var r = C.room; if (!r) return;
    api('/chat/rooms/' + r.id + '/messages').then(function (j) { if (!C.room || C.room.id !== r.id) return; C.msgs = j.messages; C.msgs.roomId = r.id; C.reacts = j.reacts || {}; C.noOlder = j.messages.length < 50; paintMessages(); markRoomRead(r.id); if (C.pendingMsg) { var pm = C.pendingMsg; C.pendingMsg = 0; setTimeout(function () { gotoMsg(pm); }, 50); } }, function (x) { toast(x.message, 'bad'); });
  }
  function pollMsgs() {
    var r = C.room; if (!r || S.view !== 'chat' || document.hidden) return;
    var last = C.msgs.length ? C.msgs[C.msgs.length - 1].id : 0;
    api('/chat/rooms/' + r.id + '/messages', { query: { after: last } }).then(function (j) {
      if (!C.room || C.room.id !== r.id) return;
      if (mergeReacts(j.reacts) && !j.messages.length) { paintMessages(true); return; }
      if (!j.messages.length) return;
      var have = {}; C.msgs.forEach(function (m) { have[m.id] = 1; });
      j.messages.forEach(function (m) { if (!have[m.id]) C.msgs.push(m); });
      paintMessages(true); markRoomRead(r.id);
    }, function () {});
  }
  function markRoomRead(id) { (C.rooms || []).forEach(function (x) { if (x.id === id) x.unread = 0; }); S.chatUnread = (C.rooms || []).reduce(function (a, x) { return a + x.unread; }, 0); paintRoomList(); }
  function sendMsg(form, extra) {
    var ta = $('#m-body'), r = C.room; if (!r) return;
    var body = extra ? '' : ta ? ta.value.trim() : '';
    if (!body && !form && !extra) return;
    if (!form && !extra && needsTranslation(body)) { if (C.ai.translate) translateFlow(body); else if (!C.admin) toast('الشات بالإنجليزي بس.', 'bad'); if (C.ai.translate || !C.admin) return; }
    var last = C.msgs.length ? C.msgs[C.msgs.length - 1].id : 0;
    var rt = C.replyTo ? C.replyTo.id : 0;
    if (form && rt) form.append('reply_to', rt);
    var opt = form ? { method: 'POST', form: form } : { method: 'POST', body: Object.assign({ body: body, reply_to: rt }, extra || {}) };
    opt.query = { after: last };
    if (ta && !form && !extra) { ta.value = ''; ta.style.height = 'auto'; }
    api('/chat/rooms/' + r.id + '/messages', opt).then(function (j) {
      var have = {}; C.msgs.forEach(function (m) { have[m.id] = 1; });
      j.messages.forEach(function (m) { if (!have[m.id]) C.msgs.push(m); });
      C.replyTo = null; paintReplyBar();
      paintMessages(); loadRooms();
      if (j.xp > 0) { toast('+' + j.xp + ' XP' + (extra && extra.orig ? ' · اكتب بالإنجليزي على طول عشان تاخد XP أكتر' : ''), 'good'); if (S.data && S.data.xp) { S.data.xp.total += j.xp; S.data.xp.today += j.xp; S.data.xp.base += j.xp; } }
    }, function (x) { if (ta && !form && !extra) ta.value = body; toast(x.message, 'bad'); });
  }
  function confirmLeave() { return window.confirm('Leave your party?'); }
  function openRoom(id) {
    var r = (C.rooms || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    C.room = r; C.msgs = []; C.replyTo = null; S.view = 'chat';
    if (!$('#convo')) renderView(); else { paintRoomList(); paintConvo(); $('.chat').classList.add('has-room'); }
  }
  /* voice notes */
  function startRec() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) return toast('المتصفح ده مش بيدعم الرسايل الصوتية.', 'bad');
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
          fd.append('body', ''); fd.append('duration', Math.min(120, Math.round((Date.now() - t0) / 1000))); toast('بنبعت الرسالة الصوتية…'); sendMsg(fd);
        }
        C.rec = null;
      };
      rec.start();
      var bar = $('.rec-bar'), ta = $('#m-body'), mic = $('.mic'); if (bar) bar.hidden = false; if (ta) ta.hidden = true; if (mic) mic.hidden = true;
      C.rec.tick = setInterval(function () { var s = Math.floor((Date.now() - t0) / 1000), el = $('#rec-t'); if (el) el.textContent = fmtDur(s) + ' / 2:00'; if (s >= 115 && el) el.classList.add('red'); if (s >= 120) { C.rec.send = true; rec.stop(); } }, 250);
    }, function () { toast('اسمح للمتصفح يستخدم المايك عشان تبعت رسايل صوتية.', 'bad'); });
  }
  /** Reactions from the server for the latest messages; returns true if anything changed. */
  function mergeReacts(map) {
    if (!map) return false;
    var before = JSON.stringify(C.reacts), first = C.msgs.length ? C.msgs[0].id : 0;
    var lowest = Infinity;
    Object.keys(map).forEach(function (k) { lowest = Math.min(lowest, +k); });
    C.msgs.forEach(function (m) { if (m.id >= first && !map[m.id] && C.reacts[m.id] && m.id >= lowest) delete C.reacts[m.id]; });
    Object.keys(map).forEach(function (k) { C.reacts[k] = map[k]; });
    return JSON.stringify(C.reacts) !== before;
  }
  function paintTray(tab) {
    var t = $('#tray'); if (!t) return;
    C.tray = tab;
    t.hidden = !tab;
    if (!tab) { t.innerHTML = ''; return; }
    var tabs = '<div class="tray-tabs"><button data-act="tray-tab" data-tab="st" aria-pressed="' + (tab === 'st') + '">ستيكرز</button>' + (C.gifsOn ? '<button data-act="tray-tab" data-tab="gif" aria-pressed="' + (tab === 'gif') + '">GIFs</button>' : '') + '<button class="icon-btn sm" data-act="tray-close" aria-label="اقفل">' + ico('x') + '</button></div>';
    if (tab === 'st') {
      t.innerHTML = tabs + '<div class="st-grid" dir="ltr">' + Object.keys(C.stickers).map(function (k) { return '<button class="st-pick" data-act="send-sticker" data-s="' + k + '"><span class="st-e">' + C.stickers[k][0] + '</span><span class="st-t">' + esc(C.stickers[k][1]) + '</span></button>'; }).join('') + '</div>';
    } else {
      t.innerHTML = tabs + '<input id="gif-q" placeholder="Search GIFs in English…" dir="ltr" autocomplete="off"><div class="gif-grid" id="gif-grid"><span class="spin"></span></div><p class="giphy small muted" dir="ltr">Powered by GIPHY</p>';
      loadGifs('');
    }
  }
  var gifT;
  function loadGifs(q) {
    api('/chat/gifs', { query: { q: q } }).then(function (j) {
      var g = $('#gif-grid'); if (!g) return;
      g.innerHTML = j.gifs.length ? j.gifs.map(function (x) { return '<button class="gif-pick" data-act="send-gif" data-url="' + esc(x.url) + '"><img src="' + esc(x.preview) + '" alt="' + esc(x.title) + '" loading="lazy"></button>'; }).join('') : '<p class="muted small">No GIFs found.</p>';
    }, function (x) { var g = $('#gif-grid'); if (g) g.innerHTML = '<p class="err small">' + esc(x.message) + '</p>'; });
  }
  function openReactPick(id) {
    $$('.react-pick').forEach(function (p) { p.remove(); });
    var li = $('#msgs li[data-id="' + id + '"] .m-col'); if (!li) return;
    li.insertAdjacentHTML('beforeend', '<div class="react-pick">' + C.reactList.map(function (e) { return '<button data-act="msg-react" data-id="' + id + '" data-e="' + e + '">' + e + '</button>'; }).join('') + '</div>');
  }
  /** More than 30% of the letters are Arabic script. */
  /** Arabic that needs translating: Arabic letters, or Franco-Arabic written with English letters ("ana 3ayez aroo7"). */
  var FRANCO = "ana enta enty inta inti ente ehna e7na howa hwa heya hya homa 3ayez 3ayz 3awz 3awez 3ayza 3awza msh mesh mish mush ezay ezayak ezayek izzay izay keda kda kedda leh leih lih feen fein fen ahe aho ahy ahoh yalla yala yallah khalas 5alas 5las tayeb tayyeb tyb awy awi 2awy 2awi kteer ktir ketir wallahi wallah walahy walla inshallah insha2allah habibi 7abibi habibti mafeesh mafish mafesh delwa2ty dlwa2ty delwa2ti delwaqti dlw2ty bokra bokhra embare7 emba re7 ba2a ba2ah bardo kaman kman lessa lissa 3shan 3ashan alashan 3alashan 3la 3ala ma3a m3a ma3ak ma3aya ya3ni yaani ya3ny yani tamam mashy mashi ma3lesh maalesh ma3lsh shokran shukran sho2ran a7san ahsan gamed gamda gameel 7elw helw 7lw ra7 roo7 aroo7 bta3 bta3y bta3ak beta3 ezayko 3amel 3amla 3amlen 3amlo eih izayak sabah masa2 lazem lazm momken mmkn".split(' ').reduce(function (o, w) { o[w] = 1; return o; }, {});
  function francoArabic(t) {
    var words = String(t).toLowerCase().match(/[a-z0-9']+/g) || [], hits = 0, mixed = 0;
    words.forEach(function (w) { if (FRANCO[w]) hits++; if (/[a-z][2356789]|[2356789][a-z]/.test(w) && !/^[0-9]+(st|nd|rd|th|s|am|pm|k|m)$/.test(w)) mixed++; });
    return mixed > 0 || hits >= 2 || (hits >= 1 && words.length <= 3);
  }
  function needsTranslation(t) { return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(String(t)) || francoArabic(t); }
  function isArabic(t) {
    var ar = (String(t).match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    var all = (String(t).match(/\p{L}/gu) || []).length;
    return all > 0 && ar / all > 0.3;
  }
  /** Arabic (any dialect) → English preview. The student can edit it, then sends the English. */
  function translateFlow(text) {
    var p = $('#tr-panel'); if (!p) return;
    paintTray('');
    p.hidden = false;
    p.innerHTML = '<div class="tr-h"><b>' + ico('globe2', 'tiny') + ' بنترجم رسالتك…</b></div><span class="spin"></span>';
    api('/chat/translate', { method: 'POST', body: { text: text } }).then(function (j) {
      p.innerHTML = '<div class="tr-h"><b>' + ico('globe2', 'tiny') + ' رسالتك بالإنجليزي</b><button class="icon-btn sm" data-act="tr-cancel" aria-label="إلغاء">' + ico('x') + '</button></div>'
        + '<p class="tr-orig" dir="auto">' + esc(text) + '</p>'
        + '<textarea id="tr-en" rows="2" dir="ltr" maxlength="1000">' + esc(j.english) + '</textarea>'
        + (j.phrases && j.phrases.length ? '<div class="tr-ph"><span class="small muted">اتعلم من رسالتك:</span>' + j.phrases.map(function (x) { return '<span class="tr-chip"><b dir="ltr">' + esc(x.en) + '</b> ' + esc(x.ar) + '</span>'; }).join('') + '</div>' : '')
        + '<div class="tr-btns"><button class="btn ghost sm-btn" data-act="tr-cancel">ارجع عدّل</button>' + (C.admin ? '<button class="btn ghost sm-btn" data-act="tr-raw">Send as written (admin)</button>' : '') + '<button class="btn primary sm-btn" data-act="tr-send">ابعتها بالإنجليزي</button></div>';
      C.trOrig = text;
      var en = $('#tr-en'); if (en) en.focus();
    }, function (x) { p.hidden = true; toast(x.message, 'bad'); });
  }
  function fmtDur(s) { return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function msgById(id) { return C.msgs.filter(function (m) { return m.id === id; })[0]; }
  function paintReplyBar() {
    var b = $('#reply-bar'); if (!b) return;
    var m = C.replyTo;
    b.hidden = !m;
    b.innerHTML = m ? '<span class="rb-main">' + ico('reply', 'tiny') + ' بترد على <b dir="auto">' + esc(m.who.name.split(' ')[0]) + '</b>: <span dir="auto">' + (m.body ? esc(m.body.slice(0, 80)) : m.kind === 'sticker' && C.stickers[m.media] ? C.stickers[m.media].join(' ') : m.kind === 'gif' ? 'GIF' : '🎤 رسالة صوتية') + '</span></span><button class="icon-btn sm" data-act="reply-cancel" aria-label="إلغاء الرد">' + ico('x') + '</button>' : '';
  }
  function gotoMsg(id) {
    var li = $('#msgs li[data-id="' + id + '"]');
    if (!li) return toast('الرسالة دي قديمة. اضغط "اعرض رسايل أقدم".');
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li.classList.add('flash'); setTimeout(function () { li.classList.remove('flash'); }, 1600);
  }
  /** Private feedback on your own voice or text message: corrections linked to the skill tree. */
  function openFeedback(id, btn) {
    var m = msgById(id); if (!m) return;
    if (btn) busy(btn, true, 'بيحلل…');
    api('/chat/messages/' + id + '/feedback', { method: 'POST' }).then(function (j) {
      if (btn) busy(btn, false);
      if (j.transcript) { m.transcript = j.transcript; paintMessages(true); }
      var fb = j.feedback || {}, errs = fb.errors || [];
      openModal(mHead('رأي في الإنجليزي بتاعك', 'محدش غيرك بيشوف الرأي ده')
        + '<div class="stack fb-modal" dir="ltr">'
        + (j.transcript ? '<p class="small muted" dir="rtl">اللي اتسمع من رسالتك:</p><p class="note" dir="ltr">' + esc(j.transcript) + '</p>' : '')
        + (fb.praise ? '<p class="fb-good">' + esc(fb.praise) + '</p>' : '')
        + (errs.length ? '<ul class="fb-errs">' + errs.map(function (e) {
          return '<li><div class="fb-fix"><s>' + esc(e.wrong) + '</s> → <b>' + esc(e.right || '(remove)') + '</b></div>'
            + (e.locked ? '<p class="small muted">🔒 The explanation unlocks with <b>' + esc(e.skillName) + '</b> in your skill tree.</p>' : (e.why ? '<p class="small">' + esc(e.why) + '</p>' : '') + (e.why_ar ? '<p class="small muted" dir="rtl">' + esc(e.why_ar) + '</p>' : ''))
            + '</li>';
        }).join('') + '</ul>' : '<p class="fb-good">No mistakes found. Great job! ✓</p>')
        + (fb.tip ? '<p class="note"><b>Next time:</b> ' + esc(fb.tip) + '</p>' : '')
        + (j.transcript ? '<p class="small muted" dir="rtl">الرأي على الكلام نفسه (القواعد والكلمات)، مش على النطق.</p>' : '')
        + (fb.app ? '<a class="btn ghost" href="' + esc(fb.app) + '" target="_blank" rel="noopener" dir="rtl">شجرة المهارات</a>' : '')
        + '</div>', 'narrow');
    }, function (x) { if (btn) busy(btn, false); toast(x.message, 'bad'); });
  }
  /* groups */
  function openPeoplePicker(title, maxPick, exclude, onDone, withName) {
    var picked = {};
    openModal(mHead(title, 'اختار لحد ' + maxPick + (maxPick > 2 ? ' زمايل' : maxPick === 2 ? ' زميلين' : ' زميل'))
      + '<div class="stack">' + (withName ? '<label class="f">اسم الجروب<input id="g-name" maxlength="40" placeholder="مثلًا: شادووينج الصبح" dir="auto"></label>' : '')
      + '<div class="f"><span>ضيف زمايلك</span><input id="g-q" placeholder="دوّر بالاسم" autocomplete="off" dir="auto"><div class="chips" id="g-picked"></div><ul class="pick-list" id="g-list"><li class="muted small pad">بيحمّل…</li></ul></div>'
      + '<p class="err" role="alert"></p><button class="btn primary wide" id="g-go" disabled>' + (withName ? 'اعمل الجروب' : 'ضيف للجروب') + '</button></div>', 'narrow');
    var list = [], t;
    function draw() {
      var n = Object.keys(picked).length;
      $('#g-picked').innerHTML = Object.keys(picked).map(function (id) { return '<button class="chip-x" data-pick="' + id + '">' + esc(picked[id].name) + ' ' + ico('x', 'tiny') + '</button>'; }).join('');
      $('#g-list').innerHTML = list.filter(function (p) { return exclude.indexOf(p.id) < 0; }).map(function (p) { return '<li><button class="pick" data-pick="' + p.id + '"' + (!picked[p.id] && n >= maxPick ? ' disabled' : '') + '>' + avatar(p, 28) + '<span dir="auto">' + esc(p.name) + '</span><em>' + ico(picked[p.id] ? 'check' : 'plus') + '</em></button></li>'; }).join('') || '<li class="muted small pad">ملقيناش حد.</li>';
      $('#g-go').disabled = withName ? n < 2 : n < 1;
      $('#g-go').textContent = (withName ? 'اعمل الجروب' : 'ضيف للجروب') + (n ? ' (' + (withName ? n + 1 : n) + ')' : '');
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
    openModal(mHead('ريبورت للرسالة', 'شريف هيراجعها. صاحب الرسالة مش هيعرف مين عمل الريبورت.')
      + '<div class="stack"><label class="f">إيه المشكلة؟ <small>اختياري</small><input id="rep-why" maxlength="200" placeholder="مثلًا: قلة أدب، سبام، خارج الموضوع" dir="auto"></label><button class="btn primary" data-act="do-report" data-id="' + id + '">ابعت الريبورت</button></div>', 'narrow');
  }

  /* ------------------------------------------------------------ share to Skool */
  function shareText() {
    var s = S.data.stats;
    return (s.dayFinished ? 'اليوم ' + s.studyDays + ' خلص · ' : '') + 'ستريك ' + s.streak + ' يوم'
      + (s.todayMinutes ? ' · ' + hm(s.todayMinutes) + ' النهارده' : '') + ' · Level ' + s.level + ' ' + s.title
      + (S.data.clan ? ' · ' + S.data.clan.name : '') + '\n#SawaTracker';
  }
  function drawCard() {
    var s = S.data.stats, c = document.createElement('canvas'); c.width = c.height = 1080;
    var g = c.getContext('2d');
    g.fillStyle = '#0F0F10'; g.fillRect(0, 0, 1080, 1080);
    var D = function (w, sz) { return w + ' ' + sz + 'px Changa, "IBM Plex Sans Arabic", sans-serif'; };
    var B = function (w, sz) { return w + ' ' + sz + 'px "IBM Plex Sans Arabic", sans-serif'; };
    g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#FFFFFF'; g.font = D(800, 64); g.fillText('سوا', 1000, 150);
    g.direction = 'ltr'; g.textAlign = 'right'; g.fillStyle = '#8A8584'; g.font = 'italic 40px "Instrument Serif", Georgia, serif'; g.fillText('Sawa Tracker', 860, 150);
    g.direction = 'rtl'; g.textAlign = 'right'; g.fillStyle = '#8A8584'; g.font = B(600, 40); g.fillText(S.data.me.name, 1000, 300);
    g.fillStyle = '#FFFFFF'; g.font = D(800, 300); g.direction = 'ltr'; g.fillText(String(s.streak), 1000, 590);
    g.direction = 'rtl'; g.font = D(800, 60); g.fillText('يوم ستريك', 1000, 690);
    g.direction = 'ltr'; g.fillStyle = '#E3262B'; g.font = 'italic 64px "Instrument Serif", Georgia, serif'; g.fillText('keep going.', 1000, 780);
    var stats = [[hm(s.todayMinutes), 'النهارده'], [hm(s.totalMinutes), 'المجموع'], ['Lv ' + s.level, s.title]];
    stats.forEach(function (st, k) {
      var x = 1000 - k * 316; g.fillStyle = '#2A2A2B'; g.fillRect(x - 290, 840, 290, 150);
      g.direction = 'rtl'; g.textAlign = 'right'; g.fillStyle = '#FFFFFF'; g.font = D(800, 56); g.fillText(st[0], x - 28, 912); g.fillStyle = '#8A8584'; g.font = B(400, 30); g.fillText(st[1], x - 28, 962);
    });
    return c;
  }
  function openShare() {
    var make = function () {
      var c = drawCard(), u = c.toDataURL('image/png');
      openModal(mHead('شارك على Skool', 'حطها في بوست الـ check-in بتاع النهارده') + '<img class="share-img" src="' + u + '" alt="كارت تقدمك">'
        + '<textarea id="share-t" rows="3" readonly dir="auto">' + esc(shareText()) + '</textarea>'
        + '<div class="row-btns"><button class="btn" data-act="copy-share">' + ico('copy') + ' انسخ الكلام</button><a class="btn" href="' + u + '" download="sawa-progress-' + S.data.today + '.png">' + ico('download') + ' احفظ الصورة</a><a class="btn primary" href="' + esc(S.data.skoolUrl) + '" target="_blank" rel="noopener">افتح Skool ' + ico('ext', 'tiny') + '</a></div>');
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(make);
  }

  /* ------------------------------------------------------------ after actions */
  function afterAction(j, msg) {
    if (j.data) S.data = j.data;
    renderDash(); loadBoard(); loadFeed('new');
    if (j.levelUp) celebrate('مبروك! وصلت Level ' + j.levelUp + '.');
    else if (j.badges && j.badges.length) { celebrate('وسام جديد: ' + badgeInfo(j.badges[0]).name); }
    else if (msg) toast(msg, 'good');
  }
  function celebrate(msg) {
    toast(msg, 'good');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = document.createElement('div'); box.className = 'confetti';
    for (var i = 0; i < 36; i++) { var p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = ['#0F0F10', '#E3262B', '#8A8584', '#FFFFFF'][i % 4]; p.style.animationDelay = Math.random() * 0.4 + 's'; box.appendChild(p); }
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
        api('/class', { method: 'POST', body: { class: el.dataset.class } }).then(function (j) { S.data = j; closeModal(); start(); toast('أهلًا يا ' + cls(el.dataset.class).ar + '!', 'good'); }, function (x) { $$('.class-card').forEach(function (b) { b.disabled = false; }); toast(x.message, 'bad'); });
        break;
      case 'change-class': renderClassPick(true); break;
      case 'log-activity': openLogActivity(); break;
      case 'log-day': openLogDay(); break;
      case 'quick-min': var t = $('#' + el.dataset.target); if (t) t.value = el.dataset.min; break;
      case 'del-log':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'امسح؟'; el.classList.add('confirm'); setTimeout(function () { if (el.isConnected) { el.dataset.confirm = ''; el.innerHTML = ico('x'); el.classList.remove('confirm'); } }, 3000); break; }
        api('/log/' + el.dataset.id, { method: 'DELETE' }).then(function (j) { afterAction(j, 'اتمسح'); }, function (x) { toast(x.message, 'bad'); });
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
        var stx = $('#share-t'); stx.select();
        (navigator.clipboard ? navigator.clipboard.writeText(stx.value) : Promise.reject()).then(function () { toast('اتنسخ. حطه في Skool!', 'good'); }, function () { document.execCommand('copy'); toast('اتنسخ', 'good'); });
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
        openPeoplePicker('جروب خاص جديد', 4, [], function (ids, nm, fail) {
          api('/chat/groups', { method: 'POST', body: { name: nm, members: ids } }).then(function (j) { closeModal(); C.rooms = j.rooms; S.view = 'chat'; openRoom(j.room); toast('الجروب اتعمل', 'good'); }, function (x) { fail(x.message); });
        }, true);
        break;
      case 'group-add':
        var have = C.room.members.map(function (m) { return m.id; });
        openPeoplePicker('ضيف لـ ' + C.room.name, 5 - have.length, have, function (ids, nm, fail) {
          api('/chat/groups/' + C.room.id + '/members', { method: 'POST', body: { members: ids } }).then(function (j) { closeModal(); C.rooms = j.rooms; var rid = C.room.id; C.room = null; openRoom(rid); toast('اتضافوا', 'good'); }, function (x) { fail(x.message); });
        }, false);
        break;
      case 'group-leave':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'متأكد تخرج؟'; el.classList.add('danger-btn'); break; }
        api('/chat/groups/' + C.room.id + '/leave', { method: 'POST' }).then(function (j) { C.rooms = j.rooms; C.room = null; C.msgs = []; paintChat(); toast('خرجت من الجروب'); }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'msg-del':
        if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'امسح؟'; el.classList.add('confirm'); break; }
        api('/chat/messages/' + el.dataset.id, { method: 'DELETE' }).then(function () { C.msgs.forEach(function (m) { if (m.id === +el.dataset.id) { m.gone = true; m.body = ''; m.audio = ''; } }); paintMessages(true); }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'msg-report': reportMsg(+el.dataset.id); break;
      case 'do-report':
        busy(el, true, 'بيتبعت…');
        api('/chat/messages/' + el.dataset.id + '/report', { method: 'POST', body: { reason: $('#rep-why').value.trim() } }).then(function () { closeModal(); toast('شكرًا. شريف هيراجعها.', 'good'); }, function (x) { busy(el, false); toast(x.message, 'bad'); });
        break;
      case 'mic': startRec(); break;
      case 'rd-find': raidFind(el); break;
      case 'sr-job': srPost('/raids/job', { job: el.dataset.job }).then(function () { toast('Welcome, ' + RD.rpg.jobs[el.dataset.job][1] + '!', 'good'); }, function () {}); break;
      case 'sr-jobs': RD.rpg.job = ''; paintRaids(); break;
      case 'sr-forge': srForge(el.dataset.slot); break;
      case 'sr-buy': srPost('/raids/buy', { slot: el.dataset.slot, grade: +el.dataset.grade }).then(function () { srForge(el.dataset.slot); toast('Equipped!', 'good'); }, function () {}); break;
      case 'sr-up': srPost('/raids/upgrade', { slot: el.dataset.slot }).then(function () { srForge(el.dataset.slot); toast('Upgraded!', 'good'); }, function () {}); break;
      case 'sr-skill': srPost('/raids/skill', { skill: el.dataset.id }).catch(function () {}); break;
      case 'sr-wanted': srWanted(el); break;
      case 'sr-hunt': closeModal(); raidBattle(0, +el.dataset.ev); break;
      case 'w-open': if (cfg.game) startGame(); else openWorld('map'); break;
      case 'w-list': openWorld('map'); break;
      case 'w-help': worldHelp(); break;
      case 'w-tour': worldTour(+(el.dataset.i || 0)); break;
      case 'w-squest': busy(el, true, 'Saving…'); api('/quest', { method: 'POST', body: { note: (($('#w-qnote') || {}).value || '').trim() } }).then(function (j) { if (j.data) S.data = j.data; return api('/world'); }).then(function (w) { W.data = w; paintWorld(); repaintPanel(); toast('Quest done, coins added', 'good'); }, function (x) { busy(el, false); toast(x.message, 'bad'); }); break;
      case 'w-back': if (gameRunning()) window.SawaGame.stop(false); S.view = 'community'; renderView(); break;
      case 'w-tab': W.tab = el.dataset.tab; paintWorld(); break;
      case 'w-travel': wPost('/world/travel', { town: +el.dataset.town }); break;
      case 'w-fight': worldBattle('/world/fight', { kind: 'monster', m: +el.dataset.m }); break;
      case 'w-boss': worldBattle('/world/fight', { kind: 'boss' }); break;
      case 'w-claim': wPost('/world/claim', { quest: el.dataset.q }, function (j) { toast('+' + j.got.coins + ' 🪙' + (j.got.elixirs ? ' +' + j.got.elixirs + ' ⚗' : ''), 'good'); }); break;
      case 'w-go': if (el.dataset.go === 'map') { if (gameRunning()) closeModal(); else { W.tab = 'map'; paintWorld(); } } else { if (gameRunning()) { closeModal(); window.SawaGame.stop(false); S.view = 'community'; renderView(); } emit({ go: el.dataset.go }); } break;
      case 'w-room': if (gameRunning()) { closeModal(); window.SawaGame.stop(false); } S.view = 'chat'; C.pending = +el.dataset.id; renderView(); loadRooms(); break;
      case 'w-create': wPost('/party/create', { name: ($('#w-pname') || {}).value || '' }); break;
      case 'w-join': wPost('/party/join', { party: +el.dataset.id }); break;
      case 'w-decline': wPost('/party/decline', { party: +el.dataset.id }); break;
      case 'w-leave': if (confirmLeave()) wPost('/party/leave'); break;
      case 'w-kick': wPost('/party/kick', { user: +el.dataset.id }); break;
      case 'w-invite': worldInvite(); break;
      case 'w-inv': closeModal(); wPost('/party/invite', { user: +el.dataset.id }, function () { toast('Invitation sent!', 'good'); }); break;
      case 'w-pboss': wPost('/party/boss'); break;
      case 'w-hit': worldBattle('/party/hit'); break;
      case 'w-weekly': wPost('/party/weekly', {}, function () { toast('+40 🪙 +1 ⚗', 'good'); }); break;
      case 'w-live': api('/party/live').then(function (j) { liveOpen(j.live); }, function (x) { toast(x.message, 'bad'); }); break;
      case 'w-live-start': api('/party/live/start', { method: 'POST' }).then(function (j) { liveOpen(j.live); }, function (x) { toast(x.message, 'bad'); }); break;
      case 'w-live-join': api('/party/live/join', { method: 'POST' }).then(function (j) { W.live = j.live; W.liveAt = Date.now(); paintLive(); }, function (x) { toast(x.message, 'bad'); }); break;
      case 'w-live-ans': $$('[data-act="w-live-ans"]').forEach(function (b) { b.disabled = true; }); el.classList.add('primary'); api('/party/live/answer', { method: 'POST', body: { i: +el.dataset.i, choice: +el.dataset.k } }).then(function (j) { W.live = j.live; W.liveAt = Date.now(); paintLive(); }, function (x) { toast(x.message, 'bad'); }); break;
      case 'rd-start': closeModal(); raidBattle(+el.dataset.id); break;
      case 'rd-buy': api('/raids/shop', { method: 'POST', body: { item: el.dataset.item } }).then(function (j) { RD = j; paintRaids(); toast('Bought!', 'good'); }, function (x) { toast(x.message, 'bad'); }); break;
      case 'tray': paintTray(C.tray ? '' : 'st'); break;
      case 'tray-tab': paintTray(el.dataset.tab); break;
      case 'tray-close': paintTray(''); break;
      case 'send-sticker': paintTray(''); sendMsg(null, { kind: 'sticker', media: el.dataset.s }); break;
      case 'send-gif': paintTray(''); sendMsg(null, { kind: 'gif', media: el.dataset.url }); break;
      case 'react-pick': openReactPick(+el.dataset.id); break;
      case 'msg-react':
        $$('.react-pick').forEach(function (p) { p.remove(); });
        api('/chat/messages/' + el.dataset.id + '/react', { method: 'POST', body: { i: C.reactList.indexOf(el.dataset.e) } }).then(function (j) {
          var id = +el.dataset.id; C.reacts[id] = (j.reacts && j.reacts[id]) || []; paintMessages(true);
        }, function (x) { toast(x.message, 'bad'); });
        break;
      case 'tr-cancel': var tp = $('#tr-panel'); if (tp) { tp.hidden = true; tp.innerHTML = ''; } C.trOrig = ''; break;
      case 'tr-send':
        var en2 = $('#tr-en'), eng = en2 ? en2.value.trim() : '';
        if (!eng) break;
        if (needsTranslation(eng) && !C.admin) { toast('الرسالة لازم تتبعت بالإنجليزي.', 'bad'); break; }
        var mb2 = $('#m-body'); if (mb2) { mb2.value = ''; mb2.style.height = 'auto'; }
        var tp2 = $('#tr-panel'); if (tp2) { tp2.hidden = true; tp2.innerHTML = ''; }
        var ah = $('#ar-hint'); if (ah) ah.hidden = true;
        sendMsg(null, { body: eng, orig: C.trOrig || '' }); C.trOrig = '';
        break;
      case 'tr-raw': var raw = C.trOrig || ''; var tpr = $('#tr-panel'); if (tpr) { tpr.hidden = true; tpr.innerHTML = ''; } var mbr = $('#m-body'); if (mbr) { mbr.value = ''; mbr.style.height = 'auto'; } if (raw) sendMsg(null, { body: raw }); C.trOrig = ''; break;
      case 'show-orig': C.showOrig = C.showOrig === +el.dataset.id ? 0 : +el.dataset.id; paintMessages(true); break;
      case 'msg-reply': C.replyTo = msgById(+el.dataset.id) || null; paintReplyBar(); var mb = $('#m-body'); if (mb) mb.focus(); break;
      case 'reply-cancel': C.replyTo = null; paintReplyBar(); break;
      case 'goto-msg': gotoMsg(+el.dataset.id); break;
      case 'transcribe':
        busy(el, true, 'بيكتب…');
        api('/chat/messages/' + el.dataset.id + '/transcript', { method: 'POST' }).then(function (j) { var m = msgById(+el.dataset.id); if (m) m.transcript = j.transcript; paintMessages(true); }, function (x) { busy(el, false); toast(x.message, 'bad'); });
        break;
      case 'feedback': openFeedback(+el.dataset.id, el); break;
      case 'notif-world': closeModal(); S.view = 'world'; openWorld(el.dataset.tab); if (el.dataset.live) api('/party/live').then(function (j) { if (j.live && j.live.id) liveOpen(j.live); }, function () {}); break;
      case 'notif-room': closeModal(); C.pendingMsg = +el.dataset.msg; S.view = 'chat'; if (C.room && C.room.id === +el.dataset.room) { renderView(); } else { C.pending = +el.dataset.room; if (C.rooms) { var pr = C.pending; C.pending = 0; openRoom(pr); } else loadRooms(); } break;
      case 'rec-cancel': if (C.rec) { C.rec.send = false; C.rec.rec.stop(); } break;
      case 'rec-send': if (C.rec) { C.rec.send = true; C.rec.rec.stop(); } break;
      case 'notifs': openNotifs(); break;
      case 'settings': openSettings(); break;
      case 'pick-avatar': $('#av-file').click(); break;
      case 'save-goal':
        busy(el, true);
        api('/profile', { method: 'POST', body: { goal: parseInt($('#goal').value, 10) || 30 } }).then(function (j) { S.data = j.data; closeModal(); renderDash(); toast('الهدف اتحفظ', 'good'); }, function (x) { busy(el, false); toast(x.message, 'bad'); });
        break;
    }
  });
  root.addEventListener('input', function (e) {
    if (e.target.id === 'gif-q') { clearTimeout(gifT); var q = e.target.value.trim(); gifT = setTimeout(function () { loadGifs(q); }, 350); }
  });
  root.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.act === 'rd-peace') { api('/raids/peace', { method: 'POST', body: { on: e.target.checked } }).then(function (j) { RD = j; paintRaids(); }, function (x) { toast(x.message, 'bad'); }); return; }
    if (e.target.id === 'av-file' && e.target.files[0]) uploadAvatar(e.target.files[0]);
    if (e.target.id === 'remind') {
      api('/reminder', { method: 'POST', body: { hour: e.target.value } }).then(function (j) { S.data = j.data; toast(e.target.value === '' ? 'التذكير اتقفل' : 'التذكير اتحفظ. هنبعتلك بس في الأيام اللي لسه مذاكرتش فيها.', 'good'); }, function (x) { toast(x.message, 'bad'); });
    }
  });
  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'f-quest') return;
    e.preventDefault();
    var btn = e.target.querySelector('button'); busy(btn, true);
    api('/quest', { method: 'POST', body: { note: $('#q-note').value.trim() } }).then(function (j) { afterAction(j, 'المهمة خلصت! +' + j.sp + ' 🪙'); }, function (x) { busy(btn, false); toast(x.message, 'bad'); });
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
    if (EMB && !S.data.me.class && !S.autoClass) { S.autoClass = 1; return api('/class', { method: 'POST', body: { class: 'warrior', auto: 1 } }).then(function (j) { S.data = j; start(); }, function () { renderClassPick(false); }); }
    if (!S.data.me.class) return renderClassPick(false);
    if (!S.data.me.avatar && !S.data.isAdmin) { S.photoGate = true; return renderPhotoGate(); }
    var h = (location.hash || '').slice(1);
    S.view = ['home', 'clan', 'chat'].indexOf(h) >= 0 ? h : 'home';
    if (/^chat-\d+$/.test(h)) { S.view = 'chat'; C.pending = +h.slice(5); }
    if (EMB) { S.view = S.wantView || cfg.view || 'today'; emit({ ready: true, data: S.data }); }
    renderDash(); loadBoard(); loadFeed(); loadRooms(); poll();
  }
  if (EMB) {
    window.SawaTracker = {
      show: function (v) {
        if (gameRunning()) window.SawaGame.stop(false); // switching tabs leaves the walkable world
        if (!S.data || S.photoGate || !S.data.me.class) { S.wantView = v; return; }
        if (S.view !== 'chat' && v !== 'chat' && C.rec) { C.rec.send = false; C.rec.rec.stop(); }
        S.view = v; renderView();
        if (v === 'chat') loadRooms();
        if (v === 'community') { loadBoard(); paintFeed(); }
      },
      act: function (a) { var map = { log: openLogActivity, day: openLogDay, notifs: openNotifs, settings: openSettings }; if (S.data && map[a]) map[a](); },
      data: function () { return S.data; },
      refresh: function () { return api('/me').then(function (j) { S.data = j; if (['today', 'me'].indexOf(S.view) >= 0) renderView(); return j; }); }
    };
  }
  if (cfg.status === 'guest') renderGuest();
  else if (cfg.status === 'pending') renderWaiting(false);
  else if (cfg.status === 'denied') renderWaiting(true);
  else api('/me').then(function (j) { S.data = j; start(); }, function (x) {
    $('#app').innerHTML = '<div class="center-card card"><div class="big-ic">' + ico('info') + '</div><h2>التراكر مش راضي يفتح</h2><p class="muted">' + esc(x.message) + '</p><button class="btn primary" onclick="location.reload()">جرب تاني</button></div>';
  });
})();
