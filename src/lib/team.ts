// What a team page and a matchup show about one team: its season record, its
// rank, its next game, and its current streaks with their place in the field.
//
// The streaks are the team's active crowns (crowns.ts mines every team's
// run under every definition at build time; the page loads its file and
// lists them with the list rule, list.ts), each with the next scheduled
// game that qualifies, so a matchup and the at-risk digest know which runs
// a game puts on the line.

import type { Crown, Dir, GameRow, MinedCrown, UpcomingRow } from './types.ts';
import { P, teams, fbsNow, gamesOf, upcomingOf } from './model.ts';
import { chipByKey, qualifiesPregame } from './chips.ts';
import type { PregameChip } from './chips.ts';
import { refsOf } from './minedChips.ts';
import { MINED_MARGIN, marginDir } from './outcome.ts';
import { ordinal } from './sentence.ts';
import { spreadText } from './format.ts';

export interface SeasonRecord { w: number; l: number; t: number; cw: number; cl: number; cp: number }

/** This season straight up and against the spread. */
export function seasonRecord(ti: number): SeasonRecord {
  const r = { w: 0, l: 0, t: 0, cw: 0, cl: 0, cp: 0 };
  for (const g of gamesOf(ti)) {
    if (g.se !== P.currentSeason) continue;
    if (g.r === 'W') r.w++; else if (g.r === 'L') r.l++; else r.t++;
    if (g.cover === 'W') r.cw++; else if (g.cover === 'L') r.cl++; else if (g.cover === 'P') r.cp++;
  }
  return r;
}
const wlt = (w: number, l: number, t: number) => `${w}–${l}${t ? `–${t}` : ''}`;
export const recordText = (r: SeasonRecord) => wlt(r.w, r.l, r.t);
export const atsText = (r: SeasonRecord) => wlt(r.cw, r.cl, r.cp);

/** The team's next scheduled game: the first one no build has recorded a result for, whatever its date. */
export const nextGameOf = (ti: number, _todayEp: number): UpcomingRow | null => upcomingOf(ti)[0] ?? null;

/** The team's scheduled game against `opp`, else its next game: a matchup link read after that game was played still lands on one. */
export function gameVs(ti: number, opp: number | null, _todayEp: number): UpcomingRow | null {
  const ahead = upcomingOf(ti);
  return (opp != null ? ahead.find((u) => u.oppIdx === opp) : null) ?? ahead[0] ?? null;
}

/** AP rank in the poll in effect: 0 unranked, null when no poll is. Read off the next game, else the last one. */
export function apRank(ti: number, todayEp: number): number | null {
  const next = nextGameOf(ti, todayEp);
  if (next) return next.ownRank;
  return gamesOf(ti).at(-1)?.ownRank ?? null;
}

/** The last time the two met, from ti's side. */
export const lastMeeting = (ti: number, opp: number): GameRow | null => gamesOf(ti).findLast((g) => g.oppIdx === opp) ?? null;

/** One of a team's current runs with the game that next puts it on the line, as a file keeps it (no score). */
export type TeamRun<T extends MinedCrown = MinedCrown> = T & {
  /** The next scheduled game that qualifies; null when none does, or when a condition can't be known before kickoff. */
  next: UpcomingRow | null;
  /** The season the run started in. */
  since: number;
};
/** One of a team's current streaks on a list: its active crown under the definition the list rule picked, scored, with its next game. */
export type TeamStreak = TeamRun<Crown>;

/** The miner's floor: a run shorter than this is never on a list. */
export const LEN_FLOOR = 4;

// the outcomes a team's sheet reads: every team is on one side of each pair,
// and the margin runs the miner walks
export const SHEET_DIRS: Dir[] = ['W', 'L', 'C', 'N', marginDir('W', MINED_MARGIN), marginDir('L', MINED_MARGIN)];

/**
 * The first scheduled game of `ti`'s on or after `todayEp` that every chip
 * of the definition admits; null when a chip can't be known before kickoff.
 */
export function nextQualifying(ti: number, chips: readonly string[], todayEp: number): UpcomingRow | null {
  const refs = refsOf(chips);
  const cs = refs.map((r) => ({ c: chipByKey.get(r.key)!, p: r.param }));
  if (cs.some(({ c }) => !c.pregame)) return null;
  return upcomingOf(ti).find((u) => u.ep >= todayEp && cs.every(({ c, p }) => qualifiesPregame(c as PregameChip, u, p))) ?? null;
}

/**
 * A team's current streaks, in the order given: its active crowns under the
 * outcomes a sheet shows (the list rule's rows, or a file's raw ones), each
 * with its next qualifying game. Empty while the crowns load.
 */
export function teamStreaks<T extends MinedCrown>(ti: number, todayEp: number, crowns: T[] | null): TeamRun<T>[] {
  if (!crowns) return [];
  return crowns
    .filter((c) => c.scope === 'active' && SHEET_DIRS.includes(c.dir))
    .map((c) => ({ ...c, next: nextQualifying(ti, c.chips, todayEp), since: c.startSe ?? P.currentSeason }));
}

/** The streaks a scheduled game puts on the line: the ones whose next qualifying game it is. */
export const streaksOn = <T extends TeamRun>(list: T[], game: UpcomingRow): T[] => list.filter((s) => s.next?.i === game.i);

/** "T-3rd": the rank, marked when shared. */
export const rankText = (s: Pick<Crown, 'rank' | 'tied'>) => (s.tied > 1 ? 'T-' : '') + ordinal(s.rank);

/** Current FBS teams, by name, for the team picker. */
export const teamList = () => [...fbsNow].sort((a, b) => teams[a].name.localeCompare(teams[b].name));

/** One scheduled game, once, whichever side it was read from. */
export interface ScheduledGame {
  i: number;
  ep: number;
  wk: number;
  home: number;
  away: number;
  neutral: boolean;
  hh: number;
  homeRank: number | null;
  awayRank: number | null;
  /** The line from the home side, + = home underdog; null when unlined. */
  sp: number | null;
  /** The game from each FBS side. */
  sides: { ti: number; row: UpcomingRow }[];
}

let scheduled: ScheduledGame[] | null = null;
/** Every scheduled game with an FBS side, by date, then kickoff (unknown last), then home team. */
export function scheduledGames(): ScheduledGame[] {
  if (scheduled) return scheduled;
  const byI = new Map<number, ScheduledGame>();
  for (const ti of fbsNow) {
    for (const u of upcomingOf(ti)) {
      const g = byI.get(u.i);
      if (g) { g.sides.push({ ti, row: u }); continue; }
      byI.set(u.i, {
        i: u.i, ep: u.ep, wk: u.wk, neutral: u.neutral, hh: u.hh,
        home: u.home ? ti : u.oppIdx, away: u.home ? u.oppIdx : ti,
        homeRank: u.home ? u.ownRank : u.oppRank, awayRank: u.home ? u.oppRank : u.ownRank,
        sp: u.sp == null ? null : u.home ? u.sp : -u.sp,
        sides: [{ ti, row: u }],
      });
    }
  }
  const hour = (h: number) => (h === 31 ? 99 : h);
  scheduled = [...byI.values()].sort((a, b) => a.ep - b.ep || hour(a.hh) - hour(b.hh) || teams[a.home].name.localeCompare(teams[b.home].name));
  return scheduled;
}

/** "Georgia -25", "PK", or null when the game has no line. */
export function lineText(g: Pick<ScheduledGame, 'home' | 'away' | 'sp'>): string | null {
  if (g.sp == null) return null;
  if (g.sp === 0) return 'PK';
  return `${teams[g.sp < 0 ? g.home : g.away].name} ${spreadText(-Math.abs(g.sp))}`;
}

/**
 * The streaks either side puts on the line in the game: the one with the
 * highest score, with its team, and `n`, how many there are (one placing per
 * run). Null when the game puts none on the line. `crownsOf` is each team's
 * active crowns as the list rule lists them.
 */
export function topOnLine(g: ScheduledGame, todayEp: number, crownsOf: (ti: number) => Crown[] | null): { ti: number; s: TeamStreak; n: number } | null {
  let best: { ti: number; s: TeamStreak } | null = null;
  let n = 0;
  for (const { ti, row } of g.sides) {
    for (const s of streaksOn(teamStreaks(ti, todayEp, crownsOf(ti)), row)) {
      if (s.subStreak) continue;
      n++;
      if (!best || s.score > best.s.score) best = { ti, s };
    }
  }
  return best && { ...best, n };
}
