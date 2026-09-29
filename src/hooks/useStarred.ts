import { useEffect, useState } from 'react';
import type { ChipRef, Dir } from '../lib/types.ts';
import type { StarredDef } from '../lib/starred.ts';
import { readStarred, writeStarred } from '../lib/starred.ts';
import { encodeChips } from '../lib/definition.ts';
import { definitionPhrase } from '../lib/sentence.ts';
import { dirWord } from '../lib/format.ts';
import { track } from '../lib/analytics.ts';

const same = (a: StarredDef, c: string, dir: Dir) => a.c === c && a.dir === dir;

/** Starred definitions, read from localStorage after mount (the prerender has none). */
export function useStarred(active: ChipRef[], dir: Dir) {
  const [starred, setStarred] = useState<StarredDef[]>([]);
  useEffect(() => { setStarred(readStarred()); }, []);
  const update = (f: (cur: StarredDef[]) => StarredDef[]) => setStarred((cur) => { const next = f(cur); writeStarred(next); return next; });

  const c = encodeChips(active);
  const isStarred = starred.some((f) => same(f, c, dir));
  return {
    starred,
    isStarred,
    toggle: () => {
      update((cur) => (cur.some((f) => same(f, c, dir))
        ? cur.filter((f) => !same(f, c, dir))
        : [...cur, { c, dir, name: `${dirWord(dir)} streaks in ${definitionPhrase(active)}` }]));
      if (!isStarred) track('save streak', { chips: c || 'overall', dir });
    },
    remove: (f: StarredDef) => {
      update((cur) => cur.filter((x) => !same(x, f.c, f.dir)));
      track('unsave streak', { chips: f.c || 'overall', dir: f.dir });
    },
  };
}
