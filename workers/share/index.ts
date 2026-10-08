// The share worker: sits on drewhoover.com/cfb-streak-king/* in front of
// GitHub Pages and makes a shared URL unfurl as itself. GitHub Pages serves
// one HTML for every query string; this is the piece that makes 24 million
// definitions each read as their own page.
//
//   <head> rewrite  a definition board (?c=...&dir=...) or a matchup
//                   (?vs=...) gets its own title, description and og tags,
//                   worded by src/lib/shareWords.ts (pure) plus
//                   dist/share/meta.json, published by the prerender.
//   /share/og.png   the definition's board drawn on demand (card.ts): the
//                   worker fetches the payload the prerender publishes,
//                   runs the site's own createModel/boards, and renders the
//                   top of that board. Cached at the edge.
//
// Anything else — and anything that goes wrong — passes through untouched:
// this worker must never be the reason the site is down.

import { shareText, defWords, decodeRefs } from '../../src/lib/shareWords.ts';
import type { ShareMeta } from '../../src/lib/shareWords.ts';
import { createModel } from '../../src/lib/createModel.ts';
import type { Payload, BoardRow, Dir } from '../../src/lib/types.ts';
import { dirWord, yy } from '../../src/lib/format.ts';
import { parseDir } from '../../src/lib/outcome.ts';
import { renderCard } from './card.ts';
import type { CardRow } from './card.ts';

const ORIGIN = 'https://drewhoover.com';
const BASE = '/cfb-streak-king';
// the committed payload, for the window between a worker deploy and the next Pages deploy
const RAW_PAYLOAD = 'https://raw.githubusercontent.com/DrewHoo/cfb-streak-king/main/src/data/payload.json';
const FALLBACK_META: ShareMeta = { site: 'College Football Streak King', teams: {}, mascots: [], colors: [] };
const DEFAULT_C = 'unranked'; // definition.ts DEFAULT_CHIPS, as the c param spells it

const edge = (ttl: number) => ({ cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '400-599': 30 } } }) as RequestInit;
// a fresh cache key each UTC day: GitHub Pages ignores query strings, and a
// 404 cached before a Pages deploy must not outlive the day it happened on
const dayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

// static site data, cached per isolate; a failed load falls back and retries
// on the next request rather than poisoning the cache
let metaCache: ShareMeta | null = null;
async function loadMeta(): Promise<ShareMeta> {
  if (metaCache) return metaCache;
  const res = await fetch(`${ORIGIN}${BASE}/share/meta.json?d=${dayKey()}`, edge(3600));
  if (!res.ok) { await res.body?.cancel(); return FALLBACK_META; }
  const meta = (await res.json()) as ShareMeta;
  if (!meta?.site || typeof meta.teams !== 'object') return FALLBACK_META;
  return (metaCache = meta);
}

type Model = ReturnType<typeof createModel>;
let modelCache: Promise<Model> | null = null;
function loadModel(): Promise<Model> {
  return (modelCache ??= (async () => {
    let res = await fetch(`${ORIGIN}${BASE}/share/payload.json?d=${dayKey()}`, edge(3600));
    if (!res.ok) { await res.body?.cancel(); res = await fetch(RAW_PAYLOAD, edge(3600)); }
    if (!res.ok) throw new Error(`payload ${res.status}`);
    return createModel((await res.json()) as Payload);
  })().catch((e) => { modelCache = null; throw e; }));
}

async function logoUri(espn: string | null | undefined): Promise<string | null> {
  if (!espn) return null;
  try {
    const res = await fetch(`${ORIGIN}${BASE}/logos-color/${espn}.png`, edge(86400));
    if (!res.ok) { await res.body?.cancel(); return null; }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:image/png;base64,${btoa(bin)}`;
  } catch { return null; }
}

/** The board card for a definition URL's og image. */
async function ogCard(q: URLSearchParams): Promise<Response> {
  const m = await loadModel();
  const tables = { teamIds: m.teams.map((t) => t.id), mascots: m.P.mascots ?? [], colors: m.P.colors ?? [] };
  const refs = decodeRefs(q.get('c'), tables) ?? decodeRefs(DEFAULT_C, tables)!;
  const dir: Dir = parseDir(q.get('dir')) ?? 'W';
  const scope = q.get('scope') === 'active' ? 'active' : 'all';
  const todayEp = Math.floor(Date.now() / 86400000);
  const rows = (scope === 'all' ? m.allTimeBoard(refs, dir, todayEp) : m.activeBoard(refs, dir, todayEp)).slice(0, 6);
  const meta: ShareMeta = { site: '', teams: {}, mascots: tables.mascots, colors: tables.colors };
  for (const t of m.teams) if (t.major) meta.teams[t.id] = t.name;
  const words = defWords(q.get('c') ?? DEFAULT_C, meta) ?? [];
  const cardRows: CardRow[] = [];
  for (const r of rows as BoardRow[]) {
    const live = scope === 'active' || !!r.live;
    const startEp = r.s.start?.ep ?? r.qual[r.qual.length - r.s.len].ep;
    const endEp = r.s.end?.ep ?? r.s.last.ep;
    cardRows.push({
      count: `${r.s.len}${r.s.atEdge ? '+' : ''}`,
      name: m.teams[r.ti].name,
      span: live ? `since ${yy(startEp)} · live` : `${yy(startEp)}–${yy(endEp)}`,
      live,
      logo: await logoUri(m.teams[r.ti].espn),
      initial: m.teams[r.ti].name[0] ?? '?',
    });
  }
  const res = renderCard({
    heading: `Longest ${scope === 'all' ? 'all-time' : 'active'} ${dirWord(dir)} streaks`,
    words: words.length ? words.join(' · ') : 'all games, no conditions',
    rows: cardRows,
    footer: `${m.firstSeason}–${m.P.currentSeason} · ${m.P.games.se.length.toLocaleString('en-US')} games · drewhoover.com`,
  });
  // buffer the render: workers-og streams lazily, and a failure mid-stream
  // would otherwise ship a 200 with an empty body
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' },
  });
}

/** The og image URL for a board URL, from its own params, in one stable order. */
function ogImageUrl(q: URLSearchParams): string {
  const out = new URLSearchParams();
  if (q.get('c') != null) out.set('c', q.get('c')!);
  const d = parseDir(q.get('dir'));
  if (d && d !== 'W') out.set('dir', d);
  if (q.get('scope') === 'active') out.set('scope', 'active');
  const s = out.toString();
  return `${ORIGIN}${BASE}/share/og.png${s ? `?${s}` : ''}`;
}

const content = (text: string) => ({
  element(e: Element) { e.setAttribute('content', text); },
});

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // the dynamic card, cached at the edge
    if (url.pathname === `${BASE}/share/og.png`) {
      try {
        const cached = await caches.default.match(request);
        if (cached) return cached;
        const res = await ogCard(url.searchParams);
        ctx.waitUntil(caches.default.put(request, res.clone()));
        return res;
      } catch (e) {
        console.log(JSON.stringify({ event: 'og_render_failed', url: url.search, error: String((e as Error)?.stack ?? e) }));
        // the committed board image, so a share still carries something
        return Response.redirect(`${ORIGIN}${BASE}/og.png`, 302);
      }
    }

    // everything else: origin, with <head> rewritten where the URL says more
    // than the prerendered page could. A same-zone subrequest skips the
    // worker and lands on GitHub Pages (and lets `wrangler dev` hit the live site).
    const res = await fetch(new Request(`${ORIGIN}${url.pathname}${url.search}`, request));
    try {
      if (request.method !== 'GET') return res;
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
      const text = shareText(url.pathname, url.searchParams, await loadMeta());
      if (!text) return res;
      const board = !/\/team\//.test(url.pathname);
      let out = new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(text.title); } })
        .on('meta[name="description"]', content(text.description))
        .on('meta[property="og:title"]', content(text.title))
        .on('meta[property="og:description"]', content(text.description))
        .on('meta[property="og:url"]', content(`${ORIGIN}${url.pathname}${url.search}`))
        .on('meta[name="twitter:title"]', content(text.title))
        .on('meta[name="twitter:description"]', content(text.description));
      if (board) {
        const img = ogImageUrl(url.searchParams);
        out = out
          .on('meta[property="og:image"]', content(img))
          .on('meta[name="twitter:image"]', content(img))
          .on('meta[property="og:image:alt"]', content(`${text.title}, on a dark leaderboard.`));
      }
      return out.transform(res);
    } catch (e) {
      console.log(JSON.stringify({ event: 'share_rewrite_failed', url: url.pathname + url.search, error: String(e) }));
      return res;
    }
  },
} satisfies ExportedHandler;
