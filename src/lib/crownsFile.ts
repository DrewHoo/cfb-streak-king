// Crowns are mined at build time (scripts/prerender.mjs runs crowns.ts) and
// shipped as one small file per team, dist/crowns/<id>.json. A team's own
// page embeds its file so the first render has them; opening another team
// fetches its file. This is the file's encoding.

import type { Crown, Dir, Scope } from './types.ts';

export interface TeamCrowns { active: Crown[]; all: Crown[] }

// [chips joined by '+', dir, len, atEdge, field, startSe, endSe, live, also]
type Row = [string, Dir, number, 0 | 1, number, number | null, number | null, 0 | 1, number];
export interface CrownsFile { v: 1; active: Row[]; all: Row[] }

const toRow = (c: Crown): Row => [
  c.chips.join('+'), c.dir, c.len, c.atEdge ? 1 : 0, c.field, c.startSe ?? null, c.endSe ?? null, c.live ? 1 : 0, c.also,
];
const fromRow = (scope: Scope) => ([chips, dir, len, atEdge, field, startSe, endSe, live, also]: Row): Crown => ({
  chips: chips ? chips.split('+') : [], dir, scope, len, atEdge: !!atEdge, field,
  ...(startSe != null ? { startSe } : {}), ...(endSe != null ? { endSe } : {}),
  live: !!live, also,
});

export const encodeCrowns = (c: TeamCrowns): CrownsFile => ({ v: 1, active: c.active.map(toRow), all: c.all.map(toRow) });
export const decodeCrowns = (f: CrownsFile): TeamCrowns => ({ active: f.active.map(fromRow('active')), all: f.all.map(fromRow('all')) });
