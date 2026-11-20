import { describe, expect, test } from 'vitest';
import { GTA_BEGINS, GTA_RELEASES, gtaLedger, inGtaWeek } from './gta.ts';
import { teams, gamesOf } from './model.ts';
import { chipByKey } from './chips.ts';
import { isTriviaChip } from './trivia.ts';

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000;

test('eight mainline releases, from 1997 to Grand Theft Auto VI', () => {
  expect(GTA_RELEASES).toHaveLength(8);
  expect(GTA_BEGINS).toBe(1997);
  expect(GTA_RELEASES.at(-1)).toBe(day('2026-11-19'));
});

test('a game counts in the seven days from a release', () => {
  // Grand Theft Auto VI came out Thursday, November 19, 2026
  expect(inGtaWeek(day('2026-11-18'))).toBe(false);
  expect(inGtaWeek(day('2026-11-19'))).toBe(true); // that night's games
  expect(inGtaWeek(day('2026-11-21'))).toBe(true); // the Saturday after
  expect(inGtaWeek(day('2026-11-25'))).toBe(true);
  expect(inGtaWeek(day('2026-11-26'))).toBe(false); // Thanksgiving, a week on
  // Grand Theft Auto V, Tuesday, September 17, 2013
  expect(inGtaWeek(day('2013-09-21'))).toBe(true);
  expect(inGtaWeek(day('2013-09-28'))).toBe(false);
});

test('the chip is a pregame trivia chip that closes at the first release', () => {
  const c = chipByKey.get('gta')!;
  expect(c.pregame).toBe(true);
  expect(c.begins).toBe(1997);
  expect(isTriviaChip('gta')).toBe(true);
});

describe('gtaLedger', () => {
  const ep = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  const g = (d: string, r?: 'W' | 'L') => ({ ep: ep(d), oppIdx: 0, home: true, neutral: false, r, us: 0, them: 0 });
  test('takes each release’s next game however late, and marks only the release-week ones', () => {
    const rows = gtaLedger([g('1998-09-05', 'L'), g('1999-10-23', 'L'), g('2013-09-21', 'W'), g('2026-11-21')]);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ game: 'Grand Theft Auto', days: 281, inWeek: false });
    expect(rows[1]).toMatchObject({ days: 1, inWeek: true });
    // GTA III's next game is in GTA V's week, twelve years on: not GTA III's
    expect(rows[2].next?.ep).toBe(ep('2013-09-21'));
    expect(rows[2].inWeek).toBe(false);
    expect(rows[7]).toMatchObject({ game: 'Grand Theft Auto VI', days: 2, inWeek: true });
  });
  test('a release with no game after it has no next game', () => {
    expect(gtaLedger([g('1998-09-05', 'L')])[7]).toMatchObject({ next: null, days: null, inWeek: false });
  });
});

describe('San Diego State, the 0-7 that went around on release day', () => {
  test('is 0-7 by next game whenever, 0-5 by release week', () => {
    const ti = teams.findIndex((t) => t.id === 'san-diego-state');
    const rows = gtaLedger(gamesOf(ti)).filter((r) => r.next?.r);
    expect(rows.map((r) => r.next!.r).join('')).toBe('LLLLLLL');
    expect(rows.filter((r) => r.inWeek)).toHaveLength(5);
  });
});
