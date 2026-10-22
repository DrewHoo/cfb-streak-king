// The streaks broken in a completed week: the runs a result that week ended,
// under any mined definition (crowns.ts walks them with the crowns: every
// team's run that a current-season game ended, placed among what every team
// carried into that week). The build keeps every week's rows that the list
// rule could admit (crowns.ts FILE_RANK, or the all-time longest) in
// dist/games/digests.json (digests.ts); the page tells and orders them with
// the rule (list.ts) and shows the digest: the first few of note, one per
// team, the rest behind "more".

import type { Dir, GameRow, MinedCrown, Crown } from './types.ts';
import { teams } from './model.ts';
import { chipLabel } from './minedChips.ts';
import { baseDir, isMargin } from './outcome.ts';
import { CTX, LIST, admitted, byOrder, finish, markSubStreaksByTeam, pick } from './list.ts';
import type { Knobs, RankContext } from './list.ts';
import { FILE_RANK } from './crowns.ts';
import type { BrokenRun } from './crowns.ts';
import { teamData } from './crowns.ts';
import { completedWeeks } from './weeks.ts';
import { SHEET_DIRS } from './team.ts';
import { marginWords } from './format.ts';

export { completedWeeks } from './weeks.ts';
export type { CompletedWeek } from './weeks.ts';

/** One run a result ended, as the build keeps it: the team's place in the field entering the week, and the game that broke it. */
export type BrokenInput = MinedCrown & {
  ti: number;
  /** The season the run started in. */
  since: number;
  /** The game that broke it, from ti's side. */
  ender: GameRow;
  /** The run's board: the all-time row starting at `run` (its first game's epoch day). */
  scope: 'all';
  run: number;
  /** The longest run ever under the definition, by any team, and how many teams' longest it is. */
  everLen: number;
  everN: number;
};
/** A broken run on a list: under the definition the list rule picked, scored and flagged. */
export type BrokenStreak = Omit<BrokenInput, 'highest'> & Crown & { scope: 'all'; everLen: number; everN: number };

/** The label for an ended run that is now the all-time longest under its definition, else null. */
export const everText = (b: { len: number; everLen: number; everN: number }): string | null => (
  b.len < b.everLen ? null : b.everN > 1 ? 'now tied for the all-time longest' : 'now the all-time longest streak'
);

/** A week's broken runs as the build keeps them. */
export interface BrokenWeekRows {
  /** The schedule's number for the week; null when no scheduled game pins one down. */
  wk: number | null;
  /** The week's first and last completed game. */
  lo: number;
  hi: number;
  rows: BrokenInput[];
}

/** A week's broken digest, as the page shows it. */
export interface BrokenWeek {
  wk: number | null;
  lo: number;
  hi: number;
  /** The runs worth placing, the furthest past chance first. */
  list: BrokenStreak[];
  /** The rest, behind "more": a team's further runs, and the broken runs that chance explains better (every one, so a game's count holds every break it made). */
  more: BrokenStreak[];
  /** The sub-streaks (subStreak), behind their own button. */
  subStreaks: BrokenStreak[];
}

export const BROKEN_CAP = 6;
/** A broken run scoring under this isn't news on its own: it goes behind "more", never off the list. */
export const BROKEN_CUTOFF = -2.5;

/**
 * A digest from a ranked list: the first `cap` rows that are of note, one
 * per team, so one team's week doesn't fill the whole list; everything else
 * behind "more", in the same order; the sub-streaks (subStreak) behind their
 * own button.
 */
export function digestOf<T extends { ti: number; subStreak?: boolean }>(ranked: T[], ofNote: (x: T) => boolean, cap: number): { list: T[]; more: T[]; subStreaks: T[] } {
  const list: T[] = [];
  const more: T[] = [];
  const subStreaks: T[] = [];
  const seen = new Set<number>();
  for (const x of ranked) {
    if (x.subStreak) subStreaks.push(x);
    else if (list.length < cap && ofNote(x) && !seen.has(x.ti)) { list.push(x); seen.add(x.ti); } else more.push(x);
  }
  return { list, more, subStreaks };
}

// a plain run its by-10 run covers: same team, chips, start and ender ("had
// won 12 straight by 10+" says "had won 12 straight" and more)
const coveredByMarginRun = (list: readonly Pick<BrokenStreak, 'ti' | 'dir' | 'len' | 'chips' | 'ender'>[]) => (b: Pick<BrokenStreak, 'ti' | 'dir' | 'len' | 'chips' | 'ender'>) => (
  !isMargin(b.dir) && (b.dir === 'W' || b.dir === 'L') && list.some((m) => isMargin(m.dir) && baseDir(m.dir) === b.dir
    && m.ti === b.ti && m.ender.i === b.ender.i && m.len === b.len && m.chips.length === b.chips.length && m.chips.every((k) => b.chips.includes(k)))
);

/**
 * The build's rows for a game, a week or a breaker, as a page lists them:
 * the admitted runs under their picked definition, scored, the ones a by-10 run covers dropped, each
 * team's rows flagged against its own a game at a time (so a game page, the
 * week's digest and the breakers group the same sub-streaks and their counts
 * nest), best first.
 */
export function listBroken(rows: readonly BrokenInput[], ctx: RankContext = CTX, w: Knobs = LIST): BrokenStreak[] {
  const shown = rows.filter((c) => admitted(c, w)).map((c) => finish(pick(c, w), ctx, w)) as unknown as Omit<BrokenStreak, 'subStreak'>[];
  const covered = coveredByMarginRun(shown as BrokenStreak[]);
  const out = markSubStreaksByTeam(shown.filter((b) => !covered(b as BrokenStreak)), w, (b) => `${b.ti}|${b.ender.i}`) as BrokenStreak[];
  return out.sort(byOrder(w));
}

/** A week's digest from its rows: the rule's order, the first few of note, one per team. */
export function brokenDigest(week: BrokenWeekRows, ctx: RankContext = CTX, w: Knobs = LIST): BrokenWeek {
  const { list, more, subStreaks } = digestOf(listBroken(week.rows, ctx, w), (b) => b.score >= BROKEN_CUTOFF, BROKEN_CAP);
  return { wk: week.wk, lo: week.lo, hi: week.hi, list, more, subStreaks };
}

/** Whether the build keeps a broken run for the lists: a place the admit knob can reach, or the all-time longest. */
export const keptBroken = (r: Pick<BrokenRun, 'rank' | 'len' | 'everLen' | 'highest'>) => r.rank <= FILE_RANK || (r.highest != null && r.highest.rank <= FILE_RANK) || r.len >= r.everLen;

/** A mined broken run as the build keeps it, with its game. */
export function brokenInput(r: BrokenRun, gs: readonly GameRow[]): BrokenInput {
  const { enderIdx, week: _w, startIdx, ...rest } = r;
  return { ...rest, scope: 'all', since: gs[startIdx].se, ender: gs[enderIdx], run: gs[startIdx].ep };
}

/**
 * Every completed week's rows, by the week's schedule number, from the
 * miner's broken runs: one row per run (the miner kept each team,
 * direction and ender's fewest-conditions definition), the ones a list could admit.
 * A week no scheduled game numbers is left out.
 */
export function brokenWeeks(mined: { broken: Map<number, BrokenRun[]>; teams: number }): Map<number, BrokenWeekRows> {
  const weeks = completedWeeks();
  const gsOf = new Map(teamData().map((td) => [td.ti, td.gs]));
  // by grid week; the miner's runs cover every season, the digest the running one's completed weeks
  const byWeek = new Map<number, BrokenInput[]>(weeks.map((x) => [x.w, []]));
  for (const [ti, runs] of mined.broken) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      if (!SHEET_DIRS.includes(r.dir) || !keptBroken(r)) continue; // the undefeated run is the winning one's story
      byWeek.get(r.week)?.push(brokenInput(r, gs));
    }
  }
  const out = new Map<number, BrokenWeekRows>();
  for (const win of weeks) {
    if (win.wk == null) continue;
    out.set(win.wk, { wk: win.wk, lo: win.lo, hi: win.hi, rows: byWeek.get(win.w)! });
  }
  return out;
}

/** The claim a broken run makes, in plain words: "Michigan had won 18 straight on the road vs Minnesota". */
export function brokenClaim(b: { ti: number; dir: Dir; len: number; unsure: boolean; chips: readonly string[] }): string {
  const verb = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' }[baseDir(b.dir) as 'W' | 'L' | 'C' | 'N'];
  const words = b.chips.map(chipLabel).join(' ');
  return `${teams[b.ti]?.name} ${verb} ${b.len}${b.unsure ? '†' : ''} straight${marginWords(b.dir)}${words ? ` ${words}` : ''}`;
}
