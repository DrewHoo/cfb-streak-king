import { describe, expect, test } from 'vitest';
import { buildBreakers, breakersFromSeason, rankOrder, breakCat, breakPoints, breakSummary, breakRanking, breakRows, encodeBreakers, decodeBreakers, breakersSlice, BREAK } from './breakers.ts';
import { mineBroken, HIST_CHIPS } from './crowns.ts';
import { buildSeasons } from './seasons.ts';
import { keyOf, keyString } from './game.ts';
import { P, teams, gamesOf } from './model.ts';
import { baseDir } from './outcome.ts';
import { minedChipByKey } from './minedChips.ts';
import { qualifies } from './chips.ts';
import { matches, decided } from './streaks.ts';

const mined = await mineBroken();
const breakers = buildBreakers(mined);
const ranking = breakRanking(breakers);

describe('breakers', () => {
  test('every break is a run the breaker ended by beating its owner, this season, under the covering flag', () => {
    expect(breakers.season).toBe(P.currentSeason);
    for (const [breaker, rows] of breakers.teams) {
      for (const b of rows) {
        expect(b.ender.oppIdx).toBe(breaker);
        expect(b.ender.se).toBe(P.currentSeason);
        if (b.dir === 'C') expect(b.ender.cover).toBe('L');
        else { expect(baseDir(b.dir)).toBe('W'); expect(b.ender.r).toBe('L'); }
      }
      if (!BREAK.covers) for (const b of breakRows(rows)) expect(b.dir).not.toBe('C');
    }
  });

  test('only the all-time longest and the field leaders count; the all-time longest first, each by score; a sub-streak sits behind its run', () => {
    const order = { alltime: 0, leading: 1 };
    for (const rows of breakers.teams.values()) {
      for (const b of rows) expect(breakCat(b)).not.toBeNull();
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1], b = rows[i];
        expect(order[breakCat(a)!] <= order[breakCat(b)!]).toBe(true);
        if (breakCat(a) === breakCat(b)) expect(a.score).toBeGreaterThanOrEqual(b.score);
      }
      for (const b of rows) if (b.dup) expect(rows.some((o) => !o.dup && o.ti === b.ti && o.dir === b.dir && o.len >= b.len && o.chips.length < b.chips.length && o.chips.every((k) => b.chips.includes(k)))).toBe(true);
    }
  });

  test('a category re-derives from the games: the longest ever under the definition, else the field leader', () => {
    for (const s of ranking.slice(0, 3)) {
      for (const b of breakRows(breakers.teams.get(s.ti)!).filter((x) => !x.dup).slice(0, 4)) {
        const chips = b.chips.map((k) => minedChipByKey.get(k)!);
        let ever = 0;
        for (let ti = 0; ti < teams.length; ti++) {
          const qual = gamesOf(ti).filter((g) => chips.every((c) => qualifies(c, g)) && decided(b.dir, g));
          let run = 0;
          for (const g of qual) { run = matches(b.dir, g) ? run + 1 : 0; if (run > ever) ever = run; }
        }
        expect(b.everLen).toBe(ever);
        expect(breakCat(b)).toBe(b.len >= ever ? 'alltime' : b.rank === 1 ? 'leading' : null);
      }
    }
  });

  test('points: the base by category over one plus the discount per condition; a summary tallies standing rows only', () => {
    const b = { len: 9, everLen: 9, rank: 1, chips: ['home', 'night'] };
    expect(breakPoints(b)).toBeCloseTo(BREAK.points.alltime / (1 + BREAK.discount * 2));
    expect(breakPoints({ ...b, everLen: 12 })).toBeCloseTo(BREAK.points.leading / 2);
    expect(breakPoints({ ...b, everLen: 12, rank: 3, chips: [] })).toBe(0);
    const top = ranking[0];
    if (!top) return;
    const rows = breakRows(breakers.teams.get(top.ti)!);
    const standing = rows.filter((r) => !r.dup);
    expect(top.n).toBe(standing.length);
    expect(top.points).toBeCloseTo(standing.reduce((a, r) => a + breakPoints(r), 0));
    expect(top.by.alltime + top.by.leading).toBe(top.n);
    expect(top.victims.reduce((a, [, n]) => a + n, 0)).toBe(top.n);
    for (let i = 1; i < top.victims.length; i++) expect(top.victims[i - 1][1]).toBeGreaterThanOrEqual(top.victims[i][1]);
    for (let i = 1; i < ranking.length; i++) expect(ranking[i - 1].points).toBeGreaterThanOrEqual(ranking[i].points - 1e-9); // a tie compares rounded (rankOrder)
    expect(breakers.ranks.get(top.ti)).toBe(1);
    expect(breakSummary(top.ti, []).n).toBe(0);
  });

  test('a game’s broken count holds every break the breakers credit for it, row for row', () => {
    const season = buildSeasons(mined).get(P.currentSeason);
    if (!season) return;
    const id = (b: { ti: number; dir: string; chips: string[] }) => `${b.ti}|${b.dir}|${b.chips.join('+')}`;
    for (const rows of breakers.teams.values()) {
      for (const b of breakRows(rows)) {
        const game = season.games.get(keyString(keyOf(b.ti, b.ender)));
        expect(game).toBeDefined();
        const same = game!.ended.find((x) => id(x) === id(b));
        expect(same).toBeDefined();
        expect(same!.dup).toBe(b.dup); // one telling per run on both pages, so the standing counts nest
      }
    }
  });

  test('a past season builds from its season file the same way: every break a win of the breaker’s, ranked by points', () => {
    const se = P.currentSeason - 1;
    const past = breakersFromSeason(buildSeasons(mined).get(se), se);
    expect(past.season).toBe(se);
    const ranking = breakRanking(past);
    expect(ranking.length).toBeGreaterThan(0);
    for (const [breaker, rows] of past.teams) {
      for (const b of rows) {
        expect(b.ender.oppIdx).toBe(breaker);
        expect(b.ender.se).toBe(se);
        expect(breakCat(b)).not.toBeNull();
        if (b.dir !== 'C') { expect(baseDir(b.dir)).toBe('W'); expect(b.ender.r).toBe('L'); }
        // two-chip definitions before the running season
        expect(b.chips.length).toBeLessThanOrEqual(HIST_CHIPS);
      }
    }
    for (let i = 1; i < ranking.length; i++) expect(ranking[i - 1].points).toBeGreaterThanOrEqual(ranking[i].points - 1e-9); // a tie compares rounded (rankOrder)
    ranking.forEach((s, i) => expect(past.ranks.get(s.ti)).toBe(i + 1));
    expect(breakersFromSeason(undefined, 1950).teams.size).toBe(0);
  });

  test('a tie in points falls the same way however the points were summed: then breaks, then the team', () => {
    const a = { ti: 7, n: 4, points: 0.1 + 0.2 }, b = { ti: 3, n: 4, points: 0.3 };
    expect(a.points === b.points).toBe(false); // the float noise the page and the worker can differ by
    expect([a, b].sort(rankOrder).map((x) => x.ti)).toEqual([3, 7]);
    expect([b, a].sort(rankOrder).map((x) => x.ti)).toEqual([3, 7]);
    expect([{ ti: 1, n: 3, points: 5 }, { ti: 2, n: 4, points: 5 }].sort(rankOrder).map((x) => x.ti)).toEqual([2, 1]);
  });

  test('the file round-trips, and a slice carries one team’s rows and rank', () => {
    const back = decodeBreakers(JSON.parse(JSON.stringify(encodeBreakers(breakers))));
    expect(back.complete).toBe(true);
    expect(back.teams.size).toBe(breakers.teams.size);
    for (const [ti, rows] of breakers.teams) {
      const got = back.teams.get(ti)!;
      expect(got.length).toBe(rows.length);
      got.forEach((g, i) => expect(g).toMatchObject({ ti: rows[i].ti, chips: rows[i].chips, dir: rows[i].dir, len: rows[i].len, everLen: rows[i].everLen, everN: rows[i].everN, dup: rows[i].dup }));
    }
    expect(back.ranks).toEqual(breakers.ranks);
    const top = ranking[0];
    if (!top) return;
    const slice = decodeBreakers(JSON.parse(JSON.stringify(encodeBreakers(breakersSlice(breakers, top.ti)))));
    expect(slice.complete).toBe(false);
    expect([...slice.teams.keys()]).toEqual([top.ti]);
    expect(slice.ranks.get(top.ti)).toBe(1);
    expect([...breakersSlice(breakers, -1).teams.get(-1)!]).toEqual([]);
  });
});
