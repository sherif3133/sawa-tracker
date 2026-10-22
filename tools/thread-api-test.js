/* API test of chat threads and the daily reply goal on the local Playground (needs the test-only mu-plugins).
   node tools/thread-api-test.js <idA> <idB> <idC> */
const B = 'http://127.0.0.1:9410';
const NS = B + '/wp-json/sawa-tracker/v1';
const [A, Bb, Cc] = process.argv.slice(2).map(Number);
let fails = 0;
const ok = (cond, label, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); if (!cond) fails++; };
const api = async (as, path, body) => {
  const r = await fetch(NS + path + (path.includes('?') ? '&' : '?') + 'as=' + as, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { raw: t.slice(0, 400) }; }
};
const util = (q) => fetch(B + '/?' + q).then((r) => r.json());
const free = async (u) => { await util('rt=gap&u=' + u); };

(async () => {
  for (const u of [A, Bb, Cc]) await util('rt=reset&u=' + u);
  const room = (await api(A, '/chat/rooms')).rooms.find((r) => r.type === 'public').id;
  const say = async (u, body, extra) => { await free(u); return api(u, '/chat/rooms/' + room + '/messages', Object.assign({ body }, extra || {})); };
  const inThread = async (u, id, body, extra) => { await free(u); return api(u, '/chat/threads/' + id, Object.assign({ body }, extra || {})); };

  const root = await say(A, 'What do you do to remember new words every day?');
  const rootId = root.messages[root.messages.length - 1].id;
  ok(root.ok && !root.reply, 'plain message is not a reply', root.reply);

  let r = await inThread(Bb, rootId, 'I write them in a notebook and review them at night.');
  ok(r.ok && r.reply && r.reply.counted && r.reply.n === 1, 'thread reply to someone else counts', r.reply);
  ok(r.reply && r.reply.xp === 2, '+2 XP for the reply', r.reply && r.reply.xp);

  r = await inThread(Bb, rootId, 'ok ok');
  ok(r.ok && r.reply && !r.reply.counted && r.reply.why === 'short', 'near-empty reply does not count', r.reply);

  r = await inThread(Bb, rootId, 'I write them in a notebook and review them at night.');
  ok(r.ok && r.reply && r.reply.why === 'same', 'same text again does not count', r.reply);

  r = await inThread(Bb, rootId, 'Sometimes I record myself saying the new words.');
  ok(r.reply && r.reply.counted, 'a second, different reply counts', r.reply);
  await util('rt=slow&u=' + Bb); // only the 1.2 s rate limit, not the 20 s reply gap
  r = await api(Bb, '/chat/threads/' + rootId, { body: 'I also use flashcards on my phone every morning.' });
  ok(r.ok && r.reply && r.reply.why === 'fast', 'reply burst (no 20 s gap) does not count', r.reply);

  r = await inThread(A, rootId, 'That is a great idea, thanks for sharing it!');
  ok(r.ok && r.reply && r.reply.counted, 'thread starter answering another student counts', r.reply);

  r = await say(A, 'I am answering my own message here.', { reply_to: rootId });
  ok(r.ok && !r.reply, 'quoted reply to yourself does not count', r.reply);

  r = await say(Cc, 'I watch short videos and pause on new words.', { reply_to: rootId });
  ok(r.ok && r.reply && r.reply.counted, 'quoted reply in the main chat counts', r.reply);

  r = await inThread(Cc, rootId, '', { kind: 'sticker', media: 'thanks' });
  ok(r.ok && r.reply && r.reply.why === 'sticker', 'sticker in a thread does not count', r.reply);

  r = await inThread(Cc, rootId, 'ana 3ayez aroo7 delwa2ty');
  ok(!r.ok && /الإنجليزي/.test(r.message || ''), 'Franco in a thread is blocked (English only)', r.message);

  // Per-person limit: C replies to A 4 times today already? (1 so far) → 3 more count, the 5th does not.
  const lines = ['Reading stories helps me a lot too.', 'Songs are good for remembering phrases.', 'My teacher says repetition is the key.', 'Writing sentences with new words works well.'];
  const res = [];
  for (const l of lines) { const x = await say(Cc, l, { reply_to: rootId }); res.push(x.reply && (x.reply.counted ? 'ok' : x.reply.why)); }
  ok(JSON.stringify(res) === '["ok","ok","ok","person"]', 'max 4 counted replies to the same person a day', res);

  // Main timeline hides thread replies; meta shows the count.
  const main = await api(A, '/chat/rooms/' + room + '/messages');
  ok(!main.messages.some((m) => m.thread), 'thread replies are not in the main timeline');
  const meta = main.threads && main.threads[rootId];
  ok(meta && meta.n === 7 && meta.following, 'thread meta: 7 replies, starter follows', meta);

  // Unread: B follows (wrote in it). A writes → B has 1 unread, and a bell notification only once per batch.
  const before = await api(Bb, '/chat/rooms');
  r = await inThread(A, rootId, 'Do you use any app for that?');
  r = await inThread(A, rootId, 'I am looking for a good one.');
  const after = await api(Bb, '/chat/rooms');
  const th = after.threads.find((t) => t.id === rootId);
  ok(th && th.unread >= 2, 'follower sees unread replies in the thread inbox', th);
  ok(after.unread >= before.unread + 2, 'nav unread includes thread replies', [before.unread, after.unread]);
  const d = await api(Bb, '/me');
  const bells = (d.notifications || []).filter((n) => n.type === 'thread_reply');
  ok(bells.length >= 1, 'follower got a bell notification', bells.length);

  const open = await api(Bb, '/chat/threads/' + rootId);
  ok(open.root && open.root.id === rootId && open.messages.length === 9 && open.following, 'thread opens with root and replies', open.messages && open.messages.length);
  const after2 = await api(Bb, '/chat/rooms');
  ok((after2.threads.find((t) => t.id === rootId) || {}).unread === 0, 'opening the thread marks it read');

  r = await api(Bb, '/chat/threads/' + rootId + '/follow', { on: 0 });
  await inThread(A, rootId, 'Anyone else want to share a tip?');
  const after3 = await api(Bb, '/chat/rooms');
  ok(!after3.threads.find((t) => t.id === rootId), 'unfollowed thread leaves the inbox');

  r = await api(Bb, '/chat/threads/' + open.messages[0].id);
  ok(r.ok === false, 'a thread reply cannot start its own thread', r.message);

  // Goal: B reaches 10 → bonus.
  await util('rt=reset&u=' + Bb);
  let last;
  for (let i = 0; i < 10; i++) {
    const asker = [A, Cc, 1][i % 3]; // 3 people: at most 4 counted replies to the same person a day
    const q = await say(asker, 'Question number ' + i + ': what is your favourite English word?');
    const qid = q.messages[q.messages.length - 1].id;
    last = await inThread(Bb, qid, 'My favourite word is probably ' + ['serendipity', 'cozy', 'breeze', 'journey', 'whisper', 'sunrise', 'brave', 'gentle', 'harbor', 'lantern'][i] + ' because it sounds nice.');
  }
  ok(last.reply && last.reply.n === 10 && last.reply.bonus && last.reply.xp === 27 && last.replyGoal.done, 'reaching 10 replies gives the bonus', last.reply);
  const w = await util('rt=slow&u=' + Bb);
  ok((w.world.c.reply || 0) >= 10, 'weekly reply quest moves', w.world.c);

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
