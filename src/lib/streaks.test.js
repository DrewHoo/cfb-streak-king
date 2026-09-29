import { describe, expect, test } from 'vitest';
import { currentStreak } from './streaks.js';
import { P, teams, CHIPS, board, allTimeBoard } from './model.js';
import { mineAll, LEN_FLOOR, FIELD_FLOOR } from './crowns.js';

const today = Math.floor(Date.parse(P.builtAt) / 86400000);
const seq = (s) => [...s].map((r, i) => ({ r, i }));

// a small seeded generator, so a failure reproduces
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const randomResults = (rand, n) => Array.from({ length: n }, () => { const x = rand(); return x < 0.47 ? 'W' : x < 0.94 ? 'L' : 'T'; }).join('');

describe('currentStreak', () => {
  test('counts back from the last game', () => {
    expect(currentStreak(seq('LWWW'))).toMatchObject({ dir: 'W', len: 3, atEdge: false });
    expect(currentStreak(seq('WWW'))).toMatchObject({ dir: 'W', len: 3, atEdge: true, ender: null });
    expect(currentStreak(seq('WLL')).ender.i).toBe(0);
    expect(currentStreak([])).toBeNull();
  });

  test('a tie ends a run in both directions', () => {
    expect(currentStreak(seq('WWTW'))).toMatchObject({ dir: 'W', len: 1 });
    expect(currentStreak(seq('LLTL'))).toMatchObject({ dir: 'L', len: 1 });
    expect(currentStreak(seq('WWT'))).toMatchObject({ dir: 'T', len: 1 });
  });

  test('matches a naive count on random sequences', () => {
    const rand = rng(7);
    for (let k = 0; k < 500; k++) {
      const s = randomResults(rand, 1 + Math.floor(rand() * 40));
      const last = s.at(-1);
      const naive = s.length - s.replace(new RegExp(`${last}+$`), '').length;
      expect(currentStreak(seq(s)).len).toBe(naive);
    }
  });
});

describe('boards', () => {
  const plain = CHIPS.filter((c) => !c.param);
  const rand = rng(11);
  const sample = Array.from({ length: 60 }, () => {
    const def = [];
    for (let t = 0; t < 10 && def.length < 1 + Math.floor(rand() * 3); t++) {
      const c = plain[Math.floor(rand() * plain.length)];
      if (def.some((d) => d === c || (d.x && c.x && d.group === c.group))) continue;
      def.push(c);
    }
    return def.map((c) => ({ key: c.key }));
  });

  test('all-time runs of one team never overlap and each is maximal', () => {
    for (const def of sample) {
      for (const dir of ['W', 'L']) {
        const byTeam = new Map();
        for (const r of allTimeBoard(def, dir, today)) (byTeam.get(r.ti) ?? byTeam.set(r.ti, []).get(r.ti)).push(r);
        for (const runs of byTeam.values()) {
          runs.sort((a, b) => a.s.startIdx - b.s.startIdx);
          for (let i = 1; i < runs.length; i++) expect(runs[i].s.startIdx).toBeGreaterThan(runs[i - 1].s.endIdx + 1);
          for (const r of runs) {
            if (r.s.startIdx > 0) expect(r.qual[r.s.startIdx - 1].r).not.toBe(dir);
            if (r.ended) expect(r.ended.r).not.toBe(dir);
          }
        }
      }
    }
  });

  test('a live all-time run is the team’s active streak', () => {
    for (const def of sample.slice(0, 20)) {
      for (const dir of ['W', 'L']) {
        const active = new Map(board(def, dir, 'games', today).map((r) => [r.ti, r.s.len]));
        for (const r of allTimeBoard(def, dir, today).filter((x) => x.live)) expect(active.get(r.ti)).toBe(r.s.len);
      }
    }
  });

  test('adding a chip only removes qualifying games', () => {
    for (const def of sample.filter((d) => d.length >= 2).slice(0, 20)) {
      const wide = new Map(board(def.slice(0, -1), 'W', 'games', today).map((r) => [r.ti, r.qual.length]));
      for (const r of board(def, 'W', 'games', today)) if (wide.has(r.ti)) expect(r.qual.length).toBeLessThanOrEqual(wide.get(r.ti));
    }
  });
});

// crowns.js walks packed bitmasks; the boards walk game lists. They are
// independent implementations of the same semantics, so check one against the
// other: every crown's definition must put that team alone on top of the board.
describe('crowns agree with the boards', () => {
  for (const scope of ['active', 'all']) {
    test(`${scope} crowns`, async () => {
      const cache = await mineAll(scope);
      const rand = rng(scope === 'all' ? 3 : 5);
      const picked = [];
      for (const [ti, list] of cache) for (const cr of list) if (rand() < 0.02) picked.push({ ti, cr });
      expect(picked.length).toBeGreaterThan(50);
      for (const { ti, cr } of picked) {
        const def = cr.chips.map((key) => ({ key }));
        const rows = scope === 'all'
          ? (() => { // an all-time board lists every run; the crown is the team's longest
            const best = new Map();
            for (const r of allTimeBoard(def, cr.dir, today)) if (!best.has(r.ti) || r.s.len > best.get(r.ti).s.len) best.set(r.ti, r);
            return [...best.values()].sort((a, b) => b.s.len - a.s.len);
          })()
          : board(def, cr.dir, 'games', today);
        const label = `${teams[ti].id} ${cr.dir} ${cr.chips.join('+') || '(none)'}`;
        expect(teams[rows[0].ti].id, label).toBe(teams[ti].id);
        expect(rows[0].s.len, label).toBe(cr.len);
        expect(rows[1]?.s.len ?? 0, label).toBeLessThan(cr.len);
        expect(cr.len).toBeGreaterThanOrEqual(LEN_FLOOR);
        expect(rows.length).toBeGreaterThanOrEqual(FIELD_FLOOR);
      }
    }, 60000);
  }
});
