// Top Streak-Breakers: every team, by the streaks it ended by beating their
// owner this season. A break is a winning run (any margin) ended by a loss to
// the breaker; a covering run ended by a miss counts only under BREAK.covers.
// Only two kinds of run count, worth different points: the all-time longest
// under its definition (by any team), and the longest active one as the week
// began (ties included); a run told with fewer conditions is worth more. The
// points order the teams, and the page shows only the order: a team's Streak
// King Rank (SKR). The build writes dist/breakers/<season>.json from the miner's broken runs
// (the running season, the full four-chip space); the page embeds it, a
// team page a slice of its own rows.

import type { Dir } from './types.ts';
import { P, teams as allTeams } from './model.ts';
import { baseDir } from './outcome.ts';
import { chanceOf, crownScore } from './crownRank.ts';
import { markDupsByTeam } from './broken.ts';
import type { BrokenStreak } from './broken.ts';
import type { BrokenRun } from './crowns.ts';
import { teamData } from './crowns.ts';
import { SHEET_DIRS } from './team.ts';
import { encodeBroken, decodeBroken } from './seasonFile.ts';
import type { BrokenRow } from './seasonFile.ts';

export type BreakCat = 'alltime' | 'leading';
export const BREAK_CATS: BreakCat[] = ['alltime', 'leading'];
export const BREAK_WORDS: Record<BreakCat, string> = { alltime: 'all-time longest', leading: 'was longest active streak' };

/** The weights: points by category, the discount per condition (base ÷ (1 + discount × conditions)), and the covering flag. */
export const BREAK = { points: { alltime: 10, leading: 4 } as Record<BreakCat, number>, discount: 0.5, covers: false };

/** A break's category: the longest ever under the definition, else the active field's leader; any other run isn't a break here. */
export const breakCat = (b: { len: number; everLen: number; rank: number }): BreakCat | null => (b.len >= b.everLen ? 'alltime' : b.rank === 1 ? 'leading' : null);
/** What a break is worth. */
export const breakPoints = (b: { len: number; everLen: number; rank: number; chips: string[] }, w = BREAK) => {
  const c = breakCat(b);
  return c ? w.points[c] / (1 + w.discount * b.chips.length) : 0;
};
const CAT_ORDER: Record<BreakCat, number> = { alltime: 0, leading: 1 };
/** The all-time longest first, then the field leaders; each group by score. */
export const breakOrder = (a: BrokenStreak, b: BrokenStreak) => CAT_ORDER[breakCat(a)!] - CAT_ORDER[breakCat(b)!] || b.score - a.score || b.len - a.len;

/** A team's breaks, by the team that made them (the victim is each row's `ti`). */
export interface Breakers {
  season: number;
  builtAt: string;
  /** False for a slice a page embeds (one team's rows): another team may still have rows in the season's file. */
  complete: boolean;
  teams: Map<number, BrokenStreak[]>;
  /** Each breaker's place under the build's weights (points, then breaks); a slice carries its team's. */
  ranks: Map<number, number>;
}

/** The rows that count under the flags: covering breaks only when BREAK.covers. */
export const breakRows = (rows: readonly BrokenStreak[], w = BREAK) => (w.covers ? rows : rows.filter((b) => b.dir !== 'C'));

export interface BreakSummary { ti: number; n: number; points: number; by: Record<BreakCat, number>; best: BrokenStreak | null; victims: [number, number][] }

/** One team's breaks tallied: the standing rows (a sub-streak doesn't count twice), their points, the split by category, the break worth the most, and whose streaks they were (the most first). */
export function breakSummary(ti: number, rows: readonly BrokenStreak[], w = BREAK): BreakSummary {
  const by: Record<BreakCat, number> = { alltime: 0, leading: 0 };
  let n = 0, points = 0, best: BrokenStreak | null = null, bestPts = -1;
  const vs = new Map<number, number>();
  for (const b of breakRows(rows, w)) {
    if (b.dup) continue;
    n++;
    vs.set(b.ti, (vs.get(b.ti) ?? 0) + 1);
    const p = breakPoints(b, w);
    points += p;
    by[breakCat(b)!]++;
    if (p > bestPts || (p === bestPts && best && b.score > best.score)) { best = b; bestPts = p; }
  }
  const victims = [...vs].sort((a, b) => b[1] - a[1] || (allTeams[a[0]]?.name ?? '').localeCompare(allTeams[b[0]]?.name ?? ''));
  return { ti, n, points, by, best, victims };
}

/** Every breaker, the most points first (then the most breaks). */
export function breakRanking(s: Breakers, w = BREAK): BreakSummary[] {
  return [...s.teams].map(([ti, rows]) => breakSummary(ti, rows, w)).filter((x) => x.n > 0).sort((a, b) => b.points - a.points || b.n - a.n);
}

/** Every break of the running season from the mined broken runs, by the team that made it. */
export function buildBreakers(mined: { broken: Map<number, BrokenRun[]>; teams: number }, season = P.currentSeason): Breakers {
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
      // only the all-time longest and the active field's leader count, decided before the sub-streaks fold:
      // a leading sub-streak of a run that didn't lead stands on its own
      if (!breakCat(r)) continue;
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
      const breaker = b.ender.oppIdx;
      (teams.get(breaker) ?? teams.set(breaker, []).get(breaker)!).push(b);
    }
  }
  for (const rows of teams.values()) rows.sort(breakOrder);
  const s: Breakers = { season, builtAt: P.builtAt, complete: true, teams, ranks: new Map() };
  breakRanking(s).forEach((x, i) => s.ranks.set(x.ti, i + 1));
  return s;
}

// --- the file ---

export interface BreakersFile { v: 1; season: number; builtAt: string; complete?: boolean; teams: Record<string, BrokenRow[]>; ranks: Record<string, number> }

export function encodeBreakers(s: Breakers): BreakersFile {
  const teams: BreakersFile['teams'] = {};
  for (const [ti, rows] of s.teams) teams[ti] = rows.map(encodeBroken);
  return { v: 1, season: s.season, builtAt: s.builtAt, ...(s.complete ? {} : { complete: false }), teams, ranks: Object.fromEntries(s.ranks) };
}

export function decodeBreakers(f: BreakersFile): Breakers {
  const teams = new Map<number, BrokenStreak[]>();
  for (const [ti, rows] of Object.entries(f.teams)) teams.set(Number(ti), rows.map(decodeBroken).filter((b): b is BrokenStreak => b != null));
  return { season: f.season, builtAt: f.builtAt, complete: f.complete !== false, teams, ranks: new Map(Object.entries(f.ranks ?? {}).map(([ti, r]) => [Number(ti), r])) };
}

/** One team's rows as a slice a page embeds. */
export const breakersSlice = (s: Breakers, ti: number): Breakers => ({ season: s.season, builtAt: s.builtAt, complete: false, teams: new Map([[ti, s.teams.get(ti) ?? []]]), ranks: new Map(s.ranks.has(ti) ? [[ti, s.ranks.get(ti)!]] : []) });

// --- in the browser ---

const loading = new Map<number, Promise<Breakers>>();

/** A season's file, once. A season no build has written (the dev server) is empty. */
export function loadBreakers(season: number = P.currentSeason): Promise<Breakers> {
  let p = loading.get(season);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}breakers/${season}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(decodeBreakers)
      .catch(() => ({ season, builtAt: P.builtAt, complete: true, teams: new Map<number, BrokenStreak[]>(), ranks: new Map<number, number>() }));
    loading.set(season, p);
  }
  return p;
}
