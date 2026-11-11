// Every rivalry on Wikipedia's "List of NCAA college football rivalry games"
// (data/raw/rivalries-wikitext.json) that has a series page, against the
// page's first season and its count of games through the list's last year.
//   node specs/research/series-first-meetings/check-wikipedia-list.mjs /tmp/out.json
// Reads data/raw (symlink it in a worktree). Wrote wikipedia-list-check.txt on 2026-11-10.
import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; import fs from 'node:fs'
const { createServer } = await import(pathToFileURL(createRequire(process.cwd() + '/x.js').resolve('vite')).href)
const { canon } = await import(pathToFileURL(process.cwd() + '/scripts/lib/names.mjs').href)
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { teams } = await vite.ssrLoadModule('/src/lib/model.ts')
const { seriesOf, hasSeries } = await vite.ssrLoadModule('/src/lib/series.ts')
const w = JSON.parse(fs.readFileSync(new URL('../../../data/raw/rivalries-wikitext.json', import.meta.url), 'utf8')).parse.wikitext['*']
const id = (x) => teams.findIndex((t) => t.id === x)
const out = []
for (const row of w.match(/\{\{Trophy game\|[\s\S]*?\}\}/g)) {
  const links = [...row.matchAll(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g)].map((m) => m[2] ?? m[1])
  const nums = row.slice(row.lastIndexOf(']]')).match(/\|\s*(\d{4})\s*\|\s*(\d{4}|present)?\s*\|\s*(\d+)/)
  if (links.length < 3 || !nums) continue
  const a = canon(links.at(-2), 'rivalry'), b = canon(links.at(-1), 'rivalry')
  if (!a || !b || id(a) < 0 || id(b) < 0) continue
  const s = seriesOf(id(a), id(b)); if (!s) continue
  const first = +nums[1], last = nums[2] === 'present' ? 2025 : +nums[2], n = +nums[3]
  const ours = s.games.filter((g) => g.se <= last)
  out.push({ name: links[0], a, b, wFirst: first, oFirst: s.since, wN: n, oN: ours.length, last })
}
const bad = out.filter((r) => r.wFirst !== r.oFirst || r.wN !== r.oN)
console.log(out.length, 'rivalries with a series page;', bad.length, 'disagree;', out.filter((r) => r.wFirst !== r.oFirst).length, 'on the first year')
for (const r of bad) console.log(`${r.name.padEnd(40)} first wiki ${r.wFirst} ours ${r.oFirst} | games thru ${r.last} wiki ${r.wN} ours ${r.oN}`)
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
await vite.close()
