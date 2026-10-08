// Mine "streaks this team is king of": every ≤4-chip subset of the
// parameterless catalog (exclusivity honored) × the seven mined outcomes
// (the plain five, and won or lost by 10+), evaluated over packed per-chip
// bitmasks. The whole space is 64,687 definitions (the
// empty one included) and mines in a second or two, lazily in the client.
//
// Two scopes. 'active': the definition-direction whose sole longest active
// streak belongs to this team. 'all': the sole longest run anywhere in the
// window, ended or not. Definitions that produce the identical streak (same
// last game, same length) collapse to one crown named by the fewest-chip
// definition; `also` counts the collapsed labels. Floors: length ≥ 4 and a
// field of ≥ 10 teams holding any streak under the definition. Each crown
// carries its definition's pooled rate, and crownRank.ts picks which of a
// team's crowns to show and orders them.

import type { Crown, Dir, GameRow, Result, Scope } from './types.ts';
import { PLAIN_CHIPS, conflicts, fitsDir, qualifies } from './chips.ts';
import { rankCrowns } from './crownRank.ts';
import type { MinedCrown } from './crownRank.ts';
import { fbsNow, gamesOf } from './model.ts';
import { MINED_OUTCOMES } from './streaks.ts';
import { MINED_MARGIN, marginDir } from './outcome.ts';

/**
 * One team's games for the walks: per-chip masks, the result of each game
 * (`r`), and the result by the mined margin (`rM`: W won by 10+, L lost by
 * 10+, T neither, so the same walks find margin runs), with the masks the
 * pooled rates count.
 */
export interface TeamData { ti: number; gs: GameRow[]; n: number; words: number; masks: Uint32Array[]; r: Result[]; rM: Result[]; won: Uint32Array; lost: Uint32Array; lined: Uint32Array; covered: Uint32Array; missed: Uint32Array; wonM: Uint32Array; lostM: Uint32Array }
// live: no later qualifying game broke the run
export interface Run { len: number; atEdge: boolean; lastIdx: number; startIdx: number; live: boolean }
export type Runs = Partial<Record<Dir, Run>>;

export const LEN_FLOOR = 4;
export const FIELD_FLOOR = 10;
/**
 * A chip that keeps more than this share of all games ("on a weekend", 91%)
 * barely filters: added to a definition it mostly lets a streak skip a stray
 * weeknight game. It stays in the menus but never names a crown.
 */
export const NEAR_UNIVERSAL = 0.9;

const NP = PLAIN_CHIPS;

const caches: Record<Scope, Map<number, Crown[]> | null> = { active: null, all: null };
const mining: Record<Scope, Promise<Map<number, MinedCrown[]>> | null> = { active: null, all: null };

const popcount = (x: number) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};
const countAnd = (a: Uint32Array, b: Uint32Array) => { let n = 0; for (let w = 0; w < a.length; w++) n += popcount(a[w] & b[w]); return n; };

let built: TeamData[] | null = null;
/** Each current-FBS team's games as per-chip bitmasks, built once and shared with kings.ts. */
export function teamData(): TeamData[] {
  return (built ??= buildData());
}

function buildData(): TeamData[] {
  return [...fbsNow].map((ti) => {
    const gs = gamesOf(ti);
    const n = gs.length;
    const words = Math.ceil(n / 32) || 1;
    const masks = NP.map((c) => {
      const m = new Uint32Array(words);
      for (let i = 0; i < n; i++) if (qualifies(c, gs[i])) m[i >> 5] |= 1 << (i & 31);
      return m;
    });
    // spread streaks run over lined games only; covered = beat the spread,
    // missed = failed to (a push is neither)
    const lined = new Uint32Array(words);
    const covered = new Uint32Array(words);
    const missed = new Uint32Array(words);
    const won = new Uint32Array(words);
    const lost = new Uint32Array(words);
    const wonM = new Uint32Array(words);
    const lostM = new Uint32Array(words);
    const rM = resultsBy(gs, MINED_MARGIN);
    for (let i = 0; i < n; i++) {
      if (gs[i].r === 'W') won[i >> 5] |= 1 << (i & 31);
      if (gs[i].r === 'L') lost[i >> 5] |= 1 << (i & 31);
      if (rM[i] === 'W') wonM[i >> 5] |= 1 << (i & 31);
      if (rM[i] === 'L') lostM[i >> 5] |= 1 << (i & 31);
      if (gs[i].cover != null) lined[i >> 5] |= 1 << (i & 31);
      if (gs[i].cover === 'W') covered[i >> 5] |= 1 << (i & 31);
      if (gs[i].cover === 'L') missed[i >> 5] |= 1 << (i & 31);
    }
    return { ti, gs, n, words, masks, r: gs.map((x) => x.r), rM, won, lost, lined, covered, missed, wonM, lostM };
  });
}

/** Each game's result by a margin: W won by `by` or more, L lost by that much, T neither. */
export const resultsBy = (gs: GameRow[], by: number): Result[] => gs.map((g) => (g.margin >= by ? g.r : 'T'));

/** The margin runs of a walk's output, named by their outcomes ("W10"); the undefeated run means nothing by a margin. */
export function asMarginRuns(runs: Runs, by: number): Runs {
  const out: Runs = {};
  if (runs.W) out[marginDir('W', by)] = runs.W;
  if (runs.L) out[marginDir('L', by)] = runs.L;
  return out;
}

// The trailing runs of the masked sequence: the run of the latest result
// (W or L) and the undefeated run, each set when it has at least one game.
// `r` is the result per game: the team's, or its results by a margin.
export function walkActive(td: TeamData, q: Uint32Array, results: Result[] = td.r): Runs {
  let r0: Result | null = null;
  let lastIdx = -1;
  let same = 0, sameStart = -1, sameOpen = true;
  let unb = 0, unbStart = -1, unbOpen = true;
  scan: for (let w = td.words - 1; w >= 0; w--) {
    if (!q[w]) continue;
    for (let b = 31; b >= 0; b--) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      const r = results[i];
      if (r0 === null) { r0 = r; lastIdx = i; sameOpen = r !== 'T'; }
      if (sameOpen) { if (r === r0) { same++; sameStart = i; } else sameOpen = false; }
      if (unbOpen) { if (r !== 'L') { unb++; unbStart = i; } else unbOpen = false; }
      if (!sameOpen && !unbOpen) break scan;
    }
  }
  const out: Runs = {};
  // a run still open after the scan reached the first qualifying game
  if (r0 && r0 !== 'T' && same) out[r0] = { len: same, atEdge: sameOpen, lastIdx, startIdx: sameStart, live: true };
  if (unb) out.U = { len: unb, atEdge: unbOpen, lastIdx, startIdx: unbStart, live: true };
  return out;
}

// the longest run of each outcome anywhere in the masked sequence; on a tie
// the later run wins, as it sorts first on the all-time board
export function walkLongest(td: TeamData, q: Uint32Array, results: Result[] = td.r): Runs {
  const best: Runs = {};
  const keep = (o: Dir, len: number, startIdx: number, lastIdx: number) => {
    const b = best[o];
    if (len && (!b || len >= b.len)) best[o] = { len, atEdge: false, lastIdx, startIdx, live: false };
  };
  let dir: Result | null = null;
  let len = 0, startIdx = -1;
  let unb = 0, unbStart = -1;
  let firstIdx = -1;
  let prev = -1;
  for (let w = 0; w < td.words; w++) {
    if (!q[w]) continue;
    for (let b = 0; b < 32; b++) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      if (firstIdx < 0) firstIdx = i;
      const r = results[i];
      if (r === dir) len++;
      else {
        if (dir === 'W' || dir === 'L') keep(dir, len, startIdx, prev);
        dir = r; len = 1; startIdx = i;
      }
      if (r !== 'L') { if (!unb) unbStart = i; unb++; }
      else { keep('U', unb, unbStart, prev); unb = 0; }
      prev = i;
    }
  }
  if (dir === 'W' || dir === 'L') keep(dir, len, startIdx, prev);
  keep('U', unb, unbStart, prev);
  // a run that starts at the first qualifying game may run past the window
  for (const run of Object.values(best)) {
    if (!run) continue;
    run.atEdge = run.startIdx === firstIdx;
    run.live = run.lastIdx === prev;
  }
  return best;
}

// The run of `hit` games (covered or missed) over the masked sequence's lined
// games: the trailing one for 'active', the longest (latest on a tie) for 'all'.
export function spreadWalk(td: TeamData, q: Uint32Array, hit: Uint32Array, scope: Scope): Run | null {
  const bit = (m: Uint32Array, i: number) => (m[i >> 5] & (1 << (i & 31))) !== 0;
  const idx: number[] = [];
  for (let w = 0; w < td.words; w++) {
    const x = q[w] & td.lined[w];
    if (!x) continue;
    for (let b = 0; b < 32; b++) if (x & (1 << b)) { const i = (w << 5) | b; if (i < td.n) idx.push(i); }
  }
  if (!idx.length) return null;
  if (scope === 'active') {
    let k = idx.length - 1;
    while (k >= 0 && bit(hit, idx[k])) k--;
    const len = idx.length - 1 - k;
    return len ? { len, atEdge: k < 0, lastIdx: idx[idx.length - 1], startIdx: idx[k + 1], live: true } : null;
  }
  let best: Run | null = null;
  let run = 0;
  for (let k = 0; k < idx.length; k++) {
    if (bit(hit, idx[k])) {
      run++;
      if (!best || run >= best.len) best = { len: run, atEdge: k + 1 === run, lastIdx: idx[k], startIdx: idx[k - run + 1], live: k === idx.length - 1 };
    } else run = 0;
  }
  return best;
}

/** The plain chips (indices) that keep more than NEAR_UNIVERSAL of every team's games. */
export function nearUniversalChips(data: TeamData[] = teamData()): Set<number> {
  const games = data.reduce((a, td) => a + td.n, 0);
  const out = new Set<number>();
  NP.forEach((_, i) => {
    let kept = 0;
    for (const td of data) for (const w of td.masks[i]) kept += popcount(w);
    if (kept > NEAR_UNIVERSAL * games) out.add(i);
  });
  return out;
}

async function mine(scope: Scope): Promise<{ raw: Map<number, MinedCrown[]>; M: number[]; teams: number }> {
  const data = teamData();
  const T = data.map((d) => d.ti);
  const walk = scope === 'all' ? walkLongest : walkActive;
  const loose = nearUniversalChips(data);

  const subsets: number[][] = [];
  (function rec(start: number, chosen: number[]) {
    subsets.push(chosen);
    if (chosen.length === 4) return;
    for (let i = start; i < NP.length; i++) {
      const c = NP[i];
      if (loose.has(i) || chosen.some((j) => conflicts(NP[j], c))) continue;
      rec(i + 1, [...chosen, i]);
    }
  })(0, []);

  const M = [0, 0, 0, 0, 0];
  for (const s of subsets) M[s.length]++;

  const perTeam = new Map(T.map((ti) => [ti, new Map<string, MinedCrown>()])); // dedupe key -> crown
  const q = data.map((td) => new Uint32Array(td.words));
  const res: Runs[] = new Array(T.length);
  let done = 0;
  for (const def of subsets) {
    // yield to the main thread so the tab stays responsive while mining
    if (++done % 1500 === 0) await new Promise((r) => setTimeout(r, 0));
    for (let t = 0; t < T.length; t++) {
      const td = data[t];
      const qb = q[t];
      if (def.length === 0) qb.fill(0xffffffff);
      else {
        qb.set(td.masks[def[0]]);
        for (let d = 1; d < def.length; d++) {
          const md = td.masks[def[d]];
          for (let w = 0; w < td.words; w++) qb[w] &= md[w];
        }
      }
      res[t] = walk(td, qb);
      const c = spreadWalk(td, qb, td.covered, scope);
      if (c) res[t].C = c;
      const nc = spreadWalk(td, qb, td.missed, scope);
      if (nc) res[t].N = nc;
      Object.assign(res[t], asMarginRuns(walk(td, qb, td.rM), MINED_MARGIN));
    }
    // the definition's outcome rates over every team's games, counted once
    // and only when it names a king: [qualifying, won, lost, lined, covered, missed, won by the margin, lost by it]
    let pooled: number[] | null = null;
    const rateOf = (dir: Dir) => {
      if (!pooled) {
        pooled = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let t = 0; t < T.length; t++) {
          const td = data[t], qb = q[t];
          // the empty definition fills every bit, past the last game too
          for (let w = 0; w < td.words; w++) {
            const rem = td.n - (w << 5);
            pooled[0] += popcount(rem >= 32 ? qb[w] : qb[w] & ((1 << rem) - 1));
          }
          pooled[1] += countAnd(qb, td.won);
          pooled[2] += countAnd(qb, td.lost);
          pooled[3] += countAnd(qb, td.lined);
          pooled[4] += countAnd(qb, td.covered);
          pooled[5] += countAnd(qb, td.missed);
          pooled[6] += countAnd(qb, td.wonM);
          pooled[7] += countAnd(qb, td.lostM);
        }
      }
      const [g, won, lost, lined, cov, miss, wonM, lostM] = pooled;
      const [hit, n] = dir === 'W' ? [won, g] : dir === 'L' ? [lost, g] : dir === 'U' ? [g - lost, g] : dir === 'C' ? [cov, lined] : dir === 'N' ? [miss, lined] : dir === `W${MINED_MARGIN}` ? [wonM, g] : [lostM, g];
      return { p: n ? hit / n : 1, n };
    };
    for (const dir of MINED_OUTCOMES) {
      if (def.some((i) => !fitsDir(NP[i], dir))) continue;
      let best = 0;
      let leader = -1;
      let leaders = 0;
      let field = 0;
      for (let t = 0; t < T.length; t++) {
        const s = res[t][dir];
        if (!s || s.len === 0) continue;
        field++;
        if (s.len > best) { best = s.len; leader = t; leaders = 1; }
        else if (s.len === best) leaders++;
      }
      if (leaders !== 1 || leader < 0) continue;
      const s = res[leader][dir]!;
      if (s.len < LEN_FLOOR || field < FIELD_FLOOR) continue;
      const key = dir + '|' + s.lastIdx + '|' + s.len;
      const held = perTeam.get(T[leader])!;
      const prev = held.get(key);
      if (!prev) {
        const gs = data[leader].gs;
        held.set(key, {
          chips: def.map((i) => NP[i].key),
          dir, scope, len: s.len, atEdge: s.atEdge, field,
          startSe: gs[s.startIdx]?.se,
          endSe: gs[s.lastIdx]?.se,
          live: s.live,
          also: 0,
          ...rateOf(dir),
        });
      } else {
        prev.also++;
        if (def.length < prev.chips.length || (def.length === prev.chips.length && field > prev.field)) {
          prev.chips = def.map((i) => NP[i].key);
          prev.field = Math.max(prev.field, field);
          // same last game and length doesn't mean the same first game
          const gs = data[leader].gs;
          prev.startSe = gs[s.startIdx]?.se;
          prev.endSe = gs[s.lastIdx]?.se;
          prev.atEdge = s.atEdge;
          prev.live = s.live;
          Object.assign(prev, rateOf(dir));
        }
      }
    }
  }

  const raw = new Map<number, MinedCrown[]>();
  for (const [ti, held] of perTeam) raw.set(ti, [...held.values()]);
  return { raw, M, teams: T.length };
}

/** Every crown each team holds, unfiltered, with its definition's pooled rate. The crown tuner reads these. */
export function mineRawCrowns(scope: Scope = 'active'): Promise<Map<number, MinedCrown[]>> {
  return (mining[scope] ??= mine(scope).then(({ raw, M, teams }) => {
    const cache = new Map<number, Crown[]>();
    for (const [ti, list] of raw) cache.set(ti, rankCrowns(list, { M, teams }));
    caches[scope] = cache;
    return raw;
  }));
}

/** The crowns worth showing per team, best first (crownRank.ts). */
export async function mineCrowns(scope: Scope = 'active'): Promise<Map<number, Crown[]>> {
  if (!caches[scope]) await mineRawCrowns(scope);
  return caches[scope]!;
}

export const isMined = (scope: Scope = 'active') => !!caches[scope];

export function crownsFor(ti: number, scope: Scope = 'active'): Crown[] {
  return caches[scope]?.get(ti) ?? [];
}
