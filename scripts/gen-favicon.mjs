// The favicon is drewhoover.com's own mark, the same files every sibling site
// ships, copied from the index repo. Run: npm run gen:favicon [path-to-index-repo]
// Outputs are committed; CI does not regenerate them.
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const src = resolve(process.argv[2] ?? resolve(homedir(), 'Projects/DrewHoo.github.io'), 'public')
if (!existsSync(resolve(src, 'favicon.svg'))) throw new Error(`gen-favicon: no favicon.svg under ${src}; pass the index repo's path`)
for (const f of ['favicon.svg', 'favicon-32.png', 'favicon-192.png', 'apple-touch-icon.png']) {
  copyFileSync(resolve(src, f), resolve(outDir, f))
  console.log(`copied ${f}`)
}
