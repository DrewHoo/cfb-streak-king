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
import { readPosts, longDate, rfc822 } from './lib/posts.mjs'

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
const { completedWeeks, brokenClaim, everText, brokenDigest, listBroken } = await vite.ssrLoadModule('/src/lib/broken.ts')
const { listCrowns } = await vite.ssrLoadModule('/src/lib/list.ts')
const { atRiskWeek } = await vite.ssrLoadModule('/src/lib/atRisk.ts')
const { listLeaders } = await vite.ssrLoadModule('/src/lib/seasonFile.ts')
const { scheduledGames, rankText } = await vite.ssrLoadModule('/src/lib/team.ts')
const { buildDigests, encodeDigests, decodeDigests } = await vite.ssrLoadModule('/src/lib/digests.ts')
const { buildSeasons } = await vite.ssrLoadModule('/src/lib/seasons.ts')
const { encodeSeason, decodeSeason } = await vite.ssrLoadModule('/src/lib/seasonFile.ts')
const { breakersFromSeason, encodeBreakers, decodeBreakers, breakersSlice, breakRanking, breakRows, listBreaks } = await vite.ssrLoadModule('/src/lib/breakers.ts')
const { seasonWeeks, keyString, gamePath, isoDate, scoreOf } = await vite.ssrLoadModule('/src/lib/game.ts')
const { chipLabel } = await vite.ssrLoadModule('/src/lib/minedChips.ts')
const { dirWord, marginWords, siteWord, spreadText, monthDay } = await vite.ssrLoadModule('/src/lib/format.ts')
const { baseDir } = await vite.ssrLoadModule('/src/lib/outcome.ts')
const { LANDINGS } = await vite.ssrLoadModule('/src/lib/landing.ts')
const { landingView } = await vite.ssrLoadModule('/src/lib/url.ts')
const { activeBoard } = await vite.ssrLoadModule('/src/lib/model.ts')
const { seasons } = await vite.ssrLoadModule('/src/lib/game.ts')
const { brokenFromRows } = await vite.ssrLoadModule('/src/components/GamesPage.jsx')
const { longDate: longIso } = await vite.ssrLoadModule('/src/lib/shareWords.ts')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const FEED = `${SITE}blog/feed.xml`
const SEASON = P.currentSeason
/** "Oct 18, 2026" from an epoch day. */
const dateOf = (ep) => longIso(isoDate(ep))

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
 * description, canonical and image are the page's own. With `body`, a
 * static page instead (a post): that markup in the root, the site's styles,
 * and no app script, so nothing hydrates over it.
 */
function page({ initial, body, url, title, description, image, imageAlt, jsonLd, embed, digests, season, breakers, shell = false, ogType = 'website' }) {
  // the shell (dist/404.html) carries no markup: the app boots from an empty root on whatever address reached it
  const appHtml = body ?? (shell ? '' : renderToString(React.createElement(App, { initial })))
  const head = `
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" type="application/rss+xml" title="${esc(config.title)}: weekly posts" href="${FEED}" />

    <meta property="og:type" content="${ogType}" />
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
  // a static page keeps the styles and drops the app: main.jsx would otherwise hydrate the board over it
  if (body != null) {
    const before = html
    html = html.replace(/<script type="module"[^>]*><\/script>\s*/, '')
    if (html === before) throw new Error('prerender: could not find the app script tag to drop from a static page')
  }
  // embedded data main.jsx reads before hydrating (a team page's crowns, a games page's digests)
  const json = (id, v) => (v ? `<script type="application/json" id="${id}">${JSON.stringify(v).replace(/</g, '\\u003c')}</script>` : '')
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>${json('crowns-data', embed)}${json('digests-data', digests)}${json('season-data', season)}${json('breakers-data', breakers)}`)
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
/** A ranked list for a leaderboard page: [name, url?][] in order. */
const itemList = (name, items) => ({
  '@type': 'ItemList', name, itemListOrder: 'https://schema.org/ItemListOrderAscending', numberOfItems: items.length,
  itemListElement: items.map(([item, url], i) => ({ '@type': 'ListItem', position: i + 1, name: item, ...(url ? { url } : {}) })),
})
const sportsTeam = (t) => ({ '@type': 'SportsTeam', name: t.name, sport: 'American Football', url: `${SITE}team/${t.id}/` })
/** A game as an event: its teams, its date, and the score once played. */
const sportsEvent = (key, url, played) => {
  const home = teams[key.home], away = teams[key.away]
  const ev = {
    '@type': 'SportsEvent', name: `${away.name} ${key.neutral ? 'vs' : 'at'} ${home.name}`, url, sport: 'American Football',
    startDate: isoDate(key.ep), homeTeam: sportsTeam(home), awayTeam: sportsTeam(away), competitor: [sportsTeam(home), sportsTeam(away)],
    eventStatus: 'https://schema.org/EventScheduled',
  }
  if (played) {
    const [hs, as] = scoreOf(played)
    ev.description = `Final: ${home.name} ${hs}, ${away.name} ${as}.`
  }
  return ev
}

// --- the root page: the default board (its top ten as a list) ---
const todayEp = todayEpochDay()
const root = page({
  initial: {},
  url: SITE,
  title: config.title,
  description: config.description,
  image: `${SITE}og.png`,
  imageAlt: config.ogImageAlt,
  jsonLd: {
    '@context': 'https://schema.org',
    '@graph': [
      webPage(SITE, config.title, config.description),
      breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE]]),
      itemList('Longest all-time win streaks vs unranked opponents', allTimeBoard(DEFAULT_CHIPS, 'W', todayEp).slice(0, 10).map((r) => [`${teams[r.ti].name}: ${r.s.len} straight`, `${SITE}team/${teams[r.ti].id}/`])),
    ],
  },
})
fs.writeFileSync(OUT, root.html)
const words = root.appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(`prerendered ${(root.appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words); head written for ${SITE}`)

// --- crowns: mined here, one file per team ---
const t0 = Date.now()
const [crownsActive, crownsAll, minedBroken] = await Promise.all([mineCrowns('active'), mineCrowns('all'), mineBroken()])
// two files per team: the active runs (a team page embeds them, a game page fetches each side's) and the all-time ones (the Streaks switch fetches them)
const allOf = (ti) => encodeCrowns('all', crownsAll.get(ti) ?? [])
// what a team page embeds: the active list only; the all-time list is fetched when the switch asks for it
const activeOf = (ti) => encodeCrowns('active', crownsActive.get(ti) ?? [])
fs.mkdirSync(path.join(ROOT, 'dist', 'crowns'), { recursive: true })
let crownBytes = 0
for (const ti of fbsNow) {
  const json = JSON.stringify(activeOf(ti))
  const jsonAll = JSON.stringify(allOf(ti))
  crownBytes += jsonAll.length
  fs.writeFileSync(path.join(ROOT, 'dist', 'crowns', `${teams[ti].id}.all.json`), jsonAll)
  crownBytes += json.length
  fs.writeFileSync(path.join(ROOT, 'dist', 'crowns', `${teams[ti].id}.json`), json)
}
console.log(`mined crowns in ${Date.now() - t0}ms: ${fbsNow.size} teams, two files each under dist/crowns/, ${(crownBytes / 1e6).toFixed(2)} MB`)

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
// the list rule's rows per team, for the build's pick of the streak most on the line in each game
const listedCache = new Map()
const listedActive = (ti) => listedCache.get(ti) ?? listedCache.set(ti, listCrowns(crownsActive.get(ti) ?? [])).get(ti)
const digestsFile = encodeDigests(buildDigests(todayEpochDay(), minedBroken, (ti) => crownsActive.get(ti) ?? [], listedActive))
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
console.log(`digests: ${Object.keys(digests.broken).length} weeks of broken streaks, ${digests.atRisk ? `week ${digests.atRisk.wk} at risk (${digests.atRisk.rows.length} rows)` : 'nothing at risk'}, ${Object.keys(digests.onLine).length} games with a streak on the line`)

// --- the schedule: every scheduled game, by week ---
{
  const url = `${SITE}games/`
  const title = `This week's college football games and the streaks at stake · ${config.title}`
  const description = `Every scheduled FBS game this week, with the line and the streak most on the line in it; every past week's results and the streaks they broke.`
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
// a broken run's small print, as BrokenRow.jsx words it: what it was, since when, the game that ended it
const brokenSub = (b) => `${everText(b) ?? (b.tied > 1 ? 'was tied for the longest active streak' : 'was the longest active streak')} · since ${b.since} · ${enderWords(b)}`
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
  // the week's digest under the shipped knobs, as the page shows it
  const broken = digests.broken[n] ? brokenDigest(digests.broken[n]) : null
  if (broken) weekly.broken[n] = {
    wk: broken.wk, lo: broken.lo, hi: broken.hi, ofNote: broken.list.length, total: broken.list.length + broken.more.length,
    rows: broken.list.map((b) => ({
      count: `${b.len}${b.atEdge ? '+' : ''}`, team: teams[b.ti].id, bad: baseDir(b.dir) === 'L' || b.dir === 'N',
      claim: `${teams[b.ti].name} ${PAST[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${wordsOf(b.chips)}` : ''}`,
      sub: brokenSub(b),
    })),
  }
  const url = `${SITE}games/week/${n}/`
  const title = broken
    ? `Streaks broken in Week ${n} of the ${SEASON} college football season · ${config.title}`
    : `Week ${n} ${SEASON} college football games and the streaks at stake · ${config.title}`
  const top = broken ? broken.list.slice(0, 3).map((b) => brokenClaim(b)) : []
  const total = broken ? broken.list.length + broken.more.length : 0
  const description = top.length
    ? `${top.join('. ')}.${total > top.length ? ` ${total - top.length} more streaks ended in Week ${n}.` : ''} Every Week ${n} result, and what each game broke.`
    : `Every Week ${n} college football game of ${SEASON}, with the line and the streaks each puts at risk.`
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
      '@graph': [
        webPage(url, title, description),
        breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], [`Week ${n}`, url]]),
        ...(broken ? [itemList(`Streaks broken in Week ${n}, ${SEASON}`, broken.list.slice(0, 10).map((b) => [brokenClaim(b), `${SITE}team/${teams[b.ti].id}/`]))] : []),
      ],
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
  const risk = digests.atRisk ? { ...digests.atRisk, ...atRiskWeek(digests.atRisk) } : null
  if (risk) {
    const { wk } = risk
    const url = `${SITE}games/at-risk/`
    const title = `College football streaks at stake in Week ${wk} (${SEASON}) · ${config.title}`
    const rows = risk.list.map((r) => ({
      count: `${r.s.len}${r.s.atEdge ? '+' : ''}`, team: teams[r.ti].id, bad: baseDir(r.s.dir) === 'L' || r.s.dir === 'N',
      claim: `${teams[r.ti].name} ${PRESENT[baseDir(r.s.dir)]} ${r.s.len}${r.s.atEdge ? '+' : ''} straight${marginWords(r.s.dir)}${r.s.chips.length ? ` ${wordsOf(r.s.chips)}` : ''}`,
      sub: `${Math.round(100 * r.p)}% to end · ${monthDay(r.row.ep)} ${siteWord(r.row)} ${teams[r.row.oppIdx]?.name ?? '?'} ${spreadText(r.row.sp)}`,
    }))
    weekly.atRisk = { wk, lo: risk.lo, hi: risk.hi, rows, total: risk.list.length + risk.more.length }
    const top = rows.slice(0, 3).map((r) => `${r.claim}, ${r.sub.split(' · ')[0]}`)
    const description = `${top.join('. ')}. Every longest active streak Week ${wk}'s college football games can end, ranked by the odds from the line.`
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
        '@graph': [
          webPage(url, title, description),
          breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], ['At risk', url]]),
          itemList(`Streaks at stake in Week ${wk}, ${SEASON}`, rows.slice(0, 10).map((r) => [r.claim, `${SITE}team/${r.team}/`])),
        ],
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
      const raw = slice.rows.games.get(ks) ?? { ended: [], leaders: [] }
      // the game's rows as the page lists them (the list rule, shipped knobs)
      const rows = { ended: listBroken(raw.ended), leaders: listLeaders(raw.leaders) }
      const away = teams[key.away].name, home = teams[key.home].name
      const at = key.neutral ? 'vs' : 'at'
      const url = `${SITE}${gamePath(key)}`
      let title, description
      const when = dateOf(key.ep)
      if (item.played) {
        const [hs, as] = scoreOf(item.played)
        const winner = hs > as ? `${home} ${hs}, ${away} ${as}` : as > hs ? `${away} ${as}, ${home} ${hs}` : `${away} ${as}, ${home} ${hs} (tie)`
        title = `${winner} (${when}) · ${config.title}`
        const top = rows.ended.slice(0, 3).map((b) => `${teams[b.ti].name} ${PAST_ENDED[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${wordsOf(b.chips)}` : ''}`)
        const leaders = rows.leaders.slice(0, 2).map((l) => `${teams[l.ti].name} now leads: ${l.len} straight${marginWords(l.dir)}${l.chips.length ? ` ${wordsOf(l.chips)}` : ''}`)
        description = [...top, ...leaders].length
          ? `${[...top, ...leaders].join('. ')}. Every streak this college football game ended, and every field it handed a new leader.`
          : `${away} ${at} ${home}, ${when}: no streak that led its field ended in this college football game.`
      } else {
        const g = item.scheduled
        title = `${away} ${at} ${home}, ${when}: streaks on the line · ${config.title}`
        const top = digests.onLine[g.i]
        description = top
          ? `${teams[top.ti].name} ${PRESENT[baseDir(top.s.dir)]} ${top.s.len}${top.s.atEdge ? '+' : ''} straight${marginWords(top.s.dir)}${top.s.chips.length ? ` ${wordsOf(top.s.chips)}` : ''}. Every streak on the line when ${away} play${key.neutral ? '' : ' at'} ${home}, ${when}.`
          : `Every streak on the line when ${away} play ${at} ${home}, ${when}.`
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
          '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], [`${away} ${at} ${home}`, url]]), sportsEvent(key, url, item.played)],
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
    // a game address can name a never-major opponent; the worker words it from here
    others: Object.fromEntries(teams.filter((t) => !t.major).map((t) => [t.id, t.name])),
    mascots: P.mascots ?? [],
    colors: P.colors ?? [],
  }
  fs.mkdirSync(path.join(ROOT, 'dist', 'share'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'dist', 'share', 'meta.json'), JSON.stringify(meta))
  // the cards' rows (broken, at-risk, the breakers) go to dist/share/weekly.json once the breakers' are in (below)
  // the worker's og.png route runs the site's own model; publish the payload it reads
  fs.copyFileSync(path.join(ROOT, 'src', 'data', 'payload.json'), path.join(ROOT, 'dist', 'share', 'payload.json'))
  console.log(`share meta: ${Object.keys(meta.teams).length} teams, ${meta.mascots.length} mascot kinds; payload copied for the og worker`)
}

// --- the streak-breakers: the running season's breaks by the team that made them, one file and one page ---
// the same rows the schedule and the game pages read, so a game's count holds every break credited here
const breakers = breakersFromSeason(seasonRows.get(P.currentSeason), P.currentSeason)
const breakersFile = encodeBreakers(breakers)
const breakerUrls = []
fs.mkdirSync(path.join(ROOT, 'dist', 'breakers'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'dist', 'breakers', `${P.currentSeason}.json`), JSON.stringify(breakersFile))
{
  const ranking = breakRanking(breakers)
  const url = `${SITE}breakers/`
  const title = `Top Streak-Breakers ${P.currentSeason} · ${config.title}`
  const top = ranking.slice(0, 3).map((s, i) => `${i + 1}. ${teams[s.ti].name} (${s.n})`).join(', ')
  const description = ranking.length
    ? `The college football teams that broke the biggest streaks in ${P.currentSeason}, by Streak King Rank: ${top}. Every all-time longest and longest active streak a team ended by beating its owner.`
    : `The college football teams that break the biggest streaks: every all-time longest and longest active streak a team ended by beating its owner.`
  const { html } = page({
    initial: { breakers: true, breaks: decodeBreakers(breakersFile) },
    breakers: breakersFile,
    url, title, description,
    image: `${SITE}share/og.png?breakers=${P.currentSeason}`, imageAlt: `The ${P.currentSeason} streak-breakers, on a dark leaderboard.`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        webPage(url, title, description),
        breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Streak-breakers', url]]),
        itemList(`Top Streak-Breakers ${P.currentSeason}`, ranking.slice(0, 10).map((s) => [`${teams[s.ti].name}: ${s.n} streak${s.n === 1 ? '' : 's'} broken`, `${SITE}breakers/${teams[s.ti].id}/`])),
      ],
    },
  })
  fs.writeFileSync(path.join(ROOT, 'dist', 'breakers', 'index.html'), html)
  // the cards' rows: the leaderboard's top, and each breaker's own top breaks (the worker's og.png?breakers= and ?breaker=)
  weekly.breakers = {
    season: P.currentSeason, teams: ranking.length,
    rows: ranking.slice(0, 7).map((s, i) => ({
      count: String(s.n), team: teams[s.ti].id, bad: false,
      claim: `${i + 1}. ${teams[s.ti].name}`,
      sub: `${s.by.alltime} all-time · ${s.by.leading} longest active`,
      // whose streaks, a chip each, the most first
      vs: s.victims.slice(0, 4).map(([v, n]) => [teams[v].id, n]),
    })),
  }
  weekly.breaker = {}
  // one page per breaker: its broken streaks, at /breakers/<id>/, with its own card
  for (const s of ranking) {
    const t = teams[s.ti]
    const rows = breakRows(listBreaks(breakers.teams.get(s.ti) ?? [])).filter((b) => !b.subStreak)
    weekly.breaker[t.id] = {
      season: P.currentSeason, name: t.name, n: s.n, rank: breakers.ranks.get(s.ti) ?? 0,
      rows: rows.slice(0, 7).map((b) => ({ count: `${b.len}${b.atEdge ? '+' : ''}`, team: teams[b.ti].id, bad: false, claim: brokenClaim(b), sub: brokenSub(b) })),
    }
    const url = `${SITE}breakers/${t.id}/`
    const title = `Streaks ${t.name} broke in ${P.currentSeason} · ${config.title}`
    const top = rows.slice(0, 3).map((b) => brokenClaim(b))
    const description = `${t.name} ended ${s.n} all-time longest or longest active streak${s.n === 1 ? '' : 's'} by winning this season, Streak King Rank #${breakers.ranks.get(s.ti)}: ${top.join('. ')}.`
    // rendered from the decoded file the page embeds (rounded scores and odds), so the hydrate matches
    const sliceFile = encodeBreakers(breakersSlice(breakers, s.ti))
    const { html } = page({
      initial: { breakers: true, breaker: s.ti, breaks: decodeBreakers(sliceFile) },
      breakers: sliceFile,
      url, title, description,
      image: `${SITE}share/og.png?breaker=${t.id}`, imageAlt: `The streaks ${t.name} broke in ${P.currentSeason}, on a dark leaderboard.`,
      jsonLd: { '@context': 'https://schema.org', '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Streak-breakers', `${SITE}breakers/`], [t.name, url]])] },
    })
    const dir = path.join(ROOT, 'dist', 'breakers', t.id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    breakerUrls.push(url)
  }
  fs.writeFileSync(path.join(ROOT, 'dist', 'share', 'weekly.json'), JSON.stringify(weekly))
  console.log(`breakers: ${ranking.length} teams broke a streak in ${P.currentSeason}, ${ranking.reduce((a, s) => a + s.n, 0)} breaks; the page, ${breakerUrls.length} team pages and the file under dist/breakers/`)
}

// --- one page per current FBS team ---
const board = allTimeBoard(DEFAULT_CHIPS, 'W', todayEp)
const urls = [SITE, `${SITE}games/`, `${SITE}breakers/`, ...breakerUrls, ...weekUrls, ...gameUrls]
let teamPages = 0
for (const ti of [...fbsNow].sort((a, b) => teams[a].name.localeCompare(teams[b].name))) {
  const t = teams[ti]
  const row = board.find((r) => r.ti === ti)
  const url = `${SITE}team/${t.id}/`
  const title = `${t.name} football streaks: every win streak and losing streak it leads · ${config.title}`
  const since = windowStartOf(ti)
  const tail = `${t.name}'s record, next game, and every streak it leads in college football, active or all-time, under any definition, since ${since}.`
  const description = row ? `${claim(row, DEFAULT_CHIPS, 'W')} ${tail}` : tail
  const hasImage = fs.existsSync(path.join(ROOT, 'public', 'og', 'team', `${t.id}.png`))
  const { html } = page({
    // rendered from the same decoded file the page embeds, so the hydrate matches
    initial: { page: ti, crowns: { active: decodeCrowns(activeOf(ti)).rows, all: null }, breaks: decodeBreakers(encodeBreakers(breakersSlice(breakers, ti))) },
    embed: activeOf(ti),
    breakers: encodeBreakers(breakersSlice(breakers, ti)),
    url,
    title,
    description,
    image: hasImage ? `${SITE}og/team/${t.id}.png` : `${SITE}og.png`,
    imageAlt: hasImage ? `${t.name}'s longest streaks, on a dark leaderboard.` : config.ogImageAlt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [webPage(url, title, description), breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], [t.name, url]]), sportsTeam(t)],
    },
  })
  const dir = path.join(ROOT, 'dist', 'team', t.id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  urls.push(url)
  teamPages++
}
console.log(`prerendered ${teamPages} team pages under dist/team/`)

// --- the named definition pages (landing.ts): the board on each, at its
// own path, titled the way people search for it; its card is the worker's
// board card for the definition ---
{
  let n = 0
  for (const l of LANDINGS) {
    const v = landingView(l)
    const rows = (v.scope === 'all' ? allTimeBoard(v.active, v.dir, todayEp) : activeBoard(v.active, v.dir, todayEp)).slice(0, 10)
    const url = `${SITE}${l.slug}/`
    const title = `${l.h1}${l.scope === 'all' ? ' (since 1936)' : ''} · ${config.title}`
    const lead = rows[0] ? `${teams[rows[0].ti].name} leads at ${rows[0].s.len}${rows[0].s.atEdge ? '+' : ''}. ` : ''
    const description = `${lead}${l.description}`
    const img = new URLSearchParams({ c: l.c })
    if (l.dir !== 'W') img.set('dir', l.dir)
    if (l.scope === 'active') img.set('scope', 'active')
    const { html } = page({
      initial: { landing: l.slug },
      url, title, description,
      image: `${SITE}share/og.png?${img}`,
      imageAlt: `${l.h1}, on a dark leaderboard.`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          webPage(url, title, description),
          breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], [l.h1, url]]),
          itemList(l.h1, rows.map((r) => [`${teams[r.ti].name}: ${r.s.len}${r.s.atEdge ? '+' : ''} straight`, `${SITE}team/${teams[r.ti].id}/`])),
        ],
      },
    })
    const dir = path.join(ROOT, 'dist', l.slug)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    urls.push(url)
    n++
  }
  console.log(`prerendered ${n} named definition pages`)
}

// --- every past season's schedule, one page per week (/games/<season>/week/<n>/)
// and one for the season (/games/<season>/, its first week): the week's
// results and the streaks they broke, from the season file ---
{
  let n = 0
  const PAST_SEASONS = seasons().filter((se) => se !== SEASON)
  for (const se of PAST_SEASONS) {
    const weeks = seasonWeeks(se)
    if (!weeks.length) continue
    for (const [i, w] of weeks.entries()) {
      const slice = seasonSlice(se, w.games.map((g) => keyString(g.key)))
      const broken = brokenFromRows(slice.rows, w)
      const top = broken ? broken.list.slice(0, 3).map((b) => brokenClaim(b)) : []
      const total = broken ? broken.list.length + broken.more.length : 0
      // the season's own address is its first week, rendered as the app opens it (no week in the path)
      for (const root of i === 0 ? [false, true] : [false]) {
        const url = root ? `${SITE}games/${se}/` : `${SITE}games/${se}/week/${w.wk}/`
        const title = root
          ? `${se} college football season: every week's games and the streaks they broke · ${config.title}`
          : `Week ${w.wk}, ${se} college football: the games and the streaks they broke · ${config.title}`
        const description = top.length
          ? `${top.join('. ')}.${total > top.length ? ` ${total - top.length} more streaks ended in Week ${w.wk} of ${se}.` : ''} Every Week ${w.wk} game with a current FBS team, and what each one broke.`
          : `Every Week ${w.wk} game of the ${se} college football season with a current FBS team, and the streaks each one ended.`
        const { html } = page({
          initial: { games: true, bwk: root ? null : w.wk, season: se, seasonRows: slice.rows },
          season: slice.file,
          url, title, description,
          image: `${SITE}og.png`,
          imageAlt: config.ogImageAlt,
          jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
              webPage(url, title, description),
              breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Games', `${SITE}games/`], [String(se), `${SITE}games/${se}/`], ...(root ? [] : [[`Week ${w.wk}`, url]])]),
              ...(broken?.list.length ? [itemList(`Streaks broken in Week ${w.wk}, ${se}`, broken.list.slice(0, 10).map((b) => [brokenClaim(b), `${SITE}team/${teams[b.ti].id}/`]))] : []),
            ],
          },
        })
        const dir = root ? path.join(ROOT, 'dist', 'games', String(se)) : path.join(ROOT, 'dist', 'games', String(se), 'week', String(w.wk))
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'index.html'), html)
        urls.push(url)
        n++
      }
    }
  }
  console.log(`prerendered ${n} past-season week pages (${PAST_SEASONS.length} seasons)`)
}

// --- the weekly posts (content/posts/*.md): static pages with the site's
// styles and no app, an index, and the feed ---
const posts = readPosts(path.join(ROOT, 'content', 'posts'))
{
  const chevron = '<svg viewBox="0 0 8 12" width="7" height="11" aria-hidden="true"><path d="M7 1 2 6l5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  const bar = `<div class="tpg-bar"><a class="crumb" href="${SITE}">${chevron} Streak King</a><a class="crumb" href="${SITE}blog/">All posts</a></div>`
  const foot = `<footer><a href="${ORIGIN}/">drewhoover.com</a> · <a href="${SITE}">the board</a> · <a href="${SITE}games/">this week's games</a> · <a href="${FEED}">RSS</a></footer>`
  const person = { '@type': 'Person', name: 'Drew Hoover', url: `${ORIGIN}/` }
  for (const [i, p] of posts.entries()) {
    const url = `${SITE}blog/${p.slug}/`
    const newer = posts[i - 1], older = posts[i + 1]
    const nav = newer || older
      ? `<nav class="post-nav">${older ? `<a href="${SITE}blog/${older.slug}/">← ${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a href="${SITE}blog/${newer.slug}/">${esc(newer.title)} →</a>` : ''}</nav>`
      : ''
    const body = `<main class="post">${bar}<article><h1 class="post-h1">${esc(p.title)}</h1><p class="post-meta">${longDate(p.date)} · Drew Hoover</p><div class="post-body">${p.html}</div></article>${nav}${foot}</main>`
    const image = p.image ? (p.image.startsWith('http') ? p.image : `${ORIGIN}${p.image}`) : `${SITE}og.png`
    const { html } = page({
      body, url, title: `${p.title} · ${config.title}`, description: p.description, image, imageAlt: config.ogImageAlt, ogType: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting', '@id': url, url, headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date,
            author: person, publisher: person, image, mainEntityOfPage: url, isPartOf: { '@type': 'Blog', '@id': `${SITE}blog/`, name: `${config.title}: weekly posts` },
          },
          breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Posts', `${SITE}blog/`], [p.title, url]]),
        ],
      },
    })
    const dir = path.join(ROOT, 'dist', 'blog', p.slug)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    urls.push(url)
  }
  // the index
  {
    const url = `${SITE}blog/`
    const title = `Weekly posts: the streaks at stake, and the ones that broke · ${config.title}`
    const description = `Every week in season: the college football streaks the coming games put on the line, and the ones the results broke. ${posts.length ? `${posts.length} post${posts.length === 1 ? '' : 's'}, the latest ${longDate(posts[0].date)}.` : 'The first post lands with the season.'}`
    const list = posts.length
      ? `<ul class="post-list">${posts.map((p) => `<li><a href="${SITE}blog/${p.slug}/">${esc(p.title)}</a><p class="post-meta">${longDate(p.date)}</p><p>${esc(p.description)}</p></li>`).join('')}</ul>`
      : `<p class="empty">No posts yet.</p>`
    const body = `<main class="post">${bar}<h1 class="post-h1">Weekly posts</h1><p class="post-meta">the streaks at stake, and the ones that broke · <a href="${FEED}">RSS</a></p><p class="tpg-note">Thursdays, the streaks the coming week's games put on the line (<a href="${SITE}games/at-risk/">the full list</a>); Sundays, the ones the results broke (<a href="${SITE}games/">by week</a>).</p>${list}${foot}</main>`
    const { html } = page({
      body, url, title, description, image: `${SITE}og.png`, imageAlt: config.ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Blog', '@id': url, url, name: `${config.title}: weekly posts`, description, author: person, blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}blog/${p.slug}/`, datePublished: p.date })) },
          breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], ['Posts', url]]),
        ],
      },
    })
    fs.mkdirSync(path.join(ROOT, 'dist', 'blog'), { recursive: true })
    fs.writeFileSync(path.join(ROOT, 'dist', 'blog', 'index.html'), html)
    urls.push(url)
  }
  // the feed
  const cdata = (s) => `<![CDATA[${String(s).replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`
  const items = posts.map((p) => `    <item>
      <title>${cdata(p.title)}</title>
      <link>${SITE}blog/${p.slug}/</link>
      <guid isPermaLink="true">${SITE}blog/${p.slug}/</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${cdata(p.description)}</description>
      <content:encoded>${cdata(p.html)}</content:encoded>
    </item>`).join('\n')
  fs.writeFileSync(path.join(ROOT, 'dist', 'blog', 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(config.title)}: weekly posts</title>
    <link>${SITE}blog/</link>
    <atom:link href="${FEED}" rel="self" type="application/rss+xml" />
    <description>The college football streaks at stake each week, and the ones the results broke.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`)
  console.log(`posts: ${posts.length} under dist/blog/, the index and feed.xml`)
}

// Sitemap: every prerendered page, with lastmod.
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
