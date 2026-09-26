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
- **Ties break streaks in both directions.** Ties only exist before overtime arrived in
  1996. An "unbeaten" outcome mode (wins + ties) is a possible later addition, not v1.
- A streak that reaches the window edge displays **"N+"**. We never claim a streak
  equals N when 1977 could extend it.
- When a betting constraint is active and a qualifying-by-other-criteria game has no
  line, the game's favorite status is unknown, so it doesn't qualify. About 77% of
  1978–2013 games are lined; 2006+ is near-complete. Same rule for the night-game
  constraint before kickoff times exist.
- Teams shown: the current FBS membership (~136). Opponents can be anyone, including
  FCS teams, and those games count. FCS teams just don't get leaderboard rows.

## Constraint catalog (v1)

Every chip below is computable from the spine for the full window unless a floor is
noted. Users pick at most 4; chips within a group are mutually exclusive where marked.

| group | chips | notes |
| --- | --- | --- |
| Site | home / road / neutral / away-from-home | exclusive. Alternate home stadiums (Legion Field, Little Rock) ruled home via overrides |
| Opponent rank | vs ranked / vs top 10 / vs top 5 / vs unranked | AP poll in effect at kickoff |
| Own rank | while ranked / while unranked | own AP rank at kickoff |
| Betting | as favorite / as underdog / as 7+ dog / as 14+ dog / close spread (\|s\| ≤ 3) | closing line; unlined games skip |
| Conference | conference game / non-conference / vs [specific conference] | as of that season; conf game = same conference + overrides |
| Opponent | vs [specific team] / rivalry games / in-state opponent | rivalry = Wikipedia trophy-game pair list; in-state via school-state table |
| Coach | under [own coach, incl. "current"] / vs [specific opposing coach] | per-game attribution for midseason changes; "vs Saban" spans his teams |
| Calendar | in [month] / season opener / regular-season finale / bowl+postseason | month by local date; Week 0 folds into September |
| Context | after a loss / after a win / after a bye | previous game in the team's own timeline; bye = 13+ days rest |
| Game shape | one-score game (≤8) / shootout (60+ combined) | post-hoc: the filter reads the final score. Famous framing ("won 9 straight one-score games") justifies keeping it |
| Score state | leading at half / trailing at half | halftime score from CFBD quarter line scores. **floor: ~2001** (exact floor needs a key check). Anchor stat: Alabama 178-9 when leading at half under Saban |
| Possession | dominated TOP (60%+ of clock) | CFBD team box stats. **floor: ~2004** (needs a key check) |
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

One page. Chip picker on top, direction toggle (W streaks / L streaks), board below.

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
8. **Coaches**: CFBD /coaches (season level) + /coaches/tenures (per-game midseason
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

CFBD budget: ~550 calls total, inside the 1,000/month free tier. CFBD's terms prohibit
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
- Unbeaten mode (ties don't break).
- FCS/D-II boards.
- Historical (non-current) streak leaderboards. The premise is current streaks only.

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
