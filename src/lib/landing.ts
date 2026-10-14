// The named definition pages: a curated set of definitions, each at its own
// path (/longest-home-win-streaks/), prerendered with a title and an h1
// worded the way people search for it. The board is the same board; the
// path is the definition's canonical address, so a board that arrives at one
// of these definitions by any route writes the path (url.ts), and the share
// worker words a panel open on one from the table here (shareWords.ts).
//
// Pure: strings only, no model, so the worker can import it. `c` is the
// definition as the `c` URL param spells it ('all' = no constraints). The
// default definition (unranked, W, all-time) is the root page and must not
// appear here (landing.test pins it).

import type { Dir, Scope } from './types.ts';

export interface Landing {
  slug: string;
  /** The definition as the `c` param spells it; 'all' = no constraints. */
  c: string;
  dir: Dir;
  scope: Scope;
  /** The h1, and the title before the site's name. */
  h1: string;
  /** The meta description, and the line under the h1. */
  description: string;
}

const FIRST = 1936;

// what (the noun phrase: "home win streaks"), and the data note a floor adds
type Row = [slug: string, c: string, dir: Dir, scope: Scope, what: string, note?: string];
const ROWS: Row[] = [
  // active
  ['longest-active-win-streaks', 'all', 'W', 'active', 'win streaks'],
  ['longest-active-losing-streaks', 'all', 'L', 'active', 'losing streaks'],
  ['longest-active-unbeaten-streaks', 'all', 'U', 'active', 'unbeaten streaks'],
  ['longest-home-win-streaks', 'home', 'W', 'active', 'home win streaks'],
  ['longest-home-losing-streaks', 'home', 'L', 'active', 'home losing streaks'],
  ['longest-road-win-streaks', 'road', 'W', 'active', 'road win streaks'],
  ['longest-road-losing-streaks', 'road', 'L', 'active', 'road losing streaks'],
  ['longest-win-streaks-vs-ranked-teams', 'ranked', 'W', 'active', 'win streaks vs ranked teams'],
  ['longest-losing-streaks-vs-ranked-teams', 'ranked', 'L', 'active', 'losing streaks vs ranked teams'],
  ['longest-win-streaks-vs-unranked-teams', 'unranked', 'W', 'active', 'win streaks vs unranked teams'],
  ['longest-conference-win-streaks', 'confgame', 'W', 'active', 'conference win streaks'],
  ['longest-conference-losing-streaks', 'confgame', 'L', 'active', 'conference losing streaks'],
  ['longest-bowl-win-streaks', 'postseason', 'W', 'active', 'bowl win streaks'],
  ['longest-bowl-losing-streaks', 'postseason', 'L', 'active', 'bowl losing streaks'],
  ['longest-win-streaks-as-underdog', 'dog', 'W', 'active', 'win streaks as an underdog', 'Closing lines are known from 1978.'],
  // all-time
  ['longest-win-streaks-in-college-football-history', 'all', 'W', 'all', 'win streaks'],
  ['longest-losing-streaks-in-college-football-history', 'all', 'L', 'all', 'losing streaks'],
  ['longest-unbeaten-streaks-in-college-football-history', 'all', 'U', 'all', 'unbeaten streaks'],
  ['longest-home-win-streaks-ever', 'home', 'W', 'all', 'home win streaks'],
  ['longest-road-win-streaks-ever', 'road', 'W', 'all', 'road win streaks'],
  ['longest-road-losing-streaks-ever', 'road', 'L', 'all', 'road losing streaks'],
  ['longest-win-streaks-vs-ranked-teams-ever', 'ranked', 'W', 'all', 'win streaks vs ranked teams'],
  ['longest-conference-win-streaks-ever', 'confgame', 'W', 'all', 'conference win streaks'],
  ['longest-bowl-win-streaks-ever', 'postseason', 'W', 'all', 'bowl win streaks'],
];

export const LANDINGS: Landing[] = ROWS.map(([slug, c, dir, scope, what, note]) => ({
  slug, c, dir, scope,
  h1: scope === 'active' ? `Longest active ${what} in college football` : `Longest ${what} in college football history`,
  description: scope === 'active'
    ? `Every FBS team's longest active ${singular(what)}, ranked, with the next game that puts it on the line. Updated weekly in season, from every game since ${FIRST}.${note ? ` ${note}` : ''}`
    : `The longest ${what} in college football since ${FIRST}: every FBS team's best run, ranked, with every game in it.${note ? ` ${note}` : ''}`,
}));

function singular(what: string): string {
  return what.replace(/ streaks\b/, ' streak');
}

export const landingBySlug: ReadonlyMap<string, Landing> = new Map(LANDINGS.map((l) => [l.slug, l]));

/** The landing at a path like /cfb-streak-king/longest-home-win-streaks/; null elsewhere. */
export function landingFromPath(pathname: string): Landing | null {
  const m = /\/([a-z0-9-]+)\/?$/.exec(pathname);
  return (m && landingBySlug.get(m[1])) ?? null;
}

/** The landing for a definition, by its `c` spelling ('all' for none), direction and scope; null when it has no page. */
export function landingFor(c: string, dir: Dir, scope: Scope): Landing | null {
  return LANDINGS.find((l) => l.c === c && l.dir === dir && l.scope === scope) ?? null;
}
