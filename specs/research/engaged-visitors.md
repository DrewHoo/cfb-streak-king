# Research: who goes deep on the board, and what got them there (2026-10-16)

Mixpanel project 3518004, 2026-09-26 (the first day of data) to 2026-10-16, `site` contains `streak`, Drew's three devices excluded. Every number is unique visitors unless it says otherwise.

## What counts as engaged

`definition` fires on every change to the board's view, not just a change of definition (`App.jsx` tracks it in the URL effect, whose deps include `team`, `run` and `week`). So opening and closing a streak panel each count. Two measures follow:

- Distinct `chips` values per visitor, which a panel open doesn't move. Of the 1,720 visitors who loaded a board, 1,321 (77%) only ever saw one set of chips, 161 saw two, 73 saw three and 165 (10%) saw four or more.
- 10 or more `definition` events, which counts panel opens too. 107 visitors (6% of board loaders) got there.

The second one is what the funnels below can measure, so "engaged" below means 10+ `definition` events.

The drop is all at the first step. Of board loaders, 36% fire a second `definition` event. After that each step keeps 68% to 90%, so a visitor who makes two changes usually keeps going.

## Where engaged visitors landed

The landing page is the first pageview in the window (a funnel's first step, broken down by `current_url_path`).

| landed on | visitors | loaded a board | 10+ events |
| --- | --- | --- | --- |
| `/games/week/5/` | 1,765 | 318 (18%) | 12 (0.7%) |
| `/` (the board) | 1,599 | 1,339 (84%) | 95 (6%) |
| `/games/at-risk/` | 209 | 11 (5%) | 0 |
| any search landing page | about 25 combined | | too few to read |

By first referrer:

| referrer | visitors | loaded a board | 10+ events |
| --- | --- | --- | --- |
| www.reddit.com | 2,358 | 32% | 29 (1.2%) |
| direct | 964 | 78% | 60 (6%) |
| Reddit app | 160 | 98% | 8 (5%) |
| google | 11 | 100% | 4 (36%) |

So the week 5 schedule, mostly from Reddit, was the biggest way in, and it almost never led to the board. The board itself gets the deep visits. Google is promising but it's 11 people, and the landing pages only shipped on 2026-10-15, so it's too early to judge them.

## Device, for visitors who landed on the board

| OS | visitors | loaded a board | 10+ events |
| --- | --- | --- | --- |
| iOS | 1,022 | 79% | 48 (5%) |
| Android | 369 | 97% | 22 (6%) |
| Mac | 101 | 82% | 13 (13%) |
| Windows | 100 | 85% | 12 (12%) |

Desktop goes deep about twice as often as a phone, but 87% of board landers are on a phone. iOS also loses 21% before the first `definition` event fires, where Android loses 3%. That gap is worth a look: either those visitors left before the page hydrated, or the event didn't fire (an in-app browser, maybe?).

## The first action after the board loads

After the first `definition` event (a Mixpanel flow), 55% of visitors did nothing else tracked. About 20% changed the view and loaded another definition, 6% opened a streak (`team open`), and 2% went to a team page.

Per first action (a funnel from the first board load through the action, then 8 more `definition` events):

| action | visitors who did it | went on to 8 more |
| --- | --- | --- |
| `team open` | 219 | 66 (30%) |
| `lead apply` | 389 | 30 (8%) |
| `show more` | 17 | 8 |
| (any board load) | 1,721 | 108 (6%, the baseline) |

`team open` is overstated, because the panel opening fires its own `definition` event (97% of them land within a second). Even so, opening a streak is the action most associated with going deep. `lead apply` (a streak opened from a list: a digest, a team page or a landing page) brings people to the board, but few of them stay. These are correlations: someone already inclined to dig opens a panel.

## Definitions people reached that aren't landing pages yet

The biggest counts are arrivals from shared links, not things people built: `fullmoon,vsmascot:canine` (542, a Reddit post), `home,confgame,night` (251), `dog` (247), `unranked` (237, the root's default), `road,vsteam:minnesota` (75) and `fullmoon,home,vsmascot:animal,nonconf` (64).

Below those, these single-chip definitions were reached by 10 or more visitors and have no page in `landing.ts`:

| chips | visitors | mostly |
| --- | --- | --- |
| `fav` (as the favorite) | 50 | W and L |
| `vsnewcoach` (vs a first-year head coach) | 44 | L |
| `top10` (vs top-10 opponents) | 36 | W |
| `top5` (vs top-5 opponents) | 35 | W and L |
| `night` | 24 | L |
| `newcoach` (in a coach's first season) | 24 | W |
| `dog14` (as a 14+ point underdog) | 23 | W |
| `power` (vs power-conference opponents) | 20 | L |
| `rivalry` | 18 | W |
| `state:TX` | 16 | W |
| `afterwin` | 15 | L |
| `vsteam:alabama` | 14 | W and L |

`rivalry`, `top10` and `vsteam:<team>` read like things people search for ("longest rivalry win streak", "longest win streak vs top 10 teams", "longest win streak vs alabama"). A per-opponent page is a different kind of landing than the table has now, and there are 130-odd opponents, so maybe start with a handful of big rivalries?

## What to try

1. The schedule pages get lots of arrivals and send almost none of them to the board. The digest rows already open a streak (`lead apply`), but only 8% of those visitors keep going. So the schedule could offer a way into the board that isn't a single streak, maybe the broken run's definition with a "try it for every team" link?
2. The first definition change is where 64% of board loaders stop. The "try a twist" row (one tap that adds a chip to the current definition) targets exactly that step.
3. Most visitors are on a phone and phones go deep half as often, so the definition sentence on a phone is the place to spend effort.
4. Check the 21% of iOS visitors who never fire a `definition` event.
5. Instrumentation: 1) add a `changed` flag (or a separate event) for a real definition change, so engagement doesn't count panel opens, and 2) register the landing path as a super property on the first pageview, so any report can split by it without a funnel.
6. Re-run this in two weeks, when the landing pages have had time with Google and Bing.

Mixpanel reports: [landing page funnel](https://mixpanel.com/project/3518004/view/4019688/app/insights#okvZHyM2kedr), [referrer funnel](https://mixpanel.com/project/3518004/view/4019688/app/insights#1L3sc5PaZF5q), [OS funnel](https://mixpanel.com/project/3518004/view/4019688/app/insights#m7LJsE8bmfcd), [first action flow](https://mixpanel.com/project/3518004/view/4019688/app/flows#oTAEaho6vxDM).
