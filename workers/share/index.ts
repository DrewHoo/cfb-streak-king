// The share worker: sits on drewhoover.com/cfb-streak-king/* in front of
// GitHub Pages and rewrites <head> for URLs whose prerendered head can't be
// right — a definition board (?c=...&dir=...) or a matchup (?vs=...) — so a
// shared link unfurls with its own words. GitHub Pages serves one HTML for
// every query string; this is the piece that makes 24 million definitions
// each read as themselves.
//
// The words come from src/lib/shareWords.ts (pure) plus dist/share/meta.json
// (team names and the mascot/color tables, published by the prerender).
// Everything else — and anything that goes wrong — passes through untouched:
// this worker must never be the reason the site is down.

import { shareText } from '../../src/lib/shareWords.ts';
import type { ShareMeta } from '../../src/lib/shareWords.ts';

const ORIGIN = 'https://drewhoover.com';
const FALLBACK_META: ShareMeta = { site: 'College Football Streak King', teams: {}, mascots: [], colors: [] };

// static site data, cached per isolate; a failed load falls back and retries
// on the next request rather than poisoning the cache
let metaCache: ShareMeta | null = null;
async function loadMeta(): Promise<ShareMeta> {
  if (metaCache) return metaCache;
  const res = await fetch(`${ORIGIN}/cfb-streak-king/share/meta.json`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) { await res.body?.cancel(); return FALLBACK_META; }
  const meta = (await res.json()) as ShareMeta;
  if (!meta?.site || typeof meta.teams !== 'object') return FALLBACK_META;
  return (metaCache = meta);
}

const content = (text: string) => ({
  element(e: Element) { e.setAttribute('content', text); },
});

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // the origin is the zone itself: a same-zone subrequest skips the worker
    // and lands on GitHub Pages (and lets `wrangler dev` hit the live site)
    const res = await fetch(new Request(`${ORIGIN}${url.pathname}${url.search}`, request));
    try {
      if (request.method !== 'GET') return res;
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
      const text = shareText(url.pathname, url.searchParams, await loadMeta());
      if (!text) return res;
      return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(text.title); } })
        .on('meta[name="description"]', content(text.description))
        .on('meta[property="og:title"]', content(text.title))
        .on('meta[property="og:description"]', content(text.description))
        .on('meta[property="og:url"]', content(`${ORIGIN}${url.pathname}${url.search}`))
        .on('meta[name="twitter:title"]', content(text.title))
        .on('meta[name="twitter:description"]', content(text.description))
        .transform(res);
    } catch (e) {
      console.log(JSON.stringify({ event: 'share_rewrite_failed', url: url.pathname + url.search, error: String(e) }));
      return res;
    }
  },
} satisfies ExportedHandler;
