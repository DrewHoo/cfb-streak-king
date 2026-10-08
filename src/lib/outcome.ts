// The outcome a streak counts, and the margin it can carry. The five plain
// outcomes are one letter: W, L, U (won or tied), C (covered the closing
// spread), N (failed to). A winning or losing outcome can also name the
// margin it demands, "W10": every game of the run won by at least 10. A
// game that misses the margin breaks the run (a 3-point win ends a "won by
// 10+" streak), which is why the margin lives on the outcome and not in the
// chip catalog: a chip only decides which games are visible, and the outcome
// decides what breaks the run. Pure, so chips.ts and streaks.ts share it.

import type { Dir } from './types.ts';

export type BaseDir = 'W' | 'L' | 'U' | 'C' | 'N';
export type MarginBase = 'W' | 'L';

/** The margins the outcome menu offers. */
export const MARGINS = [3, 7, 10, 14, 21, 28];
/** The one margin the crowns miner, the team page and the broken digest walk. */
export const MINED_MARGIN = 10;

const cache = new Map<string, { base: BaseDir; by: number }>();
function parse(dir: Dir): { base: BaseDir; by: number } {
  let p = cache.get(dir);
  if (!p) {
    const m = /^([WL])(\d+)$/.exec(dir);
    p = m ? { base: m[1] as MarginBase, by: Number(m[2]) } : { base: dir as BaseDir, by: 0 };
    cache.set(dir, p);
  }
  return p;
}

/** The outcome's letter, the margin stripped. */
export const baseDir = (dir: Dir): BaseDir => parse(dir).base;
/** The margin the outcome demands; 0 for a plain one. */
export const marginOf = (dir: Dir): number => parse(dir).by;
export const isMargin = (dir: Dir) => marginOf(dir) > 0;
/** "W" + 10 → "W10"; a margin of 0 is the plain outcome. */
export const marginDir = (base: MarginBase, by: number): Dir => (by > 0 ? `${base}${by}` : base);

/** A URL or stored value as an outcome, or null when it isn't one. */
export function parseDir(s: string | null | undefined): Dir | null {
  if (s === 'W' || s === 'L' || s === 'U' || s === 'C' || s === 'N') return s;
  if (s && /^[WL]\d{1,2}$/.test(s) && Number(s.slice(1)) > 0) return s as Dir;
  return null;
}

/** The mined outcome nearest one the board can show: a margin outcome snaps to the mined margin. */
export const minedDir = (dir: Dir): Dir => (isMargin(dir) ? marginDir(baseDir(dir) as MarginBase, MINED_MARGIN) : dir);
