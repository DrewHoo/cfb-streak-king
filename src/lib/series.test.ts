import { describe, expect, test } from 'vitest';
import { teams, fbsNow } from './model.ts';
import { seriesOf, seriesGames, seriesOpponents, hasSeries, SERIES_MIN } from './series.ts';
import { seriesLead, seriesIdsFromPath, seriesPath } from './seriesWords.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
// through the last finished season, so a new meeting doesn't move a gate: [W, L, T, games], a
// vacated win a game in neither record
const through = (a: string, b: string, se: number) => {
  const r = [0, 0, 0, 0];
  for (const g of seriesGames(idx(a), idx(b))) if (g.se <= se) { r[3]++; if (g.ruling !== 'vacated') r[g.r === 'W' ? 0 : g.r === 'L' ? 1 : 2]++; }
  return r;
};

describe('series: every meeting, back to the first', () => {
  test('the famous counts, through 2025', () => {
    // Alabama–Tennessee: Alabama's 1993 tie forfeited to Tennessee, its 2005 win vacated
    expect(through('alabama', 'tennessee', 2025)).toEqual([60, 40, 7, 108]);
    expect(seriesOf(idx('alabama'), idx('tennessee'))!.since).toBe(1901);
    // Ohio State's 2010 win vacated
    expect(through('michigan', 'ohio-state', 2025)).toEqual([62, 52, 6, 121]);
    expect(seriesOf(idx('michigan'), idx('ohio-state'))!.since).toBe(1897);
    // the first Iron Bowl was February 1893, in the 1892 season
    expect(through('alabama', 'auburn', 2025)).toEqual([52, 37, 1, 90]);
    expect(seriesOf(idx('alabama'), idx('auburn'))!.since).toBe(1893);
    // Utah counts the 1896–98 games against Brigham Young Academy, and BYU doesn't
    expect(through('utah', 'byu', 2025)).toEqual([62, 37, 4, 103]);
    expect(seriesOf(idx('utah'), idx('byu'))!.since).toBe(1896);
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
    const lead = seriesLead('Alabama', 'Tennessee', [60, 41, 7], 109, 1901, { r: 'L', len: 1 }, { us: 10, them: 26, se: 2026 });
    expect(lead).toBe('Alabama leads Tennessee 60-41-7 in 109 games since their first meeting in 1901. Tennessee won the last meeting, 26-10 in 2026.');
    expect(seriesLead('Army', 'Navy', [55, 63, 7], 125, 1891, { r: 'L', len: 2 }, { us: 16, them: 17, se: 2025 })).toBe('Navy leads Army 63-55-7 in 125 games since their first meeting in 1891. Navy has won the last 2, most recently 17-16 in 2025.');
    // the page is the series', so its two addresses say the same sentence
    expect(seriesLead('Tennessee', 'Alabama', [41, 60, 7], 109, 1901, { r: 'W', len: 1 }, { us: 26, them: 10, se: 2026 })).toBe(lead);
    expect(seriesLead('Navy', 'Army', [55, 55, 7], 117, 1891, { r: 'T', len: 1 }, { us: 7, them: 7, se: 1950 })).toBe('Navy and Army are tied 55-55-7 in 117 games since their first meeting in 1891. The last meeting was a 7-7 tie in 1950.');
  });

  test('the address', () => {
    expect(seriesPath('alabama', 'tennessee')).toBe('team/alabama/vs/tennessee/');
    expect(seriesIdsFromPath('/cfb-streak-king/team/alabama/vs/tennessee/')).toEqual({ id: 'alabama', opp: 'tennessee' });
    expect(seriesIdsFromPath('/cfb-streak-king/team/alabama/vs/alabama/')).toBeNull();
  });
});
