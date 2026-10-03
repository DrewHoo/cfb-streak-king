import { useEffect, useState } from 'react';
import type { Dir, Scope } from '../lib/types.ts';
import type { TeamCrowns } from '../lib/crownsFile.ts';
import { loadCrowns } from '../lib/loadCrowns.ts';
import { track } from '../lib/analytics.ts';

/**
 * The open team's crowns (the panel's, or the team page's) and the two
 * selects over them. A team page arrives with its own crowns in `initial` (so
 * the prerender and the hydrate agree); any other team's load when it opens.
 */
export function useCrowns(team: number | null, initial?: { page?: number | null; crowns?: TeamCrowns | null }) {
  const [sets, setSets] = useState<Record<number, TeamCrowns>>(() => (
    initial?.crowns && initial.page != null ? { [initial.page]: initial.crowns } : {}
  ));
  const [scope, setScope] = useState<Scope>('active');
  const [dir, setDir] = useState<Dir>('W');

  useEffect(() => {
    if (team == null || sets[team]) return;
    let live = true;
    loadCrowns(team).then((c) => { if (live) setSets((cur) => ({ ...cur, [team]: c })); });
    return () => { live = false; };
  }, [team, sets]);

  return {
    /** null while the team's crowns are loading */
    crowns: team != null ? sets[team]?.[scope] ?? null : null,
    /** The team's active crowns whatever the select says; null while loading. */
    active: team != null ? sets[team]?.active ?? null : null,
    scope,
    dir,
    // analytics event names predate "crowns"; kept so the history stays continuous
    onScope: (s: Scope) => { setScope(s); track('leads scope', { scope: s }); },
    onDir: (d: Dir) => { setDir(d); track('leads dir', { dir: d }); },
    /** Follow the board's direction without an event (opening a team, loading a URL). */
    followDir: setDir,
  };
}
