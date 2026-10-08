import { describe, expect, test } from 'vitest';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { UNPLAYED, CHOSE, RULED, KIND_WORDS, classOf, preservedStreaks, unplayedFor, unplayedInRun } from './unplayed.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);

describe('unplayed postseasons', () => {
  test('every row names a current FBS team and a season it played no postseason game in', () => {
    for (const r of UNPLAYED) {
      const ti = idx(r.team);
      expect(ti, r.team).toBeGreaterThanOrEqual(0);
      expect(fbsNow.has(ti), r.team).toBe(true);
      const year = gamesOf(ti).filter((g) => g.se === r.season);
      expect(year.length, `${r.team} ${r.season}`).toBeGreaterThan(0);
      // a "played" row is a data bug the row records; every other kind says no postseason game was played
      if (r.kind !== 'played') expect(year.some((g) => g.post), `${r.team} ${r.season} has a postseason game`).toBe(false);
      expect(r.season).toBeLessThan(P.currentSeason);
    }
  });

  test('every row carries at least one receipt with a url and a verbatim quote, and a known kind', () => {
    for (const r of UNPLAYED) {
      expect(r.receipts.length, `${r.team} ${r.season}`).toBeGreaterThan(0);
      for (const x of r.receipts) {
        expect(x.url).toMatch(/^https?:\/\//);
        expect(x.quote.trim().length).toBeGreaterThan(10);
      }
      expect(Object.keys(KIND_WORDS)).toContain(r.kind);
      expect(r.summary.length).toBeGreaterThan(10);
    }
  });

  test('no team-season is ruled twice', () => {
    const keys = UNPLAYED.map((r) => `${r.team}|${r.season}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('the two classes are disjoint and never hold the kinds that preserve nothing', () => {
    for (const k of CHOSE) expect(RULED.has(k)).toBe(false);
    expect(classOf('not-invited')).toBeNull();
    expect(classOf('canceled')).toBeNull();
    expect(classOf('declined')).toBe('chose');
    expect(classOf('no-repeat')).toBe('ruled');
  });

  test('a ruling of either class inside a run that goes on is a preserved streak; one that ends the same season is not', () => {
    const list = [...preservedStreaks('chose'), ...preservedStreaks('ruled')];
    for (const s of list) {
      expect(s.len).toBeGreaterThan(0);
      expect(s.seasons.length).toBeGreaterThan(0);
      const cls = classOf(s.seasons[0].kind);
      for (const r of s.seasons) {
        expect(classOf(r.kind)).toBe(cls);
        expect(r.season).toBeGreaterThanOrEqual(s.startSe);
        // the missing game sits before the run's last season, or the run was broken in a later one
        expect(r.season < s.endSe || !s.live).toBe(true);
        expect(unplayedFor(s.ti, r.season)).toBe(r);
      }
    }
    // longest first within a class
    for (const cls of ['chose', 'ruled'] as const) {
      const l = preservedStreaks(cls);
      for (let i = 1; i < l.length; i++) expect(l[i - 1].len).toBeGreaterThanOrEqual(l[i].len);
    }
    // every ruling of either class that a run lived through shows up, and the panel's join agrees
    const seen = new Set(list.flatMap((s) => s.seasons.map((r) => `${r.team}|${r.season}`)));
    for (const r of UNPLAYED) {
      if (classOf(r.kind) == null) continue;
      const ti = idx(r.team);
      const gs = gamesOf(ti);
      const lastOfSeason = gs.filter((g) => g.se === r.season).at(-1)!;
      const nextSeason = gs.find((g) => g.se > r.season);
      // the season ended on a win, and the next season opened with one: the run lived through the gap
      if (lastOfSeason.r === 'W' && nextSeason?.r === 'W') {
        expect(seen.has(`${r.team}|${r.season}`), `${r.team} ${r.season}`).toBe(true);
        expect(unplayedInRun(ti, [lastOfSeason, nextSeason], null)).toContain(r);
      }
    }
  });
});
