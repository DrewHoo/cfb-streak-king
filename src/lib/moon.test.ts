import { describe, expect, test } from 'vitest';
import { nearestFullMoon, underFullMoon } from './moon.ts';

const at = (iso: string) => Date.parse(iso) / 86400000;
const day = (iso: string) => Math.floor(at(iso));

describe('full moons match published times', () => {
  // full moons that were also total or partial lunar eclipses, whose times
  // are well documented (NASA eclipse catalog), UTC
  const KNOWN = ['2000-01-21T04:40Z', '2004-10-28T03:07Z', '2015-09-28T02:50Z', '2019-01-21T05:16Z', '2024-09-18T02:34Z'];
  for (const iso of KNOWN) {
    test(iso, () => {
      // within five minutes
      expect(Math.abs(nearestFullMoon(at(iso)) - at(iso)) * 1440).toBeLessThan(5);
    });
  }
});

test('a game counts within a day of the full moon', () => {
  // full moon 2024-09-18 02:34 UTC, 10:34pm Eastern on Sep 17; each game
  // date's evening is 8pm Eastern (00:00 UTC the next day)
  expect(underFullMoon(day('2024-09-17'))).toBe(true); // 2.5 hours before
  expect(underFullMoon(day('2024-09-18'))).toBe(true); // 21.4 hours after
  expect(underFullMoon(day('2024-09-16'))).toBe(false); // 26.6 hours before
  expect(underFullMoon(day('2024-09-19'))).toBe(false); // 45.4 hours after
});
