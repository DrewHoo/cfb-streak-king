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

import type { BoardRow, Dir, Scope } from './types.ts';

export interface Landing {
  slug: string;
  /** The definition as the `c` param spells it; 'all' = no constraints. */
  c: string;
  dir: Dir;
  scope: Scope;
  /** The h1. */
  h1: string;
  /** The <title> before the season and the site's name, in the words people search with ("current", "winning"). */
  title: string;
  /** The noun phrase: "home win streaks". */
  what: string;
  /** The meta description, and the line under the h1. */
  description: string;
}

const FIRST = 1936;

// what (the noun phrase: "home win streaks"), the data note a floor adds, and
// a <title> of its own where the searcher's words differ from the page's
// ("cover streaks" on the page, "ATS" in the search box)
type Row = [slug: string, c: string, dir: Dir, scope: Scope, what: string, note?: string, title?: string];
const LINES = 'Closing lines are known from 1978.';
const COVER = `A cover is a win against the spread (ATS): the team beat the closing line. ${LINES}`;
const NOCOVER = `ATS is against the spread: a loss here is a game the team didn't cover. ${LINES}`;
const NIGHT = 'Kickoff times are known from 2002.';
const BY10 = 'Every game in the run was won by 10 points or more.';
const ANIMAL = 'An animal mascot is a creature: Bulldogs, Tigers, Gators, Eagles; not Volunteers, Rebels or Sun Devils.';
const ROWS: Row[] = [
  // active
  ['longest-active-win-streaks', 'all', 'W', 'active', 'win streaks'],
  ['longest-active-losing-streaks', 'all', 'L', 'active', 'losing streaks'],
  ['longest-active-unbeaten-streaks', 'all', 'U', 'active', 'unbeaten streaks'],
  ['longest-double-digit-win-streaks', 'all', 'W10', 'active', 'win streaks by 10+ points', BY10, 'Current longest streaks of double-digit wins in college football'],
  ['longest-home-win-streaks', 'home', 'W', 'active', 'home win streaks'],
  ['longest-home-losing-streaks', 'home', 'L', 'active', 'home losing streaks'],
  ['longest-road-win-streaks', 'road', 'W', 'active', 'road win streaks'],
  ['longest-road-losing-streaks', 'road', 'L', 'active', 'road losing streaks'],
  ['longest-win-streaks-vs-ranked-teams', 'ranked', 'W', 'active', 'win streaks vs ranked teams'],
  ['longest-losing-streaks-vs-ranked-teams', 'ranked', 'L', 'active', 'losing streaks vs ranked teams'],
  ['longest-win-streaks-vs-top-10-teams', 'top10', 'W', 'active', 'win streaks vs top-10 teams'],
  ['longest-win-streaks-vs-top-5-teams', 'top5', 'W', 'active', 'win streaks vs top-5 teams'],
  ['longest-win-streaks-vs-unranked-teams', 'unranked', 'W', 'active', 'win streaks vs unranked teams'],
  ['longest-conference-win-streaks', 'confgame', 'W', 'active', 'conference win streaks'],
  ['longest-conference-losing-streaks', 'confgame', 'L', 'active', 'conference losing streaks'],
  ['longest-bowl-win-streaks', 'postseason', 'W', 'active', 'bowl win streaks'],
  ['longest-bowl-losing-streaks', 'postseason', 'L', 'active', 'bowl losing streaks'],
  ['longest-win-streaks-as-underdog', 'dog', 'W', 'active', 'win streaks as an underdog', LINES],
  ['longest-win-streaks-as-favorite', 'fav', 'W', 'active', 'win streaks as the favorite', LINES],
  // against the spread: the searcher says "ATS" or "cover streak", the page says "cover streaks"
  ['longest-active-cover-streaks', 'all', 'C', 'active', 'cover streaks', COVER, 'Current longest cover streaks (ATS) in college football'],
  ['longest-active-ats-losing-streaks', 'all', 'N', 'active', 'ATS losing streaks', NOCOVER],
  ['longest-home-cover-streaks', 'home', 'C', 'active', 'home cover streaks', COVER, 'Current longest home cover streaks (ATS) in college football'],
  ['longest-night-game-win-streaks', 'night', 'W', 'active', 'night game win streaks', NIGHT],
  ['longest-win-streaks-in-september', 'month:9', 'W', 'active', 'September win streaks'],
  ['longest-win-streaks-in-october', 'month:10', 'W', 'active', 'October win streaks'],
  ['longest-win-streaks-in-november', 'month:11', 'W', 'active', 'November win streaks'],
  ['longest-win-streaks-vs-animal-mascots', 'vsmascot:animal', 'W', 'active', 'win streaks vs animal mascots', ANIMAL],
  // all-time: one for every active page, in the same order
  ['longest-win-streaks-in-college-football-history', 'all', 'W', 'all', 'win streaks'],
  ['longest-losing-streaks-in-college-football-history', 'all', 'L', 'all', 'losing streaks'],
  ['longest-unbeaten-streaks-in-college-football-history', 'all', 'U', 'all', 'unbeaten streaks'],
  ['longest-double-digit-win-streaks-ever', 'all', 'W10', 'all', 'win streaks by 10+ points', BY10, 'Longest streaks of double-digit wins in college football history'],
  ['longest-home-win-streaks-ever', 'home', 'W', 'all', 'home win streaks'],
  ['longest-home-losing-streaks-ever', 'home', 'L', 'all', 'home losing streaks'],
  ['longest-road-win-streaks-ever', 'road', 'W', 'all', 'road win streaks'],
  ['longest-road-losing-streaks-ever', 'road', 'L', 'all', 'road losing streaks'],
  ['longest-win-streaks-vs-ranked-teams-ever', 'ranked', 'W', 'all', 'win streaks vs ranked teams'],
  ['longest-losing-streaks-vs-ranked-teams-ever', 'ranked', 'L', 'all', 'losing streaks vs ranked teams'],
  ['longest-win-streaks-vs-top-10-teams-ever', 'top10', 'W', 'all', 'win streaks vs top-10 teams'],
  ['longest-win-streaks-vs-top-5-teams-ever', 'top5', 'W', 'all', 'win streaks vs top-5 teams'],
  // (all-time win streaks vs unranked teams is the default definition: the root page, not a landing)
  ['longest-conference-win-streaks-ever', 'confgame', 'W', 'all', 'conference win streaks'],
  ['longest-conference-losing-streaks-ever', 'confgame', 'L', 'all', 'conference losing streaks'],
  ['longest-bowl-win-streaks-ever', 'postseason', 'W', 'all', 'bowl win streaks'],
  ['longest-bowl-losing-streaks-ever', 'postseason', 'L', 'all', 'bowl losing streaks'],
  ['longest-win-streaks-as-underdog-ever', 'dog', 'W', 'all', 'win streaks as an underdog', LINES],
  ['longest-win-streaks-as-favorite-ever', 'fav', 'W', 'all', 'win streaks as the favorite', LINES],
  ['longest-cover-streaks-ever', 'all', 'C', 'all', 'cover streaks', COVER, 'Longest cover streaks (ATS) in college football history'],
  ['longest-ats-losing-streaks-ever', 'all', 'N', 'all', 'ATS losing streaks', NOCOVER],
  ['longest-home-cover-streaks-ever', 'home', 'C', 'all', 'home cover streaks', COVER, 'Longest home cover streaks (ATS) in college football history'],
  ['longest-night-game-win-streaks-ever', 'night', 'W', 'all', 'night game win streaks', NIGHT],
  ['longest-win-streaks-in-september-ever', 'month:9', 'W', 'all', 'September win streaks'],
  ['longest-win-streaks-in-october-ever', 'month:10', 'W', 'all', 'October win streaks'],
  ['longest-win-streaks-in-november-ever', 'month:11', 'W', 'all', 'November win streaks'],
  ['longest-win-streaks-vs-animal-mascots-ever', 'vsmascot:animal', 'W', 'all', 'win streaks vs animal mascots', ANIMAL],
];

export const LANDINGS: Landing[] = ROWS.map(([slug, c, dir, scope, what, note, title]) => ({
  slug, c, dir, scope, what,
  h1: scope === 'active' ? `Longest active ${what} in college football` : `Longest ${what} in college football history`,
  title: title ?? (scope === 'active' ? `Current longest ${winning(what)} in college football` : `Longest ${winning(what)} in college football history`),
  description: scope === 'active'
    ? `Every FBS team's longest active ${singular(what)}, ranked, with the next game that puts it on the line. Updated weekly in season, from every game since ${FIRST}.${note ? ` ${note}` : ''}`
    : `The longest ${what} in college football since ${FIRST}: every FBS team's best run, ranked, with every game in it.${note ? ` ${note}` : ''}`,
}));

function singular(what: string): string {
  return what.replace(/ streaks\b/, ' streak');
}

// "win streaks" is the page's word, "winning streaks" the searcher's
function winning(what: string): string {
  return what.replace(/\bwin streaks\b/, 'winning streaks');
}

/** A board row as the lead sentence reads it. */
export interface LeadRow {
  name: string;
  len: number;
  /** The run reaches the first game in the window, so it's at least len. */
  atEdge: boolean;
  /** Epoch days of the run's first and last games. */
  startEp?: number;
  endEp?: number;
  /** All-time: the run is still going. */
  live?: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const yearOf = (ep: number) => new Date(ep * 86400000).getUTCFullYear();
const monthOf = (ep: number) => `${MONTHS[new Date(ep * 86400000).getUTCMonth()]} ${yearOf(ep)}`;
const games = (r: LeadRow) => `${r.len}${r.atEdge ? '+' : ''} ${r.len === 1 && !r.atEdge ? 'game' : 'games'}`;
function names(ns: string[]): string {
  if (ns.length > 3) return `${ns.slice(0, 3).join(', ')} and ${ns.length - 3} more`;
  return ns.length < 3 ? ns.join(' and ') : `${ns[0]}, ${ns[1]} and ${ns[2]}`;
}

/** The first rows of a board as leadSentence reads them. */
export function leadRows(rows: BoardRow[], nameOf: (ti: number) => string): LeadRow[] {
  return rows.map((r) => ({
    name: nameOf(r.ti), len: r.s.len, atEdge: r.s.atEdge,
    // an active run carries no start game: it's the last len of the team's qualifying games
    startEp: (r.s.start ?? (r.qual.length >= r.s.len ? r.qual[r.qual.length - r.s.len] : undefined))?.ep,
    endEp: (r.s.end ?? r.s.last)?.ep, live: r.live,
  }));
}

/**
 * The answer to the page's question in one or two sentences, named in text
 * so a search snippet can lift it: "Indiana has the longest active win streak
 * in FBS: 22 games, since October 2024. Then Texas Tech at 16 and Oregon at 11."
 * Rows in board order; '' when the board is empty.
 */
export function leadSentence(l: Landing, rows: LeadRow[]): string {
  if (rows.length === 0) return '';
  const top = rows[0];
  const tied = rows.filter((r) => r.len === top.len && r.atEdge === top.atEdge);
  const leaders = [...new Set(tied.map((r) => r.name))];
  const thing = singular(l.what);
  let first: string;
  if (l.scope === 'active') {
    first = leaders.length === 1
      ? `${top.name} has the longest active ${thing} in FBS: ${games(top)}${top.startEp != null && !top.atEdge ? `, since ${monthOf(top.startEp)}` : ''}.`
      : `${names(leaders)} share the longest active ${thing} in FBS: ${games(top)}.`;
  } else if (tied.length === 1) {
    const span = top.live
      ? (top.startEp != null ? `, from ${yearOf(top.startEp)} and still going` : ', still going')
      : top.startEp != null && top.endEp != null
        ? `, ${yearOf(top.startEp)}${yearOf(top.endEp) === yearOf(top.startEp) ? '' : `–${yearOf(top.endEp)}`}`
        : '';
    first = `${top.name} holds the longest ${thing} of any FBS team since ${FIRST}: ${games(top)}${span}.`;
  } else {
    first = `${names(leaders)} share the longest ${thing} of any FBS team since ${FIRST}: ${games(top)}.`;
  }
  const then = rows.slice(tied.length, tied.length + 2).map((r) => `${r.name} at ${r.len}${r.atEdge ? '+' : ''}`);
  return then.length ? `${first} Then ${then.join(' and ')}.` : first;
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
