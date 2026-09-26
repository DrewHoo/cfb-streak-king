# Research: data coverage for the 1978–2025 spine (Opus agent report, 2026-09-26)

Spreads (1978–2013 Repole, 2006–2025 cfbfastR) and AP polls (1970–2025
collegepollarchive) are solved upstream in ~/Projects/spread-vs-ap and were skipped.
The agent had no CFBD API key; CFBD claims come from the live OpenAPI spec (v5.31.1),
the public server source (github.com/CFBD/cfb-api-v2), the cfbfastR-data CSVs, and a
third-party 1985 CFBD pull.

## A. Game spine 1978–2000

Best source: jhowell by-date files via Wayback, one per season 1869–2013:
`http://web.archive.org/web/2021id_/https://wilson.engr.wisc.edu/rsfc/history/howell/cf{YYYY}gms.txt`
Fixed-width: `MM/DD/YYYY Visitor(27) vscore Home(27) hscore [@ City, ST]`. The `@ City`
suffix means off-campus. Includes I-A vs I-AA games; 1985 has 673 rows. Files are
windows-1252.

Live alternative: jhowell.net per-team pages (`/cf/scores/{Team}.htm`, 306 teams,
updated 2026-01-27, runs to present). Season header `1985-Alabama (SEC)` gives
conference per season; `*` prefix marks conference opponents; bowl names in the site
column. hostile-territory already parses these for 1990–2000.

Repole as spine: yes, mostly. Repole's game list is essentially jhowell's (1985: 655
regular-season rows + bowls ≈ jhowell's 673, scores and dates match, includes I-AA
opponents). CSV columns: Date,Visitor,Visitor Score,Home Team,Home Score,Line. **The
CSV has no neutral flag but the XML does**: neutral games carry `info="@ Anaheim CA"`,
and each team carries `<site>V|H</site>`. 1985 has 27 regular-season neutral tags. The
spread-vs-ap README's "no neutral flag" limitation is only true of the CSV; the .xml
files sit next to the CSVs in data/raw/repole/cfblines/.

jhowell site marker has three states: `@` = true road; `vs.` alone = home; `vs.` +
`@ City` = off-campus, covering both true neutrals (Red River, Florida–Georgia,
Army–Navy) and alternate home stadiums (Alabama at Legion Field, 60 games 1990–2000;
Arkansas at Little Rock, 71). 381 unnamed alternate-site games in 1990–2000 need a
ruling/override file.

Name styles: Repole mixes formal and shorthand (`Texas A+M`, `U-C-F`, `Southern Miss`,
`UL-Lafayette`, `Louisiana State`); jhowell is formal (`Mississippi`, `Southern
California`, `Texas-El Paso`, `Miami (Florida)`). spread-vs-ap's name-aliases.json
already bridges them.

Fallback: CFBD /games?year=Y (48 calls). Pre-2001: startDate always midnight UTC;
conferenceGame/attendance/venue null; neutral flagged only on bowls (13/13 checked 1985
disagreements vs jhowell were CFBD missing neutral sites); one plain home/away error
found (1985 LSU–Alabama listed as Alabama home; it was Baton Rouge); conference labels
historical (PCAA, Big 8, Southwest). Whether pre-2001 CFBD includes I-AA opponents is
unverified (the third-party 1985 dump had only FBS-vs-FBS, 564 vs 673 rows).

## B. Head coaches

CFBD endpoints:
- `GET /coaches?minYear&maxYear` (1 call): {id, firstName, lastName, hireDate,
  seasons:[{teamId, school, conference, year, games, wins, losses, ties, ...}]}.
  Midseason change = two coaches with partial-game season rows for the same team-year.
- `GET /coaches/tenures?team=X` (~130–250 calls, requires team or coachId): {coach,
  team, hireDate, startYear, endYear, effectiveStart, effectiveEnd, isInterim, active,
  record, attributionComplete}. Server assigns each game to the tenure whose
  effectiveStart <= kickoff < effectiveEnd, then checks W-L against coach-season rows;
  attributionComplete=false when a game lands in zero or two intervals or records
  mismatch. Trust that flag.
- `GET /coaches/seasons`: adds recordSplits; not needed.

Coverage claimed back to 1886. Unmeasured: how many pre-2000 team-years have
attributionComplete=false; count them first with a key. Interim coaches are separate
tenure rows with isInterim=true; the "vs specific coach" constraint needs an interim
rule. Fallbacks: hostile-territory's 818 researched tenure rows (power conferences
1990+, exact midseason dates, verbatim quote each) in
~/Projects/hostile-territory/data/research/tenures-*.json; Wikipedia "List of {School}
head football coaches" via ?action=raw. espn_cfb_coach_careers only covers 2004+
aggregates, useless here.

## C. Conference membership and conference-game flag

- CFBD `GET /conferences/affiliations?minYear=1978&maxYear=2025` (1 call): {teamId,
  team, conference, abbreviation, classification, division, startYear, endYear}
  intervals, 1869+. /games' homeConference/awayConference are computed from these same
  intervals.
- `GET /conferences/changes?year=Y` gives year-by-year moves.
- Independent check: jhowell season headers + `*` markers (jhowell labels only I-A
  conferences; everyone else reads "Independent").

Conference-game flag: 1978–2000 CFBD is null (use jhowell `*` or derive same-conference).
cfbfastR conference_game is unreliable before ~2009 (2001: 24 cross-conference FBS
games flagged TRUE, e.g. Wisconsin–Virginia; 2005: 8; 2011: 0). 2025's 15
same-conference-flagged-FALSE games are correct (scheduled non-conference meetings
between members, and CCGs). Recommendation: conference game = same conference that
season + overrides file (non-conference meetings between members, championship games);
source flag as cross-check 2009+.

## D. FBS membership by season

Best: jhowell `http://www.jhowell.net/cf/scores/byconf.htm`, explicit year ranges per
team (`Southern Methodist (1916-1986, 1989-present)`, `Connecticut (1979, 2000-2019,
2021-present)`). Correctly shows the 1982 drops (Ivy, Southern, Southland) and 1985
Missouri Valley exits. Live and easy to parse. Cross-check: CFBD /teams/fbs?year=Y
(48 calls) or affiliations?classification=fbs; independents sit in an "FBS
Independents" pseudo-conference. I-A began 1978, matching the window.

## E. Kickoff time / night games

1978–2000: nothing in any free bulk source. 2001+: cfbfastR start_date is a UTC
instant; 2001 uses T04:00:00Z placeholders (51 FBS games); 2001–2013 start_time_tbd is
NA so real 8pm-ET kicks and placeholders are indistinguishable at midnight UTC; from
2014 the TBD flag is filled. Local time needs venue timezone (CFBD /venues). Realistic:
night game reliable from ~2002, best from 2014; before 2001 the constraint must show as
unavailable, not false. Date derivation: shift UTC −8h (99.5% match vs jhowell dates;
raw UTC only 76.6%).

## F. Bowls, opener/finale, rivalries

Bowls: CFBD seasonType=postseason; jhowell site column names bowls and CCGs; Repole
keeps bowls in separate bowllines files. CFP campus games (2024+) are real home games
(hostile-territory rules.json handles this). Opener/finale: derive from team-season
games sorted by date; decide whether finale includes bowls/CCGs. Rivalries: Wikipedia
"List of NCAA college football rivalry games" wikitext has 417 {{Trophy game}} template
rows plus 5 wikitables for three-way trophies; fetch via
`en.wikipedia.org/w/api.php?action=parse&page=List_of_NCAA_college_football_rivalry_games&prop=wikitext&format=json`.
Treat a rivalry as the team pair in any season. No better bulk list found.

## G. Attendance, TV, venue, weather

- Attendance: CFBD null pre-2001; cfbfastR has 2001–03, 2006–08, 2012–24; **zero for
  every FBS game in 2004–05, 2009–11, 2025** (treat 0 as missing).
- Venue: CFBD null pre-2001; cfbfastR ~85% filled 2001–2013, 100% from 2014; /venues
  gives city, state, timezone, lat/lon, dome, grass. Pre-2001 location data is only the
  off-campus city strings.
- TV: CFBD /games/media {mediaType, outlet}; first covered year unverified, expect
  2010s.
- Weather: CFBD /games/weather is paid (Patreon tier). Out.

Spread sign conventions: Repole CSV Line positive = home favored; Repole XML per-team
line negative = that team favored; CFBD/cfbfastR spread negative = home favored.

## H. CFBD tier and terms

Free 1,000 calls/month; Academic (.edu) 3,000; Tier 1 $1/month 5,000. Bearer token;
unauthenticated = 401. Full pull budget ≈ 500 calls (/games ×48, /coaches ×1,
/conferences/affiliations ×1, /coaches/tenures ×150–250, /teams/fbs ×48, /games/media
×48). Bulk CSVs avoiding the API: cfbfastR-data schedules 2001+ only (pre-2001 404s);
sportsdataverse-data releases (csv.gz/parquet, 2001+); espn_cfb_schedules (2004+, no
broadcast column). Terms: caching encouraged, attribution optional, derived outputs
fine; **may not publish API data "as a standalone dataset or bulk download" or a
"public database mirror"** — ship our own compact multi-source encoding, keep raw CFBD
pulls out of git.

## Summary table

| Field | 1978–2000 | 2001–2013 | 2014–2025 | Primary source |
| --- | --- | --- | --- | --- |
| Results, date, home/away | yes | yes | yes | Repole XML / jhowell; cfbfastR 2001+ |
| Neutral site | yes + alternate-home rulings | yes (flag wrong some 2001–07) | yes | Repole XML info / jhowell; cfbfastR |
| Spread | solved upstream | solved upstream | solved upstream | Repole; cfbfastR lines |
| AP rank at kickoff | solved upstream | ″ | ″ | collegepollarchive |
| Conference by season | yes | yes | yes | CFBD affiliations; jhowell headers |
| Conf-game flag | derive / jhowell `*` | derive; flag noisy <2009 | flag OK + overrides | derived + overrides |
| FBS membership | yes | yes | yes | jhowell byconf; CFBD /teams/fbs |
| Coach per season | yes | yes | yes | CFBD /coaches |
| Coach per game | probably (check attributionComplete) | probably | yes | CFBD /coaches/tenures; HT tenures |
| Kickoff/night | no | partial | yes | cfbfastR + venue tz |
| Bowl/postseason | yes | yes | yes | jhowell/Repole bowllines; CFBD |
| Opener/finale | derived | derived | derived | spine |
| Rivalry/trophy | yes (static) | yes | yes | Wikipedia {{Trophy game}} |
| Attendance | no | patchy | yes (0 in 2025 file) | cfbfastR |
| Venue | city string only | ~85% | yes | cfbfastR + /venues |
| TV | no | unverified | unverified | CFBD /games/media |
| Weather | no | no | no | — |

## Recommended pipeline (agent's)
1. Spine 1978–2013 from Repole XML (dates, V/H, neutral info tags, lines in one row);
   validate against jhowell by-date files, flag disagreements.
2. Spine 2014–2025 from cfbfastR schedules; check the seam on the 2006–2013 overlap.
3. Alternate-home overrides (Legion Field, Little Rock, Jackson, Memphis, Milwaukee…).
4. FBS universe from jhowell byconf.htm, cross-checked vs CFBD.
5. Conference by season from CFBD affiliations; conf game = same conference + overrides;
   cross-check jhowell `*` for 1978–2013.
6. Coaches from CFBD /coaches + /coaches/tenures; attributionComplete=false team-years
   fall back to HT tenures or a cited override.
7. Rivalries: one-time Wikipedia {{Trophy game}} parse.
8. Unavailable fields render as unknown, never false (night/attendance/TV pre-2001;
   night partly 2001–2013).
9. Canonical team IDs: extend spread-vs-ap's name-aliases.json (cfbfastR itself
   switches names between seasons: Southern Miss/Southern Mississippi, UConn/Connecticut).

Checks needing a free CFBD key: pre-2001 /games I-AA inclusion; count of
attributionComplete=false team-years 1978–2000; first /games/media year.
