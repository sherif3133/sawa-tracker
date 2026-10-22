/* API test of chat @mentions on the local Playground (needs the test-only mu-plugins).
   node tools/mention-api-test.js <idA> <idB> <idC>   (user 1 is the admin) */
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
const name = async (id) => (await api(id, '/me')).me;
const bells = async (u, type) => ((await api(u, '/me')).notifications || []).filter((n) => n.type === type);

(async () => {
  const pub = (await api(A, '/chat/rooms')).rooms.find((r) => r.type === 'public').id;
  const nb = (await name(Bb)).name;
  const say = async (u, room, body, extra) => { await util('rt=slow&u=' + u); return api(u, '/chat/rooms/' + room + '/messages', Object.assign({ body }, extra || {})); };

  const before = (await bells(Bb, 'mention')).length;
  let r = await say(A, pub, 'Hi @' + nb + ', do you want to practise speaking today?', { mentions: [Bb, Cc] });
  const msg = r.messages && r.messages[r.messages.length - 1];
  ok(r.ok && msg && msg.tags && msg.tags.length === 1 && msg.tags[0] === nb, 'mention keeps only names that are in the text', msg && msg.tags);
  ok((await bells(Bb, 'mention')).length === before + 1, 'mentioned student gets a bell notification');
  const rooms = await api(Bb, '/chat/rooms');
  ok(rooms.rooms.find((x) => x.id === pub).mentions >= 1, 'room shows an @ badge for the mentioned student', rooms.rooms.find((x) => x.id === pub).mentions);
  const seen = await api(Bb, '/chat/rooms/' + pub + '/messages');
  ok(seen.messages.find((m) => m.id === msg.id).pingsMe === true, 'message is marked as pinging the mentioned student');

  r = await say(A, pub, '@everyone come to the speaking club!');
  ok(!r.ok && /admin/i.test(r.message + '') || /للأدمن/.test(r.message || ''), 'students cannot use @everyone', r.message);
  const allBefore = (await bells(Cc, 'mention_all')).length;
  r = await say(1, pub, '@everyone the speaking club starts in 10 minutes!');
  ok(r.ok, 'admin can use @everyone', r.message);
  ok((await bells(Cc, 'mention_all')).length === allBefore + 1, '@everyone notifies other students');

  const c = await util('rt=clan&ids=' + A + ',' + Bb);
  r = await say(Bb, c.room, '@clan let us study together tonight.');
  ok(!r.ok && /قائد الكلان/.test(r.message || ''), 'only the clan leader can use @clan', r.message);
  r = await say(A, pub, '@clan let us study together tonight.');
  ok(!r.ok && /شات الكلان/.test(r.message || ''), '@clan works in the clan chat only', r.message);
  const clanBefore = (await bells(Bb, 'mention_clan')).length;
  r = await say(A, c.room, '@clan let us study together tonight.');
  ok(r.ok, 'clan leader can use @clan in the clan chat', r.message);
  ok((await bells(Bb, 'mention_clan')).length === clanBefore + 1, '@clan notifies clan members');
  r = await say(A, c.room, '@clan one more thing: bring your notebooks.');
  ok(!r.ok && /١٠ دقايق/.test(r.message || ''), '@clan at most once per 10 minutes', r.message);
  const cr = (await api(A, '/chat/rooms')).rooms.find((x) => x.id === c.room);
  ok(cr && cr.leader === A, 'clan room tells who the leader is', cr && cr.leader);

  // Mention inside a thread: the mentioned student follows the thread.
  const q = await say(A, pub, 'What is your favourite English film?');
  const qid = q.messages[q.messages.length - 1].id;
  await util('rt=slow&u=' + A);
  r = await api(A, '/chat/threads/' + qid, { body: 'What do you think, @' + nb + '?', mentions: [Bb] });
  ok(r.ok, 'mention in a thread is sent', r.message);
  const inbox = (await api(Bb, '/chat/rooms')).threads.find((t) => t.id === qid);
  ok(inbox && inbox.unread >= 1, 'mentioned student now follows the thread', inbox);

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
