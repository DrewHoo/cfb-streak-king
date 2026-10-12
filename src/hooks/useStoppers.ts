import { useEffect, useState } from 'react';
import type { Stoppers } from '../lib/stoppers.ts';
import { loadStoppers } from '../lib/stoppers.ts';

/**
 * The season's streak-stoppers (every team's breaks), loaded once when a
 * page needs them: the leaderboard needs every team ('all'), a team page its
 * own rows. A prerendered page arrives with the whole file (the leaderboard)
 * or a slice (a team page's own rows) in `initial.stops`, so the prerender and the
 * hydrate agree; a slice serves until a page needs a team it lacks. Null
 * while loading.
 */
export function useStoppers(need: 'all' | readonly number[], initial?: { stops?: Stoppers | null }): Stoppers | null {
  const [have, setHave] = useState<Stoppers | null>(() => initial?.stops ?? null);
  const wanted = need === 'all' || need.length > 0;
  const enough = !!have && (have.complete || (need !== 'all' && need.every((ti) => have.teams.has(ti))));
  useEffect(() => {
    if (!wanted || enough) return;
    let live = true;
    loadStoppers().then((s) => { if (live) setHave(s); });
    return () => { live = false; };
  }, [wanted, enough]);
  return enough ? have : null;
}
