// Crowns are mined at build time (scripts/prerender.mjs runs crowns.ts) and
// shipped as two files per team, dist/crowns/<id>.json (the active runs)
// and dist/crowns/<id>.all.json (the all-time ones): every run the team
// holds a place in (crowns.ts FILE_RANK), with the inputs the list rule
// scores from (list.ts) and no score: the page lists them. A team's own
// page embeds its active list so the first render has it; a game page
// fetches each side's active file; the Streaks switch fetches the all-time
// file. This is the file's encoding, and the row encoding every other file
// of runs (the digests, the season files, the breakers) shares.

import type { Dir, MinedCrown, Scope, Placing } from './types.ts';

/** A team's runs as a page holds them: `all` is null until the all-time file has loaded. */
export interface TeamCrowns { active: MinedCrown[]; all: MinedCrown[] | null }

// a placing: [chips joined by '+', field, rank, tied, second, p (4 decimals), n, hT, nT, unsure, live, rivals (0 none), everLen, everN] (the last two for a broken run's)
export type PlacingRow = [string, number, number, number, number, number, number, number, number, 0 | 1, 0 | 1, number, number?, number?];
// a run: [chips, dir, len, unsure, field, rank, tied, second, startSe, endSe, live, also, p, n, hT, nT, gT, rivals (0 none), highest placing or 0]
export type CrownRow = [string, Dir, number, 0 | 1, number, number, number, number, number | null, number | null, 0 | 1, number, number, number, number, number, number, number, PlacingRow | 0];
export interface CrownsFile { v: 7; scope: Scope; rows: CrownRow[] }

const rp = (p: number) => +p.toFixed(4);
const toPlacing = (t: Placing): PlacingRow => {
  const row: PlacingRow = [t.chips.join('+'), t.field, t.rank, t.tied, t.second, rp(t.p), t.n, t.hT, t.nT, t.unsure ? 1 : 0, t.live ? 1 : 0, t.rivals ?? 0];
  if (t.everLen != null) row.push(t.everLen, t.everN ?? 0);
  return row;
};
const fromPlacing = ([chips, field, rank, tied, second, p, n, hT, nT, unsure, live, rivals, everLen, everN]: PlacingRow): Placing => ({
  chips: chips ? chips.split('+') : [], field, rank, tied, second, p, n, hT, nT, unsure: !!unsure, live: !!live, ...(rivals ? { rivals } : {}), ...(everLen != null ? { everLen, everN: everN ?? 0 } : {}),
});
export const toCrownRow = (c: MinedCrown): CrownRow => [
  c.chips.join('+'), c.dir, c.len, c.unsure ? 1 : 0, c.field, c.rank, c.tied, c.second, c.startSe ?? null, c.endSe ?? null, c.live ? 1 : 0, c.also, rp(c.p), c.n, c.hT, c.nT, c.gT, c.rivals ?? 0, c.highest ? toPlacing(c.highest) : 0,
];
export const fromCrownRow = (scope: Scope) => ([chips, dir, len, unsure, field, rank, tied, second, startSe, endSe, live, also, p, n, hT, nT, gT, rivals, highest]: CrownRow): MinedCrown => ({
  chips: chips ? chips.split('+') : [], dir, scope, len, unsure: !!unsure, field, rank, tied, second,
  ...(startSe != null ? { startSe } : {}), ...(endSe != null ? { endSe } : {}),
  live: !!live, also, p, n, hT, nT, gT, ...(rivals ? { rivals } : {}), ...(highest ? { highest: fromPlacing(highest) } : {}),
});
/** One scope's rows as a file. */
export const encodeCrowns = (scope: Scope, rows: readonly MinedCrown[]): CrownsFile => ({ v: 7, scope, rows: rows.map(toCrownRow) });
export const decodeCrowns = (f: CrownsFile): { scope: Scope; rows: MinedCrown[] } => ({ scope: f.scope, rows: f.rows.map(fromCrownRow(f.scope)) });
/** The file's path under the site root for a team and scope. */
export const crownsPath = (id: string, scope: Scope) => `crowns/${id}${scope === 'all' ? '.all' : ''}.json`;
