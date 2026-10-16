// The tuner's state: the list rule's knobs (list.ts LIST) with Drew's
// overrides laid over them, and whether the tuner is on. `?tune=1` on any
// address turns it on and `?tune=0` off, remembered in localStorage (the
// URL writer drops the param on the next change of state); the overrides
// persist there too. Every list on the site reads the knobs from this
// context, so a turn re-orders them all. Read after mount only: nothing
// reads window during render, so the prerender and the hydrate agree on
// the shipped knobs.

import { createContext, useContext } from 'react';
import type { Crown } from './lib/types.ts';
import { LIST, withKnobs } from './lib/list.ts';
import type { Knobs } from './lib/list.ts';

const ON_KEY = 'tune';
const KNOBS_KEY = 'tune.knobs';

export interface Tune {
  on: boolean;
  knobs: Knobs;
  /** The overrides, by path ("tiers.brag"). */
  over: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  reset: () => void;
  /** Up to two rows picked to compare, and the picker. */
  picked: Crown[];
  pick: (row: Crown) => void;
}

export const TuneContext = createContext<Tune>({ on: false, knobs: LIST, over: {}, set: () => {}, reset: () => {}, picked: [], pick: () => {} });
export const useTune = () => useContext(TuneContext);
export const useKnobs = () => useContext(TuneContext).knobs;

const read = (k: string): string | null => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* private mode */ } };

/** Whether the tuner is on, from the address (`?tune=1` / `?tune=0`, remembered) else what was remembered. Dev server only: a production build never turns it on, whatever the address or localStorage says. */
export function readTuneOn(search: string): boolean {
  if (!import.meta.env.DEV) return false;
  const q = new URLSearchParams(search).get('tune');
  if (q === '1' || q === '0') { write(ON_KEY, q === '1' ? '1' : null); return q === '1'; }
  return read(ON_KEY) === '1';
}
/** The remembered overrides. */
export function readOverrides(): Record<string, unknown> {
  try { return JSON.parse(read(KNOBS_KEY) ?? '{}') as Record<string, unknown>; } catch { return {}; }
}
export function writeOverrides(over: Record<string, unknown>) {
  write(KNOBS_KEY, Object.keys(over).length ? JSON.stringify(over) : null);
}
export const knobsOf = (over: Record<string, unknown>): Knobs => (Object.keys(over).length ? withKnobs(over) : LIST);

/** The knobs as TypeScript, to paste over LIST in list.ts. */
export function knobsSource(k: Knobs): string {
  const tiers = `{ brag: ${k.tiers.brag}, plain: ${k.tiers.plain}, trivia: ${k.tiers.trivia}, ingame: ${k.tiers.ingame} }`;
  return [
    'export const LIST = {',
    `  admit: { rank: ${k.admit.rank} },`,
    `  pick: '${k.pick}' as PickRule,`,
    `  rate: ${k.rate},`,
    `  rateShrink: ${k.rateShrink},`,
    `  chanceW: ${k.chanceW},`,
    `  tiers: ${tiers} as Record<Tier, number>,`,
    `  leadW: ${k.leadW},`,
    `  leadFloor: ${k.leadFloor == null ? 'null as number | null' : k.leadFloor},`,
    `  spanA: ${k.spanA},`,
    `  spanAll: ${k.spanAll},`,
    `  marginCost: ${k.marginCost},`,
    `  sparseW: ${k.sparseW},`,
    `  rivalChoice: ${k.rivalChoice},`,
    `  rarityW: ${k.rarityW},`,
    `  bucket: ${k.bucket},`,
    `  sameYears: { directed: ${k.sameYears.directed}, overlap: ${k.sameYears.overlap} },`,
    `  olderStands: ${k.olderStands},`,
    '};',
  ].join('\n');
}
