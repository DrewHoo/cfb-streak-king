// The view's state and every way it changes. Pure, so the rules are testable:
// a new definition, scope or direction starts the board at its first columns
// again; all-time mode has no "this week" filter. Three things open: a streak
// (the board's panel), a game (its page, in place of the board) and a team
// (its page, likewise); the schedule is a fourth view in the board's place. A chip that can't define
// the direction's streaks (one-score or shootout vs the spread) drops,
// whatever brought the pair in: an old URL, a saved streak.

import type { BoardRow, ChipRef, Dir, Scope } from './types.ts';
import type { View } from './url.ts';
import type { GameKey } from './game.ts';
import { DEFAULT_VIEW } from './url.ts';
import { chipByKey, fitsDir } from './chips.ts';

/** Columns shown before "more" on desktop. */
export const DESKTOP_CAP = 20;

export interface ViewState extends View {
  /** Columns shown before "more". */
  limit: number;
}

export type ViewAction =
  | { type: 'load'; view: View }
  | { type: 'define'; active: ChipRef[]; dir?: Dir }
  | { type: 'scope'; scope: Scope }
  | { type: 'dir'; dir: Dir }
  | { type: 'week'; on: boolean }
  | { type: 'streak'; chips: (string | ChipRef)[]; dir: Dir; scope: Scope; team?: number; run?: number | null }
  | { type: 'pick'; row: BoardRow }
  | { type: 'close' }
  | { type: 'page'; team: number }
  | { type: 'games' }
  | { type: 'bweek'; wk: number | null; season?: number | null }
  | { type: 'risk' }
  | { type: 'board' }
  | { type: 'game'; key: GameKey }
  | { type: 'limit'; limit: number | ((l: number) => number) };

export const initialView = (page: number | null = null, games = false, bwk: number | null = null, risk = false, game: GameKey | null = null, season: number | null = null): ViewState => ({ ...DEFAULT_VIEW, page, game, games, bwk, season, risk, limit: DESKTOP_CAP });

/** Whether a board row is the one already open. */
export const isOpen = (v: View, row: BoardRow) => v.team === row.ti && (v.scope !== 'all' || v.run === row.s.start?.ep);

const fit = (v: ViewState): ViewState => {
  const active = v.active.filter((c) => { const chip = chipByKey.get(c.key); return !chip || fitsDir(chip, v.dir); });
  return active.length === v.active.length ? v : { ...v, active };
};

export function viewReducer(v: ViewState, a: ViewAction): ViewState {
  return fit(reduce(v, a));
}

function reduce(v: ViewState, a: ViewAction): ViewState {
  switch (a.type) {
    case 'load':
      // a team page's, a game page's or the schedule's URL says nothing of the board; keep the one in memory
      return a.view.page != null || a.view.game != null || a.view.games
        ? { ...v, page: a.view.page, game: a.view.game, games: a.view.games, bwk: a.view.bwk, season: a.view.season, risk: a.view.risk }
        : { ...v, ...a.view };
    case 'define':
      return { ...v, active: a.active, dir: a.dir ?? v.dir, limit: DESKTOP_CAP };
    case 'scope':
      return { ...v, scope: a.scope, limit: DESKTOP_CAP, week: a.scope === 'all' ? false : v.week };
    case 'dir':
      return { ...v, dir: a.dir, limit: DESKTOP_CAP };
    case 'week':
      return { ...v, week: a.on };
    case 'streak':
      // one streak's board; from a team page or a game page it comes with that
      // team's panel open, and an ended run (a broken streak) with that run's
      // all-time row. A chip may carry its choice ("vs [team]").
      return {
        ...v, active: a.chips.map((c) => (typeof c === 'string' ? { key: c } : c)), dir: a.dir, scope: a.scope,
        run: (a.scope === 'all' ? a.run : null) ?? null, limit: DESKTOP_CAP,
        team: a.team ?? v.team, page: null, game: null, games: false, bwk: null, season: null, risk: false, week: a.scope === 'all' ? false : v.week,
      };
    case 'pick': {
      // picking the open row closes it; in all-time mode a team has one row per run
      if (isOpen(v, a.row)) return { ...v, team: null, run: null };
      return { ...v, team: a.row.ti, run: v.scope === 'all' ? a.row.s.start?.ep ?? null : null };
    }
    case 'close':
      return { ...v, team: null, run: null };
    case 'page':
      // a team page over whatever is showing; the schedule underneath keeps its week for Back
      return { ...v, page: a.team, game: null };
    case 'games':
      return { ...v, games: true, bwk: null, season: null, risk: false, page: null, game: null };
    case 'bweek':
      // one week of the schedule, its own address; a null week is the season's default week
      return { ...v, games: true, bwk: a.wk, season: a.season ?? null, risk: false, page: null, game: null };
    case 'risk':
      // the week's at-risk streaks, their own address
      return { ...v, games: true, bwk: null, season: null, risk: true, page: null, game: null };
    case 'board':
      return { ...v, page: null, game: null, games: false, bwk: null, season: null, risk: false };
    case 'game':
      // a game's page, in place of whatever is showing
      return { ...v, game: a.key, page: null, games: false, bwk: null, season: null, risk: false };
    case 'limit':
      return { ...v, limit: typeof a.limit === 'function' ? a.limit(v.limit) : a.limit };
  }
}
