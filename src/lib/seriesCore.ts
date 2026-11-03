// A series: every meeting of two teams, the record from one side, at each
// site, the run it's on, the longest run each way, and the next meeting.
// The games since the payload's first season (1936) are the payload's; the
// ones before are jhowell.net's (scripts/data/build-series-early.mjs), back to
// the first season Howell counts a team as major, so a series reads from the
// first meeting the ledger has, which the page says. A page exists for two
// teams in FBS now that have met SERIES_MIN times.
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
  /** Before the payload's first season: no game page, no ranks. */
  early: boolean;
  /** The payload's row, null for an early game; from `side`'s side, which is the opponent's when the team's own list starts after the game (gamesOf skips a team's seasons before its FBS stint). */
  row: GameRow | null;
  side: number | null;
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
  since: number;
}

export interface EarlyGames {
  teams: string[];
  games: { se: number[]; ep: number[]; hi: number[]; ai: number[]; hs: number[]; as: number[]; fl: number[] };
}
export interface SeriesModel {
  teams: Team[];
  fbsNow: Set<number>;
  gamesOf: (ti: number) => GameRow[];
  upcomingOf: (ti: number) => UpcomingRow[];
}

export function createSeries({ teams, fbsNow, gamesOf, upcomingOf }: SeriesModel, early: EarlyGames) {
  const idIdx = new Map(teams.map((t, i) => [t.id, i]));
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
          ep: g.ep[i], se: g.se[i], us, them, r: us > them ? 'W' : us < them ? 'L' : 'T', site, post: false, ownRank: null, oppRank: null, early: true, row: null, side: null,
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
        ep: g.ep, se: g.se, us: g.us, them: g.them, r: g.r, site: g.neutral ? 'neutral' : g.home ? 'home' : 'away', post: g.post, ownRank: g.ownRank, oppRank: g.oppRank, early: false, row: g, side: ti,
      })),
      ...theirs.map((g): SeriesGame => ({
        ep: g.ep, se: g.se, us: g.them, them: g.us, r: g.r === 'W' ? 'L' : g.r === 'L' ? 'W' : 'T', site: g.neutral ? 'neutral' : g.home ? 'away' : 'home', post: g.post, ownRank: g.oppRank, oppRank: g.ownRank, early: false, row: g, side: oi,
      })),
    ].sort((a, b) => a.ep - b.ep);
    return [...(earlyBy.get(`${ti}|${oi}`) ?? []), ...late];
  }

  const tally = (gs: SeriesGame[]): Rec => {
    const r: Rec = [0, 0, 0];
    for (const g of gs) r[g.r === 'W' ? 0 : g.r === 'L' ? 1 : 2]++;
    return r;
  };

  /** The series from ti's side; null when they've never met. */
  function seriesOf(ti: number, oi: number): Series | null {
    const games = seriesGames(ti, oi);
    if (!games.length) return null;
    const last = games[games.length - 1];
    let len = 0;
    for (let i = games.length - 1; i >= 0 && games[i].r === last.r; i--) len++;
    const longest: Series['longest'] = { W: null, L: null };
    for (let i = 0; i < games.length;) {
      let j = i;
      while (j + 1 < games.length && games[j + 1].r === games[i].r) j++;
      const r = games[i].r;
      if (r !== 'T' && (!longest[r] || j - i + 1 > longest[r]!.len)) longest[r] = { r, len: j - i + 1, from: games[i].se, to: games[j].se };
      i = j + 1;
    }
    return {
      ti, oi, games,
      rec: tally(games),
      site: { home: tally(games.filter((g) => g.site === 'home')), away: tally(games.filter((g) => g.site === 'away')), neutral: tally(games.filter((g) => g.site === 'neutral')) },
      now: { r: last.r, len },
      longest,
      next: upcomingOf(ti).find((u) => u.oppIdx === oi) ?? null,
      since: games[0].se,
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
