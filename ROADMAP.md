# Sawa Tracker – planned features

Built on 22 Oct 2026: the reply goal is an optional step in the app's Today plan (Sawa Lens `today_plan`), and chat English is checked automatically: messages queue per learner (`sawa_lens_chatq`), an hourly job checks each learner once a day in one batch (cap 150 a day, switch in Sawa Lens settings), errors go to the error log with source "chat", right uses pay the improvement bonus (`record_uses`), and the learner gets a private `chat_review` notification. Chat XP per message and the per-skill trends were already in place (`class-xp.php`, `Sawa_Lens_Skills::trends`). Also built: the weekly best helper in the chat (most counted replies, 5+; feed shout-out, weekly report, 30 coins + elixir + 30 XP + the title Helper of the Week) and voice notes in the daily check (up to two a day transcribed, saved on the message, and checked as speaking, source "voice").

## Learning in the Silk Road: the learning road (phase 1 built 22 Oct 2026)

Goal (Sherif): learners study inside the game instead of going to YouTube, then the web app, then reporting on Skool. They get a sense of progress and see where everyone is.

- **Phase 1 (built, 2.11.0):** five camps between each town's east gate and its boss: 📺 video → 🎵 song → 📖 story → 🃏 review cards → ✍️ write, once a day (`class-road.php`, `ROAD` in `game.js`). Each camp opens the Sawa Lens feature as a panel in the game: video quizzes (YouTube IFrame player), My songs (fill the gaps), Stories for you (plus "Adapt to my level" for your own text), the day's cards, and the writing checker. Finishing a camp opens the next, and Sawa Lens counts the study (XP, minutes, tracker log). The whole road gives +25 coins, an elixir, 20 XP and a feed line. Characters stand at their camp and others see "📖 reading" over them (`st` in `/play/sync`). Monsters never attack at a camp.
- **Phase 2 (planned):** a curated video and song library. The admin adds YouTube videos and songs with a transcript (their own captions or a pasted transcript) and a quiz, prepared once. Students get a tap-able transcript in sync with the official player, on phones without the extension.
- **Phase 3 (planned):** weekly or seasonal chapters across towns, group challenges at camps, and an admin map showing where every student is.

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
