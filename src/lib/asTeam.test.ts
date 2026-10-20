import { describe, expect, test } from 'vitest';
import { AS_SLUGS, asFromPath, asPath, asPageDir, asH1, asLead } from './asTeam.ts';
import { teams, asBoard, allTimeBoard, activeBoard, fbsNow, builtEpochDay, gamesOf } from './model.ts';
import { leadRows } from './landing.ts';
import { LANDINGS } from './landing.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const auburn = idx('auburn');
const yearOf = (ep: number) => new Date(ep * 86400000).getUTCFullYear();

describe('asTeam', () => {
  test('the two pages have paths under the team, and nothing else reads as one', () => {
    expect(asPath('auburn', 'L')).toBe('team/auburn/losing-streaks-by-opponent/');
    expect(asFromPath('/cfb-streak-king/team/auburn/losing-streaks-by-opponent/')).toEqual({ id: 'auburn', dir: 'L' });
    expect(asFromPath('/cfb-streak-king/team/auburn/win-streaks-by-opponent')).toEqual({ id: 'auburn', dir: 'W' });
    expect(asFromPath('/cfb-streak-king/team/auburn/')).toBeNull();
    expect(asFromPath('/cfb-streak-king/team/auburn/something-else/')).toBeNull();
    // no named definition page shares a slug with them
    for (const slug of Object.values(AS_SLUGS)) expect(LANDINGS.some((l) => l.slug === slug)).toBe(false);
    expect(asPageDir(0, 'L', 'all')).toBe('L');
    expect(asPageDir(0, 'W', 'all')).toBe('W');
    expect(asPageDir(1, 'L', 'all')).toBeNull();
    expect(asPageDir(0, 'L', 'active')).toBeNull();
    expect(asPageDir(0, 'U', 'all')).toBeNull();
  });

  test('the known answer: Georgia Tech beat Auburn 13 straight, 1941–1954, and it leads the board', () => {
    const rows = asBoard(auburn, [], 'L', 'all', builtEpochDay);
    const top = rows[0];
    expect(teams[top.vs!].id).toBe('georgia-tech');
    expect(top.ti).toBe(auburn);
    expect([top.s.len, yearOf(top.s.start!.ep), yearOf(top.s.end!.ep), top.live]).toEqual([13, 1941, 1954, false]);
    const lead = asLead('Auburn', 'L', leadRows(rows.map((r) => ({ ...r, ti: r.vs! })), (ti) => teams[ti].name), 1936);
    expect(lead).toMatch(/^Georgia Tech beat Auburn 13 straight times, 1941–1954, the longest winning streak any team has had against Auburn since 1936\. Then /);
    expect(asH1('Auburn', 'L')).toBe('Who has beaten Auburn the most times in a row?');
  });

  test('numbers nest: a column equals the team’s row on the board for the definition plus "vs [that opponent]"', () => {
    const todayEp = builtEpochDay;
    for (const [dir, scope] of [['L', 'all'], ['W', 'all'], ['W', 'active']] as const) {
      const rows = asBoard(auburn, [], dir, scope, todayEp);
      expect(rows.length).toBeGreaterThan(20);
      for (const r of rows.slice(0, 12)) {
        const def = [{ key: 'vsteam', param: r.vs! }];
        const board = scope === 'all' ? allTimeBoard(def, dir, todayEp) : activeBoard(def, dir, todayEp);
        const mine = board.find((b) => b.ti === auburn && (scope !== 'all' || b.s.start!.ep === r.s.start!.ep));
        expect(mine, `${teams[r.vs!].name} ${dir} ${scope}`).toBeDefined();
        expect([mine!.s.len, mine!.s.atEdge, mine!.s.last.ep]).toEqual([r.s.len, r.s.atEdge, r.s.last.ep]);
      }
    }
  });

  test('numbers nest the other way: an opponent’s streak over the team is the opponent’s row on "vs [the team]"', () => {
    // every FBS opponent that beat Auburn N straight has an N-game winning streak vs Auburn on that board
    const rows = asBoard(auburn, [], 'L', 'all', builtEpochDay);
    const board = allTimeBoard([{ key: 'vsteam', param: auburn }], 'W', builtEpochDay);
    for (const r of rows.filter((x) => fbsNow.has(x.vs!)).slice(0, 10)) {
      const theirs = board.find((b) => b.ti === r.vs && b.s.last.ep === r.s.last.ep);
      expect(theirs, teams[r.vs!].name).toBeDefined();
      expect(theirs!.s.len).toBe(r.s.len);
    }
  });

  test('an active board has one row per opponent, the team’s current run against it', () => {
    const rows = asBoard(auburn, [], 'W', 'active', builtEpochDay);
    expect(new Set(rows.map((r) => r.vs)).size).toBe(rows.length);
    for (const r of rows) {
      const last = gamesOf(auburn).filter((g) => g.oppIdx === r.vs).at(-1)!;
      expect(r.s.last.ep).toBe(last.ep);
      expect(last.r).toBe('W');
    }
  });

  test('the lead sentence in words: ties, live runs, and an empty board', () => {
    const row = (name: string, len: number, startEp: number, endEp: number, live = false, atEdge = false) => ({ name, len, atEdge, startEp, endEp, live });
    const y = (yr: number) => Math.floor(Date.UTC(yr, 9, 1) / 86400000);
    expect(asLead('Auburn', 'L', [row('Georgia', 9, y(2017), y(2025)), row('Alabama', 9, y(1973), y(1981)), row('Florida', 7, y(1995), y(2000))], 1936))
      .toBe('Georgia and Alabama have each beaten Auburn 9 straight times, the longest winning streak any team has had against Auburn since 1936. Then Florida at 7.');
    expect(asLead('Auburn', 'L', [row('Alabama', 6, y(2020), y(2025), true)], 1936))
      .toBe('Alabama has beaten Auburn 6 straight times, since October 2020, the longest winning streak any team has had against Auburn since 1936.');
    expect(asLead('Auburn', 'W', [row('Chattanooga', 20, y(1942), y(2010), true, true), row('Kentucky', 15, y(1967), y(2005))], 1936))
      .toBe("Auburn's longest winning streak against one opponent since 1936 is 20+ straight times over Chattanooga, 1942–2010, and still going. Then Kentucky at 15.");
    expect(asLead('Auburn', 'W', [], 1936)).toBe('');
  });
});
