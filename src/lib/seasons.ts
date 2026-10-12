// The season files' rows from the miner: for every game, the runs it ended
// whose team led the field as the week began (rank 1, ties included), and
// the definitions under which a team became the sole leader because of it.
// seasonFile.ts is the file; this is what the build fills it with.

import { P, gamesOf } from './model.ts';
import { chanceOf, crownScore } from './crownRank.ts';
import type { BrokenRun, LeaderRun } from './crowns.ts';
import { teamData } from './crowns.ts';
import { BROKEN_FLOOR } from './broken.ts';
import type { BrokenStreak } from './broken.ts';
import { keyOf, keyString } from './game.ts';
import { SHEET_DIRS } from './team.ts';
import type { GameRows, NewLeader, Season } from './seasonFile.ts';

/** Every season's rows, by season, from the mined broken runs and new leaders. A season nothing happened in has no entry. */
export function buildSeasons(mined: { broken: Map<number, BrokenRun[]>; leaders: Map<number, LeaderRun[]>; teams: number }): Map<number, Season> {
  const ctx = { teams: mined.teams };
  const gsOf = new Map(teamData().map((td) => [td.ti, td.gs]));
  const seasons = new Map<number, Season>();
  const rowsAt = (season: number, key: string): GameRows => {
    let s = seasons.get(season);
    if (!s) seasons.set(season, (s = { season, builtAt: P.builtAt, games: new Map() }));
    let r = s.games.get(key);
    if (!r) s.games.set(key, (r = { ended: [], leaders: [] }));
    return r;
  };
  for (const [ti, runs] of mined.broken) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      if (r.rank !== 1 || !SHEET_DIRS.includes(r.dir)) continue;
      const score = crownScore(r, ctx);
      if (score < BROKEN_FLOOR) continue;
      const ender = gs[r.enderIdx];
      const { p: _p, n: _n, enderIdx: _e, week: _w, startIdx, ...rest } = r;
      const row: BrokenStreak = { ...rest, ti, chance: chanceOf(r, ctx), score, since: gs[startIdx].se, ender, scope: 'all', run: gs[startIdx].ep };
      rowsAt(ender.se, keyString(keyOf(ti, ender))).ended.push(row);
    }
  }
  for (const [ti, runs] of mined.leaders) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      if (!SHEET_DIRS.includes(r.dir)) continue;
      const cause = gamesOf(r.causeT)[r.causeIdx];
      if (!cause) continue;
      const { p: _p, n: _n, week: _w, causeT, causeIdx: _i, startIdx, prev, ...rest } = r;
      const row: NewLeader = { ...rest, ti, chance: chanceOf(r, ctx), score: crownScore(r, ctx), since: gs[startIdx].se, prev: prev >= 0 ? prev : null, scope: 'active', ended: prev >= 0 && causeT === prev };
      rowsAt(cause.se, keyString(keyOf(r.causeT, cause))).leaders.push(row);
    }
  }
  for (const s of seasons.values()) {
    for (const r of s.games.values()) {
      r.ended.sort((a, b) => b.score - a.score || b.len - a.len);
      r.leaders.sort((a, b) => b.score - a.score || b.len - a.len);
    }
  }
  return seasons;
}
