// The chips the miners walk: the plain chips, plus one derived chip per
// opponent color and per mascot entry, so "vs orange schools" and "vs
// Bulldogs" can name a crown, a team-page row, or a digest entry. A derived
// chip is a real Chip with the choice baked into its test and the URL form
// as its key ("vscolor:orange"), so a crown's chips stay strings, the crowns
// file needs no new encoding, and decodeChips turns the key back into a
// ChipRef for the sentence, the apply and the share link. The derived chips
// form one exclusive group: a team has several mascot classes (Bulldogs is
// also animal and canine), so without that the walk would pair "vs Bulldogs"
// with "vs dog & wolf mascots".

import type { ChipRef } from './types.ts';
import type { Chip, PregameChip } from './chips.ts';
import { PLAIN_CHIPS, chipByKey, conflicts } from './chips.ts';
import { PARAMS, decodeChips } from './definition.ts';

export const IDENTITY_GROUP = 'identity';

const derived: PregameChip[] = [];
for (const key of ['vscolor', 'vsmascot']) {
  const base = chipByKey.get(key) as PregameChip;
  const spec = PARAMS[base.param!];
  for (const [v, label] of spec.options(base)) {
    derived.push({ ...base, key: `${key}:${spec.encode(v)}`, label, group: IDENTITY_GROUP, exclusive: true, param: undefined, test: (g) => base.test(g, v) });
  }
}

/** One chip per color and per mascot entry. */
export const IDENTITY_CHIPS: readonly Chip[] = derived;
/** The plain chips first, so an index into PLAIN_CHIPS is the same index here. */
export const MINED_CHIPS: readonly Chip[] = [...PLAIN_CHIPS, ...derived];
export const minedIdx = new Map(MINED_CHIPS.map((c, i) => [c.key, i]));
export const minedChipByKey = new Map(MINED_CHIPS.map((c) => [c.key, c]));

/** Whether a mined key is an opponent color or mascot choice. */
export const isIdentityKey = (key: string) => key.startsWith('vscolor:') || key.startsWith('vsmascot:');

/** A mined key's label; a catalog key the digests carry (vsteam) falls back to the catalog. */
export const chipLabel = (key: string) => minedChipByKey.get(key)?.label ?? chipByKey.get(key)?.label ?? key;

/** Mined keys as ChipRefs: a derived key decodes to its chip and choice. */
export const refsOf = (chips: readonly string[]): ChipRef[] => decodeChips(chips.join(','));

/** How many definitions of up to four of `chips` there are with each chip count, the empty one included; `skip` holds indices left out. */
export function definitionCounts(chips: readonly Chip[], skip: ReadonlySet<number> = new Set()): number[] {
  const M = [0, 0, 0, 0, 0];
  (function walk(start: number, chosen: number[]) {
    M[chosen.length]++;
    if (chosen.length === 4) return;
    for (let i = start; i < chips.length; i++) {
      if (skip.has(i) || chosen.some((j) => conflicts(chips[j], chips[i]))) continue;
      walk(i + 1, [...chosen, i]);
    }
  })(0, []);
  return M;
}

/** The counts crownRank charges a definition, over the whole mined list. */
export const MINED_DEFS = definitionCounts(MINED_CHIPS);
