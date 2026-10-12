// What the URL says about the view, and back. Pure: callers pass
// location.pathname / location.search in, and write the result with
// writeUrl() in urlState.js. Read it only after mount (the prerender has no
// window), except the team in the path, which main.jsx passes as `initial`.
//
//   /team/<id>/     the team's page (prerendered, with its own preview)
//   /game/<date>/<away>-at-<home>/
//                   one game's page: what it ended and who it made a leader,
//                   or what it puts at risk (-vs- for a neutral site)
//   /team/<id>/?vs= the old matchup address: the team's scheduled game
//                   against that team, or its next ("next"); opens the game
//   /games/         the schedule, one week at a time
//   /games/week/<n>/            one week of the running season
//   /games/<season>/week/<n>/   one week of a past season
//   /games/at-risk/ the schedule, opened on the week's at-risk streaks
//   ?t=<id>         the board: the team whose streak is open in the panel
//   ?c=             chips (definition.ts: absent = default, "all" = none)
//   ?dir=L|U|C|N    losing, undefeated, covering or not covering; winning is
//                   the default. W10 / L7: won or lost by that many or more
//                   (outcome.ts), every game of the run
//   ?scope=active   all-time is the default
//   ?week=1         only streaks that could be broken this week
//   ?run=<ep>       all-time: the open run, by its first game's epoch day
//                   (negative before 1970)

import type { ChipRef, Crown, Dir, Scope } from './types.ts';
import { teams, fbsNow } from './model.ts';
import { DEFAULT_CHIPS, DEFAULT_SCOPE, chipsFromParam, chipsToParam } from './definition.ts';
import { parseDir } from './outcome.ts';
import { refsOf } from './minedChips.ts';
import { gameVs } from './team.ts';
import { gameFromPath, gamePath, keyOf } from './game.ts';
import type { GameKey } from './game.ts';

export interface View {
  active: ChipRef[];
  dir: Dir;
  scope: Scope;
  week: boolean;
  /** The board: the team whose streak is open in the panel. */
  team: number | null;
  run: number | null;
  /** The team whose page is showing instead of the board. */
  page: number | null;
  /** The game whose page is showing instead of the board. */
  game: GameKey | null;
  /** The schedule of every scheduled game is showing instead of the board. */
  games: boolean;
  /** The schedule's week, /games/week/<n>/; null = the first scheduled week. */
  bwk: number | null;
  /** The streak-breakers leaderboard, /breakers/; with a team, that team's broken streaks, /breakers/<id>/. */
  breakers: boolean;
  breaker: number | null;
  /** The schedule's season, /games/<season>/week/<n>/; null = the running season. */
  season: number | null;
  /** The schedule, opened on the week's at-risk streaks: /games/at-risk/. */
  risk: boolean;
}

export const DEFAULT_VIEW: View = { active: DEFAULT_CHIPS, dir: 'W', scope: DEFAULT_SCOPE, week: false, team: null, run: null, page: null, game: null, games: false, bwk: null, season: null, risk: false, breakers: false, breaker: null };

const teamById = (id: string | null) => {
  const ti = id ? teams.findIndex((t) => t.id === id) : -1;
  return ti >= 0 && fbsNow.has(ti) ? ti : null;
};

/** The team in a path like /cfb-streak-king/team/alabama/. */
export const teamFromPath = (pathname: string) => teamById(/\/team\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null);
/** The week in a schedule path like /cfb-streak-king/games/week/5/ or /games/1987/week/5/; null elsewhere. */
export const weekFromPath = (pathname: string) => {
  const m = /\/games\/(?:\d{4}\/)?week\/(\d{1,2})\/?$/.exec(pathname);
  return m ? Number(m[1]) : null;
};
/** The season in a schedule path like /cfb-streak-king/games/1987/ or /games/1987/week/5/; null for the running season. */
export const seasonFromPath = (pathname: string) => {
  const m = /\/games\/(\d{4})(?:\/week\/\d{1,2})?\/?$/.exec(pathname);
  return m ? Number(m[1]) : null;
};
/** Whether a path is the schedule's at-risk streaks, /cfb-streak-king/games/at-risk/. */
export const riskFromPath = (pathname: string) => /\/games\/at-risk\/?$/.test(pathname);
/** Whether a path is the streak-breakers leaderboard, /cfb-streak-king/breakers/ (or its first address, /stoppers/). */
export const breakersFromPath = (pathname: string) => /\/(?:breakers|stoppers)\/?$/.test(pathname) || breakerFromPath(pathname) != null;
/** The team in a broken-streaks path like /cfb-streak-king/breakers/georgia/. */
export const breakerFromPath = (pathname: string) => teamById(/\/(?:breakers|stoppers)\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null);
/** Whether a path is the schedule, /cfb-streak-king/games/, a season or week of it, or its at-risk streaks. */
export const gamesFromPath = (pathname: string) => /\/games\/?$/.test(pathname) || weekFromPath(pathname) != null || seasonFromPath(pathname) != null || riskFromPath(pathname);

// the old matchup address names a game by one team and its opponent: that
// team's scheduled game against the opponent, else its next game
function matchupKey(ti: number, vs: string | null): GameKey | null {
  const g = gameVs(ti, teamById(vs), 0);
  return g ? keyOf(ti, g) : null;
}

export function parseUrl(pathname: string, search: string): View {
  const q = new URLSearchParams(search);
  const r = q.get('run');
  const inPath = teamFromPath(pathname);
  const bwk = weekFromPath(pathname);
  const matchup = inPath != null && q.has('vs') ? matchupKey(inPath, q.get('vs')) : null;
  const game = gameFromPath(pathname) ?? matchup;
  // before team pages, /team/<id>/ was the board with that team's panel open;
  // a link that carries a definition still opens the panel
  const oldPanel = inPath != null && !matchup && ['c', 'dir', 'scope', 'run', 'week'].some((k) => q.has(k));
  const page = oldPanel || game ? null : inPath;
  return {
    active: chipsFromParam(q.get('c')),
    dir: parseDir(q.get('dir')) ?? 'W',
    scope: q.get('scope') === 'active' ? 'active' : 'all',
    week: q.get('week') === '1',
    // ?team= is from older links still
    team: oldPanel ? inPath : inPath == null ? teamById(q.get('t')) ?? teamById(q.get('team')) : null,
    run: r != null && r !== '' && Number.isInteger(Number(r)) ? Number(r) : null,
    page,
    game,
    games: inPath == null && !game && gamesFromPath(pathname),
    bwk: inPath == null && !game ? bwk : null,
    season: inPath == null && !game ? seasonFromPath(pathname) : null,
    risk: inPath == null && !game && riskFromPath(pathname),
    breakers: inPath == null && !game && breakersFromPath(pathname),
    breaker: inPath == null && !game ? breakerFromPath(pathname) : null,
  };
}

export interface UrlParts { path: string; params: Record<string, string | null> }

/** The path under the site base and the params; null params are removed. */
export function toUrl(v: View): UrlParts {
  // a team page or a game page is its own address; the board's definition stays in memory
  const board = v.page == null && v.game == null && !v.games && !v.breakers;
  return {
    path: v.game != null ? gamePath(v.game) : v.page != null ? `team/${teams[v.page].id}/` : v.breakers ? `breakers/${v.breaker != null ? `${teams[v.breaker].id}/` : ''}` : v.games ? (v.risk ? 'games/at-risk/' : `games/${v.season != null ? `${v.season}/` : ''}${v.bwk != null ? `week/${v.bwk}/` : ''}`) : '',
    params: {
      vs: null, // the old matchup param
      t: board && v.team != null ? teams[v.team].id : null,
      c: board ? chipsToParam(v.active) : null,
      dir: !board || v.dir === 'W' ? null : v.dir,
      scope: !board || v.scope === DEFAULT_SCOPE ? null : v.scope,
      week: board && v.week ? '1' : null,
      run: board && v.scope === 'all' && v.run != null ? String(v.run) : null,
      team: null, // retired params from old links
      view: null,
      sort: null,
    },
  };
}

/** The link for one streak of a team's: the board under its definition, the team's panel open. */
export function crownUrl(ti: number, cr: Crown): UrlParts {
  return toUrl({ ...DEFAULT_VIEW, active: refsOf(cr.chips), dir: cr.dir, scope: cr.scope, team: ti });
}

/** The link to the schedule; with a week, to that week (of a past season when given); `risk`, to the week's at-risk streaks. */
export const gamesUrl = (bwk: number | null = null, risk = false, season: number | null = null): UrlParts => toUrl({ ...DEFAULT_VIEW, games: true, bwk, risk, season });

/** The link to the streak-breakers leaderboard. */
export const breakersUrl = (breaker: number | null = null): UrlParts => toUrl({ ...DEFAULT_VIEW, breakers: true, breaker });

/** The link to a team's page. */
export function teamUrl(ti: number): UrlParts {
  return toUrl({ ...DEFAULT_VIEW, page: ti });
}

/** The link to a game's page. */
export const gameUrl = (k: GameKey): UrlParts => toUrl({ ...DEFAULT_VIEW, game: k });
