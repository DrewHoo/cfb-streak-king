import { describe, expect, test } from 'vitest';
import type { GameContext, GameRow } from './types.ts';
import { CHIPS, chipByKey, fitsDir, qualifies } from './chips.ts';
import { fbsNow, gamesOf } from './model.ts';
import { GROUP_NOTES, GROUPS, defaultParam } from './definition.ts';

const all: GameRow[] = [...fbsNow].flatMap((ti) => gamesOf(ti));

describe('floors match the data', () => {
  for (const c of CHIPS.filter((x) => x.floor)) {
    test(`${c.key}: nothing known before ${c.floor!.season}, something known in it`, () => {
      const known = (g: GameRow) => (c.known ? (c.known as (g: GameRow) => boolean)(g) : true);
      expect(all.filter((g) => g.se < c.floor!.season && known(g))).toHaveLength(0);
      expect(all.some((g) => g.se === c.floor!.season && known(g))).toBe(true);
    });
  }

  test('each group note names its chips’ floor year first', () => {
    for (const group of GROUPS) {
      const floors = CHIPS.filter((c) => c.group === group && c.floor).map((c) => c.floor!.season);
      if (!floors.length) continue;
      const first = Number(/\b(19|20)\d\d\b/.exec(GROUP_NOTES[group] ?? '')?.[0]);
      expect(first, group).toBe(Math.min(...floors));
    }
  });
});

describe('pregame chips read only what’s known before kickoff', () => {
  // everything GameRow adds to GameContext
  const POSTGAME: (keyof GameRow)[] = ['us', 'them', 'r', 'margin', 'total', 'ot', 'h1', 'pos', 'prevR', 'rest'];
  const blind = (g: GameRow): GameContext => {
    const x: Record<string, unknown> = { ...g };
    for (const k of POSTGAME) delete x[k];
    return x as unknown as GameContext;
  };
  for (const c of CHIPS.filter((x) => x.pregame)) {
    test(c.key, () => {
      const p = defaultParam(c);
      for (const g of all.slice(0, 3000)) {
        const withResult = qualifies(c, g, p);
        const withoutResult = c.pregame && (c.known ? c.known(blind(g)) : true) && c.test(blind(g), p);
        expect(withoutResult).toBe(withResult);
      }
    });
  }
});

test('a chip that bounds the margin can’t define a streak by more than it', () => {
  const onescore = chipByKey.get('onescore')!;
  const shootout = chipByKey.get('shootout')!;
  expect(fitsDir(onescore, 'W3')).toBe(true);
  expect(fitsDir(onescore, 'W10')).toBe(false);
  expect(fitsDir(onescore, 'L10')).toBe(false);
  expect(fitsDir(shootout, 'W7')).toBe(true);
  expect(fitsDir(shootout, 'W10')).toBe(false);
  expect(fitsDir(onescore, 'C')).toBe(false);
  expect(fitsDir(chipByKey.get('home')!, 'W28')).toBe(true);
  // the cap is honest: no qualifying game is decided by more
  for (const c of CHIPS.filter((x) => x.marginCap != null)) {
    expect(all.filter((g) => qualifies(c, g)).every((g) => g.margin <= c.marginCap!), c.key).toBe(true);
    expect(all.some((g) => qualifies(c, g) && g.margin === c.marginCap), c.key).toBe(true);
  }
});

test('every chip has a group the menu shows', () => {
  for (const c of CHIPS) expect(GROUPS, c.key).toContain(c.group);
});
