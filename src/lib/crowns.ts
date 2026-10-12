// Mine every team's streaks under every definition: each ≤4-chip subset of
// the mined chips (minedChips.ts: the plain catalog plus every opponent,
// month, state and half choice; exclusivity honored) × the seven mined
// outcomes (the plain five, and won or lost by 10+), evaluated over packed
// per-chip bitmasks. The space is 23M definitions, but an AND only shrinks a
// mask and the floors are monotone, so the walk goes depth-first carrying
// each prefix's AND and drops a prefix the moment fewer than FIELD_FLOOR
// teams keep any qualifying game or none keeps LEN_FLOOR; about a million
// definitions survive. The build mines it once (scripts/prerender.mjs) and
// writes the raw result to a file the tests can read in its place
// (STREAK_MINED, at the end of this file); the dev server mines it in the page.
//
// Three readings of each definition, from one walk:
//   'active'  every team's current run, with its place in the field
//   'all'     every team's longest run ever, ended or not, likewise
//   broken    every run a current-season game ended, with the team's place
//             in the field as that week began (broken.ts tells them)
// A run is kept when it is LEN_FLOOR or longer, FIELD_FLOOR teams hold any
// run under the definition, and it scores above KEEP_FLOOR (crownRank.ts).
// Definitions that produce the identical run (same outcome, last game and
// length) collapse to the best-scoring telling; `also` counts the rest.
// Each run carries its definition's pooled rate; crownRank.ts picks which
// of a team's runs to show and orders them.

import type { Crown, Dir, GameRow, Result, Scope } from './types.ts';
import { conflicts, fitsDir, qualifies } from './chips.ts';
import { MINED_CHIPS } from './minedChips.ts';
import { RANK, crownScore, rankCrowns } from './crownRank.ts';
import type { MinedCrown } from './crownRank.ts';
import { P, fbsNow, gamesOf } from './model.ts';
import { MINED_OUTCOMES } from './streaks.ts';
import { MINED_MARGIN, marginDir } from './outcome.ts';
import { completedWeeks, weekIdx, weekStart } from './weeks.ts';

/**
 * One team's games for the walks: per-chip masks, the result of each game
 * (`r`), and the result by the mined margin (`rM`: W won by 10+, L lost by
 * 10+, T neither, so the same walks find margin runs), with the masks the
 * pooled rates count.
 */
export interface TeamData { ti: number; gs: GameRow[]; n: number; words: number; masks: Uint32Array[]; r: Result[]; rM: Result[]; rC: Result[]; won: Uint32Array; lost: Uint32Array; lined: Uint32Array; covered: Uint32Array; missed: Uint32Array; wonM: Uint32Array; lostM: Uint32Array }
// live: no later qualifying game broke the run
export interface Run { len: number; atEdge: boolean; lastIdx: number; startIdx: number; live: boolean }
export type Runs = Partial<Record<Dir, Run>>;

export const LEN_FLOOR = 4;
export const FIELD_FLOOR = 10;
/** A run scoring under this is never kept; the cutoff is above it so a team with nothing past the cutoff still has its best few. */
export const KEEP_FLOOR = RANK.cutoff - 6;
/** How many of a team's runs a scope keeps after ranking: the page shows six and the rest behind "more". */
export const ROWS_CAP = 60;
/**
 * A chip that keeps more than this share of all games ("on a weekend", 91%)
 * barely filters: added to a definition it mostly lets a streak skip a stray
 * weeknight game. It stays in the menus but never names a crown.
 */
export const NEAR_UNIVERSAL = 0.9;

const NP = MINED_CHIPS;

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
    // against the spread as a result: W covered, L missed, T a push (ends either run)
    const rC: Result[] = gs.map((g) => (g.cover === 'W' ? 'W' : g.cover === 'L' ? 'L' : 'T'));
    for (let i = 0; i < n; i++) {
      if (gs[i].r === 'W') won[i >> 5] |= 1 << (i & 31);
      if (gs[i].r === 'L') lost[i >> 5] |= 1 << (i & 31);
      if (rM[i] === 'W') wonM[i >> 5] |= 1 << (i & 31);
      if (rM[i] === 'L') lostM[i >> 5] |= 1 << (i & 31);
      if (gs[i].cover != null) lined[i >> 5] |= 1 << (i & 31);
      if (gs[i].cover === 'W') covered[i >> 5] |= 1 << (i & 31);
      if (gs[i].cover === 'L') missed[i >> 5] |= 1 << (i & 31);
    }
    return { ti, gs, n, words, masks, r: gs.map((x) => x.r), rM, rC, won, lost, lined, covered, missed, wonM, lostM };
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

/** One run a current-season game ended, as the broken walk finds it: `kind` 0 a run of W, 1 of L, 2 the undefeated run. */
export interface EndedRun extends Run { enderIdx: number; w: number; kind: 0 | 1 | 2 }
/** What the broken walk returns for one result sequence: the runs ended, and each week's entering run lengths [W, L, U] by week index into completedWeeks(). */
interface Ended { runs: EndedRun[]; entering: Int16Array[] }

// Every run of W, L or U over the masked sequence that a game of a completed
// week ended, and the run lengths entering each completed week (for the
// field and rank as the week began). `results` is the sequence to read.
function walkEnded(td: TeamData, q: Uint32Array, results: Result[], weeks: readonly { w: number }[], weekIndex: ReadonlyMap<number, number>, floor: number): Ended {
  const W = weeks.length;
  const entering = [new Int16Array(W), new Int16Array(W), new Int16Array(W)]; // [W, L, U]
  const runs: EndedRun[] = [];
  let dir: Result | null = null;
  let len = 0, startIdx = -1;
  let unb = 0, unbStart = -1;
  let prev = -1, firstIdx = -1;
  let wp = 0;
  for (let w = 0; w < td.words; w++) {
    if (!q[w]) continue;
    for (let b = 0; b < 32; b++) {
      if (!(q[w] & (1 << b))) continue;
      const i = (w << 5) | b;
      if (i >= td.n) continue;
      if (firstIdx < 0) firstIdx = i;
      const ep = td.gs[i].ep;
      // the weeks this game is the first of or past: record what the team carried in
      while (wp < W && ep >= weekStart(weeks[wp].w)) {
        entering[0][wp] = dir === 'W' ? len : 0;
        entering[1][wp] = dir === 'L' ? len : 0;
        entering[2][wp] = unb;
        wp++;
      }
      const r = results[i];
      const gw = weekIndex.get(weekIdx(ep)); // the game's week, as an index into the completed weeks; undefined before the season
      if (r === dir) len++;
      else {
        if ((dir === 'W' || dir === 'L') && len >= floor && gw != null) runs.push({ len, atEdge: startIdx === firstIdx, lastIdx: prev, startIdx, live: false, enderIdx: i, w: gw, kind: dir === 'W' ? 0 : 1 });
        dir = r; len = 1; startIdx = i;
      }
      if (r !== 'L') { if (!unb) unbStart = i; unb++; }
      else {
        if (unb >= floor && gw != null) runs.push({ len: unb, atEdge: unbStart === firstIdx, lastIdx: prev, startIdx: unbStart, live: false, enderIdx: i, w: gw, kind: 2 });
        unb = 0;
      }
      prev = i;
    }
  }
  while (wp < W) { entering[0][wp] = dir === 'W' ? len : 0; entering[1][wp] = dir === 'L' ? len : 0; entering[2][wp] = unb; wp++; }
  return { runs, entering };
}

/** The mined chips (indices) that keep more than NEAR_UNIVERSAL of every team's games. */
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

/** A run a current-season game ended, with the definition's rate and the team's place in the field as the week began. */
export interface BrokenRun extends MinedCrown {
  ti: number;
  /** The game that broke it, as an index into the team's games. */
  enderIdx: number;
  /** The week it broke, as an index into completedWeeks(). */
  w: number;
  /** The run's first game, as an index into the team's games. */
  startIdx: number;
}

export interface Mined {
  active: Map<number, MinedCrown[]>;
  all: Map<number, MinedCrown[]>;
  broken: Map<number, BrokenRun[]>;
  teams: number;
}

// the rank of each run among a field of lengths: 1 + how many are longer,
// how many are level with it, and the longest any other run reaches
function placesOf(lens: ArrayLike<number>) {
  const counts = new Map<number, number>();
  let best = 0, bestN = 0;
  for (let t = 0; t < lens.length; t++) {
    const l = lens[t];
    if (!l) continue;
    counts.set(l, (counts.get(l) ?? 0) + 1);
    if (l > best) { best = l; bestN = 1; } else if (l === best) bestN++;
  }
  let second = 0;
  for (const l of counts.keys()) if (l < best && l > second) second = l;
  const longer = new Map<number, number>();
  let acc = 0;
  for (const l of [...counts.keys()].sort((a, b) => b - a)) { longer.set(l, acc); acc += counts.get(l)!; }
  return {
    rank: (len: number) => 1 + (longer.get(len) ?? 0),
    tied: (len: number) => counts.get(len) ?? 1,
    /** the longest run any other team holds, for a run of `len` */
    other: (len: number) => (len === best ? (bestN > 1 ? best : second) : best),
  };
}

// the kind of result each scan reads, and the outcome each of its runs names
const SCANS: { results: (td: TeamData) => Result[]; dirs: [Dir | null, Dir | null, Dir | null] }[] = [
  { results: (td) => td.r, dirs: ['W', 'L', 'U'] },
  { results: (td) => td.rM, dirs: [marginDir('W', MINED_MARGIN), marginDir('L', MINED_MARGIN), null] },
  { results: (td) => td.rC, dirs: ['C', 'N', null] },
];

async function mineAll(): Promise<Mined> {
  const data = teamData();
  const T = data.length;
  const loose = nearUniversalChips(data);
  const weeks = completedWeeks();
  const weekIndex = new Map(weeks.map((x, k) => [x.w, k]));
  const ctx = { teams: T };
  const perTeam = { active: data.map(() => new Map<string, MinedCrown>()), all: data.map(() => new Map<string, MinedCrown>()) };
  const broken = data.map(() => new Map<string, BrokenRun>());

  // the prefix AND per depth and team, and which teams keep a qualifying game
  const q = Array.from({ length: 5 }, () => data.map((td) => new Uint32Array(td.words)));
  const alive = Array.from({ length: 5 }, () => new Uint8Array(T));
  for (let t = 0; t < T; t++) { q[0][t].fill(0xffffffff); alive[0][t] = 1; }
  const lens = new Int32Array(T);
  const resActive: Runs[] = new Array(T);
  const resAll: Runs[] = new Array(T);
  const ended: (Ended | null)[][] = [new Array(T), new Array(T), new Array(T)];

  // the definition's outcome rates over every team's games: [qualifying, won, lost, lined, covered, missed, won by the margin, lost by it]
  const pooled = [0, 0, 0, 0, 0, 0, 0, 0];
  const rateOf = (dir: Dir) => {
    const [g, won, lost, lined, cov, miss, wonM, lostM] = pooled;
    const [hit, n] = dir === 'W' ? [won, g] : dir === 'L' ? [lost, g] : dir === 'U' ? [g - lost, g] : dir === 'C' ? [cov, lined] : dir === 'N' ? [miss, lined] : dir === `W${MINED_MARGIN}` ? [wonM, g] : [lostM, g];
    return { p: n ? hit / n : 1, n };
  };

  // one definition: every team's runs under it, kept when they stand out
  const evaluate = (chips: number[], depth: number) => {
    const keys = chips.map((i) => NP[i].key);
    const qd = q[depth], ad = alive[depth];
    pooled.fill(0);
    for (let t = 0; t < T; t++) {
      if (!ad[t]) { resActive[t] = {}; resAll[t] = {}; ended[0][t] = ended[1][t] = ended[2][t] = null; continue; }
      const td = data[t], qb = qd[t];
      let r: Runs = walkActive(td, qb);
      let c = spreadWalk(td, qb, td.covered, 'active');
      if (c) r.C = c;
      let nc = spreadWalk(td, qb, td.missed, 'active');
      if (nc) r.N = nc;
      Object.assign(r, asMarginRuns(walkActive(td, qb, td.rM), MINED_MARGIN));
      resActive[t] = r;
      r = walkLongest(td, qb);
      c = spreadWalk(td, qb, td.covered, 'all');
      if (c) r.C = c;
      nc = spreadWalk(td, qb, td.missed, 'all');
      if (nc) r.N = nc;
      Object.assign(r, asMarginRuns(walkLongest(td, qb, td.rM), MINED_MARGIN));
      resAll[t] = r;
      for (let s = 0; s < 3; s++) ended[s][t] = weeks.length ? walkEnded(td, s === 2 ? andLined(td, qb) : qb, SCANS[s].results(td), weeks, weekIndex, LEN_FLOOR) : null;
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
    for (const dir of MINED_OUTCOMES) {
      if (chips.some((i) => !fitsDir(NP[i], dir))) continue;
      const { p, n } = rateOf(dir);
      for (const scope of ['active', 'all'] as const) {
        const res = scope === 'active' ? resActive : resAll;
        let field = 0;
        for (let t = 0; t < T; t++) { lens[t] = res[t][dir]?.len ?? 0; if (lens[t]) field++; }
        if (field < FIELD_FLOOR) continue;
        const places = placesOf(lens);
        for (let t = 0; t < T; t++) {
          const s = res[t][dir];
          if (!s || s.len < LEN_FLOOR) continue;
          const gs = data[t].gs;
          const mined: MinedCrown = {
            chips: keys, dir, scope, len: s.len, atEdge: s.atEdge, field,
            rank: places.rank(s.len), tied: places.tied(s.len), second: places.other(s.len),
            startSe: gs[s.startIdx]?.se, endSe: gs[s.lastIdx]?.se, live: s.live, also: 0, p, n,
          };
          const score = crownScore(mined, ctx);
          if (score < KEEP_FLOOR && chips.length) continue;
          const key = dir + '|' + s.lastIdx + '|' + s.len;
          const held = perTeam[scope][t];
          const prev = held.get(key);
          if (!prev) held.set(key, mined);
          else {
            mined.also = prev.also + 1;
            held.set(key, score > crownScore(prev, ctx) ? mined : Object.assign(prev, { also: mined.also }));
          }
        }
      }
    }
    if (!weeks.length) return;
    // the runs the season's games ended, placed among what every team carried into that week
    for (let s = 0; s < 3; s++) {
      for (let k = 0; k < 3; k++) {
        const dir = SCANS[s].dirs[k];
        if (!dir || chips.some((i) => !fitsDir(NP[i], dir))) continue;
        const { p, n } = rateOf(dir);
        const placesByWeek = new Map<number, { field: number; places: ReturnType<typeof placesOf> }>();
        for (let t = 0; t < T; t++) {
          const e = ended[s][t];
          if (!e) continue;
          for (const run of e.runs) {
            if (run.kind !== k) continue;
            let pw = placesByWeek.get(run.w);
            if (!pw) {
              let field = 0;
              for (let u = 0; u < T; u++) { lens[u] = ended[s][u]?.entering[k][run.w] ?? 0; if (lens[u]) field++; }
              pw = { field, places: placesOf(lens) };
              placesByWeek.set(run.w, pw);
            }
            if (pw.field < FIELD_FLOOR) continue;
            const gs = data[t].gs;
            const mined: BrokenRun = {
              ti: data[t].ti, chips: keys, dir, scope: 'active', len: run.len, atEdge: run.atEdge, field: pw.field,
              rank: pw.places.rank(run.len), tied: pw.places.tied(run.len), second: pw.places.other(run.len),
              startSe: gs[run.startIdx].se, endSe: gs[run.lastIdx].se, live: false, also: 0, p, n,
              enderIdx: run.enderIdx, w: run.w, startIdx: run.startIdx,
            };
            const score = crownScore(mined, ctx);
            if (score < KEEP_FLOOR && chips.length) continue;
            // the identical run (same games) under another definition collapses; a different run the same game ended stands
            const key = dir + '|' + run.enderIdx + '|' + run.startIdx + '|' + run.len;
            const held = broken[t];
            const prev = held.get(key);
            if (!prev) held.set(key, mined);
            else {
              mined.also = prev.also + 1;
              held.set(key, score > crownScore(prev, ctx) ? mined : Object.assign(prev, { also: mined.also }));
            }
          }
        }
      }
    }
  };

  // depth-first over the subsets, the prefix's AND carried down
  let done = 0;
  const rec = async (start: number, depth: number, chosen: number[]) => {
    // yield to the main thread so the tab stays responsive while mining
    if (++done % 2000 === 0) await new Promise((r) => setTimeout(r, 0));
    evaluate(chosen, depth);
    if (depth === 4) return;
    for (let i = start; i < NP.length; i++) {
      if (loose.has(i) || chosen.some((j) => conflicts(NP[j], NP[i]))) continue;
      let field = 0, able = 0;
      for (let t = 0; t < T; t++) {
        alive[depth + 1][t] = 0;
        if (!alive[depth][t]) continue;
        const a = q[depth][t], b = data[t].masks[i], o = q[depth + 1][t];
        let n = 0;
        for (let w = 0; w < a.length; w++) { o[w] = a[w] & b[w]; n += popcount(o[w]); }
        // a team with any qualifying game holds a run (it counts in the field); only one with LEN_FLOOR can be kept
        if (n) { alive[depth + 1][t] = 1; field++; if (n >= LEN_FLOOR) able++; }
      }
      if (field < FIELD_FLOOR || !able) continue;
      await rec(i + 1, depth + 1, [...chosen, i]);
    }
  };
  await rec(0, 0, []);

  const out = (maps: Map<string, MinedCrown>[]) => new Map(data.map((td, t) => [td.ti, [...maps[t].values()]]));
  return { active: out(perTeam.active), all: out(perTeam.all), broken: new Map(data.map((td, t) => [td.ti, [...broken[t].values()]])), teams: T };
}

// the lined games of a masked sequence, for the spread scans
const linedBuf = new WeakMap<TeamData, Uint32Array>();
function andLined(td: TeamData, q: Uint32Array): Uint32Array {
  let o = linedBuf.get(td);
  if (!o) linedBuf.set(td, (o = new Uint32Array(td.words)));
  for (let w = 0; w < td.words; w++) o[w] = q[w] & td.lined[w];
  return o;
}

// --- the raw mine as a file, so one build's mine can feed the test suite ---
//
// A mine is pure in the payload, the chips walked and the keep floor, so a
// file stamped with those three is the mine of the same code over the same
// data. The build writes it (scripts/prerender.mjs) and, with STREAK_MINED
// naming it, mineRaw() in Node reads it instead of mining; CI sets the
// variable so the build's mine serves the tests. The file is only read when
// the variable is set, so a stale local file never feeds a run by accident,
// and a file whose stamp differs is ignored with a warning.

/** The raw mine as JSON: the Maps as arrays of [team, rows] pairs, under the stamp. */
export interface MinedFile {
  stamp: string;
  teams: number;
  active: [number, MinedCrown[]][];
  all: [number, MinedCrown[]][];
  broken: [number, BrokenRun[]][];
}

// FNV-1a over a string, as 8 hex digits: enough to tell one chip list from another
const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** What a raw mine depends on: the payload's build time, the chips walked (count and a hash of their keys) and the keep floor. */
export const MINE_STAMP = `payload ${P.builtAt} · chips ${NP.length}/${fnv(NP.map((c) => c.key).join(','))} · keep ${KEEP_FLOOR}`;

export const encodeMined = (m: Mined): MinedFile => ({ stamp: MINE_STAMP, teams: m.teams, active: [...m.active], all: [...m.all], broken: [...m.broken] });

/** The mine a file holds, or null (with a warning naming `source`) when the file was mined for another payload, chip list or floor. */
export function decodeMined(f: MinedFile, source: string): Mined | null {
  if (f.stamp !== MINE_STAMP) {
    console.warn(`${source} was mined for another payload, chip list or floor (${f.stamp}; this build is ${MINE_STAMP}); mining instead`);
    return null;
  }
  return { active: new Map(f.active), all: new Map(f.all), broken: new Map(f.broken), teams: f.teams };
}

// the file STREAK_MINED names, read in Node only: the browser has no
// process (the project carries no node types, hence globalThis), so the
// bundle never runs this branch, and the import is hidden from the bundler
// so it never tries to resolve node:fs for the page
async function readMined(): Promise<Mined | null> {
  const file = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.STREAK_MINED;
  if (!file) return null;
  const fs: { existsSync(p: string): boolean; readFileSync(p: string, enc: 'utf8'): string } = await import(/* @vite-ignore */ 'node:' + 'fs');
  if (!fs.existsSync(file)) {
    console.warn(`STREAK_MINED=${file}: no such file; mining instead`);
    return null;
  }
  const t0 = Date.now();
  const m = decodeMined(JSON.parse(fs.readFileSync(file, 'utf8')) as MinedFile, `STREAK_MINED=${file}`);
  if (m) console.log(`read the mine from ${file} in ${Date.now() - t0}ms (${MINE_STAMP})`);
  return m;
}

let mining: Promise<Mined> | null = null;

/** Every team's runs under every definition, in every scope, unfiltered. Mined once, or read from the file STREAK_MINED names. */
export function mineRaw(): Promise<Mined> {
  return (mining ??= readMined().then((m) => m ?? mineAll()));
}

const caches: Record<Scope, Map<number, Crown[]> | null> = { active: null, all: null };

/** The runs worth showing per team, best first (crownRank.ts). */
export async function mineCrowns(scope: Scope = 'active'): Promise<Map<number, Crown[]>> {
  if (!caches[scope]) {
    const m = await mineRaw();
    const cache = new Map<number, Crown[]>();
    for (const [ti, list] of m[scope]) cache.set(ti, rankCrowns(list, { teams: m.teams }).slice(0, ROWS_CAP));
    caches[scope] = cache;
  }
  return caches[scope]!;
}

/** Every run a current-season game ended, per team, unfiltered (broken.ts tells them). */
export async function mineBroken(): Promise<{ broken: Map<number, BrokenRun[]>; teams: number }> {
  const m = await mineRaw();
  return { broken: m.broken, teams: m.teams };
}

export const isMined = (scope: Scope = 'active') => !!caches[scope];

export function crownsFor(ti: number, scope: Scope = 'active'): Crown[] {
  return caches[scope]?.get(ti) ?? [];
}
