// Mine every team's streaks under every definition: each ≤4-chip subset of
// the mined chips (minedChips.ts: the plain catalog plus every opponent,
// month, state and half choice; exclusivity honored) × the seven mined
// outcomes (the plain five, and won or lost by 10+), evaluated over packed
// per-chip bitmasks. The space is 23M definitions, but an AND only shrinks a
// mask and the floors are monotone, so the walk goes depth-first carrying
// each prefix's AND and drops a prefix the moment fewer than FIELD_FLOOR
// teams keep any qualifying game or none keeps LEN_FLOOR; about a million
// definitions survive. The walk itself is mineCore.js, plain JavaScript, so
// it runs on worker threads: the build mines it once across every core
// (scripts/prerender.mjs; or reads a file, STREAK_MINED, at the end of this
// file), and the dev server mines it in the page on Web Workers.
//
// Four readings of each definition, from one walk:
//   'active'  every team's current run, with its place in the field
//   'all'     every team's longest run ever, ended or not, likewise
//   broken    every run a game ended, with the team's place in the field as
//             that week began (broken.ts tells them): every game of the
//             running season under every definition, and every game since
//             1936 under the definitions of up to HIST_CHIPS chips
//   leaders   every week a team became the sole leader of a definition's
//             field, with the game that did it (seasons.ts tells them)
// A run is kept when it is LEN_FLOOR or longer, FIELD_FLOOR teams hold any
// run under the definition, and it scores above KEEP_FLOOR (crownRank.ts).
// Definitions that produce the identical run (same outcome, last game and
// length) collapse to the best-scoring telling; `also` counts the rest.
// Each run carries its definition's pooled rate; crownRank.ts picks which
// of a team's runs to show and orders them.

import type { Crown, Dir, GameRow, Result, Scope } from './types.ts';
import { conflicts, fitsDir, qualifies } from './chips.ts';
import { MINED_CHIPS } from './minedChips.ts';
import { RANK, rankCrowns, wordCost } from './crownRank.ts';
import type { MinedCrown } from './crownRank.ts';
import { P, fbsNow, gamesOf } from './model.ts';
import { MINED_OUTCOMES } from './streaks.ts';
import { MINED_MARGIN, marginDir } from './outcome.ts';
import { completedWeeks, weekIdx } from './weeks.ts';
import { mineCore } from './mineCore.js';
import { SHEET_DIRS } from './team.ts';

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
/** A run scoring under this is never kept; the cutoff is above it so a team with nothing past the cutoff still has its best few. */
export const KEEP_FLOOR = RANK.cutoff - 6;
/** Definitions of up to this many chips are read for every game since 1936; longer ones for the running season only. */
export const HIST_CHIPS = 2;
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
// kings.ts walks one definition at a time with these.
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

/** A run a game ended, with the definition's rate and the team's place in the field as the week began. */
export interface BrokenRun extends MinedCrown {
  ti: number;
  /** The game that broke it, as an index into the team's games. */
  enderIdx: number;
  /** The week it broke: the grid week (weeks.ts weekIdx) of the ender. */
  week: number;
  /** The run's first game, as an index into the team's games. */
  startIdx: number;
  /** The longest run ever under the definition, by any team, and how many teams' longest it is: a broken run of that length is now the all-time longest. */
  everLen: number;
  everN: number;
}

/** A team that became a definition's sole leader after a week, with the game that did it. */
export interface LeaderRun extends MinedCrown {
  ti: number;
  /** The grid week after which the team led. */
  week: number;
  /** The leader before, -1 when the field had no sole leader, and what it (or the tied leaders) held entering the week; `second` is the longest other run after the week. */
  prev: number;
  prevLen: number;
  /** The game that did it, from `causeT`'s games: the old leader's run ending, else the new leader's own game. */
  causeT: number;
  causeIdx: number;
  startIdx: number;
}

export interface Mined {
  active: Map<number, MinedCrown[]>;
  all: Map<number, MinedCrown[]>;
  broken: Map<number, BrokenRun[]>;
  leaders: Map<number, LeaderRun[]>;
  teams: number;
}

// --- the walk's inputs and outputs, in plain data (mineCore.js) ---

const code = (r: Result) => (r === 'W' ? 1 : r === 'L' ? 2 : 0);

/** The week grid the walk records: every grid week with a game, and where the running season's completed weeks start in it. */
export function weekGrid(data: TeamData[] = teamData()) {
  const set = new Set<number>();
  for (const td of data) for (const g of td.gs) set.add(weekIdx(g.ep));
  const weeks = [...set].sort((a, b) => a - b);
  const index = new Map(weeks.map((w, i) => [w, i]));
  const first = completedWeeks()[0]?.w;
  const wFrom = first == null ? weeks.length : index.get(first) ?? weeks.length;
  return { weeks, index, wFrom };
}

function mineInput(data: TeamData[]) {
  const loose = nearUniversalChips(data);
  const grid = weekGrid(data);
  const n = NP.length;
  const conflict = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (conflicts(NP[i], NP[j])) conflict[i * n + j] = 1;
  const fits = new Uint8Array(n * 7);
  NP.forEach((c, i) => MINED_OUTCOMES.forEach((d, k) => { if (fitsDir(c, d)) fits[i * 7 + k] = 1; }));
  return {
    teams: data.map((td) => ({
      n: td.n, words: td.words, masks: td.masks,
      r: Int8Array.from(td.r, code), rM: Int8Array.from(td.rM, code),
      rC: Int8Array.from(td.gs, (g) => (g.cover === 'W' ? 1 : g.cover === 'L' ? 2 : 0)),
      lined: td.lined, won: td.won, lost: td.lost, covered: td.covered, missed: td.missed, wonM: td.wonM, lostM: td.lostM,
      se: Int16Array.from(td.gs, (g) => g.se),
      wkOf: Int32Array.from(td.gs, (g) => grid.index.get(weekIdx(g.ep)) ?? -1),
    })),
    chips: {
      n, conflict, fits,
      loose: Uint8Array.from(NP, (_, i) => (loose.has(i) ? 1 : 0)),
      cost: Float64Array.from(NP, (c) => wordCost([c.key])),
    },
    weeks: { count: grid.weeks.length, wFrom: grid.wFrom, wHist: 0 },
    floors: { LEN_FLOOR, FIELD_FLOOR, KEEP_FLOOR },
    rank: { chanceW: RANK.chanceW, gapW: RANK.gapW, gapFloor: RANK.gapFloor, spanA: RANK.spanA, spanAll: RANK.spanAll, PMAX: 0.995, cutoff: RANK.cutoff, teams: data.length },
    prefix: [] as number[], descend: false, maxChips: 4, histChips: HIST_CHIPS,
  };
}
/** One piece of the walk: the definition `prefix` names and, when `descend`, everything below it. */
interface Piece { prefix: number[]; descend: boolean }
/** The first chips whose subtrees are split at the second chip: the plain chips come first and their subtrees dwarf the rest. */
const SPLIT_ROOTS = 16;

// what mineCore returns: per team, per reading, the candidates with chip indices and game indices
interface CoreRun { chips: number[]; dir: Dir; scope: Scope; len: number; atEdge: boolean; field: number; rank: number; tied: number; second: number; startIdx: number; lastIdx: number; live: boolean; also: number; p: number; n: number; score: number; enderIdx?: number; w?: number; everLen?: number; everN?: number; prevT?: number; prevLen?: number; causeT?: number; causeIdx?: number }
interface CoreOut { active: CoreRun[][]; all: CoreRun[][]; broken: CoreRun[][]; leaders: CoreRun[][] }

// the threads' outputs, merged: the identical run found in two subtrees collapses as it would in one
function merge(data: TeamData[], parts: CoreOut[]): Mined {
  const grid = weekGrid(data);
  const keyOf = { active: (r: CoreRun) => `${r.dir}|${r.lastIdx}|${r.len}`, all: (r: CoreRun) => `${r.dir}|${r.lastIdx}|${r.len}`, broken: (r: CoreRun) => `${r.dir}|${r.enderIdx}|${r.startIdx}|${r.len}`, leaders: (r: CoreRun) => `${r.dir}|${r.w}|${r.len}` };
  const out: Mined = { active: new Map(), all: new Map(), broken: new Map(), leaders: new Map(), teams: data.length };
  for (const reading of ['active', 'all', 'broken', 'leaders'] as const) {
    data.forEach((td, t) => {
      const held = new Map<string, CoreRun>();
      for (const part of parts) {
        for (const r of part[reading][t]) {
          const k = keyOf[reading](r);
          const prev = held.get(k);
          if (!prev) held.set(k, r);
          else { r.also = prev.also + r.also + 1; if (r.score > prev.score) held.set(k, r); else prev.also = r.also; }
        }
      }
      const gs = td.gs;
      const base = (r: CoreRun): MinedCrown => ({
        chips: r.chips.map((i) => NP[i].key), dir: r.dir, scope: r.scope, len: r.len, atEdge: r.atEdge, field: r.field, rank: r.rank, tied: r.tied, second: r.second,
        startSe: gs[r.startIdx]?.se, endSe: gs[r.lastIdx]?.se, live: r.live, also: r.also, p: r.p, n: r.n,
      });
      const rows = [...held.values()];
      if (reading === 'active' || reading === 'all') out[reading].set(td.ti, rows.map(base));
      else if (reading === 'broken') out.broken.set(td.ti, rows.map((r) => ({ ...base(r), ti: td.ti, enderIdx: r.enderIdx!, week: grid.weeks[r.w!], startIdx: r.startIdx, everLen: r.everLen!, everN: r.everN! })));
      // the core names teams by their index in `data`; outside it they are team indices
      else out.leaders.set(td.ti, rows.map((r) => ({ ...base(r), ti: td.ti, week: grid.weeks[r.w!], prev: r.prevT! >= 0 ? data[r.prevT!].ti : -1, prevLen: r.prevLen!, causeT: data[r.causeT!].ti, causeIdx: r.causeIdx!, startIdx: r.startIdx })));
    });
  }
  return out;
}

// The threads: Node's worker_threads at the build, Web Workers on the dev
// server, one per core. Each gets the data once and then pieces of the
// walk on demand: the empty definition, each first chip's subtree, and for
// the first SPLIT_ROOTS chips (the plain ones, whose subtrees dwarf a
// team's or a state's) the node itself and one subtree per second chip,
// so no piece is a large share of the whole.
async function mineAll(): Promise<Mined> {
  const data = teamData();
  const g = globalThis as { process?: { versions?: { node?: string } }; self?: unknown; navigator?: { hardwareConcurrency?: number } };
  const isNode = typeof g.process?.versions?.node === 'string' && typeof g.self === 'undefined';
  const cores = isNode
    ? Math.max(1, ((await import(/* @vite-ignore */ 'node:' + 'os')) as { availableParallelism?: () => number }).availableParallelism?.() ?? 4)
    : Math.max(1, g.navigator?.hardwareConcurrency ?? 2);
  const input = mineInput(data);
  const queue: Piece[] = [{ prefix: [], descend: false }];
  NP.forEach((_, i) => {
    if (i < SPLIT_ROOTS) {
      queue.push({ prefix: [i], descend: false });
      for (let j = i + 1; j < NP.length; j++) queue.push({ prefix: [i, j], descend: true });
    } else queue.push({ prefix: [i], descend: true });
  });
  const t0 = Date.now();
  const parts: CoreOut[] = [];
  const next = () => queue.shift();
  const threads = Math.min(cores, queue.length);
  if (!isNode && typeof Worker === 'undefined') {
    for (let piece = next(); piece; piece = next()) parts.push(mineCore({ ...input, ...piece }) as CoreOut);
  } else {
    await Promise.all(Array.from({ length: threads }, () => runThread(input, isNode, next, (p) => parts.push(p))));
  }
  const m = merge(data, parts);
  console.log(`mined on ${threads} threads in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return m;
}

// one thread: feeds it pieces until the queue is empty, collecting each piece's output
async function runThread(input: ReturnType<typeof mineInput>, isNode: boolean, next: () => Piece | undefined, got: (p: CoreOut) => void): Promise<void> {
  if (isNode) {
    const { Worker } = (await import(/* @vite-ignore */ 'node:' + 'worker_threads')) as { Worker: new (url: URL, opts: { workerData: unknown }) => { on(ev: string, fn: (x: unknown) => void): void; postMessage(x: unknown): void } };
    const w = new Worker(new URL('./mineWorker.js', import.meta.url), { workerData: input });
    return new Promise((resolve, reject) => {
      const feed = () => { const piece = next(); if (!piece) { w.postMessage(null); resolve(); } else w.postMessage(piece); };
      w.on('message', (m) => { got(m as CoreOut); feed(); });
      w.on('error', (e) => reject(e));
      feed();
    });
  }
  const w = new Worker(new URL('./mineWorker.js', import.meta.url), { type: 'module' });
  w.postMessage(input);
  return new Promise((resolve, reject) => {
    const feed = () => { const piece = next(); if (!piece) { w.terminate(); resolve(); } else w.postMessage(piece); };
    w.onmessage = (e) => { got(e.data as CoreOut); feed(); };
    w.onerror = (e) => reject(e);
    feed();
  });
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
  leaders: [number, LeaderRun[]][];
}

// FNV-1a over a string, as 8 hex digits: enough to tell one chip list from another
const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** What a raw mine depends on: the payload's build time, the chips walked (count and a hash of their keys), the keep floor and the history depth. */
/** The mine's row shape; bump it when a reading gains a field, so an older file re-mines. */
export const MINE_FORMAT = 2;
export const MINE_STAMP = `payload ${P.builtAt} · chips ${NP.length}/${fnv(NP.map((c) => c.key).join(','))} · keep ${KEEP_FLOOR} · hist ${HIST_CHIPS} · v${MINE_FORMAT}`;

export const encodeMined = (m: Mined): MinedFile => ({ stamp: MINE_STAMP, teams: m.teams, active: [...m.active], all: [...m.all], broken: [...m.broken], leaders: [...m.leaders] });

/** The mine a file holds, or null (with a warning naming `source`) when the file was mined for another payload, chip list or floor. */
export function decodeMined(f: MinedFile, source: string): Mined | null {
  if (f.stamp !== MINE_STAMP) {
    console.warn(`${source} was mined for another payload, chip list or floor (${f.stamp}; this build is ${MINE_STAMP}); mining instead`);
    return null;
  }
  return { active: new Map(f.active), all: new Map(f.all), broken: new Map(f.broken), leaders: new Map(f.leaders ?? []), teams: f.teams };
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

/** Every team's runs under every definition, in every reading, unfiltered. Mined once, or read from the file STREAK_MINED names. */
export function mineRaw(): Promise<Mined> {
  return (mining ??= readMined().then((m) => m ?? mineAll()));
}

const caches: Record<Scope, Map<number, Crown[]> | null> = { active: null, all: null };

/**
 * A team's streaks, best first (crownRank.ts): every run it leads its field
 * with (rank 1, ties included: the longest active, or the all-time longest),
 * under the outcomes a sheet shows, with no score floor past the miner's own,
 * the same rule as the broken runs a game ends. The page pages through them.
 */
export async function mineCrowns(scope: Scope = 'active'): Promise<Map<number, Crown[]>> {
  if (!caches[scope]) {
    const m = await mineRaw();
    const cache = new Map<number, Crown[]>();
    const w = { ...RANK, cutoff: -Infinity };
    for (const [ti, list] of m[scope]) cache.set(ti, rankCrowns(list.filter((c) => c.rank === 1 && SHEET_DIRS.includes(c.dir)), { teams: m.teams }, w));
    caches[scope] = cache;
  }
  return caches[scope]!;
}

/** Every run a game ended and every week's new leader, per team, unfiltered (broken.ts and seasons.ts tell them). */
export async function mineBroken(): Promise<{ broken: Map<number, BrokenRun[]>; leaders: Map<number, LeaderRun[]>; teams: number }> {
  const m = await mineRaw();
  return { broken: m.broken, leaders: m.leaders, teams: m.teams };
}

export const isMined = (scope: Scope = 'active') => !!caches[scope];

export function crownsFor(ti: number, scope: Scope = 'active'): Crown[] {
  return caches[scope]?.get(ti) ?? [];
}
