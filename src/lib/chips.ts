// The chip catalog. A chip is one word of a streak definition.
//
//   known(g)  whether this game's data can answer the chip at all: a game
//             with no closing line can't be "as an underdog", a game before
//             the season's first poll can't be "vs ranked". An unknown game
//             never qualifies. Omitted = always known.
//   test(g)   whether a known game qualifies.
//   pregame   test reads only what's known before kickoff (GameContext), so
//             the same test decides a scheduled game: "could be broken this
//             week" and the next game atop a live column. A post-hoc chip
//             (score, clock, previous result) keeps a definition out of both.
//   floor     the first season the chip's data exists, and what that data
//             is called, for "this streak may be longer than we can show".
//             chips.test.ts checks every floor against the payload.
//   notWith   outcomes the chip can't define a streak of, because it nearly
//             decides them: a one-score final, or a shootout's margin under
//             10, mostly settles the cover.
//
// Every test reads only the row, so the catalog has no dependencies.

import type { Dir, GameContext, GameRow } from './types.ts';

export type ParamKind = 'state' | 'conf' | 'team' | 'month' | 'hmargin';
export type Param = string | number | undefined;

interface ChipBase {
  key: string;
  label: string;
  group: string;
  /** One per group: adding it replaces the group-mate. */
  exclusive?: boolean;
  param?: ParamKind;
  floor?: { season: number; what: string };
  notWith?: Dir[];
}
export interface PregameChip extends ChipBase {
  pregame: true;
  known?: (g: GameContext) => boolean;
  test: (g: GameContext, p?: Param) => boolean;
}
export interface PostgameChip extends ChipBase {
  pregame: false;
  known?: (g: GameRow) => boolean;
  test: (g: GameRow, p?: Param) => boolean;
}
export type Chip = PregameChip | PostgameChip;

const num = (p: Param) => p as number;
const pre = (c: Omit<PregameChip, 'pregame'>): PregameChip => ({ ...c, pregame: true });
const post = (c: Omit<PostgameChip, 'pregame'>): PostgameChip => ({ ...c, pregame: false });

const oppRankKnown = (g: GameContext) => g.oppRank != null;
const ownRankKnown = (g: GameContext) => g.ownRank != null;
const lined = (g: GameRow) => g.sp != null;
const BETTING = { exclusive: true, known: lined, floor: { season: 1978, what: 'closing-line' } } as const;
const HALF = { season: 2001, what: 'halftime-score' };
const CLOCK = { season: 2004, what: 'possession' };

export const CHIPS: Chip[] = [
  pre({ key: 'home', label: 'at home', group: 'site', exclusive: true, test: (x) => x.home && !x.neutral }),
  pre({ key: 'road', label: 'on the road', group: 'site', exclusive: true, test: (x) => !x.home && !x.neutral }),
  pre({ key: 'neutral', label: 'neutral site', group: 'site', exclusive: true, test: (x) => x.neutral }),
  pre({ key: 'away', label: 'not at home', group: 'site', exclusive: true, test: (x) => !(x.home && !x.neutral) }),
  pre({ key: 'state', label: 'in [state]', group: 'site', param: 'state', test: (x, p) => x.vst === p }),
  pre({ key: 'ranked', label: 'vs ranked opponents', group: 'opp rank', exclusive: true, known: oppRankKnown, test: (x) => x.oppRank! > 0 }),
  pre({ key: 'top10', label: 'vs top-10 opponents', group: 'opp rank', exclusive: true, known: oppRankKnown, test: (x) => x.oppRank! >= 1 && x.oppRank! <= 10 }),
  pre({ key: 'top5', label: 'vs top-5 opponents', group: 'opp rank', exclusive: true, known: oppRankKnown, test: (x) => x.oppRank! >= 1 && x.oppRank! <= 5 }),
  pre({ key: 'unranked', label: 'vs unranked opponents', group: 'opp rank', exclusive: true, known: oppRankKnown, test: (x) => x.oppRank === 0 }),
  pre({ key: 'whileranked', label: 'while ranked', group: 'own rank', exclusive: true, known: ownRankKnown, test: (x) => x.ownRank! > 0 }),
  pre({ key: 'whileunranked', label: 'while unranked', group: 'own rank', exclusive: true, known: ownRankKnown, test: (x) => x.ownRank === 0 }),
  // a scheduled game's line moves until kickoff, so betting chips are post-hoc
  post({ key: 'fav', label: 'as the favorite', group: 'betting', ...BETTING, test: (x) => x.sp! < 0 }),
  post({ key: 'dog', label: 'as an underdog', group: 'betting', ...BETTING, test: (x) => x.sp! > 0 }),
  post({ key: 'dog7', label: 'as a 7+ point underdog', group: 'betting', ...BETTING, test: (x) => x.sp! >= 7 }),
  post({ key: 'dog14', label: 'as a 14+ point underdog', group: 'betting', ...BETTING, test: (x) => x.sp! >= 14 }),
  post({ key: 'close', label: 'close spread (≤ 3)', group: 'betting', ...BETTING, test: (x) => Math.abs(x.sp!) <= 3 }),
  pre({ key: 'confgame', label: 'in conference games', group: 'conference', exclusive: true, test: (x) => x.conf }),
  pre({ key: 'nonconf', label: 'in non-conference games', group: 'conference', exclusive: true, test: (x) => !x.conf }),
  pre({ key: 'vsconf', label: 'vs the [conference]', group: 'conference', param: 'conf', test: (x, p) => x.oppConf === p }),
  pre({ key: 'vsteam', label: 'vs [team]', group: 'opponent', param: 'team', test: (x, p) => x.oppIdx === p }),
  pre({ key: 'rivalry', label: 'rivalry game', group: 'opponent', test: (x) => x.rv > 0 }),
  pre({ key: 'instate', label: 'in-state opponent', group: 'opponent', test: (x) => x.inState }),
  pre({ key: 'curcoach', label: 'under current head coach', group: 'coach', test: (x) => x.hcCur }),
  pre({ key: 'newcoach', label: 'in a coach’s first season', group: 'coach', test: (x) => x.hcNew }),
  pre({ key: 'vsnewcoach', label: 'vs a first-year head coach', group: 'coach', test: (x) => x.vsNew }),
  pre({ key: 'month', label: 'in [month]', group: 'calendar', param: 'month', test: (x, p) => x.month === p }),
  pre({ key: 'opener', label: 'season opener', group: 'calendar', test: (x) => !!x.opener }),
  pre({ key: 'finale', label: 'regular-season finale', group: 'calendar', test: (x) => !!x.finale }),
  pre({ key: 'postseason', label: 'bowl or playoff game', group: 'calendar', exclusive: true, test: (x) => x.post }),
  // the previous game can still be unplayed when a scheduled game is decided
  post({ key: 'afterloss', label: 'after a loss', group: 'context', exclusive: true, test: (x) => x.prevR === 'L' }),
  post({ key: 'afterwin', label: 'after a win', group: 'context', exclusive: true, test: (x) => x.prevR === 'W' }),
  post({ key: 'afterbye', label: 'after a bye', group: 'context', test: (x) => x.rest != null && x.rest >= 13 }),
  post({ key: 'leadhalf', label: 'leading at half', group: 'half', exclusive: true, param: 'hmargin', known: (x) => x.h1 != null, test: (x, p) => x.h1! >= num(p), floor: HALF }),
  post({ key: 'trailhalf', label: 'trailing at half', group: 'half', exclusive: true, param: 'hmargin', known: (x) => x.h1 != null, test: (x, p) => x.h1! <= -num(p), floor: HALF }),
  post({ key: 'wonpos', label: 'won the clock', group: 'possession', exclusive: true, known: (x) => x.pos != null, test: (x) => x.pos! > 0.5, floor: CLOCK }),
  post({ key: 'lostpos', label: 'lost the clock', group: 'possession', exclusive: true, known: (x) => x.pos != null, test: (x) => x.pos! < 0.5, floor: CLOCK }),
  post({ key: 'onescore', label: 'one-score game', group: 'shape', exclusive: true, notWith: ['C', 'N'], test: (x) => x.margin <= 8 }),
  // a shootout is high-scoring AND contested: 70+ combined (1σ above the
  // all-time mean of 51.0) decided by fewer than 10 — 4.9% of games. A 73-0
  // blowout is not a shootout. struggle keeps the 1σ low bound (~15% tail).
  post({ key: 'shootout', label: 'shootout (70+, decided by <10)', group: 'shape', exclusive: true, notWith: ['C', 'N'], test: (x) => x.total >= 70 && x.margin < 10 }),
  post({ key: 'struggle', label: 'rock fight (≤ 33)', group: 'shape', exclusive: true, test: (x) => x.total <= 33 }),
  post({ key: 'overtime', label: 'overtime game', group: 'shape', known: (x) => x.ot >= 0, test: (x) => x.ot > 0, floor: { season: 2001, what: 'overtime' } }),
  // weekend and weekday by the game date; a full moon within a day of its evening (moon.ts)
  pre({ key: 'weekend', label: 'on a weekend', group: 'almanac', exclusive: true, test: (x) => x.wday === 0 || x.wday === 6 }),
  pre({ key: 'weekday', label: 'on a weekday', group: 'almanac', exclusive: true, test: (x) => x.wday >= 1 && x.wday <= 5 }),
  pre({ key: 'fullmoon', label: 'under a full moon', group: 'almanac', test: (x) => x.moon }),
  pre({ key: 'night', label: 'night game (6pm+)', group: 'kickoff', known: (x) => x.hh !== 31, test: (x) => x.hh >= 18, floor: { season: 2002, what: 'kickoff-time' } }),
];

export const chipByKey = new Map(CHIPS.map((c) => [c.key, c]));

/** Whether a game qualifies under one chip: its data is known and the test passes. */
export function qualifies(c: Chip, g: GameRow, p?: Param): boolean {
  return (c.known ? (c.known as (g: GameRow) => boolean)(g) : true) && (c.test as (g: GameRow, p?: Param) => boolean)(g, p);
}
/** The same for a scheduled game; only pregame chips can decide one. */
export function qualifiesPregame(c: PregameChip, g: GameContext, p?: Param): boolean {
  return (c.known ? c.known(g) : true) && c.test(g, p);
}

/** Whether a chip can define a streak of outcome `dir`. */
export const fitsDir = (c: Chip, dir: Dir) => !c.notWith?.includes(dir);

/** Two chips that can't both be in a definition. */
export const conflicts = (a: Chip, b: Chip) => !!a.exclusive && !!b.exclusive && a.group === b.group;

/** The chips that take no choice: the space the crowns miner walks. */
export const PLAIN_CHIPS = CHIPS.filter((c) => !c.param);
/**
 * How many definitions of up to 4 plain chips there are, the empty one
 * included, and how many kinds of streak they make with the outcomes each
 * can define.
 */
export const [PLAIN_DEFINITIONS, PLAIN_STREAK_KINDS] = (() => {
  const outcomes: Dir[] = ['W', 'L', 'U', 'C', 'N'];
  let defs = 0, kinds = 0;
  (function walk(start: number, chosen: number[]) {
    defs++;
    kinds += outcomes.filter((d) => chosen.every((j) => fitsDir(PLAIN_CHIPS[j], d))).length;
    if (chosen.length === 4) return;
    for (let i = start; i < PLAIN_CHIPS.length; i++) {
      if (chosen.some((j) => conflicts(PLAIN_CHIPS[j], PLAIN_CHIPS[i]))) continue;
      walk(i + 1, [...chosen, i]);
    }
  })(0, []);
  return [defs, kinds];
})();
