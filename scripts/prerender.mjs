// Runs after `vite build`. Bakes the rendered app into dist/index.html and
// writes the <head> from site.config.js.
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
const appHtml = renderToString(React.createElement(App))
await vite.close()

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Add page-specific structured data here (an ItemList of the rows, a Dataset,
// a TheaterEvent) generated from the same data the page renders, so it can't
// drift from what is on screen.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': SITE,
      url: SITE,
      name: config.title,
      description: config.description,
      isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: config.domain, item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: config.title, item: SITE },
      ],
    },
  ],
}

const head = `
    <meta name="description" content="${esc(config.description)}" />
    <link rel="canonical" href="${SITE}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(config.domain)}" />
    <meta property="og:title" content="${esc(config.title)}" />
    <meta property="og:description" content="${esc(config.description)}" />
    <meta property="og:url" content="${SITE}" />
    <meta property="og:image" content="${SITE}og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(config.ogImageAlt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(config.title)}" />
    <meta name="twitter:description" content="${esc(config.description)}" />
    <meta name="twitter:image" content="${SITE}og.png" />

    <!-- Cross-site chrome served by the index site: back bar, comments, analytics. -->
    <script src="${ORIGIN}/embed/back-bar.js" async></script>
    <script src="${ORIGIN}/embed/giscus.js" async></script>
    <script src="${ORIGIN}/embed/analytics.js" async></script>

    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`

let html = fs.readFileSync(OUT, 'utf8')

// Throw rather than no-op: a Vite change that renames the marker would
// otherwise quietly ship an empty page again.
if (!html.includes('<div id="root"></div>')) {
  throw new Error('prerender: could not find an empty #root in dist/index.html')
}
if (!/<title>[^<]*<\/title>/.test(html)) {
  throw new Error('prerender: could not find <title> in dist/index.html')
}
html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(config.title)}</title>`)
html = html.replace('</head>', head)
html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
fs.writeFileSync(OUT, html)

// Single-page sitemap: what Search Console wants submitted, and it carries lastmod.
const lastmod = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(ROOT, 'dist/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
</urlset>
`,
)

const words = appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(`prerendered ${(appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words); head written for ${SITE}`)
