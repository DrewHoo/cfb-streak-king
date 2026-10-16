// The raw mine as a file: a round trip keeps the Maps, and a file stamped for
// another payload, chip list or floor is refused. No mining here.
import { describe, expect, test, vi } from 'vitest';
import { MINE_STAMP, decodeMined, encodeMined } from './crowns.ts';
import type { Mined } from './crowns.ts';
import type { MinedCrown } from './types.ts';

const row: MinedCrown = { chips: ['home'], dir: 'W', scope: 'active', len: 5, atEdge: false, field: 20, rank: 1, tied: 1, second: 3, startSe: 2024, endSe: 2025, live: true, also: 2, p: 0.5, n: 100, hT: 5, nT: 9 };
const small: Mined = {
  active: new Map([[7, [row]]]),
  all: new Map([[7, [{ ...row, scope: 'all' }]]]),
  broken: new Map([[7, [{ ...row, ti: 7, enderIdx: 9, week: 2960, startIdx: 4, live: false, everLen: 9, everN: 1 }]]]),
  leaders: new Map([[7, [{ ...row, ti: 7, week: 2960, prev: 3, prevLen: 4, causeT: 3, causeIdx: 11, startIdx: 4 }]]]),
  teams: 136,
};

describe('the raw mine as a file', () => {
  test('round-trips through JSON', () => {
    const back = decodeMined(JSON.parse(JSON.stringify(encodeMined(small))), 'test');
    expect(back).toEqual(small);
  });

  test('the stamp names the payload, the chips, the floor and the history depth', () => {
    expect(MINE_STAMP).toMatch(/^payload \d{4}-.* · chips \d+\/[0-9a-f]{8} · keep -?\d+(\.\d+)? · hist \d · v\d+$/);
  });

  test('a file with another stamp is refused with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = { ...encodeMined(small), stamp: 'payload 1999-01-01 · chips 1/00000000 · keep 0' };
    expect(decodeMined(f, 'STREAK_MINED=x.json')).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('STREAK_MINED=x.json');
    warn.mockRestore();
  });
});
