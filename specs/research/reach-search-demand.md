# Research: search demand for CFB streak questions (Opus agent report, 2026-10-16)

Feeds `specs/reach.spec.md`.

**How I collected this.** I ran every query on Google (US, English) in the desktop app's built-in browser and read the page text. Each SERP is at `https://www.google.com/search?q=<query>&hl=en&gl=us`. Rankings are one signed-out snapshot and may be personalized. Google often shows only a domain and a cut-off path, so I give full URLs only where I have them. The WebSearch tool is not Google, and its results were noticeably different. I used it only to find page URLs.

**The finding that matters most.** drewhoover.com is already on page one of Google for two queries:
- #1 for "longest win streak vs ranked teams" (the `/cfb-streak-king/longest-win-...` page).
- #3 for "longest home win streak college football" (`/cfb-streak-king/longest-hom...`).

## (a) Who wins each query now

| Query | #1 result (type) | Rest of page one |
|---|---|---|
| longest win streak in college football | Wikipedia "Longest NCAA Division I football winning streaks" (list) | Reddit r/CFB thread; NCAA.com top-7 list (Jul 2023); ESPN explainer (Dec 2025); Marca; WarrenNolan current-streak table; Wikipedia one-opponent list |
| longest winning streak college football history | Wikipedia (same) | NCAA.com; Reddit; ESPN; CollegeXpress list |
| longest losing streak college football | ESPN list (Sep 2024) | Wikipedia "Losing streak"; Yahoo/Sporting News "UMass snaps 16" (Sep 3 2026); WarrenNolan; cfbeveryday; Saturday Blitz (Aug 2024) |
| longest home win streak college football | CBS Sports "longest active home win streaks entering 2026" (Feb 2026) | fueledbysports.com; **drewhoover.com #3**; Reddit; Wikipedia; WarrenNolan; cfbtrack.com |
| longest active win streak college football | WarrenNolan "Current Win Streak 2025" (table, stale title) | BetMGM blog; Wikipedia; Reddit; dpdsdogs.com; NCAA.com regular-season list (Nov 2025) |
| longest win streak vs ranked teams | **drewhoover.com** | Saturday Down South (undated listicle); Wikipedia; Reddit r/notredamefootball; WarrenNolan (wrong intent); ESPN wins vs No. 1 |
| alabama win streak | Wikipedia team page | prideofthetide.com streak table; Yahoo (high school); SEC; nextteamup; AL.com |
| ohio state win streak | Wikipedia | ESPN team page; ohiostatebuckeyes.com; Bentley Library; Sports-Reference school page |
| georgia win streak | secsports.com | georgiadogs.com; Reddit; ESPN; Wikipedia; many Facebook posts |
| texas win streak | Wikipedia Red River Rivalry | texaslonghorns.com (softball); ontexasfootball; SI |
| michigan win streak | Wikipedia Michigan–Ohio State | Bentley; ESPN; Winsipedia; FOX |
| umass losing streak | ESPN game story (Sep 4 2026) | social carousel; Wikipedia |
| oklahoma state losing streak | Reddit r/CFB | Yahoo; Pokes Report; SI; CBS |
| streaks broken this week college football | videos, then a Facebook post | Reddit "Streaks broken in week 5" (fan-compiled); Yahoo; Instagram matchuptracker |
| streaks at risk week 7 | videos and betting previews (Yahoo, FOX, CBS, Covers) | nothing about streaks |
| has vanderbilt ever beaten alabama at home | rolltide.com opponent history (W-L only) | ESPN 2024 story; Winsipedia; Wikipedia; Tuscaloosa News |
| longest streak without a bowl game | Saturday Blitz (Jul 2025) | Reddit (10 years old); Wikipedia bowl records; cfbeveryday; ESPN; Forbes; Athlon (Aug 2026) |
| longest bowl win streak | ESPN (Dec 2025, about appearances, not wins) | mcubed.net table; Reddit; cfbeveryday; Badgers Wire; Substack |
| longest cover streak college football | Wikipedia **win**-streak page | NCAA.com, ESPN, WarrenNolan: all about win streaks. No page about covering exists |
| ATS streak college football | TeamRankings ATS trends | Covers, BetIQ, VegasInsider, Action Network, BetMGM: current-season ATS records, not streaks |
| most consecutive wins as an underdog | Reddit, including a thread asking this exact question (Oct 10 2026) | Wikipedia one-opponent; BetIQ record as underdog; CBS home streaks |

How often the named sources win:
- **Wikipedia:** #1 for both history queries, all four bare team queries, and (off-target) the cover-streak query.
- **NCAA.com:** #2–3 on the history queries.
- **ESPN:** #1 for losing streaks.
- **Saturday Down South:** #2 for vs ranked.
- **Team sites:** the Vanderbilt query and the Georgia/Ohio State pages.
- **Sports-Reference:** only as Ohio State's school page.
- **StatMuse and Stathead:** in none of the SERPs I checked.

New streak-table competitors: WarrenNolan.com, cfbtrack.com, fueledbysports.com and dpdsdogs.com. cfbtrack lists active and all-time home, road, conference, bowl and opponent streaks back to 1869 ([cfbtrack](https://cfbtrack.com/stats/longest-active-home-winning-streaks)).

## (b) People Also Ask
- Who broke Oklahoma's 47 winning streak? / When did OU win 47 games in a row?
- Who has the longest (current/active) winning streak in college football (right now)?
- Who has the most consecutive winning seasons in college football?
- Which college football team has the longest winning streak against one team?
- What team won 33 games in a row?
- What's the longest home winning streak? / Which team has the longest winning streak at home?
- What is the current longest losing streak in college football? / What college has the longest losing streak?
- Which college football team has the longest active ranked streak?
- How many games has [Alabama / Ohio State / Georgia / Indiana] won in a row? / What is [team]'s longest winning streak?
- Who has the longest win streak, Michigan or Ohio State? / What team has Michigan never beaten?
- How many times has Vanderbilt beaten Alabama? / What team has beaten Alabama the most? / Did Nick Saban ever lose to Vanderbilt?
- Which college has the longest bowl game streak? / What college team has never won a bowl game?
- What is ATS college football? / What is the current ATS record for college football teams?
- Off-topic filler that showed up repeatedly: Has a walk-on ever won the Heisman? What is the only state without a D1 school?

**Answerable by a conditional streak page:** active and longest streak per team, home streak, versus one opponent, Michigan vs Ohio State, the ranked streak, "never beaten", and bowl streaks. No PAA box asked about night games, months or underdogs.

## (c) Volume and seasonality
**Absolute volume: not found.** Ahrefs' free keyword generator stopped at a Cloudflare "verify you are human" check, and I didn't complete it. I didn't try Semrush, Ubersuggest or AnswerThePublic; all three need an account.

**Google Trends** (US, past 5 years, weekly):
- [Trends: "winning streak college football" vs "losing streak college football"](https://trends.google.com/trends/explore?date=today%205-y&geo=US&q=winning%20streak%20college%20football,losing%20streak%20college%20football)
  - Average interest is 8 vs 1.
  - Both are zero from mid-December to late August every year. Interest starts in the first September week and peaks in late November.
  - The 5-year peak (100) was the week of Nov 26 2023, Georgia's 29th straight win; it read 96 on Dec 3 and 0 by Dec 10.
  - "losing streak" hit its own high of 31 the week of Sep 6 2026 (UMass ended its 16-game skid).
  - Rising related queries: "georgia win streak" (Breakout), "georgia bulldogs winning streak" (+850%).
- [Trends: five-term comparison](https://trends.google.com/trends/explore?date=today%205-y&geo=US&q=longest%20winning%20streak%20college%20football,longest%20losing%20streak%20college%20football,longest%20home%20winning%20streak,college%20football%20streaks,georgia%20win%20streak), averages:
  - "longest winning streak college football": 6
  - "longest home winning streak": 3
  - "college football streaks": 2
  - "georgia win streak": 2
  - "longest losing streak college football": 1

**Google Autocomplete** (suggestqueries endpoint) offers these for the stems:
- "college football longest home winning streak (current / all time / active)"
- "longest active road winning streak college football"
- "longest conference winning streak college football"
- "longest bowl game drought" and "longest bowl game win streak"
- "college football longest winning streak against one team"
- "alabama longest home win streak"
- "michigan longest win streak vs osu"
- "college football losing / bowl / scoring streaks"
- Nothing for underdog, night or month stems.

## (d) Gaps a fresh page can win (current best result, and why it's weak)
1. **vs ranked teams.** Already #1. Defend it: #2 is an undated Saturday Down South listicle.
2. **Longest home win streak.** #1 is a February 2026 CBS story that is already stale; drewhoover.com is #3.
3. **Most consecutive wins as an underdog.** Reddit is #1, and a Reddit thread from Oct 10 2026 asks exactly this. BetIQ gives only win-loss records.
4. **Longest cover streak.** Google returns win-streak pages; nobody has a page about covering streaks.
5. **ATS streak college football.** Only current-season ATS tables, with no streak history.
6. **Longest night game win streak.** Facebook and Reddit; nothing authoritative.
7. **Longest win streak in October** (or any month). Reddit and generic ESPN.
8. **Longest road win streak.** Wikipedia's overall-streak page, a WarrenNolan page titled 2024, and Facebook.
9. **Longest road losing streak.** ESPN's overall list and WarrenNolan's overall table; nothing road-specific.
10. **Longest conference losing streak.** ESPN overall, a Wikipedia one-opponent list, Facebook.
11. **Streaks broken this week.** The best answer is a fan-compiled Reddit thread; no publisher owns this weekly.
12. **Streaks at risk week N.** Only betting previews; no streak page anywhere.
13. **Longest streak without a bowl game.** Saturday Blitz (Jul 2025, already out of date) and a 10-year-old Reddit thread.
14. **Longest bowl win streak.** #1 is ESPN on bowl *appearances*; then mcubed.net and Reddit.
15. **"[team] win streak" for Texas and Michigan.** The results are rivalry Wikipedia pages and Texas softball; there's no team-streak page.
16. **"[team] losing streak" (Oklahoma State).** Reddit is #1.
17. **Longest active win streak.** #1 is a WarrenNolan table with a stale "2025" title, then a BetMGM blog post.
18. **"Has X ever beaten Y at home".** rolltide.com gives only home and away W-L, with no dates, so a game or matchup page would answer it better.

## (e) StatMuse and Stathead on conditional questions
**StatMuse** (CFB search, logged out):
- It answered record questions:
  - [Alabama vs Tennessee, last 20 years: 17-3](https://www.statmuse.com/cfb/ask/alabama-vs-tennessee-football-record-last-20-years)
  - [Alabama home record, last 10 years: 75-8](https://www.statmuse.com/cfb/ask/alabama-home-record-last-10-years)
  - [Alabama in October since 2010: 55-7](https://www.statmuse.com/cfb/ask/alabama-record-in-october-since-2010)
- These redirected to statmuse.com/error with a "free StatMuse membership" sign-in prompt: "longest win streak as an underdog", "longest win streak in october", "alabama longest winning streak", "longest winning streak college football", "alabama record as an underdog".
- So conditional *records* work, but *streak* and underdog questions don't answer logged out. I couldn't tell whether they are behind the sign-in or unsupported.

**Stathead / CFB-Reference:**
- The School Streak Finder searches game logs from 1869 on. Its filters are years, conference or conference games only, school, opponent, location, and up to four stat conditions ([2012 post](https://www.sports-reference.com/blog/2012/09/search-our-college-football-data-using-the-cfb-play-index/)). Scoring-margin criteria were added in 2019.
- Nothing mentions opponent rank, month or the spread.
- The College Player Game Finder that launched on Stathead in Nov 2024 is a subscription after a free month ([post](https://www.sports-reference.com/blog/2024/11/a-new-college-football-tool-launches-on-stathead/)).
- I couldn't open the finder itself; it sits behind a Cloudflare bot check, which I didn't bypass.

## (f) Event-driven patterns
- **A long streak nearing a record makes team queries surge, and news gets the traffic.** "winning streak college football" and "georgia win streak" both hit 100 the week of Nov 26 2023 and fell to 0 after the streak ended. Today "indiana win streak" (22 straight before Ohio State) is a Top Stories carousel from CBS, SI and Big News Network plus social posts, with no reference page. Its PAA box asks "How many games has Indiana won in a row?"
- **When a streak ends, the head-term searches pick up and a news list piece wins.** The week Alabama ended Georgia's 33-game home streak (Sep 27 2025), "longest home winning streak" reached 46. The CBS story "Oregon, Missouri top longest active home win streaks after Georgia, Washington runs snapped" took that traffic ([CBS](https://www.cbssports.com/college-football/news/oregon-missouri-top-longest-active-home-win-streaks-in-fbs-after-georgia-washington-runs-snapped-in-week-5)).
- **A losing streak ending works the same way.** UMass (Sep 2026) sent "losing streak" to a 5-year high. Yahoo/Sporting News's "Longest college football losing streaks: UMass snaps 16-game skid" now ranks #3 for the evergreen head term. For Oklahoma State (Sep 12 2026), Reddit, Yahoo and Pokes Report win.
- **News is starting to coin conditional streaks itself.** Notre Dame has won "16 consecutive games by double digits", reported by Yahoo, the Washington Times and Fighting Irish Wire. That is a margin-condition streak, and the reference result for it is Wikipedia.
- **Reference pages do keep the evergreen head terms.** Wikipedia and NCAA.com held both history queries through every spike.

**Not found:** absolute monthly search volumes, the AnswerThePublic and Semrush data mentioned above, and the inside of the Stathead streak finder.
