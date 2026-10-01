// Builds the crown score tuner: a standalone page that re-scores a sample of
// teams' crowns with adjustable weights, cutoffs and collapsing rules, to
// settle how a team's crowns should be ranked and which to show. Writes
// data/build/crown-tuner.html from tuner.html plus the current payload's
// crowns, so re-run it after a data refresh or a change to the chips or the
// miner. The page's defaults are RANK in src/lib/crownRank.ts, which the
// site uses; settle new values here, then copy them there. Not part of the
// site build.
//
//   node scripts/tuner/build-tuner.mjs [team names...]
import { createServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEAMS = process.argv.length > 2 ? process.argv.slice(2) : [
  'Alabama', 'Georgia', 'Ohio State', 'Michigan', 'Texas', 'Notre Dame', 'USC', 'LSU', 'Oklahoma', 'Penn State',
  'Tennessee', 'Auburn', 'Florida', 'Clemson', 'Oregon', 'Nebraska', 'Florida State', 'Miami (FL)', 'Vanderbilt', 'Kansas',
]

const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const { PLAIN_CHIPS, conflicts } = await vite.ssrLoadModule('/src/lib/chips.ts')
const { mineRawCrowns } = await vite.ssrLoadModule('/src/lib/crowns.ts')
const { RANK, IN_GAME_GROUPS } = await vite.ssrLoadModule('/src/lib/crownRank.ts')
const { model } = await vite.ssrLoadModule('/src/lib/model.ts')
const { crownClaim } = await vite.ssrLoadModule('/src/lib/sentence.ts')

// how many definitions have each chip count, as the miner walks them
const M = [0, 0, 0, 0, 0]
;(function rec(start, chosen) {
  M[chosen.length]++
  if (chosen.length === 4) return
  for (let i = start; i < PLAIN_CHIPS.length; i++) {
    if (chosen.some((j) => conflicts(PLAIN_CHIPS[j], PLAIN_CHIPS[i]))) continue
    rec(i + 1, [...chosen, i])
  }
})(0, [])

const chipIdx = new Map(PLAIN_CHIPS.map((c, i) => [c.key, i]))

const t0 = Date.now()
// every crown, before crownRank.ts filters them: the page re-runs that ranking
const [act, all] = await Promise.all([mineRawCrowns('active'), mineRawCrowns('all')])
const teams = TEAMS.map((name) => {
  const ti = model.teams.findIndex((t) => t.name === name)
  if (ti < 0) throw new Error(`no team named ${name}`)
  // [claim, dir, len, chip indices, first season, last season, rate, games]
  const rows = (list) => list.map((c) => (
    [crownClaim(ti, c), c.dir, c.len, c.chips.map((k) => chipIdx.get(k)), c.startSe ?? 0, c.endSe ?? 0, +c.p.toFixed(4), c.n]
  ))
  return { name, active: rows(act.get(ti) ?? []), all: rows(all.get(ti) ?? []) }
})
await vite.close()

const data = {
  rank: RANK,
  M,
  nFbs: model.fbsNow.size,
  chips: PLAIN_CHIPS.map((c) => ({ k: c.key, post: IN_GAME_GROUPS.has(c.group) })),
  teams,
  builtAt: model.P.builtAt,
}
const template = fs.readFileSync(path.join(ROOT, 'scripts/tuner/tuner.html'), 'utf8')
if (!template.includes('/*DATA*/')) throw new Error('tuner.html lost its /*DATA*/ marker')
const out = path.join(ROOT, 'data/build/crown-tuner.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, template.replace('/*DATA*/', () => JSON.stringify(data).replace(/</g, '\\u003c')))
const crowns = teams.reduce((a, t) => a + t.active.length + t.all.length, 0)
console.log(`tuner: ${teams.length} teams, ${crowns} crowns in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`)
