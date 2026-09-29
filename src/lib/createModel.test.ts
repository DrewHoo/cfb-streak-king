// createModel on small synthetic payloads: the cases the shipped payload
// can't show yet (games before 1970, games with no poll in effect).

import { describe, expect, test } from 'vitest';
import type { Payload, Team } from './types.ts';
import { createModel } from './createModel.ts';
import { NO_HOUR, NO_LINE, RANK_UNKNOWN, UNKNOWN, PRESENT } from './schema.ts';

const epOf = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);

interface G { date: string; home: number; away: number; hs: number; as: number; hr?: number; ar?: number; season?: number }

function payload(teams: Team[], games: G[], extra: Partial<Payload> = {}): Payload {
  const gs = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const col = <T>(f: (g: G) => T) => gs.map(f);
  return {
    v: 1, builtAt: '1960-01-01', lastBaseSeason: 1959, floors: {}, confs: [], states: [''], coachNames: [], coachIds: [],
    teams, rivals: [], currentSeason: 1960,
    games: {
      se: col((g) => g.season ?? +g.date.slice(0, 4)), ep: col((g) => epOf(g.date)), hi: col((g) => g.home), ai: col((g) => g.away),
      hs: col((g) => g.hs), as: col((g) => g.as), fl: col(() => 0), sp: col(() => NO_LINE),
      hr: col((g) => g.hr ?? 0), ar: col((g) => g.ar ?? 0), hh: col(() => NO_HOUR), rv: col(() => 0), vs: col(() => 0),
      hf: col(() => UNKNOWN), af: col(() => UNKNOWN), hp: col(() => UNKNOWN), ap: col(() => UNKNOWN), ot: col(() => UNKNOWN),
    },
    upcoming: { ep: [], hi: [], ai: [], fl: [], hr: [], ar: [], hh: [], rv: [], wk: [], vs: [] },
    ...extra,
  };
}
const team = (id: string, major: [number, number][] | null = [[1900, PRESENT]]): Team => ({ id, name: id, major });

describe('before 1970', () => {
  const P = payload([team('a'), team('b')], [
    { date: '1953-10-10', home: 0, away: 1, hs: 21, as: 7 },
    { date: '1953-10-17', home: 1, away: 0, hs: 3, as: 14 },
    { date: '1954-10-09', home: 0, away: 1, hs: 10, as: 10 },
    { date: '1954-10-16', home: 0, away: 1, hs: 28, as: 0 },
  ]);
  const m = createModel(P);

  test('negative epoch days decode and sort', () => {
    expect(m.gamesOf(0).map((g) => g.ep)).toEqual([...m.gamesOf(0).map((g) => g.ep)].sort((x, y) => x - y));
    expect(m.gamesOf(0)[0].ep).toBeLessThan(0);
    expect(m.firstSeason).toBe(1953);
  });

  test('a tie ends the run; the one before it is at the window edge', () => {
    const rows = m.allTimeBoard([], 'W', epOf('1960-01-01'));
    const a = rows.filter((r) => r.ti === 0).map((r) => [r.s.len, r.s.atEdge, r.live]);
    expect(a).toEqual([[2, true, false], [1, false, true]]);
    // only a's latest result is a win
    expect(m.activeBoard([], 'W', 0).map((r) => r.ti)).toEqual([0]);
  });
});

describe('rank unknown', () => {
  // the first game has no poll in effect for either side
  const P = payload([team('a'), team('b'), team('c')], [
    { date: '1940-09-28', home: 0, away: 1, hs: 20, as: 0, hr: RANK_UNKNOWN, ar: RANK_UNKNOWN },
    { date: '1940-10-19', home: 0, away: 2, hs: 13, as: 7, hr: 3, ar: 0 },
    { date: '1940-10-26', home: 1, away: 0, hs: 0, as: 35, hr: 0, ar: 2 },
  ]);
  const m = createModel(P);

  test('decodes to null', () => {
    expect(m.gamesOf(0).map((g) => g.oppRank)).toEqual([null, 0, 0]);
    expect(m.gamesOf(0).map((g) => g.ownRank)).toEqual([null, 3, 2]);
  });
  test('the game counts for neither "vs unranked" nor "vs ranked"', () => {
    const top = m.activeBoard([{ key: 'unranked' }], 'W', 0)[0];
    expect([top.ti, top.s.len]).toEqual([0, 2]);
    expect(top.qual.map((g) => g.oppRank)).toEqual([0, 0]);
    expect(m.activeBoard([{ key: 'whileranked' }], 'W', 0)[0].s.len).toBe(2);
    expect(m.activeBoard([{ key: 'whileunranked' }], 'W', 0)).toHaveLength(0);
  });
  test('it still counts when no rank chip is on', () => {
    expect(m.activeBoard([], 'W', 0)[0].s.len).toBe(3);
  });
});

describe('covering', () => {
  test('the cover comes from the margin and the line; a game without a line has none', () => {
    const P = payload([team('a'), team('b')], [
      { date: '1980-09-06', home: 0, away: 1, hs: 24, as: 14 },
      { date: '1980-09-13', home: 1, away: 0, hs: 20, as: 17 },
      { date: '1980-09-20', home: 0, away: 1, hs: 20, as: 21 },
      { date: '1980-09-27', home: 0, away: 1, hs: 30, as: 0 },
    ]);
    // home spreads in half-points: a favored by 7 at home, a +3 on the road, a -3 at home, unlined
    P.games.sp = [-14, -6, -6, NO_LINE];
    const g = createModel(P).gamesOf(0);
    expect(g.map((x) => x.cover)).toEqual(['W', 'P', 'L', null]);
    expect(g.map((x) => x.sp)).toEqual([-7, 3, -3, null]);
  });
});

describe('windows', () => {
  test('a team’s list starts at its latest major span', () => {
    const P = payload([team('a', [[1950, 1955], [1958, PRESENT]]), team('b')], [
      { date: '1954-10-02', home: 0, away: 1, hs: 7, as: 0 },
      { date: '1958-10-04', home: 0, away: 1, hs: 7, as: 0 },
    ]);
    const m = createModel(P);
    expect(m.windowStartOf(0)).toBe(1958);
    expect(m.gamesOf(0).map((g) => g.se)).toEqual([1958]);
    // the other side keeps both games
    expect(m.gamesOf(1)).toHaveLength(2);
  });

  test('only this season’s major teams hold streaks', () => {
    const P = payload([team('a'), team('b', [[1900, 1950]])], [{ date: '1954-10-02', home: 0, away: 1, hs: 7, as: 0 }]);
    const m = createModel(P);
    expect([...m.fbsNow]).toEqual([0]);
    expect(m.gamesOf(1)).toEqual([]);
  });
});

describe('openers and finales', () => {
  test('first and last regular-season game of each season', () => {
    const P = payload([team('a'), team('b')], [
      { date: '1950-09-23', home: 0, away: 1, hs: 7, as: 0 },
      { date: '1950-10-07', home: 0, away: 1, hs: 7, as: 0 },
      { date: '1950-11-25', home: 0, away: 1, hs: 7, as: 0 },
    ]);
    const g = createModel(P).gamesOf(0);
    expect(g.map((x) => [!!x.opener, !!x.finale])).toEqual([[true, false], [false, false], [false, true]]);
  });
});
