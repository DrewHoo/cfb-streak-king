// The season files' rows from the miner: for every game, the runs it ended
// that a list could admit (a place the admit knob can reach, crowns.ts
// FILE_RANK, or the all-time longest), and the definitions under which a
// team became the sole leader because of it. seasonFile.ts is the file; this
// is what the build fills it with. The rows carry no score: a page tells and
// orders them with the list rule (list.ts).

import { P, gamesOf } from './model.ts';
import { brokenInput, keptBroken } from './broken.ts';
import type { BrokenRun, LeaderRun } from './crowns.ts';
import { teamData } from './crowns.ts';
import { keyOf, keyString } from './game.ts';
import { SHEET_DIRS } from './team.ts';
import type { GameRows, NewLeaderInput, Season } from './seasonFile.ts';

/** Every season's rows, by season, from the mined broken runs and new leaders. A season nothing happened in has no entry. */
export function buildSeasons(mined: { broken: Map<number, BrokenRun[]>; leaders: Map<number, LeaderRun[]>; teams: number }): Map<number, Season> {
  const gsOf = new Map(teamData().map((td) => [td.ti, td.gs]));
  const seasons = new Map<number, Season>();
  const rowsAt = (season: number, key: string): GameRows => {
    let s = seasons.get(season);
    if (!s) seasons.set(season, (s = { season, builtAt: P.builtAt, games: new Map(), complete: true }));
    let r = s.games.get(key);
    if (!r) s.games.set(key, (r = { ended: [], leaders: [] }));
    return r;
  };
  for (const [ti, runs] of mined.broken) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      // no score floor: a game's count holds every streak it broke, so it covers what the streak-breakers credit for it
      if (!keptBroken(r) || !SHEET_DIRS.includes(r.dir)) continue;
      const row = brokenInput(r, gs);
      rowsAt(row.ender.se, keyString(keyOf(ti, row.ender))).ended.push(row);
    }
  }
  for (const [ti, runs] of mined.leaders) {
    const gs = gsOf.get(ti)!;
    for (const r of runs) {
      if (!SHEET_DIRS.includes(r.dir)) continue;
      const cause = gamesOf(r.causeT)[r.causeIdx];
      if (!cause) continue;
      const { week: _w, causeT, causeIdx: _i, startIdx, prev, ...rest } = r;
      const row: NewLeaderInput = { ...rest, since: gs[startIdx].se, prev: prev >= 0 ? prev : null, scope: 'active', ended: prev >= 0 && causeT === prev };
      rowsAt(cause.se, keyString(keyOf(r.causeT, cause))).leaders.push(row);
    }
  }
  return seasons;
}
