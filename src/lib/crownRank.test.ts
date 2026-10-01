import { describe, expect, test } from 'vitest';
import type { Dir, Scope } from './types.ts';
import type { MinedCrown } from './crownRank.ts';
import { RANK, chanceOf, crownScore, rankCrowns } from './crownRank.ts';

const ctx = { M: [1, 35, 566, 5626, 38571], teams: 136 };
const crown = (o: Partial<MinedCrown> & { dir?: Dir; scope?: Scope } = {}): MinedCrown => ({
  chips: [], dir: 'W', scope: 'active', len: 10, atEdge: false, field: 100, startSe: 2020, endSe: 2020, live: true, also: 0, p: 0.5, n: 1000, ...o,
});

describe('crownScore', () => {
  test('bits past the expected leader, less the definition', () => {
    // 10 coin flips against 136 teams, no chips, one season
    expect(crownScore(crown(), ctx)).toBeCloseTo(10 - Math.log2(136), 10);
    expect(crownScore(crown({ chips: ['home'] }), ctx)).toBeCloseTo(10 - Math.log2(136) - RANK.chipW * Math.log2(35), 10);
  });

  test('only chips read from the game itself pay the postgame penalty', () => {
    const one = (k: string) => crownScore(crown({ chips: [k] }), ctx);
    expect(one('afterloss')).toBe(one('home'));
    expect(one('fav')).toBe(one('home'));
    expect(one('home') - one('onescore')).toBeCloseTo(RANK.postBits, 10);
  });

  test('chance: every team gets len tries at the field\'s rate', () => {
    // 10 coin flips, 136 teams: 1 − (1 − 2^-10)^136
    expect(chanceOf(crown(), ctx)).toBeCloseTo(1 - (1 - 2 ** -10) ** 136, 12);
    // all-time: a try at every non-matching game
    expect(chanceOf(crown({ scope: 'all', n: 2000, p: 0.5 }), ctx)).toBeCloseTo(1 - (1 - 2 ** -10) ** 1000, 12);
    // a long run doesn't underflow to zero
    expect(chanceOf(crown({ len: 100, p: 0.58 }), ctx)).toBeGreaterThan(0);
  });

  test('all-time charges every place a run could start, and pays for span', () => {
    const c = crown({ scope: 'all', n: 4096, startSe: 1990, endSe: 2005 });
    expect(crownScore(c, ctx)).toBeCloseTo(10 - Math.log2(2048) + RANK.spanAll * 4, 10);
  });
});

describe('rankCrowns', () => {
  const keys = (cs: { dir: Dir; chips: string[] }[]) => cs.map((c) => `${c.dir} ${c.chips.join('+')}`);

  test('A+B hides behind A unless it scores better', () => {
    const a = crown({ chips: ['home'], len: 20 });
    const worse = crown({ chips: ['home', 'night'], len: 21 });
    const better = crown({ chips: ['home', 'rivalry'], len: 40 });
    expect(keys(rankCrowns([a, worse, better], ctx))).toEqual(['W home+rivalry', 'W home']);
  });

  test('only a slice of the same run hides: all-time runs in other seasons stand', () => {
    const a = crown({ scope: 'all', len: 40, startSe: 1946, endSe: 1959 });
    const later = crown({ scope: 'all', chips: ['road'], len: 30, startSe: 1971, endSe: 1980 });
    const slice = crown({ scope: 'all', chips: ['road'], len: 20, startSe: 1950, endSe: 1955 });
    expect(keys(rankCrowns([a, later], ctx))).toEqual(['W ', 'W road']);
    expect(keys(rankCrowns([a, slice], ctx))).toEqual(['W ']);
  });

  test('an undefeated run identical to a winning one drops', () => {
    const w = crown({ len: 30 });
    expect(keys(rankCrowns([w, crown({ dir: 'U', len: 30 }), crown({ dir: 'U', len: 31 })], ctx))).toEqual(['U ', 'W ']);
  });

  test('an all-time crown that retells a better one\'s era collapses into it', () => {
    // Oklahoma: unbeaten in 74 conference games holds the 47 plain wins of the same years
    const dynasty = crown({ scope: 'all', dir: 'U', chips: ['confgame'], len: 74, startSe: 1946, endSe: 1959 });
    const retold = crown({ scope: 'all', dir: 'U', len: 48, startSe: 1953, endSe: 1957 });
    expect(keys(rankCrowns([dynasty, retold], ctx))).toEqual(['U confgame']);
  });

  test('same years alone don\'t make one era: another outcome or an unrelated definition stands', () => {
    const run = crown({ scope: 'all', chips: ['unranked'], len: 100, startSe: 2007, endSe: 2021 });
    const vsRanked = crown({ scope: 'all', chips: ['away', 'ranked'], len: 16, startSe: 2014, endSe: 2017 });
    const unbeaten = crown({ scope: 'all', dir: 'U', chips: ['unranked', 'home'], len: 60, startSe: 2008, endSe: 2020 });
    expect(keys(rankCrowns([run, vsRanked, unbeaten], ctx))).toEqual(['W unranked', 'U unranked+home', 'W away+ranked']);
  });

  test('the cutoff hides what chance would produce, but not a zero-chip crown', () => {
    const chance = crown({ chips: ['home', 'night', 'rivalry'], len: 5 });
    const plain = crown({ dir: 'L', len: 3 });
    expect(keys(rankCrowns([chance, plain], ctx))).toEqual(['L ']);
  });

  test('a team with nothing past the cutoff shows its best few', () => {
    const weak = ['home', 'road', 'neutral', 'night'].map((k, i) => crown({ chips: [k, 'rivalry', 'afterbye'], len: 5 + i }));
    expect(rankCrowns(weak, ctx).map((c) => c.len)).toEqual([8, 7, 6]);
  });

  test('ranked crowns carry their chance and drop the rate fields', () => {
    const out = rankCrowns([crown()], ctx)[0];
    expect(Object.keys(out)).not.toContain('p');
    expect(out.chance).toBeCloseTo(chanceOf(crown(), ctx), 12);
  });
});
