// A team's crowns in the browser: its file from the build (dist/crowns/<id>.json),
// once per team. The dev server has no build output, so there it falls back
// to mining in the page; crowns.ts is only ever imported dynamically.

import { teams } from './model.ts';
import { decodeCrowns } from './crownsFile.ts';
import type { TeamCrowns } from './crownsFile.ts';

const cache = new Map<number, Promise<TeamCrowns>>();

async function mineHere(ti: number): Promise<TeamCrowns> {
  const { mineCrowns } = await import('./crowns.ts');
  const [active, all] = await Promise.all([mineCrowns('active'), mineCrowns('all')]);
  return { active: active.get(ti) ?? [], all: all.get(ti) ?? [] };
}

export function loadCrowns(ti: number): Promise<TeamCrowns> {
  let p = cache.get(ti);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}crowns/${teams[ti].id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(decodeCrowns)
      .catch(() => mineHere(ti));
    cache.set(ti, p);
  }
  return p;
}
