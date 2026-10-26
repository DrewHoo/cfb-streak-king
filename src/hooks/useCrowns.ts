import { useEffect, useState } from 'react';
import type { MinedCrown } from '../lib/types.ts';
import type { CrownsKind, TeamCrowns } from '../lib/crownsFile.ts';
import { loadCrowns, loadAllSimple } from '../lib/loadCrowns.ts';

/**
 * One team's runs for its page, as its crowns files keep them (the page lists
 * them with the list rule). A team page arrives with its active list and its
 * all-time simple list in `initial` (so the prerender and the hydrate agree);
 * another team's load when it opens, and the all-time file when `wantAll`
 * (the All-time section's trivia pill, on intent) asks for it. Null while loading.
 */
export function useTeamCrowns(ti: number, wantAll: boolean, initial?: { page?: number | null; crowns?: TeamCrowns | null }): { active: MinedCrown[] | null; allSimple: TeamCrowns['allSimple'] | null; all: MinedCrown[] | null } {
  const [sets, setSets] = useState<Record<number, Partial<TeamCrowns>>>(() => (
    initial?.crowns && initial.page != null ? { [initial.page]: initial.crowns } : {}
  ));
  const have = sets[ti];
  const missing: CrownsKind | null = !have?.active ? 'active' : !have.allSimple ? 'allSimple' : wantAll && !have.all ? 'all' : null;
  useEffect(() => {
    if (!missing) return;
    let live = true;
    const got = missing === 'allSimple' ? loadAllSimple(ti) : loadCrowns(ti, missing);
    got.then((rows) => { if (live) setSets((cur) => ({ ...cur, [ti]: { ...cur[ti], [missing]: rows } })); });
    return () => { live = false; };
  }, [ti, missing]);
  return { active: have?.active ?? null, allSimple: have?.allSimple ?? null, all: have?.all ?? null };
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
