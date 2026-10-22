# Sawa Tracker – planned features

Built on 22 Oct 2026: the reply goal is an optional step in the app's Today plan (Sawa Lens `today_plan`), and chat English is checked automatically: messages queue per learner (`sawa_lens_chatq`), an hourly job checks each learner once a day in one batch (cap 150 a day, switch in Sawa Lens settings), errors go to the error log with source "chat", right uses pay the improvement bonus (`record_uses`), and the learner gets a private `chat_review` notification. Chat XP per message and the per-skill trends were already in place (`class-xp.php`, `Sawa_Lens_Skills::trends`). Also built: the weekly best helper in the chat (most counted replies, 5+; feed shout-out, weekly report, 30 coins + elixir + 30 XP + the title Helper of the Week) and voice notes in the daily check (up to two a day transcribed, saved on the message, and checked as speaking, source "voice").

## Learning in the Silk Road: the learning road (phase 1 built 22 Oct 2026)

Goal (Sherif): learners study inside the game instead of going to YouTube, then the web app, then reporting on Skool. They get a sense of progress and see where everyone is.

- **Phase 1 (built, 2.11.0):** five camps between each town's east gate and its boss: 📺 video → 🎵 song → 📖 story → 🃏 review cards → ✍️ write, once a day (`class-road.php`, `ROAD` in `game.js`). Each camp opens the Sawa Lens feature as a panel in the game: video quizzes (YouTube IFrame player), My songs (fill the gaps), Stories for you (plus "Adapt to my level" for your own text), the day's cards, and the writing checker. Finishing a camp opens the next, and Sawa Lens counts the study (XP, minutes, tracker log). The whole road gives +25 coins, an elixir, 20 XP and a feed line. Characters stand at their camp and others see "📖 reading" over them (`st` in `/play/sync`). Monsters never attack at a camp.
- **Phase 2 (built, 2.12.0 + Sawa Lens 0.20.0):** Video quizzes have a type: 📺 Video or 🎵 Song (a music video whose transcript is the lyrics). The transcript is the admin's own captions or one pasted from YouTube; nothing is scraped. In the game it sits under the official YouTube player. The line being said is marked, a tapped word pauses the video and opens the word card, and a tapped time jumps there. It works on phones without the extension. Songs open at the 🎵 camp next to the student's own My songs.
- **Phase 3 (built, 2.12.0):** a weekly chapter (only this week's is written: the beta changes often, so no content is planned more than about 7 days ahead). Walking the whole road on 3, 5 or 7 days of the week gives +30 🪙; +50 🪙, an elixir and the title Road Walker; or +100 🪙, an elixir and the title Pilgrim of the Silk Road. A community goal counts the camps everyone finishes together (at least 40, or 12 per student of last week); everyone with 3+ camps that week gets +30 🪙 and an elixir. The 📜 button on the strip shows both. Admin: Sawa Tracker → Silk Road map lists every student by town, with the camp they are at now, today's road and their week.
- **Bonus camps and radio (built, 2.13.0 + Sawa Lens 0.21.0):** 📱 Reels: English Shorts and TikToks in their official players. Sherif picks them, or they are found by the student's topics (English titles only). Each has a "What did they say?" check, and memes come as official Reddit embeds. Scrolling Shorts on your own YouTube with Language Lens counts too (1,000 words heard). 📰 Read the internet: newsletter RSS (title, a short preview, how hard it is for you), Reddit and Quora as links. You open the post itself, then write "I read it" and one thing you learned. 📻 Radio: fun podcasts only (The Totally Football Show, No Such Thing As A Fish, Wait Wait... Don't Tell Me!; Sherif: no BBC- or TED-style lessons) instead of the game's music, with shared captions made once per 30 seconds ($0.003 a minute) and a monthly budget ($5). Live stations only with permission. Admin: Video quizzes → Reels, reading & radio.
- **Action fights, first version (built, 2.15.0):** fights with the roaming monsters are an action game (`ACTION` in game.js, `class-action.php`). You move with the stick or WASD, dodge red marks, hit when the gold ring is small (combos), and use one role move (Guardian shield, Healer heal, Mage blast, Trickster dash). English is the power word after every 4 good hits (up to 3 a fight): right fires the ultimate, wrong costs nothing. Rewards and missed words work like before. Each camp finished today gives one more ⚔ fight. Bosses, duels, raids and party bosses stay quiz fights for now.
- **Word storyline, band 1 (built, Sawa Lens 0.22.0):** 📚 on the strip shows the 500 most frequent words (from language-lens freq.json): how many you know (easy ones for your level, marked known, or a card held 21+ days) and 10 new ones a day to add to your cards. Nothing blocks travel yet. Later bands and gates: decide after Sherif tries it (no planning further ahead in the beta).
- **Later ideas:** chapters with their own map events (a caravan that moves on the map as the community goal fills), clan road challenges, and the camp list in the weekly report.

## Reply goal in the app's Today plan (built 22 Oct 2026)

The daily reply goal (`Sawa_Tracker_Replies::goal()`) shows in the chat, the game chat and the game's Today panel. The Today plan in `/app` comes from Sawa Lens (`today` endpoint), so adding it there as a plan step needs a change in `sawa-lens`: read the goal from the tracker and add a "Reply to 10 messages" step that links to the chat. Also possible later: @mentions in threads, and a weekly "best helper in the chat" shout-out.

## Chat XP: farm skill points by writing English (built 22 Oct 2026)

Requested by Sherif, 21 Oct 2026. Part of the skill tree ecosystem (Sawa Lens plugin: skill tree, writing checker, practice).

**Goal:** learners earn XP for every English word, phrase and sentence they write in the tracker chat. They earn
more XP for making progress on the points AI feedback highlighted. Chatting in English often should feel like
"farming" XP.

**How it should work**
- Each English chat message earns base XP by length: words, phrases and full sentences. Use a daily cap and
  anti-spam checks: no XP for repeated or copy-pasted text, Arabic-only messages or one-letter messages.
- Messages go, batched (not one AI call per message), through the same error analysis as the Sawa Lens writing
  checker. The analysis covers grammar points from the skill tree plus mechanics: punctuation, apostrophes,
  capital letters and spelling.
- Every error is logged with its skill id, its source (`chat` / `write`) and the date, in the same error log the
  writing checker uses. That log tracks, per skill, whether the error rate is going down over time (errors per
  100 words, or per obligatory context, week by week).
- **Bonus XP for improvement.** A skill the AI flagged earlier pays extra when the learner later uses it
  correctly, or when its error rate drops week on week. Examples: "it's/its: 0 mistakes in 5 uses this week
  (+50 XP)", and reaching mastery on a skill tree node.
- Progress shows in the tracker and the skill tree: a trend per error type ("Apostrophes: 6 → 2 → 0 errors per
  100 words") and XP history.
- Feedback in chat should be gentle and private: corrections are visible only to the writer, never to the room.
- Minimal teacher involvement: everything is automatic.
- Voice messages in chat could later feed the speaking/pronunciation check the same way.

**Hooks needed:** an action in `Sawa_Tracker_Social::send()` (e.g. `sawa_tracker_message_sent`) that Sawa Lens
listens to. Sawa Lens queues the text for analysis and awards XP back via a tracker filter or API.

## Silk Road: camp stories from "Stories for you" (built 22 Oct 2026, 2.10.8)

Built: Rawi the storyteller stands by the inn in every town (only when Sawa Lens stories are available). He offers today's story or the next series chapter (opens it in the app reader), and after a student has finished a story that day he gives a gift once a day: +20 coins and 1 elixir (`/world/story`). Test: `tools/storyteller-test.js`. The original idea:

Sawa Lens 0.18.0 has "Stories for you" (beta): short graded readers about each learner's quiz interests, including chapter series that open one chapter a day (`app/readers`, `app/readers/next` with `{series}`, `app/readers/done`). Idea for the game: at a caravan camp, a merchant NPC tells "a story by the fire", which opens the learner's next chapter (or today's story) in the reader. Finishing it in the game gives a small in-game reward on top of the reader XP (for example 1 elixir or coins), once a day. Needs: an NPC/camp interaction in the world, a call to `SawaLens.api('readers/next', …)`, and opening the reader view (or an in-game page that reuses its quick check). Only for players in the readers beta (`SAWA_LENS.readers`).

## Feedback & Dev in the app (built 22 Oct 2026, 2.14.0)

Built: Home → Your things → **Feedback & Dev** in `/app` (`assets/board.js`, `includes/class-board.php`, REST `/ideas*` and `/roadmap`). Roadmap tab: live / in progress / planned / later / won't do from `data/roadmap.json` (the same data `tools/features-md.js` turns into the top-level FEATURES.md; wp-admin → Sawa Tracker → Roadmap moves items and exports the JSON). Board tab: ideas, bugs and requests from students (beta feedback rows with `pub = 1`), ▲/▼ votes (one per student, can change), short reply threads, Sherif's replies marked Official, "Hide my name", sort by top / new / status, link to a roadmap item. Admins moderate in the app (status + official reply, hide/show posts and replies, merge, edit) or in Beta feedback (📢 On the board, roadmap id). Clarity check before posting (board and 💬 Beta button): vague bugs and ideas get "tell us more" with guiding questions in the student's language, AI via `Sawa_Lens_AI::feedback_clarity` (cheap model, cached) or a word-count check; "Post anyway" after one try. Test: `tools/board-test.js` (31 checks, phone + computer).

Ideas: notify the author when someone replies to their post; a "Similar posts" hint while typing, to avoid duplicates; a screenshot upload on posts.
