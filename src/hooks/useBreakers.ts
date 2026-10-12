import { useEffect, useState } from 'react';
import type { Breakers } from '../lib/breakers.ts';
import { loadBreakers } from '../lib/breakers.ts';
import { P } from '../lib/model.ts';

/**
 * A season's streak-breakers (every team's breaks), loaded once per season
 * when a page needs them: the leaderboard needs every team ('all'), a team
 * page its own rows. `season` is the running season unless named (a past
 * season's are worked out from its season file). A prerendered page arrives
 * with the running season's whole file (the leaderboard) or a slice (a team
 * page's own rows) in `initial.breaks`, so the prerender and the hydrate
 * agree; a slice serves until a page needs a team it lacks. Null while loading.
 */
export function useBreakers(need: 'all' | readonly number[], initial?: { breaks?: Breakers | null }, season: number = P.currentSeason): Breakers | null {
  const [sets, setSets] = useState<Record<number, Breakers>>(() => (initial?.breaks ? { [initial.breaks.season]: initial.breaks } : {}));
  const have = sets[season] ?? null;
  const wanted = need === 'all' || need.length > 0;
  const enough = !!have && (have.complete || (need !== 'all' && need.every((ti) => have.teams.has(ti))));
  useEffect(() => {
    if (!wanted || enough) return;
    let live = true;
    loadBreakers(season).then((s) => { if (live) setSets((cur) => ({ ...cur, [season]: s })); });
    return () => { live = false; };
  }, [wanted, enough, season]);
  return enough ? have : null;
}
