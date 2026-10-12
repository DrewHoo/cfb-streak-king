import { describe, expect, test } from 'vitest';
import { P, teams, fbsNow, gamesOf, upcomingOf } from './model.ts';
import { keyOf, keyString, gamePath, gameFromPath, gameKeyFromString, findGame, seasonWeeks, seasons, scoreOf, isoDate } from './game.ts';
import { completedWeeks } from './weeks.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);

describe('a game’s key and address', () => {
  test('the address names the date and both teams, -at- or -vs- for a neutral site, and reads back', () => {
    const k = { ep: 20736, home: idx('alabama'), away: idx('georgia'), neutral: false };
    expect(isoDate(k.ep)).toBe('2026-10-10');
    expect(keyString(k)).toBe('2026-10-10/georgia-at-alabama');
    expect(gamePath(k)).toBe('game/2026-10-10/georgia-at-alabama/');
    expect(gameFromPath('/cfb-streak-king/game/2026-10-10/georgia-at-alabama/')).toEqual(k);
    expect(gameFromPath('/cfb-streak-king/game/2026-10-10/georgia-at-alabama')).toEqual(k);
    const n = { ep: 20473, home: idx('miami-fl'), away: idx('indiana'), neutral: true };
    expect(gameKeyFromString(keyString(n))).toEqual(n);
    expect(gameFromPath('/cfb-streak-king/game/2026-10-10/georgia-at-nowhere/')).toBeNull();
    expect(gameFromPath('/cfb-streak-king/game/not-a-date/georgia-at-alabama/')).toBeNull();
    expect(gameFromPath('/cfb-streak-king/team/alabama/')).toBeNull();
  });

  test('a row from either side names the same game', () => {
    const ti = idx('alabama');
    const g = gamesOf(ti).find((x) => x.se === 2026 && teams[x.oppIdx].id === 'georgia')!;
    const k = keyOf(ti, g);
    const theirs = gamesOf(g.oppIdx).find((x) => x.ep === g.ep && x.oppIdx === ti)!;
    expect(keyOf(g.oppIdx, theirs)).toEqual(k);
    const f = findGame(k);
    expect(f.played?.sides.map((s) => s.ti).sort()).toEqual([ti, g.oppIdx].sort());
    expect(f.scheduled).toBeNull();
    expect(f.played?.wk).toBe(completedWeeks().find((w) => w.lo <= g.ep && g.ep <= w.hi)?.wk);
    expect(scoreOf({ ti, row: g })).toEqual(g.home ? [g.us, g.them] : [g.them, g.us]);
  });

  test('a scheduled game resolves to its schedule entry', () => {
    const ti = [...fbsNow].find((t) => upcomingOf(t).length)!;
    const u = upcomingOf(ti)[0];
    const f = findGame(keyOf(ti, u));
    expect(f.played).toBeNull();
    expect(f.scheduled?.i).toBe(u.i);
  });
});

describe('a season’s weeks', () => {
  test('the running season has its completed weeks and its scheduled ones, numbered as the schedule numbers them', () => {
    const weeks = seasonWeeks(P.currentSeason);
    expect(weeks.length).toBeGreaterThan(1);
    for (let i = 1; i < weeks.length; i++) expect(weeks[i].wk).toBeGreaterThan(weeks[i - 1].wk);
    const done = completedWeeks().filter((w) => w.wk != null);
    for (const w of done) expect(weeks.find((x) => x.wk === w.wk)?.games.some((g) => g.played)).toBe(true);
    const scheduled = weeks.filter((w) => w.games.some((g) => g.scheduled));
    expect(scheduled.length).toBeGreaterThan(0);
    // every game once, in date order, with a score or a line
    for (const w of weeks) {
      const keys = new Set(w.games.map((g) => keyString(g.key)));
      expect(keys.size).toBe(w.games.length);
      for (let i = 1; i < w.games.length; i++) expect(w.games[i].key.ep).toBeGreaterThanOrEqual(w.games[i - 1].key.ep);
      for (const g of w.games) expect(!!g.played !== !!g.scheduled).toBe(true);
    }
  });

  test('a past season counts from its first game’s week, and every season since 1936 is offered', () => {
    const list = seasons();
    expect(list[0]).toBe(P.currentSeason);
    expect(list.at(-1)).toBe(1936);
    const w1987 = seasonWeeks(1987);
    expect(w1987[0].wk).toBe(1);
    expect(w1987.every((w) => w.games.every((g) => g.played && g.played.row.se === 1987))).toBe(true);
    expect(w1987.reduce((a, w) => a + w.games.length, 0)).toBeGreaterThan(300);
  });
});
