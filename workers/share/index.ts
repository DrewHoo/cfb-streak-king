// The share worker: sits on drewhoover.com/cfb-streak-king/* in front of
// GitHub Pages and makes a shared URL unfurl as itself. GitHub Pages serves
// one HTML for every query string; this is the piece that makes 24 million
// definitions each read as their own page.
//
//   <head> rewrite  a definition board (?c=...&dir=...) or a matchup
//                   (?vs=...) gets its own title, description and og tags,
//                   worded by src/lib/shareWords.ts (pure) plus
//                   dist/share/meta.json, published by the prerender.
//   /game/<date>/<teams>/ and /games/<season>/...
//                   an address the origin has no file for (a past season's
//                   game or schedule) is answered with the app shell
//                   (dist/404.html) as a 200 and, for a game, its own head
//                   from the season file (dist/games/<season>.json); a
//                   prerendered game page passes through with its card.
//   /share/og.png   the definition's board drawn on demand (card.ts): the
//                   worker fetches the payload the prerender publishes,
//                   runs the site's own createModel/boards, and renders the
//                   top of that board. Cached at the edge.
//
// Anything else — and anything that goes wrong — passes through untouched:
// this worker must never be the reason the site is down.

import { shareText, defWords, decodeRefs, gameFromShare, gameText } from '../../src/lib/shareWords.ts';
import type { GameRowWords } from '../../src/lib/shareWords.ts';
import type { ShareMeta } from '../../src/lib/shareWords.ts';
import { createModel } from '../../src/lib/createModel.ts';
import type { Payload, BoardRow, Dir } from '../../src/lib/types.ts';
import { dirWord, yy, siteWord, monthDay } from '../../src/lib/format.ts';
import { parseDir } from '../../src/lib/outcome.ts';
import { renderCard } from './card.ts';
import type { CardRow } from './card.ts';

const ORIGIN = 'https://drewhoover.com';
const BASE = '/cfb-streak-king';
// the committed payload, for the window between a worker deploy and the next Pages deploy
const RAW_PAYLOAD = 'https://raw.githubusercontent.com/DrewHoo/cfb-streak-king/main/src/data/payload.json';
const FALLBACK_META: ShareMeta = { site: 'College Football Streak King', teams: {}, mascots: [], colors: [] };
const DEFAULT_C = 'unranked'; // definition.ts DEFAULT_CHIPS, as the c param spells it

// Analytics: one Mixpanel event per link preview, sent server-side to the
// index site's project (the public token its embed carries; a project token
// only writes). The client embed never sees an unfurl, because the bot that
// fetches a shared link runs no script, so this is the only place a share
// can be counted. Nothing personal goes: the crawler's name, its user agent
// only when it is a crawler (a person's browser string never goes, and
// neither does an IP: ip=0 tells Mixpanel not to geolocate), the country
// Cloudflare saw, the URL itself and its words. A browser's visit is the
// embed's to count, so the head rewrite reports crawlers only; the card is
// reported whoever asked for it.
const MIXPANEL_TOKEN = '1c6a0f45b8a5768185a8d9a2f4d65452';
const AGENTS: [RegExp, string][] = [
  [/Slackbot|Slack-ImgProxy/i, 'slack'],
  [/Discordbot/i, 'discord'],
  [/TelegramBot/i, 'telegram'],
  [/WhatsApp/i, 'whatsapp'],
  [/LinkedInBot/i, 'linkedin'],
  [/redditbot/i, 'reddit'],
  [/Bluesky/i, 'bluesky'],
  [/Mastodon/i, 'mastodon'],
  [/Facebot.*Twitterbot|Twitterbot.*Facebot/i, 'imessage'],
  [/Twitterbot/i, 'twitter'],
  [/facebookexternalhit|Facebot/i, 'facebook'],
  [/Googlebot/i, 'google'],
  [/bingbot/i, 'bing'],
  [/Applebot/i, 'apple'],
  [/bot|crawler|spider|preview|fetch|embed|scraper/i, 'other-bot'],
];
const agentOf = (ua: string | null): string => AGENTS.find(([re]) => re.test(ua ?? ''))?.[1] ?? 'browser';

function report(ctx: ExecutionContext, request: Request, event: string, props: Record<string, unknown>) {
  try {
    const ua = request.headers.get('user-agent');
    const agent = agentOf(ua);
    const body = [{
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: `unfurl:${agent}`,
        $insert_id: crypto.randomUUID(),
        time: Math.floor(Date.now() / 1000),
        site: 'cfb-streak-king',
        agent,
        // the crawler's own string, so an unrecognized one ('other-bot') can
        // be named and added to AGENTS; a browser's string stays private
        crawler: agent === 'browser' ? null : (ua ?? '').slice(0, 200),
        country: (request as Request & { cf?: { country?: string } }).cf?.country ?? null,
        ...props,
      },
    }];
    ctx.waitUntil(fetch('https://api.mixpanel.com/track?ip=0', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/plain' },
      body: JSON.stringify(body),
    }).then((r) => r.body?.cancel()).catch(() => {}));
  } catch {}
}
/** The URL itself and its words, for an event: the definition, the outcome, the scope, the teams. */
const urlProps = (url: URL) => {
  const q = url.searchParams;
  const team = /\/team\/([a-z0-9-]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  return {
    // the shared link as one string, and under Mixpanel's own name so its UI
    // treats it as the event's URL
    url: url.href,
    $current_url: url.href,
    path: url.pathname.replace(BASE, '') || '/',
    chips: q.get('c'), dir: q.get('dir') ?? 'W', scope: q.get('scope') ?? 'all',
    team: q.get('t') ?? team, vs: q.get('vs'),
  };
};

/** Bump on any change to what the card draws or how a URL reads; it keys the edge cache. */
const CARD_VERSION = '2026-10-12b';

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
// the parsed model lives as long as the isolate does, but not past the day:
// the site rebuilds weekly, and a long-lived isolate must not keep last week
let modelCache: { day: string; model: Promise<Model> } | null = null;
function loadModel(): Promise<Model> {
  const day = dayKey();
  if (modelCache?.day !== day) {
    const model = (async () => {
      let res = await fetch(`${ORIGIN}${BASE}/share/payload.json?d=${day}`, edge(3600));
      if (!res.ok) { await res.body?.cancel(); res = await fetch(RAW_PAYLOAD, edge(3600)); }
      if (!res.ok) throw new Error(`payload ${res.status}`);
      return createModel((await res.json()) as Payload);
    })().catch((e) => { modelCache = null; throw e; });
    modelCache = { day, model };
  }
  return modelCache.model;
}

/** dist/share/weekly.json: the week cards' rows, as the prerender writes them. */
interface WeeklyRow { count: string; team: string; bad: boolean; claim: string; sub: string }
interface WeeklyCard { wk: number; lo: number; hi: number; ofNote?: number; rows: WeeklyRow[] }
interface StopperCard { season: number; name: string; n: number; points: number; rank: number; rows: WeeklyRow[] }
interface Weekly { builtAt: string; broken: Record<string, WeeklyCard>; atRisk: WeeklyCard | null; stoppers?: { season: number; rows: WeeklyRow[] }; stopper?: Record<string, StopperCard> }
let weeklyCache: { day: string; data: Promise<Weekly> } | null = null;
function loadWeekly(): Promise<Weekly> {
  const day = dayKey();
  if (weeklyCache?.day !== day) {
    const data = (async () => {
      const res = await fetch(`${ORIGIN}${BASE}/share/weekly.json?d=${day}`, edge(3600));
      if (!res.ok) { await res.body?.cancel(); throw new Error(`weekly ${res.status}`); }
      return (await res.json()) as Weekly;
    })().catch((e) => { weeklyCache = null; throw e; });
    weeklyCache = { day, data };
  }
  return weeklyCache.data;
}

/** dist/games/<season>.json: each game's rows, as seasonFile.ts encodes them (a crown row's fields by position). */
type SeasonCrown = [string, string, number, 0 | 1, number, number, number, number, number | null, number | null, 0 | 1, number, number, number, 0 | 1];
interface SeasonFile { season: number; games: Record<string, { ended: [number, SeasonCrown, number, number, number][]; leaders: [number, SeasonCrown, number, number | null][] }> }
const seasonCache = new Map<number, { day: string; data: Promise<SeasonFile | null> }>();
function loadSeason(season: number): Promise<SeasonFile | null> {
  const day = dayKey();
  const got = seasonCache.get(season);
  if (got?.day === day) return got.data;
  const data = (async () => {
    const res = await fetch(`${ORIGIN}${BASE}/games/${season}.json?d=${day}`, edge(3600));
    if (!res.ok) { await res.body?.cancel(); return null; }
    return (await res.json()) as SeasonFile;
  })().catch(() => { seasonCache.delete(season); return null; });
  seasonCache.set(season, { day, data });
  return data;
}
/** A game's rows from its season file (a January game belongs to the season before), as the words want them, ended runs first. */
async function gameRows(key: string, date: string): Promise<GameRowWords[]> {
  const m = await loadModel();
  const year = Number(date.slice(0, 4));
  const ids = m.teams.map((t) => t.id);
  for (const season of [year, year - 1]) {
    const file = await loadSeason(season);
    const g = file?.games[key];
    if (!g) continue;
    const row = (team: number, c: SeasonCrown, since: number, leader: boolean): GameRowWords => ({ team: ids[team], chips: c[0], dir: c[1], len: c[2], atEdge: !!c[3], rank: c[5], field: c[4], since, leader });
    // the full tellings only: a shorter telling (dup) stays off the head and the card
    return [...g.ended.filter(([, c]) => !c[14]).map(([t, c, since]) => row(t, c, since, false)), ...g.leaders.filter(([, c]) => !c[14]).map(([t, c, since]) => row(t, c, since, true))];
  }
  return [];
}
/** A played game's score from the model, from the home side; null when the game isn't in the payload. */
function gameScore(g: NonNullable<ReturnType<typeof gameFromShare>>, m: Model): { home: number; away: number } | null {
  const ep = Math.floor(Date.parse(g.date + 'T00:00:00Z') / 86400000);
  const home = m.teams.findIndex((t) => t.id === g.home), away = m.teams.findIndex((t) => t.id === g.away);
  for (const [ti, opp] of [[home, away], [away, home]]) {
    const row = m.gamesOf(ti).find((x) => x.ep === ep && x.oppIdx === opp);
    if (row) return ti === home ? { home: row.us, away: row.them } : { home: row.them, away: row.us };
  }
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (ep: number) => { const d = new Date(ep * 86400000); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const spanOf = (lo: number, hi: number) => (lo === hi ? md(lo) : `${md(lo)} – ${md(hi)}`);

/** A week card: the broken streaks of a completed week, or the running week's streaks most at risk. */
async function weekCard(kind: 'broken' | 'risk', wk: number): Promise<Response> {
  const [weekly, m] = await Promise.all([loadWeekly(), loadModel()]);
  const card = kind === 'risk' ? weekly.atRisk : weekly.broken[String(wk)];
  if (!card || (kind === 'risk' && card.wk !== wk)) throw new Error(`no ${kind} card for week ${wk}`);
  const byId = new Map(m.teams.map((t) => [t.id, t]));
  const rows: CardRow[] = [];
  for (const r of card.rows) {
    const t = byId.get(r.team);
    rows.push({ count: r.count, name: r.claim, sub: r.sub, bad: r.bad, live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?' });
  }
  const res = renderCard({
    heading: kind === 'risk' ? `Week ${card.wk} at-risk streaks` : `Streaks broken · Week ${card.wk}`,
    words: kind === 'risk' ? `${spanOf(card.lo, card.hi)} · by what the game can take away` : `${spanOf(card.lo, card.hi)} · ${card.ofNote ?? rows.length} of note`,
    rows,
    dense: true,
    footer: `${m.firstSeason}–${m.P.currentSeason} · ${m.P.games.se.length.toLocaleString('en-US')} games · drewhoover.com`,
  });
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
}

/** The streak-stoppers card: the leaderboard's top, or one team's own stopped streaks. */
async function stopperCard(id: string | null): Promise<Response> {
  const [weekly, m] = await Promise.all([loadWeekly(), loadModel()]);
  const card = id ? weekly.stopper?.[id] : weekly.stoppers;
  if (!card) throw new Error(`no stoppers card${id ? ` for ${id}` : ''}`);
  const byId = new Map(m.teams.map((t) => [t.id, t]));
  const rows: CardRow[] = [];
  for (const r of card.rows) {
    const t = byId.get(r.team);
    rows.push({ count: r.count, name: r.claim, sub: r.sub, bad: r.bad, live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?' });
  }
  const own = id ? (card as StopperCard) : null;
  const res = renderCard({
    heading: own ? `Streaks ${own.name} stopped · ${own.season}` : `Top Streak-Stoppers · ${card.season}`,
    words: own ? `${own.n} ended by winning · ${own.points} points · #${own.rank} among stoppers` : 'streaks broken by winning the game · points by what the run was',
    rows,
    dense: true,
    footer: `${m.firstSeason}–${m.P.currentSeason} · ${m.P.games.se.length.toLocaleString('en-US')} games · drewhoover.com`,
  });
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
}

/** A game card: the streaks the game ended and the leaders it made, from the season file. */
async function gameCard(key: string): Promise<Response> {
  const m = await loadModel();
  const g = gameFromShare(`/game/${key}/`, await loadMeta());
  if (!g) throw new Error(`no game at ${key}`);
  const rows = await gameRows(key, g.date);
  const byId = new Map(m.teams.map((t) => [t.id, t]));
  const score = gameScore(g, m);
  const meta = await loadMeta();
  const cards: CardRow[] = [];
  for (const r of rows.slice(0, 7)) {
    const t = byId.get(r.team);
    const w = (defWords(r.chips || 'all', meta) ?? []).join(' · ');
    const verb = r.leader ? 'now leads' : ({ W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' } as Record<string, string>)[r.dir[0]] ?? 'had won';
    cards.push({
      count: `${r.len}${r.atEdge ? '+' : ''}`, name: `${t?.name ?? r.team} ${verb}${r.leader ? ':' : ''} ${r.len}${r.atEdge ? '+' : ''} straight${w ? ` ${w}` : ''}`,
      sub: r.leader ? `sole leader of ${r.field} · since ${r.since}` : `was ${r.rank === 1 ? '1st' : `${r.rank}th`} of ${r.field} · since ${r.since}`,
      bad: r.dir[0] === 'L' || r.dir[0] === 'N', live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?',
    });
  }
  const away = meta.teams[g.away], home = meta.teams[g.home];
  const res = renderCard({
    heading: score ? `${score.home > score.away ? `${home} ${score.home}, ${away} ${score.away}` : `${away} ${score.away}, ${home} ${score.home}`}` : `${away} ${g.neutral ? 'vs' : 'at'} ${home}`,
    words: `${g.date} · ${rows.some((r) => !r.leader) ? 'the streaks it ended' : 'what it put on the line'}`,
    rows: cards,
    dense: true,
    footer: `${m.firstSeason}–${m.P.currentSeason} · ${m.P.games.se.length.toLocaleString('en-US')} games · drewhoover.com`,
  });
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
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
    // a live run's next qualifying game, when one is scheduled
    const nx = live && r.next ? r.next : null;
    cardRows.push({
      count: `${r.s.len}${r.s.atEdge ? '+' : ''}`,
      name: m.teams[r.ti].name,
      span: live ? `since ${yy(startEp)}` : `${yy(startEp)}–${yy(endEp)}`,
      live,
      logo: await logoUri(m.teams[r.ti].espn),
      initial: m.teams[r.ti].name[0] ?? '?',
      next: nx ? { word: siteWord(nx), logo: await logoUri(m.teams[nx.oppIdx]?.espn), initial: m.teams[nx.oppIdx]?.name[0] ?? '?', date: monthDay(nx.ep) } : null,
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

    // the dynamic card, cached at the edge under this deploy's version, so a
    // card an older worker drew for the same URL (one that didn't know a new
    // outcome, say) can't outlive the deploy that taught it
    if (url.pathname === `${BASE}/share/og.png`) {
      try {
        const key = new Request(`${url.origin}${url.pathname}?v=${CARD_VERSION}&${url.searchParams}`, { method: 'GET' });
        const cached = await caches.default.match(key);
        const week = url.searchParams.get('broken') ?? url.searchParams.get('risk');
        const game = url.searchParams.get('game');
        const stopper = url.searchParams.get('stopper');
        const stoppers = url.searchParams.has('stoppers') || (stopper != null && /^[a-z0-9-]+$/.test(stopper));
        report(ctx, request, 'share card', { ...urlProps(url), cached: !!cached, kind: game ? 'game' : stoppers ? 'stoppers' : url.searchParams.has('risk') ? 'risk' : url.searchParams.has('broken') ? 'broken' : 'board' });
        if (cached) return cached;
        const res = game
          ? await gameCard(game)
          : stoppers
            ? await stopperCard(stopper)
            : week != null && /^\d{1,2}$/.test(week)
            ? await weekCard(url.searchParams.has('risk') ? 'risk' : 'broken', Number(week))
            : await ogCard(url.searchParams);
        ctx.waitUntil(caches.default.put(key, res.clone()));
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
    let res = await fetch(new Request(`${ORIGIN}${url.pathname}${url.search}`, request));
    try {
      if (request.method !== 'GET') return res;
      // a game or a past season's schedule the build didn't prerender: the
      // shell, as a 200, and for a game its own head and card
      const meta = await loadMeta();
      const game = gameFromShare(url.pathname, meta);
      const pastSeason = /\/games\/\d{4}(\/week\/\d{1,2})?\/?$/.test(url.pathname);
      if (res.status === 404 && (game || pastSeason)) {
        await res.body?.cancel();
        const shell = await fetch(`${ORIGIN}${BASE}/404.html?d=${dayKey()}`, edge(3600));
        if (!shell.ok) { await shell.body?.cancel(); return new Response('not found', { status: 404 }); }
        res = new Response(shell.body, { status: 200, headers: shell.headers });
        if (agentOf(request.headers.get('user-agent')) !== 'browser') report(ctx, request, 'share unfurl', urlProps(url));
        const text = game
          ? gameText(game, meta, gameScore(game, await loadModel()), await gameRows(game.key, game.date))
          : { title: `${/\d{4}/.exec(url.pathname)![0]} games · ${meta.site}`, description: `Every game with a current FBS team that season, and the streaks each ended.` };
        const img = game ? `${ORIGIN}${BASE}/share/og.png?game=${encodeURIComponent(game.key)}` : `${ORIGIN}${BASE}/og.png`;
        return new HTMLRewriter()
          .on('title', { element(e) { e.setInnerContent(text.title); } })
          .on('meta[name="description"]', content(text.description))
          .on('meta[property="og:title"]', content(text.title))
          .on('meta[property="og:description"]', content(text.description))
          .on('meta[property="og:url"]', content(`${ORIGIN}${url.pathname}`))
          .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', `${ORIGIN}${url.pathname}`); } })
          .on('meta[property="og:image"]', content(img))
          .on('meta[name="twitter:image"]', content(img))
          .on('meta[name="twitter:title"]', content(text.title))
          .on('meta[name="twitter:description"]', content(text.description))
          .transform(res);
      }
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
      const text = shareText(url.pathname, url.searchParams, meta);
      if (!text) return res;
      if (agentOf(request.headers.get('user-agent')) !== 'browser') report(ctx, request, 'share unfurl', urlProps(url));
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
