import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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

export default defineConfig({
  base: `/${pkg.name}/`,
  plugins: [trimRulings, react()],
  // a preview tool that hands out ports sets PORT; hold to it so the preview
  // opens where the server is. Plain `npm run dev` keeps 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
  // the suite walks the real 63k-game payload; CI runners are a few times
  // slower than a laptop, so the 5s default is too tight
  // the worktrees under .claude/ carry their own copies of the suite
  test: { testTimeout: 30000, exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'] },
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
