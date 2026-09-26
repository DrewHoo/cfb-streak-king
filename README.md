# cfb-streak-king

Design a streak definition out of up to four constraints (on the road, vs
ranked, as an underdog, in November) and rank every current FBS team by its
active winning or losing streak under it, 1978–present. Live at
[drewhoover.com/cfb-streak-king](https://drewhoover.com/cfb-streak-king/).

The spec is [specs/cfb-streak-king.spec.md](specs/cfb-streak-king.spec.md);
the research reports behind it are under [specs/research/](specs/research/).

## Data provenance

All raw sources cache under `data/raw/` (gitignored, re-fetchable). The
committed artifacts are `data/payload-base.json` (seasons 1978–2025) and the
versioned rulings under `data/ref/`.

| dataset | source | coverage |
| --- | --- | --- |
| Game spine, scores, sites, spreads | Warren Repole's Sunshine Forecast XML (`cfblines.zip` + `bowllines.zip`, recovered via the Wayback Machine; the live site is dead) | 1978–2013, 25,910 games, 19,904 lined |
| Game spine, kickoff times | cfbfastR-data schedule CSVs | 2002–present (spine 2014+) |
| Spreads | cfbfastR-data `cfb_line_odds.csv.gz`, per-game median closing line | 2006–2025 (2014+ used) |
| Weekly AP polls | collegepollarchive.com pages | 1976–present |
| Conference by season, conference-game marks, FBS membership | jhowell.net team pages + byconf.htm | 1978–2013 (+membership to present) |
| Rivalry pairs | Wikipedia {{Trophy game}} templates | 237 FBS pairs |

Conventions inherited from sibling projects (hostile-territory,
spread-vs-ap): `homeSpread` negative = home favored; cfbfastR UTC dates
resolve to local dates through the home team's timezone; team names
canonicalize through `data/ref/name-aliases.json` and unmatched names are
reported, never dropped.

## Rulings

- `data/ref/alt-home.json`: off-campus sites that count as home (Legion
  Field for Alabama, War Memorial for Arkansas, …). Everything else with an
  off-campus tag is neutral. `parse-repole.mjs` prints the full
  (team, city) frequency table for review.
- Conference game = jhowell's per-game `*` mark before 2009, the cfbfastR
  flag after (it is noisy earlier).
- Ties (pre-1996) end streaks in both directions.
- A streak reaching 1978 displays as "N+".

## Validation

Known-answer checks run inside `build-payload.mjs` and fail the build:
Alabama's 100 straight wins over unranked teams (ended 2021-10-09 by Texas
A&M), Kansas's 46-game road losing streak (ended 2018-09-15 at Central
Michigan), Vanderbilt's 26-game SEC losing streak (ended 2022-11-12 by
Kentucky). The Repole XML parse also cross-checks against the independent
CSV parse from spread-vs-ap (25,910/19,904 exact match).

## Pipeline

```
node scripts/data/parse-repole.mjs     # repole XML -> data/build/spine-1978-2013.json
node scripts/data/parse-schedules.mjs  # cfbfastR CSVs -> data/build/schedules-2002-2026.json
node scripts/data/parse-jhowell.mjs    # team pages + byconf -> conf/fbs/marks
node scripts/data/parse-polls.mjs      # CPA pages -> data/build/polls.json  (FROM=1976 TO=2026)
node scripts/data/parse-rivalries.mjs  # wikitext -> data/build/rivalries.json
node scripts/data/gen-team-info.mjs    # -> data/ref/team-info.json (state + tz)
node scripts/data/build-payload.mjs    # join everything -> data/payload-base.json (committed)
node scripts/data/build-current.mjs    # + in-progress season -> src/data/payload.json
node scripts/gen-logos.mjs             # one-color marks -> public/logos/<espnId>.png
```

CI runs only `build-current.mjs` (it fetches the current schedule CSV and AP
poll pages) before `npm run build`, on push and on a twice-weekly cron.

## Not here yet

Coach chips, halftime chips, time-of-possession chips, and current-season
spreads all wait on a CFBD API key (free tier covers it; see the spec's data
pipeline section). ATS cover streaks are a designed-but-unbuilt outcome axis.
