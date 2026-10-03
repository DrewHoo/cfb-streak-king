// Decode a payload into per-team game lists and evaluate definitions on them.
// Pure: everything hangs off the payload passed in, so tests can build a
// model from a fixture. model.ts builds the one the app uses. Streak
// semantics live in streaks.ts.

import type { BoardRow, ChipRef, Dir, GameContext, GameRow, Payload, Stint, UpcomingRow } from './types.ts';
import { FLAG, NO_LINE, RANK_UNKNOWN, UNKNOWN } from './schema.ts';
import { chipByKey, qualifies, qualifiesPregame } from './chips.ts';
import { activeRun, runsOf, decided, matches, againstSpread } from './streaks.ts';
import { underFullMoon } from './moon.ts';

const DAY_MS = 86400000;
const monthOf = (ep: number) => {
  const m = new Date(ep * DAY_MS).getUTCMonth() + 1;
  return m === 8 ? 9 : m; // week 0 folds into September
};
const sameState = (a: string | undefined, b: string | undefined) => a != null && a === b;
// a mid-season taker's "first season" is his first season opener
const firstSeasonOf = (s: Stint) => (s[2] === 0 ? s[1] : s[1] + 1);
// sorts before any real game day, including negative (pre-1970) ones
const EDGE = -Infinity;
const rank = (r: number) => (r === RANK_UNKNOWN ? null : r);
// margin plus our spread (+ = we were underdogs): above zero covered, zero a push
// the first season with closing lines (Repole's files)
const LINES_FROM = 1978;
const coverOf = (m: number) => (m > 0 ? 'W' : m < 0 ? 'L' : 'P');
// stored in half-points from the home side; ours is + when we're the underdogs
const lineOf = (raw: number | undefined, home: boolean) => (raw == null || raw === NO_LINE ? null : (home ? raw : -raw) / 2);

export type Model = ReturnType<typeof createModel>;

export function createModel(P: Payload) {
  const { teams, confs } = P;
  const g = P.games;
  const N = g.se.length;
  /** The first season in the data; a team's window starts here at the earliest. */
  const firstSeason = N ? g.se[0] : P.currentSeason;

  // streak holders: this season's FBS teams
  const fbsNow = new Set<number>();
  teams.forEach((t, i) => {
    if (t.major?.some(([a, b]) => a <= P.currentSeason && b >= P.currentSeason)) fbsNow.add(i);
  });

  const confOf = (ti: number, season: number): string | null => {
    const runs = teams[ti]?.conf;
    if (!runs) return null;
    for (const [a, b, ci] of runs) if (season >= a && season <= b) return confs[ci];
    return null;
  };

  /**
   * The first season of a team's own list: its latest major (FBS) stint.
   * Games it played before, as an FCS team, stay in the payload for the FBS
   * opponent but never count toward its own streaks.
   */
  const windowStartOf = (ti: number) => Math.max(firstSeason, teams[ti]?.major?.at(-1)?.[0] ?? firstSeason);

  // --- coach stints ---
  // t.hc = [[ci, startSe, startOrd, interim]] sorted; a stint runs until the
  // next one starts. Ordinals are a team's game count within a season (the
  // arrays are in ep order), tracked for every team so opponents resolve too.
  const hOrd = new Int32Array(N);
  const aOrd = new Int32Array(N);
  {
    const cnt = new Map<string, number>();
    const next = (ti: number, se: number) => {
      const k = `${ti}|${se}`;
      const n = cnt.get(k) ?? 0;
      cnt.set(k, n + 1);
      return n;
    };
    for (let i = 0; i < N; i++) {
      hOrd[i] = next(g.hi[i], g.se[i]);
      aOrd[i] = next(g.ai[i], g.se[i]);
    }
  }
  function stintAt(ti: number, se: number, ord: number): Stint | null {
    const hc = teams[ti]?.hc;
    if (!hc) return null;
    let cur: Stint | null = null;
    for (const s of hc) {
      if (s[1] < se || (s[1] === se && s[2] <= ord)) cur = s;
      else break;
    }
    return cur;
  }
  const lastStint = (ti: number) => teams[ti]?.hc?.at(-1) ?? null;
  const known = (s: Stint | null): s is Stint => !!s && s[0] >= 0;

  /** The fields of a game knowable before kickoff, from team ti's side. */
  function base(
    cols: { ep: number[]; fl: number[]; hr: number[]; ar: number[]; hh: number[]; rv: number[]; hi: number[]; ai: number[]; vs?: number[] },
    i: number, ti: number, home: boolean, se: number,
  ): Omit<GameContext, 'sp' | 'hcCur' | 'hcNew' | 'vsNew'> {
    const oppIdx = home ? cols.ai[i] : cols.hi[i];
    return {
      i,
      ep: cols.ep[i],
      se,
      home,
      neutral: !!(cols.fl[i] & FLAG.neutral),
      conf: !!(cols.fl[i] & FLAG.conf),
      post: !!(cols.fl[i] & FLAG.post),
      oppIdx,
      oppRank: rank(home ? cols.ar[i] : cols.hr[i]),
      ownRank: rank(home ? cols.hr[i] : cols.ar[i]),
      hh: cols.hh[i],
      rv: cols.rv[i],
      vst: P.states[cols.vs?.[i] ?? 0] || null,
      month: monthOf(cols.ep[i]),
      wday: ((cols.ep[i] % 7) + 11) % 7, // 1970-01-01 was a Thursday
      moon: underFullMoon(cols.ep[i]),
      oppConf: confOf(oppIdx, se),
      inState: sameState(teams[oppIdx]?.st, teams[ti]?.st),
    };
  }

  // --- per-team game lists (current-FBS teams only; ascending) ---
  const byTeam = new Map<number, GameRow[]>();
  for (const ti of fbsNow) byTeam.set(ti, []);
  for (let i = 0; i < N; i++) {
    for (const home of [true, false]) {
      const ti = home ? g.hi[i] : g.ai[i];
      const list = byTeam.get(ti);
      if (!list) continue;
      const se = g.se[i];
      if (se < windowStartOf(ti)) continue;
      const us = home ? g.hs[i] : g.as[i];
      const them = home ? g.as[i] : g.hs[i];
      const spRaw = g.sp[i];
      const ctx = base(g, i, ti, home, se);
      const st = stintAt(ti, se, home ? hOrd[i] : aOrd[i]);
      const ost = stintAt(ctx.oppIdx, se, home ? aOrd[i] : hOrd[i]);
      const cc = lastStint(ti);
      list.push({
        ...ctx,
        hcCur: known(st) && known(cc) && st[0] === cc[0],
        hcNew: known(st) && !st[3] && firstSeasonOf(st) === se,
        vsNew: known(ost) && !ost[3] && firstSeasonOf(ost) === se,
        us,
        them,
        r: us > them ? 'W' : us < them ? 'L' : 'T',
        margin: Math.abs(us - them),
        total: us + them,
        sp: lineOf(spRaw, home),
        cover: spRaw === NO_LINE ? null : coverOf(us - them + (home ? spRaw : -spRaw) / 2),
        ot: g.ot?.[i] ?? UNKNOWN,
        h1: g.hf[i] >= 0 ? (home ? g.hf[i] - g.af[i] : g.af[i] - g.hf[i]) : null,
        pos: g.hp[i] >= 0 && g.hp[i] + g.ap[i] > 0 ? (home ? g.hp[i] : g.ap[i]) / (g.hp[i] + g.ap[i]) : null,
        prevR: null,
        rest: null,
      });
    }
  }
  for (const [, list] of byTeam) {
    list.sort((a, b) => a.ep - b.ep);
    // context fields need the team's own timeline
    let prev: GameRow | null = null;
    const bySeason = new Map<number, { first: GameRow; last: GameRow }>();
    for (const game of list) {
      game.prevR = prev && prev.se >= game.se - 1 ? prev.r : null;
      game.rest = prev ? game.ep - prev.ep : null;
      prev = game;
      if (!game.post) {
        const s = bySeason.get(game.se) ?? { first: game, last: game };
        if (game.ep < s.first.ep) s.first = game;
        if (game.ep > s.last.ep) s.last = game;
        bySeason.set(game.se, s);
      }
    }
    for (const [se, s] of bySeason) {
      s.first.opener = true;
      // a finale in the running season isn't known until the season ends
      if (se < P.currentSeason) s.last.finale = true;
    }
  }
  const gamesOf = (ti: number): GameRow[] => byTeam.get(ti) ?? [];

  // --- scheduled games of the running season ---
  const upc = P.upcoming;
  const upcomingByTeam = new Map<number, UpcomingRow[]>();
  for (let i = 0; i < (upc?.ep.length ?? 0); i++) {
    for (const home of [true, false]) {
      const ti = home ? upc.hi[i] : upc.ai[i];
      if (!fbsNow.has(ti)) continue;
      const ctx = base(upc, i, ti, home, P.currentSeason);
      // scheduled games are by definition under both teams' current coaches
      const own = lastStint(ti);
      const opp = lastStint(ctx.oppIdx);
      const arr = upcomingByTeam.get(ti) ?? [];
      arr.push({
        ...ctx,
        wk: upc.wk[i],
        sp: lineOf(upc.sp?.[i], home),
        hcCur: known(own),
        hcNew: known(own) && !own[3] && firstSeasonOf(own) === P.currentSeason,
        vsNew: known(opp) && !opp[3] && firstSeasonOf(opp) === P.currentSeason,
      });
      upcomingByTeam.set(ti, arr);
    }
  }
  for (const arr of upcomingByTeam.values()) arr.sort((a, b) => a.ep - b.ep);
  // openers and finales among scheduled games
  for (const [ti, arr] of upcomingByTeam) {
    const played = gamesOf(ti).filter((x) => x.se === P.currentSeason);
    if (!played.length && arr.length) arr[0].opener = true;
    const regs = arr.filter((x) => !x.post);
    if (regs.length) regs[regs.length - 1].finale = true;
  }
  const upcomingOf = (ti: number): UpcomingRow[] => upcomingByTeam.get(ti) ?? [];

  // --- evaluating a definition ---
  function makeFilter(active: ChipRef[]) {
    const fns = active.map(({ key, param }) => {
      const c = chipByKey.get(key)!;
      return (x: GameRow) => qualifies(c, x, param);
    });
    return (x: GameRow) => fns.every((f) => f(x));
  }
  /** Whether a scheduled game qualifies; null when a chip can't be decided before kickoff. */
  function makePre(active: ChipRef[]) {
    const fns = active.map(({ key, param }) => {
      const c = chipByKey.get(key)!;
      return c.pregame ? (x: GameContext) => qualifiesPregame(c, x, param) : null;
    });
    if (fns.some((f) => !f)) return null;
    return (x: GameContext) => fns.every((f) => f!(x));
  }
  // A scheduled game stays the next one until a build records its result,
  // even past its date: the payload is rebuilt weekly, and a game played
  // Saturday is unknown until then, not gone.
  function nextQualifying(ti: number, pre: ((x: GameContext) => boolean) | null, todayEp: number) {
    const next = pre ? upcomingOf(ti).find((u) => pre(u)) ?? null : null;
    return { next, onTheLine: !!next && next.ep - todayEp <= 8 };
  }

  /**
   * The active board: each team's current streak, if it runs in `dir`,
   * longest first, then the one whose previous run ended earliest.
   */
  function activeBoard(active: ChipRef[], dir: Dir, todayEp: number): BoardRow[] {
    const rows: BoardRow[] = [];
    const filter = makeFilter(active);
    const pre = makePre(active);
    for (const ti of fbsNow) {
      const qual = gamesOf(ti).filter((g) => filter(g) && decided(dir, g));
      if (!qual.length) continue;
      const s = activeRun(qual, dir);
      if (!s) continue;
      rows.push({ ti, s, qual, ...nextQualifying(ti, pre, todayEp) });
    }
    const enderEp = (r: BoardRow) => (r.s.atEdge ? EDGE : r.s.ender!.ep);
    rows.sort((a, b) => b.s.len - a.s.len || enderEp(a) - enderEp(b));
    return rows;
  }

  /**
   * The all-time board: every run of `dir` in every team's qualifying list,
   * ended or not, so a team can appear more than once. Rows carry the same
   * shape as activeBoard() plus `ended` (the game that broke the run, null
   * when it's live), `live`, and `key` (team + start, unique per run).
   */
  function allTimeBoard(active: ChipRef[], dir: Dir, todayEp: number): BoardRow[] {
    const rows: BoardRow[] = [];
    const filter = makeFilter(active);
    const pre = makePre(active);
    for (const ti of fbsNow) {
      const qual = gamesOf(ti).filter((g) => filter(g) && decided(dir, g));
      for (const [startIdx, endIdx] of runsOf(qual, dir)) {
        const live = endIdx === qual.length - 1;
        const s = {
          dir, len: endIdx - startIdx + 1, atEdge: startIdx === 0, last: qual[endIdx],
          ender: startIdx > 0 ? qual[startIdx - 1] : null,
          start: qual[startIdx], end: qual[endIdx], startIdx, endIdx,
        };
        const nx = live ? nextQualifying(ti, pre, todayEp) : { next: null, onTheLine: false };
        rows.push({ ti, s, qual, ...nx, ended: live ? null : qual[endIdx + 1], live, key: `${teams[ti].id}:${s.start.ep}` });
      }
    }
    rows.sort((a, b) => b.s.len - a.s.len || b.s.end!.ep - a.s.end!.ep);
    return rows;
  }

  /**
   * How often the outcome happens under a definition: every current FBS
   * team's qualifying games, pooled. `n` counts the games that can decide it
   * (lined ones for a spread outcome), `from` is the first season among them.
   * Null when no game qualifies.
   */
  function baseRate(active: ChipRef[], dir: Dir) {
    const filter = makeFilter(active);
    let n = 0, hit = 0, from = Infinity;
    for (const ti of fbsNow) {
      for (const g of gamesOf(ti)) {
        if (!filter(g) || !decided(dir, g)) continue;
        n++;
        if (matches(dir, g)) hit++;
        if (g.se < from) from = g.se;
      }
    }
    return n ? { hit, n, from } : null;
  }

  /**
   * Where a streak that reaches the start of a team's list actually stops:
   * the latest data floor among the definition's chips (kickoff times from
   * 2002, say) or the outcome's (a spread streak needs lines, from 1978),
   * else the team's first FBS season, else the first season in the data.
   * `what` names the missing data; `joined` says it's the team's FBS entry.
   */
  function edgeFor(active: ChipRef[], dir: Dir = 'W') {
    let floor = firstSeason;
    let what: string | null = null;
    if (againstSpread(dir) && LINES_FROM > floor) { floor = LINES_FROM; what = 'closing-line'; }
    for (const a of active) {
      const f = chipByKey.get(a.key)?.floor;
      if (f && f.season > floor) { floor = f.season; what = f.what; }
    }
    return (ti: number) => {
      const joined = windowStartOf(ti);
      return joined > floor ? { year: joined, word: null, joined: true } : { year: floor, word: what, joined: false };
    };
  }

  return { P, teams, confs, firstSeason, fbsNow, confOf, windowStartOf, gamesOf, upcomingOf, activeBoard, allTimeBoard, baseRate, edgeFor };
}
