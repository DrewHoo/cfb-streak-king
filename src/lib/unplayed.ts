// Streaks preserved by games not played. data/ref/unplayed-postseasons.json
// rules on team-seasons that ended without a postseason game and says why
// (a declined bid, a no-bowl policy, a no-repeat rule, a bowl ban); this
// joins those rulings to the winning runs that lived through them, so the
// notes can list "Oklahoma's 47 crossed two Orange Bowls the Big Seven's
// no-repeat rule kept it out of" with the receipt beside it. Research says
// what happened; code says which streaks it touched.

import rulings from '../../data/ref/unplayed-postseasons.json';
import type { Dir, GameRow } from './types.ts';
import { P, teams, fbsNow, gamesOf, allTimeBoard } from './model.ts';

export type UnplayedKind = 'declined' | 'school-policy' | 'self-ban' | 'conference-rule' | 'no-repeat' | 'ncaa-ban' | 'canceled' | 'not-invited' | 'ineligible' | 'played' | 'unknown';
/** Who kept the team home: its own call, or a rule it was under. */
export type UnplayedClass = 'chose' | 'ruled';

export interface Receipt { url: string; quote: string; note?: string; retrieved?: string }
export interface UnplayedRow {
  team: string;
  season: number;
  kind: UnplayedKind;
  summary: string;
  receipts: Receipt[];
  confidence?: 'high' | 'medium' | 'low';
}

/** The team's own call: a bid declined, a school's standing policy, a self-imposed ban. The criticism of a skipped bowl lands here. */
export const CHOSE = new Set<UnplayedKind>(['declined', 'school-policy', 'self-ban']);
/** A rule the team was under: its conference's, or the NCAA's. No criticism due. */
export const RULED = new Set<UnplayedKind>(['conference-rule', 'no-repeat', 'ncaa-ban']);
/** The class of a kind; null for the kinds that preserve nothing (no bid, a canceled game). */
export const classOf = (kind: UnplayedKind): UnplayedClass | null => (CHOSE.has(kind) ? 'chose' : RULED.has(kind) ? 'ruled' : null);
/** What each kind says in a sentence. */
export const KIND_WORDS: Record<UnplayedKind, string> = {
  declined: 'declined a bowl bid',
  'school-policy': 'school no-bowl policy',
  'self-ban': 'self-imposed bowl ban',
  'conference-rule': 'conference rule',
  'no-repeat': 'conference no-repeat rule',
  'ncaa-ban': 'NCAA bowl ban',
  canceled: 'bowl canceled',
  'not-invited': 'no bid',
  ineligible: 'ineligible',
  played: 'played',
  unknown: 'unknown',
};

export const UNPLAYED: UnplayedRow[] = (rulings as { rows: UnplayedRow[] }).rows;

/** One winning run and the postseasons it lived through. */
export interface PreservedStreak {
  ti: number;
  dir: Dir;
  len: number;
  atEdge: boolean;
  live: boolean;
  startSe: number;
  endSe: number;
  /** The run's first game's epoch day: its all-time row (?run=). */
  run: number;
  /** The rulings inside the run, by season. */
  seasons: UnplayedRow[];
}

const byTeamSeason = new Map(UNPLAYED.map((r) => [`${r.team}|${r.season}`, r]));

/** The ruling for a team-season, if any. */
export const unplayedFor = (ti: number, season: number): UnplayedRow | null => byTeamSeason.get(`${teams[ti]?.id}|${season}`) ?? null;

/**
 * The postseasons one run lived through without playing, by its own call or
 * under a rule: a ruling on each of the run's seasons but its last (a live
 * run's running season has no postseason yet; an ended run's last season
 * was followed by the game that broke it, unless that came in a later
 * season). `games` is the run, any order.
 */
export function unplayedInRun(ti: number, games: GameRow[], endedSe: number | null): UnplayedRow[] {
  const seasons = [...new Set(games.map((g) => g.se))].sort((a, b) => a - b);
  const last = seasons[seasons.length - 1];
  return seasons
    .filter((se) => se < last || (endedSe != null && endedSe > se))
    .map((se) => unplayedFor(ti, se))
    .filter((r): r is UnplayedRow => !!r && classOf(r.kind) != null);
}

/**
 * Every winning run (or, with `dir`, every run of that outcome) that
 * crossed a postseason the team didn't play by its own call (`cls` 'chose')
 * or under a rule ('ruled'): the run's seasons before its last each have
 * such a ruling. Longest first. `todayEp` only matters for a live run's
 * next game; the join is pure.
 */
export function preservedStreaks(cls: UnplayedClass, dir: Dir = 'W', todayEp = Math.floor(Date.parse(P.builtAt) / 86400000)): PreservedStreak[] {
  const out: PreservedStreak[] = [];
  for (const row of allTimeBoard([], dir, todayEp)) {
    if (!fbsNow.has(row.ti)) continue;
    const gs = gamesOf(row.ti);
    const run = gs.slice(row.s.startIdx!, row.s.endIdx! + 1);
    const seasons = [...new Set(run.map((g: GameRow) => g.se))];
    const last = seasons[seasons.length - 1];
    const hits: UnplayedRow[] = [];
    for (const se of seasons) {
      // the run must go on past the season for the missing game to matter:
      // into the next season, or an ended run broken in a later season
      const goesOn = se < last || (!row.live && row.ended != null && row.ended.se > se);
      if (!goesOn) continue;
      const r = unplayedFor(row.ti, se);
      if (r && classOf(r.kind) === cls) hits.push(r);
    }
    if (!hits.length) continue;
    out.push({
      ti: row.ti, dir, len: row.s.len, atEdge: row.s.atEdge, live: !!row.live,
      startSe: row.s.start!.se, endSe: row.s.end!.se, run: row.s.start!.ep, seasons: hits,
    });
  }
  return out.sort((a, b) => b.len - a.len || b.endSe - a.endSe);
}
