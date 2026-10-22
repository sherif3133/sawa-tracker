# Sawa Tracker

A game-like study tracker for Sawa English learners: streaks, habit health, levels, classes and skills, clans, a weekly community boss, badges, chat, a live feed and a leaderboard.

Use it by adding `[sawa_tracker]` to a WordPress page.

## English version (inside the one Sawa English app)

The app at `/app` (Sawa Lens plugin) shows the tracker in English, from `assets/app-en.js`, a generated copy of
`assets/app.js`. The Arabic tracker (`app.js`, used on its own page with `?classic`) is the source.

After changing any Arabic text in `app.js`:
1. `node tools/i18n.js extract` lists every Arabic string in `tools/ar-strings.json`.
2. Add English for any new strings to `tools/en.json`, keeping HTML, spaces and punctuation exactly.
3. `node tools/i18n.js build` writes `assets/app-en.js`. Strings with no translation stay Arabic, and the count is printed.

## The caravan (co-op on the Silk Road)

`includes/class-coop.php`. It works asynchronously, because students study at different times of day. It opens with the game at stage 3.

- **Calls for help:** stuck on a boss or a monster? Call the caravan (from the boss, after a lost fight, or the caravan board); clanmates and your guide get a notification. Other students answer when they play: a 4-question support battle of their own English. Their role turns right answers into help for your next fight against that foe: Guardian = shield, Healer = heals when you are low, Mage = a fireball at the start, Trickster = frost (the first attacks miss). Helpers stand beside you in the arena; they get +10 XP and 5 coins at once, +20 XP and 15 coins when you win. One open call each, 3 helpers, 3 helps a day.
- **Roles and styles** (`includes/class-combat.php`): Guardian, Healer, Mage, Trickster (picked in the character creator), plus monster attack styles (poison, mana theft, spooking, heavy blows you can see coming, fire, swooping, riddles).
- **The caravanserai:** one weekly community project. Bricks come from right battle answers, lanterns from review cards, and battles won together (calls for help that ended in a win). Goals scale with last week's active students. When all three are full, everyone who brought something gets 30 coins, 1 elixir and 20 XP.
- **Guides:** students with 2 town bosses or level 5 can volunteer. Every new member (who joined less than 14 days ago) is matched with a guide for 2 weeks. Three pair steps reward both: first question answered, 3 study days together, and the newcomer's first boss. Finishing all three gives the title *Guide of the Road*.
- **Quests:** daily "Answer a traveller's question", weekly "Help 2 travellers".

## Chat threads and the reply goal

`includes/class-social.php` (threads), `includes/class-replies.php` (the goal). Works in the app chat (`app.js`) and the in-game chat (CHAT in `game.js`).

- **Threads:** any main-chat message can start one (💬 button, or "Reply" in the game). Under the message: "N replies · last reply 5m ago". It opens beside the chat on a computer and full screen on a phone, with its own reply box; in the game it opens inside the chat panel. Thread replies use `thread_id` in the messages table and don't show in the main timeline.
- **Following and unread:** the starter and everyone who writes in a thread follow it (table `thread_reads`); a Follow button turns it on or off. Unread replies show on the message, the room and in "Your threads", and count in the chat badge. A follower gets one bell notification per batch of new replies (only if they had read everything before).
- **Reply goal:** reply to 10 messages from other people a day. A reply counts when it answers someone else (a quoted reply, or a message in a thread where someone else wrote) with 3+ English words (2 different) or a 5-second voice note. Not counted: replies to yourself, stickers/GIFs, the same text twice, replies less than 20 s apart, more than 4 to the same person a day. +2 XP each (capped with chat XP), +25 XP and 10 coins at 10. A progress pill shows in the chat, the thread and the game chat; the game's Today panel shows it under the plan; each counted reply moves the weekly quest "Reply to 25 messages".
- **@mentions:** type `@` and a few letters; a list of people who can read that chat shows up (app chat, thread box and game chat). The mentioned student gets a bell notification, the message is highlighted for them, the room shows an **@** badge, and a mention inside a thread makes them follow it. Up to 10 names a message (`mentions` column: `,12,15,`).
  - `@everyone`: admins only; notifies everyone who can read that chat.
  - `@clan`: the clan leader (or an admin), in the clan chat only, once per 10 minutes; notifies the whole clan. The leader is picked in wp-admin → Sawa Tracker → Clans (column **Leader**); with no pick, the member with the most study days leads.
- **Tests (local Playground):** `node tools/mention-api-test.js <idA> <idB> <idC>`, `node tools/thread-api-test.js <idA> <idB> <idC>` and, from `language-lens/tools`, `node ../../sawa-tracker/tools/thread-ui-test.js <outdir> <idA> <idB>` (needs the test-only mu-plugin `sawa-replies-test.php`).

## Beta feedback

`includes/class-feedback.php` and `assets/feedback.js`. Approved members see a **💬 Beta** button on every screen of the app and in the game. Turn it on or off in wp-admin → Sawa Tracker → Beta feedback.

- **Reactions:** I don't understand, What does this do?, I like this, I don't like this, Boring, Something broke, Idea. Each one asks a follow-up question in the style of *The Mom Test* (what were you trying to do, what did you expect), in English and Arabic. The note can be in either language.
- **👆 Show me:** the next tap picks the button, card or map the student means. It works inside the tracker and the game too, and the tap itself does nothing else.
- **Saved automatically:** the screen (app tab, or in the game: map, battle, panel, dialog), the town, the battle question, level, HP, stamina, stage, device and version.
- **Short questions after first-time moments.** The game sends `sawa:moment` events (first battle, first boss, first time on the caravan board, first level up), and one week after the first visit the button asks once. At most one question a day.
- **Script errors** from Sawa files are reported as kind `error`.
- **Reward:** 5 coins for the first feedback of the day.
- **Admin page:** counts per screen × reaction, filters, CSV (with a BOM for Arabic in Excel). Setting **Planned** or **Fixed** with a reply notifies the student.
- **Wounds** (`includes/class-wounds.php`): every full day without studying (5+ minutes) takes a quarter of a hero's health; after 4 days the hero falls and can't fight. Studying ends the wound. Clanmates can help a little with mana: a heal (+10%, +25% from a Healer, two a day) or a revive for a fallen hero (two clanmates; a Healer's counts twice). While a clanmate is hurt for 2+ days or fallen, everyone else in the clan has one fight less a day (two at most). Hurt clanmates lie at the inn in the game, and the Today card says who. Clanmates gone for more than 14 days count as away (no penalty).
