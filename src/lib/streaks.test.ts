import { describe, expect, test } from 'vitest';
import type { BoardRow, ChipRef, Dir, Result } from './types.ts';
import type { Chip } from './chips.ts';
import { conflicts } from './chips.ts';
import { activeRun, runsOf, matches, decided, OUTCOMES } from './streaks.ts';
import { P, teams, CHIPS, activeBoard, allTimeBoard } from './model.ts';
import { mineCrowns, LEN_FLOOR, FIELD_FLOOR } from './crowns.ts';

const today = Math.floor(Date.parse(P.builtAt) / 86400000);
const seq = (s: string) => [...s].map((r, i) => ({ r: r as Result, i }));

// a small seeded generator, so a failure reproduces
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const randomResults = (rand: () => number, n: number) => Array.from({ length: n }, () => { const x = rand(); return x < 0.47 ? 'W' : x < 0.94 ? 'L' : 'T'; }).join('');

describe('activeRun', () => {
  test('counts back from the last game', () => {
    expect(activeRun(seq('LWWW'), 'W')).toMatchObject({ dir: 'W', len: 3, atEdge: false });
    expect(activeRun(seq('WWW'), 'W')).toMatchObject({ dir: 'W', len: 3, atEdge: true, ender: null });
    expect(activeRun(seq('WLL'), 'L')!.ender!.i).toBe(0);
    expect(activeRun(seq('WLL'), 'W')).toBeNull();
    expect(activeRun([], 'W')).toBeNull();
  });

  test('a tie ends winning and losing runs', () => {
    expect(activeRun(seq('WWTW'), 'W')).toMatchObject({ len: 1 });
    expect(activeRun(seq('LLTL'), 'L')).toMatchObject({ len: 1 });
    expect(activeRun(seq('WWT'), 'W')).toBeNull();
  });

  test('a tie extends an unbeaten run; a loss ends it', () => {
    expect(activeRun(seq('LWTWT'), 'U')).toMatchObject({ dir: 'U', len: 4, atEdge: false });
    expect(activeRun(seq('TWW'), 'U')).toMatchObject({ len: 3, atEdge: true });
    expect(activeRun(seq('WWL'), 'U')).toBeNull();
  });

  test('matches a naive count on random sequences', () => {
    const rand = rng(7);
    for (let k = 0; k < 500; k++) {
      const s = randomResults(rand, 1 + Math.floor(rand() * 40));
      for (const o of OUTCOMES) {
        const re = o === 'U' ? /[WT]+$/ : new RegExp(`${o}+$`);
        const naive = s.length - s.replace(re, '').length;
        expect(activeRun(seq(s), o)?.len ?? 0).toBe(naive);
      }
    }
  });
});

describe('covering', () => {
  const g = (r: string, cover: string | null) => ({ r: r as Result, cover: cover as 'W' | 'L' | 'P' | null });
  test('a cover counts whatever the result; a push ends the run', () => {
    expect(activeRun([g('L', 'P'), g('L', 'W'), g('W', 'W')], 'C')).toMatchObject({ len: 2, atEdge: false });
    expect(activeRun([g('W', 'W'), g('W', 'P')], 'C')).toBeNull();
  });
  test('only lined games take part', () => {
    expect(decided('C', g('W', null))).toBe(false);
    expect(decided('W', g('W', null))).toBe(true);
  });
  test('every game in a covering run on the real boards has a line and covered it', () => {
    for (const def of [[], [{ key: 'road' }], [{ key: 'dog' }]] as ChipRef[][]) {
      for (const r of allTimeBoard(def, 'C', today).slice(0, 40)) {
        const run = r.qual.slice(r.s.startIdx, r.s.endIdx! + 1);
        expect(run.every((x) => x.sp != null && x.cover === 'W' && x.us - x.them + x.sp > 0)).toBe(true);
        if (r.ended) expect(r.ended.cover).not.toBe('W');
        expect(r.qual.every((x) => x.cover != null)).toBe(true);
      }
    }
  });
});

describe('runsOf', () => {
  test('maximal runs, in order', () => {
    expect(runsOf(seq('WWLWTWL'), 'W')).toEqual([[0, 1], [3, 3], [5, 5]]);
    expect(runsOf(seq('WWLWTWL'), 'U')).toEqual([[0, 1], [3, 5]]);
    expect(runsOf(seq('WWLWTWL'), 'L')).toEqual([[2, 2], [6, 6]]);
  });
  test('an unbeaten run covers every winning run inside it', () => {
    const rand = rng(9);
    for (let k = 0; k < 200; k++) {
      const s = seq(randomResults(rand, 30));
      const u = runsOf(s, 'U');
      for (const [a, b] of runsOf(s, 'W')) expect(u.some(([c, d]) => c <= a && b <= d)).toBe(true);
    }
  });
});

describe('boards', () => {
  const plain = CHIPS.filter((c) => !c.param);
  const rand = rng(11);
  const sample: ChipRef[][] = Array.from({ length: 60 }, () => {
    const def: Chip[] = [];
    for (let t = 0; t < 10 && def.length < 1 + Math.floor(rand() * 3); t++) {
      const c = plain[Math.floor(rand() * plain.length)];
      if (def.some((d) => d === c || conflicts(d, c))) continue;
      def.push(c);
    }
    return def.map((c) => ({ key: c.key }));
  });

  test('all-time runs of one team never overlap and each is maximal', () => {
    for (const def of sample.slice(0, 20)) {
      for (const dir of OUTCOMES) {
        const byTeam = new Map<number, BoardRow[]>();
        for (const r of allTimeBoard(def, dir, today)) (byTeam.get(r.ti) ?? byTeam.set(r.ti, []).get(r.ti)!).push(r);
        for (const runs of byTeam.values()) {
          runs.sort((a, b) => a.s.startIdx! - b.s.startIdx!);
          for (let i = 1; i < runs.length; i++) expect(runs[i].s.startIdx).toBeGreaterThan(runs[i - 1].s.endIdx! + 1);
          for (const r of runs) {
            if (r.s.startIdx! > 0) expect(matches(dir, r.qual[r.s.startIdx! - 1])).toBe(false);
            if (r.ended) expect(matches(dir, r.ended)).toBe(false);
          }
        }
      }
    }
  });

  test('a live all-time run is the team’s active streak', () => {
    for (const def of sample.slice(0, 20)) {
      for (const dir of OUTCOMES) {
        const active = new Map(activeBoard(def, dir, today).map((r) => [r.ti, r.s.len]));
        for (const r of allTimeBoard(def, dir, today).filter((x) => x.live)) expect(active.get(r.ti)).toBe(r.s.len);
      }
    }
  });

  test('adding a chip only removes qualifying games', () => {
    for (const def of sample.filter((d) => d.length >= 2).slice(0, 20)) {
      const wide = new Map(activeBoard(def.slice(0, -1), 'W', today).map((r) => [r.ti, r.qual.length]));
      for (const r of activeBoard(def, 'W', today)) if (wide.has(r.ti)) expect(r.qual.length).toBeLessThanOrEqual(wide.get(r.ti)!);
    }
  });
});

// crowns.js walks packed bitmasks; the boards walk game lists. They are
// independent implementations of the same semantics, so check one against the
// other: every crown's definition must put that team alone on top of the board.
describe('crowns agree with the boards', () => {
  for (const scope of ['active', 'all'] as const) {
    test(`${scope} crowns`, async () => {
      const cache = await mineCrowns(scope);
      const rand = rng(scope === 'all' ? 3 : 5);
      const picked = [];
      for (const [ti, list] of cache) for (const cr of list) if (rand() < 0.02) picked.push({ ti, cr });
      expect(picked.length).toBeGreaterThan(50);
      for (const { ti, cr } of picked) {
        const def = cr.chips.map((key) => ({ key }));
        const rows = scope === 'all'
          ? (() => { // an all-time board lists every run; the crown is the team's longest
            const best = new Map<number, BoardRow>();
            for (const r of allTimeBoard(def, cr.dir, today)) if (!best.has(r.ti) || r.s.len > best.get(r.ti)!.s.len) best.set(r.ti, r);
            return [...best.values()].sort((a, b) => b.s.len - a.s.len);
          })()
          : activeBoard(def, cr.dir, today);
        const label = `${teams[ti].id} ${cr.dir} ${cr.chips.join('+') || '(none)'}`;
        expect(teams[rows[0].ti].id, label).toBe(teams[ti].id);
        expect(rows[0].s.len, label).toBe(cr.len);
        expect(rows[1]?.s.len ?? 0, label).toBeLessThan(cr.len);
        expect(cr.len).toBeGreaterThanOrEqual(LEN_FLOOR);
        expect(rows.length).toBeGreaterThanOrEqual(FIELD_FLOOR);
        expect(cr.live, label).toBe(rows[0].live ?? true);
      }
    }, 60000);
  }
});
