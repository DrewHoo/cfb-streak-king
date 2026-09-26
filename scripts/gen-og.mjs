// Generate the social preview images. Run: npm run gen:og
//   public/og.png    1200x630, what X/Bluesky/LinkedIn/Reddit/iMessage show
//   public/card.png  1200x750, the 8:5 cover for the index site's project card
//
// Two sizes because the index card crops covers to 8:5 with object-fit: cover,
// so a 1200x630 image silently loses its top and bottom there. Same SVG,
// parameterised by height; the taller one gets more room for the chart.
//
// Outputs are committed; CI does not regenerate them. Re-run after a redesign,
// and open the PNGs: a line running off the edge is only visible if you look.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(outDir, { recursive: true })

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
const MUTED = '#9ba3b5'
const TEXT = '#ffffff'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// Break the title onto lines that fit the left column at the chosen size.
function wrap(text, maxChars) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = (line + ' ' + word).trim()
    }
  }
  if (line) lines.push(line)
  return lines
}

function render(W, H) {
  const titleLines = wrap(config.title, 14)
  if (titleLines.length > 3) throw new Error(`gen-og: title wraps to ${titleLines.length} lines; shorten it or lower the font size`)
  const titleSize = titleLines.length === 1 ? 72 : titleLines.length === 2 ? 64 : 52
  const titleTop = 150
  const titleBottom = titleTop + titleLines.length * titleSize * 1.05
  const chartTop = 110
  const chartH = H - chartTop - 130
  // Stylized series: the visual should say what kind of page this is
  // without being any real row of your data. Replace with your own shape.
  const pts = [0, 38, 76, 114, 152, 190, 228, 266, 304, 342, 380, 418, 456].map((x, i) => [
    x,
    chartH - 40 - (i * (chartH - 100)) / 12 + (i % 3 === 1 ? 24 : i % 3 === 2 ? -12 : 0),
  ])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y.toFixed(0)}`).join(' ')
  const footerY = H - 50
  if (titleBottom + 90 > footerY) throw new Error('gen-og: title and subtitle run into the footer')

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#11151c"/>
      <stop offset="100%" stop-color="#0a0d12"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <text x="60" y="100" font-family="${FONT}" font-size="20" fill="${MUTED}" font-weight="600" letter-spacing="3">${esc(config.domain.toUpperCase())}</text>
  ${titleLines
    .map((l, i) => `<text x="60" y="${titleTop + titleSize * (i + 0.9)}" font-family="${FONT}" font-size="${titleSize}" fill="${TEXT}" font-weight="700" letter-spacing="-1">${esc(l)}</text>`)
    .join('\n  ')}
  <text x="60" y="${titleBottom + 50}" font-family="${FONT}" font-size="24" fill="${TEXT}" font-weight="500">${esc(config.ogSubtitle)}</text>

  <g transform="translate(620, ${chartTop})">
    <rect x="0" y="0" width="520" height="${chartH}" rx="14" fill="#151921" stroke="rgba(255,255,255,0.08)"/>
    <g transform="translate(32, 20)">
      <path d="${d}" fill="none" stroke="${config.accent}" stroke-width="4" stroke-linejoin="round"/>
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y.toFixed(0)}" r="6" fill="${config.accent}" stroke="white" stroke-width="1.5"/>`).join('')}
    </g>
  </g>

  <text x="60" y="${footerY}" font-family="${FONT}" font-size="18" fill="${MUTED}" font-weight="500">${esc(config.domain)}/${esc(pkg.name)}</text>
  <rect x="60" y="${footerY + 16}" width="80" height="3" fill="${config.accent}"/>
</svg>`
}

for (const { name, w, h } of [
  { name: 'og.png', w: 1200, h: 630 },
  { name: 'card.png', w: 1200, h: 750 },
]) {
  const out = resolve(outDir, name)
  await sharp(Buffer.from(render(w, h))).png({ compressionLevel: 9 }).toFile(out)
  console.log(`wrote ${name} (${w}x${h})`)
}
