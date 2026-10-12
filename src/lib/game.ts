// One game, played or scheduled, as the game page and the schedule name it.
// A game's key is its date and its two teams, which is unique back to 1936
// and reads as its address: /game/2026-10-10/georgia-at-alabama/ (-vs- for
// a neutral site). The payload keeps played games and scheduled ones apart
// (gamesOf and upcomingOf), so a key resolves to one or the other.

import type { GameContext, GameRow } from './types.ts';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { scheduledGames } from './team.ts';
import type { ScheduledGame } from './team.ts';
import { completedWeeks, weekIdx } from './weeks.ts';

export interface GameKey {
  ep: number;
  /** The listed home team, neutral or not. */
  home: number;
  away: number;
  neutral: boolean;
}

/** The game a row describes, from `ti`'s side. */
export const keyOf = (ti: number, g: GameContext): GameKey => ({ ep: g.ep, home: g.home ? ti : g.oppIdx, away: g.home ? g.oppIdx : ti, neutral: g.neutral });
export const sameKey = (a: GameKey, b: GameKey) => a.ep === b.ep && a.home === b.home && a.away === b.away;
/** "2026-10-10" */
export const isoDate = (ep: number) => new Date(ep * 86400000).toISOString().slice(0, 10);
/** The key as one string, for a file's record: "2026-10-10/georgia-at-alabama". */
export const keyString = (k: GameKey) => `${isoDate(k.ep)}/${teams[k.away].id}-${k.neutral ? 'vs' : 'at'}-${teams[k.home].id}`;
/** The address under the site base. */
export const gamePath = (k: GameKey) => `game/${keyString(k)}/`;

/** The key in a path like /cfb-streak-king/game/2026-10-10/georgia-at-alabama/; null when it doesn't name two teams and a date. */
export function gameFromPath(pathname: string): GameKey | null {
  const m = /\/game\/(\d{4}-\d{2}-\d{2})\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (!m) return null;
  const ep = Math.floor(Date.parse(m[1] + 'T00:00:00Z') / 86400000);
  if (!Number.isFinite(ep)) return null;
  // a team id can carry hyphens ("miami-fl"), so try every split on -at- / -vs-
  const re = /-(at|vs)-/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m[2]))) {
    const away = teams.findIndex((t) => t.id === m[2].slice(0, x!.index));
    const home = teams.findIndex((t) => t.id === m[2].slice(x!.index + x![0].length));
    if (away >= 0 && home >= 0) return { ep, home, away, neutral: x[1] === 'vs' };
  }
  return null;
}
export const gameKeyFromString = (s: string) => gameFromPath(`/game/${s}/`);

/** A played game, from each FBS side (one side when the other team is below FBS). */
export interface PlayedGame { key: GameKey; sides: { ti: number; row: GameRow }[]; wk: number | null }
/** What a key names: a played game, a scheduled one, or nothing. */
export interface Found { key: GameKey; played: PlayedGame | null; scheduled: ScheduledGame | null }

export function findGame(k: GameKey): Found {
  const sides: { ti: number; row: GameRow }[] = [];
  for (const ti of [k.home, k.away]) {
    if (!fbsNow.has(ti)) continue;
    const row = gamesOf(ti).find((g) => g.ep === k.ep && g.oppIdx === (ti === k.home ? k.away : k.home));
    if (row) sides.push({ ti, row });
  }
  const played = sides.length ? { key: k, sides, wk: weekNumber(sides[0].row.se, k.ep) } : null;
  const scheduled = played ? null : scheduledGames().find((g) => g.ep === k.ep && g.home === k.home && g.away === k.away) ?? null;
  return { key: k, played, scheduled };
}

/** One game in a week's ledger: its key, and the played row from the home side (the away side when the home team is below FBS) or the scheduled game. */
export interface GameItem { key: GameKey; played?: { ti: number; row: GameRow }; scheduled?: ScheduledGame }
export interface SeasonWeek { wk: number; lo: number; hi: number; games: GameItem[] }

const seasonCache = new Map<number, SeasonWeek[]>();
let firstWeeks: Map<number, number> | null = null;
// a past season's weeks count from the week of its first game; the running season's are the schedule's
function weekNumber(season: number, ep: number): number | null {
  if (season === P.currentSeason) {
    const w = completedWeeks().find((x) => x.w === weekIdx(ep));
    if (w) return w.wk;
    const s = scheduledGames().find((g) => weekIdx(g.ep) === weekIdx(ep));
    return s ? s.wk : null;
  }
  if (!firstWeeks) {
    firstWeeks = new Map();
    const { se, ep: eps } = P.games;
    for (let i = 0; i < se.length; i++) {
      const w = weekIdx(eps[i]);
      if (!firstWeeks.has(se[i]) || w < firstWeeks.get(se[i])!) firstWeeks.set(se[i], w);
    }
  }
  const w0 = firstWeeks.get(season);
  return w0 == null ? null : weekIdx(ep) - w0 + 1;
}

/** The seasons the payload holds, latest first. */
export const seasons = (): number[] => {
  const out = new Set<number>(P.games.se);
  out.add(P.currentSeason);
  return [...out].sort((a, b) => b - a);
};

/** A season's weeks, each with its games in order: every played game with an FBS side, and (the running season) every scheduled one. */
export function seasonWeeks(season: number): SeasonWeek[] {
  const got = seasonCache.get(season);
  if (got) return got;
  const byKey = new Map<string, GameItem>();
  for (const ti of fbsNow) {
    for (const row of gamesOf(ti)) {
      if (row.se !== season) continue;
      const key = keyOf(ti, row);
      const ks = `${key.ep}|${key.home}|${key.away}`;
      const cur = byKey.get(ks);
      // the home side's row names the game; the away side's stands in when the home team is below FBS
      if (!cur || (row.home && !cur.played!.row.home)) byKey.set(ks, { key, played: { ti, row } });
    }
  }
  if (season === P.currentSeason) for (const g of scheduledGames()) byKey.set(`${g.ep}|${g.home}|${g.away}`, { key: { ep: g.ep, home: g.home, away: g.away, neutral: g.neutral }, scheduled: g });
  const weeks = new Map<number, SeasonWeek>();
  for (const item of byKey.values()) {
    const wk = item.scheduled ? item.scheduled.wk : weekNumber(season, item.key.ep);
    if (wk == null) continue;
    let w = weeks.get(wk);
    if (!w) weeks.set(wk, (w = { wk, lo: item.key.ep, hi: item.key.ep, games: [] }));
    w.lo = Math.min(w.lo, item.key.ep);
    w.hi = Math.max(w.hi, item.key.ep);
    w.games.push(item);
  }
  const hour = (h: number) => (h === 31 ? 99 : h);
  const hh = (x: GameItem) => hour(x.played ? x.played.row.hh : x.scheduled!.hh);
  for (const w of weeks.values()) w.games.sort((a, b) => a.key.ep - b.key.ep || hh(a) - hh(b) || teams[a.key.home].name.localeCompare(teams[b.key.home].name));
  const out = [...weeks.values()].sort((a, b) => a.wk - b.wk);
  seasonCache.set(season, out);
  return out;
}

/** The score from the listed home team's side: [home, away]. */
export function scoreOf(p: { ti: number; row: GameRow }): [number, number] {
  return p.row.home ? [p.row.us, p.row.them] : [p.row.them, p.row.us];
}
