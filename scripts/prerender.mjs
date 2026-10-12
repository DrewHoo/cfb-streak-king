// Runs after `vite build`. Bakes the rendered app into dist/index.html, writes
// the <head> from site.config.js, and renders one page per current FBS team
// at dist/team/<id>/index.html, that team's page, with its own
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
const { P, teams, fbsNow, allTimeBoard, todayEpochDay, windowStartOf } = await vite.ssrLoadModule('/src/lib/model.ts')
const { DEFAULT_CHIPS } = await vite.ssrLoadModule('/src/lib/definition.ts')
const { claim } = await vite.ssrLoadModule('/src/lib/sentence.ts')
const { mineRaw, mineCrowns, mineBroken, encodeMined } = await vite.ssrLoadModule('/src/lib/crowns.ts')
const { encodeCrowns, decodeCrowns } = await vite.ssrLoadModule('/src/lib/crownsFile.ts')
const { completedWeeks, brokenClaim } = await vite.ssrLoadModule('/src/lib/broken.ts')
const { scheduledGames, rankText } = await vite.ssrLoadModule('/src/lib/team.ts')
const { buildDigests, encodeDigests, decodeDigests } = await vite.ssrLoadModule('/src/lib/digests.ts')
const { buildSeasons } = await vite.ssrLoadModule('/src/lib/seasons.ts')
const { encodeSeason, decodeSeason } = await vite.ssrLoadModule('/src/lib/seasonFile.ts')
const { buildStoppers, encodeStoppers, decodeStoppers, stoppersSlice, stopRanking, stopRows, stopCat, stopPoints, STOP_WORDS } = await vite.ssrLoadModule('/src/lib/stoppers.ts')
const { seasonWeeks, keyString, gamePath, isoDate, scoreOf } = await vite.ssrLoadModule('/src/lib/game.ts')
const { chipLabel } = await vite.ssrLoadModule('/src/lib/minedChips.ts')
const { dirWord, marginWords, siteWord, spreadText, monthDay } = await vite.ssrLoadModule('/src/lib/format.ts')
const { baseDir } = await vite.ssrLoadModule('/src/lib/outcome.ts')

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
function page({ initial, url, title, description, image, imageAlt, jsonLd, embed, digests, season, stoppers, shell = false }) {
  // the shell (dist/404.html) carries no markup: the app boots from an empty root on whatever address reached it
  const appHtml = shell ? '' : renderToString(React.createElement(App, { initial }))
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
  // embedded data main.jsx reads before hydrating (a team page's crowns, a games page's digests)
  const json = (id, v) => (v ? `<script type="application/json" id="${id}">${JSON.stringify(v).replace(/</g, '\\u003c')}</script>` : '')
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>${json('crowns-data', embed)}${json('digests-data', digests)}${json('season-data', season)}${json('stoppers-data', stoppers)}`)
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
const [crownsActive, crownsAll, minedBroken] = await Promise.all([mineCrowns('active'), mineCrowns('all'), mineBroken()])
const crownsOf = (ti) => encodeCrowns({ active: crownsActive.get(ti) ?? [], all: crownsAll.get(ti) ?? [] })
fs.mkdirSync(path.join(ROOT, 'dist', 'crowns'), { recursive: true })
let crownBytes = 0
for (const ti of fbsNow) {
  const json = JSON.stringify(crownsOf(ti))
  crownBytes += json.length
  fs.writeFileSync(path.join(ROOT, 'dist', 'crowns', `${teams[ti].id}.json`), json)
}
console.log(`mined crowns in ${Date.now() - t0}ms: ${fbsNow.size} files under dist/crowns/, ${(crownBytes / 1e6).toFixed(2)} MB`)

// --- the raw mine, for the tests: mineRaw() reads this file instead of
// mining when STREAK_MINED names it (CI sets it for the build and the tests
// alike, so the suite reuses this build's mine). Stamped, so a file from
// another payload is ignored ---
{
  const t1 = Date.now()
  const file = path.resolve(process.env.STREAK_MINED ?? path.join(ROOT, 'data/build/mined.json'))
  const json = JSON.stringify(encodeMined(await mineRaw()))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, json)
  console.log(`raw mine written to ${path.relative(ROOT, file)} in ${Date.now() - t1}ms: ${(json.length / 1e6).toFixed(0)} MB`)
}

// --- the schedule's digests: every completed week's broken streaks, the
// coming week's at-risk ones, the streak on the line in each game; one
// file, embedded in the games pages and fetched when the schedule opens ---
const digestsFile = encodeDigests(buildDigests(todayEpochDay(), minedBroken, (ti) => crownsActive.get(ti) ?? []))
// rendered from the decoded file, so the hydrate matches
const digests = decodeDigests(digestsFile)
fs.mkdirSync(path.join(ROOT, 'dist', 'games'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'dist', 'games', 'digests.json'), JSON.stringify(digestsFile))

// --- the season files: what each game ended (its leaders' runs) and who it
// made a leader, one file per season (seasons.ts); a games page or a game
// page embeds the slice it shows ---
const seasonRows = buildSeasons(minedBroken)
let seasonGames = 0
for (const [season, rows] of seasonRows) {
  fs.writeFileSync(path.join(ROOT, 'dist', 'games', `${season}.json`), JSON.stringify(encodeSeason(rows)))
  seasonGames += rows.games.size
}
console.log(`season files: ${seasonRows.size} seasons under dist/games/, ${seasonGames} games with rows`)
// the season's rows for just these games, as the file encodes them, and decoded for the render
const seasonSlice = (season, keys) => {
  const rows = seasonRows.get(season)
  const games = new Map()
  for (const k of keys) if (rows?.games.has(k)) games.set(k, rows.games.get(k))
  // a slice: a game the slice lacks may still have rows in the file, and the app fetches it then
  const file = encodeSeason({ season, builtAt: P.builtAt, games, complete: false })
  return { file, rows: decodeSeason(file) }
}
const currentWeeks = seasonWeeks(P.currentSeason)
const weekKeys = (wk) => (currentWeeks.find((w) => w.wk === wk)?.games ?? []).map((g) => keyString(g.key))
console.log(`digests: ${Object.keys(digests.broken).length} weeks of broken streaks, ${digests.atRisk ? `week ${digests.atRisk.wk} at risk (${digests.atRisk.list.length} rows)` : 'nothing at risk'}, ${Object.keys(digests.onLine).length} games with a streak on the line`)

// --- the schedule: every scheduled game, by week ---
{
  const url = `${SITE}games/`
  const title = `This week's games · ${config.title}`
  const description = `Every scheduled FBS game, with the line and the streak most on the line in it.`
  const first = currentWeeks.find((w) => w.games.some((g) => g.scheduled))?.wk ?? currentWeeks.at(-1)?.wk
  const slice = seasonSlice(P.currentSeason, weekKeys(first))
  const { html } = page({
    initial: { games: true, digests, seasonRows: slice.rows },
    digests: digestsFile,
    season: slice.file,
    url,
    title,
    description,
    image: `${SITE}og.png`,
    imageAlt: config.ogImageAlt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', url]])],
    },
  })
  fs.mkdirSync(path.join(ROOT, 'dist', 'games'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'dist', 'games', 'index.html'), html)
}

// --- one page per completed week: its broken streaks, with its own preview ---
// GitHub Pages ignores query strings, so a shareable week lives at its own
// path, /games/week/<n>/. Its image is the share worker's, drawn from the
// rows this build writes to dist/share/weekly.json (below), so a fresh week
// has a card the moment the site deploys.
const weekly = { builtAt: P.builtAt, broken: {}, atRisk: null }
// a broken run or an at-risk one as a card row: the count, the team, the claim, the small print
const wordsOf = (chips) => chips.map(chipLabel).join(' · ')
const PAST = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' }
const PRESENT = { W: 'has won', L: 'has lost', C: 'has covered', N: 'has missed' }
const enderWords = (b) => {
  const g = b.ender
  const opp = teams[g.oppIdx]?.name ?? '?'
  if (b.dir === 'C' || b.dir === 'N') return `${g.cover === 'P' ? 'pushed' : g.cover === 'W' ? 'covered' : 'didn’t cover'} vs ${opp}`
  if (g.r === 'T') return `tied ${opp} ${g.us}–${g.them}`
  return g.r === 'W' ? `beat ${opp} ${g.us}–${g.them}` : `lost to ${opp} ${g.them}–${g.us}`
}
// one page per week the schedule can open on: a completed week's broken
// runs and results, a scheduled week's at-risk streaks and games
const weekUrls = []
const weekNums = new Set(scheduledGames().map((g) => g.wk))
for (const w of completedWeeks()) if (w.wk != null) weekNums.add(w.wk)
for (const n of [...weekNums].sort((a, b) => a - b)) {
  const broken = digests.broken[n]
  if (broken) weekly.broken[n] = {
    wk: broken.wk, lo: broken.lo, hi: broken.hi, ofNote: broken.list.length,
    rows: broken.list.map((b) => ({
      count: `${b.len}${b.atEdge ? '+' : ''}`, team: teams[b.ti].id, bad: baseDir(b.dir) === 'L' || b.dir === 'N',
      claim: `${teams[b.ti].name} ${PAST[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${wordsOf(b.chips)}` : ''}`,
      sub: `was ${rankText(b)} of ${b.field} · since ${b.since} · ${enderWords(b)}`,
    })),
  }
  const url = `${SITE}games/week/${n}/`
  const title = `Week ${n} games · ${config.title}`
  const top = broken ? broken.list.slice(0, 3).map((b) => brokenClaim(b)) : []
  const description = top.length
    ? `${top.join('. ')}.${broken.list.length > top.length ? ` And ${broken.list.length - top.length} more runs that ended in Week ${n}.` : ''} Week ${n}'s results, and what each game ended.`
    : `Week ${n}'s college football games and the streaks they put at risk.`
  const slice = seasonSlice(P.currentSeason, weekKeys(n))
  const { html } = page({
    initial: { games: true, bwk: n, digests, seasonRows: slice.rows },
    digests: digestsFile,
    season: slice.file,
    url,
    title,
    description,
    image: broken ? `${SITE}share/og.png?broken=${n}` : `${SITE}og.png`,
    imageAlt: broken ? `The streaks broken in Week ${n}, on a dark leaderboard.` : `${config.title}: the default board.`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], [`Week ${n}`, url]])],
    },
  })
  const dir = path.join(ROOT, 'dist', 'games', 'week', String(n))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  weekUrls.push(url)
}
console.log(`prerendered ${weekUrls.length} week pages under dist/games/week/`)

// --- the week's at-risk streaks, at their own address, with their own preview ---
{
  const risk = digests.atRisk
  if (risk) {
    const { wk } = risk
    const url = `${SITE}games/at-risk/`
    const title = `Week ${wk} at-risk streaks · ${config.title}`
    const rows = risk.list.map((r) => ({
      count: `${r.s.len}${r.s.atEdge ? '+' : ''}`, team: teams[r.ti].id, bad: baseDir(r.s.dir) === 'L' || r.s.dir === 'N',
      claim: `${teams[r.ti].name} ${PRESENT[baseDir(r.s.dir)]} ${r.s.len}${r.s.atEdge ? '+' : ''} straight${marginWords(r.s.dir)}${r.s.chips.length ? ` ${wordsOf(r.s.chips)}` : ''}`,
      sub: `${Math.round(100 * r.p)}% to end · ${monthDay(r.row.ep)} ${siteWord(r.row)} ${teams[r.row.oppIdx]?.name ?? '?'} ${spreadText(r.row.sp)} · ${rankText(r.s)} of ${r.s.field}`,
    }))
    weekly.atRisk = { wk, lo: risk.lo, hi: risk.hi, rows }
    const top = rows.slice(0, 3).map((r) => `${r.claim}, ${r.sub.split(' · ')[0]}`)
    const description = `${top.join('. ')}. The streaks the week's games can take away, ranked by the odds.`
    const slice = seasonSlice(P.currentSeason, weekKeys(wk))
    const { html } = page({
      initial: { games: true, risk: true, digests, seasonRows: slice.rows },
      digests: digestsFile,
      season: slice.file,
      url,
      title,
      description,
      image: `${SITE}share/og.png?risk=${wk}`,
      imageAlt: `Week ${wk}'s streaks most at risk, on a dark leaderboard.`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], ['At risk', url]])],
      },
    })
    const dir = path.join(ROOT, 'dist', 'games', 'at-risk')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    weekUrls.push(url)
    console.log(`prerendered the at-risk page: week ${wk}, ${rows.length} rows`)
  }
}

// --- one page per game of the running season: what it ended and who it made
// a leader, or what it puts on the line; with its own head. Older games
// have no file: the share worker answers their addresses with the app
// shell (dist/404.html, below) and the game's head ---
const gameUrls = []
{
  const PAST_ENDED = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' }
  let n = 0
  for (const week of currentWeeks) {
    for (const item of week.games) {
      const key = item.key
      const ks = keyString(key)
      const slice = seasonSlice(P.currentSeason, [ks])
      const rows = slice.rows.games.get(ks) ?? { ended: [], leaders: [] }
      const away = teams[key.away].name, home = teams[key.home].name
      const at = key.neutral ? 'vs' : 'at'
      const url = `${SITE}${gamePath(key)}`
      let title, description
      if (item.played) {
        const [hs, as] = scoreOf(item.played)
        const winner = hs > as ? `${home} ${hs}, ${away} ${as}` : as > hs ? `${away} ${as}, ${home} ${hs}` : `${away} ${as}, ${home} ${hs} (tie)`
        title = `${winner} · ${config.title}`
        const top = rows.ended.slice(0, 3).map((b) => `${teams[b.ti].name} ${PAST_ENDED[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${wordsOf(b.chips)}` : ''}`)
        const leaders = rows.leaders.slice(0, 2).map((l) => `${teams[l.ti].name} now leads: ${l.len} straight${marginWords(l.dir)}${l.chips.length ? ` ${wordsOf(l.chips)}` : ''}`)
        description = [...top, ...leaders].length
          ? `${[...top, ...leaders].join('. ')}. Every streak this game ended, and every field it handed a new leader.`
          : `${away} ${at} ${home}, ${isoDate(key.ep)}: no streak that led its field ended here.`
      } else {
        const g = item.scheduled
        title = `${away} ${at} ${home}, ${monthDay(key.ep)} · ${config.title}`
        const top = digests.onLine[g.i]
        description = top
          ? `${teams[top.ti].name} ${PRESENT[baseDir(top.s.dir)]} ${top.s.len}${top.s.atEdge ? '+' : ''} straight${marginWords(top.s.dir)}${top.s.chips.length ? ` ${wordsOf(top.s.chips)}` : ''}. Every streak on the line when ${away} play${key.neutral ? '' : ' at'} ${home}.`
          : `Every streak on the line when ${away} play ${at} ${home}, ${monthDay(key.ep)}.`
      }
      const { html } = page({
        initial: { game: key, seasonRows: slice.rows },
        season: slice.file,
        url,
        title,
        description,
        image: `${SITE}share/og.png?game=${encodeURIComponent(ks)}`,
        imageAlt: `${away} ${at} ${home}: the streaks it ended, on a dark leaderboard.`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], [`${away} ${at} ${home}`, url]])],
        },
      })
      const dir = path.join(ROOT, 'dist', gamePath(key))
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'index.html'), html)
      gameUrls.push(url)
      n++
    }
  }
  console.log(`prerendered ${n} game pages under dist/game/`)
}

// --- the app shell for an address with no file (an older game's page, a
// past season's schedule): GitHub Pages serves 404.html for it and the app
// boots on the address; the share worker turns that into a 200 with the
// page's own head ---
{
  const { html } = page({
    shell: true,
    initial: {},
    url: SITE,
    title: config.title,
    description: config.description,
    image: `${SITE}og.png`,
    imageAlt: config.ogImageAlt,
    jsonLd: { '@context': 'https://schema.org', '@graph': [webPage(SITE, config.title, config.description)] },
  })
  fs.writeFileSync(path.join(ROOT, 'dist', '404.html'), html)
}

// --- share metadata for the Cloudflare worker (workers/share): the words a
// definition URL needs that the chip catalog alone can't supply ---
{
  const meta = {
    site: config.title,
    teams: Object.fromEntries(teams.filter((t) => t.major).map((t) => [t.id, t.name])),
    mascots: P.mascots ?? [],
    colors: P.colors ?? [],
  }
  fs.mkdirSync(path.join(ROOT, 'dist', 'share'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'dist', 'share', 'meta.json'), JSON.stringify(meta))
  // the cards' rows (broken, at-risk, the stoppers) go to dist/share/weekly.json once the stoppers' are in (below)
  // the worker's og.png route runs the site's own model; publish the payload it reads
  fs.copyFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), path.join(ROOT, 'dist', 'share', 'payload.json'))
  console.log(`share meta: ${Object.keys(meta.teams).length} teams, ${meta.mascots.length} mascot kinds; payload copied for the og worker`)
}

// --- the streak-stoppers: the running season's breaks by the team that made them, one file and one page ---
const stoppers = buildStoppers(minedBroken)
const stoppersFile = encodeStoppers(stoppers)
const stopperUrls = []
fs.mkdirSync(path.join(ROOT, 'dist', 'stoppers'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'dist', 'stoppers', `${P.currentSeason}.json`), JSON.stringify(stoppersFile))
{
  const ranking = stopRanking(stoppers)
  const url = `${SITE}stoppers/`
  const title = `Top Streak-Stoppers ${P.currentSeason} · ${config.title}`
  const top = ranking.slice(0, 3).map((s, i) => `${i + 1}. ${teams[s.ti].name} (${s.n})`).join(', ')
  const description = ranking.length
    ? `The college football teams that broke the most streaks in ${P.currentSeason}: ${top}. Every streak a team ended by beating its owner, weighed by what the run was.`
    : `The college football teams that break the most streaks: every streak a team ended by beating its owner, weighed by what the run was.`
  const { html } = page({
    initial: { stoppers: true, stops: decodeStoppers(stoppersFile) },
    stoppers: stoppersFile,
    url, title, description,
    image: `${SITE}share/og.png?stoppers=${P.currentSeason}`, imageAlt: `The ${P.currentSeason} streak-stoppers, on a dark leaderboard.`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Streak-stoppers', url]])] },
  })
  fs.writeFileSync(path.join(ROOT, 'dist', 'stoppers', 'index.html'), html)
  // the cards' rows: the leaderboard's top, and each stopper's own top breaks (the worker's og.png?stoppers= and ?stopper=)
  const stopWords = (b) => `${STOP_WORDS[stopCat(b)]} · was ${rankText(b)} of ${b.field} · ${enderWords(b)}`
  weekly.stoppers = {
    season: P.currentSeason,
    rows: ranking.slice(0, 7).map((s, i) => ({
      count: String(s.n), team: teams[s.ti].id, bad: false,
      claim: `${i + 1}. ${teams[s.ti].name} · ${(Math.round(s.points * 10) / 10).toFixed(1)} points`,
      sub: `${s.by.alltime} all-time · ${s.by.leading} led the field · ${s.by.active} other${s.best ? ` · best: ${brokenClaim(s.best)}` : ''}`,
    })),
  }
  weekly.stopper = {}
  // one page per stopper: its stopped streaks, at /stoppers/<id>/, with its own card
  for (const s of ranking) {
    const t = teams[s.ti]
    const rows = stopRows(stoppers.teams.get(s.ti) ?? []).filter((b) => !b.dup)
    weekly.stopper[t.id] = {
      season: P.currentSeason, name: t.name, n: s.n, points: Math.round(s.points * 10) / 10, rank: stoppers.ranks.get(s.ti) ?? 0,
      rows: rows.slice(0, 7).map((b) => ({ count: `${b.len}${b.atEdge ? '+' : ''}`, team: teams[b.ti].id, bad: false, claim: brokenClaim(b), sub: stopWords(b) })),
    }
    const url = `${SITE}stoppers/${t.id}/`
    const title = `Streaks ${t.name} stopped in ${P.currentSeason} · ${config.title}`
    const top = rows.slice(0, 3).map((b) => brokenClaim(b))
    const description = `${t.name} ended ${s.n} streak${s.n === 1 ? '' : 's'} by winning this season, #${stoppers.ranks.get(s.ti)} among streak-stoppers: ${top.join('. ')}.`
    // rendered from the decoded file the page embeds (rounded scores and odds), so the hydrate matches
    const sliceFile = encodeStoppers(stoppersSlice(stoppers, s.ti))
    const { html } = page({
      initial: { stoppers: true, stopper: s.ti, stops: decodeStoppers(sliceFile) },
      stoppers: sliceFile,
      url, title, description,
      image: `${SITE}share/og.png?stopper=${t.id}`, imageAlt: `The streaks ${t.name} stopped in ${P.currentSeason}, on a dark leaderboard.`,
      jsonLd: { '@context': 'https://schema.org', '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Streak-stoppers', `${SITE}stoppers/`], [t.name, url]])] },
    })
    const dir = path.join(ROOT, 'dist', 'stoppers', t.id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    stopperUrls.push(url)
  }
  fs.writeFileSync(path.join(ROOT, 'dist', 'share', 'weekly.json'), JSON.stringify(weekly))
  console.log(`stoppers: ${ranking.length} teams broke a streak in ${P.currentSeason}, ${ranking.reduce((a, s) => a + s.n, 0)} breaks; the page, ${stopperUrls.length} team pages and the file under dist/stoppers/`)
}

// --- one page per current FBS team ---
const todayEp = todayEpochDay()
const board = allTimeBoard(DEFAULT_CHIPS, 'W', todayEp)
const urls = [SITE, `${SITE}games/`, `${SITE}stoppers/`, ...stopperUrls, ...weekUrls, ...gameUrls]
let teamPages = 0
for (const ti of [...fbsNow].sort((a, b) => teams[a].name.localeCompare(teams[b].name))) {
  const t = teams[ti]
  const row = board.find((r) => r.ti === ti)
  const url = `${SITE}team/${t.id}/`
  const title = `${t.name} streaks · ${config.title}`
  const since = windowStartOf(ti)
  const tail = `${t.name}'s record, next game, and every streak it's on or king of, under any definition, since ${since}.`
  const description = row ? `${claim(row, DEFAULT_CHIPS, 'W')} ${tail}` : tail
  const hasImage = fs.existsSync(path.join(ROOT, 'public', 'og', 'team', `${t.id}.png`))
  const { html } = page({
    // rendered from the same decoded file the page embeds, so the hydrate matches
    initial: { page: ti, crowns: decodeCrowns(crownsOf(ti)), stops: decodeStoppers(encodeStoppers(stoppersSlice(stoppers, ti))) },
    embed: crownsOf(ti),
    stoppers: encodeStoppers(stoppersSlice(stoppers, ti)),
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
