// The share worker: sits on drewhoover.com/cfb-streak-king/* in front of
// GitHub Pages and makes a shared URL unfurl as itself. GitHub Pages serves
// one HTML for every query string; this is the piece that makes 24 million
// definitions each read as their own page.
//
//   <head> rewrite  a definition board (?c=...&dir=...) or a matchup
//                   (?vs=...) gets its own title, description and og tags,
//                   worded by src/lib/shareWords.ts (pure) plus
//                   dist/share/meta.json, published by the prerender.
//   /game/<date>/<teams>/, /games/<season>/..., /breakers/<season>/...
//                   an address the origin has no file for (a past season's
//                   game or streak-breakers; a past season's schedule is
//                   prerendered, so that branch is a fallback) is answered
//                   with the app shell (dist/404.html) as a 200 and its own
//                   head, JSON-LD and, for a game or a season's
//                   streak-breakers, card from the season file
//                   (dist/games/<season>.json); a prerendered page passes
//                   through with its card. A named definition's page
//                   (/longest-home-win-streaks/, landing.ts) is prerendered;
//                   a panel open on one (?t=) is worded from its definition.
//   /share/og.png   the definition's board drawn on demand (card.ts): the
//                   worker fetches the payload the prerender publishes,
//                   runs the site's own createModel/boards, and renders the
//                   top of that board. Cached at the edge.
//
// Anything else — and anything that goes wrong — passes through untouched:
// this worker must never be the reason the site is down.

import { shareText, defWords, decodeRefs, gameFromShare, gameText, rowWords, teamName, pastWeekText, isTriviaBoard, streaksWord } from '../../src/lib/shareWords.ts';
import { landingFromPath } from '../../src/lib/landing.ts';
import { asFromPath } from '../../src/lib/asTeam.ts';
import type { GameRowWords } from '../../src/lib/shareWords.ts';
import type { ShareMeta } from '../../src/lib/shareWords.ts';
import { createModel } from '../../src/lib/createModel.ts';
import type { Payload, BoardRow, Dir } from '../../src/lib/types.ts';
import { dirWord, yy, siteWord, monthDay } from '../../src/lib/format.ts';
import { parseDir } from '../../src/lib/outcome.ts';
import { BREAK, breakCat, breakPoints, rankOrder } from '../../src/lib/breakScore.ts';
import { isTrivia } from '../../src/lib/trivia.ts';
import { renderCard } from './card.ts';
import type { CardRow } from './card.ts';

// Set per request from the deploy's vars: `npm run worker:dev` points it at a
// local vite preview (ORIGIN) and silences the analytics (NO_REPORT); the
// deployed worker has neither, so it reads the live site and reports.
interface Env { ORIGIN?: string; NO_REPORT?: string }
let ORIGIN = 'https://drewhoover.com';
const BASE = '/cfb-streak-king';
// the committed payload, for the window between a worker deploy and the next Pages deploy
const RAW_PAYLOAD = 'https://raw.githubusercontent.com/DrewHoo/cfb-streak-king/main/src/data/payload.json';
const FALLBACK_META: ShareMeta = { site: 'College Football Streak King', teams: {}, mascots: [], colors: [] };
const DEFAULT_C = 'unranked'; // definition.ts DEFAULT_CHIPS, as the c param spells it

// Analytics: one Mixpanel event per link preview, sent server-side to the
// index site's project (the public token its embed carries; a project token
// only writes). The client embed never sees an unfurl, because the bot that
// fetches a shared link runs no script, so this is the only place a share
// can be counted. Nothing personal goes: the unfurler's name and user agent
// (never an IP: ip=0 tells Mixpanel not to geolocate), the country Cloudflare
// saw, the URL itself and its words. Only a link preview reports, the page or
// its card: a search engine, an AI crawler or any other bot sends nothing,
// and a browser's visit is the embed's to count (Drew, 2026-10-26: crawlers
// were showing up as shares).
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
  [/GoogleMessages/i, 'google-messages'],
  [/Facebot.*Twitterbot|Twitterbot.*Facebot/i, 'imessage'],
  [/Twitterbot/i, 'twitter'],
  [/facebookexternalhit|Facebot/i, 'facebook'],
  [/Googlebot/i, 'google'],
  [/bingbot/i, 'bing'],
  [/Applebot/i, 'apple'],
  [/bot|crawler|spider|preview|fetch|embed|scraper/i, 'other-bot'],
];
const agentOf = (ua: string | null): string => AGENTS.find(([re]) => re.test(ua ?? ''))?.[1] ?? 'browser';
const PREVIEWS = new Set(['slack', 'discord', 'telegram', 'whatsapp', 'linkedin', 'reddit', 'bluesky', 'mastodon', 'google-messages', 'imessage', 'twitter', 'facebook']);

/** Reports a link preview's request; a browser's or a crawler's reports nothing. */
function report(env: Env, ctx: ExecutionContext, request: Request, event: string, props: Record<string, unknown>) {
  if (env.NO_REPORT) return; // a local run never reaches the project
  try {
    const ua = request.headers.get('user-agent');
    const agent = agentOf(ua);
    if (!PREVIEWS.has(agent)) return;
    const body = [{
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: `unfurl:${agent}`,
        $insert_id: crypto.randomUUID(),
        time: Math.floor(Date.now() / 1000),
        site: 'cfb-streak-king',
        agent,
        crawler: (ua ?? '').slice(0, 200),
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
  // a named definition's path says the definition; a by-opponent page's says the team and the outcome
  const landing = landingFromPath(url.pathname);
  const asPage = asFromPath(url.pathname);
  return {
    // the shared link as one string, and under Mixpanel's own name so its UI
    // treats it as the event's URL
    url: url.href,
    $current_url: url.href,
    path: url.pathname.replace(BASE, '') || '/',
    chips: q.get('c') ?? landing?.c ?? null, dir: q.get('dir') ?? asPage?.dir ?? landing?.dir ?? 'W', scope: q.get('scope') ?? landing?.scope ?? 'all',
    team: q.get('t') ?? team, vs: q.get('vs'), as: q.get('as') ?? asPage?.id ?? null,
  };
};

/** Bump on any change to what the card draws or how a URL reads; it keys the edge cache. */
const CARD_VERSION = '2026-10-25a';

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
/** A card row; `vs` is a leaderboard row's whose-streaks chips, [team id, count]. */
interface WeeklyRow { count: string; team: string; bad: boolean; claim: string; sub: string; vs?: [string, number][] }
/** `total` is every row the digest holds (list and more), what the card's rows are the top of. */
interface WeeklyCard { wk: number; lo: number; hi: number; ofNote?: number; total?: number; rows: WeeklyRow[] }
interface BreakerCard { season: number; name: string; n: number; rank: number; rows: WeeklyRow[] }
interface Weekly { builtAt: string; broken: Record<string, WeeklyCard>; atRisk: WeeklyCard | null; breakers?: { season: number; teams?: number; rows: WeeklyRow[] }; breaker?: Record<string, BreakerCard> }
const fmtN = (n: number) => n.toLocaleString('en-US');
/** "+134 more broken", or nothing when the rows are all there is. */
const moreLine = (total: number | undefined, shown: number, word: string) => (total != null && total > shown ? `+${fmtN(total - shown)} more ${word}` : null);
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
// a run as the files carry it (crownsFile.ts CrownRow): [chips, dir, len, unsure, field, rank, tied, second, startSe, endSe, live, also, p, n, hT, nT, gT, rivals, highest placing or 0]; the worker reads the first seven
type SeasonCrown = [string, string, number, 0 | 1, number, number, number, number, number | null, number | null, 0 | 1, number, number, number, number, number, number, number, unknown];
interface SeasonFile { season: number; games: Record<string, { ended: [number, SeasonCrown, number, number, number, number?, number?][]; leaders: [number, SeasonCrown, number, number | null][] }> }
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
    const row = (team: number, c: SeasonCrown, since: number, leader: boolean, everLen?: number, everN?: number): GameRowWords => ({ team: ids[team], chips: c[0], dir: c[1], len: c[2], unsure: !!c[3], rank: c[5], tied: c[6], field: c[4], since, leader, everLen, everN });
    // the full placings only: a sub-streak (subStreak) stays off the head and the card, and so does a trivia streak (trivia.ts), as on the page
    const simple = <T extends [number, SeasonCrown, ...unknown[]]>(r: T) => !isTrivia({ chips: r[1][0] ? r[1][0].split('+') : [], dir: r[1][1] as Dir });
    return [...g.ended.filter((r) => simple(r) && !isSubStreakRow(g.ended, r)).map(([t, c, since, , , everLen, everN]) => row(t, c, since, false, everLen, everN)), ...g.leaders.filter((r) => simple(r) && !isSubStreakRow(g.leaders, r)).map(([t, c, since]) => row(t, c, since, true))];
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
    words: card.total != null
      ? `${spanOf(card.lo, card.hi)} · ${fmtN(card.total)} streak${card.total === 1 ? '' : 's'} ${kind === 'risk' ? 'at stake' : 'broken'}`
      : kind === 'risk' ? `${spanOf(card.lo, card.hi)} · by what the game can take away` : `${spanOf(card.lo, card.hi)} · ${card.ofNote ?? rows.length} of note`,
    rows,
    more: moreLine(card.total, rows.length, kind === 'risk' ? 'at stake' : 'broken'),
    dense: true,
    footer: `${m.firstSeason}–${m.P.currentSeason} · ${m.P.games.se.length.toLocaleString('en-US')} games · drewhoover.com`,
  });
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
}

/**
 * A sub-streak among a game's rows (list.ts isSubStreak, on the file's
 * tuples [team, crown, since, ...]): the same team's run of the same
 * outcome, at least as long, under a strict subset of its conditions,
 * unless it started first. The file carries no subStreak flag: the page's list
 * rule sets it, and the worker does the same here.
 */
function isSubStreakRow(rows: readonly [number, SeasonCrown, number, ...unknown[]][], r: readonly [number, SeasonCrown, number, ...unknown[]]): boolean {
  const chips = r[1][0] ? r[1][0].split('+') : [];
  return rows.some((o) => o !== r && o[0] === r[0] && o[1][1] === r[1][1] && o[1][2] >= r[1][2]
    && (o[1][0] ? o[1][0].split('+') : []).length < chips.length && (o[1][0] ? o[1][0].split('+') : []).every((k) => chips.includes(k))
    && !(r[2] < o[2]));
}

/** One break of a past season, as the cards and the head word it; `score` orders within a category (the run's length: the file carries no score). */
interface PastBreak { victim: number; row: GameRowWords; cat: 'alltime' | 'leading'; score: number; ender: string }
/** A team that broke a streak that season: its standing breaks, the most placing first, and its place. */
interface PastBreaker { ti: number; n: number; points: number; alltime: number; leading: number; victims: [number, number][]; breaks: PastBreak[]; rank: number }
const pastCache = new Map<number, { day: string; data: Promise<PastBreaker[]> }>();
/**
 * A past season's streak-breakers from its season file, scored the way
 * breakers.ts scores them (breakScore.ts): a winning run ended by a loss to
 * the breaker, the full placings only and no trivia streak, ranked by points then breaks.
 */
function pastBreakers(se: number): Promise<PastBreaker[]> {
  const day = dayKey();
  const got = pastCache.get(se);
  if (got?.day === day) return got.data;
  const data = (async () => {
    const [file, m] = await Promise.all([loadSeason(se), loadModel()]);
    if (!file) return [];
    const ids = m.teams.map((t) => t.id);
    const by = new Map<number, PastBreaker>();
    for (const g of Object.values(file.games)) {
      for (const row of g.ended) {
        const [ti, c, since, enderI, , everLen, everN] = row;
        if (isSubStreakRow(g.ended, row)) continue;
        const dir = c[1];
        const chips = c[0] ? c[0].split('+') : [];
        if (isTrivia({ chips, dir: dir as Dir })) continue; // trivia is off the breakers board (trivia.ts)
        const b = { len: c[2], everLen: everLen ?? 0, rank: c[5], chips };
        const cat = breakCat(b);
        if (!cat) continue;
        const ender = m.gamesOf(ti).find((x) => x.i === enderI);
        if (!ender) continue;
        const win = dir[0] === 'W' && ender.r === 'L';
        const cover = BREAK.covers && dir === 'C' && ender.cover === 'L';
        if (!win && !cover) continue;
        const opp = ender.oppIdx;
        const s = by.get(opp) ?? { ti: opp, n: 0, points: 0, alltime: 0, leading: 0, victims: [], breaks: [], rank: 0 };
        by.set(opp, s);
        s.n++;
        s.points += breakPoints(b);
        s[cat]++;
        const v = s.victims.find(([x]) => x === ti);
        if (v) v[1]++; else s.victims.push([ti, 1]);
        const name = m.teams[opp]?.name ?? '?';
        s.breaks.push({
          victim: ti, cat, score: c[2],
          row: { team: ids[ti], chips: c[0], dir, len: c[2], unsure: !!c[3], rank: c[5], tied: c[6], field: c[4], since, everLen, everN },
          ender: win ? `lost to ${name} ${ender.them}–${ender.us}` : `didn’t cover vs ${name}`,
        });
      }
    }
    const out = [...by.values()].sort(rankOrder);
    out.forEach((s, i) => {
      s.rank = i + 1;
      s.victims.sort((a, b) => b[1] - a[1] || (m.teams[a[0]]?.name ?? '').localeCompare(m.teams[b[0]]?.name ?? ''));
      s.breaks.sort((a, b) => (a.cat === b.cat ? 0 : a.cat === 'alltime' ? -1 : 1) || b.score - a.score || b.row.len - a.row.len);
    });
    return out;
  })().catch(() => { pastCache.delete(se); return [] as PastBreaker[]; });
  pastCache.set(se, { day, data });
  return data;
}

/** A past season's head: the leaderboard's top three, or one team's count and place. */
async function pastBreakersText(se: number, id: string | null, meta: ShareMeta): Promise<{ title: string; description: string }> {
  const [list, m] = await Promise.all([pastBreakers(se), loadModel()]);
  const ti = id ? m.teams.findIndex((t) => t.id === id) : -1;
  const own = ti >= 0 ? list.find((s) => s.ti === ti) : null;
  if (id) {
    const name = meta.teams[id] ?? m.teams[ti]?.name ?? id;
    return {
      title: `Streaks ${name} broke in ${se} · ${meta.site}`,
      description: own
        ? `${name} ended ${fmtN(own.n)} longest active or all-time longest streak${own.n === 1 ? '' : 's'} by winning in ${se}, Streak King Rank #${own.rank}.`
        : `${name} didn’t break a streak in ${se}.`,
    };
  }
  const top = list.slice(0, 3).map((s) => `${s.rank}. ${m.teams[s.ti]?.name} (${s.n})`).join(', ');
  return {
    title: `Top Streak-Breakers ${se} · ${meta.site}`,
    description: top
      ? `The college football teams that broke the biggest streaks in ${se}, by Streak King Rank: ${top}. Every longest active or all-time longest streak a team ended by beating its owner.`
      : `The college football teams that broke the biggest streaks in ${se}.`,
  };
}

/** A past season's card: the leaderboard's top, or one team's own broken streaks. */
async function pastBreakerCard(id: string | null, se: number): Promise<Response> {
  const [list, m, meta] = await Promise.all([pastBreakers(se), loadModel(), loadMeta()]);
  const byIdx = (ti: number) => m.teams[ti];
  const rows: CardRow[] = [];
  const ti = id ? m.teams.findIndex((t) => t.id === id) : -1;
  const own = id ? list.find((s) => s.ti === ti) ?? null : null;
  if (id && !own) throw new Error(`no breaks for ${id} in ${se}`);
  if (own) {
    for (const b of own.breaks.slice(0, 7)) {
      const t = byIdx(b.victim);
      rows.push({ count: `${b.row.len}${b.row.unsure ? '†' : ''}`, name: `${t?.name ?? '?'} had won ${rowWords(b.row, meta)}`, sub: `${ledeOf(b.row)} · since ${b.row.since} · ${b.ender}`, bad: false, live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?' });
    }
  } else {
    for (const s of list.slice(0, 7)) {
      const t = byIdx(s.ti);
      const chips = [];
      for (const [v, n] of s.victims.slice(0, 4)) chips.push({ logo: await logoUri(byIdx(v)?.espn), initial: byIdx(v)?.name[0] ?? '?', n });
      rows.push({ count: String(s.n), name: `${s.rank}. ${t?.name ?? '?'}`, sub: `${s.alltime} all-time · ${s.leading} longest active`, bad: false, live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?', chips });
    }
  }
  const lead = own ? byIdx(own.ti) : null;
  const res = renderCard({
    heading: own ? `Streaks ${lead?.name} broke · ${se}` : `Top Streak-Breakers · ${se}`,
    words: own ? `${fmtN(own.n)} streak${own.n === 1 ? '' : 's'} broken by winning · Streak King Rank #${own.rank}` : 'longest active and all-time longest streaks, broken by winning the game',
    logo: lead ? await logoUri(lead.espn) : null,
    rows,
    more: own ? moreLine(own.n, rows.length, 'broken') : moreLine(list.length, rows.length, 'teams'),
    dense: true,
    footer: `${se} · definitions of up to two conditions · drewhoover.com`,
  });
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
}

/** The streak-breakers card: the leaderboard's top, or one team's own broken streaks; a past season's worked out from its season file. */
async function breakerCard(id: string | null, se: number | null = null): Promise<Response> {
  const [weekly, m] = await Promise.all([loadWeekly(), loadModel()]);
  if (se != null && se !== m.P.currentSeason) return pastBreakerCard(id, se);
  const card = id ? weekly.breaker?.[id] : weekly.breakers;
  if (!card) throw new Error(`no breakers card${id ? ` for ${id}` : ''}`);
  const byId = new Map(m.teams.map((t) => [t.id, t]));
  const rows: CardRow[] = [];
  for (const r of card.rows) {
    const t = byId.get(r.team);
    const chips = [];
    for (const [v, n] of r.vs ?? []) {
      const vt = byId.get(v);
      chips.push({ logo: await logoUri(vt?.espn), initial: vt?.name[0] ?? '?', n });
    }
    rows.push({ count: r.count, name: r.claim, sub: r.sub, bad: r.bad, live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?', chips });
  }
  const own = id ? (card as BreakerCard) : null;
  const lead = id ? byId.get(id) : null;
  const teamsN = own ? null : (card as Weekly['breakers'])?.teams;
  const res = renderCard({
    heading: own ? `Streaks ${own.name} broke · ${own.season}` : `Top Streak-Breakers · ${card.season}`,
    words: own ? `${fmtN(own.n)} streak${own.n === 1 ? '' : 's'} broken by winning · Streak King Rank #${own.rank}` : 'all-time longest and longest active streaks, broken by winning the game',
    logo: lead ? await logoUri(lead.espn) : null,
    rows,
    more: own ? moreLine(own.n, rows.length, 'broken') : moreLine(teamsN ?? undefined, rows.length, 'teams'),
    dense: true,
    footer: `${m.firstSeason}–${m.P.currentSeason} · ${m.P.games.se.length.toLocaleString('en-US')} games · drewhoover.com`,
  });
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
}

/** What an ended run was, as BrokenRow.jsx words it: the all-time longest, else the active field's leader. */
const ledeOf = (r: GameRowWords) => (r.everLen != null && r.len >= r.everLen
  ? ((r.everN ?? 1) > 1 ? 'now tied for the all-time longest' : 'now the all-time longest streak')
  : (r.tied ?? 1) > 1 ? 'was tied for the longest active streak' : 'was the longest active streak');

/** A game card: the streaks the game ended and the leaders it made, from the season file. */
async function gameCard(key: string): Promise<Response> {
  const m = await loadModel();
  const g = gameFromShare(`/game/${key}/`, await loadMeta());
  if (!g) throw new Error(`no game at ${key}`);
  const rows = await gameRows(key, g.date);
  const ended = rows.filter((r) => !r.leader).length;
  const byId = new Map(m.teams.map((t) => [t.id, t]));
  const score = gameScore(g, m);
  const meta = await loadMeta();
  const cards: CardRow[] = [];
  const shown = rows.slice(0, 7);
  for (const r of shown) {
    const t = byId.get(r.team);
    const verb = r.leader ? 'now leads' : ({ W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' } as Record<string, string>)[r.dir[0]] ?? 'had won';
    cards.push({
      count: `${r.len}${r.unsure ? '†' : ''}`, name: `${t?.name ?? r.team} ${verb}${r.leader ? ':' : ''} ${rowWords(r, meta)}`,
      sub: r.leader ? `sole leader of ${r.field} · since ${r.since}` : `${ledeOf(r)} · since ${r.since}`,
      bad: r.dir[0] === 'L' || r.dir[0] === 'N', live: false, span: '', logo: await logoUri(t?.espn), initial: t?.name[0] ?? '?',
    });
  }
  const away = teamName(meta, g.away) ?? g.away, home = teamName(meta, g.home) ?? g.home;
  const res = renderCard({
    heading: score ? `${score.home > score.away ? `${home} ${score.home}, ${away} ${score.away}` : `${away} ${score.away}, ${home} ${score.home}`}` : `${away} ${g.neutral ? 'vs' : 'at'} ${home}`,
    words: `${g.date} · ${ended ? `${fmtN(ended)} streak${ended === 1 ? '' : 's'} broken` : 'what it put on the line'}`,
    rows: cards,
    more: moreLine(ended, shown.filter((r) => !r.leader).length, 'broken'),
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

/** The board card for a definition URL's og image; with `as`, the by-opponent board of that team (asTeam.ts), its columns the opponents. */
async function ogCard(q: URLSearchParams): Promise<Response> {
  const m = await loadModel();
  const tables = { teamIds: m.teams.map((t) => t.id), mascots: m.P.mascots ?? [], colors: m.P.colors ?? [] };
  const asId = q.get('as');
  const asTi = asId ? m.teams.findIndex((t) => t.id === asId) : -1;
  if (asId && (asTi < 0 || !m.fbsNow.has(asTi))) throw new Error(`no team as ${asId}`);
  // a by-opponent board's default definition has no conditions
  const refs = (asTi >= 0 ? decodeRefs(q.get('c') ?? 'all', tables) : decodeRefs(q.get('c'), tables)) ?? decodeRefs(DEFAULT_C, tables)!;
  const dir: Dir = parseDir(q.get('dir')) ?? 'W';
  const scope = q.get('scope') === 'active' ? 'active' : 'all';
  const todayEp = Math.floor(Date.now() / 86400000);
  const rows = (asTi >= 0 ? m.asBoard(asTi, refs, dir, scope, todayEp) : scope === 'all' ? m.allTimeBoard(refs, dir, todayEp) : m.activeBoard(refs, dir, todayEp)).slice(0, 6);
  const meta: ShareMeta = { site: '', teams: {}, mascots: tables.mascots, colors: tables.colors };
  for (const t of m.teams) if (t.major) meta.teams[t.id] = t.name;
  const words = defWords(asTi >= 0 ? q.get('c') ?? 'all' : q.get('c') ?? DEFAULT_C, meta) ?? [];
  const cardRows: CardRow[] = [];
  for (const r of rows as BoardRow[]) {
    const live = scope === 'active' || !!r.live;
    const startEp = r.s.start?.ep ?? r.qual[r.qual.length - r.s.len].ep;
    const endEp = r.s.end?.ep ?? r.s.last.ep;
    // a live run's next qualifying game, when one is scheduled
    const nx = live && r.next ? r.next : null;
    // a by-opponent board's row is named for the opponent
    const who = m.teams[r.vs ?? r.ti];
    cardRows.push({
      count: `${r.s.len}${r.s.unsure ? '†' : ''}`,
      name: who.name,
      span: live ? `since ${yy(startEp)}` : `${yy(startEp)}–${yy(endEp)}`,
      live,
      logo: await logoUri(who.espn),
      initial: who.name[0] ?? '?',
      next: nx ? { word: siteWord(nx), logo: await logoUri(m.teams[nx.oppIdx]?.espn), initial: m.teams[nx.oppIdx]?.name[0] ?? '?', date: monthDay(nx.ep) } : null,
    });
  }
  const res = renderCard({
    // a trivia definition says so (trivia.ts); a by-opponent board's opponent is its axis, not a condition
    heading: `Longest ${scope === 'all' ? 'all-time' : 'active'} ${streaksWord(dirWord(dir), asTi < 0 && isTriviaBoard(q.get('c') ?? DEFAULT_C, dir))}${asTi >= 0 ? ` as ${m.teams[asTi].name}` : ''}`,
    words: asTi >= 0 ? `${m.teams[asTi].name} against each opponent · ${words.length ? words.join(' · ') : 'all games'}` : words.length ? words.join(' · ') : 'all games, no conditions',
    logo: asTi >= 0 ? await logoUri(m.teams[asTi].espn) : null,
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
  if (q.get('as') != null) out.set('as', q.get('as')!);
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    ORIGIN = env.ORIGIN ?? 'https://drewhoover.com';
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
        const breaker = url.searchParams.get('breaker');
        const breakers = url.searchParams.has('breakers') || (breaker != null && /^[a-z0-9-]+$/.test(breaker));
        // the season: ?breakers=<season>, or a team's ?breaker=<id>&season=<season>; absent, the running one
        const seParam = url.searchParams.get('season') ?? url.searchParams.get('breakers');
        const breakSe = seParam && /^\d{4}$/.test(seParam) ? Number(seParam) : null;
        report(env, ctx, request, 'share card', { ...urlProps(url), cached: !!cached, kind: game ? 'game' : breakers ? 'breakers' : url.searchParams.has('risk') ? 'risk' : url.searchParams.has('broken') ? 'broken' : 'board' });
        if (cached) return cached;
        const res = game
          ? await gameCard(game)
          : breakers
            ? await breakerCard(breaker, breakSe)
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
      // a past season's schedule the prerender didn't write (every season since 1936 has pages; this is the fallback)
      const pastSeason = /\/games\/(\d{4})(?:\/week\/(\d{1,2}))?\/?$/.exec(url.pathname);
      // a past season's streak-breakers (/breakers/<season>/, /breakers/<season>/<id>/), or the page's first address (/stoppers/)
      const bk = /\/(breakers|stoppers)(?:\/(\d{4}))?(?:\/([a-z0-9-]+))?\/?$/.exec(url.pathname);
      if (res.status === 404 && (game || pastSeason || bk)) {
        await res.body?.cancel();
        const shell = await fetch(`${ORIGIN}${BASE}/404.html?d=${dayKey()}`, edge(3600));
        if (!shell.ok) { await shell.body?.cancel(); return new Response('not found', { status: 404 }); }
        res = new Response(shell.body, { status: 200, headers: shell.headers });
        report(env, ctx, request, 'share unfurl', urlProps(url));
        const bkSe = bk ? (bk[2] ? Number(bk[2]) : (await loadModel()).P.currentSeason) : null;
        const bkId = bk?.[3] ?? null;
        const text = game
          ? gameText(game, meta, gameScore(game, await loadModel()), await gameRows(game.key, game.date))
          : bk
            ? await pastBreakersText(bkSe!, bkId, meta)
            : pastWeekText(Number(pastSeason![1]), pastSeason![2] ? Number(pastSeason![2]) : null, meta);
        const img = game
          ? `${ORIGIN}${BASE}/share/og.png?game=${encodeURIComponent(game.key)}`
          : bk
            ? `${ORIGIN}${BASE}/share/og.png?${bkId ? `breaker=${bkId}&season=${bkSe}` : `breakers=${bkSe}`}`
            : `${ORIGIN}${BASE}/og.png`;
        const pageUrl = `${ORIGIN}${url.pathname}`;
        // the shell's JSON-LD describes the root; this page's describes itself
        const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', '@id': pageUrl, url: pageUrl, name: text.title, description: text.description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: 'drewhoover.com' } });
        return new HTMLRewriter()
          .on('title', { element(e) { e.setInnerContent(text.title); } })
          .on('meta[name="description"]', content(text.description))
          .on('meta[property="og:title"]', content(text.title))
          .on('meta[property="og:description"]', content(text.description))
          .on('meta[property="og:url"]', content(pageUrl))
          .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', pageUrl); } })
          .on('script[type="application/ld+json"]', { element(e) { e.setInnerContent(jsonLd); } })
          .on('meta[property="og:image"]', content(img))
          .on('meta[name="twitter:image"]', content(img))
          .on('meta[name="twitter:title"]', content(text.title))
          .on('meta[name="twitter:description"]', content(text.description))
          .transform(res);
      }
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
      const text = shareText(url.pathname, url.searchParams, meta);
      if (!text) return res;
      report(env, ctx, request, 'share unfurl', urlProps(url));
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
} satisfies ExportedHandler<Env>;
