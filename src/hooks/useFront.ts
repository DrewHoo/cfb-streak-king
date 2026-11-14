import { useEffect, useState } from 'react';
import type { MinedCrown } from '../lib/types.ts';
import { loadFront } from '../lib/front.ts';

/**
 * Each team's runs for the front page. The root arrives with them in
 * `initial` (so the prerender and the hydrate agree); reached from another
 * page, they load. Null while loading.
 */
export function useFront(open: boolean, initial?: { frontRuns?: Map<number, MinedCrown[]> | null }): Map<number, MinedCrown[]> | null {
  const [runs, setRuns] = useState<Map<number, MinedCrown[]> | null>(() => initial?.frontRuns ?? null);
  useEffect(() => {
    if (!open || runs) return;
    let live = true;
    loadFront().then((r) => { if (live) setRuns(r); });
    return () => { live = false; };
  }, [open, runs]);
  return runs;
}
