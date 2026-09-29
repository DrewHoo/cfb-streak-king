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
  1996. A third outcome, **unbeaten** (wins and ties), shipped 2026-09-29: `dir=U` in the
  URL, a third word in the direction menu and the crowns select.
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
| Possession | won the clock (>50%) / dominated the clock (60%+) | SHIPPED 2026-09-27. CFBD /games/teams possessionTime, floor 2004 |
| Kickoff | night game (6pm+ local) | **floor: 2002**, solid from 2014. Board shows "within available data (2002+)" |

Cut from v1 after research: TV network (coverage unverified before the 2010s), weather
(paid tier only), attendance (zeroed for whole seasons), uniforms and homecoming
(curation cost with no bulk source), vs No. 1 and CFP-only (degenerate, 0–2 game
streaks), P4-vs-G5 tier (the tier concept doesn't exist before 2014 and back-defining
it is a judgment project).

## Presets

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

- ATS cover streaks and over/under streaks as alternate outcome axes. The data
  supports covers for 1978+ and the research says model outcomes separately from
  filters, so the door stays open. It roughly doubles the semantics surface (push
  handling, unlined-game gaps), and straight-up W/L ships the product.
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
~2.5s in Node) and writes dist/crowns/<id>.json; a team's page embeds its file,
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
- **Analytics events.** definition, preset, team open, show more, share, save streak,
  unsave streak, apply saved streak, lead apply, leads scope, leads dir, week filter.
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
  Unbeaten is a third outcome. The build, the rulings and the research are in
  specs/research/pre-1978.md.

Backlog after this pass: the Cloudflare worker; the "vs FBS opponents" chip; a loss cue on
dark cells (deferred by Drew); coach-carried streaks across schools; sharing the
corrections doc publicly so the README link works for others.
