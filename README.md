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

- **Help requests / teach a word:** tap any word in the game and choose **Ask the caravan**, ask on the caravan board, or ask one student from their echo. Others answer in English (6+ words, no Arabic or Franco). The asker taps **This helped**: the helper gets +20 XP and 10 coins (up to 5 a day), plus a thank-you in the game.
- **The caravanserai:** one weekly community project. Bricks come from right battle answers, lanterns from review cards, and lessons from explanations marked helpful. Goals scale with last week's active students. When all three are full, everyone who brought something gets 30 coins, 1 elixir and 20 XP.
- **Guides:** students with 2 town bosses or level 5 can volunteer. Every new member (who joined less than 14 days ago) is matched with a guide for 2 weeks. Three pair steps reward both: first question answered, 3 study days together, and the newcomer's first boss. Finishing all three gives the title *Guide of the Road*.
- **Quests:** daily "Answer a traveller's question", weekly "Help 2 travellers".
