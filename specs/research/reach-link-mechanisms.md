# Research: link mechanisms that compound for small sports-data sites (Opus agent report, 2026-10-16)

Feeds `specs/reach.spec.md`.

What I could document is thinner than the brief asked for. Founder retrospectives almost never break down where early links came from, so a few rankings below rest on one or two sources. Where something is my inference rather than a source's claim, I say so.

## (a) Mechanisms, ranked by how much they compounded

**1. Static, crawlable pages, one per entity (team, game, player)**
- Example: Sean Forman says he built Baseball-Reference as static pages because "I knew the best way to do it would be to make static pages so they would be fast and indexed by search engines." It launched in April 2000 with 152,835 page views that month. He describes later growth as "pretty gradually over time", reaching 500,000 page views on a normal day. https://tht.fangraphs.com/sean-forman-interview/
- At launch it was about 20,000 pages on $20/month hosting. https://now.uiowa.edu/2017/03/baseball-statistics-website-baseball-referencecom-born-ui
- Requires: nothing beyond what Streak King already ships.
- Feasibility: already done. What's left is time, and checking that the pages actually get indexed.

**2. Being the free reference that writers and broadcasters quote**
- Example: KenPom. Pomeroy's posts "caught on with a burgeoning community of fans, who discussed his work on message boards and blogs of their own." Then Luke Winn at SI.com was "among the first to integrate tempo-free stats", Pat Forde and ESPN.com followed, and Fran Fraschilla cited the ratings on broadcasts. https://www.hoopshq.com/long-reads/kenpom-com-is-college-basketballs-premier-analytics-site-but-its-founder-never-planned-for-it-to-happen
- The end point is institutional: the NCAA selection committee's team sheets have listed KenPom since 2017-18. https://www.cbssports.com/college-basketball/news/the-ncaa-tournament-committee-will-select-and-seed-teams-using-a-new-ranking-system-after-killing-the-rpi
- Torvik, a solo lawyer's free site, was added to the team sheets in 2025. https://www.insidethehall.com/?p=113161
- Covers dates his ratings to 2008 and says they "really started gaining traction around 2015", which is about seven years. https://www.covers.com/ncaab/what-are-torvik-ratings
- Early Baseball-Reference had the same pattern: a small Sports Illustrated item crashed the server. https://now.uiowa.edu/2017/03/baseball-statistics-website-baseball-referencecom-born-ui
- Requires: a number writers can't get anywhere else, plus years of consistency. No backend.
- Feasibility: high. "Longest active X streak" is exactly the kind of note a writer quotes. Expect a multi-year timescale.

**3. Free data and an API others build on**
- Example: CFBD began when Bill Radjewski was "compiling and sharing college football data with the r/CFBAnalysis community". The API followed in fall 2018. https://radsportsanalytics.com/about/
- Torvik's free data spawned the toRvik R package ("No subscription is required"). https://ftp.eenet.ee/pub/cran/web/packages/toRvik/vignettes/introduction.html
- nflfastR was built on by NFLSimulatoR, nfl4th and nflverse. https://cloud.r-project.org/web/packages/nflfastR/index.html
- FiveThirtyEight put its Elo data on GitHub under CC BY 4.0. A mirror shows about 11,000 forks, and an R package wraps it. https://rudeboybert.r-universe.dev/fivethirtyeight
- Requires: on a static site, a "backend" can just be versioned JSON/CSV files plus a license.
- Feasibility: high. Streak King already writes JSON to `dist/`. Documenting it, licensing it (the errata repo is already CC0) and adding Dataset markup is cheap. Google says Dataset markup feeds Dataset Search and "does not guarantee" a search-results feature. https://developers.google.com/search/docs/appearance/structured-data/dataset

**4. Writing alongside a respected outlet, and hiring a voice**
- Example: FanGraphs "struggled to gain traction", and Appelman nearly quit in 2007. Things changed when Dave Cameron joined in 2008, who "instantly transformed FanGraphs". https://blogs.fangraphs.com/fangraphs-turns-20-years-old-today/
- Earlier, Appelman wrote for The Hardball Times "as a way to publicize his new site." https://tht.fangraphs.com/its-the-hardball-times-and-fangraphs
- Before Baseball-Reference had its own name, it launched in February 2000 inside the Big Bad Baseball Annual's site. https://en.wikipedia.org/wiki/Baseball_Reference
- Requires: relationships, not infrastructure.
- Feasibility: high. A guest column or a recurring note in an established CFB outlet or newsletter that links the weekly digests is the analog. The blog posts Drew already writes are the raw material.

**5. A daily or weekly habit product**
- Example: Sports Reference's Immaculate Grid. Forman said "We were getting 20% or 30% more traffic on Baseball Reference" because players researched their answers there. https://frontofficesports.com/article/new-owner-of-immaculate-grid-baseball-game-eyes-football-other-sports/
- Requires: a recurring reason to return.
- Feasibility: medium. The weekly "broken" and "at risk" digests are this, in a weaker form. What compounds is whether they become a citable weekly fixture; I found no evidence for streak digests specifically.

**6. Embeds and linker tools that carry a link back**
- Example: Sports Reference launched embeddable, daily-updating table widgets in 2012. https://www.sports-reference.com/blog/2012/02/
- It also ran a Player Linker: bloggers' posts got linked to PFR player pages, PFR pulled them by RSS, and it would "link back to you" from those pages. https://www.sports-reference.com/blog/2012/09/add-links-to-your-sites-blog-posts-to-pfr-player-pages/
- Live linker pages: https://www.pro-football-reference.com/linker
- I found **no data on how many links these earned**. They are clearly still maintained, which is weak evidence they pay off.
- Requires: an image or iframe endpoint. Streak King's worker already renders a PNG for every address.
- Feasibility: high. A "paste this" image card plus a suggested citation line, both linking to the permalink, is close to free.

**7. Statistics pages built for people writing articles**
- Example: Foundation Inc's study found 42.1% of statistics pages earn 1,000+ referring domains. https://foundationinc.co/lab/top-pages-b2b-backlinks/
- Ahrefs' stats page earned 36 links in weeks by updating stale numbers on other sites. https://www.searchenginejournal.com/statistics-pages-earn-links/
- Caveat: both are B2B, not sports. I found no sports example.
- Feasibility: high. The named definition pages (/longest-home-win-streaks/) are this format.

**8. Featured snippets, People Also Ask, structured data**
- Google says you can't mark a page as a featured snippet: when asked how, it answers "You can't." https://developers.google.com/search/docs/appearance/featured-snippets
- So this is an outcome of ranking, not a lever. I found no sports-data case study.
- Feasibility: nothing more to do beyond clean answer-shaped headings.

**9. Google Discover**
- No special tags are needed: indexed content that meets Discover's content policies is eligible. Google recommends images at least 1200px wide, `max-image-preview:large`, and "timely" content. https://developers.google.com/search/docs/appearance/google-discover
- I found no sports-data example.
- Feasibility: medium. The weekly digest pages with large OG cards fit the requirements. Discover sends traffic, not links.

**10. Not found:** I found no documented example of each of these working for a sports-data site:
- a weekly email to writers;
- a public corrections log earning links;
- podcast credits;
- Product Hunt.

I also found no documented early-growth history for TeamRankings, cfbstats.com, Stathead, StatMuse, Baseball Savant (MLB-run, so not comparable), Parker Fleming's public work, Neil Paine's subscriber numbers (https://neilpaine.substack.com/about has none) or Hostile Territory. Basketball-Reference's only documented detail is that it launched in April 2004. https://sports-reference.com/about

## (b) Wikipedia

**What the existing streak articles cite**
- *Longest NCAA Division I football winning streaks*: 6 references. Five are NCAA (record books on ncaa.org, plus ncaa.com) and one is gohuskies.com. No stats sites. https://en.wikipedia.org/wiki/Longest_NCAA_Division_I_football_winning_streaks
- There is no FBS losing-streak list. The general *Losing streak* article cites "NCAA FBS Records, 2012" for Northwestern's 34-game streak. https://en.wikipedia.org/wiki/Losing_streak
- I found no home-win-streak article.

**Policy**
- WP:V: "Base articles on reliable, independent, published sources with a reputation for fact-checking and accuracy." https://en.wikipedia.org/wiki/Wikipedia:Verifiability
- Also WP:V: "Anyone can create a personal web page, self-publish a book, or claim to be an expert."
- The self-published-source exception: such sources "may be considered reliable if published by an established subject-matter expert, whose work in the relevant field has previously been published by reliable, independent publications."
- WP:EL lists among links to avoid: "Blogs, personal web pages, and most fansites... except those written by a recognized authority." https://en.wikipedia.org/wiki/Wikipedia:External_links
- WP:EL also says "you should avoid linking to a site that you own, maintain, or represent." Wikipedia links pass no search-ranking benefit.
- WP:COI: citing your own work "is allowed within reason, but only if it is relevant", and "Citations should be in the third person and should not place undue emphasis on your work." Adding many self-citations is refspam. https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest

**Precedent: hobbyist CFB sites are already cited heavily**
- Special:LinkSearch shows 500+ article links to cfbdatawarehouse.com, a volunteer site run by Tex Noel and David DeLassus. https://en.wikipedia.org/w/index.php?title=Special:LinkSearch&target=*.cfbdatawarehouse.com&limit=500 and https://en.everybodywiki.com/College_Football_Data_Warehouse
- 210 links to jhowell.net (James Howell, one of Streak King's own sources). https://en.wikipedia.org/w/index.php?title=Special:LinkSearch&target=*.jhowell.net&limit=500
- 92 links to kenpom.com.
- Zero found for collegefootballdata.com. The lookup could be missing subdomain links.
- WikiProject College Football lists CFB Data Warehouse under external resources. https://en.wikipedia.org/wiki/Wikipedia:WikiProject_College_football
- I found no noticeboard ruling on Sports Reference or Howell.

**The path, and what disqualifies it**
- Legitimate: the site's figures first get published by reliable outlets (a writer quoting Streak King), which makes Drew an "established subject-matter expert". After that, an *independent* editor may cite it. Drew can propose a citation on the talk page with a COI disclosure.
- Disqualifying: Drew adding his own links to articles, many self-citations (refspam), or citing derived "hundreds of conditions" streaks that no secondary source covers.
- Practical reality: editors prefer the NCAA record book for headline records. The open niche is the conditional streaks the record book lacks, and Wikipedia also discourages those as original synthesis unless a secondary source reports them. That last point is my inference; I did not find a policy page saying it.

## (c) What didn't compound

**HN and Reddit spikes fade to the old baseline**
- One HN hit drew 40 to 50 hits a minute until it left the front page after about 16 hours, then "falls off a cliff". https://www.solipsys.co.uk/new/AnatomyOfAHit.html
- JobBoard.io went from 17 visits to 2,300 on launch day, then 69 the day after next. https://jobboard.io/?p=1106
- A #1 HN and r/programming post drew about 77,000 reads in two days. The lasting effect was revenue, with no traffic baseline reported. https://daily.tinyprojects.dev/60
- A year of HN spikes showed about a 94% bounce rate and 15 to 22 second visits. https://www.vincentschmalbach.com/analyzing-a-year-of-hacker-news-traffic/
- Spike traffic monetizes poorly: one commenter earned 4 ad clicks, $2.76, from 30,000 page views. https://news.ycombinator.com/item?id=2186543

**What lasted came from secondary coverage**
- Domain Pigeon's months-later traffic came mostly from the articles CNET and ReadWriteWeb wrote about it, plus search. https://www.indiehackers.com/post/the-hacker-news-effect-9b19d71f51

**Building alone without a voice stalled**
- FanGraphs "struggled to gain traction" for about 2.5 years while Appelman ran it mostly alone. https://blogs.fangraphs.com/fangraphs-turns-20-years-old-today/

**Volunteer reference sites can die**
- CFB Data Warehouse went offline in 2017, came back with data only through 2015, and reportedly shut again around 2020 (that claim is tagged citation needed). https://en.everybodywiki.com/College_Football_Data_Warehouse
- Its hundreds of Wikipedia links now point at a dead or stale site. That is an opening for a maintained, sourced successor, but only through independent editors.

**Not found:** I found no r/dataisbeautiful front-page post-mortem with numbers, and no post-mortem from a sports-data builder specifically.
