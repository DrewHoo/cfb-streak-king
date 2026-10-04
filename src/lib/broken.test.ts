import { describe, expect, test } from 'vitest';
import { brokenLastWeek, BROKEN_CAP, BROKEN_CUTOFF } from './broken.ts';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { chipByKey, qualifies } from './chips.ts';
import { matches, decided } from './streaks.ts';
import { LEN_FLOOR } from './team.ts';

// the module's week grid: Tuesday through Monday, 1970-01-06 a Tuesday
const weekIdx = (ep: number) => Math.floor((ep - 5) / 7);

const broken = brokenLastWeek();

describe('brokenLastWeek', () => {
  test('covers the last completed week: current-season games, all in one Tuesday–Monday span', () => {
    if (!broken) return; // a preseason payload has no completed week
    const se = P.games.se;
    const last = P.games.ep[se.length - 1];
    expect(se[se.length - 1]).toBe(P.currentSeason);
    expect(broken.hi).toBe(last);
    expect(weekIdx(broken.lo)).toBe(weekIdx(broken.hi));
    for (const b of broken.list) {
      expect(b.ender.se).toBe(P.currentSeason);
      expect(weekIdx(b.ender.ep)).toBe(weekIdx(broken.hi));
    }
  });

  test('the digest is capped, cut off, and sorted best first', () => {
    if (!broken) return;
    expect(broken.list.length).toBeLessThanOrEqual(BROKEN_CAP);
    for (let i = 1; i < broken.list.length; i++) {
      expect(broken.list[i - 1].score).toBeGreaterThanOrEqual(broken.list[i].score);
    }
    for (const b of broken.list) {
      expect(b.score).toBeGreaterThanOrEqual(BROKEN_CUTOFF);
      expect(b.len).toBeGreaterThanOrEqual(LEN_FLOOR);
      expect(b.scope).toBe('all');
    }
  });

  test('each plain run re-derives from the team’s games: len straight, then the ender', () => {
    if (!broken) return;
    for (const b of broken.list.filter((x) => x.vs == null)) {
      const chips = b.chips.map((k) => chipByKey.get(k)!);
      const qual = gamesOf(b.ti).filter((g) => chips.every((c) => qualifies(c, g)) && decided(b.dir, g));
      const at = qual.indexOf(b.ender);
      expect(at).toBeGreaterThanOrEqual(b.len);
      expect(matches(b.dir, b.ender)).toBe(false);
      for (let i = at - b.len; i < at; i++) expect(matches(b.dir, qual[i])).toBe(true);
      // maximal: the game before the run (if any) misses, and the run's start names it
      if (at - b.len > 0) expect(matches(b.dir, qual[at - b.len - 1])).toBe(false);
      else expect(b.atEdge).toBe(true);
      expect(qual[at - b.len].ep).toBe(b.run);
      expect(qual[at - b.len].se).toBe(b.since);
    }
  });

  test('each head-to-head run re-derives from the meetings, and no mirror is told twice', () => {
    if (!broken) return;
    const h2h = broken.list.filter((x) => x.vs != null);
    for (const b of h2h) {
      expect(b.chips).toEqual(['vsteam']);
      const ms = gamesOf(b.ti).filter((g) => g.oppIdx === b.vs);
      const at = ms.indexOf(b.ender);
      expect(at).toBeGreaterThanOrEqual(b.len);
      expect(matches(b.dir, b.ender)).toBe(false);
      for (let i = at - b.len; i < at; i++) expect(matches(b.dir, ms[i])).toBe(true);
      // a broken losing run only stands when the winner's side can't be told
      if (b.dir === 'L') expect(gamesOf(b.vs!).length).toBe(0);
    }
  });

  test('one telling per broken run: no two plain rows share a team, direction and ender', () => {
    if (!broken) return;
    const plain = broken.list.filter((x) => x.vs == null);
    const keys = plain.map((b) => `${b.ti}|${b.dir}|${b.ender.i}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('the rank entering the week holds against every team’s run then', () => {
    if (!broken) return;
    const wlo = weekIdx(broken.hi) * 7 + 5; // the week's Tuesday
    for (const b of broken.list.filter((x) => x.vs == null)) {
      const chips = b.chips.map((k) => chipByKey.get(k)!);
      let longer = 0;
      for (const ti of fbsNow) {
        const qual = gamesOf(ti).filter((g) => g.ep < wlo && chips.every((c) => qualifies(c, g)) && decided(b.dir, g));
        let i = qual.length - 1;
        while (i >= 0 && matches(b.dir, qual[i])) i--;
        if (qual.length - 1 - i > b.len) longer++;
      }
      expect(b.rank).toBe(1 + longer);
    }
  });
});
