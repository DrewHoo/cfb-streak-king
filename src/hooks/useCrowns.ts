import { useEffect, useState } from 'react';
import type { Crown, Scope } from '../lib/types.ts';
import type { TeamCrowns } from '../lib/crownsFile.ts';
import { loadCrowns } from '../lib/loadCrowns.ts';

/**
 * One team's streaks for its page, a scope at a time. A team page arrives
 * with its active list in `initial` (so the prerender and the hydrate
 * agree); the all-time list loads when `scope` asks for it, another team's
 * when it opens. Null while loading.
 */
export function useTeamCrowns(ti: number, scope: Scope, initial?: { page?: number | null; crowns?: TeamCrowns | null }): { active: Crown[] | null; crowns: Crown[] | null } {
  const [sets, setSets] = useState<Record<number, TeamCrowns>>(() => (
    initial?.crowns && initial.page != null ? { [initial.page]: initial.crowns } : {}
  ));
  const have = sets[ti];
  const enough = !!have && (scope === 'active' || have.all != null);
  useEffect(() => {
    if (enough) return;
    let live = true;
    loadCrowns(ti).then((c) => { if (live) setSets((cur) => ({ ...cur, [ti]: c })); });
    return () => { live = false; };
  }, [ti, enough]);
  return { active: have?.active ?? null, crowns: (scope === 'all' ? have?.all : have?.active) ?? null };
}

/**
 * One team's active crowns, for a list that isn't the team page's: a side of
 * a game. `seed` is the list when the caller already has it; otherwise the
 * team's file loads (once per team, loadCrowns caches). Null while loading.
 */
export function useActiveCrowns(ti: number | null, seed: Crown[] | null = null): Crown[] | null {
  const [sets, setSets] = useState<Record<number, Crown[]>>({});
  useEffect(() => {
    if (ti == null || seed || sets[ti]) return;
    let live = true;
    loadCrowns(ti).then((c) => { if (live) setSets((cur) => ({ ...cur, [ti]: c.active })); });
    return () => { live = false; };
  }, [ti, seed, sets]);
  return ti == null ? null : seed ?? sets[ti] ?? null;
}
