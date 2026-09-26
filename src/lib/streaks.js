// Streak semantics shared by the client and the build-time known-answer
// checks. A team's current streak counts back from its most recent qualifying
// game: N consecutive qualifying games with the same result. Non-qualifying
// games are invisible. A tie is its own result and ends both W and L runs.

/**
 * games: ascending array of { r: 'W'|'L'|'T', ...anything }.
 * Returns { dir, len, atEdge, last, ender } where `last` is the most recent
 * qualifying game, `ender` the game that ended the previous run (null when
 * the streak reaches the start of the list — the window edge).
 */
export function currentStreak(games) {
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

/** Longest run of result `dir` anywhere in the list (for context lines). */
export function longestStreak(games, dir) {
  let best = 0;
  let bestEnd = -1;
  let run = 0;
  for (let i = 0; i < games.length; i++) {
    run = games[i].r === dir ? run + 1 : 0;
    if (run > best) {
      best = run;
      bestEnd = i;
    }
  }
  return best ? { len: best, start: games[bestEnd - best + 1], end: games[bestEnd] } : null;
}
