// A series page's words: "Alabama vs Tennessee all-time record". Pure:
// strings only, no model, so the share worker can import it. Names and
// numbers come from the caller (series.ts, or the worker's own count).

/** A series page's address under the site base, from one team's side. */
export const seriesPath = (id: string, oppId: string) => `team/${id}/vs/${oppId}/`;

/** The two team ids a series path names, like /cfb-streak-king/team/alabama/vs/tennessee/; null elsewhere. */
export function seriesIdsFromPath(pathname: string): { id: string; opp: string } | null {
  const m = /\/team\/([a-z0-9-]+)\/vs\/([a-z0-9-]+)\/?$/.exec(pathname);
  return m && m[1] !== m[2] ? { id: m[1], opp: m[2] } : null;
}

export type Rec = [w: number, l: number, t: number];
export const recText = ([w, l, t]: Rec) => `${w}-${l}${t ? `-${t}` : ''}`;
const games = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'game' : 'games'}`;

/** The h1, the question as people search it. */
export const seriesH1 = (name: string, opp: string) => `${name} vs ${opp} all-time record`;

/** The <title> before the site's name. */
export const seriesTitle = (name: string, opp: string, rec: Rec, since: number) => `${seriesH1(name, opp)}: ${recSentence(name, opp, rec)} since ${since}`;

// the leader first from either side: "Alabama leads Tennessee 61-39-7" on both
// pages, and a tie in the page's order, "Army and Navy are tied 55-55-7"
function recSentence(name: string, opp: string, rec: Rec): string {
  const [w, l, t] = rec;
  if (w === l) return `${name} and ${opp} are tied ${recText(rec)}`;
  return w > l ? `${name} leads ${opp} ${recText(rec)}` : `${opp} leads ${name} ${recText([l, w, t])}`;
}

export interface StreakNow {
  /** The result of the current run: the last meeting's. */
  r: 'W' | 'L' | 'T';
  len: number;
}

/**
 * The lead: the record since the first meeting, then who won the last one and
 * how many in a row. "Alabama leads Tennessee 60-41-7 in 109 games since their
 * first meeting in 1901. Tennessee won the last meeting, 26-10 in 2026."
 * `n` counts every meeting, a vacated win too, which the record leaves out.
 * The same sentence from either side.
 */
export function seriesLead(name: string, opp: string, rec: Rec, n: number, since: number, now: StreakNow, last: { us: number; them: number; se: number }): string {
  const head = `${recSentence(name, opp, rec)} in ${games(n)} since their first meeting in ${since}.`;
  const winner = now.r === 'W' ? name : opp;
  const score = now.r === 'W' ? `${last.us}-${last.them}` : `${last.them}-${last.us}`;
  const tail = now.r === 'T'
    ? `The last meeting was a ${last.us}-${last.them} tie in ${last.se}.`
    : now.len > 1
      ? `${winner} has won the last ${now.len}, most recently ${score} in ${last.se}.`
      : `${winner} won the last meeting, ${score} in ${last.se}.`;
  return `${head} ${tail}`;
}

/** The meta description: the lead, then what the page has. */
export const seriesDescription = (lead: string, name: string, opp: string) => `${lead} Every ${name}-${opp} game, the record at each site and the longest streaks each way.`;
