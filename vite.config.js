import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages serves this repo at https://<domain>/<repo-name>/, so every
// asset URL has to start with the repo name. Skipping this ships a blank page
// with a 404 for every JS and CSS file. package.json "name" is the repo name.
// unplayed.ts imports the ruling file itself, so it ships to the browser. The
// UI reads one receipt per row (its url and quote go in the link) and never
// the notes, retrieval dates or further receipts, so the bundle carries only
// that; the full receipts stay in data/ref for the checker and the reader
// who opens the repo. Runs before Vite's own JSON plugin, which then parses
// the trimmed text as usual.
const trimRulings = {
  name: 'trim-rulings',
  enforce: 'pre',
  transform(code, id) {
    if (!/data[\\/]ref[\\/]unplayed-postseasons\.json$/.test(id)) return null
    const d = JSON.parse(code)
    const rows = d.rows.map(({ team, season, kind, summary, confidence, receipts }) => ({
      team, season, kind, summary, confidence, receipts: [{ url: receipts[0].url, quote: receipts[0].quote }],
    }))
    return { code: JSON.stringify({ version: d.version, updated: d.updated, rows }), map: null }
  },
}

// The dev server has no build output, so a team page would mine every
// crown in the page (minutes) and a game page would show nothing. When a
// build has run, serve its crowns, digests and season files from dist/
// instead; the page falls back to mining only when they are missing.
const serveBuilt = {
  name: 'serve-built-data',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0]
      // the build's data files, and the static pages only the prerender writes
      // (the posts, their index and feed, the data page): without them the dev
      // server's SPA fallback would show the board at /blog/
      const m = new RegExp(`^/${pkg.name}/(crowns/[\\w.-]+\\.json|games/(?:digests|\\d{4})\\.json|breakers/\\d{4}\\.json|blog/feed\\.xml|assets/[\\w.-]+\\.(?:css|js|png|woff2?)|(?:blog(?:/[\\w-]+)?|data)/)$`).exec(url)
      if (!m) return next()
      const file = path.join(server.config.root, 'dist', m[1].endsWith('/') ? `${m[1]}index.html` : m[1])
      if (!fs.existsSync(file)) return next()
      const type = { json: 'application/json', xml: 'application/rss+xml', css: 'text/css', js: 'text/javascript', png: 'image/png', woff: 'font/woff', woff2: 'font/woff2' }[file.split('.').pop()] ?? 'text/html; charset=utf-8'
      res.setHeader('Content-Type', type)
      fs.createReadStream(file).pipe(res)
    })
  },
}

export default defineConfig({
  base: `/${pkg.name}/`,
  plugins: [trimRulings, serveBuilt, react()],
  // a preview tool that hands out ports sets PORT; hold to it so the preview
  // opens where the server is. Plain `npm run dev` keeps 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
  // the suite walks the real 63k-game payload; CI runners are a few times
  // slower than a laptop, so the 5s default is too tight
  // the worktrees under .claude/ carry their own copies of the suite. The
  // files that mine share one worker and one module cache, so the four-minute
  // mine runs once per suite, not once per file.
  test: { testTimeout: 30000, exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'], fileParallelism: false, isolate: false },
  // the data in its own chunk: a code-only deploy leaves the cached payload
  // alone, and the payload refresh leaves the cached code alone
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: { groups: [{ name: 'payload', test: /src[\\/]data[\\/]payload\.json/ }] },
      },
    },
  },
})
