import { describe, expect, test } from 'vitest';
import { brokenWeeks, brokenDigest, completedWeeks, brokenClaim, everText, BROKEN_CAP, BROKEN_CUTOFF } from './broken.ts';
import { LIST } from './list.ts';
import { mineBroken } from './crowns.ts';
import { P, teams, fbsNow, gamesOf } from './model.ts';
import { qualifies } from './chips.ts';
import { minedChipByKey, refsOf } from './minedChips.ts';
import { matches, decided } from './streaks.ts';
import { LEN_FLOOR, SHEET_DIRS } from './team.ts';

// the module's week grid: Tuesday through Monday, 1970-01-06 a Tuesday
const weekIdx = (ep: number) => Math.floor((ep - 5) / 7);

const weeks = brokenWeeks(await mineBroken());
const lastWk = completedWeeks().at(-1)?.wk ?? null;
// the last week's digest as the page shows it: the list rule over the build's rows
const broken = lastWk == null || !weeks.get(lastWk) ? null : brokenDigest(weeks.get(lastWk)!);
const allRows = broken ? [...broken.list, ...broken.more] : [];

describe('brokenWeeks', () => {
  test('the last week covers the last completed week: current-season games, all in one Tuesday–Monday span', () => {
    if (!broken) return; // a preseason payload has no completed week
    const se = P.games.se;
    const last = P.games.ep[se.length - 1];
    expect(se[se.length - 1]).toBe(P.currentSeason);
    expect(broken.hi).toBe(last);
    expect(weekIdx(broken.lo)).toBe(weekIdx(broken.hi));
    expect(allRows.length).toBeGreaterThan(0);
    for (const b of allRows) {
      expect(b.ender.se).toBe(P.currentSeason);
      expect(weekIdx(b.ender.ep)).toBe(weekIdx(broken.hi));
    }
  });

  test('only a run the list rule admits (its place within the admit knob as the week began, or the all-time longest) is in a digest', () => {
    for (const w of weeks.values()) {
      const d = brokenDigest(w);
      for (const b of [...d.list, ...d.more, ...d.subStreaks]) expect(b.rank <= LIST.admit.rank || b.len >= b.everLen).toBe(true);
    }
  });

  test('the digest is capped, cut off, sorted best first, and names a team once', () => {
    if (!broken) return;
    expect(broken.list.length).toBeLessThanOrEqual(BROKEN_CAP);
    expect(new Set(broken.list.map((b) => b.ti)).size).toBe(broken.list.length);
    for (let i = 1; i < broken.list.length; i++) {
      expect(broken.list[i - 1].score).toBeGreaterThanOrEqual(broken.list[i].score);
    }
    for (const b of broken.list) {
      expect(b.score).toBeGreaterThanOrEqual(BROKEN_CUTOFF);
      expect(b.len).toBeGreaterThanOrEqual(LEN_FLOOR);
      expect(b.scope).toBe('all');
      expect(SHEET_DIRS).toContain(b.dir);
    }
  });

  test('"more" holds the rest in order: below the cut, past the cap, or a team’s further run', () => {
    if (!broken) return;
    for (let i = 1; i < broken.more.length; i++) expect(broken.more[i - 1].score).toBeGreaterThanOrEqual(broken.more[i].score);
    const listed = new Set(broken.list.map((b) => b.ti));
    for (const b of broken.more) {
      expect(b.score < BROKEN_CUTOFF || broken.list.length === BROKEN_CAP || listed.has(b.ti)).toBe(true);
      expect(b.len).toBeGreaterThanOrEqual(LEN_FLOOR);
    }
    // a run in "more" never outscores a later-listed row of a team not yet listed: the digest took the best of note
    for (const b of broken.more) if (!listed.has(b.ti) && b.score >= BROKEN_CUTOFF) expect(broken.list.length).toBe(BROKEN_CAP);
  });

  test('each run re-derives from the team’s games: len straight, then the ender; every key decodes', () => {
    if (!broken) return;
    for (const b of allRows) {
      expect(refsOf(b.chips).length).toBe(b.chips.length);
      const chips = b.chips.map((k) => minedChipByKey.get(k)!);
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

  test('one placing per broken run: no two rows share a team, direction, ender, start and length; a different run the same game ended stands', () => {
    if (!broken) return;
    const keys = allRows.map((b) => `${b.ti}|${b.dir}|${b.ender.i}|${b.run}|${b.len}`);
    expect(new Set(keys).size).toBe(keys.length);
    const byEnder = new Map<string, number>();
    for (const b of allRows) { const k = `${b.ti}|${b.dir}|${b.ender.i}`; byEnder.set(k, (byEnder.get(k) ?? 0) + 1); }
    expect(Math.max(...byEnder.values())).toBeGreaterThan(1);
  });

  test('a venue-state run never counts a game in the team’s own state', () => {
    for (const b of allRows) {
      const st = b.chips.find((k) => k.startsWith('state:'))?.slice(6);
      if (st) expect(teams[b.ti].st).not.toBe(st);
    }
  });

  test('every completed week has a digest whose enders sit inside it', () => {
    const list = completedWeeks();
    if (!list.length) return;
    for (let i = 1; i < list.length; i++) expect(list[i].w).toBeGreaterThan(list[i - 1].w);
    expect(list.at(-1)!.hi).toBe(P.games.ep[P.games.ep.length - 1]);
    for (const w of list.filter((x) => x.wk != null)) {
      const d = weeks.get(w.wk!)!;
      expect(d.wk).toBe(w.wk);
      for (const b of d.rows) {
        expect(b.ender.ep).toBeGreaterThanOrEqual(w.lo);
        expect(b.ender.ep).toBeLessThanOrEqual(w.hi);
        expect(b.len).toBeGreaterThanOrEqual(LEN_FLOOR);
        expect(brokenClaim(b)).toContain(teams[b.ti].name);
      }
    }
  });

  test('the rank entering the week holds against every team’s run then', () => {
    if (!broken) return;
    const wlo = weekIdx(broken.hi) * 7 + 5; // the week's Tuesday
    for (const b of allRows.slice(0, 40)) {
      const chips = b.chips.map((k) => minedChipByKey.get(k)!);
      let longer = 0, level = 0, field = 0, second = 0;
      for (const ti of fbsNow) {
        const qual = gamesOf(ti).filter((g) => g.ep < wlo && chips.every((c) => qualifies(c, g)) && decided(b.dir, g));
        let i = qual.length - 1;
        while (i >= 0 && matches(b.dir, qual[i])) i--;
        const len = qual.length - 1 - i;
        if (len) field++;
        if (len > b.len) longer++;
        if (len === b.len) level++;
        if (ti !== b.ti && len > second) second = len;
      }
      expect(b.rank).toBe(1 + longer);
      expect(b.tied).toBe(level);
      expect(b.field).toBe(field);
      expect(b.second).toBe(second);
    }
  });

  test('the longest ever under the definition holds against every team’s longest run, so "now the all-time longest" is earned', () => {
    if (!broken) return;
    for (const b of allRows.slice(0, 20)) {
      const chips = b.chips.map((k) => minedChipByKey.get(k)!);
      let ever = 0, n = 0;
      for (const ti of fbsNow) {
        const qual = gamesOf(ti).filter((g) => chips.every((c) => qualifies(c, g)) && decided(b.dir, g));
        let best = 0, run = 0;
        for (const g of qual) { run = matches(b.dir, g) ? run + 1 : 0; if (run > best) best = run; }
        if (best > ever) { ever = best; n = 1; } else if (best && best === ever) n++;
      }
      expect(b.everLen).toBe(ever);
      expect(b.everN).toBe(n);
      expect(b.len).toBeLessThanOrEqual(b.everLen);
    }
  });

  test('the all-time label: only a run as long as the longest ever, tied when another team’s matches it', () => {
    expect(everText({ len: 9, everLen: 12, everN: 1 })).toBeNull();
    expect(everText({ len: 12, everLen: 12, everN: 1 })).toBe('now the all-time longest streak');
    expect(everText({ len: 12, everLen: 12, everN: 2 })).toBe('now tied for the all-time longest');
  });
});
