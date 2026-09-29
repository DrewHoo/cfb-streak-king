// Runs after `vite build`. Bakes the rendered app into dist/index.html, writes
// the <head> from site.config.js, and renders one page per current FBS team
// at dist/team/<id>/index.html with that team's panel open and its own
// social preview (public/og/team/<id>.png when it exists).
//
// Without this the deployed page is `<div id="root"></div>` and every word on
// it exists only after React runs. Google usually renders JS in a deferred
// second pass; Bing, DuckDuckGo, social unfurlers, and the LLM crawlers
// largely don't. Prerendering makes the content plain HTML.
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = pkg.name
const ORIGIN = `https://${config.domain}`
const SITE = `${ORIGIN}/${SLUG}/`
const OUT = path.join(ROOT, 'dist/index.html')

if (config.domain === 'example.com') {
  console.warn('prerender: site.config.js still says example.com; the canonical and OG URLs will be wrong until you set your domain')
}

const vite = await createServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
})
const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
const { teams, fbsNow, allTimeBoard, todayEpochDay, windowStartOf } = await vite.ssrLoadModule('/src/lib/model.ts')
const { DEFAULT_CHIPS } = await vite.ssrLoadModule('/src/lib/definition.ts')
const { claim } = await vite.ssrLoadModule('/src/lib/sentence.ts')
const { mineCrowns } = await vite.ssrLoadModule('/src/lib/crowns.ts')
const { encodeCrowns, decodeCrowns } = await vite.ssrLoadModule('/src/lib/crownsFile.ts')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const template = fs.readFileSync(OUT, 'utf8')
// Throw rather than no-op: a Vite change that renames the marker would
// otherwise quietly ship an empty page again.
if (!template.includes('<div id="root"></div>')) {
  throw new Error('prerender: could not find an empty #root in dist/index.html')
}
if (!/<title>[^<]*<\/title>/.test(template)) {
  throw new Error('prerender: could not find <title> in dist/index.html')
}

/**
 * One page: the app rendered with `initial`, and a head whose title,
 * description, canonical and image are the page's own.
 */
function page({ initial, url, title, description, image, imageAlt, jsonLd, embed }) {
  const appHtml = renderToString(React.createElement(App, { initial }))
  const head = `
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(config.domain)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(imageAlt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${image}" />

    <!-- Cross-site chrome served by the index site: back bar, comments, analytics. -->
    <script src="${ORIGIN}/embed/back-bar.js" async></script>
    <script src="${ORIGIN}/embed/giscus.js" async></script>
    <script src="${ORIGIN}/embed/analytics.js" async></script>

    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace('</head>', head)
  // embedded data main.jsx reads before hydrating (a team page's crowns)
  const data = embed ? `<script type="application/json" id="crowns-data">${JSON.stringify(embed).replace(/</g, '\\u003c')}</script>` : ''
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>${data}`)
  return { html, appHtml }
}

const breadcrumb = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
})
const webPage = (url, name, description) => ({
  '@type': 'WebPage', '@id': url, url, name, description,
  isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain },
})

// --- the root page ---
const root = page({
  initial: {},
  url: SITE,
  title: config.title,
  description: config.description,
  image: `${SITE}og.png`,
  imageAlt: config.ogImageAlt,
  jsonLd: {
    '@context': 'https://schema.org',
    '@graph': [webPage(SITE, config.title, config.description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE]])],
  },
})
fs.writeFileSync(OUT, root.html)
const words = root.appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(`prerendered ${(root.appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words); head written for ${SITE}`)

// --- crowns: mined here, one file per team ---
const t0 = Date.now()
const [crownsActive, crownsAll] = await Promise.all([mineCrowns('active'), mineCrowns('all')])
const crownsOf = (ti) => encodeCrowns({ active: crownsActive.get(ti) ?? [], all: crownsAll.get(ti) ?? [] })
fs.mkdirSync(path.join(ROOT, 'dist', 'crowns'), { recursive: true })
let crownBytes = 0
for (const ti of fbsNow) {
  const json = JSON.stringify(crownsOf(ti))
  crownBytes += json.length
  fs.writeFileSync(path.join(ROOT, 'dist', 'crowns', `${teams[ti].id}.json`), json)
}
console.log(`mined crowns in ${Date.now() - t0}ms: ${fbsNow.size} files under dist/crowns/, ${(crownBytes / 1e6).toFixed(2)} MB`)

// --- one page per current FBS team, opened on its run of the default board ---
const todayEp = todayEpochDay()
const board = allTimeBoard(DEFAULT_CHIPS, 'W', todayEp)
const urls = [SITE]
let teamPages = 0
for (const ti of [...fbsNow].sort((a, b) => teams[a].name.localeCompare(teams[b].name))) {
  const t = teams[ti]
  const row = board.find((r) => r.ti === ti)
  const url = `${SITE}team/${t.id}/`
  const title = `${t.name} streaks · ${config.title}`
  const since = windowStartOf(ti)
  const tail = `Every winning and losing streak ${t.name} is king of, under any definition, since ${since}.`
  const description = row ? `${claim(row, DEFAULT_CHIPS, 'W')} ${tail}` : tail
  const hasImage = fs.existsSync(path.join(ROOT, 'public', 'og', 'team', `${t.id}.png`))
  const { html } = page({
    // rendered from the same decoded file the page embeds, so the hydrate matches
    initial: { team: ti, crowns: decodeCrowns(crownsOf(ti)) },
    embed: crownsOf(ti),
    url,
    title,
    description,
    image: hasImage ? `${SITE}og/team/${t.id}.png` : `${SITE}og.png`,
    imageAlt: hasImage ? `${t.name}'s longest streaks, on a dark leaderboard.` : config.ogImageAlt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], [t.name, url]])],
    },
  })
  const dir = path.join(ROOT, 'dist', 'team', t.id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  urls.push(url)
  teamPages++
}
console.log(`prerendered ${teamPages} team pages under dist/team/`)

// Sitemap: the root and every team page, with lastmod.
const lastmod = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(ROOT, 'dist/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`,
)
await vite.close()
