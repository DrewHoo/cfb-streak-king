# Research: prior art (Opus agent report, 2026-09-26)

Nothing found ranks every FBS team by its current streak under user-composed
constraints. The pieces exist separately: Stathead has streaks behind a paywall, BetIQ
stacks filters but only returns W-L totals, free sites show current streaks in a few
fixed categories. Stathead 403'd fetches and put up a bot check, so its filter list is
partly inferred.

## Stathead (Sports-Reference)
- Team Streak Finder alongside Game/Season/Split/Span finders; "best (or worst)
  streaks of games matching your criteria"; major-school games only; back to 1869
  (offense stats 1995+, defense 2005+).
- Game Finder has point spread and over/under filters. Pro samples show the query
  style ("longest streak as an underdog"). An "active streaks only" option exists in
  the basketball version (2018); unconfirmed for CFB.
- $9/month or $80/year for football (college bundled), $16/month all sports.
- Weaknesses: query form (question → result, no all-team ranked list); paid; bot wall;
  dense desktop pages. **A Stathead streak appears to be consecutive games each
  matching the criteria (not confirmed)** — not the skip-gap definition ("counting
  road games only, wins in a row") this app uses.

## Betting sites
- TeamRankings win/ATS trends (free): one "situation" dropdown (bye, after W/L,
  home/away/neutral, favorite/underdog, home/away fav/dog, rest advantage,
  conf/non-conf, regular/bowl). No combining (a few pre-combined like "As Away
  Underdog"). 2003+, single seasons or "Since YYYY". Records only, never streaks.
- BetIQ Custom Trend Tool (free, no login): real filter stacking — seasons back to
  1995, date, week, spread min/max, total, money line, rest, team, opponent, site,
  conference game, season type, previous result. Output: combined record, MOV
  histogram, game list. No rank filter, no streaks, no per-team ranking. Its spread
  min/max fields confuse enough that the page explains them.
- Covers/OddsShark: merged; free standings (overall, conference, home/away, non-conf,
  ATS, O/U, 2006-07+). Old OddsShark cover-streak column is gone; all season records.

## Hobby sites and GitHub
- WarrenNolan.com: five fixed pages per season (current win, longest this season,
  current home, current road, current losing). Shows all-time record in context
  ("Oklahoma – 25 (1953-58)").
- cfbeveryday.com (updated 9/24/26): current losing streaks (overall, conference —
  Purdue 19, home, road — Purdue 16), each row with date of last win and notes like
  "next game could end it". Covers FCS/D-II/D-III too.
- dpdsdogs.com: current W/L streaks across D-I grouped by conference; double-digit
  streaks bold, leaders red.
- GitHub: only data plumbing (CFBD clients, cfbfastR). No custom-streak calculator
  found.

## Editorial
- Recurring: NCAA.com "longest active road/home/regular-season win streaks"; CBS home
  win streak lists written with a "what could end it" angle; ESPN streak explainers.
- Oddly specific streaks that got written up: Alabama's 100 straight vs unranked
  (ended 2021 by A&M; next best Florida 73, Miami 72); Kansas 56 straight Big 12 road
  losses (ended 2021); Kansas 30 straight losses to ranked (2018); Kansas underdog in
  104 straight conference games ("longest active by more than 80", Substack, no
  source); Oregon's 41-game win streak vs unranked snapped Week 2; a 19-game home
  streak vs unranked snapped by Kentucky; Alabama 8 straight covers as home favorite
  (ESPN).

## Conclusions
(a) Differentiation: free fixed-category streaks OR flexible-filter records exist;
nothing combines them. We give a free, instant, mobile ranking of every FBS team by
active streak under up to four stacked constraints over 30–50 years, with every result
a shareable link — the factoid writers dig up by hand becomes one click.

(b) UX worth stealing:
- Every row shows the streak-ender ("last loss: 11/30/2019 at #15 Auburn").
- All-time record context line under the ranking (WarrenNolan style).
- "Could end this week" flag joined against next week's schedule.
- dpdsdogs' highlighting: bold double-digit streaks, highlight the leader.
- TeamRankings' "Since YYYY" era dropdown; pre-combined labels as preset names.
- BetIQ's drill-down to the game list; avoid min/max spread fields, use plain chips
  ("as underdog", "as 7+ pt underdog").
- Short readable share URLs, no login (vs stathead.com/tiny/XXXX).
- Presets drawn from what gets written about: Home, Road, vs Ranked, vs Unranked,
  Conference road, As underdog, Regular season only, Bowls.

(c) What fans care about (by frequency of appearance, not traffic): 1. home/road win
streaks; 2. vs ranked/unranked (the most memorable stories); 3. conference and
conference-road losing streaks; 4. underdog/favorite streaks (bettors); 5. regular
season only. No editorial evidence found for month, night-game, or rest streaks —
new territory, unproven. The recurring pattern is location × opponent quality
("road wins over ranked teams since…").
