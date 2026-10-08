import { describe, expect, it } from 'vitest';
import { teams } from './model.ts';
import { addKings, kingOf } from './kings.ts';
import { activeBoard, allTimeBoard } from './model.ts';
import { P } from './model.ts';

const today = Math.floor(Date.parse(P.builtAt) / 86400000);

const names = (k: { tis: number[] } | null | undefined) => k?.tis.map((ti) => teams[ti].name).sort() ?? null;

describe('kings', () => {
  it('crowns the all-time winning streak and each site split', () => {
    const { cur, byKey } = addKings([], 'W', 'all');
    expect([names(cur), cur?.len]).toEqual([['Oklahoma'], 47]);
    expect([names(byKey.get('home')), byKey.get('home')?.len]).toEqual([['Boise State'], 65]);
    expect([names(byKey.get('road')), byKey.get('road')?.len]).toEqual([['Oklahoma'], 25]);
    expect([names(byKey.get('neutral')), byKey.get('neutral')?.len]).toEqual([['Florida State'], 15]);
  });

  it('keeps a tie as co-kings', () => {
    const k = kingOf([{ key: 'ranked' }], 'W', 'all');
    expect([names(k), k?.len]).toEqual([['Alabama', 'USC'], 16]);
  });

  it('offers an exclusive group-mate as a swap, not an addition', () => {
    const { byKey } = addKings([{ key: 'home' }, { key: 'ranked' }], 'W', 'all');
    expect(byKey.has('home')).toBe(false);
    expect(byKey.get('road')).toEqual(kingOf([{ key: 'ranked' }, { key: 'road' }], 'W', 'all'));
  });

  it('crowns a margin outcome from the same board the app shows', () => {
    for (const [dir, scope] of [['W10', 'all'], ['L7', 'all'], ['W14', 'active']] as const) {
      const rows = scope === 'all' ? allTimeBoard([{ key: 'road' }], dir, today) : activeBoard([{ key: 'road' }], dir, today);
      const k = kingOf([{ key: 'road' }], dir, scope)!;
      expect(k.len).toBe(rows[0].s.len);
      expect(k.tis).toContain(rows[0].ti);
      expect(k.tis.length).toBe(rows.filter((r) => r.s.len === rows[0].s.len).length);
    }
  });

  it('has no king for a constraint that takes a choice', () => {
    expect(addKings([], 'W', 'all').byKey.has('vsteam')).toBe(false);
  });
});
