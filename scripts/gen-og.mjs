// Generate the social preview images. Run: npm run gen:og
//   public/og.png            1200x630, what X/Bluesky/LinkedIn/Reddit/iMessage show
//   public/card.png          1200x750, the 8:5 cover for the index site's project card
//   public/og/team/<id>.png  1200x630, one per current FBS team, used by /team/<id>/
//
// The composition is the real thing: the default board (all-time winning
// streaks vs unranked opponents) from src/data/payload.json, drawn in the
// site's own visual language (HT palette, Graduate counts, cream/dark chips,
// real team marks). A team card carries that team's column, its claim in plain
// English, and the streaks it is king of. It all drifts as results come in,
// which is the point; re-run after a redesign or whenever a fresher board is
// worth committing.
//
// Fonts: text is drawn as glyph outlines through opentype.js, so nothing
// depends on fontconfig (sharp's bundled librsvg never found Graduate or
// Plex Mono through FONTCONFIG_FILE, and fell back to Helvetica). The TTFs
// live in data/raw/fonts/ (gitignored): Graduate-Regular,
// IBMPlexMono-{Regular,SemiBold}, SourceSerif4[-Italic] — grab them from
// github.com/google/fonts/ofl.
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = resolve(ROOT, 'data', 'raw', 'fonts')
if (!existsSync(resolve(FONTS, 'Graduate-Regular.ttf'))) {
  throw new Error('fonts missing: fetch Graduate/IBMPlexMono/SourceSerif4 TTFs into data/raw/fonts (see header)')
}
const font = (f) => opentype.parse(readFileSync(resolve(FONTS, f)).buffer.slice(0))
const FONT = {
  Graduate: font('Graduate-Regular.ttf'),
  Mono: font('IBMPlexMono-Regular.ttf'),
  MonoBold: font('IBMPlexMono-SemiBold.ttf'),
  Serif: font('SourceSerif4.ttf'),
  SerifItalic: font('SourceSerif4-Italic.ttf'),
}
// one run of text as a filled path; spacing is letter-spacing in px
function text(str, { x, y, font: name, size, fill, anchor = 'start', spacing = 0, opacity }) {
  const f = FONT[name]
  const opts = { kerning: true, letterSpacing: spacing / size }
  const w = f.getAdvanceWidth(str, size, opts)
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return `<path d="${f.getPath(str, x0, y, size, opts).toPathData(2)}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`
}
// several runs on one baseline, each with its own font/size/fill
function line(segments, { x, y, spacing = 0 }) {
  const parts = []
  let cx = x
  for (const seg of segments) {
    parts.push(text(seg.str, { ...seg, x: cx, y, spacing }))
    cx += FONT[seg.font].getAdvanceWidth(seg.str, seg.size, { kerning: true, letterSpacing: spacing / seg.size })
  }
  return parts.join('\n')
}

// --- the site's own model, through vite so the JSON import resolves ---
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const { P, teams, fbsNow, allTimeBoard, todayEpochDay } = await vite.ssrLoadModule('/src/lib/model.js')
const { DEFAULT_CHIPS } = await vite.ssrLoadModule('/src/lib/definition.js')
const { claim } = await vite.ssrLoadModule('/src/lib/sentence.js')
const { mineAll } = await vite.ssrLoadModule('/src/lib/crowns.js')
const { streakGames } = await vite.ssrLoadModule('/src/components/Grid.jsx')

const todayEp = todayEpochDay()
const rows = allTimeBoard(DEFAULT_CHIPS, 'W', todayEp)
const crowns = await mineAll('active')
const teamIds = process.argv.slice(2) // `npm run gen:og -- alabama` renders one card

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

// greedy wrap by an average glyph width; serif at 23px runs ~11.5px a glyph
function wrap(text, maxChars) {
  const out = []
  let line = ''
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > maxChars && line) { out.push(line); line = w }
    else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}

async function column(row, x, y, chipN, { countSize = 34, W = 56, sq = 46, gap = 7 } = {}) {
  const t = teams[row.ti]
  const parts = []
  const count = `${row.s.len}${row.s.atEdge ? '+' : ''}`
  parts.push(text(count, { x: x + W / 2, y: y + countSize, font: 'Graduate', size: countSize, fill: CREAM, anchor: 'middle' }))
  const color = t.espn && (await logoUri(t.espn, 'color'))
  if (color) parts.push(`<image x="${x + (W - 44) / 2}" y="${y + countSize + 12}" width="44" height="44" href="${color}"/>`)
  const games = streakGames(row)
  let cy = y + countSize + 68
  // the top slot: an ended run's breaker, dark; a live run's next game in
  // color with a dashed border, or nothing, so every stack starts level
  if (row.live === false && row.ended) {
    const opp = teams[row.ended.oppIdx]
    const gray = opp?.espn && (await logoUri(opp.espn, 'gray'))
    parts.push(`<rect x="${x + (W - sq) / 2}" y="${cy}" width="${sq}" height="${sq}" rx="6" fill="${LIFT}" stroke="${LINE}"/>`)
    if (gray) parts.push(`<image x="${x + (W - 34) / 2}" y="${cy + 6}" width="34" height="34" href="${gray}" opacity="0.85"/>`)
    cy += sq + gap + 4
  } else if (row.s.start) {
    if (row.next) {
      const opp = teams[row.next.oppIdx]
      const color = opp?.espn && (await logoUri(opp.espn, 'color'))
      parts.push(`<rect x="${x + (W - sq) / 2}" y="${cy}" width="${sq}" height="${sq}" rx="6" fill="none" stroke="${RUST}" stroke-dasharray="4 3"/>`)
      if (color) parts.push(`<image x="${x + (W - 34) / 2}" y="${cy + 6}" width="34" height="34" href="${color}"/>`)
    }
    cy += sq + gap + 4
  }
  for (const game of games.slice(0, chipN)) {
    const opp = teams[game.oppIdx]
    const ink = opp?.espn && (await logoUri(opp.espn, 'ink'))
    parts.push(`<rect x="${x + (W - sq) / 2}" y="${cy}" width="${sq}" height="${sq}" rx="6" fill="${CREAM}"/>`)
    if (ink) parts.push(`<image x="${x + (W - 34) / 2}" y="${cy + 6}" width="34" height="34" href="${ink}" opacity="0.78"/>`)
    cy += sq + gap
  }
  if (games.length > chipN) {
    parts.push(text(`+${games.length - chipN}`, { x: x + W / 2, y: cy + 12, font: 'Mono', size: 13, fill: FAINT, anchor: 'middle' }))
  }
  return parts.join('\n')
}

const frame = (W, H, body) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="lamp" cx="0.5" cy="-0.2" r="1.1">
      <stop offset="0%" stop-color="${CREAM}" stop-opacity="0.13"/>
      <stop offset="65%" stop-color="${CREAM}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#lamp)"/>
  ${body}
</svg>`

// the root card: the default board, nine columns
async function renderBoard(W, H) {
  const chipN = H > 700 ? 7 : 6
  const nCols = 9
  const colGap = 70
  const boardX = W - 64 - nCols * colGap + 14
  const cols = []
  for (let i = 0; i < nCols && i < rows.length; i++) cols.push(await column(rows[i], boardX + i * colGap, 96, chipN))
  const midY = H / 2
  return frame(W, H, `
  ${text('DREWHOOVER.COM', { x: 64, y: midY - 128, font: 'MonoBold', size: 17, spacing: 4, fill: RUST })}
  ${text('STREAK', { x: 60, y: midY - 44, font: 'Graduate', size: 76, fill: CREAM })}
  ${text('KING', { x: 60, y: midY + 40, font: 'Graduate', size: 76, fill: CREAM })}
  ${text('Longest all-time winning streaks', { x: 64, y: midY + 96, font: 'SerifItalic', size: 23, fill: MUTED })}
  ${text('vs unranked opponents.', { x: 64, y: midY + 128, font: 'SerifItalic', size: 23, fill: MUTED })}
  ${text(`1978–${P.currentSeason} · ${P.games.se.length.toLocaleString('en-US')} GAMES`, { x: 64, y: H - 56, font: 'Mono', size: 15, spacing: 2, fill: FAINT })}
  ${cols.join('\n')}`)
}

// a team card: mark, name, the claim, what it is king of, and its column
async function renderTeam(ti, W, H) {
  const t = teams[ti]
  const row = rows.find((r) => r.ti === ti)
  const held = crowns.get(ti) ?? []
  const w = held.filter((c) => c.dir === 'W').length
  const l = held.filter((c) => c.dir === 'L').length
  const color = t.espn && (await logoUri(t.espn, 'color'))
  const lines = row ? wrap(claim(row, DEFAULT_CHIPS, 'W'), 44) : [`No winning streak vs unranked opponents on record.`]
  const parts = []
  parts.push(text('DREWHOOVER.COM · STREAK KING', { x: 64, y: 84, font: 'MonoBold', size: 17, spacing: 4, fill: RUST }))
  if (color) parts.push(`<image x="64" y="122" width="96" height="96" href="${color}"/>`)
  const nameSize = t.name.length > 16 ? 40 : 52
  parts.push(text(t.name.toUpperCase(), { x: color ? 184 : 64, y: 190, font: 'Graduate', size: nameSize, fill: CREAM }))
  let y = 292
  for (const line of lines.slice(0, 3)) {
    parts.push(text(line, { x: 64, y, font: 'Serif', size: 27, fill: INK }))
    y += 38
  }
  y += 22
  parts.push(line([
    { str: 'KING OF ', font: 'Mono', size: 16, fill: MUTED },
    { str: String(w), font: 'Mono', size: 16, fill: CREAM },
    { str: ' ACTIVE WINNING STREAKS · ', font: 'Mono', size: 16, fill: MUTED },
    { str: String(l), font: 'Mono', size: 16, fill: RUST },
    { str: ' LOSING', font: 'Mono', size: 16, fill: MUTED },
  ], { x: 64, y, spacing: 2 }))
  // the three simplest crowns
  y += 40
  for (const cr of held.slice(0, 3)) {
    const words = cr.chips.length ? cr.chips.map((k) => P.chipLabel?.[k] ?? k).join(' · ') : 'all games'
    parts.push(line([
      { str: `${cr.len}${cr.atEdge ? '+' : ''}`, font: 'Graduate', size: 19, fill: cr.dir === 'L' ? RUST : CREAM },
      { str: `  ${words}`, font: 'Mono', size: 15, fill: FAINT },
    ], { x: 64, y }))
    y += 30
  }
  parts.push(text(`1978–${P.currentSeason} · ${P.games.se.length.toLocaleString('en-US')} GAMES`, { x: 64, y: H - 48, font: 'Mono', size: 15, spacing: 2, fill: FAINT }))
  if (row) {
    // rank on the default board, then the column
    const rank = rows.indexOf(row) + 1
    const x = W - 64 - 96
    parts.push(text(`#${rank} OF ${rows.length.toLocaleString('en-US')}`, { x: x + 48, y: 84, font: 'Mono', size: 14, spacing: 2, fill: FAINT, anchor: 'middle' }))
    parts.push(await column(row, x + 20, 100, 6, { countSize: 40 }))
  }
  return frame(W, H, parts.join('\n'))
}

// crown rows name chips by key; the label lives in the chip catalog
const { CHIPS } = await vite.ssrLoadModule('/src/lib/model.js')
P.chipLabel = Object.fromEntries(CHIPS.map((c) => [c.key, c.label]))

const outDir = resolve(ROOT, 'public')
mkdirSync(resolve(outDir, 'og', 'team'), { recursive: true })
const png = (svg) => sharp(Buffer.from(svg), { density: 96 }).png({ compressionLevel: 9, palette: true, colors: 160 })

if (!teamIds.length) {
  for (const [file, W, H] of [['og.png', 1200, 630], ['card.png', 1200, 750]]) {
    await png(await renderBoard(W, H)).toFile(resolve(outDir, file))
    console.log(`${file}: ${W}x${H}`)
  }
  console.log('board shown:', rows.slice(0, 9).map((r) => `${teams[r.ti].id} ${r.s.len}${r.s.atEdge ? '+' : ''}`).join(', '))
}
let n = 0
for (const ti of fbsNow) {
  const t = teams[ti]
  if (teamIds.length && !teamIds.includes(t.id)) continue
  await png(await renderTeam(ti, 1200, 630)).toFile(resolve(outDir, 'og', 'team', `${t.id}.png`))
  n++
}
console.log(`team cards: ${n} under public/og/team/`)
await vite.close()
