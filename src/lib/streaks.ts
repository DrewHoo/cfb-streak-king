// Streak semantics shared by the client and the build-time known-answer
// checks. A streak is a run of consecutive qualifying games that all match
// an outcome: W (won), L (lost), U (undefeated: won or tied) or C (covered
// the closing spread). Non-qualifying games are invisible. A tie ends winning
// and losing runs and extends an undefeated one. A game without a line is
// invisible to a covering streak; a push ends one.

import type { BoardRow, Cover, Dir, GameRow, Result } from './types.ts';

interface Played { r: Result; cover?: Cover | null }

export const OUTCOMES: Dir[] = ['W', 'L', 'U', 'C'];

/** Whether a game counts toward a streak of outcome `o`. */
export const matches = (o: Dir, g: Played) => (o === 'C' ? g.cover === 'W' : o === 'U' ? g.r !== 'L' : g.r === o);
/** Whether a game can take part in a streak of outcome `o` at all: a covering streak needs a line. */
export const decided = (o: Dir, g: Played) => o !== 'C' || g.cover != null;

/**
 * The run of `o` that ends at the latest game, or null when the latest game
 * doesn't match. games: ascending. `ender` is the game that ended the
 * previous run, null when the run reaches the start of the list (the window
 * edge).
 */
export function activeRun<T extends Played>(games: T[], o: Dir) {
  let i = games.length - 1;
  while (i >= 0 && matches(o, games[i])) i--;
  const len = games.length - 1 - i;
  if (!len) return null;
  return { dir: o, len, atEdge: i < 0, last: games[games.length - 1], ender: i >= 0 ? games[i] : null };
}

/** Every maximal run of `o`, as [startIdx, endIdx] into games. */
export function runsOf<T extends Played>(games: T[], o: Dir): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  while (i < games.length) {
    if (!matches(o, games[i])) { i++; continue; }
    const start = i;
    while (i < games.length && matches(o, games[i])) i++;
    out.push([start, i - 1]);
  }
  return out;
}

/** The games of a board row's streak, newest first. */
export const streakGames = (row: BoardRow): GameRow[] => (
  row.s.startIdx != null
    ? row.qual.slice(row.s.startIdx, row.s.endIdx! + 1).reverse()
    : [...row.qual.slice(-row.s.len)].reverse()
);
