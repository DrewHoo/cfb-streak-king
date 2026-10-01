import { describe, expect, test } from 'vitest';
import type { BoardRow } from './types.ts';
import { viewReducer, initialView, DESKTOP_CAP } from './view.ts';
import type { ViewState } from './view.ts';

const row = (ti: number, startEp: number) => ({ ti, s: { start: { ep: startEp } } }) as unknown as BoardRow;

describe('view', () => {
  test('a new definition, scope or direction resets the column limit', () => {
    const wide = { ...initialView(), limit: 60 };
    expect(viewReducer(wide, { type: 'define', active: [{ key: 'road' }] }).limit).toBe(DESKTOP_CAP);
    expect(viewReducer(wide, { type: 'scope', scope: 'active' }).limit).toBe(DESKTOP_CAP);
    expect(viewReducer(wide, { type: 'dir', dir: 'L' }).limit).toBe(DESKTOP_CAP);
    expect(viewReducer(wide, { type: 'week', on: true }).limit).toBe(60);
  });

  test('all-time mode drops the week filter', () => {
    const v = { ...initialView(), scope: 'active' as const, week: true };
    expect(viewReducer(v, { type: 'scope', scope: 'all' }).week).toBe(false);
    expect(viewReducer(v, { type: 'scope', scope: 'active' }).week).toBe(true);
  });

  test('a one-score or shootout chip drops from a spread streak, however it arrives', () => {
    const one = [{ key: 'home' }, { key: 'onescore' }];
    expect(viewReducer(initialView(), { type: 'define', active: one, dir: 'N' }).active).toEqual([{ key: 'home' }]);
    expect(viewReducer({ ...initialView(), active: one }, { type: 'dir', dir: 'C' }).active).toEqual([{ key: 'home' }]);
    expect(viewReducer(initialView(), { type: 'load', view: { ...initialView(), active: one, dir: 'N' } }).active).toEqual([{ key: 'home' }]);
    expect(viewReducer(initialView(), { type: 'define', active: one, dir: 'L' }).active).toEqual(one);
    expect(viewReducer(initialView(), { type: 'define', active: [{ key: 'shootout' }], dir: 'C' }).active).toEqual([]);
  });

  test('picking a run opens it; picking it again closes it', () => {
    let v = initialView();
    v = viewReducer(v, { type: 'pick', row: row(3, 100) });
    expect([v.team, v.run]).toEqual([3, 100]);
    v = viewReducer(v, { type: 'pick', row: row(3, 200) }); // another run of the same team
    expect([v.team, v.run]).toEqual([3, 200]);
    v = viewReducer(v, { type: 'pick', row: row(3, 200) });
    expect([v.team, v.run]).toEqual([null, null]);
  });

  test('in active mode a team has one row and no run', () => {
    let v: ViewState = { ...initialView(), scope: 'active' };
    v = viewReducer(v, { type: 'pick', row: row(3, 100) });
    expect([v.team, v.run]).toEqual([3, null]);
    v = viewReducer(v, { type: 'pick', row: row(3, 100) });
    expect(v.team).toBeNull();
  });

  test('applying a crown takes its definition, direction and scope', () => {
    const v = viewReducer(initialView(7), { type: 'crown', crown: { chips: ['road', 'ranked'], dir: 'L', scope: 'active', len: 4, atEdge: false, field: 12, live: true, also: 0 } });
    expect([v.active, v.dir, v.scope, v.team]).toEqual([[{ key: 'road' }, { key: 'ranked' }], 'L', 'active', 7]);
  });
});
