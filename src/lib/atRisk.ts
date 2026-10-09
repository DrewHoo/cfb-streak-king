// The streaks most at risk in a week: every streak a scheduled game puts on
// the line, ranked by what the game can take away. A streak's crown score
// says how far past chance it sits; the line says how likely the game is to
// end it; the stake is the product, the bits of streak expected to die.
// Alabama's run at home as a 38-point favorite scores well and risks nothing,
// so it sinks; a run carried into a pick'em floats.
//
// The chance comes from the line alone: our margin is normal around the
// negated spread with SPREAD_SIGMA points of noise, the usual figure for a
// college game. A covering or not-covering streak is a coin flip by
// construction. A game without a line can't be ranked and stays out.

import type { Dir, UpcomingRow } from './types.ts';
import { baseDir, marginOf } from './outcome.ts';
import { teamStreaks, streaksOn, h2hStreaksOn } from './team.ts';
import type { ScheduledGame, TeamStreak } from './team.ts';
import { digestOf } from './broken.ts';

export const SPREAD_SIGMA = 13.5;
export const AT_RISK_CAP = 6;
/** Below this many expected bits a streak isn't news when it falls. */
export const AT_RISK_FLOOR = 0.25;

// Abramowitz–Stegun 7.1.26, good to 1.5e-7
const erf = (x: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
/** The standard normal CDF. */
export const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * The chance a game breaks a streak of `dir`, from our line (`sp`, + when
 * we're the underdog): the chance our margin lands outside what the outcome
 * needs. Null without a line.
 */
export function pBreak(dir: Dir, sp: number | null): number | null {
  if (sp == null) return null;
  const mu = -sp;
  const b = baseDir(dir);
  const by = marginOf(dir);
  const below = (x: number) => Phi((x - mu) / SPREAD_SIGMA);
  switch (b) {
    case 'C': case 'N': return 0.5;
    case 'W': return below(by ? by - 0.5 : 0.5);       // short of the margin, or no win at all
    case 'U': return below(-0.5);                      // a loss
    case 'L': return 1 - below(by ? -by + 0.5 : -0.5); // closer than the margin, or no loss at all
  }
}

export interface AtRisk {
  ti: number;
  s: TeamStreak;
  game: ScheduledGame;
  /** The game from the team's side. */
  row: UpcomingRow;
  /** The chance the game ends the streak. */
  p: number;
  /** score × p: the bits of streak the game is expected to take. */
  stake: number;
}

export interface AtRiskWeek {
  list: AtRisk[];
  more: AtRisk[];
}

/**
 * The streaks on the line in these games, the most at stake first: one row
 * per streak (a team's run appears once, with its game), the top AT_RISK_CAP
 * in `list`, one per team, and the rest above AT_RISK_FLOOR in `more`.
 * Streaks are the team page's (single conditions and head-to-head; a team's
 * crowns when given).
 */
export function atRiskWeek(games: ScheduledGame[], todayEp: number, crownsOf?: (ti: number) => Parameters<typeof teamStreaks>[2]): AtRiskWeek {
  const rows: AtRisk[] = [];
  for (const game of games) {
    for (const { ti, row } of game.sides) {
      const list = [...streaksOn(teamStreaks(ti, todayEp, crownsOf?.(ti) ?? null), row), ...h2hStreaksOn(ti, row)];
      for (const s of list) {
        const p = pBreak(s.dir, row.sp);
        if (p == null) continue;
        rows.push({ ti, s, game, row, p, stake: s.score * p });
      }
    }
  }
  rows.sort((a, b) => b.stake - a.stake || b.s.len - a.s.len);
  const seen = new Set<string>();
  const kept = rows.filter((r) => {
    const k = `${r.ti}|${r.s.dir}|${r.s.len}|${r.s.since}|${r.s.vs ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return r.stake >= AT_RISK_FLOOR;
  });
  return digestOf(kept, () => true, AT_RISK_CAP);
}
