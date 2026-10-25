// Top Streak-Breakers: every team, by the streaks it ended by beating their
// owner this season. A break is a winning run (any margin) ended by a loss to
// the breaker; a covering run ended by a miss counts only under BREAK.covers.
// Only two kinds of run count, worth different points: the all-time longest
// under its definition (by any team), and the longest active one as the week
// began (ties included); a run under fewer conditions is worth more. Only a
// simple run counts (list.ts Part, trivia.ts): a trivia break earns nothing,
// isn't counted and isn't listed, though the rows stay in the file for a team
// page's folded line. The
// points order the teams, and the page shows only the order: a team's Streak
// King Rank (SKR). A season's breaks come from its season-file rows, the
// ones the schedule and a game page read: the build writes the running
// season's to dist/breakers/<season>.json (the full four-chip space) and the
// page embeds it, a team page a slice of its own rows; a past season's are
// worked out in the browser from dist/games/<season>.json (two-chip
// definitions, so they don't compare with the running season's).

import { P, teams as allTeams } from './model.ts';
import { baseDir } from './outcome.ts';
import type { BrokenInput, BrokenStreak } from './broken.ts';
import { listBroken } from './broken.ts';
import { CTX, LIST } from './list.ts';
import type { Knobs, RankContext } from './list.ts';
import { buildSeasons } from './seasons.ts';
import { SHEET_DIRS } from './team.ts';
import { encodeBroken, decodeBroken, loadSeason } from './seasonFile.ts';
import type { BrokenRow, Season } from './seasonFile.ts';

export { BREAK_CATS, BREAK_WORDS, BREAK, breakCat, breakPoints, rankOrder } from './breakScore.ts';
export type { BreakCat } from './breakScore.ts';
import { BREAK, breakCat, breakPoints, rankOrder } from './breakScore.ts';
import type { BreakCat } from './breakScore.ts';

const CAT_ORDER: Record<BreakCat, number> = { alltime: 0, leading: 1 };
/** The all-time longest first, then the field leaders; each group by score. */
export const breakOrder = (a: BrokenStreak, b: BrokenStreak) => CAT_ORDER[breakCat(a, 99)!] - CAT_ORDER[breakCat(b, 99)!] || b.score - a.score || b.len - a.len;

/** A breaker's rows as a page lists them: the list rule's admitted rows under their picked definition, scored, in the breaks' order. */
export const listBreaks = (rows: readonly BrokenInput[], ctx: RankContext = CTX, w: Knobs = LIST): BrokenStreak[] => listBroken(rows, ctx, w).sort(breakOrder);

/** A team's breaks, by the team that made them (the victim is each row's `ti`), as the build keeps them: the rows the list rule could admit, unscored. */
export interface Breakers {
  season: number;
  builtAt: string;
  /** False for a slice a page embeds (one team's rows): another team may still have rows in the season's file. */
  complete: boolean;
  teams: Map<number, BrokenInput[]>;
  /** Each breaker's place under the build's weights (points, then breaks); a slice carries its team's. */
  ranks: Map<number, number>;
}

/** The rows that count under the flags: covering breaks only when BREAK.covers. */
export const breakRows = <T extends { dir: string }>(rows: readonly T[], w = BREAK): T[] => (w.covers ? [...rows] : rows.filter((b) => b.dir !== 'C'));

export interface BreakSummary { ti: number; n: number; points: number; by: Record<BreakCat, number>; best: BrokenStreak | null; victims: [number, number][] }

/** One team's breaks tallied from its listed rows (listBreaks): the standing rows (a sub-streak doesn't count twice), their points, the split by category, the break worth the most, and whose streaks they were (the most first). */
export function breakSummary(ti: number, rows: readonly BrokenStreak[], w = BREAK, knobs: Knobs = LIST): BreakSummary {
  const by: Record<BreakCat, number> = { alltime: 0, leading: 0 };
  let n = 0, points = 0, best: BrokenStreak | null = null, bestPts = -1;
  const vs = new Map<number, number>();
  for (const b of breakRows(rows, w)) {
    if (b.subStreak) continue;
    n++;
    vs.set(b.ti, (vs.get(b.ti) ?? 0) + 1);
    const p = breakPoints(b, w, knobs.admit.rank);
    points += p;
    by[breakCat(b, knobs.admit.rank)!]++;
    if (p > bestPts || (p === bestPts && best && b.score > best.score)) { best = b; bestPts = p; }
  }
  const victims = [...vs].sort((a, b) => b[1] - a[1] || (allTeams[a[0]]?.name ?? '').localeCompare(allTeams[b[0]]?.name ?? ''));
  return { ti, n, points, by, best, victims };
}

/** Every breaker, in the leaderboard's order (rankOrder: points, then breaks), each's rows listed by the list rule. */
export function breakRanking(s: Breakers, w = BREAK, knobs: Knobs = LIST, ctx: RankContext = CTX): BreakSummary[] {
  return [...s.teams].map(([ti, rows]) => breakSummary(ti, listBreaks(rows, ctx, knobs), w, knobs)).filter((x) => x.n > 0).sort(rankOrder);
}

/** A season with no breaks: the dev server before a build, or a season no build has written. */
const noBreaks = (season: number): Breakers => ({ season, builtAt: P.builtAt, complete: true, teams: new Map(), ranks: new Map() });

/**
 * A season's breaks, by the team that made each, from its season-file rows
 * (seasons.ts: every run a game ended that led its field, sub-streaks grouped
 * per game). The running season's rows read the full four-chip space, a past
 * season's definitions of up to HIST_CHIPS; the schedule and a game page read
 * the same rows, so a game's broken count holds every break credited here.
 */
export function breakersFromSeason(s: Season | null | undefined, season = s?.season ?? P.currentSeason): Breakers {
  if (!s) return noBreaks(season);
  const teams = new Map<number, BrokenInput[]>();
  for (const { ended } of s.games.values()) {
    for (const b of ended) {
      // the rows a list could admit (seasons.ts kept them); the page decides which count under the admit knob
      if (!SHEET_DIRS.includes(b.dir)) continue;
      // a break by beating the team: its winning run ended by a loss; a covering run ended by a miss
      const win = baseDir(b.dir) === 'W' && b.ender.r === 'L';
      const cover = b.dir === 'C' && b.ender.cover === 'L';
      if (!win && !cover) continue;
      const breaker = b.ender.oppIdx;
      (teams.get(breaker) ?? teams.set(breaker, []).get(breaker)!).push(b);
    }
  }
  const out: Breakers = { season: s.season, builtAt: s.builtAt, complete: true, teams, ranks: new Map() };
  breakRanking(out).forEach((x, i) => out.ranks.set(x.ti, i + 1));
  return out;
}

/** Every break of the running season from the mined broken runs (the build's path to the same rows). */
export const buildBreakers = (mined: Parameters<typeof buildSeasons>[0], season = P.currentSeason): Breakers => breakersFromSeason(buildSeasons(mined).get(season), season);

// --- the file ---

export interface BreakersFile { v: 2; season: number; builtAt: string; complete?: boolean; teams: Record<string, BrokenRow[]>; ranks: Record<string, number> }

export function encodeBreakers(s: Breakers): BreakersFile {
  const teams: BreakersFile['teams'] = {};
  for (const [ti, rows] of s.teams) teams[ti] = rows.map(encodeBroken);
  return { v: 2, season: s.season, builtAt: s.builtAt, ...(s.complete ? {} : { complete: false }), teams, ranks: Object.fromEntries(s.ranks) };
}

export function decodeBreakers(f: BreakersFile): Breakers {
  const teams = new Map<number, BrokenInput[]>();
  for (const [ti, rows] of Object.entries(f.teams)) teams.set(Number(ti), rows.map(decodeBroken).filter((b): b is BrokenInput => b != null));
  return { season: f.season, builtAt: f.builtAt, complete: f.complete !== false, teams, ranks: new Map(Object.entries(f.ranks ?? {}).map(([ti, r]) => [Number(ti), r])) };
}

/** One team's rows as a slice a page embeds. */
export const breakersSlice = (s: Breakers, ti: number): Breakers => ({ season: s.season, builtAt: s.builtAt, complete: false, teams: new Map([[ti, s.teams.get(ti) ?? []]]), ranks: new Map(s.ranks.has(ti) ? [[ti, s.ranks.get(ti)!]] : []) });

// --- in the browser ---

const loading = new Map<number, Promise<Breakers>>();

/** A season's breaks, once: the running season's file, a past season's from its season file. A season no build has written (the dev server) is empty. */
export function loadBreakers(season: number = P.currentSeason): Promise<Breakers> {
  let p = loading.get(season);
  if (!p) {
    p = season !== P.currentSeason
      ? loadSeason(season).then((s) => breakersFromSeason(s, season))
      : fetch(`${import.meta.env.BASE_URL}breakers/${season}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(decodeBreakers)
        .catch(() => noBreaks(season));
    loading.set(season, p);
  }
  return p;
}
