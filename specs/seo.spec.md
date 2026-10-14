# Search traffic

Status: shipped 2026-10-14 (sections 1–4 below; section 5 is off-site work). The index
repo's sitemap-index now lists this site's sitemap (commit `0c8046f` there), the named
definition pages are `src/lib/landing.ts`, the posts pipeline is `content/posts/` +
`scripts/lib/posts.mjs`, every past season's weeks are prerendered, and the worker words
what the prerender doesn't write. Context: the domain is blacklisted from r/CFB, which was
the main referrer. The goal is search traffic that doesn't depend on Reddit.

## Where we stand

The prerender writes about 1,050 real HTML pages for the running season: the board,
the schedule and its weeks, at-risk, ~888 game pages, 136 team pages, and the
breakers pages. Each has its own title, description, self-canonical, OG tags, and
JSON-LD (WebPage + BreadcrumbList only). Googlebot reaches them through the share
worker, which passes prerendered pages through untouched. That part is healthy.

Three problems sit on top of it:

1. **Google knows one URL of this site.** A search for "Streak King drewhoover"
   returns nothing from the domain. `dist/sitemap.xml` is written and served, but
   nothing references it. drewhoover.com is verified in Search Console and Bing,
   and its robots.txt names `sitemap-index.xml`, a sitemap of sitemaps. That index
   lists only Astro's own `sitemap-0.xml`, and the index repo's `astro.config.mjs`
   fills `sitemap-0.xml` with each project card's `liveUrl` as a single entry
   (`customPages`). So the project's ~1,050 pages have never been in any sitemap
   a search engine was told about, and discovery is one link from the project card.
2. **Every past season is invisible.** A past-season week, game, or breakers page is
   the empty app shell with a worker-rewritten head. The body has no content unless
   Google renders the JS, every past-season week of a season shares one generic
   title ("1987 games"), the shell's JSON-LD describes the root page, and a past game
   against a never-FBS opponent is a true 404 (`gameFromShare` rejects teams missing
   from `meta.teams`). That's ~62k game pages and ~1,350 week pages contributing
   nothing.
3. **Nothing article-shaped exists.** The weekly digests are good data pages, but
   they're replaced in place each week (at-risk) or titled for navigation
   ("Week 8 games"), not for what people type. There's no dated URL that accumulates,
   no RSS, no prose.

## What people actually type

- **Head terms with real volume, weekly intent:** "longest active win streaks college
  football". NCAA.com owns it with an article they re-publish weekly at a dated URL.
  Variants are all chip definitions we already compute: home win streaks, losing
  streaks, road losing streaks (Kansas's 46-game road skid was a national story),
  streaks vs ranked.
- **Weekly event queries, thin competition:** "streaks broken this week", "streaks on
  the line college football". fbschedules does one annual piece; r/CFB threads ask
  the exact at-risk question. Nobody publishes this weekly.
- **Long tail we uniquely cover:** "[team] win streak", "last time Kansas beat
  Oklahoma" (drought queries get answered by sportskeeda H2H pages and local news),
  and individual past-game queries. We have every game since 1936 and every vsteam
  streak; nobody else computes the definitions.

Our advantage over the incumbents is freshness plus depth: NCAA's article goes stale
between posts, and none of them go back past a season or two. All volume guesses
above are inferred from who bothers to publish; Search Console data replaces them
once we're indexed (see Measurement).

## The plan, in order

### 1. Plumbing (one small PR here, one in the index repo, one thing in GSC)

- Drew, today: submit `https://drewhoover.com/cfb-streak-king/sitemap.xml` by hand in
  Search Console and Bing Webmaster Tools under the existing drewhoover.com
  property, then read the coverage report a week later. This is the fastest path to
  indexed and needs no code.
- Index repo, the durable fix: `@astrojs/sitemap` can't add a foreign child sitemap
  to `sitemap-index.xml`, so a postbuild step appends one `<sitemap>` entry per
  sibling that publishes its own sitemap. A `sitemapUrl` field on the project card
  frontmatter (next to `liveUrl`) says which siblings do; the root-URL harvest into
  `sitemap-0.xml` stays as the fallback for the rest. The `dataviz-pages-site` skill's
  registration step should mention the new field. A second `Sitemap:` line in
  robots.txt is the lazier alternative; it works, but the index is the thing already
  registered, so extend that.
- `site.config.js`: the description still says "since 1978"; the window is 1936.
- Retitle for the queries. "Week 8 games" becomes
  "Week 8 college football: streaks broken and records at stake · 2026"; a played
  game's title gains the sport and date ("Kansas 38, Oklahoma 33 — Oct 28, 2023")
  so it can match "kansas oklahoma 2023 score" shapes. Titles are cheap; this is
  wording, not structure.
- Worker fixes for shell-served pages: per-week titles for past seasons (the week
  number is in the URL; "1987 Week 8 college football games" needs no data), rewrite
  or strip the shell's root JSON-LD so past pages don't claim to be the homepage, and
  let a game against a non-FBS opponent fall back to a generic head instead of 404ing.
- JSON-LD upgrades on prerendered pages: ItemList on the board, breakers, and
  digests; SportsEvent on game pages (teams, date, score). These qualify pages for
  rich results; they don't rank pages by themselves.

### 2. Named definition landing pages (the biggest swing)

A curated set of definitions gets real paths, each prerendered as the board with that
definition applied:

- `/longest-active-win-streaks/`
- `/longest-home-win-streaks/`
- `/longest-losing-streaks/`
- `/longest-road-losing-streaks/`
- `/longest-win-streaks-vs-ranked/`
- all-time variants of the above, ~10–20 pages to start

Each page is the existing board view seeded with its chips, plus an h1 that matches
the query, a title like "Longest active home win streaks in college football
(updated weekly)", and one method sentence. They go in the sitemap and refresh with
every rebuild, so they're always current the way NCAA's article never is.

Mechanics follow the view conventions: a slug → definition table (editorial, in
`site.config.js` or next to the chip catalog), `url.ts` parses the path, `main.jsx`
seeds from it, the prerender renders each slug, `url.test`/`App.test` cases. A `?c=`
URL whose definition matches a slug canonicalizes to the slug page; everything else
keeps canonicalizing to the root, which stays the right call for 24M definitions.

### 3. The weekly posts (Thursday at-stake, Sunday broken)

The data pages already exist: `/games/at-risk/` for the running week and the week
digests for results. What's missing is the article wrapper: a dated URL that
accumulates, prose that says what the tables can't, and a feed.

- Posts are markdown files in `content/posts/`, prerendered to
  `/blog/<season>-week-<n>-streaks-at-stake/` and `.../streaks-broken/` with Article
  JSON-LD, a date, and links into the at-risk page, the week page, and the game
  pages they discuss. `/blog/` is the index; `/blog/feed.xml` is RSS. The posts live
  in this path, not on the index site, so the authority accrues here; the index
  site's Astro blog gets a link or an occasional companion post, not the content.
- The prose is the point. A templated paragraph over the same rows the digest shows
  is duplicate content with extra steps. The post earns its URL by saying why a
  streak matters, what history sits under it, what the line implies — the stuff the
  table doesn't say. So: a scheduled Claude task drafts each post from the fresh
  digests, Drew approves, the push to main publishes it (and rebuilds the site,
  which is what publishing means here).
- Cadence needs one new cron. Today deploy.yml builds Sunday and Friday 14:00 UTC.
  Sunday covers the broken post. Add Thursday ~13:00 UTC so the at-stake post drafts
  from Thursday's lines instead of Sunday's; the draft task runs after it.

### 4. Past seasons (the long tail, after 1–3 land)

- Prerender past-season week pages: ~90 seasons × ~15 weeks ≈ 1,350 pages, each with
  its own broken-streaks title and embedded rows from `dist/games/<season>.json`,
  which the build already writes. The prerender already renders ~900 game pages, so
  the cost is build time, not new machinery.
- Past game pages stay with the worker. 62k prerendered pages is too much build and
  too much deploy for unproven queries. If the week pages index and pull impressions,
  the next step is prerendering only the games that broke a top streak each season,
  not all of them.
- Rivalry drought pages ("every streak in Kansas vs Oklahoma") are a plausible later
  family from the vsteam data. Not scoped here; GSC should show whether drought
  queries reach the game pages first.

### 5. Off-site (not code, listed so it's not forgotten)

- Team subreddits aren't r/CFB; a team's at-risk streak is on-topic content for its
  own sub. Same for CFB Twitter/Bluesky with the share cards that already exist.
- The method is Hacker-News-shaped (mine 443 chips over 90 years on worker threads);
  one Show HN costs a morning.
- A dataset page with Dataset JSON-LD over the errata/receipts work could earn
  researcher links; the CC0 errata repo already exists as the citable thing.

## Measurement

GSC impressions and queries, once verified, are the whole scoreboard; revise the slug
list and the post titles from what actually gets impressions after a few weeks. The
worker already reports crawler hits to Mixpanel (`share unfurl`), so no new
analytics.

## What we don't do

- No prerendering the definition space beyond the named slugs; unnamed `?c=` URLs
  keep canonicalizing to the root.
- No thin programmatic "articles". Every new URL is a real view of the data or a
  post a person approved.
- No product-rule changes: the floors, the ranks-not-scores rule, and the nesting
  rule apply to landing pages and posts like any other view.

## Settled

- Posts live in-path at `/blog/` (Drew, 2026-10-14).
- drewhoover.com is verified in Search Console and Bing Webmaster Tools, with a
  sitemap index as the registered sitemap (Drew, 2026-10-14).

## Open questions

- Weekly posts: agent-drafted with your approval, or are you writing them some weeks?
  The approval step is the publish trigger either way.
- The post slug shape. `/blog/2026-week-8-streaks-at-stake/` reads as a date-stamped
  article; `/blog/streaks-at-stake/2026/week/8/` matches the schedule's address
  convention. The first is what Google's article treatment expects and what RSS
  readers show; the second nests. I'd go with the first for posts since they're
  articles, not views, WDYT?
