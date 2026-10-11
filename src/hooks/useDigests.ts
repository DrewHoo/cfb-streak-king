import { useEffect, useState } from 'react';
import type { Digests } from '../lib/digests.ts';
import { loadDigests } from '../lib/digests.ts';

/**
 * The schedule's digests (broken, at-risk, the streak on the line in each
 * game). A games page arrives with them in `initial` (so the prerender and
 * the hydrate agree); opened from the board, they load. Null while loading.
 */
export function useDigests(open: boolean, initial?: { digests?: Digests | null }): Digests | null {
  const [digests, setDigests] = useState<Digests | null>(() => initial?.digests ?? null);
  useEffect(() => {
    if (!open || digests) return;
    let live = true;
    loadDigests().then((d) => { if (live) setDigests(d); });
    return () => { live = false; };
  }, [open, digests]);
  return digests;
}
