// Crowns are mined at build time (scripts/prerender.mjs runs crowns.ts) and
// shipped as one small file per team, dist/crowns/<id>.json. A team's own
// page embeds its file so the first render has them; opening another team
// fetches its file. This is the file's encoding.

import type { Crown, Dir, Scope } from './types.ts';

export interface TeamCrowns { active: Crown[]; all: Crown[] }

// [chips joined by '+', dir, len, atEdge, field, rank, tied, second, startSe, endSe, live, also, chance (2 significant figures), score (1 decimal), dup]
type Row = [string, Dir, number, 0 | 1, number, number, number, number, number | null, number | null, 0 | 1, number, number, number, 0 | 1];
export interface CrownsFile { v: 4; active: Row[]; all: Row[] }

const toRow = (c: Crown): Row => [
  c.chips.join('+'), c.dir, c.len, c.atEdge ? 1 : 0, c.field, c.rank, c.tied, c.second, c.startSe ?? null, c.endSe ?? null, c.live ? 1 : 0, c.also, +c.chance.toPrecision(2), +c.score.toFixed(1) || 0, c.dup ? 1 : 0, // a score that rounds to -0 is 0
];
const fromRow = (scope: Scope) => ([chips, dir, len, atEdge, field, rank, tied, second, startSe, endSe, live, also, chance, score, dup]: Row): Crown => ({
  chips: chips ? chips.split('+') : [], dir, scope, len, atEdge: !!atEdge, field, rank, tied, second,
  ...(startSe != null ? { startSe } : {}), ...(endSe != null ? { endSe } : {}),
  live: !!live, also, chance, score, dup: !!dup,
});

export const encodeCrowns = (c: TeamCrowns): CrownsFile => ({ v: 4, active: c.active.map(toRow), all: c.all.map(toRow) });
export const decodeCrowns = (f: CrownsFile): TeamCrowns => ({ active: f.active.map(fromRow('active')), all: f.all.map(fromRow('all')) });
