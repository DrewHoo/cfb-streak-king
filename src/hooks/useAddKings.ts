import { useEffect, useState } from 'react';
import type { ChipRef, Dir, Scope } from '../lib/types.ts';
import { addKings, chipKings } from '../lib/kings.ts';
import { encodeChips } from '../lib/definition.ts';

/**
 * A menu's kings, worked out after the menu opens so opening it never waits
 * on them; null until they're ready. `sig` names the definition they're for.
 * The first open builds the chip masks the crowns miner shares.
 */
function useWhenOpen<T>(open: boolean, sig: string, compute: () => T): T | null {
  const want = open ? sig : null;
  const [done, setDone] = useState<{ sig: string; value: T } | null>(null);
  useEffect(() => {
    if (!want || done?.sig === want) return;
    let live = true;
    const id = setTimeout(() => {
      const value = compute();
      if (live) setDone({ sig: want, value });
    }, 0);
    return () => { live = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  return done && done.sig === want ? done.value : null;
}

const sigOf = (active: ChipRef[], dir: Dir, scope: Scope) => `${encodeChips(active)}|${dir}|${scope}`;

/** The + menu: the king each constraint would crown. */
export const useAddKings = (open: boolean, active: ChipRef[], dir: Dir, scope: Scope) => (
  useWhenOpen(open, sigOf(active, dir, scope), () => addKings(active, dir, scope))
);

/** A constraint's own menu: the king of each of its choices and swaps. */
export const useChipKings = (open: boolean, active: ChipRef[], key: string, dir: Dir, scope: Scope) => (
  useWhenOpen(open, `${key}|${sigOf(active, dir, scope)}`, () => chipKings(active, key, dir, scope))
);
