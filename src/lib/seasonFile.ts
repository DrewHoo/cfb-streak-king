// What a game did to the streaks, per season, as the build writes it to
// dist/games/<season>.json: for each game, the runs it ended whose team led
// the field (rank 1, ties included) as the week began, and the definitions
// under which a team became the sole leader because of it. The running
// season's rows come from the full four-chip space; an older season's from
// the definitions of up to two chips (crowns.ts, the history pass). A game
// page embeds its own rows (the running season) or fetches its season's
// file; the schedule fetches a season's file when the year changes.

import type { Crown, Dir } from './types.ts';
import { P, gamesOf } from './model.ts';
import type { BrokenStreak } from './broken.ts';
import { gameKeyFromString, keyString } from './game.ts';
import type { GameKey } from './game.ts';

/** A team that became the sole leader under a definition because of a game: its run after the game, and the run it passed. */
export interface NewLeader extends Crown {
  ti: number;
  /** The leader before the game, null when the field had no sole leader (a tie), and what it held; `second` is the longest other run after. */
  prev: number | null;
  prevLen: number;
  /** Whether the game ended the old leader's run (else the new leader's own game carried it past). */
  ended: boolean;
  /** The season the run started in. */
  since: number;
  scope: 'active';
}

export interface GameRows { ended: BrokenStreak[]; leaders: NewLeader[] }
export interface Season {
  season: number;
  builtAt: string;
  /** Rows by the game's key string ("2026-10-10/georgia-at-alabama"); a game with nothing of note has no entry. */
  games: Map<string, GameRows>;
  /** False for a slice a page embeds (one game's rows, one week's): a game missing from it may still have rows in the season's file. */
  complete: boolean;
}

export const rowsOf = (s: Season | null, k: GameKey): GameRows => s?.games.get(keyString(k)) ?? { ended: [], leaders: [] };

// --- the file ---

// a crown: [chips joined by '+', dir, len, atEdge, field, rank, tied, second, startSe, endSe, live, also, chance, score, dup]
type CrownRow = [string, Dir, number, 0 | 1, number, number, number, number, number | null, number | null, 0 | 1, number, number, number, 0 | 1];
// a broken run: [team, crown, since, ender game id, run start, the longest ever under the definition, how many teams' longest it is]
export type BrokenRow = [number, CrownRow, number, number, number, number, number];
// a new leader: [team, crown, since, previous leader or null, what it held, the old run ended (1) or the new one passed it (0)]
type LeaderRow = [number, CrownRow, number, number | null, number, 0 | 1];
export interface SeasonFile { v: 1; season: number; builtAt: string; complete?: boolean; games: Record<string, { ended: BrokenRow[]; leaders: LeaderRow[] }> }

const toCrown = (c: Crown): CrownRow => [
  c.chips.join('+'), c.dir, c.len, c.atEdge ? 1 : 0, c.field, c.rank, c.tied, c.second, c.startSe ?? null, c.endSe ?? null, c.live ? 1 : 0, c.also, +c.chance.toPrecision(2), +c.score.toFixed(2) || 0, c.dup ? 1 : 0,
];
const fromCrown = (scope: 'active' | 'all') => ([chips, dir, len, atEdge, field, rank, tied, second, startSe, endSe, live, also, chance, score, dup]: CrownRow): Crown => ({
  chips: chips ? chips.split('+') : [], dir, scope, len, atEdge: !!atEdge, field, rank, tied, second,
  ...(startSe != null ? { startSe } : {}), ...(endSe != null ? { endSe } : {}),
  live: !!live, also, chance, score, dup: !!dup,
});
export const encodeBroken = (b: BrokenStreak): BrokenRow => [b.ti, toCrown(b), b.since, b.ender.i, b.run, b.everLen, b.everN];
export const decodeBroken = ([ti, c, since, enderI, run, everLen, everN]: BrokenRow): BrokenStreak | null => {
  const ender = gamesOf(ti).find((g) => g.i === enderI);
  return ender ? { ...fromCrown('all')(c), scope: 'all', ti, since, run, ender, everLen: everLen ?? 0, everN: everN ?? 0 } : null;
};
const toLeader = (l: NewLeader): LeaderRow => [l.ti, toCrown(l), l.since, l.prev, l.prevLen, l.ended ? 1 : 0];
const fromLeader = ([ti, c, since, prev, prevLen, ended]: LeaderRow): NewLeader => ({ ...fromCrown('active')(c), scope: 'active', ti, since, prev, prevLen, ended: !!ended });

export function encodeSeason(s: Season): SeasonFile {
  const games: SeasonFile['games'] = {};
  for (const [k, r] of s.games) games[k] = { ended: r.ended.map(encodeBroken), leaders: r.leaders.map(toLeader) };
  return { v: 1, season: s.season, builtAt: s.builtAt, ...(s.complete ? {} : { complete: false }), games };
}

export function decodeSeason(f: SeasonFile): Season {
  const games = new Map<string, GameRows>();
  for (const [k, r] of Object.entries(f.games)) {
    if (!gameKeyFromString(k)) continue;
    games.set(k, { ended: r.ended.map(decodeBroken).filter((b): b is BrokenStreak => b != null), leaders: r.leaders.map(fromLeader) });
  }
  return { season: f.season, builtAt: f.builtAt, games, complete: f.complete !== false };
}

// --- in the browser ---

const loading = new Map<number, Promise<Season>>();

/** A season's file, once. A season no build has written (the dev server, or a season before the window) is empty. */
export function loadSeason(season: number): Promise<Season> {
  let p = loading.get(season);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}games/${season}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(decodeSeason)
      .catch(() => ({ season, builtAt: P.builtAt, games: new Map<string, GameRows>(), complete: true }));
    loading.set(season, p);
  }
  return p;
}
