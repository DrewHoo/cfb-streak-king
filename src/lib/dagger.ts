// A streak's count carries a dagger (42†) when missing data could change its
// length. Two things can: a game the definition can't decide (no kickoff
// time for "night game", no line for "as an underdog", no opposing coach on
// record before 1978), inside the run or next to it with a result that would
// extend it; and the data's first season, when nothing qualifying precedes
// the run and the team's earlier games could have counted. A chip that
// can't hold before 1936 (the AP poll's first season) closes that edge, and
// a team that joined FBS later starts its list at its first FBS season by
// rule, so neither carries a dagger. The games drawn are only the ones that
// qualify; the dagger's note says what's missing.
//
// mineCore.js holds the bit walk (unsureGames), shared with the miner so the
// board and every mined list agree.

import type { ChipRef, Dir, GameRow } from './types.ts';
import { chipByKey, qualifies } from './chips.ts';
import type { Chip, Param } from './chips.ts';
import { againstSpread, decided, matches } from './streaks.ts';
import { prevBit, unsureGames } from './mineCore.js';

export const DAGGER = '†';

/** Why a run's length is unsure: games before the data, and the games that could extend or break it, by what they lack. */
export interface Unsure {
  /** The run reaches back to the data's first season. */
  before: number | null;
  longer: number;
  shorter: number;
  what: string[];
}

/**
 * One team's games under a definition, as the dagger reads them: `unsure`
 * says whether a run (start and end as indices into `qual`) carries one,
 * `why` what makes it unsure. `all` holds at least every game the
 * definition could take (a by-opponent column passes the games against
 * that opponent).
 */
export function daggerFor(all: GameRow[], qual: GameRow[], active: ChipRef[], dir: Dir, open: boolean, firstSeason: number) {
  const chips = active.map((a): [Chip, Param] => [chipByKey.get(a.key)!, a.param]);
  const edge = open && !chips.some(([c]) => c.begins != null);
  // no chip can miss data and every game has the outcome's: only the data's first season can make a run unsure
  if (!againstSpread(dir) && !chips.some(([c]) => c.missing)) {
    return {
      unsure: (startIdx: number, _endIdx?: number) => edge && startIdx === 0,
      why: (startIdx: number, _endIdx?: number): Unsure => ({ before: edge && startIdx === 0 ? firstSeason : null, longer: 0, shorter: 0, what: [] }),
    };
  }
  const n = all.length;
  const words = Math.ceil(n / 32) || 1;
  const m = new Uint32Array(words), p = new Uint32Array(words);
  const at = new Map<GameRow, number>();
  all.forEach((g, i) => at.set(g, i));
  for (const g of qual) { const i = at.get(g)!; m[i >> 5] |= 1 << (i & 31); }
  all.forEach((g, i) => {
    if (chips.every(([c, param]) => qualifies(c, g, param) || c.missing?.test(g))) p[i >> 5] |= 1 << (i & 31);
  });
  const joins = (i: number) => !decided(dir, all[i]) || matches(dir, all[i]);
  const span = (startIdx: number, endIdx: number) => [at.get(qual[startIdx])!, at.get(qual[endIdx])!];
  return {
    unsure(startIdx: number, endIdx: number) {
      const [s, e] = span(startIdx, endIdx);
      return (edge && prevBit(m, s) < 0) || unsureGames(n, m, p, joins, s, e) > 0;
    },
    why(startIdx: number, endIdx: number): Unsure {
      const [s, e] = span(startIdx, endIdx);
      const out: number[] = [];
      unsureGames(n, m, p, joins, s, e, out);
      const what = new Set<string>();
      let longer = 0, shorter = 0;
      for (const i of out) {
        if (joins(i)) longer++; else shorter++;
        for (const [c] of chips) if (c.missing?.test(all[i])) what.add(c.missing.what);
        if (againstSpread(dir) && !decided(dir, all[i])) what.add('closing line');
      }
      return { before: edge && prevBit(m, s) < 0 ? firstSeason : null, longer, shorter, what: [...what] };
    },
  };
}

const games = (k: number) => `${k} ${k === 1 ? 'game' : 'games'}`;
const or = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/** The dagger's note: "† 32 games in or next to this streak have no kickoff time on record, so it could be longer or shorter." */
export function daggerNote(u: Unsure): string {
  const k = u.longer + u.shorter;
  const parts: string[] = [];
  if (k) {
    const could = u.longer && u.shorter ? 'longer or shorter' : u.shorter ? 'shorter' : 'longer';
    parts.push(`${games(k)} in or next to this streak ${k === 1 ? 'has' : 'have'} no ${or(u.what)} on record, so it could be ${could}`);
  }
  if (u.before != null) parts.push(`${k ? 'and it' : 'It'} may reach back before ${u.before}, where the data starts`);
  return `${DAGGER} ${parts.join('; ')}.`;
}
