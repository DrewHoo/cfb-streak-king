# The streak list rule

Status: built 2026-10-15, uncommitted in the worktree, for Drew's review in the
browser (`?tune=1` on any list). The findings below come from running the old code over
the raw mine of Oct 14; the crowns files in `dist/` then were from Oct 12 under the old
60-row cap, so the pages Drew looked at predate the one-floor change, but the raw mine
reproduced every case. "What was built" at the end says what the code now does and what
it cost.

The site has one algorithm that decides which streaks are on any list, what words each
is shown under, and in what order. Every view (a team page, a game page, the week's
at-risk and broken digests, the breakers leaderboard) is that algorithm filtered to the
view's slice. This spec names it, says what it does today, what the mine shows is wrong
with it, and how it becomes a set of knobs Drew can turn on the live site.

## Where we stand

A **run** is a set of games. A **placing** is a run under one definition: the definition's
conditions, the team's place in that field, and the rates the score reads. The
miner finds the same 47 Oklahoma games under "all games", "after a win", "while ranked"
and 40 other definitions, so one run has many placings. Today the pipeline is five
stages, and the ones Drew thinks of as "the collapse" are three different mechanisms in
three places.

1. **Mine** (`mineCore.js`). Every current-FBS team, every definition of up to four
   chips, seven outcomes. A run is kept when it is 4+ games, 10+ teams hold a run under
   the definition, and it scores above `KEEP_FLOOR` (−12.5) unless it has no chips.
2. **Collapse identical runs** (`collapse` in `mineCore.js`). Tellings of the same run,
   same outcome, last game and length, become one row. The highest crown score wins;
   `also` counts the losers. This runs inside the mine, so the score weights are baked
   in at build time and a losing placing never reaches a page.
3. **Admit** (`mineCrowns` in `crowns.ts`). A team's list keeps rank 1, ties included,
   under the sheet outcomes (W, L, C, N, W10, L10). The score cuts nothing.
4. **Drop replacings** (`rankCrowns` in `crownRank.ts`). An undefeated run identical to
   a winning one goes; a plain win run identical to a by-10 run goes. All-time only, the
   **same-years rule**: of two nested same-outcome runs that share half the shorter one's
   seasons, the better-scoring stays and the other is deleted. There is no direction and
   no older-stands exception.
5. **Order and group** (`rankCrowns`, `markSubStreaks`, `subsByParent` in `StreakRow.jsx`).
   Sort by score, then length. A row is `subStreak` when a strict subset of its conditions
   tells a run at least as long, unless it started first (`olderStands`). The UI folds
   subStreaks under their parent as sub-streaks.

Then each view: the team page shows 10 and pages by 25; at-risk multiplies the score by
the chance the game ends the run and takes one row per team for its six; the broken
digest takes one per team scoring above −2.5 for its six, the rest behind "more"; the
game page orders by the same stake; breakers turns each break into points, 10 or 4
divided by 1 + 0.5 per chip.

The score (`crownScore`) is five terms, in bits. `p` is the definition's outcome rate
pooled over every FBS team's qualifying games. It is never the team's own rate.

| term | formula | Oklahoma's plain 47, all-time |
|---|---|---|
| length | len · log2(1/p) | +44.1 |
| lead | leadW · (len − second) · log2(1/p) | +8.4 |
| chance | −log2(teams) active, −log2(games · (1 − p)) all-time | −15.6 |
| words | −(tier + log2(choices)) per chip | 0 |
| span | spanAll · log2(seasons) all-time, spanA active | +4.1 |

Where Drew's five-bullet model of today differs from the code: there is no "longest
active first, all-time before it" grouping. Active and all-time are two lists behind the
team page's switch, and within a list the score is the only order. "Shorter versions
collapse" happens three times, in stages 2, 4 and 5, and only stage 5 has the
older-stands exception.

## What the mine says

**Oklahoma's 47 is deleted by the same-years rule.** The plain 47 of 1953–57 is in the mine at
rank 1 of 136. "Vs the Big 8", 44 games 1952–59, is nested over it (the empty
definition is a subset of every definition), shares its seasons, and scores higher, so
stage 4 deletes the 47 and keeps the 44.

| placing | games | length | lead | chance | conditions | span | total |
|---|---|---|---|---|---|---|---|
| all games | 47 | 44.1 | 8.4 | −15.6 | 0 | 4.1 | 41.0 |
| vs the Big 8 | 44 | 47.7 | 13.8 | −11.2 | −5.3 | 5.3 | 50.2 |

Narrowing the definition pays twice, a bigger lead over a smaller field and a smaller
chance term over fewer games, and 5.3 bits of words doesn't cover it. A rule with no
direction lets a longer-worded, shorter run absorb a simpler, longer one.

**Notre Dame's 16 never leaves the mine as a plain run.** The 16-game run has 20
placings. "In non-conference games" won the collapse: ND is rank 1 there with a lead of
6, while under "all games" it is rank 2 behind Indiana's 22 and the lead is negative.
Every game ND plays is non-conference, so the page tells the run as something it isn't.
Across all 136 teams, 6 plain active winning streaks survive the collapse. A medal rule
alone wouldn't surface ND's run, because the plain placing is gone before admit runs.
The surviving placing sits at position 58 on ND's page under eight "won by 10+" rows:
the margin outcome costs no words and its per-game rarity is 1.55 bits against 0.94.

**Too many conditions on top is a rate problem, not a tier problem.** The top ten rows
of Oklahoma's, Notre Dame's and Ohio State's lists average 2.4 to 2.8 chips, and
Oklahoma's and Ohio State's have no plain row at all. `p` is the FBS-wide rate for the
definition, so "conference games vs red schools" is a coin flip across FBS while Ohio
State wins those 95% of the time, and 60 of them earn 54 bits of length. A linear word
cost can't beat a term that grows with length; raising the tiers moves the problem, it
doesn't fix it. The lever is the rate.

**The lists are sorted; the score hides it.** Four terms of similar size trade off and
nothing on the row shows which won. A worked pair from Ohio State's active list:

| placing | games | p | length | lead | words | span | chance | total |
|---|---|---|---|---|---|---|---|---|
| power member · in-state | 30 | 0.60 | 22.5 | 2.8 | −6 | 3.6 | −7.1 | 15.8 |
| road · ranked · conference | 4 | 0.23 | 8.6 | 0 | −3 | 1.2 | −7.1 | −0.3 |

Thirty easy games outscore four hard ones. That is the intended math, and a reader can't
see it.

## The rule and its words

One module, `src/lib/list.ts`, holds the rule and its knobs (`LIST`, replacing `RANK` and
`BREAK`). It takes mined rows and returns listed rows, in four stages that are the
repo's verbs from now on:

- **admit**: which runs are on any list at all. Today, rank 1 or the all-time longest.
- **pick**: which definition a run is shown under. One placing per run on a list.
- **order**: the score, and the sort it makes.
- **group**: which rows are sub-streaks, grouped under their run.

A view does none of those four. A view **filters** the rule's rows to its slice (this
team, this game, this week's games, this breaker's wins) and may **weight** them: at-risk
multiplies by the chance the game ends the run, breakers turns a break into points.
Weighting re-orders within the admitted rows. It never admits, re-words or re-includes.

The boundary is structural, not a convention. The mine's row type stays private to
`list.ts`; views import only the listed row type, so a view can't reach a run the rule
didn't admit, and a view that needs a new inclusion adds a knob to the rule, where every
view gets it. That is how the medal rule reaches the broken digest and the breakers page
without anyone remembering to.

`CLAUDE.md`'s product rules get one line: every streak list on the site is the list rule
over the mine, filtered to the view's slice, and a view only filters and weights.

Breakers today has its own condition discount, 1 + 0.5 per chip, a second condition cost
outside the rule. Under this language it is a weight the rule exposes (break points read
the row's condition cost) or it goes. Open question below.

## The mine stays weight-free

Stage 2 moves out of the mine. For each run the mine keeps at most two placings: the
**fewest-conditions** (fewest chips, then fewest choices so a plain chip beats a derived one, then
catalog order) and the **highest** placing (the same tiebreak among the
definitions under which the team is rank 1). Each carries its own `p`, `n`, `rank`,
`field` and `second`. `also` still counts the rest. When the fewest-conditions placing leads, the
two are one row.

So Notre Dame's 16 is one run with two placings: "16 straight, 2nd of 136" and "16
straight in non-conference games, 1st of 94". The rule's `pick` stage picks which words a
view shows, by a knob; the row can show the other place beside it ("2nd longest active;
longest in non-conference games"). After the Notre Dame fix below the second placing
doesn't exist, and the plain one needs `admit.rank ≥ 2` to be on ND's page.

Every file that carries a score today carries the inputs instead, and the page scores:
the crowns files (`crownsFile.ts` gains `p`, `n`, and for a run with two placings the
second's chips and places; drops `chance`, `score`, `subStreak`), `dist/games/digests.json`,
the season files, and the breakers file. The prerender renders with `LIST`'s defaults so
the hydrate matches; the tuner's overrides apply after mount, like every piece of URL
state. The browser mines nothing, as today. Changing a knob never re-mines; changing a
chip's test or the floors does.

## The knobs

All in `LIST`, each with a one-line comment saying what it moves. Defaults are today's
values where one exists.

| knob | what it does | today | proposed default |
|---|---|---|---|
| `admit.rank` | the highest place a run may hold and be on a list, ties included; the all-time longest always admits | 1 | 1 (3 is the medal rule) |
| `pick` | `fewest` or `highest`: which of a run's two placings a list shows | best score | `fewest` |
| `rate` | α in b = (1 − α)·log2(1/p_field) + α·log2(1/p_team): how much a run is measured against the team's own rate under the definition | 0 | 0.5 |
| `rateShrink` | k in p_team = (hit + k·p_field) / (n + k), so a team with few qualifying games stays near the field | n/a | 20 |
| `tiers`, `chanceW`, `leadW`, `leadFloor`, `spanA`, `spanAll` | as today | as today | as today |
| `marginCost` | a condition cost for the by-10 outcomes, which cost nothing today | 0 | 3 (the plain tier) |
| `rarityW` | a bonus of rarityW · b per run, independent of length: a hard definition gets a fixed lift | 0 | 2.5 (Drew, from the tuner) |
| `sparseW` | bits per doubling of how few of the team's games the definition keeps, log2(games ÷ qualifying games): a sliver pays, a definition that keeps every game pays nothing | 0 | 1 |
| `rivalChoice` | the share of an opponent chip's choice cost a rival gets back: at 1 "vs Auburn" is a choice among Alabama's rivals (about 2 bits), at 0 one of 288 opponents (8.2) | 0 | 1 |
| `bucket` | score bucket width B; rows sort by floor(score / B), then rarity b, then length; 0 is pure score | 0 | 0, compare in the tuner |
| `sameYears.directed` | a run absorbs another only when its chips are a subset and its run is at least as long | false | true |
| `sameYears.overlap` | `eraOv` as today | 50 | 50 |
| `olderStands` | as today, and now also the same-years rule's exception | true | true |

`rate` needs two more numbers per row from the mine, the team's own hits and qualifying
games under the definition. The miner already computes both per team on its way to the
pooled rate (`countAnd(qb, td.won)` in `evaluate`); it only has to keep them.

The two readability knobs are alternatives. `rarityW` is smooth: a 30-game easy run still
wins when it is far ahead, and nothing swaps over a tenth of a bit. `bucket` is Drew's
"within a band, hard conditions first", and it has cliffs: 19.9 and 20.1 land in
different buckets. Try `rarityW` first and keep `bucket` to compare. Either way the row
shows its per-game rarity, or the order still reads as random.

## The tuner

`?tune=1` on any page with a list. It ships in production; if someone finds it, good on
them. It is read in a `useEffect` after mount, never during render. It opens a panel:

- a slider or field per knob, and the visible list re-runs the rule and re-sorts live;
- a "why" chevron on every row that opens its term table (the five terms, the rarity
  bonus, the rate used, the total, and the placing it lost the collapse to if any);
- a compare mode: pick two rows and see each term's delta, so "why is X above Y" is a
  table, not a guess;
- "copy as LIST", which puts the current knobs on the clipboard as the TypeScript
  object, ready to paste into `list.ts`;
- overrides persist in `localStorage` under `tune`, and a reset button clears them.

The tuner is itself a view: it filters nothing new and weights nothing. It calls the
same function the page calls, with different knobs.

## The golden test

`src/lib/list.test.ts`, `golden orderings`, run against the build's mine (`STREAK_MINED`,
as the mining tests are). A short list of assertions, each written as the complaint it
guards against, so a failure reads like a bug report:

- Oklahoma, all-time: the plain 47-game winning streak of 1953–57 is on the list and in
  its top five.
- Notre Dame, active: the 16-game winning streak is shown as "16 straight", not as a
  non-conference run.
- Every team: a run's plain placing is never outranked on the same list by a longer-worded
  placing of the same run.
- Ohio State, active: a 4-game run on the road vs ranked opponents is above the 30-game
  in-state run (if that's the call; it's a knob, and the test pins whatever Drew settles).
- Ordered pairs Drew adds from the tuner: "X above Y on Z's page", one line each.

A knob change that the tuner settles is committed with its golden lines. A turn that
fixes one page can't silently break another.

## The nesting test

`list.test.ts`, `every view nests`: for each view, its rows are a subset of the rule's
rows for the same slice, in the same relative order before the view's weight is applied.
Concretely:

- a team page's rows = the rule's rows filtered to the team;
- a game page's on-the-line rows = the rule's rows whose next qualifying game is that
  game, from both sides, ordered by stake;
- the at-risk digest = the union of the week's game pages' rows, one per team for the
  six;
- the broken digest's rows = the rule's broken rows for the week;
- a game's "N broken" = the breakers page's credits for that game (already pinned by
  `breakers.test`).

With `admit.rank` at 3, every one of those admits #2 and #3 together, which is the
point: the medal rule is one line, not five.

## Notre Dame: the conference chips while independent

`confgame` and `nonconf` are meaningless for an independent, and today `nonconf` is true
for every Notre Dame game, which is how the collapse found a "non-conference" placing
that leads a field of 94. The chip catalog already has the tool: `known(g)` in
`chips.ts`, which says a game can't answer the chip at all, used by the ranked chips for
seasons before the first poll. An unknown game never qualifies, so it isn't in the
definition.

The change is four lines and a test:

- `createModel.ts` adds `ownConf` to each game row, from `confOf(ti, se)`, which it
  already calls for the opponent; the pregame row (`GameContext`) gets the same field so
  `nextQualifying` agrees.
- `confgame` and `nonconf` get `known: (x) => x.ownConf !== 'Independent'` (conference
  id 4 in the payload; ND's 2020 ACC season stays known).
- `chips.test.ts`: a Notre Dame 2024 game qualifies for neither chip; its 2020 games do.
- `MINE_FORMAT` in `crowns.ts` bumps. The mine's stamp hashes chip keys, not chip tests,
  so without the bump a stale `STREAK_MINED` file reads as current.

`vsconf:Independent` is the opponent's conference and is untouched. After this, ND has no
non-conference run, its 16 is kept under no condition at rank 2, and with `admit.rank` at 1 it is on
the board's column and not on ND's page. That is the one-floor rule working as written;
the medal rule is what puts it on the page.

## Costs

A re-mine (~250s on Drew's Mac) for the Notre Dame fix and the two per-team counts. The
crowns files grow by two numbers per row and shrink by three; a run with two placings
adds its second's chips and places, call it a few percent on 11 MB. Scoring at page time
is a few thousand multiplications per list, nothing a phone notices. The prerender
scores every page once with the defaults, as it does today.

## What we don't do

- No score floor, cap or "of note" filter on any list that doesn't have one today. The
  broken digest's −2.5 picks its top six and sends the rest to "more"; it stays, named
  as a weight.
- No new view. The tuner is a panel over existing lists.
- No change to what the board's columns show. The board is the rule's rows for one
  definition; it inherits `admit.rank` like every view.
- No "in wins / in losses" chips, no half chips at other margins (settled earlier).

## Settled

- One algorithm; views filter and weight only (Drew, 2026-10-15).
- The tuner ships in production at `?tune=1` (Drew, 2026-10-15).
- Notre Dame gets the cheap fix above; if it had needed more, Drew would have left
  independents weird (Drew, 2026-10-15).
- The Ohio State in-state-vs-ranked pair was a debugging prompt Drew made up, not a
  real ordering complaint; it stays in the spec as the worked example and the golden
  line is whatever the tuner settles.

## Open questions

- `admit.rank`: ship at 1 and turn to 3 in the tuner first, or ship the medal rule? The
  one-floor product rule in CLAUDE.md changes either way once it's 3, and the nesting
  test is what makes that one line. I'd ship at 1 and decide from the tuner, WDYT?
- `rate` at 0.5 makes Vanderbilt's 4-game winning streak score big against its own rate,
  which is fan-correct and changes what "1 in N by chance" means on the row. The chance
  figure could stay at the field's rate while the order uses the mix. Two numbers on one
  row from two rates feels like a thing we'd regret, maybe just say "past chance for a
  team like this"?
- Breakers' condition discount: groups it into the rule's condition cost (a break's points
  decay with the row's bits of words) or keep 1 + 0.5 per chip as a named weight? Folding
  it makes the breakers page move whenever a tier moves, which is either the point or a
  nuisance.
- `pick` as `fewest-conditions` means a team page shows "16 straight, 2nd of 136" over "longest
  active in non-conference games". For a run that only leads under conditions (most of
  them), the fewest-conditions placing is the highest one and nothing changes. Is the second place
  worth a second line on the row, or is the place enough?

## What was built (2026-10-15)

Everything above, with these calls made on the open questions, each a knob or a line
to change:

- `list.ts` replaces `crownRank.ts` and holds `LIST`; `admit.rank` ships at 1 (the
  one-floor rule as it was), `rate` at 0.5 with `rateShrink` 20, `rarityW` 2.5 (Drew turned it down from 4 in the tuner),
  `marginCost` 3, `bucket` 0, `sameYears.directed` true, `pick` fewest-conditions. The chance figure on
  a row ("1 in N by chance") stays at the field's rate; only the order uses the mix.
- The mine collapses a run's placings by plainness (`collapseInto` in `mineCore.js`): the
  fewest-conditions stays on top, the best-placed rides along as `best`, and a placing carries its
  own place, rates, edge and liveness, since all of those read the definition. A run is
  the same games: the collapse key is outcome, first game, last game and length (the old
  key was last game and length, so two different runs could collapse). `MINE_FORMAT` is 4.
- Every file carries inputs and no score: `crownsFile.ts` v6 is the one row codec, used by
  the digests (v2), the season files (v2) and the breakers (v2). A crowns file keeps every
  run placed `FILE_RANK` (3) or better under either placing, one scope a file. The digests file keeps a
  week's rows unsplit; `brokenDigest` and `atRiskWeek` split them in the page. The pick of
  the streak most on the line in each scheduled game is the build's, under the shipped
  knobs; the tuner doesn't re-pick it.
- The breakers' condition discount stays as it was, a weight the page applies to the
  rule's rows (`breakPoints`); `breakCat` reads the admit knob, so the medal rule reaches
  the leaderboard. The share worker's past-season fallback orders a team's breaks within a
  category by length now (the file has no score) and groups sub-streaks itself.
- A row shows its other placing in small print ("· 2nd of 136 overall", "· 3rd at home ·
  in conference games"), and the tuner's "why" names it in full.
- Notre Dame: the conference chips are unknown for a game the team played as an
  independent (`ownConf` on the row). Its 2020 ACC runs are still its last qualifying
  games under those chips, so they stay "active" and dated 2020; the golden test allows
  exactly that.
- Dups are flagged per team and, for broken runs, per game (`listBroken`), so a game page,
  the week's digest and the breakers group the same sub-streaks and their counts nest.

### Costs, measured (gzipped, what a browser pulls)

| | before (one-floor code, estimated) | now |
|---|---|---|
| a team page's HTML, active list embedded (Oklahoma / Akron) | ~30 KB | 45 KB / 26 KB |
| the Streaks switch: the team's all-time file (Alabama / Oklahoma / Akron) | ~35 KB avg | 185 / 179 / 62 KB, 82 KB avg |
| an unplayed game page: both sides' active files | ~70 KB | ~46 KB (23 KB avg each) |
| all crowns files on disk | 4.7 MB | 14.2 MB (3.0 MB active, 11.2 MB all-time) |
| the schedule page's HTML, the digests embedded | not measured | 317 KB |
| the mine | ~250 s | 68 s on 10 threads (this Mac) |
| the raw mine file | 276 MB | 475 MB |

The file growth is ranks 2 and 3 (about 40% more rows), four rates per row and the second
placing on a third of the rows; the spec's "a few percent" was wrong. The crowns file is
split in two (`crowns/<id>.json` the active runs, `crowns/<id>.all.json` the all-time ones)
so a game page and a team page's first render never pull the all-time half, which is 80%
of the bytes; the switch to all-time is the one fetch that got heavier, about 2.5×. The
cheap cut left is `FILE_RANK` back to 1 until the medal rule ships (14.2 → 9.3 MB).

### Sparsity and rivals (2026-10-16)

Drew's observation on Alabama's page: "8 wins on the road after a loss vs the Independent
since 1963" is at best marginally interesting, while Indiana's 22 straight is among the
most impressive runs in the sport because every game counts. The chance frame doesn't
support a penalty (eight wins in eight tries are eight tries) and the span term rewarded
the sparse run (+3.5 bits for 26 seasons against Indiana's +0.8). What the row was
missing is how thin the definition is for the team: it keeps 11 of Alabama's 1,066
games. So the mine now stamps each run with the team's game count (`gT`: every game, or
every lined game for a spread outcome) and the rule charges `sparseW · log2(gT ÷ nT)`.
At weight 1 that is 6.6 bits for the sliver, 0 for Indiana, 3.6 to 4 for an annual
rival, 5 for a conference opponent met most years.

Rivalry streaks turned out to be buried by something else: the opponent chip's choice
cost, log2(288) = 8.2 bits, priced as if Auburn were one opponent picked from 288. When
the opponent is one of the team's rivals (the payload's rivalry pairs, what the `rivalry`
chip reads) the mine marks the placing (`rivals`: how many rivals the team has) and the
chip is priced as a choice among them, by `rivalChoice`. Alabama vs Auburn gets about 6
bits back. Measured before the change: the Iron Bowl run was off Alabama's page (2nd of
31 in its field behind Georgia's nine) and 637th of 1,312 under the medal rule; Georgia's
leading nine vs Auburn sat 88th on Georgia's page.

### Settled by building it

- The tuner reads `?tune=1` after mount and remembers it in localStorage (`tune`), along
  with the overrides (`tune.knobs`), because the URL writer drops the param on the next
  change of state. `?tune=0` turns it off.
- The golden test (`list.golden.test.ts`) pins: Oklahoma's plain 47 in its all-time top
  five; every team's plain run shown under no condition once the admit knob reaches its place; a run
  never shown with more words than an admitted simpler placing; and the nesting of
  at-risk, the week's digest and the breakers in the game pages, under the shipped knobs
  and the medal rule both. The Ohio State pair is not pinned.

- The mine's stamp names the payload, the chips, the keep floor and `MINE_FORMAT`, not the
  rows' field names, so renaming a mined field (`best` → `highest`) needs a `MINE_FORMAT`
  bump or a stale `STREAK_MINED` file reads as current with the field missing. It is 5 now.
- Vocabulary, after the naming pass (2026-10-15): a *placing* is a run under one definition
  (type `Placing`; a run's second one is `highest`, the shown row's other one is `other`);
  the stages are admit, pick (`fewest` | `highest`), order, group; the sub-streak flag is
  `subStreak`; the score terms are length, lead, chance, conditions, margin, rarity, span;
  the all-time rule that drops a run repeating another's years is the same-years rule
  (`sameYears`); a run another row covers with a stricter outcome is dropped by
  `coveredByStricterOutcome`.

### Not done

- No golden line for an ordered pair yet; the tuner is where Drew picks them.
- The on-the-line pick per scheduled game is the build's, not the knobs'.
