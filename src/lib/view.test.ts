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

  test('applying a streak takes its definition, direction and scope, and keeps the open team', () => {
    const v = viewReducer({ ...initialView(), team: 7 }, { type: 'streak', chips: ['road', 'ranked'], dir: 'L', scope: 'active' });
    expect([v.active, v.dir, v.scope, v.team]).toEqual([[{ key: 'road' }, { key: 'ranked' }], 'L', 'active', 7]);
  });

  test('picking a broken-streaks week stays on the schedule; the board or a streak clears it', () => {
    let v = viewReducer(initialView(null, true), { type: 'bweek', wk: 3 });
    expect([v.games, v.bwk]).toEqual([true, 3]);
    expect(viewReducer(v, { type: 'board' }).bwk).toBeNull();
    expect(viewReducer(v, { type: 'games' }).bwk).toBeNull();
    expect(viewReducer(v, { type: 'streak', chips: [], dir: 'W', scope: 'active', team: 2 }).bwk).toBeNull();
    // loading a week URL carries the week in
    v = viewReducer(initialView(), { type: 'load', view: { ...initialView(), games: true, bwk: 4 } });
    expect([v.games, v.bwk]).toEqual([true, 4]);
  });

  test('a broken streak carries its chip choice and lands on its all-time run', () => {
    const v = viewReducer(initialView(), { type: 'streak', chips: [{ key: 'vsteam', param: 12 }], dir: 'W', scope: 'all', team: 3, run: 18000 });
    expect([v.active, v.scope, v.team, v.run]).toEqual([[{ key: 'vsteam', param: 12 }], 'all', 3, 18000]);
    // an active streak never pins a run
    const a = viewReducer(initialView(), { type: 'streak', chips: ['home'], dir: 'W', scope: 'active', team: 3, run: 18000 });
    expect(a.run).toBeNull();
  });

  test('a streak picked on a team page or a matchup lands on the board with that team open', () => {
    const v = viewReducer({ ...initialView(4), game: 4, vs: 9 }, { type: 'streak', chips: ['home'], dir: 'C', scope: 'active', team: 4 });
    expect([v.page, v.game, v.vs, v.team, v.dir]).toEqual([null, null, null, 4, 'C']);
  });

  test("loading a team page's URL keeps the board that was showing", () => {
    const board = { ...initialView(), active: [{ key: 'road' }], dir: 'L' as const, team: 3 };
    const v = viewReducer(board, { type: 'load', view: { ...initialView(), page: 5 } });
    expect([v.page, v.active, v.dir, v.team]).toEqual([5, [{ key: 'road' }], 'L', 3]);
    expect(viewReducer(v, { type: 'load', view: initialView() }).active).toEqual(initialView().active);
  });

  test('the schedule opens in the board’s place and a streak or the board closes it', () => {
    let v = viewReducer(initialView(), { type: 'games' });
    expect([v.games, v.page]).toEqual([true, null]);
    v = viewReducer(v, { type: 'page', team: 2 }); // a team page over it; Back returns to it
    expect([v.games, v.page]).toEqual([true, 2]);
    expect(viewReducer(v, { type: 'streak', chips: [], dir: 'W', scope: 'active', team: 2 }).games).toBe(false);
    expect(viewReducer(v, { type: 'board' }).games).toBe(false);
    expect(viewReducer(initialView(), { type: 'load', view: { ...initialView(), games: true } }).games).toBe(true);
    // the at-risk section is its own address; any other schedule move leaves it
    const r = viewReducer(initialView(), { type: 'risk' });
    expect([r.games, r.risk, r.bwk]).toEqual([true, true, null]);
    expect(viewReducer(r, { type: 'bweek', wk: 3 }).risk).toBe(false);
    expect(viewReducer(r, { type: 'games' }).risk).toBe(false);
    expect(viewReducer(r, { type: 'board' }).risk).toBe(false);
    expect(viewReducer(initialView(), { type: 'load', view: { ...initialView(), games: true, risk: true } }).risk).toBe(true);
  });

  test('a matchup opens over the board or a page and closes back to it; a page closes a matchup', () => {
    let v = viewReducer({ ...initialView(), team: 3 }, { type: 'game', team: 3, vs: null });
    expect([v.game, v.team, v.page]).toEqual([3, 3, null]);
    v = viewReducer(v, { type: 'closeGame' });
    expect([v.game, v.team]).toEqual([null, 3]);
    v = viewReducer(viewReducer(v, { type: 'game', team: 3, vs: 5 }), { type: 'page', team: 5 });
    expect([v.page, v.game, v.vs, v.team]).toEqual([5, null, null, 3]);
    expect(viewReducer(v, { type: 'board' }).page).toBeNull();
  });
});
