# Trivia: the haircut

Status: proposal, 2026-10-25. Serves P3 (we pick the interesting questions) and P1 (the superlatives) in puttingupnumbers' `specs/user-stories.spec.md`, and S1 (what's special about my team). Drew's framing: Active | All-Time | Trivia, where active and all-time show streaks of at most two conditions and everything with more goes under Trivia.

## The problem, measured

Every list on the site is the list rule over the mine: a run is listed when its team leads the field under some definition of up to four chips. That floor admits a lot. Measured on the 2026-10-24 build (`dist/crowns/`, the sub-streaks dropped, the shipped knobs):

| | active | all-time |
|---|---|---|
| listed runs, median team | 513 | 1,279 |
| with 3 or 4 conditions | 80% | 84% |
| carrying a trivia-tier chip (full moon, weekday, mascot, color, month, state, after a bye or a win, vs a new coach) | 36% | 50% |
| with an in-game chip (one-score, shootout, possession) | 6% | 9% |
| of the first 12 rows the page shows, 3 or 4 conditions | 45% | 37% |

Alabama's active list is 1,198 rows. Its top 25 by score has "away + ranked + conference game + vs a red school", "ranked + after a loss + vs an animal mascot" and "home + unranked + in September". Its rows at two conditions or fewer: 241, led by "home + unranked" (89) and "unranked + rivalry" (45), the two a fan would quote.

The weekly digest reads the same rule. Week 7 lists 1,645 streaks broken; 1,031 of them have three or four conditions. The at-risk page and the game pages read the same rows.

The score already prices conditions (a chip costs 1, 3, 9 or 12 bits by tier, plus a sparsity cost) and still puts three-chip rows in the top ten, because the rarity bonus (`rarityW` 2.5) was built to reward a hard definition. That was the old idea of interesting. The stories say interesting is a superlative under a claim a fan would make, and readers said the rest out loud: "Quite the cherry picked stat" (33 points), "Baseball stats lol" (32), "a lot of these are really pointless streaks". Every organic share was one or two conditions. Every search landing page is zero or one.

## The rule

A streak is **simple** when its definition has at most two conditions. Active and all-time list simple streaks. **Trivia** lists the rest: every admitted run of three or four conditions, active and all-time in one list, the live ones marked.

Nothing re-mines and nothing is cut from the mine. The crowns files already hold every run placed third or better under either placing; this is a page-time admit rule, one more knob in `LIST`, so it reaches every view the way the medal rule does and the tuner can preview it at `?tune=1`.

Two calls inside the rule, made by Drew on 2026-10-25:

1. **A trivia chip makes a streak trivia at any count.** Count alone would keep "ranked + full moon", "unranked + vs cats" and "won by 10 + after a loss + vs an animal mascot" in a team's main list. The trivia chips are the ones nobody would open a thread with, plus every "win-more" condition, a chip that describes the team already winning the game: `fullmoon`, `weekday`, `weekend`, `vscolor`, `vsnewcoach`, `state`, `afterwin`, `leadhalf` and `trailhalf` (the halftime score), `wonpos` and `lostpos` (time of possession). `afterbye` is not trivia (rest is a real condition, and the Florida fan quoted it). `month` and `vsmascot` stay simple; they have landing pages (September, October, November, vs animal mascots) and Drew put them there. The game-shape chips (`onescore`, `shootout`, `struggle`, `overtime`) stay simple; "won 9 straight one-score games" is a sentence a broadcast says. The tier table in `list.ts` is where this lives, so it's one list to edit, and `leadhalf`/`trailhalf` move out of plain and `wonpos`/`lostpos` out of ingame to get there.
2. **A margin outcome counts as a condition.** `dir=W10` already costs a condition's bits (`marginCost` 3). "Won by 10 + home + unranked" is three claims; it goes to trivia.

So: simple = at most two conditions counting the margin, none of them a trivia chip. A team's median at two or fewer conditions is 95 active rows; with the trivia chips out it's about 60, and three teams new to FBS (Delaware, Kennesaw State, Missouri State) have under five. That's fine. The principle under the whole change is Drew's: it's better to show nothing than to show something that isn't interesting. A short list is the rule working, and the empty line says so plainly.

## Where it lands

**The list rule (`src/lib/list.ts`).** `admit` gains `maxChips: 2` and `triviaKeys`, and `admits` gains a scope: a run is admitted to the simple lists when its picked placing is within `admit.rank` and simple, and to trivia when it's within `admit.rank` and not. A view asks for one scope. The pick stage stays: the fewest-conditions placing is what's shown, so a run that leads under "home + unranked + nonconf" and also places second under "home + unranked" shows the simple words where the admit knob reaches them, as today.

**The team page.** The Streaks heading gets three pills: active, all-time, trivia. The first two shrink to their simple rows; trivia is the third file's worth, built from both crowns files, each row carrying its scope word ("active", "all-time"). The empty line reads "Delaware doesn't have the longest active streak under any simple definition", with the trivia count beside it. "Streaks broken this season" cuts the same way, with "and N trivia streaks" as one collapsed line.

**The board.** The board is the builder and keeps all four chips. At a third chip the definition is a trivia definition: the sentence says so ("the longest trivia streak in …"), the board's heading and the card carry the word, and the "+ constraint" menu says it at the moment of adding ("a third condition makes this a trivia streak"). The scope switch stays active / all-time, since a trivia definition has both. `scope=` in the address doesn't change; trivia is a property of `c`, not a third value.

**The digests, the game pages, the breakers.** The broken digest and the at-risk page list simple rows and fold the rest into one line per week ("and 1,031 trivia streaks ended this week", a link that opens them). A game page lists what the game ended or put on the line among simple streaks, with the trivia count as a line. Trivia comes off the breakers board entirely: a trivia break earns no points, isn't counted in "streaks broken" and isn't listed on a breaker's page, so the SKR is about streaks a fan would have named. The leaderboard's order changes; that's the point.

**The landing pages and the worker.** Untouched. Every landing page is already simple. The worker words a trivia definition's card with the word.

**Tests.** The golden test gets two lines: no simple list carries a row past the rule, and a trivia row is never shown with fewer conditions than its definition. The nesting test holds per scope: a game's simple rows nest in the week's simple digest nest in the breakers' simple counts.

**Analytics.** `team streaks scope` already records the switch; `trivia` is a third value. What to watch after: the share of team-page visitors who open a streak (`lead apply` from the page, 12% site-wide today) and who tap share, against the trivia tab's open rate, which should be small.

## What it costs

A knob and a scope in `list.ts`, the pills and the folded lines in four components, two test lines, and the worker's word. No build cost: the mine, the crowns files and the digests are what they are, and the prerender renders with the defaults. The order within the simple lists may want retuning afterward, since `rarityW` had less to do; that's a tuner session, not this change.

## What it doesn't do

- It doesn't shorten the mine or the builder. Four chips are still mined and still buildable; the long tail is still a page and still unfurls.
- It doesn't touch what a landing page lists.
- It isn't the superlative rule for PUN's player pages. That's a separate proposal with the same principle.

## Settled (2026-10-25)

- The trivia chips: full moon, weekday, weekend, color, vs a new coach, state, after a win, the halftime score, time of possession. Not after a bye. Month and mascot stay simple.
- Trivia is off the breakers board, not discounted.
- Short lists are fine. Better nothing than something uninteresting.

## Open

- The word on the board. "Trivia" is Drew's and it's what readers called it. The sentence has to carry it without sounding like an apology; "the longest trivia streak in home games under a full moon vs red schools" reads fine to me.
