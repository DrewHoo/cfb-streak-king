import { describe, expect, test } from 'vitest';
import { baseDir, marginOf, isMargin, marginDir, parseDir, minedDir, MARGINS, MINED_MARGIN } from './outcome.ts';
import { dirWord, gamesWord, marginWords } from './format.ts';

describe('outcome', () => {
  test('a plain outcome has no margin; a margin one reads its base and margin', () => {
    for (const d of ['W', 'L', 'U', 'C', 'N'] as const) {
      expect(baseDir(d)).toBe(d);
      expect(marginOf(d)).toBe(0);
      expect(isMargin(d)).toBe(false);
    }
    expect(baseDir('W10')).toBe('W');
    expect(marginOf('W10')).toBe(10);
    expect(baseDir('L7')).toBe('L');
    expect(marginOf('L7')).toBe(7);
    expect(isMargin('L7')).toBe(true);
  });

  test('marginDir builds what parseDir reads back', () => {
    expect(marginDir('W', 10)).toBe('W10');
    expect(marginDir('W', 0)).toBe('W');
    for (const by of MARGINS) {
      expect(parseDir(marginDir('W', by))).toBe(`W${by}`);
      expect(parseDir(marginDir('L', by))).toBe(`L${by}`);
    }
  });

  test('parseDir takes the five letters and a margin on W or L, nothing else', () => {
    for (const d of ['W', 'L', 'U', 'C', 'N']) expect(parseDir(d)).toBe(d);
    expect(parseDir('W3')).toBe('W3');
    expect(parseDir('L28')).toBe('L28');
    for (const bad of ['W0', 'U10', 'C7', 'X', '', null, undefined, 'w10', 'W-3', 'W100', 'W1.5']) expect(parseDir(bad)).toBeNull();
  });

  test('the mined outcome of a margin outcome is the mined margin; a plain one is itself', () => {
    expect(minedDir('W7')).toBe(`W${MINED_MARGIN}`);
    expect(minedDir('L28')).toBe(`L${MINED_MARGIN}`);
    expect(minedDir('U')).toBe('U');
    expect(MARGINS).toContain(MINED_MARGIN);
  });

  test('the words', () => {
    expect(dirWord('W10')).toBe('winning by 10+');
    expect(dirWord('L7')).toBe('losing by 7+');
    expect(dirWord('N')).toBe('not covering');
    expect(marginWords('W10')).toBe(' by 10+ points');
    expect(marginWords('W')).toBe('');
    expect(gamesWord('W10', 1)).toBe('win by 10+');
    expect(gamesWord('L10', 5)).toBe('losses by 10+');
    expect(gamesWord('C', 2)).toBe('covers');
  });
});
