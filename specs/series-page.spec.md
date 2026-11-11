# The series page, read as the series' page

Status: built 2026-11-10 (`SeriesPage.jsx`, `seriesWords.ts`, the worker's `renderSeriesCard`). The
open questions below went with the defaults. The mocks under `research/series-page/` are
the static HTML the spec was written from (Utah–BYU through 2025, 97 games), not the app.

- Mock, phone: [series-mock-phone.png](research/series-page/series-mock-phone.png)
- Mock, desktop: [series-mock-desktop.png](research/series-page/series-mock-desktop.png)
- The grid on two harder pairs: [grid-mock-desktop.png](research/series-page/grid-mock-desktop.png), [grid-mock-phone.png](research/series-page/grid-mock-phone.png)

## The problem

`/team/utah/vs/byu/` is built as Utah's page about BYU. A reader who searched
"Utah vs BYU all-time record" reads it as the series' page. Every part of the page that
depends on knowing whose side it is reads wrong or reads as nothing:

- The stats strip says `60-34-4`, `38-17-3`, `21-17-1`, `1-0`. Nothing says the first
  number is Utah's.
- The squares are cream for a Utah win and dark for a Utah loss. No legend says so, and
  the squares carry no mark (`SeriesPage.jsx:94`).
- A ledger row says `vs BYU  W 28–20` with a rank column that is Utah's.
- The crumb is "‹ Utah". The share card says "THE LAST 10 · UTAH'S SIDE".
- BYU's page leads with "BYU trails Utah 34-60-4", which nobody says.
- The third streak row says "1  Utah's run now, since 2026". One win isn't a run, and the
  lead already says who won the last meeting.

Two smaller bugs sit in the ledger under the squares:

- `shortDate` writes a two-digit year, so the 1922 game reads `10/25/22` on a page that
  also has a 2022.
- A row since 1936 is a `button.xrow.game-row`, and `.xrow.game-row { font: inherit }`
  (`styles.css:658`) gives it the page's serif. A row before 1936 is a plain `div.xrow`,
  so it keeps `.xrow`'s 11px IBM Plex Mono and a dotted border. The font changes at 1936
  for no reason a reader can see.

The ledger goes away in this spec (section 2), and the font bug goes with it. The date
still needs its four-digit year where the grid shows a game.

## The rule

Every fact on the page names its team, with a word or a mark. The page never says W or L,
"vs" or "@", and never uses cream against dark to mean one team's result. The first-named
team is on the left or on top, and that's the only thing the address changes.

So `/team/utah/vs/byu/` and `/team/byu/vs/utah/` show the same page with the two teams
swapped left to right. Both addresses stay (Drew's call 2026-11-02, a page from each side
for the search wording).

## The changes

### 1. Head

- The crumb is "‹ Streak King", the same as a game page's. The page isn't under Utah any
  more from the reader's side.
- The h1 keeps its words, "Utah vs BYU all-time record".
- Under it sits the record as a scoreboard: Utah's color mark and name, `60`, "4 ties",
  `34`, BYU's color mark and name. Each win count sits beside its team's mark. The
  leader's number is cream and the other is muted. Each mark and name opens that team's
  page.
- The lead sentence names the leader first on both pages: "Utah leads BYU 60-34-4 in 98
  games since 1922. Utah won the last meeting, 28-20 in 2026." `recSentence` in
  `seriesWords.ts` drops "trails". A tied series keeps "Utah and BYU are tied 45-45-3" in
  the page's order. The title, the description, `llms.txt` and the worker's words all come
  from the same function, so they change with it.
- The next meeting follows the lead when there is one, worded like a game page's h1
  ("BYU at Utah", the date, the line) instead of `NextRow` from one side.

### 2. Games: the winner's mark, and the only list of games

The section is "Games 98". It replaces both "Every game" and the ledger under it (Drew,
2026-11-10). The grid is the list: a mark shows its game on hover and opens the game's
page on a click.

This is the exception to the board's squares. Each game is the winner's one-color mark
(`public/logos/<espn>.png`) drawn in cream on the page, with no square behind it. A tie is
a dashed empty square. There's no legend line.

The marks sit on a calendar instead of a wrapping strip:

- One row per decade, labeled `1920s` in the small mono.
- Ten slots per row, one per season. A season with no meeting is a faint dot between the
  first and last meeting, and blank outside them. Utah–BYU's 1943–45 and 2022–23 show as
  gaps, which a wrapping strip hides.
- A season with two meetings holds both marks in its slot (Michigan–Minnesota 1926 in the
  grid mock), and that row runs one mark longer.
- Two or more decades in a row with no meeting collapse to one faint line with the years
  ("1908–1947, no games" for Alabama–Auburn). The mock doesn't do this yet and shows three
  rows of dots.
- 46px of label plus ten 22px slots is 290px, so it fits a 350px phone without wrapping.

The game on hover shows in one line between the heading and the grid. I'd use a line and
not a floating tooltip, since a tooltip sits under the thumb on a phone and moves with
every mark.

- The line reads "10/18/2025  **#15 BYU 24**, #23 Utah 21  at BYU ›". The date has a
  four-digit year, from a new `fullDate` in `format.ts`. The score is winner first, the
  winner cream and semibold, ranks in rust. The site is words: "at Utah", "at BYU",
  "neutral". A tie is "Utah 7, BYU 7 tie" in the page's order.
- The line has a fixed height, so the page doesn't jump.
- Before any hover it shows the last meeting, and that mark has the rust ring the board's
  open column has. The prerender draws the same state, so the hydrate matches.
- With a mouse, hovering a mark shows its game and a click opens the game's page. The
  events are `onPointer*`.
- On a phone a tap can't both show the score and open the page. So a tap shows the game in
  the line and rings the mark, and a second tap on the mark or a tap on the line opens the
  page (Drew, 2026-11-10). A 22px mark is easy to miss by one, and this way a miss costs
  nothing.
- A game before 1936 has no page. Its mark shows the game the same way, the line has no
  chevron, and the cursor stays an arrow.
- Each mark that opens a game is a real link with the game's address as its `href`. Every
  mark carries its game's words as `.sr-only` text ("1922: Utah 49, BYU 0, at Utah"), the
  way a board column does (`columnWords` in `Grid.jsx`), and the grid is no longer
  `aria-hidden`. With the ledger gone, this is the only place a crawler or a screen reader
  finds the scores.
- The grid is one tab stop and the arrow keys move between marks. Focus shows the game and
  Enter opens it.

A team without committed marks gets its initial, the way `Chip` does.

### 3. By site

A table replaces the four unlabeled records. A row per team with its mark and name, a row
for ties, and a column each for all games, "At Utah", "At BYU" and "Neutral". A column
with no games is left out. The larger number in each column is cream.

A team page's "All-time series" list keeps its one-sided `60-34-4`, since that page is the
team's. The table's first row is that record, which keeps the two views nested.

### 4. Longest streaks

- "Utah won 9 in a row, 1929–1937" and "BYU won 9 in a row, 1979–1987", each with the
  team's color mark. Both lengths are cream. Rust for the second team's number goes away,
  since rust reads as "bad" and neither team is the page's.
- The current run shows only at two or more: "BYU has won the last 3, since 2021". At one
  the row is dropped.

### 5. Foot

None. The method note and the links under it come out (Drew, 2026-11-10). The team names in
the scoreboard link each team's page.

### 6. The share card

`renderSeriesCard` follows the page: each win count beside its team's mark instead of one
`60-34-4`, the leader-first sentence, and the last ten meetings as the winner's mark over
the year. "UTAH'S SIDE" goes away. The card uses the color marks it already draws at the
head, since ten marks at 56px have room for color and the worker needs no tinting. Bump
`CARD_VERSION`.

## What doesn't change

The addresses, `SERIES_MIN`, the data (`seriesCore.ts`, `series-early.json`), the prerender's count of pages, the sitemap, and the team
page's "All-time series" list.

## Checks

- `seriesWords` test: the lead from Utah's side and from BYU's side is the same sentence,
  and a tied series reads in the page's order.
- `series.test.ts` still gates Alabama–Tennessee and Michigan–Ohio State.
- `App.test` hydrates a prerendered series page without a mismatch, with the last meeting
  in the line.
- The prerendered HTML of a series page holds every game's score as text.
- Screenshots at phone and desktop width for Utah–BYU, Michigan–Minnesota (look-alike
  marks, a two-meeting season), Alabama–Auburn (a 40-year gap), one tied series and one
  with a long pair of names (Mississippi State–Ole Miss), where the line is the thing to
  check on a phone.

## Open questions

1. **Look-alike marks.** Michigan and Minnesota are both a block M in one color. In the
   grid mock I can tell them apart (Minnesota's is shorter with a notched foot), but it's
   slower than U against Y. Options: 1) leave it, 2) draw the second-named team's marks in
   `--ink-muted` on pairs we list by hand, 3) do that on every page. I'd start with 1 and
   look at the pairs once it's built, since a second tone brings back the light/dark
   reading this spec removes. WDYT?
2. **One canonical or two.** With the body the same from both sides, Google will likely
   treat the two addresses as duplicates and pick one. We could pick for it by pointing
   the trailing side's canonical at the leading side's page (`llms.txt` already lists each
   series once that way). I'd leave both self-canonical until Search Console shows which
   wording gets impressions.
3. **A slot per season, or games in order.** A slot per season shows the years a series
   went dark and lines years up in columns. It costs the collapse rule for empty decades
   and an uneven row in a two-meeting season. Games in order with a row per decade is
   simpler and loses the gaps. The mocks use a slot per season.
4. **Desktop width.** The grid is 290px wide in a 720px column, so the right half of the
   section is empty in the desktop mock. By site and Longest streaks could sit beside it
   on desktop. I'd build the single column first and look.
