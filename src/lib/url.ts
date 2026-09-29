// What the URL says about the view, and back. Pure: callers pass
// location.pathname / location.search in, and write the result with
// writeUrl() in urlState.js. Read it only after mount (the prerender has no
// window), except the team in the path, which main.jsx passes as `initial`.
//
//   /team/<id>/     the open team (a prerendered page with its own preview)
//   ?c=             chips (definition.ts: absent = default, "all" = none)
//   ?dir=L|U|C|N    losing, undefeated, covering or not covering; winning is
//                   the default
//   ?scope=active   all-time is the default
//   ?week=1         only streaks that could be broken this week
//   ?run=<ep>       all-time: the open run, by its first game's epoch day
//                   (negative before 1970)

import type { ChipRef, Crown, Dir, Scope } from './types.ts';
import { teams, fbsNow } from './model.ts';
import { DEFAULT_CHIPS, DEFAULT_SCOPE, chipsFromParam, chipsToParam } from './definition.ts';

export interface View {
  active: ChipRef[];
  dir: Dir;
  scope: Scope;
  week: boolean;
  team: number | null;
  run: number | null;
}

export const DEFAULT_VIEW: View = { active: DEFAULT_CHIPS, dir: 'W', scope: DEFAULT_SCOPE, week: false, team: null, run: null };

const teamById = (id: string | null) => {
  const ti = id ? teams.findIndex((t) => t.id === id) : -1;
  return ti >= 0 && fbsNow.has(ti) ? ti : null;
};

/** The open team in a path like /cfb-streak-king/team/alabama/. */
export const teamFromPath = (pathname: string) => teamById(/\/team\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null);

export function parseUrl(pathname: string, search: string): View {
  const q = new URLSearchParams(search);
  const d = q.get('dir');
  const r = q.get('run');
  return {
    active: chipsFromParam(q.get('c')),
    dir: d === 'L' || d === 'U' || d === 'C' || d === 'N' ? d : 'W',
    scope: q.get('scope') === 'active' ? 'active' : 'all',
    week: q.get('week') === '1',
    // ?team= is from old links; writing the URL moves it into the path
    team: teamFromPath(pathname) ?? teamById(q.get('team')),
    run: r != null && r !== '' && Number.isInteger(Number(r)) ? Number(r) : null,
  };
}

export interface UrlParts { path: string; params: Record<string, string | null> }

/** The path under the site base and the params; null params are removed. */
export function toUrl(v: View): UrlParts {
  return {
    path: v.team != null ? `team/${teams[v.team].id}/` : '',
    params: {
      c: chipsToParam(v.active),
      dir: v.dir === 'W' ? null : v.dir,
      scope: v.scope === DEFAULT_SCOPE ? null : v.scope,
      week: v.week ? '1' : null,
      run: v.scope === 'all' && v.run != null ? String(v.run) : null,
      team: null, // retired params from old links
      view: null,
      sort: null,
    },
  };
}

/** The link for one streak a team is king of: its team page with the crown's definition. */
export function crownUrl(ti: number, cr: Crown): UrlParts {
  return toUrl({ ...DEFAULT_VIEW, active: cr.chips.map((key) => ({ key })), dir: cr.dir, scope: cr.scope, team: ti });
}
