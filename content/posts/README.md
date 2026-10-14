# Weekly posts

One markdown file per post. The file name is the slug: `2026-week-8-streaks-at-stake.md`
publishes at `/cfb-streak-king/blog/2026-week-8-streaks-at-stake/`. The build
(`scripts/prerender.mjs`, via `scripts/lib/posts.mjs`) renders each into a page with the
site's styles, an Article head and JSON-LD, lists them at `/blog/`, and writes the feed at
`/blog/feed.xml`. Pushing the file to `main` publishes it (the deploy rebuilds the site).

Frontmatter, all three required:

```markdown
---
title: Streaks at stake in Week 8
date: 2026-10-15
description: One or two sentences for the search snippet and the feed. The first ~155 characters show.
---
```

Optional: `image: /cfb-streak-king/og/week/8.png` (an absolute path or URL for the social card;
the default is the site's board image), `draft: true` (skipped by the build).

The body is GitHub-flavored markdown. Link into the site with absolute paths, so the links
survive the feed: `/cfb-streak-king/games/at-risk/`, `/cfb-streak-king/game/2026-10-18/georgia-at-alabama/`,
`/cfb-streak-king/team/alabama/`, `/cfb-streak-king/longest-home-win-streaks/`.

Cadence: the Thursday post is the week's at-risk streaks, drafted after the Thursday rebuild
(`deploy.yml` builds Thursday 13:00 UTC, so the lines are that morning's); the Sunday post is what
the week's results broke, after the Sunday rebuild. `/games/at-risk/` and `/games/week/<n>/`
hold the rows; the post is the prose over them.
