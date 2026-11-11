// A series: every meeting of two teams, the record from one side, at each
// site, the run it's on, the longest run each way, and the next meeting.
// The payload has the games since its first season (1936) in which either
// team was major. The early file has the rest (scripts/data/build-series-early.mjs):
// jhowell.net's before 1936, and Wikipedia's season articles for a season
// when neither team was major, so a series reads from the first meeting. A
// page exists for two teams in FBS now that have met SERIES_MIN times.
//
// No model import: createSeries takes the model's parts and the early file,
// so the share worker can build one on its own model. series.ts is the app's.

import type { GameRow, Result, Team, UpcomingRow } from './types.ts';
import type { Rec, StreakNow } from './seriesWords.ts';

/** Meetings a series needs for a page. */
export const SERIES_MIN = 10;

export interface SeriesGame {
  ep: number;
  se: number;
  us: number;
  them: number;
  r: Result;
  site: 'home' | 'away' | 'neutral';
  post: boolean;
  ownRank: number | null;
  oppRank: number | null;
  /** From the early file, not the payload: no game page, no ranks. */
  early: boolean;
  /** The payload's row, null for an early game; from `side`'s side, which is the opponent's when the team's own list starts after the game (gamesOf skips a team's seasons before its FBS stint). */
  row: GameRow | null;
  side: number | null;
  /** The official result isn't the score as played: `r` is the forfeit's (the score stays as played), or the win was vacated and the game is in neither team's record. */
  ruling: 'forfeit' | 'vacated' | null;
}

export interface Run { r: 'W' | 'L'; len: number; from: number; to: number }

export interface Series {
  ti: number;
  oi: number;
  /** Oldest first. */
  games: SeriesGame[];
  rec: Rec;
  site: { home: Rec; away: Rec; neutral: Rec };
  now: StreakNow;
  /** The longest run each way, the earliest when two are as long; null when the side never won. */
  longest: { W: Run | null; L: Run | null };
  next: UpcomingRow | null;
  /** The year the first meeting was played. */
  since: number;
}

export interface EarlyGames {
  teams: string[];
  games: { se: number[]; ep: number[]; hi: number[]; ai: number[]; hs: number[]; as: number[]; fl: number[] };
  /** Games whose official result isn't the score: `w` the forfeit's winner, or -1 for a vacated win; teams index `teams`, any game of the pair within a few days of `ep`. */
  rulings?: { ep: number[]; a: number[]; b: number[]; w: number[] };
}
export interface SeriesModel {
  teams: Team[];
  fbsNow: Set<number>;
  gamesOf: (ti: number) => GameRow[];
  upcomingOf: (ti: number) => UpcomingRow[];
}

export function createSeries({ teams, fbsNow, gamesOf, upcomingOf }: SeriesModel, early: EarlyGames) {
  const idIdx = new Map(teams.map((t, i) => [t.id, i]));
  // the rulings by team pair: [ep, the forfeit's winner or -1 for vacated]
  const ruledBy = new Map<string, [number, number][]>();
  if (early.rulings) {
    const r = early.rulings;
    for (let i = 0; i < r.ep.length; i++) {
      const a = idIdx.get(early.teams[r.a[i]]), b = idIdx.get(early.teams[r.b[i]]);
      if (a == null || b == null) continue;
      const w = r.w[i] < 0 ? -1 : idIdx.get(early.teams[r.w[i]]) ?? -1;
      for (const k of [`${a}|${b}`, `${b}|${a}`]) (ruledBy.get(k) ?? ruledBy.set(k, []).get(k)!).push([r.ep[i], w]);
    }
  }
  /** A game with its ruling applied, from ti's side. */
  const rule = (ti: number, oi: number, g: SeriesGame): SeriesGame => {
    const hit = ruledBy.get(`${ti}|${oi}`)?.find(([ep]) => Math.abs(ep - g.ep) <= 3);
    if (!hit) return g;
    if (hit[1] < 0) return { ...g, ruling: 'vacated' };
    return { ...g, ruling: 'forfeit', r: hit[1] === ti ? 'W' : 'L' };
  };

  // the early games by team pair, from both sides
  const earlyBy = new Map<string, SeriesGame[]>();
  {
    const g = early.games;
    for (let i = 0; i < g.se.length; i++) {
      const h = idIdx.get(early.teams[g.hi[i]]), a = idIdx.get(early.teams[g.ai[i]]);
      if (h == null || a == null) continue;
      const neutral = g.fl[i] === 1;
      for (const [ti, oi, us, them, site] of [[h, a, g.hs[i], g.as[i], neutral ? 'neutral' : 'home'], [a, h, g.as[i], g.hs[i], neutral ? 'neutral' : 'away']] as const) {
        const key = `${ti}|${oi}`;
        (earlyBy.get(key) ?? earlyBy.set(key, []).get(key)!).push({
          ep: g.ep[i], se: g.se[i], us, them, r: us > them ? 'W' : us < them ? 'L' : 'T', site, post: false, ownRank: null, oppRank: null, early: true, row: null, side: null, ruling: null,
        });
      }
    }
  }

  /** Every meeting of ti and oi, oldest first, from ti's side: its own rows, and the opponent's for the seasons before ti's own list starts. */
  function seriesGames(ti: number, oi: number): SeriesGame[] {
    const own = gamesOf(ti).filter((g) => g.oppIdx === oi);
    const seen = new Set(own.map((g) => g.ep));
    const theirs = gamesOf(oi).filter((g) => g.oppIdx === ti && !seen.has(g.ep));
    const late = [
      ...own.map((g): SeriesGame => ({
        ep: g.ep, se: g.se, us: g.us, them: g.them, r: g.r, site: g.neutral ? 'neutral' : g.home ? 'home' : 'away', post: g.post, ownRank: g.ownRank, oppRank: g.oppRank, early: false, row: g, side: ti, ruling: null,
      })),
      ...theirs.map((g): SeriesGame => ({
        ep: g.ep, se: g.se, us: g.them, them: g.us, r: g.r === 'W' ? 'L' : g.r === 'L' ? 'W' : 'T', site: g.neutral ? 'neutral' : g.home ? 'away' : 'home', post: g.post, ownRank: g.oppRank, oppRank: g.ownRank, early: false, row: g, side: oi, ruling: null,
      })),
    ].sort((a, b) => a.ep - b.ep);
    return [...(earlyBy.get(`${ti}|${oi}`) ?? []), ...late].sort((a, b) => a.ep - b.ep).map((g) => rule(ti, oi, g));
  }

  const tally = (gs: SeriesGame[]): Rec => {
    const r: Rec = [0, 0, 0];
    for (const g of gs) if (g.ruling !== 'vacated') r[g.r === 'W' ? 0 : g.r === 'L' ? 1 : 2]++;
    return r;
  };

  /** The series from ti's side; null when they've never met. */
  function seriesOf(ti: number, oi: number): Series | null {
    const games = seriesGames(ti, oi);
    if (!games.length) return null;
    // the runs skip a vacated win, the way the record does
    const counted = games.filter((g) => g.ruling !== 'vacated');
    const last = counted[counted.length - 1] ?? games[games.length - 1];
    let len = 0;
    for (let i = counted.length - 1; i >= 0 && counted[i].r === last.r; i--) len++;
    const longest: Series['longest'] = { W: null, L: null };
    for (let i = 0; i < counted.length;) {
      let j = i;
      while (j + 1 < counted.length && counted[j + 1].r === counted[i].r) j++;
      const r = counted[i].r;
      if (r !== 'T' && (!longest[r] || j - i + 1 > longest[r]!.len)) longest[r] = { r, len: j - i + 1, from: counted[i].se, to: counted[j].se };
      i = j + 1;
    }
    return {
      ti, oi, games,
      rec: tally(games),
      site: { home: tally(games.filter((g) => g.site === 'home')), away: tally(games.filter((g) => g.site === 'away')), neutral: tally(games.filter((g) => g.site === 'neutral')) },
      now: { r: last.r, len },
      longest,
      next: upcomingOf(ti).find((u) => u.oppIdx === oi) ?? null,
      // the year of the first meeting's date, the way it's known: the first Iron Bowl was February 1893, in the 1892 season
      since: new Date(games[0].ep * 86400000).getUTCFullYear(),
    };
  }

  // how many times each pair of FBS teams has met: every payload game either list has, once, and the early ones
  let pairCount: Map<string, number> | null = null;
  const pairKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  function counts() {
    if (pairCount) return pairCount;
    const eps = new Map<string, Set<number>>();
    for (const a of fbsNow) {
      for (const g of gamesOf(a)) {
        if (!fbsNow.has(g.oppIdx)) continue;
        const k = pairKey(a, g.oppIdx);
        (eps.get(k) ?? eps.set(k, new Set()).get(k)!).add(g.ep);
      }
    }
    pairCount = new Map([...eps].map(([k, set]) => [k, set.size]));
    for (const [key, gs] of earlyBy) {
      const [x, y] = key.split('|').map(Number);
      if (x < y && fbsNow.has(x) && fbsNow.has(y)) pairCount.set(key, (pairCount.get(key) ?? 0) + gs.length);
    }
    return pairCount;
  }

  /** How many times ti and oi have met. */
  const meetings = (ti: number, oi: number) => (fbsNow.has(ti) && fbsNow.has(oi) ? counts().get(pairKey(ti, oi)) ?? 0 : seriesGames(ti, oi).length);

  const opponentsCache = new Map<number, { oi: number; n: number }[]>();
  /** A team's opponents with a series page (FBS now, SERIES_MIN meetings), most meetings first. */
  function seriesOpponents(ti: number): { oi: number; n: number }[] {
    if (!fbsNow.has(ti)) return [];
    let list = opponentsCache.get(ti);
    if (!list) {
      list = [];
      for (const oi of fbsNow) {
        const n = oi === ti ? 0 : counts().get(pairKey(ti, oi)) ?? 0;
        if (n >= SERIES_MIN) list.push({ oi, n });
      }
      list.sort((p, q) => q.n - p.n || teams[p.oi].name.localeCompare(teams[q.oi].name));
      opponentsCache.set(ti, list);
    }
    return list;
  }

  /** Whether two teams have a series page. */
  const hasSeries = (ti: number, oi: number) => fbsNow.has(ti) && seriesOpponents(ti).some((o) => o.oi === oi);

  return { seriesGames, seriesOf, meetings, seriesOpponents, hasSeries };
}
