import { useEffect, useState } from 'react';
import type { MinedCrown, Scope } from '../lib/types.ts';
import type { TeamCrowns } from '../lib/crownsFile.ts';
import { loadCrowns } from '../lib/loadCrowns.ts';

/**
 * One team's runs for its page, a scope at a time, as its crowns files keep
 * them (the page lists them with the list rule). A team page arrives with its
 * active list in `initial` (so the prerender and the hydrate agree); the
 * all-time file loads when `scope` asks for it, another team's active file
 * when it opens. Null while loading.
 */
export function useTeamCrowns(ti: number, scope: Scope, initial?: { page?: number | null; crowns?: TeamCrowns | null }): { active: MinedCrown[] | null; crowns: MinedCrown[] | null } {
  const [sets, setSets] = useState<Record<number, Partial<TeamCrowns>>>(() => (
    initial?.crowns && initial.page != null ? { [initial.page]: initial.crowns } : {}
  ));
  const have = sets[ti];
  const missing: Scope | null = !have?.active ? 'active' : scope === 'all' && !have.all ? 'all' : null;
  useEffect(() => {
    if (!missing) return;
    let live = true;
    loadCrowns(ti, missing).then((rows) => { if (live) setSets((cur) => ({ ...cur, [ti]: { ...cur[ti], [missing]: rows } })); });
    return () => { live = false; };
  }, [ti, missing]);
  return { active: have?.active ?? null, crowns: (scope === 'all' ? have?.all : have?.active) ?? null };
}

/**
 * One team's active runs from its file, for a list that isn't the team
 * page's: a side of a game. `seed` is the list when the caller already has
 * it; otherwise the team's active file loads (once per team, loadCrowns
 * caches). Null while loading.
 */
export function useActiveCrowns(ti: number | null, seed: MinedCrown[] | null = null): MinedCrown[] | null {
  const [sets, setSets] = useState<Record<number, MinedCrown[]>>({});
  useEffect(() => {
    if (ti == null || seed || sets[ti]) return;
    let live = true;
    loadCrowns(ti, 'active').then((rows) => { if (live) setSets((cur) => ({ ...cur, [ti]: rows })); });
    return () => { live = false; };
  }, [ti, seed, sets]);
  return ti == null ? null : seed ?? sets[ti] ?? null;
}
