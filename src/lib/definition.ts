// A definition is up to four chips plus a direction. This module owns how it
// round-trips through the URL, the defaults a new chip takes, the presets, and
// how a chip reads as a word in the definition sentence.

import type { ChipRef, Dir } from './types.ts';
import { P, teams, confs } from './model.ts';
import { chipByKey } from './chips.ts';
import type { Chip } from './chips.ts';
import { stateName } from './format.ts';

// the definition a bare URL opens on: all-time winning streaks vs unranked
// opponents, the board Alabama's 100 tops
export const DEFAULT_CHIPS: ChipRef[] = [{ key: 'unranked' }];
export const DEFAULT_SCOPE = 'all';
export const MAX_CHIPS = 4;

export interface Preset { name: string; chips: ChipRef[]; dir: Dir }
export const PRESETS: Preset[] = [
  { name: 'The Saban Standard', chips: [{ key: 'unranked' }], dir: 'W' },
  { name: 'Ranked Futility', chips: [{ key: 'ranked' }], dir: 'L' },
  { name: 'Road Kill', chips: [{ key: 'road' }, { key: 'confgame' }], dir: 'L' },
  { name: 'Saturday Night Lights', chips: [{ key: 'home' }, { key: 'night' }], dir: 'W' },
  { name: 'Never Twice', chips: [{ key: 'afterloss' }], dir: 'W' },
  { name: 'Opening Day', chips: [{ key: 'opener' }], dir: 'W' },
  { name: 'Kings of the State', chips: [{ key: 'instate' }], dir: 'W' },
  { name: 'Giant Killers', chips: [{ key: 'dog' }], dir: 'W' },
  { name: 'Chalk', chips: [{ key: 'fav' }], dir: 'L' },
  { name: 'Bowl Curse', chips: [{ key: 'postseason' }], dir: 'L' },
];

export const GROUPS = ['site', 'opp rank', 'own rank', 'betting', 'conference', 'opponent', 'coach', 'calendar', 'context', 'shape', 'half', 'possession', 'kickoff'];

// data-coverage notes for the group headings in the + menu
export const GROUP_NOTES: Record<string, string> = {
  betting: 'Closing lines cover 1978–2025 plus this season. Games without a line don’t qualify.',
  coach: 'Head-coach tenures from CollegeFootballData, with mid-season changes resolved to the exact game.',
  half: 'Halftime scores are known from 2001 and solid from 2003. Earlier games can’t qualify.',
  possession: 'Time of possession is known from 2004. Earlier games can’t qualify.',
  kickoff: 'Kickoff times are known from 2002 and solid from 2014. Earlier games can’t qualify as night games.',
  shape: 'Overtime comes from quarter-by-quarter line scores, known from 2001 and solid from 2002. FBS overtime began in 1996, but no source here marks 1996–2000 overtime games, so they can’t qualify.',
};

// parameter choices, by chip param kind
export const MONTHS: [number, string][] = [[9, 'September'], [10, 'October'], [11, 'November'], [12, 'December'], [1, 'January']];
export const HMARGINS: [number, string][] = [[1, 'by any'], [3, 'by 3+'], [7, 'by 7+'], [10, 'by 10+'], [14, 'by 14+']];
export const STATE_OPTIONS = [...P.states].filter(Boolean).sort();
export const CONF_OPTIONS = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'Big East', 'American', 'Mountain West', 'C-USA', 'MAC', 'Sun Belt', 'WAC', 'Big 8', 'SWC', 'Big West', 'Independent'].filter((o) => confs.includes(o));

// the "vs [team]" choices: every team that was ever major
export const teamOptions = teams
  .map((t, i) => ({ t, i }))
  .filter(({ t }) => t.major)
  .sort((a, b) => a.t.name.localeCompare(b.t.name));

export const defaultParam = (c: Chip) => (
  c.param === 'month' ? 11 : c.param === 'conf' ? 'SEC' : c.param === 'state' ? 'TX' : c.param === 'hmargin' ? 1
    : c.param === 'team' ? teams.findIndex((t) => t.id === 'alabama') : undefined
);

// a team param is an index into teams in memory and the team's id in the URL
export function encodeChips(active: ChipRef[]): string {
  return active.map(({ key, param }) => {
    if (param == null) return key;
    return `${key}:${chipByKey.get(key)?.param === 'team' ? teams[param as number]?.id : param}`;
  }).join(',');
}
export function decodeChips(s: string | null | undefined): ChipRef[] {
  if (!s) return [];
  const out: ChipRef[] = [];
  for (const part of s.split(',')) {
    const [key, ...rest] = part.split(':');
    const c = chipByKey.get(key);
    if (!c) continue;
    let param: string | number | undefined = rest.length ? rest.join(':') : undefined;
    if (c.param === 'month' || c.param === 'hmargin') param = Number(param);
    if (c.param === 'team') param = teams.findIndex((t) => t.id === param);
    if (c.param && (param == null || param === -1 || Number.isNaN(param))) continue;
    out.push(c.param ? { key, param } : { key });
  }
  return out.slice(0, MAX_CHIPS);
}

/** The `c` URL param: absent = the default, "all" = no constraints. */
export const chipsToParam = (active: ChipRef[]) => {
  const enc = encodeChips(active);
  return enc === encodeChips(DEFAULT_CHIPS) ? null : enc || 'all';
};
export const chipsFromParam = (c: string | null) => (c === 'all' ? [] : c ? decodeChips(c) : DEFAULT_CHIPS);

/** How a chip reads as a word in the definition sentence. */
export function chipWord({ key, param }: ChipRef): string {
  const c = chipByKey.get(key)!;
  if (key === 'vsteam') return `vs ${teams[param as number]?.name ?? '?'}`;
  if (key === 'vsconf') return `vs the ${param}`;
  if (key === 'state') return `in ${stateName(param as string)}`;
  if (key === 'month') return `in ${MONTHS.find(([n]) => n === param)?.[1] ?? param}`;
  if (key === 'leadhalf') return (param as number) > 1 ? `leading at half by ${param}+` : 'leading at half';
  if (key === 'trailhalf') return (param as number) > 1 ? `trailing at half by ${param}+` : 'trailing at half';
  return c.label;
}

/** Add a chip to a definition; an exclusive chip replaces its group-mate. */
export function withChip(active: ChipRef[], key: string): ChipRef[] {
  const c = chipByKey.get(key)!;
  const rest = c.x ? active.filter((a) => !(chipByKey.get(a.key)!.x && chipByKey.get(a.key)!.group === c.group)) : active;
  if (rest.length >= MAX_CHIPS) return active;
  return [...rest, c.param ? { key, param: defaultParam(c) } : { key }];
}
export function swapChip(active: ChipRef[], oldKey: string, newKey: string): ChipRef[] {
  const c = chipByKey.get(newKey)!;
  return active.map((a) => (a.key === oldKey ? (c.param ? { key: newKey, param: defaultParam(c) } : { key: newKey }) : a));
}
export const withoutChip = (active: ChipRef[], key: string) => active.filter((a) => a.key !== key);
export const withParam = (active: ChipRef[], key: string, param: string | number) => active.map((a) => (a.key === key ? { ...a, param } : a));
