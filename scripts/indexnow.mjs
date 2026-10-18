// Tells Bing (and the other IndexNow engines: Yandex, Seznam, Naver) which
// pages to recrawl, after a deploy. Bing's index is what ChatGPT search,
// Copilot and DuckDuckGo answer from, and it crawls a new site slowly on its
// own; Cloudflare's Crawler Hints also pings IndexNow when a cached page
// changes, and this covers what a cache can't see (a page nobody has fetched).
//
//   node scripts/indexnow.mjs          the definition pages, the board, the schedule and the posts
//   node scripts/indexnow.mjs --all    every URL in the live sitemap
//
// The key is public by design: a file whose name and content are the key,
// served from this project's path, which scopes it to /cfb-streak-king/ URLs.
// Run after the deploy, so the key file and the pages are live. It reports
// and exits 0 on any failure: a missed ping never fails a deploy.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }
import { LANDINGS } from '../src/lib/landing.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = `https://${config.domain}/${pkg.name}/`
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const BATCH = 10000 // the protocol's cap per request

const keyFile = fs.readdirSync(path.join(ROOT, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) { console.log('indexnow: no key file under public/, skipped'); process.exit(0) }
const key = keyFile.slice(0, -4)
const keyLocation = `${SITE}${keyFile}`

// Pages can take a minute to serve a fresh deploy, so the key file gets a few tries.
async function keyIsLive() {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(keyLocation, { cache: 'no-store' }).catch(() => null)
    if (res?.ok && (await res.text()).trim() === key) return true
    await new Promise((r) => setTimeout(r, 20000))
  }
  return false
}

async function main() {
  if (!(await keyIsLive())) { console.log(`indexnow: the key file isn't live at ${keyLocation}, skipped`); return }
  let urls
  if (process.argv.includes('--all')) {
    const res = await fetch(`${SITE}sitemap.xml`)
    if (!res.ok) { console.log(`indexnow: sitemap ${res.status}, skipped`); return }
    urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  } else {
    // the posts by file name, drafts left out (the job runs without node_modules, so no marked)
    const postDir = path.join(ROOT, 'content', 'posts')
    const posts = fs.readdirSync(postDir).filter((f) => /^[a-z0-9-]+\.md$/.test(f) && !/^draft:\s*true\s*$/m.test(fs.readFileSync(path.join(postDir, f), 'utf8')))
    urls = [SITE, ...LANDINGS.map((l) => `${SITE}${l.slug}/`), `${SITE}games/`, `${SITE}games/at-risk/`, `${SITE}breakers/`, `${SITE}data/`, `${SITE}blog/`, ...posts.map((f) => `${SITE}blog/${f.slice(0, -3)}/`)]
  }
  urls = urls.filter((u) => u.startsWith(SITE))
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: config.domain, key, keyLocation, urlList }),
    })
    // 200 accepted, 202 accepted while the key is checked; 403 key not
    // valid, 422 a URL outside the key's scope, 429 too often
    console.log(`indexnow: ${urlList.length} URLs → ${res.status} ${res.statusText} ${(await res.text()).slice(0, 200)}`)
  }
}

main().catch((e) => console.log(`indexnow: ${e instanceof Error ? e.message : e}`))
