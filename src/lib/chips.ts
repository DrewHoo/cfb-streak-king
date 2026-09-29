// The chip catalog. A chip is one word of a streak definition: test(g)
// filters completed games; pre(u) decides a scheduled game (null = not
// knowable before kickoff, which keeps the chip out of "could be broken this
// week"). floor = first season the underlying fact exists. Every test reads
// only the row, so the catalog has no dependencies.

import type { GameContext, GameRow } from './types.ts';

export type ParamKind = 'state' | 'conf' | 'team' | 'month' | 'hmargin';
export type Param = string | number | undefined;

export interface Chip {
  key: string;
  label: string;
  group: string;
  /** Exclusive: one per group. */
  x?: boolean;
  param?: ParamKind;
  test: (g: GameRow, p?: Param) => boolean;
  pre: ((u: GameContext, p?: Param) => boolean) | null;
  note?: string;
  floor?: number;
}

const num = (p: Param) => p as number;

export const CHIPS: Chip[] = [
  { key: 'home', label: 'at home', group: 'site', x: true, test: (x) => x.home && !x.neutral, pre: (x) => x.home && !x.neutral },
  { key: 'road', label: 'on the road', group: 'site', x: true, test: (x) => !x.home && !x.neutral, pre: (x) => !x.home && !x.neutral },
  { key: 'neutral', label: 'neutral site', group: 'site', x: true, test: (x) => x.neutral, pre: (x) => x.neutral },
  { key: 'away', label: 'not at home', group: 'site', x: true, test: (x) => !(x.home && !x.neutral), pre: (x) => !(x.home && !x.neutral) },
  { key: 'state', label: 'in [state]', group: 'site', param: 'state', test: (x, p) => x.vst === p, pre: (x, p) => x.vst === p },
  { key: 'ranked', label: 'vs ranked opponents', group: 'opp rank', x: true, test: (x) => x.oppRank > 0, pre: (x) => x.oppRank > 0 },
  { key: 'top10', label: 'vs top-10 opponents', group: 'opp rank', x: true, test: (x) => x.oppRank >= 1 && x.oppRank <= 10, pre: (x) => x.oppRank >= 1 && x.oppRank <= 10 },
  { key: 'top5', label: 'vs top-5 opponents', group: 'opp rank', x: true, test: (x) => x.oppRank >= 1 && x.oppRank <= 5, pre: (x) => x.oppRank >= 1 && x.oppRank <= 5 },
  { key: 'unranked', label: 'vs unranked opponents', group: 'opp rank', x: true, test: (x) => x.oppRank === 0, pre: (x) => x.oppRank === 0 },
  { key: 'whileranked', label: 'while ranked', group: 'own rank', x: true, test: (x) => x.ownRank > 0, pre: (x) => x.ownRank > 0 },
  { key: 'whileunranked', label: 'while unranked', group: 'own rank', x: true, test: (x) => x.ownRank === 0, pre: (x) => x.ownRank === 0 },
  { key: 'fav', label: 'as the favorite', group: 'betting', x: true, test: (x) => x.sp != null && x.sp < 0, pre: null, note: 'lines through 2025' },
  { key: 'dog', label: 'as an underdog', group: 'betting', x: true, test: (x) => x.sp != null && x.sp > 0, pre: null, note: 'lines through 2025' },
  { key: 'dog7', label: 'as a 7+ point underdog', group: 'betting', x: true, test: (x) => x.sp != null && x.sp >= 7, pre: null, note: 'lines through 2025' },
  { key: 'dog14', label: 'as a 14+ point underdog', group: 'betting', x: true, test: (x) => x.sp != null && x.sp >= 14, pre: null, note: 'lines through 2025' },
  { key: 'close', label: 'close spread (≤ 3)', group: 'betting', x: true, test: (x) => x.sp != null && Math.abs(x.sp) <= 3, pre: null, note: 'lines through 2025' },
  { key: 'confgame', label: 'in conference games', group: 'conference', x: true, test: (x) => x.conf, pre: (x) => x.conf },
  { key: 'nonconf', label: 'in non-conference games', group: 'conference', x: true, test: (x) => !x.conf, pre: (x) => !x.conf },
  { key: 'vsconf', label: 'vs the [conference]', group: 'conference', param: 'conf', test: (x, p) => x.oppConf === p, pre: (x, p) => x.oppConf === p },
  { key: 'vsteam', label: 'vs [team]', group: 'opponent', param: 'team', test: (x, p) => x.oppIdx === p, pre: (x, p) => x.oppIdx === p },
  { key: 'rivalry', label: 'rivalry game', group: 'opponent', test: (x) => x.rv > 0, pre: (x) => x.rv > 0 },
  { key: 'instate', label: 'in-state opponent', group: 'opponent', test: (x) => x.inState, pre: (x) => x.inState },
  { key: 'curcoach', label: 'under current head coach', group: 'coach', test: (x) => !!x.hcCur, pre: (x) => !!x.hcCur },
  { key: 'newcoach', label: 'in a coach’s first season', group: 'coach', test: (x) => !!x.hcNew, pre: (x) => !!x.hcNew },
  { key: 'vsnewcoach', label: 'vs a first-year head coach', group: 'coach', test: (x) => !!x.vsNew, pre: (x) => !!x.vsNew },
  { key: 'month', label: 'in [month]', group: 'calendar', param: 'month', test: (x, p) => x.month === p, pre: (x, p) => x.month === p },
  { key: 'opener', label: 'season opener', group: 'calendar', test: (x) => !!x.opener, pre: (x) => !!x.opener },
  { key: 'finale', label: 'regular-season finale', group: 'calendar', test: (x) => !!x.finale, pre: (x) => !!x.finale },
  { key: 'postseason', label: 'bowl or playoff game', group: 'calendar', x: true, test: (x) => x.post, pre: (x) => x.post },
  { key: 'afterloss', label: 'after a loss', group: 'context', x: true, test: (x) => x.prevR === 'L', pre: null },
  { key: 'afterwin', label: 'after a win', group: 'context', x: true, test: (x) => x.prevR === 'W', pre: null },
  { key: 'afterbye', label: 'after a bye', group: 'context', test: (x) => x.rest != null && x.rest >= 13, pre: null },
  { key: 'leadhalf', label: 'leading at half', group: 'half', x: true, param: 'hmargin', test: (x, p) => x.h1 != null && x.h1 >= num(p), pre: null, floor: 2001 },
  { key: 'trailhalf', label: 'trailing at half', group: 'half', x: true, param: 'hmargin', test: (x, p) => x.h1 != null && x.h1 <= -num(p), pre: null, floor: 2001 },
  { key: 'wonpos', label: 'won the clock', group: 'possession', x: true, test: (x) => x.pos != null && x.pos > 0.5, pre: null, floor: 2004 },
  { key: 'dompos', label: 'dominated the clock (60%+)', group: 'possession', x: true, test: (x) => x.pos != null && x.pos >= 0.6, pre: null, floor: 2004 },
  { key: 'onescore', label: 'one-score game', group: 'shape', x: true, test: (x) => x.margin <= 8, pre: null },
  // a shootout is high-scoring AND contested: 70+ combined (1σ above the
  // all-time mean of 51.0) decided by fewer than 10 — 4.9% of games. A 73-0
  // blowout is not a shootout. struggle keeps the 1σ low bound (~15% tail).
  { key: 'shootout', label: 'shootout (70+, decided by <10)', group: 'shape', x: true, test: (x) => x.total >= 70 && x.margin < 10, pre: null },
  { key: 'struggle', label: 'rock fight (≤ 33)', group: 'shape', x: true, test: (x) => x.total <= 33, pre: null },
  { key: 'overtime', label: 'overtime game', group: 'shape', test: (x) => x.ot > 0, pre: null, floor: 2001 },
  { key: 'night', label: 'night game (6pm+)', group: 'kickoff', test: (x) => x.hh !== 31 && x.hh >= 18, pre: (x) => x.hh !== 31 && x.hh >= 18, floor: 2002 },
];

export const chipByKey = new Map(CHIPS.map((c) => [c.key, c]));
