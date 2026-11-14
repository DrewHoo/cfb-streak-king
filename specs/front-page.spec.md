# The front page: the few streaks worth knowing, and whether the next game tests them

Status: built 2026-11-14 (`front.ts`, `Front.jsx`, `nextGame` in `createModel.ts`). Drew's calls are under Settled at the end. Drew picked treatment A (its own page) and, the same day, on-the-line only (below). Not deployed.

## The problem, measured

`/` is the builder on one definition, all-time winning streaks against unranked opponents. A reader has to change the definition before the site shows them anything it picked. `research/engaged-visitors.md` has the numbers through 2026-10-16: 55% of visitors who loaded it did nothing else we track, and 64% never made a first change.

The site already knows which streaks are interesting. The list rule scores every team's active streaks, and `/games/at-risk/` knows which ones a game puts on the line. Neither is on the front page.

I measured what a front page would list on the 2026-11-03 payload (week 10, 63 games, 62 with a line), mining fresh and listing every FBS team's active simple streaks with the shipped knobs, sub-streaks left out:

| | rows |
|---|---|
| listed active simple streaks, all teams | 8,283 (median team 62) |
| no qualifying game left on the schedule | 5,147 |
| a condition `nextQualifying` can't read before kickoff | 2,558 |
| a qualifying game scheduled | 578 |
| a qualifying game that week | 182, across 66 teams |

Two things follow.

**"Active" includes frozen runs.** A run is active until a qualifying game ends it. So Boise State's 73 straight over unranked WAC opponents is active (last game 2011), and it has the highest score on the site. Texas A&M's 24 over TCU (last game 2001) is sixth, and Nebraska has three runs against the Big 8 in the top 25. 3,200 of the 8,283 rows last had a game five or more seasons ago.

**The best streaks are rarely tested in a given week.** Of the top 25 by score, one per team, two were on the line in week 10. So the page can't be a list of what's on the line (that's the at-risk page). It's the standing list, and each row says whether the team's next game tests it.

## The rule

The front page is a view of the list rule. It admits nothing and re-words nothing. It filters and orders; nothing is cut.

1. **Rows.** Every FBS team's Active section as its team page lists it: `listCrowns(active, ctx, knobs, 'simple')`, sub-streaks left with their runs. Same words, same rank, same score.
2. **Current.** A run stays when its last game was this season or last (`endSe >= currentSeason - 1`). That keeps 3,014 rows across 133 teams and drops the frozen ones. It also drops Penn State's 28 straight over West Virginia (1959–2024), a real streak between two teams that meet every few years, and it would drop Tulane's 30 rivalry losses to SEC teams in a year they don't play one. We'll look at who it drops each August.
3. **One per team.** A team's best row. Alabama has two of the top four otherwise, and Georgia four of the top ten.
4. **On the line.** Only the runs the team's next game puts on the line, and only in the first scheduled week, the one the heading names and the at-risk page reads (a team off that week, like Stanford in week 10, waits for the next payload though its game is within 8 days) (`FRONT.onLine`, Drew 2026-11-14: "a very long and impressive streak that is unlikely to be tested by a game might dominate the view week by week and that would be boring"). Before this, Alabama's 90 at home against unranked opponents led the page, and it would have led it every week.
5. **Order.** The score. The page shows a place (1, 2, 3), never points.
6. **Ten, then "see more".** The first `FRONT.top` (10) rows show; the rest page behind "see more", 25 at a time (Drew, 2026-11-14). This replaced a cut at the largest drop in score between neighbors (at least 3, at most 10), which kept three or four rows a week.

On the 2026-11-03 build, before the on-the-line rule and with the old cut, that was four rows:

| | streak | since | score (not shown) | week 10 |
|---|---|---|---|---|
| 1 | Alabama won 90 straight · unranked · home | 2008 | 39.1 | not tested, a later game qualifies |
| 2 | Georgia won 38 straight · unranked · away from home | 2015 | 38.2 | no qualifying game left in 2026 |
| 3 | Notre Dame won 19 straight by 10+ · rivalry | 2023 | 33.7 | not tested, a later game qualifies |
| 4 | Kansas lost 25 straight · rivalry | 2009 | 28.8 | no qualifying game left in 2026 |
| | *the cut: a 7.8 drop* | | | |
| 5 | UMass lost 24 straight · vs MAC opponents | 2021 | 21.0 | on the line vs Ball State, UMass -3 |
| 6 | Air Force won 20 straight by 10+ · season openers | 2007 | 20.3 | |
| 7 | Tulane lost 30 straight · rivalry · vs SEC opponents | 1988 | 19.0 | |
| 8 | Indiana won 29 straight · unranked | 2024 | 18.8 | |
| 9 | LSU won 38 straight · in-state opponents | 1983 | 17.8 | |
| 10 | UTEP lost 42 straight · power-conference opponents | 1998 | 17.6 | |

Under the list sits "every team's streaks", which opens the team picker.

The knobs are `FRONT = { max: 10, min: 3, seasons: 1 }` in `list.ts` beside `LIST`, so `?tune=1` shows them and the "why" under a row works as it does everywhere.

## What each row says about the next game

The request was to show which streaks are likely to be tested in the upcoming game. With four to ten rows there's room to say it in words on every row. A row's second line is one of:

- **On the line.** "On the line Saturday vs Ball State · UMass -3". The row gets the rust mark the builder's open column has. The game's words open the game page. No chance: beside a streak of 90, a number from a point-spread model reads as more exact than it is (Drew, 2026-11-14).
- **Likely on the line.** The same line with "likely", when the game qualifies as of the build but the line can move before kickoff (as a favorite, as an underdog, a close line). The poll could move too, but the next game is after this week's poll, so a ranked or unranked condition reads as sure.
- **Might be.** "Counts only if it's a one-score game", for a condition that's settled during the game (one-score, shootout, overtime, the halftime score, possession). No chance shown.
- **Not this week.** "Saturday at LSU doesn't count · next Nov 28 vs Auburn". Names the team's next game and the next one that qualifies.
- **Nothing left.** "No game left in 2026 counts".

"The upcoming game" is the team's next scheduled game when it's within 8 days, the builder's `onTheLine` window (`createModel.ts:249`).

### `nextQualifying` learns the conditions that are already settled

Today a streak with any postgame chip has no next game at all (`team.ts:82`), which is 2,558 of the 8,283 rows. Most of those conditions are known for the team's next game when the build runs:

| condition | rows | known for the next game from |
|---|---|---|
| after a loss, after a win | 627 + | the team's last result |
| after a bye | 188 | the gap to the next game |
| favorite, underdog (by 7, by 14), close line | 1,574 | `upcoming.sp`, the line as of the build |
| in-game shape, half, possession | 275 | nothing, until it's played |

So `nextGame` (`createModel.ts`, which `nextQualifying` and the builder call) returns the game with how sure it is: `sure`, `likely` (it read the line) or `open` (an in-game condition). It answers for the team's next game only when a condition depends on the game before it.

This changes every view that reads it, which is the point of doing it there. The at-risk digest, a scheduled game's "N on the line", the game page and `topOnLine` all gain the same rows, so the numbers still nest. Ohio's 15 straight wins coming off a loss (16th on the list above) shows as on the line the week after Ohio loses, on the front page and on the at-risk page both. The builder has its own copy (`createModel.ts` `makePre`). It should call the same function.

A streak with an `open` condition stays off the at-risk order, since it has no chance to rank by.

## Where the builder goes

Treatment A, Drew's pick (2026-11-14): `/` is the dateline, the h1, the tagline ("Every college football streak you can possibly think of. Win, lose, draw, or cover!"), "On the line in Week N" over the list, a "build your own streak" link, "Every team's streaks", the named definition pages (`Landings`), and the notes. The builder moved to `/build/`. An old link with any definition param on the root (`/?c=home,confgame,night`, `?dir=`, `?scope=`, `?t=`, `?as=`) still opens the builder, and `toUrl` writes the builder under `/build/`. The landing pages don't move. The share worker words `/build/?c=…` as it words `/?c=…` today. Treatment B (the list above the builder at `/`) was tried on the dev server and dropped.

On the 2026-11-03 payload (week 10), 81 teams had a streak on the line and the cut kept four: UMass's 24 straight losses to MAC opponents (vs Ball State), UTEP's 13 straight failures to cover as an underdog (vs Hawaii, likely: it read the line), Utah's 14 straight wins (vs BYU) and SMU's 17 straight at home against conference opponents (vs Virginia Tech). Northern Illinois's 10 straight losses was fifth, below a drop of 2.3. On the live 2026-11-13 payload (week 11, the Nov 14 games), the first three are Notre Dame's 19 straight rivalry wins by 10+ (vs Boston College), Utah's 15 straight wins (at Arizona) and SMU's 18 straight at home against conference opponents (vs Wake Forest), then Stanford's 15 straight road losses, Northern Illinois's 11 straight losses, UCLA's 10 straight covers and Oregon's 31 straight over unranked animal mascots; 79 in all. Screenshots, week 11 with the first ten: [desktop](research/front-page/desktop.jpg), [phone](research/front-page/phone.jpg).

## Words

"Board" stays in the code (`activeBoard`, `asBoard`, the `board` action). Readers saw it in one place, the "Streak boards" heading over the named definition pages, which becomes "Longest streaks by category".

- The link to the builder says "Build your own streak". The address is `/build/`. A verb says what the reader does there, and the site's subtitle already says "Design a streak. Crown a king."
- I'd avoid "the builder" as a noun in the UI. Nothing needs to call the page anything except the link to it and its h1, which stays "Streak King" or the definition's own h1.
- "On the line" is already the site's phrase for a streak a game can end. "At risk" is the same thing on the schedule. This spec uses "on the line" for a row and leaves the at-risk page's name alone.

## Data and the build

- `front.ts`: `frontBest` returns each team's best on-the-line row in order, and `frontPage` splits it into the first ten and the rest. Pure, so the worker and the prerender share it.
- The prerender writes `dist/front.json`: each team's five best current rows under the shipped knobs, as `CrownRow`s with the team, weight-free like every other file. About 650 rows, so the tuner has rows to reorder. A knob that reaches past a team's fifth row is out of range, and the tuner says so.
- `/` embeds the first `FRONT.max` teams' rows under `initial.front` and renders from the decoded slice, so the hydrate matches. The first render's "today" is `builtEpochDay`, as everywhere.
- The dev server without a build mines in the page, as the digests do.
- The next-game lines come from the payload's `upcoming`, which every page already has.

## Addresses, search and the card

- `/` keeps its title and canonical. Its description becomes the list in a sentence: "Alabama has won 90 straight at home against unranked opponents. Georgia, Notre Dame and Kansas hold the other streaks nobody else is close to." It's written by the prerender from the rows.
- The page carries an ItemList in JSON-LD and a line per row in `llms.txt`.
- `/build/` goes in the sitemap. It's the address the default definition has had, so it isn't a landing (`landing.test` still holds, reworded).
- The root's card becomes the worker's: `share/og.png?front=1`, the list's rows with each team's mark and the length in Graduate, and "N on the line this week" when there are any. The rows go in `dist/share/weekly.json`. Bump `CARD_VERSION`. `public/og.png` stays as the fallback.
- The page reads now and nothing else. There's no address for last week's list, which goes against the convention that a point-in-time view is addressable by season and week. The at-risk page has the same gap. I'd leave both.
- `url.ts`: `parseUrl` reads `/` with no definition params as the front page and `/build/` as the builder. `view.ts` gets a `front` flag and its resets. `main.jsx` seeds it from the path.

## Analytics

- `definition` fires on every builder load, so its unique count is "builder loaders" on the scorecard. Under treatment A it stops firing on `/` and that number drops. The scorecard needs a note on the day it ships.
- New: `front` (the list rendered, with `rows` and `tested`, the count on the line), and `from: 'front'` on `lead apply` (a row opened), `game` (a row's game opened) and `team page`. The "build your own streak" link fires `build` with `from: 'front'`.
- What to watch: of visitors who land on `/`, the share who open a row or a game, against the 45% who did anything at all on the builder. And the share who reach the builder from the link, since the builder is where the deep visits were.

## Checks

- `front.test.ts`: every front row is a row of its team's `listCrowns` simple active list with the same words and rank. Every row marked on the line with a lined game is a row of `atRiskWeek`'s simple rows for the week. The page shows the first ten, one per team, and "see more" holds the rest in order.
- `list.golden.test.ts`: Alabama's 90 is first, and Boise State's WAC run isn't on the list.
- `team.test.ts`: `nextQualifying` reads after-a-loss from the last result and the favorite from the line, and returns `open` for a one-score streak.
- `atRisk.test.ts` and `digests.test.ts`: the counts that rose are the settled-condition rows, and a game's "N on the line" still holds what the at-risk page lists for it.
- `url.test`, `view.test`: `/`, `/build/`, and an old `/?c=…` link.
- `App.test`: the prerendered front page hydrates without a mismatch.
- Screenshots at phone and desktop width of both treatments, a week with a row on the line, and the off-season (no next games, so every row's second line is its "since").

## What it doesn't do

- It doesn't change what any other list admits. The frozen runs stay on team pages and in the builder.
- It doesn't list broken streaks or all-time ones. Sunday's news is the schedule's broken digest. A "this week's breaks" line on the front page is a later idea.
- It doesn't show trivia. No folded "and N trivia streaks" line either, since the page is the short list.
- It doesn't rank by what's at risk. `/games/at-risk/` does that and the page links to it when any row there is on the line.

## Settled (2026-11-14)

- The first ten show, the rest behind "see more".
- One list by score, with the tested rows marked.
- Treatment A: the list is its own page at `/`, the builder at `/build/`.
- Only streaks on the line in the team's next game.
- Readers don't see "board". "Streak boards" becomes "Longest streaks by category".
- Runs whose last game was this season or last.
- A row says "on the line", with no chance.
- Winning and losing streaks share one list; a losing streak has the rust numeral.
- The off-season can wait.
