# Reach that compounds

Status: plan, 2026-10-16. Built from four research passes (CFB media citations, fan
communities, link mechanisms for reference sites, search demand) plus three weeks of
Mixpanel. Context: Drew's own links are blocked on r/CFB by one mod, and whether the
domain is blacklisted is unresolved. Fan subs and r/cfb_v2 are open. The goal is reach
that grows without Drew posting, which means other sites and other people linking in.
`seo.spec.md` covers the search plumbing; this spec is what sits on top of it.

## What the research says

Three channels compound for a reference site, and each one needs the site shaped for
citing: a stable URL per fact, a title that is the fact, a credit line, and a weekly
artifact someone else can pass along.

1. **Writers already publish our lists and credit nobody.** CBS (active home win
   streaks, Sept 2025), Yahoo (longest losing streaks, Sept 2026), 247 (home streaks
   entering 2024), SDS (unbeaten vs unranked), SI (home streaks) each republish the
   streak listicle every season with no source line. FBSchedules runs "streaks on the
   line" once a year by hand. The indie sources that do get credited are two shapes:
   a stable permalink page a team-site writer deep-links in a weekly preview
   ("according to Winsipedia", "historical data courtesy of Sports Reference"), and a
   weekly artifact posted on X that gets embedded or hat-tipped (Game on Paper,
   @CFB_Data). Nobody offers a linkable weekly list of streaks under conditions or
   streaks on the line.
2. **Search is already working where a page exists.** Two days after the sitemap went
   in, the site is #1 on Google for "longest win streak vs ranked teams" and #3 for
   "longest home win streak college football". The queries with no owner are the ones
   we compute and nobody else does: streaks broken this week (a fan-compiled reddit
   thread is the best result), streaks at risk (only betting previews), cover streak
   and ATS streak (no page exists anywhere), consecutive wins as an underdog (a reddit
   thread asked it on Oct 10), night and month streaks, road win and road losing
   streaks, conference losing streaks, bowl win streaks, "[team] win streak" (Wikipedia
   rivalry pages and Texas softball). Demand is in-season only, September through
   early December, and spikes when a long streak ends; the spike goes to whoever
   published a dated list that weekend (CBS took the Georgia home-streak traffic).
3. **Spikes don't compound, secondary coverage does.** The HN and reddit post-mortems
   all show the same curve: back to baseline in two days, 94% bounce. What lasted
   for the sites that made it (Baseball-Reference, KenPom, Torvik, CFBD) was being
   the free number writers couldn't get elsewhere, over years, plus free data other
   people built on. Wikipedia won't take self-citations, but hobby CFB sites get cited
   there heavily once writers cite them first: College Football Data Warehouse has 500+
   article links and is dead, jhowell.net has 210.
4. **Fan communities tolerate a fact with a summary and a link, not a link.** TexAgs,
   Eleven Warriors, TigerDroppings and 247 threads all say the same thing in their
   rules: a few sentences in the post, the link second. HuskerBoard needs mod
   permission for any outside link. Team subs run a 10:1 ratio (r/ockytop states it;
   reddit's old wiki says 10%). CFB Chat on Discord has 30k members. The one thing
   that worked without Drew was a Houston fan dropping a team-specific streak link
   into a conversation, 186 visitors and 13% on to the team page.

## The plan

Five workstreams. A and B are code and ship first because C and D depend on them.

### A. Shape the site for citing (one PR, this week)

- **Definition pages for the unowned queries.** Add to `landing.ts`: cover streaks
  (active and all-time), ATS losing streaks, wins as an underdog, night-game win
  streaks, road win streaks, road losing streaks, conference losing streaks, bowl win
  streaks, and a month page for the running month. Each is a chip set we already mine.
  Titles worded the way the queries read ("Longest active cover streaks in college
  football, updated weekly"). This is the cheapest thing on the list and the search
  report says every one of them is winnable against a reddit thread or a stale article.
- **Team page title is the fact.** "[Team] win streaks and losing streaks, active and
  all-time, since 1936" so the page can match "[team] win streak", where today Wikipedia
  rivalry pages and softball win. The team page already has the content.
- **A credit line.** On the panel, the team page and both digests: one line, "per Streak
  King (drewhoover.com/cfb-streak-king)" with the permalink, and a copy button. Writers
  credit with one line; give them the line. Track copies as `cite`.
- **A paste-able card.** The worker already draws a PNG for every address. Expose it
  as an embed snippet (image linking to the permalink) next to the credit line, the
  Sports Reference widget pattern. Costs an afternoon.
- **A data page.** `/data/`: the season files and the streak files we already write
  to `dist/`, documented, licensed (CC BY, the errata repo is already CC0), with
  Dataset JSON-LD. CFBD and Torvik both grew through people building on free data,
  and r/CFBAnalysis is not r/CFB.

### B. The weekly artifact, posted where writers look (every Thursday and Sunday)

The Thursday at-risk page and the Sunday broken page are the artifact. What's missing
is a place writers see them that isn't r/CFB.

- A site account on X and on Bluesky. Thursday: the at-risk card with the top three
  in the text. Sunday: the broken card the same way. No tagging, no replies to
  writers, just the cadence. Game on Paper and @CFB_Data got embedded by being there
  every week. Bluesky's API is free, so the build can post it; X needs a paid API
  tier, so that one is a paste from the build's `share/weekly.json` for now.
- r/cfb_v2 and the sub of whichever team's streak leads the week, as a text post:
  two sentences of the fact, link in the body. Three posts a week at most across all
  subs, and only where the team's streak is in the digest's top rows.
- The weekly post from `seo.spec.md` section 3 is the dated URL this cadence points
  at when a streak ends. See E.

### C. Writers (by hand, Sunday mornings, in season)

The research found the names. The pitch is a dated, linkable list when a streak ends,
sent the morning the listicle gets written.

- Amy Daughters (FBSchedules, writes "streaks on the line" annually and credits indie
  sources by name): offer the weekly version and the data.
- Cody Nagel (CBS, active home win streaks, uncredited), Daniel Chavkin (Yahoo, longest
  losing streaks, uncredited), Spenser Davis (SDS, credits CFBD and Game on Paper in
  weekly previews), Matt De Lima (SI and Yahoo, hat-tips Game on Paper weekly), Bruce
  Marshall (CBS, weekly ATS notes, the audience for cover streaks), Brandon Marcello
  (CBS, has run pieces on data supplied to him).
- Format: one email Sunday morning, under 150 words, the three biggest broken streaks
  with links and the "since" year, and the at-risk list for next week. Same email every
  week whether or not anyone replies. Stop after six weeks if nobody has cited it.
- This is the one mechanism the research could not find evidence for. It's the bet.

### D. Fan communities (by hand, a few a week, only when the fact is real)

- Where a team's streak leads the week: TexAgs, Eleven Warriors, TigerDroppings, 247
  team threads, the team sub. The post is the fact in two or three sentences, with the
  since-year and the streak-ender, then the link. Never a bare link.
- HuskerBoard: email mods@huskerboard.com once and ask; a Nebraska-only page may count
  as a Husker site.
- This doesn't compound on its own. Its job is to seed the fans who share the way the
  Houston fan did, and to put the page in front of the team-site writers who read
  those boards.
- The 10:1 ratio means Drew has to be a participant in the two or three communities
  he'd actually read anyway, not a visitor to thirty. Pick those.

### E. The weekly post, narrowed

The earlier case for posts was prose for its own sake. The research supports a
narrower one: when a streak ends, the search spike goes to a dated listicle written
that weekend, and the digest pages can't be that because they're replaced in place.
So the Sunday post's job is to be the dated page for that week's event, titled the way
CBS titles theirs ("Longest active home win streaks after Georgia's 33-game run
ended"), 200 to 400 words over the digest rows with the since-years and the receipts,
and it's what the Sunday email in C links.

- Agent-drafted from `dist/games/digests.json` and `share/weekly.json`, Drew reviews,
  the push publishes. A skill holds the title shape, the link rules, the house voice,
  and the rule that every number in the post has a row behind it.
- If Drew won't review one a week in season, skip E and let the digest page carry it.
  A post nobody reviews is worse than no post.

### What we don't do

- No r/CFB posts or comments from Drew while the block stands.
- No automated posting to forums or subs. The Bluesky build post is the one automation.
- No self-citation on Wikipedia and no asking editors to add us. If a writer cites a
  page, an editor can cite the writer. The data page and the CC0 errata repo are the
  things an editor would cite.
- No betting product. Cover streaks are history pages; r/CFB's rule 6 and the ATS
  writers both want it framed that way.
- No second HN or Product Hunt launch, and no paid promotion.

## Measurement

- GSC: impressions and position for the gap queries in A, per page, read weekly.
- Referring domains: GSC's links report plus Mixpanel `$initial_referring_domain`,
  the scorecard board's source chart. A new domain is the number that matters.
- `cite` copies and card unfurls by host (`share unfurl` already reports the agent).
- The scorecard's floor on no-post days, week over week.
- Six-week check on C: any citation at all, or stop.

## Sequence

- Week 1: A as one PR. Open the X and Bluesky accounts; first Thursday post.
- Week 2: data page. First Sunday email. First fan-community posts where a streak
  broke.
- Week 3: matchup pages, the Winsipedia shape, for the running season's pairings
  only (the game pages exist; add the series history and the "has X ever beaten Y at
  home" answer with dates). `seo.spec.md` lists these as a later family; the citation
  evidence moves them up.
- Week 4: read GSC and the referrer list; drop what's not moving.

## Open questions

- A site account on X and Bluesky, or your own? A site account is easier to hand to
  the build and harder to get followed.
- Which two or three communities would you actually participate in at 10:1?
- Will you review a Sunday post in season? If not, E is out and C links the digest.
- Is it worth one email to HuskerBoard's mods, or skip Nebraska?
