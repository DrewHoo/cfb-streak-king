import { describe, expect, test } from 'vitest';
import { teams, fbsNow } from './model.ts';
import { seriesOf, seriesGames, seriesOpponents, hasSeries, SERIES_MIN } from './series.ts';
import { seriesLead, seriesIdsFromPath, seriesPath } from './seriesWords.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
// through the last finished season, so a new meeting doesn't move a gate
const through = (a: string, b: string, se: number) => {
  const r = [0, 0, 0];
  for (const g of seriesGames(idx(a), idx(b))) if (g.se <= se) r[g.r === 'W' ? 0 : g.r === 'L' ? 1 : 2]++;
  return r;
};

describe('series: every meeting, back to the first one jhowell.net has', () => {
  test('known answers, as played, through 2025', () => {
    // Tennessee's own count; Alabama's and Wikipedia's take the forfeits and vacated wins out
    expect(through('alabama', 'tennessee', 2025)).toEqual([61, 39, 7]);
    expect(through('michigan', 'ohio-state', 2025)).toEqual([62, 53, 6]);
    expect(seriesOf(idx('alabama'), idx('tennessee'))!.since).toBe(1903);
    expect(seriesOf(idx('michigan'), idx('ohio-state'))!.since).toBe(1897);
  });

  test('the two sides are one series read both ways', () => {
    const a = seriesOf(idx('army'), idx('navy'))!, b = seriesOf(idx('navy'), idx('army'))!;
    expect(a.rec).toEqual([b.rec[1], b.rec[0], b.rec[2]]);
    expect(a.site.home).toEqual([b.site.away[1], b.site.away[0], b.site.away[2]]);
    expect(a.longest.W?.len).toBe(b.longest.L?.len);
    expect(a.games.length).toBe(b.games.length);
  });

  test('a page is two FBS teams that have met SERIES_MIN times, both ways', () => {
    for (const ti of [...fbsNow].slice(0, 30)) {
      for (const { oi, n } of seriesOpponents(ti)) {
        expect(n).toBeGreaterThanOrEqual(SERIES_MIN);
        expect(fbsNow.has(oi)).toBe(true);
        expect(hasSeries(oi, ti)).toBe(true);
        expect(seriesGames(ti, oi).length).toBe(n);
      }
    }
  });

  test('the lead says the record, the games, the first year, and the last meeting', () => {
    const lead = seriesLead('Alabama', 'Tennessee', [61, 40, 7], 1903, { r: 'L', len: 1 }, { us: 10, them: 26, se: 2026 });
    expect(lead).toBe('Alabama leads Tennessee 61-40-7 in 108 games since 1903. Tennessee won the last meeting, 26-10 in 2026.');
    expect(seriesLead('Army', 'Navy', [55, 63, 7], 1891, { r: 'L', len: 2 }, { us: 16, them: 17, se: 2025 })).toBe('Army trails Navy 55-63-7 in 125 games since 1891. Navy has won the last 2, most recently 17-16 in 2025.');
  });

  test('the address', () => {
    expect(seriesPath('alabama', 'tennessee')).toBe('team/alabama/vs/tennessee/');
    expect(seriesIdsFromPath('/cfb-streak-king/team/alabama/vs/tennessee/')).toEqual({ id: 'alabama', opp: 'tennessee' });
    expect(seriesIdsFromPath('/cfb-streak-king/team/alabama/vs/alabama/')).toBeNull();
  });
});
