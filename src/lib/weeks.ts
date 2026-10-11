// The season's weeks, as the schedule counts them: cfbfastR's week runs
// Tuesday through Monday, so the Labor Day Monday game ends week 1. The
// scheduled games carry wk, and one offset turns a date into a week number;
// the completed weeks are the ones holding a recorded current-season game.

import { P } from './model.ts';
import { FLAG } from './schema.ts';

// 1970-01-06, a Tuesday; weeks run Tuesday through Monday
export const TUE = 5;
/** A date's week on the grid (its Tuesday is `weekStart`). */
export const weekIdx = (ep: number) => Math.floor((ep - TUE) / 7);
export const weekStart = (w: number) => w * 7 + TUE;

/** One completed week of the running season: its grid index, its schedule number, and its games' span. */
export interface CompletedWeek { w: number; wk: number | null; lo: number; hi: number }

let weekList: CompletedWeek[] | null = null;
/** Every completed week of the running season, in order. Empty before any result. */
export function completedWeeks(): CompletedWeek[] {
  if (weekList) return weekList;
  // the offset the scheduled games agree on turns a grid index into the schedule's week number
  const counts = new Map<number, number>();
  const u = P.upcoming;
  for (let i = 0; i < (u?.ep.length ?? 0); i++) {
    if (u.fl[i] & FLAG.post) continue;
    const k = u.wk[i] - weekIdx(u.ep[i]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const K = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const { se, ep } = P.games;
  const out: CompletedWeek[] = [];
  for (let i = se.length - 1; i >= 0 && se[i] === P.currentSeason; i--) {
    const w = weekIdx(ep[i]);
    const cur = out[0];
    if (cur && cur.w === w) cur.lo = Math.min(cur.lo, ep[i]);
    else out.unshift({ w, wk: K == null ? null : w + K, lo: ep[i], hi: ep[i] });
  }
  return (weekList = out);
}
