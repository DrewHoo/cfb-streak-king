// A team's runs in the browser, a scope at a time: its active file from the
// build (dist/crowns/<id>.json) or its all-time one (<id>.all.json), once
// each. The dev server has no build output, so there it falls back to
// mining in the page; crowns.ts is only ever imported dynamically.

import type { MinedCrown, Scope } from './types.ts';
import { teams } from './model.ts';
import { crownsPath, decodeCrowns } from './crownsFile.ts';

const cache = new Map<string, Promise<MinedCrown[]>>();

async function mineHere(ti: number, scope: Scope): Promise<MinedCrown[]> {
  const { mineCrowns } = await import('./crowns.ts');
  return (await mineCrowns(scope)).get(ti) ?? [];
}

export function loadCrowns(ti: number, scope: Scope = 'active'): Promise<MinedCrown[]> {
  const k = `${ti}|${scope}`;
  let p = cache.get(k);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}${crownsPath(teams[ti].id, scope)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((f) => decodeCrowns(f).rows)
      .catch(() => mineHere(ti, scope));
    cache.set(k, p);
  }
  return p;
}
