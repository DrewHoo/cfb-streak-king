// The chips the miner walks: the plain chips, plus one derived chip per
// choice of the parameter chips worth mining (every opponent color, mascot
// entry, team and conference; every month and venue state; leading and
// trailing at half by any margin). A derived chip is a real Chip with the
// choice baked into its test and the URL form as its key ("vscolor:orange",
// "vsteam:alabama", "month:11", "leadhalf:1"), so a crown's chips stay
// strings, the crowns file needs no new encoding, and decodeChips turns the
// key back into a ChipRef for the sentence, the apply and the share link.
//
// The opponent chips form one exclusive group, `identity`: a team has
// several mascot classes (Bulldogs is also animal and canine) and a team is
// in a conference and has a color, so without that the walk would pair "vs
// Bulldogs" with "vs dog & wolf mascots" or "vs Georgia" with "vs the SEC".
// The months are exclusive among themselves, as are the states; the half
// chips keep the catalog's own group.

import type { ChipRef } from './types.ts';
import type { Chip, PregameChip } from './chips.ts';
import { PLAIN_CHIPS, chipByKey, conflicts } from './chips.ts';
import { PARAMS, decodeChips } from './definition.ts';

export const IDENTITY_GROUP = 'identity';

/** The parameter chips the miner walks, the group their derived chips form, and which choices (null = every one). */
const DERIVED: [key: string, group: string, pick: ((v: string | number) => boolean) | null][] = [
  ['vscolor', IDENTITY_GROUP, null],
  ['vsmascot', IDENTITY_GROUP, null],
  ['vsteam', IDENTITY_GROUP, null],
  ['vsconf', IDENTITY_GROUP, null],
  ['month', 'month', null],
  ['state', 'state', null],
  // leading or trailing at half by any margin; the half group is already exclusive
  ['leadhalf', 'half', (v) => v === 1],
  ['trailhalf', 'half', (v) => v === 1],
];

const derived: Chip[] = [];
for (const [key, group, pick] of DERIVED) {
  const base = chipByKey.get(key)!;
  const spec = PARAMS[base.param!];
  for (const [v] of spec.options(base)) {
    if (pick && !pick(v)) continue;
    // labeled as the definition sentence words it ("in Texas", not the menu's "in TX")
    derived.push({ ...base, key: `${key}:${spec.encode(v)}`, label: spec.word(base, v), group, exclusive: true, param: undefined, test: (g: never) => (base as PregameChip).test(g, v) } as Chip);
  }
}

/** The derived chips: one per choice of each mined parameter chip. */
export const DERIVED_CHIPS: readonly Chip[] = derived;
/** The plain chips first, so an index into PLAIN_CHIPS is the same index here. */
export const MINED_CHIPS: readonly Chip[] = [...PLAIN_CHIPS, ...derived];
export const minedIdx = new Map(MINED_CHIPS.map((c, i) => [c.key, i]));
export const minedChipByKey = new Map(MINED_CHIPS.map((c) => [c.key, c]));

/** A mined key's catalog key: "vsteam:alabama" → "vsteam". */
export const baseKey = (key: string) => key.split(':')[0];

const choiceCounts = new Map<string, number>();
for (const c of derived) choiceCounts.set(baseKey(c.key), (choiceCounts.get(baseKey(c.key)) ?? 0) + 1);
/** How many choices the miner walks for a key's chip: 288 for "vsteam:alabama", 1 for a plain chip. */
export const choicesOf = (key: string) => choiceCounts.get(baseKey(key)) ?? 1;

/** A mined key's label; a catalog key falls back to the catalog. */
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
