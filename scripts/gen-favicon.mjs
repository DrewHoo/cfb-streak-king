// Generate the favicon set from one SVG. Run: npm run gen:favicon
// Outputs are committed; CI does not regenerate them.
//   public/favicon.svg          modern browsers
//   public/favicon-32.png       small-pixel fallback
//   public/favicon-192.png      Android, PWA
//   public/apple-touch-icon.png iOS home screen (180x180)
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(outDir, { recursive: true })

// Design rule: it has to read at 16x16 in a tab strip. Bold background (not
// white), high-contrast glyph, no fine detail. Replace the polyline with
// something from your data.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${config.accent}"/>
  <polyline points="10,50 22,38 32,44 44,26 54,18"
    fill="none" stroke="white" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="54" cy="18" r="8" fill="white"/>
</svg>`

writeFileSync(resolve(outDir, 'favicon.svg'), svg + '\n')
console.log('wrote favicon.svg')

for (const { name, size } of [
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
]) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(outDir, name))
  console.log(`wrote ${name}`)
}
