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
