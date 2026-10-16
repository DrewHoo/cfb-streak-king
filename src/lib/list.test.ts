import { describe, expect, test } from 'vitest';
import type { Dir, MinedCrown, Scope } from './types.ts';
import { LIST, chanceOf, crownScore, scoreParts, rateOf, listCrowns, listRuns, tierOf, conditionCost, isSubStreak, markSubStreaks, pick, admitted, withKnobs, byOrder } from './list.ts';
import { choicesOf } from './minedChips.ts';

const ctx = { teams: 136 };
/** The classic weights: the field's rate alone, no rarity bonus, no margin cost, so a term can be read on its own. */
const W = { ...LIST, rate: 0, rarityW: 0, marginCost: 0 };
const crown = (o: Partial<MinedCrown> & { dir?: Dir; scope?: Scope } = {}): MinedCrown => ({
  chips: [], dir: 'W', scope: 'active', len: 10, atEdge: false, field: 100, rank: 1, tied: 1, second: 5, startSe: 2020, endSe: 2020, live: true, also: 0, p: 0.5, n: 1000, hT: 50, nT: 100, gT: 100, ...o,
});
const chance = Math.log2(136);

describe('crownScore', () => {
  test('bits past the expected leader plus the lead over the field, less the words', () => {
    // 10 coin flips against 136 teams, 5 clear of the next team, no chips, one season
    expect(crownScore(crown(), ctx, W)).toBeCloseTo(10 + W.leadW * 5 - chance, 10);
    expect(crownScore(crown({ chips: ['home'] }), ctx, W)).toBeCloseTo(10 + W.leadW * 5 - chance - W.tiers.brag, 10);
  });

  test('a chip costs by its tier', () => {
    const one = (k: string) => crownScore(crown({ chips: [k] }), ctx, W);
    expect(tierOf('home')).toBe('brag');
    expect(tierOf('unranked')).toBe('plain');
    expect(tierOf('fullmoon')).toBe('trivia');
    expect(tierOf('onescore')).toBe('ingame');
    expect(one('home') - one('unranked')).toBeCloseTo(W.tiers.plain - W.tiers.brag, 10);
    expect(one('home') - one('fullmoon')).toBeCloseTo(W.tiers.trivia - W.tiers.brag, 10);
    expect(one('home') - one('onescore')).toBeCloseTo(W.tiers.ingame - W.tiers.brag, 10);
    // the betting and previous-result chips are known before kickoff for scoring: not in-game
    expect(one('afterloss')).toBe(one('home'));
    expect(one('fav')).toBe(one('unranked'));
  });

  test('a chip with a choice pays for the choice: one of 288 opponents, one of the states', () => {
    expect(tierOf('vsteam:alabama')).toBe('brag');
    expect(tierOf('state:TX')).toBe('trivia');
    expect(choicesOf('vsteam:alabama')).toBeGreaterThan(200);
    expect(choicesOf('home')).toBe(1);
    expect(conditionCost(['vsteam:alabama'])).toBeCloseTo(LIST.tiers.brag + Math.log2(choicesOf('vsteam:alabama')), 10);
    expect(conditionCost(['state:TX', 'home'])).toBeCloseTo(LIST.tiers.trivia + Math.log2(choicesOf('state:TX')) + LIST.tiers.brag, 10);
    // the half chips are mined at one margin, so they are plain and choose nothing
    expect(conditionCost(['leadhalf:1'])).toBe(LIST.tiers.plain);
  });

  test('a run that trails the field pays its whole gap, unless the floor is set', () => {
    const trailing = crown({ rank: 3, second: 20 });
    expect(crownScore(trailing, ctx, W)).toBeCloseTo(10 - W.leadW * 10 - chance, 10);
    expect(crownScore(trailing, ctx, { ...W, leadFloor: 0 })).toBeCloseTo(10 - chance, 10);
    // a sole leader scores its lead; a tie leads by nothing
    expect(crownScore(crown({ second: 10, tied: 2 }), ctx, W)).toBeCloseTo(10 - chance, 10);
  });

  test('chance: every team gets len tries at the field\'s rate, whatever the rate knob', () => {
    // 10 coin flips, 136 teams: 1 − (1 − 2^-10)^136
    expect(chanceOf(crown(), ctx)).toBeCloseTo(1 - (1 - 2 ** -10) ** 136, 12);
    // all-time: a try at every non-matching game
    expect(chanceOf(crown({ scope: 'all', n: 2000, p: 0.5 }), ctx)).toBeCloseTo(1 - (1 - 2 ** -10) ** 1000, 12);
    // a long run doesn't underflow to zero
    expect(chanceOf(crown({ len: 100, p: 0.58 }), ctx)).toBeGreaterThan(0);
  });

  test('all-time charges every place a run could start, and pays for span', () => {
    const c = crown({ scope: 'all', n: 4096, startSe: 1990, endSe: 2005, second: 10 });
    expect(crownScore(c, ctx, W)).toBeCloseTo(10 - Math.log2(2048) + W.spanAll * 4, 10);
  });

  test('the rate knob measures a run against the team\'s own rate, shrunk toward the field\'s', () => {
    // the field wins half; this team won 95 of 100 under the definition
    const easy = crown({ p: 0.5, hT: 95, nT: 100, len: 20 });
    const { pF, pT, b } = rateOf(easy, { ...LIST, rate: 1, rateShrink: 0 });
    expect(pF).toBe(0.5);
    expect(pT).toBeCloseTo(0.95, 12);
    expect(b).toBeCloseTo(Math.log2(1 / 0.95), 12);
    // shrinkage: 20 games of prior at the field's rate
    expect(rateOf(easy, { ...LIST, rate: 1, rateShrink: 20 }).pT).toBeCloseTo((95 + 10) / 120, 12);
    // the mix is in bits: halfway between the two rarities
    expect(rateOf(easy, { ...LIST, rate: 0.5, rateShrink: 0 }).b).toBeCloseTo((1 + Math.log2(1 / 0.95)) / 2, 12);
    // so twenty easy wins score less than twenty coin flips, at the same words
    expect(crownScore(easy, ctx, { ...W, rate: 1, rateShrink: 0 })).toBeLessThan(crownScore(crown({ len: 20 }), ctx, { ...W, rate: 1, rateShrink: 0 }));
    // a team with few qualifying games stays near the field
    expect(rateOf(crown({ hT: 3, nT: 3 }), { ...LIST, rate: 1, rateShrink: 20 }).pT).toBeCloseTo(13 / 23, 12);
  });

  test('the rarity bonus lifts a hard definition by a fixed amount, and the margin cost charges a by-10 outcome', () => {
    const hard = crown({ p: 0.25, len: 4, second: 4, tied: 2 });
    const parts = scoreParts(hard, ctx, { ...W, rarityW: 4 });
    expect(parts.rarity).toBeCloseTo(4 * 2, 10);
    expect(parts.total).toBeCloseTo(crownScore(hard, ctx, W) + 8, 10);
    expect(scoreParts(crown({ dir: 'W10' }), ctx, { ...W, marginCost: 3 }).margin).toBe(-3);
    expect(scoreParts(crown(), ctx, { ...W, marginCost: 3 }).margin).toBe(0);
    // the terms add up to the total
    const p = scoreParts(crown({ chips: ['home', 'fullmoon'], scope: 'all', n: 500, startSe: 1990, endSe: 1999 }), ctx);
    expect(p.length + p.lead + p.chance + p.conditions + p.margin + p.rarity + p.span).toBeCloseTo(p.total, 10);
  });
});

describe('sparsity and the rival discount', () => {
  test('a definition that keeps a sliver of the team’s games pays log2 of the ratio; one that keeps every game pays nothing', () => {
    const sliver = crown({ nT: 11, gT: 1066 });
    expect(scoreParts(sliver, ctx, W).sparse).toBeCloseTo(-Math.log2(1066 / 11), 10);
    expect(scoreParts(crown({ nT: 965, gT: 965 }), ctx, W).sparse).toBe(0);
    expect(scoreParts(sliver, ctx, { ...W, sparseW: 0 }).sparse).toBe(0);
    expect(scoreParts(sliver, ctx, { ...W, sparseW: 2 }).sparse).toBeCloseTo(-2 * Math.log2(1066 / 11), 10);
    // the terms still add up
    const p = scoreParts(sliver, ctx);
    expect(p.length + p.lead + p.chance + p.conditions + p.margin + p.sparse + p.rarity + p.span).toBeCloseTo(p.total, 10);
  });

  test('an opponent chip naming a rival is priced as a choice among the team’s rivals, by the knob', () => {
    const full = conditionCost(['vsteam:auburn'], W);
    expect(full).toBeCloseTo(W.tiers.brag + Math.log2(choicesOf('vsteam:auburn')), 10);
    // Alabama has four rivals in the payload, say: the choice is one of four
    expect(conditionCost(['vsteam:auburn'], W, 4)).toBeCloseTo(W.tiers.brag + Math.log2(4), 10);
    expect(conditionCost(['vsteam:auburn'], { ...W, rivalChoice: 0 }, 4)).toBeCloseTo(full, 10);
    expect(conditionCost(['vsteam:auburn'], { ...W, rivalChoice: 0.5 }, 4)).toBeCloseTo((full + W.tiers.brag + Math.log2(4)) / 2, 10);
    // a non-opponent chip is untouched, and a row without the rival flag pays in full
    expect(conditionCost(['home', 'vsteam:auburn'], W, 4) - conditionCost(['vsteam:auburn'], W, 4)).toBeCloseTo(W.tiers.brag, 10);
    expect(scoreParts(crown({ chips: ['vsteam:houston'] }), ctx, W).conditions).toBeCloseTo(-full, 10);
    expect(scoreParts(crown({ chips: ['vsteam:auburn'], rivals: 4 }), ctx, W).conditions).toBeCloseTo(-(W.tiers.brag + 2), 10);
  });
});

describe('admit and pick', () => {
  test('a run admits by either placing; the fewest-conditions admitted placing shows, the other rides along', () => {
    const plainSecond = crown({ rank: 2, second: 12, highest: { chips: ['nonconf'], field: 90, rank: 1, tied: 1, second: 8, p: 0.55, n: 400, hT: 20, nT: 30, atEdge: false, live: true } });
    expect(admitted(plainSecond)).toBe(true);
    const shown = pick(plainSecond);
    expect(shown.chips).toEqual(['nonconf']);
    expect(shown.rank).toBe(1);
    expect(shown.other).toMatchObject({ chips: [], rank: 2 });
    expect('highest' in shown).toBe(false);
    // the medal rule: the plain placing admits, so it shows, its leading words beside it
    const medal = withKnobs({ 'admit.rank': 3 });
    const medalShown = pick(plainSecond, medal);
    expect(medalShown.chips).toEqual([]);
    expect(medalShown.rank).toBe(2);
    expect(medalShown.other).toMatchObject({ chips: ['nonconf'], rank: 1 });
    // 'highest' always takes the better place
    expect(pick(plainSecond, { ...medal, pick: 'highest' }).chips).toEqual(['nonconf']);
    // a run with no highest placing and a plain place past the knob stays off
    expect(admitted(crown({ rank: 2 }))).toBe(false);
    expect(admitted(crown({ rank: 2 }), medal)).toBe(true);
    // a broken run that is the all-time longest admits whatever its place
    expect(admitted(crown({ rank: 7, everLen: 10, everN: 1 }))).toBe(true);
  });

  test('withKnobs lays overrides over LIST, a path at a time, without touching LIST', () => {
    const k = withKnobs({ 'tiers.brag': 2, rate: 0, 'sameYears.directed': false });
    expect(k.tiers.brag).toBe(2);
    expect(k.tiers.plain).toBe(LIST.tiers.plain);
    expect(k.rate).toBe(0);
    expect(k.sameYears.directed).toBe(false);
    expect(LIST.tiers.brag).toBe(1);
    expect(LIST.sameYears.directed).toBe(true);
  });
});

describe('listCrowns', () => {
  const keys = (cs: { dir: Dir; chips: string[] }[]) => cs.map((c) => `${c.dir} ${c.chips.join('+')}`);

  test('A+B is a sub-streak of A when A runs at least as long; longer under more conditions it stands', () => {
    const a = crown({ chips: ['home'], len: 20 });
    const shorter = crown({ chips: ['home', 'night'], len: 20 });
    const longer = crown({ chips: ['home', 'rivalry'], len: 40 });
    const out = listCrowns([a, shorter, longer], ctx, W);
    expect(keys(out)).toEqual(['W home+rivalry', 'W home', 'W home+night']);
    expect(out.map((c) => c.subStreak)).toEqual([false, false, true]);
    // another outcome is another story
    expect(isSubStreak(crown({ dir: 'L', chips: ['home', 'night'], len: 5 }), [a])).toBe(false);
  });

  test('a sub-streak that started first stands when olderStands is on, and not otherwise', () => {
    const a = crown({ chips: ['night'], len: 10, startSe: 2022 });
    const older = crown({ chips: ['home', 'night'], len: 5, startSe: 2019 });
    expect(isSubStreak(older, [a, older])).toBe(false);
    expect(isSubStreak(older, [a, older], { ...LIST, olderStands: false })).toBe(true);
    expect(markSubStreaks([a, older]).map((c) => c.subStreak)).toEqual([false, false]);
    // all-time: only an overlapping run tells the same story
    const past = crown({ scope: 'all', chips: ['home', 'night'], len: 5, startSe: 1990, endSe: 1992 });
    const later = crown({ scope: 'all', chips: ['night'], len: 10, startSe: 2000, endSe: 2003 });
    expect(isSubStreak(past, [later, past], { ...LIST, olderStands: false })).toBe(false);
  });

  test('only a slice of the same run hides: all-time runs in other seasons stand', () => {
    const a = crown({ scope: 'all', len: 40, startSe: 1946, endSe: 1959 });
    const later = crown({ scope: 'all', chips: ['road'], len: 30, startSe: 1971, endSe: 1980 });
    const slice = crown({ scope: 'all', chips: ['road'], len: 20, startSe: 1950, endSe: 1955 });
    expect(keys(listCrowns([a, later], ctx, W))).toEqual(['W ', 'W road']);
    expect(keys(listCrowns([a, slice], ctx, W))).toEqual(['W ']);
  });

  test('an undefeated run identical to a winning one drops; a plain run identical to its by-10 placing drops', () => {
    const w = crown({ len: 30 });
    expect(keys(listCrowns([w, crown({ dir: 'U', len: 30 }), crown({ dir: 'U', len: 31 })], ctx, W))).toEqual(['U ', 'W ']);
    expect(keys(listCrowns([w, crown({ dir: 'W10', len: 30, p: 0.3 })], ctx, W))).toEqual(['W10 ']);
  });

  test('the same-years rule has a direction: only a simpler, longer run absorbs a run a stricter outcome covers of its years', () => {
    // Oklahoma: the plain 47 of 1953–57, "after a win" 46 of the same years (absorbed), and the Big 8's 44 of 1952–59 (longer-worded and shorter, so it can't absorb the 47; older, so it stands beside it)
    const plain = crown({ scope: 'all', len: 47, startSe: 1953, endSe: 1957, second: 35, n: 100000 });
    const afterWin = crown({ scope: 'all', chips: ['afterwin'], len: 46, startSe: 1953, endSe: 1957, second: 34, n: 50000 });
    const big8 = crown({ scope: 'all', chips: ['vsconf:Big 8'], len: 44, startSe: 1952, endSe: 1959, second: 27, p: 0.47, n: 4400 });
    expect(crownScore(big8, ctx, W)).toBeGreaterThan(crownScore(plain, ctx, W)); // the field is small and the lead big
    const out = listCrowns([plain, afterWin, big8], ctx, W);
    expect(keys(out)).toEqual(['W vsconf:Big 8', 'W ']);
    expect(out.map((c) => c.subStreak)).toEqual([false, false]);
    // without the direction, the better-scoring Big 8 run eats the plain 47, and the 47's own run a stricter outcome covers outlives it
    expect(keys(listCrowns([plain, afterWin, big8], ctx, { ...W, sameYears: { directed: false, overlap: 50 }, olderStands: false }))).toEqual(['W vsconf:Big 8', 'W afterwin']);
  });

  test('same years alone don\'t make one story: another outcome or an unrelated definition stands', () => {
    const run = crown({ scope: 'all', chips: ['unranked'], len: 100, startSe: 2007, endSe: 2021 });
    const vsRanked = crown({ scope: 'all', chips: ['away', 'ranked'], len: 16, startSe: 2014, endSe: 2017 });
    const unbeaten = crown({ scope: 'all', dir: 'U', chips: ['unranked', 'home'], len: 60, startSe: 2008, endSe: 2020 });
    expect(keys(listCrowns([run, vsRanked, unbeaten], ctx, W))).toEqual(['W unranked', 'U unranked+home', 'W away+ranked']);
  });

  test('a run past the admit knob stays off, and nothing else is cut: no score floor', () => {
    const chancy = crown({ chips: ['home', 'fullmoon'], len: 5, second: 5 });
    const plain = crown({ dir: 'L', len: 4, second: 4 });
    const trailing = crown({ dir: 'L', len: 9, rank: 2, second: 12 });
    expect(keys(listCrowns([chancy, plain, trailing], ctx, W))).toEqual(['L ', 'W home+fullmoon']);
    expect(keys(listCrowns([chancy, plain, trailing], ctx, withKnobs({ 'admit.rank': 2 })))).toContain('L ');
    expect(listCrowns([chancy, plain, trailing], ctx, withKnobs({ 'admit.rank': 2 })).length).toBe(3);
  });

  test('a bucket sorts by score band, then rarity, then length; 0 is pure score', () => {
    const easyLong = crown({ chips: ['instate'], len: 30, p: 0.6, second: 25, startSe: 1998, endSe: 2026 });
    const hardShort = crown({ chips: ['road', 'ranked'], len: 4, p: 0.23, second: 4, tied: 2, startSe: 2024, endSe: 2026 });
    const pure = listCrowns([easyLong, hardShort], ctx, W);
    expect(keys(pure)).toEqual(['W instate', 'W road+ranked']);
    expect(pure[0].score - pure[1].score).toBeLessThan(40);
    const banded = listCrowns([easyLong, hardShort], ctx, { ...W, bucket: 40 });
    expect(keys(banded)).toEqual(['W road+ranked', 'W instate']);
    expect([easyLong, hardShort].map((c) => ({ score: crownScore(c, ctx, W), bits: rateOf(c, W).b, len: c.len })).sort(byOrder({ ...W, bucket: 40 })).map((x) => x.len)).toEqual([4, 30]);
  });

  test('listed rows carry their chance, score, rarity and subStreak flag, and keep the inputs for the tuner', () => {
    const out = listCrowns([crown()], ctx)[0];
    expect(out.p).toBe(0.5);
    expect(out.hT).toBe(50);
    expect(out.chance).toBeCloseTo(chanceOf(crown(), ctx), 12);
    expect(out.score).toBeCloseTo(crownScore(crown(), ctx), 12);
    expect(out.bits).toBeCloseTo(rateOf(crown()).b, 12);
    expect(out.subStreak).toBe(false);
    expect('highest' in out).toBe(false);
  });

  test('listRuns tells, scores and flags many teams\' rows against each team\'s own', () => {
    const rows = [
      { ...crown({ chips: ['home'], len: 9 }), ti: 1 },
      { ...crown({ chips: ['home', 'night'], len: 7 }), ti: 1 },
      { ...crown({ chips: ['home', 'night'], len: 7 }), ti: 2 },
    ];
    const out = listRuns(rows, ctx);
    expect(out[0]).toMatchObject({ ti: 1, chips: ['home'], subStreak: false });
    expect(out.map((r) => `${r.ti}:${r.chips.join('+')}:${r.subStreak}`).sort()).toEqual(['1:home+night:true', '1:home:false', '2:home+night:false']);
  });
});
