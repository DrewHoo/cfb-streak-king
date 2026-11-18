// What to read next, baked at build time: Putting Up Numbers' links.json for a
// subject, the first five that don't point into this site. The browser's
// draw (the back-bar embed) replaces it when it lands. A fetch that fails
// bakes nothing and never fails the build. READ_NEXT_ORIGIN points it at
// another PUN (a local server, for testing).

export const READ_NEXT_ORIGIN = (process.env.READ_NEXT_ORIGIN ?? 'https://puttingupnumbers.com').replace(/\/+$/, '')
const BLOCK = 5
const FEWEST = 3

/** a links.json's links that don't point into `site` (this site's first path segment), as the block shows them; [] when the fetch fails */
export async function readNextLinks(path, site) {
  try {
    const r = await fetch(`${READ_NEXT_ORIGIN}${path}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const file = await r.json()
    return (Array.isArray(file?.links) ? file.links : [])
      .filter((l) => l && typeof l.id === 'string' && typeof l.href === 'string' && typeof l.text === 'string' && !l.href.startsWith(`https://drewhoover.com/${site}/`))
      .map(({ id, kind, sport, href, text }) => ({ id, kind, sport, href, text }))
  } catch {
    return []
  }
}

/** the block's baked five: the subject's, then the sport's while there are under three; under three in all, none */
export function bakeReadNext(...lists) {
  const out = []
  for (const list of lists) {
    if (out.length >= FEWEST) break
    for (const l of list) if (!out.some((o) => o.id === l.id || o.href === l.href)) out.push(l)
  }
  return out.length >= FEWEST ? out.slice(0, BLOCK) : []
}

/** `paths.map(readNextLinks)`, a few at a time */
export async function readNextMany(paths, site, at = 12) {
  const out = []
  for (let i = 0; i < paths.length; i += at) out.push(...(await Promise.all(paths.slice(i, i + at).map((p) => readNextLinks(p, site)))))
  return out
}
