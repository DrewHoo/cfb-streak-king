# Research: streak constraint dimensions (Opus agent report, 2026-09-26)

Method: ~50 web searches crossing a term matrix of streak framings ("winning streak",
"losing skid", "hasn't lost to", "drought", "cover streak") against constraint domains.
TeamRankings/BetIQ, Stathead and mcubed.net blocked fetching; their filter vocabulary
came from search snippets. Examples marked [v] were confirmed by a search this session;
unmarked examples are background knowledge and need checking before appearing in the app.

Confirmed filter vocabularies from existing tools:
- TeamRankings/BetIQ: After A Bye, After A Win, After A Loss, As Home Team, As Away
  Team, At Neutral Site, As Favorite, As Underdog, As Away Favorite, Vs Ranked
  Opponent, Non-Conference, Conference (plus over/under versions).
- Odds Shark: head-to-head, before/after bye, vs conference, following a straight-up loss.
- Stathead Team Streak Finder: from 1940; location, opponent rank, conference game,
  bowl game, month.
- Free current-streak sites (WarrenNolan, dpdsdogs, cfbeveryday): overall, home, road,
  losing only. Nobody publishes the constrained cross-product.

## Catalog of dimensions

### A. Location and travel
1. Home — Indiana unbeaten at home since Cignetti arrived 2024 [v]; Boise State 65
   straight regular-season home wins 2001–11 [v]. Needs site flag.
2. Road (true away) — Kansas lost 46 straight road games, FBS record [v]. Site flag.
3. Neutral site — bowls, kickoff classics, Jacksonville/Dallas rivalry games.
4. Away from home (road + neutral).
5. Specific stadium/venue — "hasn't won at Beaver Stadium since…". Venue ID.
6. Opponent's state/region — northern teams in Florida/Texas. Venue state.
7. Time-zone travel — West Coast east trips 27-39-5 ATS over four years; USC lost all
   three Eastern/Central trips 2024 [v]. Venue + home time zones.
8. Travel distance bucket — venue coordinates.
9. Playing surface — 94 of 133 FBS fields artificial [v]; Michigan tracks turf/grass
   since 1968 [v]. Surface per venue-season.
10. Dome/indoors — roof type.
11. Altitude — Air Force, Wyoming, Colorado. Venue elevation.

### B. Opponent quality
12. vs AP-ranked — Rutgers lost 42 straight to ranked from 2009; Nebraska 29 from
    2016 [v]. Opponent AP rank at game time.
13. vs unranked — Alabama beat 100 straight unranked under Saban 2007–21 [v]; Miami 72
    straight 1985–95 [v].
14. vs top-10 / top-5 — Indiana's first top-5 road win at Oregon 2024 [v].
15. vs No. 1 — Tennessee 2-17 all-time vs No. 1, none beaten since 1959 [v].
16. Rank differential — both teams' ranks.
17. As a ranked team (own rank) — "loses whenever it gets ranked".
18. vs undefeated opponent — opponent record entering game.
19. vs winning-record opponent — "hasn't beaten a winning team since…".
20. Opponent tier (P4/G5/FCS) — P4 won 125 straight vs FCS until Sacramento State beat
    Stanford 2023 [v]; UMass lost 16 straight vs FBS until beating Rutgers [v]. Needs
    conference+division per season.
21. vs specific conference — Big Ten–SEC bowl records. Opponent conference that season.
22. Specific opponent (head-to-head) — Notre Dame beat Navy 43 straight [v]; Nebraska
    beat Kansas 36 [v]; Florida beat Kentucky 31 [v]; Ohio State beat Indiana 29 until
    the 2025 B1G title game [v].
23. Rivalry/trophy games pooled — Army lost 14 straight to Navy [v]; Penn State held
    Old Ironsides 10 years [v]. Curated rivalry table.
24. In-state opponent — Ohio State hasn't lost to an Ohio school since 1921 [v]; Texas
    A&M won 17 straight vs Texas schools from 2012 [v]. Campus state table.
25. Conference/non-conference — Vanderbilt lost 26 straight SEC games [v]; Alabama won
    27 straight SEC games 1976–80 [v]. Conference-game flag.
26. Conference road — Kansas lost 44 straight Big 12 road games [v].
27. Division/former conference-mates — historical membership.
28. vs service academies.
29. vs opponent with a first-year coach — coach tenure table.

### C. Betting
30. As favorite / as underdog — Alabama favored 72 straight 2010–15; next best since
    1978 is FSU's 54 [v]. Closing spread.
31. Spread-size bucket — 31-pt dog Kansas beat Texas in OT 2021 [v]; 29.5-pt dog UMass
    beat Rutgers [v].
32. Home/road favorite or underdog — TeamRankings "As Away Favorite" [v].
33. ATS result (cover streak) — an alternate OUTCOME, not a filter. Oklahoma State
    covered 9 straight in 2021 [v].
34. Over/under result — alternate outcome. Oklahoma/Wisconsin/Wyoming each 10-2 to the
    under in 2025 [v].
35. "Favored in" as a status streak — Alabama's 72 [v].

### D. Calendar
36. Month — Vanderbilt under Clark Lea 4-14 in November [v].
37. Season opener — Ohio State won 20 straight openers 2000–19; Maryland 10 straight
    despite bad seasons [v].
38. Regular-season finale — rivalry-week records.
39. Bowl/postseason — FSU and Virginia Tech bowl runs [v].
40. Conference championship game — Indiana beat Ohio State in the 2025 B1G title game [v].
41. CFP games — "top 4 seeds with a bye all lost their first game" [v].
42. Conference opener — derived from game order.
43. Rivalry Week / Thanksgiving weekend.
44. Day of week — UMass's Thursday-night upset at Rutgers [v].
45. Week 0 / opening weekend.
46. Specific dates (Halloween) — Nebraska's Halloween blackout game [v].

### E. Game context and situation
47. After a loss (bounce-back) — Alabama under Saban rarely lost twice in a row: 2007,
    2008 SEC title + Sugar Bowl, 2013 [v]. Previous result.
48. After a win.
49. After a bye / extra rest — FBS teams off a bye 40-38 in one sample [v]. Days since
    last game.
50. Short week (≤5 days rest).
51. After beating a ranked team (letdown/trap) — top-10 teams 143-21 in trap games
    2005–20 [v]; Ohio State lost 55-24 at Iowa right after beating Penn State [v].
52. Before a big game (look-ahead) — next opponent.
53. Revenge game — 4 of 5 CFP rematches went to the team that lost the first
    meeting [v]. Last head-to-head result.
54. Night/day kickoff — LSU 28-0 in Saturday night home games 2002–08; Les Miles
    36-2 [v]. Local kickoff time.
55. Early kickoff / body-clock — Pac-12 in 9am body-clock games [v].
56. TV window/network — broadcast data.
57. College GameDay on site — Texas A&M 0-5 as GameDay host; Alabama won 8 straight
    GameDay games 2011–13 [v]. GameDay location list.
58. Homecoming — NC State unbeaten on homecoming 1960–64 [v]. Sparse curated list.
59. Rank/playoff implications entering — own record and rank.
60. Own record entering (0-X, X-0).

### F. Game shape (post-hoc: filter reads the outcome's margin)
61. One-score games (≤8) — clutch / "Coug it" framing [v].
62. Blowouts (21+) — Northwestern's 34-game losing streak was nearly all blowouts [v].
63. Overtime games — Illinois beat No. 7 Penn State in 9 OT, FBS record [v].
64. Leading at halftime — Alabama under Saban 178-9 when leading at half [v]. Halftime score.
65. Comebacks (trailing after 3Q) — quarter scores.
66. Points-scored threshold — "undefeated when scoring 40".
67. Shutout/scored status streak — Florida 461 games without being shut out;
    Nebraska 380 [v].

### G. Personnel
68. Under head coach X — almost every "under Saban" stat. Coach per team-season,
    midseason changes matter.
69. Coach's debut/first season — Florida first-year coaches have won debuts since
    Pell's 1979 loss [v].
70. Interim coach games.
71. vs coach's former team / vs specific opposing coach — Saban vs Kiffin [v].
72. Starting QB — Toledo's Chuck Ealey never lost (35 straight) [v]. Hard to source.

### H. Misc/aesthetic
73. Uniform (blackout/alternate) — Iowa 9-0 in all-black [v]; Nebraska 7-6 in
    alternates since 2009 [v]. Sparse curated list.
74. Weather — Penn lost its 18-game Ivy streak in a snow game [v]. Costly to source.
75. Sellout/attendance — Nebraska's 403 straight sellouts is itself a status streak [v].
76. Opponent mascot/color — novelty.
77. Previous meeting's venue/result — series alternation.

## Most fun (agent's top picks)
vs unranked + mirror vs ranked; specific opponent/rivalry; road+conference; as underdog;
as favorite (losses); night home games; season opener; after a loss; in-state; G5 vs P4;
one-score games; bowls; time-zone travel; after beating a ranked team; under coach X +
vs top 10 (the hostile-territory core).

## Degenerate or ill-defined
- Once-a-year events (homecoming, GameDay host, conference opener, Thanksgiving, CFP,
  title games): streaks of 0–5 even over 30 years; only work with a "since date" view.
- vs No. 1: reads as a drought, not a streak.
- Uniform, weather, homecoming: patchy pre-2010, inconsistently defined, costly.
- Starting QB, interim coach: tiny samples bounded by a tenure.
- Overtime: 0–2 per team-season.
- Game-shape filters leak the outcome into the filter; blowout win streaks mostly
  mirror overall win streaks. Meaningful only in asymmetric forms ("when leading at
  half", "when scoring 30+").
- Altitude, dome, mascot: degenerate for most teams.
- Surface: 71% turf now; duplicates home/road for most teams.
- "Unbeaten" vs "winning" diverge pre-1996 (ties). Need an explicit tie rule.
- AP rank: pin to rank at game time, not final rank.
- Spreads: spotty pre-~1985 and for FCS opponents; betting streaks need a caveat.

## Preset-shaped combos (verified anchors)
| preset | constraints | anchor |
| --- | --- | --- |
| The Saban Standard | vs unranked | Alabama 100 [v], Miami 72 [v] |
| Ranked Futility | vs ranked (L) | Rutgers 42, Nebraska 29 [v] |
| Road Warriors/Road Kill | road + conference | Kansas 44 Big 12 road losses [v] |
| Nightmare in the Bayou | home + night | LSU 28-0 [v] |
| Never Twice | after a loss | Saban bounce-backs [v] |
| Opening Day | season opener | Ohio State 20, Maryland 10 [v] |
| Kings of the State | in-state | Ohio State since 1921 [v], A&M 17 [v] |
| The Streak | specific opponent | ND–Navy 43, Neb–Kan 36, Fla–UK 31, OSU–Ind 29 [v] |
| Giant Killers | underdog + vs ranked | 2021 Kansas over Texas |
| Trap Door | after ranked win + vs unranked | 538 trap-game study [v] |
| Body Clock | road + 2+ zones + early kick | West Coast east trips [v] |
| Big Brother | P4 vs G5/FCS | UMass 16 [v]; P4 125-0 vs FCS [v] |
| Bowl Curse | bowls | bowl losing streaks |
| Chalk | as favorite (L) | Alabama favored 72 straight [v] |
| November Swoon | November + conference | Vandy under Lea 4-14 [v] |
| Nonconf Road vs Ranked | road + non-conf + vs ranked | A&M drought 1979→2025 ND win [v] |

## Design notes from the agent
1. Offer a "since date" ranking alongside game count; it rescues sparse constraints.
2. Keep filters separate from outcome types (cover, over/under, favored, scored are
   outcomes, not filters).
3. Store opponent attributes as of that season; rivalry/trophy lists must be curated.
4. Nine per-game facts cover ~80% of the catalog: date, site flag, venue, opponent ID,
   both AP ranks at game time, both conferences that season, closing spread and total,
   final score (by quarter for shape), kickoff time, head coach.
