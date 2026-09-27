// Generate the social preview images. Run: npm run gen:og
//   public/og.png    1200x630, what X/Bluesky/LinkedIn/Reddit/iMessage show
//   public/card.png  1200x750, the 8:5 cover for the index site's project card
//
// The composition is the real thing: the actual overall winning-streak board
// from src/data/payload.json, drawn in the site's own visual language (HT
// palette, Graduate counts, cream/dark chips, real team marks). It drifts as
// results come in, which is the point; re-run after a redesign or whenever a
// fresher board is worth committing.
//
// Fonts: librsvg resolves text through fontconfig, so the script points
// FONTCONFIG_FILE at a generated conf whose only dir is data/raw/fonts/
// (fetched by scripts/gen-og-fonts note below, gitignored). That env must be
// set before sharp loads, hence the dynamic import.
//   fonts: Graduate-Regular, IBMPlexMono-{Regular,SemiBold},
//          SourceSerif4[-Italic] — grab them from github.com/google/fonts/ofl
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentStreak } from '../src/lib/streaks.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = resolve(ROOT, 'data', 'raw', 'fonts')
if (!existsSync(resolve(FONTS, 'Graduate-Regular.ttf'))) {
  throw new Error('fonts missing: fetch Graduate/IBMPlexMono/SourceSerif4 TTFs into data/raw/fonts (see header)')
}
const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONTS}</dir>
  <cachedir>${FONTS}/cache</cachedir>
</fontconfig>`
writeFileSync(resolve(FONTS, 'fonts.conf'), conf)
process.env.FONTCONFIG_FILE = resolve(FONTS, 'fonts.conf')
const sharp = (await import('sharp')).default

// --- the real board: overall winning streaks, top N ---
const P = JSON.parse(readFileSync(resolve(ROOT, 'src', 'data', 'payload.json'), 'utf8'))
const g = P.games
const fbsNow = new Set()
P.teams.forEach((t, i) => {
  if (t.fbs?.some(([a, b]) => a <= P.currentSeason && b >= P.currentSeason)) fbsNow.add(i)
})
const byTeam = new Map()
for (const ti of fbsNow) byTeam.set(ti, [])
for (let i = 0; i < g.se.length; i++) {
  for (const side of [0, 1]) {
    const ti = side === 0 ? g.hi[i] : g.ai[i]
    const list = byTeam.get(ti)
    if (!list) continue
    const us = side === 0 ? g.hs[i] : g.as[i]
    const them = side === 0 ? g.as[i] : g.hs[i]
    list.push({ r: us > them ? 'W' : us < them ? 'L' : 'T', oppIdx: side === 0 ? g.ai[i] : g.hi[i] })
  }
}
const rows = []
for (const [ti, list] of byTeam) {
  const s = currentStreak(list)
  if (s?.dir === 'W' && s.len > 0) rows.push({ ti, s, list })
}
rows.sort((a, b) => b.s.len - a.s.len)

// --- logo data URIs (color for the column team, ink/gray for chips) ---
const uriCache = new Map()
async function logoUri(espn, kind) {
  const key = `${espn}|${kind}`
  if (uriCache.has(key)) return uriCache.get(key)
  let out = null
  try {
    if (kind === 'color') {
      out = `data:image/png;base64,${readFileSync(resolve(ROOT, 'public', 'logos-color', `${espn}.png`)).toString('base64')}`
    } else {
      const buf = readFileSync(resolve(ROOT, 'public', 'logos', `${espn}.png`))
      if (kind === 'ink') out = `data:image/png;base64,${buf.toString('base64')}`
      else {
        // the mono mark is black-with-alpha; lift it to warm gray for dark chips
        const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
        for (let i = 0; i < data.length; i += 4) { data[i] = 176; data[i + 1] = 166; data[i + 2] = 156 }
        const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
        out = `data:image/png;base64,${png.toString('base64')}`
      }
    }
  } catch { out = null }
  uriCache.set(key, out)
  return out
}

const BG = '#282127'
const LIFT = '#322a30'
const INK = '#efe6d9'
const MUTED = '#bfb2a6'
const FAINT = '#857a75'
const LINE = '#453a42'
const CREAM = '#f3e2bc'
const RUST = '#c36c36'

async function column(row, x, y, chipN) {
  const t = P.teams[row.ti]
  const W = 56
  const sq = 46
  const gap = 7
  const parts = []
  const count = `${row.s.len}${row.s.atEdge ? '+' : ''}`
  parts.push(`<text x="${x + W / 2}" y="${y + 34}" font-family="Graduate" font-size="34" fill="${CREAM}" text-anchor="middle">${count}</text>`)
  const color = t.espn && (await logoUri(t.espn, 'color'))
  if (color) parts.push(`<image x="${x + (W - 44) / 2}" y="${y + 46}" width="44" height="44" href="${color}"/>`)
  const streak = row.list.slice(-row.s.len).reverse().slice(0, chipN)
  let cy = y + 102
  for (const game of streak) {
    const opp = P.teams[game.oppIdx]
    const ink = opp?.espn && (await logoUri(opp.espn, 'ink'))
    parts.push(`<rect x="${x + (W - sq) / 2}" y="${cy}" width="${sq}" height="${sq}" rx="6" fill="${CREAM}"/>`)
    if (ink) parts.push(`<image x="${x + (W - 34) / 2}" y="${cy + 6}" width="34" height="34" href="${ink}" opacity="0.78"/>`)
    cy += sq + gap
  }
  if (row.s.len > chipN) {
    parts.push(`<text x="${x + W / 2}" y="${cy + 12}" font-family="IBM Plex Mono" font-size="13" fill="${FAINT}" text-anchor="middle">+${row.s.len - chipN}</text>`)
    cy += 22
  }
  // the game that ended the streak, dark
  if (!row.s.atEdge && row.s.ender) {
    cy += 4
    const opp = P.teams[row.s.ender.oppIdx]
    const gray = opp?.espn && (await logoUri(opp.espn, 'gray'))
    parts.push(`<rect x="${x + (W - sq) / 2}" y="${cy}" width="${sq}" height="${sq}" rx="6" fill="${LIFT}" stroke="${LINE}"/>`)
    if (gray) parts.push(`<image x="${x + (W - 34) / 2}" y="${cy + 6}" width="34" height="34" href="${gray}" opacity="0.85"/>`)
  }
  return parts.join('\n')
}

async function render(W, H) {
  const chipN = H > 700 ? 7 : 6
  const nCols = 9
  const colGap = 70
  const boardX = W - 64 - nCols * colGap + 14
  const cols = []
  for (let i = 0; i < nCols && i < rows.length; i++) {
    cols.push(await column(rows[i], boardX + i * colGap, 96, chipN))
  }
  const midY = H / 2
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="lamp" cx="0.5" cy="-0.2" r="1.1">
      <stop offset="0%" stop-color="${CREAM}" stop-opacity="0.13"/>
      <stop offset="65%" stop-color="${CREAM}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#lamp)"/>

  <text x="64" y="${midY - 128}" font-family="IBM Plex Mono" font-weight="600" font-size="17" letter-spacing="4" fill="${RUST}">DREWHOOVER.COM</text>
  <text x="60" y="${midY - 44}" font-family="Graduate" font-size="76" fill="${CREAM}">STREAK</text>
  <text x="60" y="${midY + 40}" font-family="Graduate" font-size="76" fill="${CREAM}">KING</text>
  <text x="64" y="${midY + 96}" font-family="Source Serif 4" font-style="italic" font-size="23" fill="${MUTED}">Design a streak from up to four constraints —</text>
  <text x="64" y="${midY + 128}" font-family="Source Serif 4" font-style="italic" font-size="23" fill="${MUTED}">every FBS team, ranked by its active run.</text>
  <text x="64" y="${H - 56}" font-family="IBM Plex Mono" font-size="15" letter-spacing="2" fill="${FAINT}">1978–${P.currentSeason} · ${g.se.length.toLocaleString('en-US')} GAMES</text>

  ${cols.join('\n')}
</svg>`
}

const outDir = resolve(ROOT, 'public')
mkdirSync(outDir, { recursive: true })
for (const [file, W, H] of [['og.png', 1200, 630], ['card.png', 1200, 750]]) {
  const svg = await render(W, H)
  await sharp(Buffer.from(svg), { density: 96 }).png({ compressionLevel: 9 }).toFile(resolve(outDir, file))
  console.log(`${file}: ${W}x${H}`)
}
console.log('board shown:', rows.slice(0, 9).map((r) => `${P.teams[r.ti].id} ${r.s.len}${r.s.atEdge ? '+' : ''}`).join(', '))
