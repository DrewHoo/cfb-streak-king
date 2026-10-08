// What the URL says about the view, and back. Pure: callers pass
// location.pathname / location.search in, and write the result with
// writeUrl() in urlState.js. Read it only after mount (the prerender has no
// window), except the team in the path, which main.jsx passes as `initial`.
//
//   /team/<id>/     the team's page (prerendered, with its own preview)
//   /team/<id>/?vs= a matchup: the team's scheduled game against that team,
//                   or its next game when there is none ("next" always is)
//   /games/         every scheduled game, by week
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
  /** The open matchup: the team whose game it is, and the opponent (null = its next game). */
  game: number | null;
  vs: number | null;
  /** The schedule of every scheduled game is showing instead of the board. */
  games: boolean;
  /** The schedule's broken-streaks week, /games/week/<n>/; null = the latest completed week. */
  bwk: number | null;
}

export const DEFAULT_VIEW: View = { active: DEFAULT_CHIPS, dir: 'W', scope: DEFAULT_SCOPE, week: false, team: null, run: null, page: null, game: null, vs: null, games: false, bwk: null };

const teamById = (id: string | null) => {
  const ti = id ? teams.findIndex((t) => t.id === id) : -1;
  return ti >= 0 && fbsNow.has(ti) ? ti : null;
};

/** The team in a path like /cfb-streak-king/team/alabama/. */
export const teamFromPath = (pathname: string) => teamById(/\/team\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null);
/** The week in a schedule path like /cfb-streak-king/games/week/5/; null elsewhere. */
export const weekFromPath = (pathname: string) => {
  const m = /\/games\/week\/(\d{1,2})\/?$/.exec(pathname);
  return m ? Number(m[1]) : null;
};
/** Whether a path is the schedule, /cfb-streak-king/games/ or a week of it. */
export const gamesFromPath = (pathname: string) => /\/games\/?$/.test(pathname) || weekFromPath(pathname) != null;

export function parseUrl(pathname: string, search: string): View {
  const q = new URLSearchParams(search);
  const r = q.get('run');
  const inPath = teamFromPath(pathname);
  const bwk = weekFromPath(pathname);
  const matchup = inPath != null && q.has('vs');
  // before team pages, /team/<id>/ was the board with that team's panel open;
  // a link that carries a definition still opens the panel
  const oldPanel = inPath != null && !matchup && ['c', 'dir', 'scope', 'run', 'week'].some((k) => q.has(k));
  return {
    active: chipsFromParam(q.get('c')),
    dir: parseDir(q.get('dir')) ?? 'W',
    scope: q.get('scope') === 'active' ? 'active' : 'all',
    week: q.get('week') === '1',
    // ?team= is from older links still
    team: oldPanel ? inPath : inPath == null ? teamById(q.get('t')) ?? teamById(q.get('team')) : null,
    run: r != null && r !== '' && Number.isInteger(Number(r)) ? Number(r) : null,
    page: oldPanel ? null : inPath,
    game: matchup ? inPath : null,
    vs: matchup ? teamById(q.get('vs')) : null,
    games: inPath == null && gamesFromPath(pathname),
    bwk: inPath == null ? bwk : null,
  };
}

export interface UrlParts { path: string; params: Record<string, string | null> }

/** The path under the site base and the params; null params are removed. */
export function toUrl(v: View): UrlParts {
  // a team page or a matchup is its own address; the board's definition stays in memory
  const board = v.page == null && v.game == null && !v.games;
  return {
    path: v.game != null ? `team/${teams[v.game].id}/` : v.page != null ? `team/${teams[v.page].id}/` : v.games ? (v.bwk != null ? `games/week/${v.bwk}/` : 'games/') : '',
    params: {
      vs: v.game != null ? (v.vs != null ? teams[v.vs].id : 'next') : null,
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
  return toUrl({ ...DEFAULT_VIEW, active: cr.chips.map((key) => ({ key })), dir: cr.dir, scope: cr.scope, team: ti });
}

/** The link to the schedule. */
export const gamesUrl = (): UrlParts => toUrl({ ...DEFAULT_VIEW, games: true });

/** The link to a team's page. */
export function teamUrl(ti: number): UrlParts {
  return toUrl({ ...DEFAULT_VIEW, page: ti });
}
