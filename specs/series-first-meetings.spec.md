# Series pages count every meeting

Status: built 2026-11-10. Follows `series-page.spec.md`. What was built is under "How it's built"; the sections before it are the measurement that started it.

## The problem

A series page should show the record people already know. "Alabama and Tennessee have
played 108 times since 1901" is a number fans, the schools and the press repeat. Ours says
107 since 1903 through 2025. That's the "famous numbers match" rule in `CLAUDE.md` (Drew,
2026-11-10).

`check-wikipedia-list.mjs` (in `research/series-first-meetings/`) compares every rivalry on
Wikipedia's "List of NCAA college football rivalry games" that has a series page with the
page: the first season, and the count of games through the list's last year. Of 246, 146
disagree. We're short games on 138 of them and start late on 135. The whole list is in
`wikipedia-list-check.txt`.

## Why we're short

1. **Before Howell counts a school as major.** `series-early.json` reads jhowell.net's team
   pages, which start in the season Howell counts a school as major, about 1902 for most of
   the South. So the Iron Bowl starts in 1902 (it started in 1893; we have 84 games and the
   list has 90), Alabama–Tennessee in 1903 (1901), Oregon–Oregon State in 1916 (1894; 109
   games against 129). Most of the 146 are this one.
2. **Before a school was FBS.** `gamesOf` skips a team's seasons before its FBS stint, and
   the window's sources only carry major games. So Fresno State–Hawaii has 40 games
   against 57, Louisiana–Louisiana Tech 31 against 87, and App State–Marshall 7 against 28.
   These pairs have a page today only because they cleared `SERIES_MIN` anyway. Others
   don't have one and should.
3. **Wrong joins.** Howell's 1904 "Florida" is Florida Agricultural College, and UF counts
   its program from 1906. His 1902–04 "Florida State College" is mapped to FSU, so
   Florida–Florida State starts in 1904 when it started in 1958. Alabama–Florida and
   Auburn–Florida each pick up a 1904 game the same way.
4. **Games one school counts and the other doesn't.** Utah counts 1896–1921 against
   Brigham Young Academy, and BYU counts from 1922. The list goes with 1896 and 103 games.
   Georgia counts the 1904 game against Florida, and Florida doesn't. Both cases need a
   ruling, not a fix.
5. **The list is wrong or counts another way.** It has The Game at 120 through 2025 when
   it's 121, which looks like a stale count. It has Notre Dame–Stanford starting in 1925
   because the Rose Bowl was January 1, 1925, and we put that game in the 1924 season. These
   rows need a ruling that says so.

## How it's built

CFBD didn't help: it has no Alabama game in 1893 or 1901. Sports-Reference has every
schedule, but its terms restrict reuse. So the early games come from Wikipedia, with
Howell's pages where Wikipedia has nothing better.

`scripts/data/build-series-early.mjs` writes `src/data/series-early.json` from three
sources, each saved to `data/raw/wikipedia/` by a fetch script:

1. **jhowell.net**, as before, for the games before 1936.
2. **Every season article of every FBS team** (`fetch-wp-seasons.mjs`, about 15,300 articles,
   both schedule formats). A game counts when both teams' articles list it, or when the other
   team's article has a row that day with the mirror score whatever it calls the opponent, or
   when the other team has no schedule that season. A game only one article lists is almost
   always against a freshman or reserve team, so it stays out (`series-wikipedia-report.json`
   lists them).
3. **The rivalry articles' results tables** (`fetch-wp-rivalries.mjs`). Where a table's count
   is its infobox's, which is 203 of 222, the table is the famous list itself, so its games
   are the pair's early games in place of the other two sources'. Where it isn't, the table
   only adds games we don't have and corrects a score before 1936.

A source's game is new unless Howell (before 1936) or the payload (since) has it: within a few
days, or in the same season with each team's score. The payload is missing games too (Nevada's
1993 games against I-AA teams), so this checks its actual games rather than assuming a major
team's season is whole. Of the unmatched ones, as many as the existing games of the pair that
season left unmatched are those same games dated or scored another way (the Egg Bowl's 1942
game is November 28 in the payload and November 21 in the article). The running season's
games are the payload's alone, since the scheduled refresh adds them.

Forfeits and vacated wins come from the season articles' `w/l = f` and `v` marks and the
tables' `winN=` notes. `data/ref/series-rulings.json` holds the rest:

- `programs`: Florida State's games before 1947 (Florida State College) and Florida's before
  1906 (the Lake City school) belong to other schools, except Florida–Georgia 1904, which
  Georgia counts.
- `drop`: Howell's wrong joins (Mississippi A&M's 1908 opponent was Southwestern
  Presbyterian; Tulane's 1911 opponent was Louisiana Normal) and the 1918 Big Game, which
  neither school counts.
- `known`: where we've ruled an infobox wrong. Each row says why and quotes it.

## The gate

`series.known.test.ts` checks every series with a Wikipedia rivalry article, 223 of them,
against its infobox (`data/ref/series-known.json`, built by `build-series-known.mjs` with the
lines quoted): the year of the first meeting, the meetings and the record. It counts through
the infobox's latest meeting and takes off the table's games after the payload ends, so a
weekly refresh doesn't move it.

The `known` rulings fall in four kinds:

1. The infobox is a year stale (the Big Game's 127 is through 2024).
2. Its sum is off (the Rivalry in Dixie's record adds to 54, not its 55 meetings).
3. Its first meeting is another sport's (I-35, the Battle for the Bones).
4. It counts the score as played where the page applies the forfeit or vacated win (Fresno
   State's 1979 forfeit win, Iowa's 2023 win, SMU's 1998 win, Tennessee's 2019–20 wins).

The fourth kind is a judgment call (see below).

The lead says "since their first meeting in 1893", the year of the first meeting's date (the
first Iron Bowl was February 1893, in the 1892 season).

The 1,000 or so series without a rivalry article have no known answer to check. They get the
same sources and rules.

## Nothing else changes

The early games stay the series pages' only. No streak, board or mine reads a game before
1936 or a school's games before its FBS stint.

## Rulings (Drew, 2026-11-10)

1. **Superset.** A game either school counts is a meeting: Utah–BYU from 1896, Florida–Georgia
   from 1904. Where an infobox gives each school's count, the page matches the larger.
2. **The famous record.** A forfeit counts for the team it was forfeited to, and a vacated win
   is a meeting in neither team's record ("Alabama leads Tennessee 60-41-7 in 109 games"). The
   score on the page stays as played, with "Tulane by forfeit" or "Alabama's win vacated"
   beside it. This replaces "scores as played" on the series page only. Streaks and boards still
   read the scores.
3. **New pages.** Pairs the new games push over `SERIES_MIN` get pages.

## Open

1. **The infobox that doesn't apply a vacated win.** Wikipedia's infoboxes disagree with
   each other here. Alabama–Tennessee's takes out Alabama's 2005 win, while Iowa–Iowa State's
   keeps Iowa's 2023 win. I went with the NCAA's ruling everywhere, so those four series
   read one win off their infobox. The other way is to follow each infobox, which makes the
   rule depend on who last edited the article. WDYT?
