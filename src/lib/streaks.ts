// Streak semantics shared by the client and the build-time known-answer
// checks. A team's current streak counts back from its most recent qualifying
// game: N consecutive qualifying games with the same result. Non-qualifying
// games are invisible. A tie is its own result and ends both W and L runs.

import type { BoardRow, GameRow, Result } from './types.ts';

interface Played { r: Result }

/**
 * games: ascending. Returns { dir, len, atEdge, last, ender } where `last` is
 * the most recent qualifying game, `ender` the game that ended the previous
 * run (null when the streak reaches the start of the list, the window edge).
 */
export function currentStreak<T extends Played>(games: T[]) {
  if (!games.length) return null;
  const last = games[games.length - 1];
  const dir = last.r;
  let i = games.length - 1;
  while (i >= 0 && games[i].r === dir) i--;
  return {
    dir,
    len: games.length - 1 - i,
    atEdge: i < 0,
    last,
    ender: i >= 0 ? games[i] : null,
  };
}

/** The games of a board row's streak, newest first. */
export const streakGames = (row: BoardRow): GameRow[] => (
  row.s.startIdx != null
    ? row.qual.slice(row.s.startIdx, row.s.endIdx! + 1).reverse()
    : [...row.qual.slice(-row.s.len)].reverse()
);
