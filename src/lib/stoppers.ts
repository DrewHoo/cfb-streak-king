// Top Streak-Stoppers: every team, by the streaks it ended by beating their
// owner this season. A break is a winning run (any margin) ended by a loss to
// the stopper; a covering run ended by a miss counts only under STOP.covers.
// Each break falls in one of three categories, worth different points:
// the run was the all-time longest under its definition (by any team), it
// led the active field as the week began (ties included), or it was some
// other live run; and a run told with fewer conditions is worth more. The
// build writes dist/stoppers/<season>.json from the miner's broken runs
// (the running season, the full four-chip space); the page embeds it, a
// team page a slice of its own rows.

import type { Dir } from './types.ts';
import { P, gamesOf } from './model.ts';
import { baseDir } from './outcome.ts';
import { chanceOf, crownScore } from './crownRank.ts';
import { markDupsByTeam } from './broken.ts';
import type { BrokenStreak } from './broken.ts';
import type { BrokenRun } from './crowns.ts';
import { teamData } from './crowns.ts';
import { SHEET_DIRS } from './team.ts';
import { encodeBroken, decodeBroken } from './seasonFile.ts';
import type { BrokenRow } from './seasonFile.ts';

export type StopCat = 'alltime' | 'leading' | 'active';
export const STOP_CATS: StopCat[] = ['alltime', 'leading', 'active'];
export const STOP_WORDS: Record<StopCat, string> = { alltime: 'all-time longest', leading: 'led the field', active: 'other active' };

/** The weights: points by category, the discount per condition (base ÷ (1 + discount × conditions)), and the covering flag. */
export const STOP = { points: { alltime: 10, leading: 4, active: 1 } as Record<StopCat, number>, discount: 0.5, covers: false };

/** A break's category: the longest ever under the definition, else a field leader, else another live run. */
export const stopCat = (b: { len: number; everLen: number; rank: number }): StopCat => (b.len >= b.everLen ? 'alltime' : b.rank === 1 ? 'leading' : 'active');
/** What a break is worth. */
export const stopPoints = (b: { len: number; everLen: number; rank: number; chips: string[] }, w = STOP) => w.points[stopCat(b)] / (1 + w.discount * b.chips.length);
const CAT_ORDER: Record<StopCat, number> = { alltime: 0, leading: 1, active: 2 };
/** The all-time longest first, then the field leaders, then the rest; each group by score. */
export const stopOrder = (a: BrokenStreak, b: BrokenStreak) => CAT_ORDER[stopCat(a)] - CAT_ORDER[stopCat(b)] || b.score - a.score || b.len - a.len;

/** A team's breaks, by the team that made them (the victim is each row's `ti`). */
export interface Stoppers {
  season: number;
  builtAt: string;
  /** False for a slice a page embeds (one team's rows): another team may still have rows in the season's file. */
  complete: boolean;
  teams: Map<number, BrokenStreak[]>;
  /** Each stopper's place under the build's weights (points, then breaks); a slice carries its team's. */
  ranks: Map<number, number>;
}

/** The rows that count under the flags: covering breaks only when STOP.covers. */
export const stopRows = (rows: readonly BrokenStreak[], w = STOP) => (w.covers ? rows : rows.filter((b) => b.dir !== 'C'));

export interface StopSummary { ti: number; n: number; points: number; by: Record<StopCat, number>; best: BrokenStreak | null }

/** One team's breaks tallied: the standing rows (a sub-streak doesn't count twice), their points, the split by category, the break worth the most. */
export function stopSummary(ti: number, rows: readonly BrokenStreak[], w = STOP): StopSummary {
  const by: Record<StopCat, number> = { alltime: 0, leading: 0, active: 0 };
  let n = 0, points = 0, best: BrokenStreak | null = null, bestPts = -1;
  for (const b of stopRows(rows, w)) {
    if (b.dup) continue;
    n++;
    const p = stopPoints(b, w);
    points += p;
    by[stopCat(b)]++;
    if (p > bestPts || (p === bestPts && best && b.score > best.score)) { best = b; bestPts = p; }
  }
  return { ti, n, points, by, best };
}

/** Every stopper, the most points first (then the most breaks). */
export function stopRanking(s: Stoppers, w = STOP): StopSummary[] {
  return [...s.teams].map(([ti, rows]) => stopSummary(ti, rows, w)).filter((x) => x.n > 0).sort((a, b) => b.points - a.points || b.n - a.n);
}

/** Every break of the running season from the mined broken runs, by the team that made it. */
export function buildStoppers(mined: { broken: Map<number, BrokenRun[]>; teams: number }, season = P.currentSeason): Stoppers {
  const ctx = { teams: mined.teams };
  const gsOf = new Map(teamData().map((td) => [td.ti, td.gs]));
  // rows per (victim, ender game), so the sub-streaks fold the way the game page folds them
  const byGame = new Map<string, BrokenStreak[]>();
  for (const [ti, runs] of mined.broken) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      if (!SHEET_DIRS.includes(r.dir)) continue;
      const ender = gs[r.enderIdx];
      if (ender.se !== season) continue;
      // a break by beating the team: its winning run ended by a loss; a covering run ended by a miss
      const win = baseDir(r.dir) === 'W' && ender.r === 'L';
      const cover = r.dir === 'C' && ender.cover === 'L';
      if (!win && !cover) continue;
      // every run the miner kept counts (its floor, not the digests' cutoff): a break of a 4th-place run is still a break
      const score = crownScore(r, ctx);
      const { p: _p, n: _n, enderIdx: _e, week: _w, startIdx, ...rest } = r;
      const row: BrokenStreak = { ...rest, ti, chance: chanceOf(r, ctx), score, dup: false, since: gs[startIdx].se, ender, scope: 'all', run: gs[startIdx].ep };
      const k = `${ti}|${ender.i}`;
      (byGame.get(k) ?? byGame.set(k, []).get(k)!).push(row);
    }
  }
  const teams = new Map<number, BrokenStreak[]>();
  for (const rows of byGame.values()) {
    for (const b of markDupsByTeam(rows)) {
      const stopper = b.ender.oppIdx;
      (teams.get(stopper) ?? teams.set(stopper, []).get(stopper)!).push(b);
    }
  }
  for (const rows of teams.values()) rows.sort(stopOrder);
  const s: Stoppers = { season, builtAt: P.builtAt, complete: true, teams, ranks: new Map() };
  stopRanking(s).forEach((x, i) => s.ranks.set(x.ti, i + 1));
  return s;
}

// --- the file ---

export interface StoppersFile { v: 1; season: number; builtAt: string; complete?: boolean; teams: Record<string, BrokenRow[]>; ranks: Record<string, number> }

export function encodeStoppers(s: Stoppers): StoppersFile {
  const teams: StoppersFile['teams'] = {};
  for (const [ti, rows] of s.teams) teams[ti] = rows.map(encodeBroken);
  return { v: 1, season: s.season, builtAt: s.builtAt, ...(s.complete ? {} : { complete: false }), teams, ranks: Object.fromEntries(s.ranks) };
}

export function decodeStoppers(f: StoppersFile): Stoppers {
  const teams = new Map<number, BrokenStreak[]>();
  for (const [ti, rows] of Object.entries(f.teams)) teams.set(Number(ti), rows.map(decodeBroken).filter((b): b is BrokenStreak => b != null));
  return { season: f.season, builtAt: f.builtAt, complete: f.complete !== false, teams, ranks: new Map(Object.entries(f.ranks ?? {}).map(([ti, r]) => [Number(ti), r])) };
}

/** One team's rows as a slice a page embeds. */
export const stoppersSlice = (s: Stoppers, ti: number): Stoppers => ({ season: s.season, builtAt: s.builtAt, complete: false, teams: new Map([[ti, s.teams.get(ti) ?? []]]), ranks: new Map(s.ranks.has(ti) ? [[ti, s.ranks.get(ti)!]] : []) });

// --- in the browser ---

const loading = new Map<number, Promise<Stoppers>>();

/** A season's file, once. A season no build has written (the dev server) is empty. */
export function loadStoppers(season: number = P.currentSeason): Promise<Stoppers> {
  let p = loading.get(season);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}stoppers/${season}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(decodeStoppers)
      .catch(() => ({ season, builtAt: P.builtAt, complete: true, teams: new Map<number, BrokenStreak[]>(), ranks: new Map<number, number>() }));
    loading.set(season, p);
  }
  return p;
}

/** Whether a row was a break by covering (shown only under the flag). */
export const isCoverStop = (b: { dir: Dir }) => b.dir === 'C';
