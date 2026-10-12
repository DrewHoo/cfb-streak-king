// The streaks broken in a completed week: the runs a result that week ended,
// under any mined definition (crowns.ts walks them with the crowns: every
// team's run that a current-season game ended, placed among what every team
// carried into that week). Each is scored like a crown, how far past chance
// the run sat, with one telling kept per broken run and the game that broke
// it. The schedule shows the digest; the build writes every week's to
// dist/games/digests.json (digests.ts) and the page reads that.

import type { Crown, GameRow } from './types.ts';
import { teams } from './model.ts';
import { chipLabel } from './minedChips.ts';
import { baseDir, isMargin } from './outcome.ts';
import { chanceOf, crownScore } from './crownRank.ts';
import type { BrokenRun } from './crowns.ts';
import { teamData } from './crowns.ts';
import { completedWeeks } from './weeks.ts';
import { SHEET_DIRS } from './team.ts';
import { marginWords } from './format.ts';

export { completedWeeks } from './weeks.ts';
export type { CompletedWeek } from './weeks.ts';

/** One run a result last week ended, with the team's place in the field entering the week. */
export interface BrokenStreak extends Crown {
  ti: number;
  /** The season the run started in. */
  since: number;
  /** The game that broke it, from ti's side. */
  ender: GameRow;
  /** The run's board: the all-time row starting at `run` (its first game's epoch day). */
  scope: 'all';
  run: number;
}

export interface BrokenWeek {
  /** The schedule's number for the week; null when no scheduled game pins one down. */
  wk: number | null;
  /** The week's first and last completed game. */
  lo: number;
  hi: number;
  /** The runs worth telling, the furthest past chance first. */
  list: BrokenStreak[];
  /** The rest, behind "more": a team's further runs, and real broken runs that chance explains better, down to BROKEN_FLOOR. */
  more: BrokenStreak[];
}

export const BROKEN_CAP = 6;
/** A broken run scoring under this isn't news on its own. */
export const BROKEN_CUTOFF = -2.5;
/** Under this (the crowns' own cutoff), it isn't worth a tap either. */
export const BROKEN_FLOOR = -6.5;

/**
 * A digest from a ranked list: the first `cap` rows that are of note, one
 * per team, so one team's week doesn't fill the whole list; everything else
 * behind "more", in the same order.
 */
export function digestOf<T extends { ti: number }>(ranked: T[], ofNote: (x: T) => boolean, cap: number): { list: T[]; more: T[] } {
  const list: T[] = [];
  const more: T[] = [];
  const seen = new Set<number>();
  for (const x of ranked) {
    if (list.length < cap && ofNote(x) && !seen.has(x.ti)) { list.push(x); seen.add(x.ti); } else more.push(x);
  }
  return { list, more };
}

// a plain run a margin run retells: same team, chips, start and ender ("had
// won 12 straight by 10+" says "had won 12 straight" and more)
const marginRetold = (list: BrokenStreak[]) => (b: BrokenStreak) => (
  !isMargin(b.dir) && (b.dir === 'W' || b.dir === 'L') && list.some((m) => isMargin(m.dir) && baseDir(m.dir) === b.dir
    && m.ti === b.ti && m.ender.i === b.ender.i && m.len === b.len && m.chips.length === b.chips.length && m.chips.every((k) => b.chips.includes(k)))
);

/**
 * Every completed week's digest, by the week's schedule number, from the
 * miner's broken runs: the ones worth telling, best first, one telling per
 * run (the miner kept each team, direction and ender's best definition).
 * A week no scheduled game numbers is left out.
 */
export function brokenWeeks(mined: { broken: Map<number, BrokenRun[]>; teams: number }): Map<number, BrokenWeek> {
  const weeks = completedWeeks();
  const ctx = { teams: mined.teams };
  const gsOf = new Map(teamData().map((td) => [td.ti, td.gs]));
  // by grid week; the miner's runs cover every season, the digest the running one's completed weeks
  const byWeek = new Map<number, BrokenStreak[]>(weeks.map((x) => [x.w, []]));
  for (const [ti, runs] of mined.broken) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      if (!SHEET_DIRS.includes(r.dir)) continue; // the undefeated run is the winning one's story
      const list = byWeek.get(r.week);
      if (!list) continue;
      const { p: _p, n: _n, enderIdx, week: _w, startIdx, ...rest } = r;
      list.push({
        ...rest, ti, chance: chanceOf(r, ctx), score: crownScore(r, ctx),
        since: gs[startIdx].se, ender: gs[enderIdx], scope: 'all', run: gs[startIdx].ep,
      });
    }
  }
  const out = new Map<number, BrokenWeek>();
  for (const win of weeks) {
    if (win.wk == null) continue;
    const mine = byWeek.get(win.w)!;
    const retold = marginRetold(mine);
    const all = mine
      .filter((b) => !retold(b) && b.score >= BROKEN_FLOOR)
      .sort((a, b) => b.score - a.score || b.len - a.len);
    const { list, more } = digestOf(all, (b) => b.score >= BROKEN_CUTOFF, BROKEN_CAP);
    out.set(win.wk, { wk: win.wk, lo: win.lo, hi: win.hi, list, more });
  }
  return out;
}

/** The claim a broken run makes, in plain words: "Michigan had won 18 straight on the road vs Minnesota". */
export function brokenClaim(b: BrokenStreak): string {
  const verb = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' }[baseDir(b.dir) as 'W' | 'L' | 'C' | 'N'];
  const words = b.chips.map(chipLabel).join(' ');
  return `${teams[b.ti]?.name} ${verb} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${words ? ` ${words}` : ''}`;
}
