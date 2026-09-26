# dataviz-project-template

A starter for a data-visualization site that deploys to GitHub Pages under your own domain at `https://<domain>/<repo-name>/`. It assumes you already have a GitHub User Site (`<owner>/<owner>.github.io`) with a custom domain, built from [`personal-site-starter`](https://github.com/DrewHoo/personal-site-starter). Every public repo you own with Pages enabled then serves under that domain with no extra DNS.

What's in the box: Vite + React, the `base` path derived from the repo name, a deploy workflow, a prerender step so crawlers see the page, a `<head>` generated from one config file, favicon and OG image generators, a sample D3 chart with touch-friendly hover, URL state, and the index site's embed scripts (back bar, comments, analytics).

The [`dataviz-pages-site`](https://github.com/DrewHoo/dataviz-pages-site) skill knows this template. In Claude Code, "new dataviz project called `<slug>`" walks the steps below.

## Start a project

1. **Use this template** on GitHub, name the repo the slug you want in the URL (lowercase, kebab-case), make it public. Clone it.
2. Set `"name"` in `package.json` to the repo name. That is the URL path.
3. Edit `site.config.js`: your domain, the title, the description, the OG copy.
4. `npm install`, then `npm run gen:favicon && npm run gen:og`. Open `public/og.png` and `public/card.png` and look at them. Commit the outputs.
5. Enable Pages with the source set to Actions:

   ```sh
   gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
   ```

6. `git push`, then `gh run watch`. The site is live at `https://<domain>/<repo>/` when the run is green.
7. Register the project card on your index site (the skill's `index-registration` reference), copying `public/card.png` to the index repo's `public/projects/<repo>.png`.

## Replace the sample

- `src/data/sample.js` is the data. `src/App.jsx` and `src/Chart.jsx` are the page. `src/styles.css` is the look.
- Data that has to be fetched goes in a build-time script that writes to `public/data/` (gitignored). See the skill's `build-time-data` reference.
- Before sharing the URL, run the skill's pre-launch checklist. The two that bite: `curl -s <url> | grep -c '<div id="root"></div>'` must print `0`, and the OG card must look right in a platform's card validator.

## Why it is shaped this way

- **Prerender.** A Vite SPA deploys `<div id="root"></div>` and nothing else. Google usually renders JS eventually; Bing, DuckDuckGo, social unfurlers, and LLM crawlers mostly don't. `scripts/prerender.mjs` bakes the rendered app into `dist/index.html`, which is why `main.jsx` hydrates and why render never touches `window`.
- **One config file.** The domain and copy live in `site.config.js` and the slug in `package.json`. `index.html` has no owner-specific values, so the template stays generic and a project has exactly two places to edit.
- **Embeds, not dependencies.** The back bar, comments, and analytics are script tags pointing at your index site. Fixes land there once.
