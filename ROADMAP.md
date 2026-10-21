# Sawa Tracker – planned features

## Chat XP: farm skill points by writing English (planned, not built)

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
