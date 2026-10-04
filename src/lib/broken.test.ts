import { describe, expect, test } from 'vitest';
import { brokenLastWeek, brokenWeek, completedWeeks, brokenClaim, BROKEN_CAP, BROKEN_CUTOFF } from './broken.ts';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { chipByKey, qualifies } from './chips.ts';
import { matches, decided } from './streaks.ts';
import { LEN_FLOOR, fitsSite } from './team.ts';

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

  test('each head-to-head run re-derives from the meetings its chips keep, and no mirror is told twice', () => {
    if (!broken) return;
    const h2h = broken.list.filter((x) => x.vs != null);
    for (const b of h2h) {
      expect(b.chips).toContain('vsteam');
      const site = b.chips.includes('home') ? 'home' : b.chips.includes('road') ? 'road' : null;
      const ms = gamesOf(b.ti).filter((g) => g.oppIdx === b.vs && fitsSite(site, g));
      const at = ms.indexOf(b.ender);
      expect(at).toBeGreaterThanOrEqual(b.len);
      expect(matches(b.dir, b.ender)).toBe(false);
      for (let i = at - b.len; i < at; i++) expect(matches(b.dir, ms[i])).toBe(true);
      // a broken losing run only stands when the winner's side can't be told
      if (b.dir === 'L') expect(gamesOf(b.vs!).length).toBe(0);
    }
  });

  test('one telling per broken run: no two rows share a team, direction and ender', () => {
    if (!broken) return;
    const keys = broken.list.map((b) => `${b.vs == null ? 'plain' : 'h2h'}|${b.ti}|${b.dir}|${b.ender.i}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every completed week has a digest whose enders sit inside it, and the last is brokenLastWeek', () => {
    const weeks = completedWeeks();
    if (!weeks.length) return;
    for (let i = 1; i < weeks.length; i++) expect(weeks[i].w).toBeGreaterThan(weeks[i - 1].w);
    expect(weeks.at(-1)!.hi).toBe(P.games.ep[P.games.ep.length - 1]);
    for (const w of weeks.filter((x) => x.wk != null)) {
      const d = brokenWeek(w.wk!)!;
      expect(d.wk).toBe(w.wk);
      for (const b of d.list) {
        expect(b.ender.ep).toBeGreaterThanOrEqual(w.lo);
        expect(b.ender.ep).toBeLessThanOrEqual(w.hi);
        expect(b.len).toBeGreaterThanOrEqual(LEN_FLOOR);
        expect(brokenClaim(b)).toContain(teams[b.ti].name);
      }
    }
    if (weeks.at(-1)!.wk != null) expect(brokenLastWeek()).toBe(brokenWeek(weeks.at(-1)!.wk!));
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
