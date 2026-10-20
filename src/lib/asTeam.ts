// The by-opponent board, "as [team]": the board with one team fixed and its
// opponents as the columns, each column the team's run under the definition
// against that opponent (createModel's asBoard). Two of its definitions have
// pages of their own, the questions people ask about a team: who has beaten
// it the most times in a row (its all-time losing streaks by opponent), and
// which teams it has beaten the most times in a row (its winning ones), at
// /team/<id>/losing-streaks-by-opponent/ and /team/<id>/win-streaks-by-opponent/.
// Every other state of the board is the root with ?as=<id>.
//
// Pure: strings only, no model, so the share worker can import it. Names
// come from the caller (the model's teams, or the worker's meta).

import type { Dir } from './types.ts';
import type { LeadRow } from './landing.ts';

/** The two directions with a page, and the path segment each takes under /team/<id>/. */
export const AS_SLUGS: Record<'W' | 'L', string> = { W: 'win-streaks-by-opponent', L: 'losing-streaks-by-opponent' };
const DIR_OF_SLUG = new Map(Object.entries(AS_SLUGS).map(([d, s]) => [s, d as 'W' | 'L']));

/** A by-opponent page's address under the site base, for a team id. */
export const asPath = (id: string, dir: 'W' | 'L') => `team/${id}/${AS_SLUGS[dir]}/`;

/** The team id and direction a by-opponent path names, like /cfb-streak-king/team/auburn/losing-streaks-by-opponent/; null elsewhere. */
export function asFromPath(pathname: string): { id: string; dir: 'W' | 'L' } | null {
  const m = /\/team\/([a-z0-9-]+)\/([a-z-]+)\/?$/.exec(pathname);
  const dir = m && DIR_OF_SLUG.get(m[2]);
  return m && dir ? { id: m[1], dir } : null;
}

/** Whether a board state is one of the two pages: no conditions, all-time, winning or losing. */
export const asPageDir = (chips: number, dir: Dir, scope: string): 'W' | 'L' | null => (chips === 0 && scope === 'all' && (dir === 'W' || dir === 'L') ? dir : null);

/** The h1: the question the page answers. */
export const asH1 = (name: string, dir: 'W' | 'L') => (dir === 'L' ? `Who has beaten ${name} the most times in a row?` : `Who has ${name} beaten the most times in a row?`);

/** The <title> before the site's name. */
export const asTitle = (name: string, dir: 'W' | 'L', since: number) => (dir === 'L'
  ? `Who has beaten ${name} the most times in a row? Every opponent's longest winning streak over ${name}, since ${since}`
  : `Who has ${name} beaten the most times in a row? ${name}'s longest winning streak against every opponent, since ${since}`);

/** The meta description, and the line under the h1 after the lead sentence. */
export const asDescription = (name: string, dir: 'W' | 'L', since: number) => (dir === 'L'
  ? `Every opponent's longest winning streak over ${name} since ${since}, ranked, with every game in each, and where the series stands now.`
  : `${name}'s longest winning streak against every opponent it has played since ${since}, ranked, with every game in each, and where the series stands now.`);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const yearOf = (ep: number) => new Date(ep * 86400000).getUTCFullYear();
const monthOf = (ep: number) => `${MONTHS[new Date(ep * 86400000).getUTCMonth()]} ${yearOf(ep)}`;
const times = (r: LeadRow) => `${r.len}${r.atEdge ? '+' : ''} straight ${r.len === 1 && !r.atEdge ? 'time' : 'times'}`;
function names(ns: string[]): string {
  if (ns.length > 3) return `${ns.slice(0, 3).join(', ')} and ${ns.length - 3} more`;
  return ns.length < 3 ? ns.join(' and ') : `${ns[0]}, ${ns[1]} and ${ns[2]}`;
}
// ", since October 2020" for a live run; ", 1941–1954" for an ended one, and for a run at the
// window's edge (its + says it may be older than the data), live or not
function when(r: LeadRow): string {
  if (r.live && !r.atEdge) return r.startEp != null ? `, since ${monthOf(r.startEp)}` : '';
  if (r.startEp != null && r.endEp != null) return `, ${yearOf(r.startEp)}${yearOf(r.endEp) === yearOf(r.startEp) ? '' : `–${yearOf(r.endEp)}`}`;
  return '';
}

/**
 * The answer in one or two sentences, named in text so a search snippet can
 * lift it: "Georgia Tech beat Auburn 13 straight times, 1941–1954, the
 * longest winning streak any team has had against Auburn since 1936. Then
 * Georgia and Alabama at 9." Rows are the board's, in order, each named for
 * the opponent (`name`); '' when the board is empty.
 */
export function asLead(name: string, dir: 'W' | 'L', rows: LeadRow[], since: number): string {
  if (rows.length === 0) return '';
  const top = rows[0];
  const tied = rows.filter((r) => r.len === top.len && r.atEdge === top.atEdge);
  const leaders = [...new Set(tied.map((r) => r.name))];
  let first: string;
  if (dir === 'L') {
    first = leaders.length === 1
      ? `${top.name} ${top.live ? 'has beaten' : 'beat'} ${name} ${times(top)}${when(top)}, the longest winning streak any team has had against ${name} since ${since}.`
      : `${names(leaders)} have each beaten ${name} ${times(top)}, the longest winning streak any team has had against ${name} since ${since}.`;
  } else {
    first = leaders.length === 1
      ? `${name}'s longest winning streak against one opponent since ${since} is ${times(top)} over ${top.name}${when(top)}${top.live && top.atEdge ? ', and still going' : ''}.`
      : `${name}'s longest winning streak against one opponent since ${since} is ${times(top)}, over ${names(leaders)}.`;
  }
  const then = rows.slice(tied.length, tied.length + 2).map((r) => `${r.name} at ${r.len}${r.atEdge ? '+' : ''}`);
  return then.length ? `${first} Then ${then.join(' and ')}.` : first;
}

/** The share title for any by-opponent board: "Longest all-time losing streaks as Auburn". */
export const asBoardTitle = (name: string, scope: string, dirWord: string, words: string[]) => `Longest ${scope} ${dirWord} streaks as ${name}${words.length ? ` · ${words.join(' · ')}` : ''}`;
