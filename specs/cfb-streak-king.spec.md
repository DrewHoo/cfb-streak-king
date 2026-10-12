# cfb-streak-king v1 spec

Users build a streak definition out of up to 4 constraint chips (road games, vs AP-ranked,
as an underdog, in November) and the app ranks every current FBS team by its active
winning or losing streak under that definition. Window is 1978–2025. The data ships as
one static payload and streaks compute in the client, so every chip toggle re-ranks the
board instantly. Hosting follows the dataviz-pages-site pattern:
drewhoover.com/cfb-streak-king/.

Nobody offers this. WarrenNolan and cfbeveryday publish current streaks in four or five
fixed categories. Stathead has flexible filters for $9/month behind a login and a bot
wall, and its "streak" means consecutive games each matching the criteria, not the
skip-gap definition fans use. BetIQ stacks filters for free but only outputs W-L
records. The composable current-streak leaderboard is an empty niche.

## Streak semantics

These definitions are the contract everything else builds on.

- A game **qualifies** when it matches every active constraint. Non-qualifying games are
  invisible: they neither extend nor break a streak. "Hasn't lost to Auburn since 1998"
  stays alive through seasons where they don't play.
- A team's **current streak** counts back from its most recent qualifying game: N
  consecutive qualifying games with the same result. One computation yields both boards;
  a team whose latest qualifying result was a loss has a win streak of 0 and doesn't
  appear on the win board.
- **Ties break winning and losing streaks.** Ties only exist before overtime arrived in
  1996. A third outcome, **undefeated** (wins and ties), shipped 2026-09-29: `dir=U` in the
  URL, a third word in the direction menu and the crowns select. A fourth, **covering**
  (beat the closing spread; a push ends it; unlined games are invisible to it), is `dir=C`.
  A fifth, **not covering** (failed to cover, same rules), is `dir=N`.
- A streak that reaches the window edge displays **"N+"**. We never claim a streak
  equals N when 1977 could extend it.
- When a betting constraint is active and a qualifying-by-other-criteria game has no
  line, the game's favorite status is unknown, so it doesn't qualify. About 77% of
  1978–2013 games are lined; 2006+ is near-complete. Same rule for the night-game
  constraint before kickoff times exist.
- Teams shown: the current FBS membership (~136). Opponents can be anyone, including
  FCS teams, and those games count. FCS teams just don't get leaderboard rows.
- **A team's own list starts at its latest FBS entry** (added 2026-09-28). Games it
  played while FCS stay in the payload for the FBS opponent but never count toward its
  own streaks, so a program that joined in 2025 cannot carry a 38-game FCS losing streak
  onto the board. The panel says when a streak runs back to the team's first FBS season.
  A season the team sat out doesn't count as leaving FBS (UConn 2020, SMU 1987–88; the
  rulings are in data/ref/fbs-span-bridges.json), so a streak runs straight across it.

## Constraint catalog (v1)

Every chip below is computable from the spine for the full window unless a floor is
noted. Users pick at most 4; chips within a group are mutually exclusive where marked.

| group | chips | notes |
| --- | --- | --- |
| Site | home / road / neutral / away-from-home / in [state] | site chips exclusive; state combines. Venue state = campus state, or the Repole city tag on pre-2014 neutrals; 2014+ neutrals unknown pending a venue table. Alternate home stadiums (Legion Field, Little Rock) ruled home via overrides |
| Opponent rank | vs ranked / vs top 10 / vs top 5 / vs unranked | AP poll in effect at kickoff |
| Own rank | while ranked / while unranked | own AP rank at kickoff |
| Betting | as favorite / as underdog / as 7+ dog / as 14+ dog / close spread (\|s\| ≤ 3) | closing line; unlined games skip |
| Conference | conference game / non-conference / vs [specific conference] | as of that season; conf game = same conference + overrides |
| Opponent | vs [specific team] / rivalry games / in-state opponent | rivalry = Wikipedia trophy-game pair list; in-state via school-state table |
| Coach | under current head coach / in a coach's first season / vs a first-year head coach | SHIPPED 2026-09-26. CFBD /coaches (one call, 1978-2026); mid-season changes placed at the exact game by matching each coach's record as a prefix of the team's result sequence (scripts/lib/coach.mjs); Seasons CFBD's rows can't reconcile (double-credited co-coached bowls, rows misfiled under the wrong school or year) are ruled by data/ref/coach-overrides.json, date-anchored and researched with receipts: Utah 2004, Boise State 1996 (Allen's non-contiguous return), Georgia State 2016, Tulane 2011-12 (Hutson misfiled), WKU/Louisville 2018 (Petrino misfiled). 0 unresolved seasons. Interim = a stint that started mid-season and never crossed a season boundary; interims don't count as "first season". "vs [specific coach]" and "under [named coach]" remain unbuilt |
| Calendar | in [month] / season opener / regular-season finale / bowl+postseason | month by local date; Week 0 folds into September |
| Context | after a loss / after a win / after a bye | previous game in the team's own timeline; bye = 13+ days rest |
| Game shape | one-score game (≤8) / shootout (70+ combined AND decided by <10; 4.9% of games) / defensive struggle (≤33 combined, ~15% tail) | 70/33 are ±1σ from the all-time mean total (51.0, σ 18.1); the margin condition keeps 73-0 blowouts out of shootouts post-hoc: the filter reads the final score. Famous framing ("won 9 straight one-score games") justifies keeping it |
| Score state | leading/trailing at half, by any/3+/7+/10+/14+ (param) | SHIPPED 2026-09-27. CFBD /games line scores, floor 2001 (solid 2003). Anchor stat: Alabama 178-9 when leading at half under Saban |
| Possession | won the clock (>50%) / lost the clock (<50%) | SHIPPED 2026-09-27; lost replaced dominated (60%+) 2026-09-30, a win-more condition. CFBD /games/teams possessionTime, floor 2004 |
| Kickoff | night game (6pm+ local) | **floor: 2002**, solid from 2014. Board shows "within available data (2002+)" |
| Almanac | on a weekend / on a weekday / under a full moon | SHIPPED 2026-09-30. Weekend/weekday by game date, exclusive. Full moon = the moon is full within 24h of 00:00 UTC after the game date (8pm Eastern), instants by Meeus ch. 49 (src/lib/moon.ts, within ~2 min of NASA eclipse times); 6.8% of days. The sentence calls them werewolf games |

Cut from v1 after research: TV network (coverage unverified before the 2010s), weather
(paid tier only), attendance (zeroed for whole seasons), uniforms and homecoming
(curation cost with no bulk source), vs No. 1 and CFP-only (degenerate, 0–2 game
streaks), P4-vs-G5 tier (the tier concept doesn't exist before 2014 and back-defining
it is a judgment project).

## Presets

Removed 2026-09-30: the menus now show the king of every constraint and choice, so the
famous answers are one click from any definition and the "start from" list went.

Ship ~10 presets that load a constraint set + direction and rediscover a famous streak.
Candidates, all verified by the research pass:

| preset | constraints | the famous answer |
| --- | --- | --- |
| The Saban Standard | vs unranked, W | Alabama's 100 straight (2007–21) |
| Ranked Futility | vs ranked, L | Rutgers 42, Nebraska 29 |
| Road Kill | road + conference, L | Kansas's 44-game Big 12 road skid |
| Death Valley at Night | home + night, W | LSU 28-0 on Saturday nights 2002–08 |
| Never Twice | after a loss, W | Saban-era bounce-backs |
| Opening Day | season opener, W | Ohio State's 20 straight |
| Kings of the State | in-state opponent, W | Ohio State unbeaten vs Ohio schools since 1921 |
| Giant Killers | as underdog, W | surfaces teams nobody tracks |
| Chalk | as favorite, L | "hasn't lost as a favorite since…" |
| Bowl Curse | bowl games, L | every fanbase knows theirs |

## Leaderboard UI

One page. The definition line renders only selected chips as removable pills; the
grouped catalog opens from a "+ constraint" button. Direction toggle (W streaks /
L streaks) beside it, board below.

The board draws teams as columns: streak count (rust when on the line) above the
team's color mark, then one hostile-territory square chip per game, newest at top —
cream ink mark for a win, dark dim mark for a loss — capped at 12 with a "+N"
overflow, the streak-starting result at the foot ("'78" when the run hits the window
edge). Tapping a column expands it in place into a ledger: chip · date · own rank ·
site (@ road, N neutral, blank home — the Sports-Reference grammar) · opponent
rank · score.

Each row: rank, team (one-color logo per the hostile-territory pipeline), streak count,
streak start date, and the **streak-ender**: the last opposite result, rendered like
"last loss: 11/30/2019 at #15 Auburn". Rows expand to the full qualifying-game list
with the streak highlighted. During the season, a row gets an "on the line this week"
marker when the team's next scheduled game qualifies under the active constraints, and
a **This Week panel** lists those unplayed matchups directly: date, kickoff, line, and
both teams' streaks at stake ("Georgia's W17 vs unranked, at Auburn Sat 3:30"). Both
features run the same test: does the upcoming game qualify? That's decidable for
constraints knowable pre-game (site, opponent, ranks, conference, coach, calendar,
betting once lines post, night unless kickoff is TBD) and undecidable for post-hoc
chips (one-score, shootout, halftime, possession), which just exclude a matchup from
the panel. The data is already in the weekly refresh: the schedules ship future games
with completed=false, and the current poll, lines, and coaches all update in-season.

Sort defaults to streak count. A secondary sort by years-since-ender rescues sparse
constraint sets, where a 3-game opener streak spanning 2023–2025 and one spanning
1998–2025 are very different claims.

URL state carries the full definition (chips, parameters, direction, sort) in readable
params, per the dataviz-site-craft url-state pattern. Presets are just links.

## Data pipeline

All build-time scripts, cached raw inputs, receipts-style validation. Reuse from
~/Projects/spread-vs-ap wherever it exists: name-aliases.json, polls.json, the parsed
line files, and the documented sign convention (homeSpread negative = home favored).

1. **Spine 1978–2013: Repole XML.** The zips are already cached in spread-vs-ap's
   data/raw/repole/. The XML (not the CSV) carries exact dates, visitor/home, scores,
   per-team lines, and neutral-site `info="@ City ST"` tags. 25,910 games.
2. **Spine 2014–2025: cfbfastR schedule CSVs** (2006+ already cached in spread-vs-ap).
   Validate the seam on the 2006–2013 overlap the same way spread-vs-ap validated
   lines (4,411-game overlap, |diff| p50 = 0).
3. **Cross-validate the old spine against jhowell's by-date files** (Wayback:
   wilson.engr.wisc.edu/rsfc/history/howell/cf{YYYY}gms.txt). Same underlying data, so
   disagreements are parse bugs or genuine errata. jhowell also supplies the `*`
   conference-game marker and bowl names for 1978–2013.
4. **Alternate-home overrides file**: Legion Field, Little Rock, Jackson, Memphis, and
   similar off-campus "home" sites. Neither source rules these; we do, per game,
   versioned, per the receipts pattern.
5. **FBS membership by season**: jhowell byconf.htm year ranges, cross-checked against
   CFBD /teams/fbs.
6. **Conference by season**: CFBD /conferences/affiliations (one call, interval rows).
   Conference game = same conference that season, plus an overrides file for
   scheduled non-conference meetings between members and for title games. The source
   conference_game flag is noisy before 2009 and only serves as a cross-check.
7. **AP ranks at kickoff**: spread-vs-ap's polls.json, joined on the poll in effect at
   the game's local date (UTC −8h shift, validated at 99.5% on hostile-territory).
8. **Coaches**: DONE via CFBD /coaches alone (one call covers 1978-2026; /coaches/tenures
   unused). Also fixed in passing: the cfbfastR schedule CSVs for 2014-2022 carry no
   postseason games, so bowls for those seasons come from CFBD /games?seasonType=postseason
   (9 calls, data/raw/cfbd-postseason.json) and their spreads from /lines postseason
   (12 calls, appended to data/ref/lines-cfbd.json). Old note: (season level) + /coaches/tenures (per-game midseason
   attribution, with an attributionComplete flag). Team-years where that flag is false
   fall back to hostile-territory's 818 researched tenure rows or a cited override.
9. **Rivalries**: one-time parse of Wikipedia's {{Trophy game}} templates (417 rows)
   into team-pair + year-range records.
10. **Night games**: cfbfastR start_date + venue timezone from CFBD /venues, 2002+,
    with 2001-style midnight placeholders treated as unknown.
11. **Halftime scores**: CFBD /games homeLineScores/awayLineScores (quarter arrays;
    halftime = q1+q2), ~25 calls for 2001+. Exact coverage floor needs a key check.
12. **Possession time**: CFBD /games/teams per year (callable by year alone),
    possessionTime stat, ~25 calls for the covered years, floor ~2004 pending a key
    check. Nothing free carries either field before 2001 short of scraping 36k
    Wayback box scores, so both chips are floored like night game.
13. **Current schedule** for the on-the-line marker and the This Week panel,
    refreshed in-season by the scheduled workflow (dataviz-pages-site pattern).

CFBD budget: key registered 2026-09-26 (repo secret CFBD_API_KEY + local .env). Spent so far: ~25 one-time calls (coaches 1, postseason games 9, postseason lines 12, current lines/coaches). Weekly cron adds 2 (/lines?year and /coaches?year for the running season). Remaining one-time items: halftime line scores (~98 via /games per year) and TOP (~208+ per-week calls, 2014+). Total stays inside the 1,000/month free tier. CFBD's terms prohibit
republishing their data as a standalone dataset, so the shipped payload is our own
compact encoding of a multi-source join, most of which (spine, lines, polls) isn't
CFBD anyway. Raw CFBD pulls stay out of git.

## Payload and client compute

~36k games ship as columnar arrays: season, date, home/away team indices, scores,
neutral, conf-game, homeSpread (half-points, sentinel for unlined), both AP ranks,
both coach indices, bowl flag, night tri-state, rivalry id, halftime scores (2 bytes,
sentinel pre-floor), possession seconds (2 shorts, sentinel pre-floor). Side tables: teams (name,
state, slug, conference intervals), coaches, rivalry pairs, next-game schedule.
Estimate 2–3 MB raw, a few hundred KB gzipped.

Everything else derives in the client: month, opener/finale (order within
team-season), after-loss/after-win/after-bye (previous game in team timeline),
favorite/underdog (spread sign + side), margin buckets, in-state, vs-conference.
Evaluating a definition is a single backward walk over each team's game list,
microseconds for 136 teams, so there is no precompute and no server.

## Ship checklist deltas

Standard dataviz-pages-site scaffold, checklist, OG assets, Mixpanel, index-site card.
Two additions: track preset clicks and chip combinations as events (the whole point is
learning which definitions people build), and prerender the default board (overall W
streaks) so crawlers see a real leaderboard.

## Out of scope for v1

- ~~ATS cover streaks~~ shipped 2026-09-29 as the covering outcome (pushes end a streak,
  unlined games are invisible to it), and failing-to-cover streaks as not covering. Over/under
  streaks remain out.
- FCS/D-II boards.
- ~~Historical (non-current) streak leaderboards.~~ Shipped 2026-09-28 as the all-time
  scope, now the default; see Amendments.

## Open questions

1. 4 chips or 3? The UI cost of 4 is nothing and famous streaks rarely need more than
   3, so I spec'd 4. Fine?
2. The one-score / shootout chips are post-hoc: the filter reads the final score, so
   an upcoming game can never qualify and the chips sit out of the This Week panel.
   Kept because the framing is beloved. Shootout is spec'd as 60+ combined points;
   raise to 70 if 60 is too common?
3. "vs [specific opposing coach]" follows the coach across teams. "under [own coach]"
   includes an explicit "current coach" option that stays correct across data
   refreshes. Both feel right but double-check the interim-coach rule: interim games
   count toward the team's streaks but don't count as "under" anyone. WDYT?
4. Thresholds for the new chips: halftime chips use the score after Q2, and
   "dominated TOP" is spec'd as 60%+ of clock (36+ minutes). A softer "won the TOP
   battle" (any majority) would fire on most games and make near-degenerate streaks,
   so I went with dominance. Fine?

## Crowns (shipped 2026-09-27)

A second tab: every streak a team solely leads. The full parameterless space
(34 chips, 39,138 definitions, 78,276 with direction) is mined client-side in
~4s on first open (chunked so the tab stays responsive; per-chip packed
bitmasks, AND per definition, one backward walk). Superseded 2026-09-29: the
build mines both scopes and all three outcomes (35 chips, 44,799 definitions,
~2.5s in Node; 38 chips and 64,687 definitions since the almanac chips) and writes dist/crowns/<id>.json; a team's page embeds its file,
and opening another team fetches it. A crown = sole longest
active streak under a definition-direction, floors length >= 4 and field >= 10
teams. Definitions producing the identical streak (same last game + length)
collapse to one crown named by the fewest-chip definition; measured collision
rate 2.3 labels per crown, 52% have exactly one label, worst cases are
Army-Navy style where the collapse is exactly right. Sorted simplest-claim
first (chips asc, then length desc) because skip-gap streaks lengthen as chips
stack, so length-first ranking rewards chip-stuffed definitions. Losing
streaks render as a separate "curses" list. Deep link: ?view=crowns&team=id.
Future axis noted: coach-carried streaks across schools (DeBoer 4-0 vs top-10
on the road spans Washington + Alabama) need the coach as streak-holder, not
the team; out of scope for the team boards.

## Amendments (2026-09-28)

What changed after the sections above were written. The README's Rulings and Pipeline
sections carry the data details; this is the product and method record.

- **Two scopes.** Every definition has an all-time board (each team's longest run anywhere
  in the window, ended or live) and an active board. A bare URL opens all-time winning
  streaks vs unranked opponents, the board Alabama's 100 tops; `scope=active` switches.
  Presets always switch to active, because every preset is written as an active claim. In
  the all-time grid an ended run shows its breaker at the top of the column and a live run
  keeps that slot, filled by the team's next game in color with its date, so columns line
  up. The social images mirror the same rule.
- **Team pages replace the crowns tab.** The open team lives at `/team/<id>/`, prerendered
  with its own OG image. The panel shows the claim sentence, the ledger, and "{Team} is the
  King of N [Active | All-time] [Winning | Losing] Streaks" with the two words as selects.
  Crowns are mined at build time (`mineCrowns` in `src/lib/crowns.ts`, run by prerender.mjs); each row applies
  the definition or shares it. Crowns carry scope, start and end season, and whether the run
  is live. Deep link: `/team/<id>/?dir=L`.
- **Starred streaks** left the constraint picker: a right-margin sidebar at 1440px and up,
  a block above "What to read next" below that.
- **Board growth.** "Show more" adds one full row of columns per click on desktop (whole-row
  boundary from the rail width) and 40 on mobile; the label reads "N of M streaks" in
  all-time mode and "N of M teams" in active mode. The limit resets on any definition,
  scope or direction change.
- **Sentence grammar.** Chips read "in conference games" and "in non-conference games";
  state chips use the state name; a trailing context clause follows a comma; length 1 takes
  a singular noun; overtime is its own kind.
- **Overtime chip.** From CFBD line scores (periods beyond four), floor 2001. FBS overtime
  began in 1996, but no source here marks 1996–2000 overtime games, so they cannot qualify.
- **Data audit.** Every 1978–2013 game was compared three ways (Repole, Howell, cfbfastR,
  and CFBD from 2001). Findings: 58 wrong Repole scores, 6 blank bowl scores, 9 reversed
  home teams, 4 wrong lines (each confirmed against every book cfbfastR lists), 2 misdated
  games, 38 games Repole never listed, and 28 neutral-site disagreements settled through
  alt-home.json (renovation-year venues ruled home) and by distrusting CFBD's pre-2005
  neutral flags. CFBD's own scores for UNC at Oklahoma 2001 and Cal at Kansas State 2003
  are wrong. Ranks were clean except the same-day-poll rule (10 games). Coaches: 22
  seasons where CFBD drops a fired coach's row, 42 bowl-only interims, and 33 seasons with
  no CFBD rows at all, every one ruled in `data/ref/coach-overrides.json` with a source.
  The corrections are public at github.com/DrewHoo/repole-errata (CC0).
- **FCS methodology.** A loss to an FCS team breaks a streak and a win over one counts,
  same as any other opponent; a "vs FBS opponents" chip is the right place to change that,
  not the default. A team's own list starts at its latest FBS entry (Streak semantics).
- **Analytics events.** definition, team open, team page, game, games, games year, broken
  week, breakers, show more, share, save streak, unsave streak, apply saved streak, lead apply,
  team streaks scope, week filter, kofi. (leads scope and leads dir went with the panel's list
  of a team's streaks, 2026-10-12.)
- **Social previews.** `gen-og.mjs` draws the real default board and 136 team cards from
  the payload with opentype.js glyph outlines. Crawlers fetch the exact URL's HTML with no
  JS and GitHub Pages ignores query strings, so a shared definition URL shows the root
  image. Options, in order of fit: a Cloudflare worker in front of Pages that rewrites
  `<head>` for query-string URLs and renders the PNG on a second route (needs the domain's
  DNS on Cloudflare; Drew can move it); a client-side share card through
  `navigator.share({ files })`; prerendered paths per preset.
- **sportsdataverse.** `sdv-reference-data` (Sept 2026) has conference, division and
  subdivision membership per team per season for 1869–2026 plus every source's aliases.
  Worth diffing against the Howell-derived membership and canon table, and contributing
  the Repole and Howell spellings as aliases. Nothing there covers results before 2002.

- **1936 window (2026-09-29).** The window starts at the first AP poll. Before 1978 a team counts
  in the seasons Howell lists it as major; streak holders are still this season's FBS teams.
  Undefeated, covering and not covering are the third, fourth and fifth outcomes. The build, the rulings and the research are in
  specs/research/pre-1978.md.

Backlog after this pass: the Cloudflare worker; the "vs FBS opponents" chip; a loss cue on
dark cells (deferred by Drew); coach-carried streaks across schools; sharing the
corrections doc publicly so the README link works for others.

## Opponent identity chips in the miner (2026-10-11)

"Against orange schools" and "vs Bulldogs" should be able to name a crown, show on the team
page, and be in the week's broken and at-stake digests. Today `vscolor` and `vsmascot` are
parameter chips, so none of the three sees them: the crowns miner, `singleStreaks` and
`minePlain` all walk `PLAIN_CHIPS`. Head-to-head is the precedent for a parameter chip in
the digests, and it runs as its own pass in two of them.

So the miner gets a derived list, `MINED_CHIPS` in `src/lib/minedChips.ts`: the plain chips
plus one chip per color (7) and per mascot entry (34, the 27 name groups and the 7 classes).
A derived chip is a real `Chip` with the choice baked into its test and the URL form as its
key (`vscolor:orange`, `vsmascot:bulldogs`), so a crown's `chips` stay `string[]`, the
crowns file needs no new encoding, and `decodeChips` turns the key back into a `ChipRef`
for the sentence, the apply and the share link. The derived chips form one exclusive group,
`identity`: a team has several mascot classes (Bulldogs is also animal and canine), so
without that the miner would walk "vs Bulldogs · vs dog & wolf mascots". One identity chip
plus up to three plain ones.

The three readers switch to the list: `crowns.ts` builds its masks over it and walks it,
`team.ts` iterates it for the single-condition rows (at-stake follows, it reads the team
page's list), and `broken.ts` iterates it in `minePlain`. The definition counts crownRank
charges (`M[k]`) are counted over the same list in one place, so the three agree.

Costs, measured on Drew's Mac. The walk grows from 64,687 definitions to 428k (41 identity
chips times the 8,856 definitions of up to three plain chips). The build-time mine went from
18s to 67s for both scopes, the whole build from 32s to 83s; CI did the mine in 37s before,
so expect ~2.5 minutes there. With no surcharge the crown files grew from 1.05 MB to 2.19 MB in all; with
`identityBits` at 5 (below) they are 1.05 MB again. Page load is unchanged, since a team page
embeds its own file. The
single-condition passes the client runs (team page rows, the broken and at-stake digests)
walk 80 chips instead of 39; the at-stake digest for a week takes ~0.5s in Node.

Flood. With the identity chips costing what any chip costs, 71% of every team's top-six
winning rows carried one (349 of 491), and Alabama's #2 read "49 straight vs unranked
conference animal mascots". Forty-one fresh ways to slice a schedule produce a lot of sole
leaders, and `M[k]` only charges the count. So `RANK.identityBits` charges each identity chip
on top of the chip-count cost, default 5: that leaves 123 of 346 top-six rows with one, and
the big ones (Georgia 50 straight vs animal mascots, Auburn 32 non-conference vs bird
mascots) stay near the top. `M[k]` also grew, which charges every existing crown another
1–2 bits, so a few near the −6.5 cutoff drop (Vanderbilt loses one of its two winning rows).
The per-tier chip cost from the crown score review (claude.ai/artifact/XpW5iUtEUGnVJVWJPz3k2v)
is the fuller answer and is a separate decision; `identityBits` is one tier of it.

Not in this pass: the other parameter chips (state, conference, month, team), which would
multiply the walk again; the identity chips in the + menu's kings (kings.ts already builds
their masks on demand).

## One rule for every streak list (2026-10-11)

Every view of streaks should use the same logic: the team page, the panel's list (since
removed), the matchup's on-the-line list (now the game page's), and the schedule's broken and
at-stake digests, the digests
taking one row per team for their top six. The mined conditions grow to the parameter
chips worth saying (every opponent color, mascot, team and conference; every month and
venue state; leading or trailing at half by any margin), and a streak can carry up to four.

Before this, the four views had three rules. The miner found only a team's sole-longest
runs (its crowns) and only among plain chips; the team page added every single-chip run
at any rank, walked in the browser; the digests walked single chips in the browser too,
never saw a multi-chip run, and ran head-to-head as a pass of their own.

### What changed

`minedChips.ts` is the list the miner walks: the 40 plain chips plus 403 derived ones, each
a real Chip with its choice baked into its test and the URL form as its key (`vsteam:alabama`,
`state:TX`, `month:11`, `leadhalf:1`). The opponent chips form one exclusive group; months and
states are exclusive among themselves. The old `identityBits` and the `M[k]` definition
count are gone.

`crowns.ts` mines every team's run under every definition, not only kings, with its rank,
field and the longest run any other team holds (`second`). The space is 23M definitions, but
an AND only shrinks a mask and the floors (a run of 4+, 10 teams holding any run) are
monotone, so the walk is depth-first carrying each prefix's AND and drops a prefix under the
floors with its whole subtree: 1.03M definitions survive. One walk serves three readings:
`active` (the current run), `all` (the longest ever) and broken (every run a current-season
game ended, placed among what every team carried into that week, which is one more scan per
team and definition rather than a pass per week). A run is kept when it scores above
`KEEP_FLOOR` (the cutoff less 6, so a team with nothing past the cutoff still has its best
few); definitions producing the identical run collapse to the best-scoring telling. Each
scope kept a team's top `ROWS_CAP` (60) after ranking until 2026-10-12, when a team's lists
became every run it leads its field with, no cap and no cutoff (One floor for every list).

`crownRank.ts` is the crown score review's model: `len·log2(1/p)`, plus `gapW·(len − second)·
log2(1/p)`, less `log2(teams)`, less each chip's tier cost (brag 1, plain 3, trivia 9, in-game
12; vsteam and vsconf are brag, leadhalf and trailhalf plain, color, mascot, month and state
trivia) plus `log2` of the chip's choices, since "vs Tennessee" is one of 288 opponents the
walk tried (vsteam 1 + 8.2 bits, state 9 + 5.6, month 9 + 2.3). The gap goes negative for a
run that trails its field: Drew's reading of user feedback is that a #1 fans care about beats
an impressive #3, so a 2nd-place run pays its whole gap (`gapFloor: null`; 0 is the other
variant and keeps a trailing run at its plain score).

`team.ts` reads a team's streaks from its crowns file and adds the next scheduled game each
qualifies for (`nextQualifying`, reading each chip's choice). Head-to-head is now
`vsteam:<id>` as a mined chip, with a field (every team that plays that opponent) instead
of the fixed 2; `h2hStreak`, `h2hStreaksOn`, `h2hRate` and `mineH2H` are gone.
`broken.ts` tells the miner's broken runs per completed week; `digests.ts` builds the
schedule's three digests (every completed week's broken streaks, the first scheduled week's
at-risk streaks, the streak most on the line in each scheduled game) and encodes them as
`dist/games/digests.json`, which the games pages embed and the schedule fetches when opened
from the board. The browser mines nothing on the deployed site; the dev server serves a
build's `dist/crowns/` and digests when they exist and mines in the page otherwise.

### Costs, measured on Drew's Mac

| | before | now |
|---|---|---|
| chips walked | 80 | 443 |
| definitions evaluated | 428k | 1.03M of 23M |
| mine, build time | 67s (two scopes) | ~250s (three readings, one walk) |
| browser walk on a team page or the schedule | 80 single-chip passes | none |

The suite's mining tests share one worker and module cache (`fileParallelism: false`,
`isolate: false` in `vite.config.js`), so the mine runs once per `npm test`.

### What the lists look like

A trailing run's negative gap keeps sole leaders on top (Vanderbilt's "10 straight
non-conference night games after a loss, T-3rd of 90" sits under its #1s). The pooled-rate
artifact remains: a chip that conditions on the team's own weakness (`whileunranked`) lowers
the pooled win rate, so Auburn's "43 straight non-conference games after a loss in Alabama
while unranked" outscores the same run without the word. The 90-game home-and-leading-at-half
run is in Alabama's broken digest but not near the top: a win when leading at half at home
is 90% likely, so 90 of them is 14 bits before the gap.

Not in this pass: the half chips at other margins; the + menu's kings over the derived chips.

### Amendment (2026-10-11, later): the broken collapse and the state chip

Alabama's 18 straight at home · in conference · at night, which Georgia ended on October 10,
was missing from the week-6 broken digest. Two causes. The digest kept one telling per team,
direction and ending game, a rule from when it knew only single-chip definitions; with every
definition in play, every Alabama winning run that loss ended collapsed into the best-scoring
one. And the best-scoring one was "38 straight vs the SEC · in October · in Alabama" at 48.7
bits, because the pooled win rate for games in Alabama vs the SEC is the visitors' (.41), so
each of Alabama's home wins counted as a rare event, and the field was 10 teams with 1- and
2-game runs, so the gap term added 30 more.

So: the miner collapses broken runs per identical run (same direction, ender, start and
length), and a different run the same game ended stands on its own; the digest's top six is
still one row per team, so Alabama's row is its best telling and the rest sit behind "more".
And the venue-state chip never counts a game in the team's own state (`ownSt` on every row,
`chips.ts`): "in Texas" for Texas was "at home" with a rigged rate, and for everyone else it
is the trip there, with an honest one. With both, Alabama's week-6 row is the 90 straight at
home when leading at half (15.5), which Drew confirmed feels right, and the 18 (10.2) is in
"more".

## Game pages: what a game ended, and what it put on the line (2026-10-12)

### What Drew asked for

- `/games/` shows one week's schedule, the selected one, and no other weeks.
- The title's week picker gets a year picker beside it: any season since 1936.
- A played game's row opens the game's own page: the streaks it broke, kept to the ones whose
  team led the field among active streaks when the game was played, and the streaks for which
  a team became the leader as a result of the game.
- An unplayed game's row opens the same address, which shows the streaks the game puts at risk.
- A current-season game shows streaks of up to four chips; an older game, up to two.

### Addresses

One per game, readable and unique back to 1936: `/game/<date>/<away>-at-<home>/`, with `-vs-`
in place of `-at-` for a neutral site (`/game/2026-10-10/georgia-at-alabama/`,
`/game/2026-01-19/indiana-vs-miami-fl/`). A team below FBS has an id in the payload, so the
address still forms. The matchup sheet (`/team/<id>/?vs=<opp>|next`) is the unplayed-game view
today; it goes, and that address redirects in the app to the game's page, so an old link lands.
The team page's next-game card, its schedule ledger (played and scheduled rows), the at-risk
rows, the broken rows' score line ("lost to Georgia 20–17") and the schedule rows all open
the game's page. A game page's share button shares its address; the broken and at-risk digests
keep theirs.

The build prerenders a page per current-season game (about 900 a season), with its own head
and `share/og.png?game=<date>/<away>-at-<home>` as the image. Older games have no file:
the share worker answers a `/game/` path the origin 404s with the app shell, status 200, and
the game's own title, description and canonical read from the season file, and `public/404.html`
boots the app for anyone reaching the origin without the worker. A crawler that runs no JS gets
an old game's head and no rows; current-season pages are the ones that get shared.

### The page

Score line (or the kickoff and the line for an unplayed game), both teams linking to their
pages, then:

- **Played.** "Streaks this game ended": both sides' broken runs whose team was 1st in the field
  as the week began, ties included, best first, six shown and the rest behind "more", no
  one-per-team rule (it's one game). Then "New leaders": every definition under which a team
  is the sole longest active run after the game and was not before it, whether the game ended
  the old leader's run (the new leader may not have played) or the winner's run grew past it.
  Each row is the definition, the new leader's run with its length and the run it passed, and
  opens the board under the definition with the new leader open.
- **Unplayed.** "On the line": every streak either side's run that the game is the next
  qualifying game for, ranked by stake (score × the chance the game ends it, atRisk.ts),
  both sides together, six and "more". Leaders are marked as everywhere else (bold rank).

A run's row reads as the digests' rows do and opens the run's board (a broken run on its
all-time row).

### Data

- **Current season, full space.** The broken walk already records every run a current-season
  game ended, placed in the field as the week began. It adds, per team and definition, the run
  length after each current-season game, so the leader before and after a game is known: the
  new-leader rows come from that, and the rank-1 filter is a line.
- **Past seasons, up to two chips.** A second pass over the 36k definitions of up to two chips
  (my estimate: a few minutes), emitting for every game since 1936 the runs it ended at rank 1
  and the leaders it made. The same scan with the week's entering lengths kept for every week
  since 1936 rather than this season's. Outcomes as the sheet's: W, L, C, N and the 10+
  margins.
- **Files.** `dist/games/<season>.json`: the season's games (date, teams, score, line, week)
  and each game's rows, broken and new-leader, rank-1 only, scores above the broken floor.
  The current season's file carries the full-space rows; `dist/games/digests.json` keeps the
  week digests, the at-risk week and the streak on the line per scheduled game as today, built
  from the same rows. A game page embeds its own rows (current season) or fetches its season's
  file; the schedule fetches a season's file when the year changes.
- **Weeks in a past season.** The schedule's week numbers exist only for the current season
  (`upcoming.wk`). A past season's weeks are the Tuesday–Monday grid counted from the week of
  its first game as week 1, shown with their date spans; bowls and playoffs fall in the weeks
  they were played.

### The schedule page

Year picker (seasons 1936 to now) beside the week picker; the week options are the season's.
Default: the current season, the first scheduled week. For the selected week: its broken
digest once it has been played, the at-risk digest when it's the running week, then that week's
games: a results ledger for a played week (score, how many streaks the game broke, with the
game's top broken run in the claim line in place of the streak on the line), the games that
broke the most first and no day dividers; the schedule for a scheduled week, by day, each game
with how many streaks it puts on the line. A past season's week shows its broken digest from
the two-chip rows; its games are all results.

Only streaks that led the active field (ties included) or were the all-time longest show
anywhere on the schedule: the broken digest, the at-risk digest, the streak on the line and the
counts. No score floor: a game's broken count is every streak it ended (both sides, covering
runs too), a superset of what the streak-breakers page credits the winner for that game, and the
two fold sub-streaks over the same rows, so the numbers nest exactly. A broken row's small print leads with what the run was ("now the all-time longest
streak", a link to that definition's all-time board with no team open, else "was the longest
active streak"), then since when, then the game that ended it without its date
("lost to Georgia 20–17"); the row itself opens the all-time board at the team.

### Rules

- Rank 1 for a broken run includes ties; a new leader must be sole.
- An ended run carries the longest run ever under its definition (`everLen`, and how many teams'
  longest it is, `everN`); a run that long is labeled "now the all-time longest streak" ("now tied
  for the all-time longest" when another team's matches it) on the game page and in the week digest.
- The week picker's options carry the week's dates; the schedule section has a filter box that
  narrows the week to games with a team whose name contains what was typed (page state, not URL).
- A new-leader row needs the new leader's run to be LEN_FLOOR or longer and the definition
  to score above the cutoff for it (the crown score of the new leader's run), so a 4-game run
  that leads a field of fives isn't news.
- A margin run and its plain retelling collapse as in the digests.
- The current-season page and its week digest agree: a game's broken rows are the week
  digest's rows for that ender, before the week's one-per-team cut.

### Build and the worker

The history pass adds to the build and to `npm test`; CI is 25 minutes per push today with
the mine run twice (tests, then build). Separate change, worth doing with this: the test job
reads the build's output rather than mining again. The worker gets a `game` route (shell +
head + card) with `CARD_VERSION` bumped; `shareWords.ts` grows the game's sentence.

### Not in this pass

What a game extended (the runs that survived it). Older games past two chips. Games with no
rows at all still get a page (the score line and "nothing of note").

### Shipped (2026-10-12)

As specced, with these particulars:

- The walk moved into `mineCore.js`, plain JavaScript with no imports, run on one thread per
  core (`mineWorker.js`: Node's worker_threads at the build, Web Workers on the dev server).
  The main thread deals pieces of the walk on demand: the empty definition, each first chip's
  subtree, and for the first 16 chips (the plain ones, whose subtrees dwarf a team's) the node
  and one subtree per second chip. One forward scan per team, definition and result sequence
  yields the trailing run, the longest run, the runs ended and each week's entering length,
  so the four readings share the scan. The field entering each recorded week (best, how many
  share it, second, count) is one typed-array pass per team, so placing a broken run and
  spotting a new leader cost nothing more per week.
- Measured on Drew's 10-core Mac: the mine 47s (365s of CPU; it was 257s single-threaded
  for three readings over the running season only), `npm run build` 2:48 in all, `npm test`
  75s against the build's mine. `dist/` is 84 MB: 885 game pages (32 MB), 91 season files
  (21 MB raw; the 2026 file 95 KB gzipped, 1987's 44 KB), `data/build/mined.json` 253 MB.
- A new leader's row says what happened: "Ohio State now leads: Alabama's 13 ended" when the
  game ended the old leader's run, "past Alabama's 13" when the new leader's own game carried
  it past, "breaking a tie" when the field had no sole leader. The miner carries the old
  leader's length (`prevLen`) for it.
- The dev server (`vite preview` too) has no `404.html` route, so an old game's address
  there hydrates over the board's markup and React logs a recoverable mismatch; the deployed
  site serves the empty shell.

### Shorter tellings (2026-10-12)

The collapse hides only identical runs. The next layer, Drew's: a run is a shorter telling
when the same team holds one under a strict subset of its conditions that is at least as long
("at home at night, 5" beside "at night, 10"); a superset that runs longer stands, since the
extra word skipped a loss. Equal length hides the superset; all-time, the two must overlap in
seasons. One flag on every row (`dup`, set by `markDups` in crownRank.ts where each list is
built: rankCrowns for a team's crowns, the week digests per team, the season rows per game
per team), carried in the three files, so every list hides the same rows: the team page, the
panel, the game page, both digests. On the page a flagged row is a sub-streak, folded beneath
the run it is a sub-streak of (the standing row with the nearest subset of its conditions,
`subsByParent` in StreakRow.jsx) behind "show N sub-streaks" on that row; "see 25 more" pages
through the standing rows (2026-10-12; it was "all N" or "N more"). Drew's wording, in place of a list-end "shorter
tellings" button.

`RANK.olderStands` (default on): a shorter telling that started before the longer run stands
on its own ("at home at night, 5 since 2019" beside "at night, 10 since 2022"). Drew isn't
sure it's the right behavior, hence the switch.

## Top Streak-Breakers

`/breakers/`, in the board's place (the trophy button on the board; a team page's breaks section
links to it). Every team by the streaks it ended by beating their owner in the running season,
from the miner's broken runs over the full four-chip space.

- A break is a winning run (any margin) ended by a loss to the breaker. A losing streak is its
  owner's own story: ending one by losing earns nothing. A covering run ended by a miss counts
  only under the `BREAK.covers` flag (off).
- One telling per run: rows are dup-marked per (owner, ender game) the way the game page marks
  them; a sub-streak is in the file and folds under its run, and doesn't count.
- Only two kinds of run count: the all-time longest (as long as the longest ever under its
  definition, `everLen`) and the longest active (rank 1 as the week began, ties included). Any
  other live run isn't a break here; it is dropped before the sub-streaks fold, so a leading
  sub-streak of a run that didn't lead stands on its own.
- Points per break: `BREAK.points[category] / (1 + BREAK.discount × conditions)`, 10 / 4 and
  0.5. The page never shows points, only the order they make: SKR, Streak King Rank (an ⓘ says
  it "measures a team's season by the rarity of the streaks they broke by beating other teams").
- The leaderboard is dense: a row is the team's logo (no name), its SKR, its streaks broken (the
  all-time and longest-active counts beneath), a pill per team whose streaks it broke (logo and count), and
  its biggest break with "all-time longest" or "was longest active streak". Team, SKR and streaks
  broken are sortable column heads (a second tap reverses).
- A row opens `/breakers/<id>/`, the team's broken streaks: a strip of whose they were (logo and
  count each, a tap filters the list), then the rows, all-time first then by score (12, the rest
  behind "more"), each with the owner's mark. A team page shows its first six under "Streaks broken
  this season" with its count, its SKR and a link to the full list.
- The page's first address, `/stoppers/` (and `/stoppers/<id>/`), still opens it.
- Cards: `share/og.png?breakers=<season>` (the leaderboard's top seven) and `?breaker=<id>` (a
  team's top seven breaks), from rows the prerender writes to `dist/share/weekly.json`.
- The build writes `dist/breakers/<season>.json` (`BreakersFile`: rows per breaker in the
  season-file broken-row shape, plus each breaker's rank) and embeds it in the prerendered
  page; a team page embeds a slice (its own rows, `complete: false`) and fetches the file only
  when a page needs another team.

## One floor for every list (2026-10-12)

Every list of streaks uses one rule: a run counts when it leads its field (rank 1, ties
included), the longest active or the all-time longest, with no score floor past the miner's
keep floor. That covers the broken digest, the at-risk digest (its stake floor is gone), the
on-the-line counts, the game page, the streak-breakers page and a team page.

- A team page's Streaks section has an active / all-time switch, active by default: every
  definition under which the team's current run is the longest active one, or under which a run
  of its is the longest ever. The crowns file carries both lists (no cutoff, no cap); the page
  embeds the active list and fetches the file for all-time.
- Long lists page: the first rows, then "see 25 more · N left".
- The board's team panel no longer lists the team's streaks ("{Team}'s N active streaks"); the
  team page is where they live.

