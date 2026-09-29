// Known answers, checked through the client's own code path against the
// payload that ships. build-payload.mjs checks the same facts on its raw
// columns; these check that the client decodes and walks them the same way.

import { describe, expect, test } from 'vitest';
import type { ChipRef, Dir } from './types.ts';
import { P, teams, gamesOf, confOf, windowStartOf, activeBoard, allTimeBoard } from './model.ts';
import { DEFAULT_CHIPS } from './definition.ts';

const idx = (id: string) => {
  const i = teams.findIndex((t) => t.id === id);
  if (i < 0) throw new Error(`no team ${id}`);
  return i;
};
const epOf = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const today = Math.floor(Date.parse(P.builtAt) / 86400000);

/** The all-time run of `dir` for team `id` that the game on `iso` ended. */
function runEndedOn(chips: ChipRef[], dir: Dir, id: string, iso: string) {
  const ti = idx(id);
  const ep = epOf(iso);
  const r = allTimeBoard(chips, dir, today).find((x) => x.ti === ti && x.ended && Math.abs(x.ended.ep - ep) <= 1);
  if (!r) throw new Error(`no ${dir} run of ${id}'s ended on ${iso}`);
  return { ...r, ended: r.ended! };
}

describe('famous streaks', () => {
  test('Alabama won 100 straight against unranked opponents, ended by Texas A&M on 2021-10-09', () => {
    const r = runEndedOn([{ key: 'unranked' }], 'W', 'alabama', '2021-10-09');
    expect(r.s.len).toBe(100);
    expect(teams[r.ended.oppIdx].id).toBe('texas-am');
    expect(r.ended.r).toBe('L');
  });

  test('the default board opens on Alabama’s 100', () => {
    const top = allTimeBoard(DEFAULT_CHIPS, 'W', today)[0];
    expect(teams[top.ti].id).toBe('alabama');
    expect(top.s.len).toBe(100);
  });

  test('Kansas lost 46 straight road games, ended at Central Michigan on 2018-09-08', () => {
    const r = runEndedOn([{ key: 'road' }], 'L', 'kansas', '2018-09-08');
    expect(r.s.len).toBe(46);
    expect(teams[r.ended.oppIdx].id).toBe('central-michigan');
    expect(r.ended.r).toBe('W');
  });

  test('Vanderbilt lost 26 straight SEC games, ended by Kentucky on 2022-11-12', () => {
    const r = runEndedOn([{ key: 'confgame' }], 'L', 'vanderbilt', '2022-11-12');
    expect(r.s.len).toBe(26);
    expect(teams[r.ended.oppIdx].id).toBe('kentucky');
  });

  test('Miami won 34 straight, 2000–2002', () => {
    const r = allTimeBoard([], 'W', today).find((x) => x.ti === idx('miami-fl') && x.s.len === 34);
    expect(r?.s.start?.se).toBe(2000);
    expect(r?.s.end?.se).toBe(2002);
  });
});

describe('single games the pipeline had to correct', () => {
  test('the 2011 title game: LSU 0, Alabama 21', () => {
    const g = gamesOf(idx('lsu')).filter((x) => x.ep === epOf('2012-01-09'));
    expect(g).toHaveLength(1);
    expect([g[0].us, g[0].them, teams[g[0].oppIdx].id, g[0].post]).toEqual([0, 21, 'alabama', true]);
  });

  test('Colorado State 48, Arkansas State 3, at Fort Collins in 1994', () => {
    const g = gamesOf(idx('colorado-state')).filter((x) => x.ep === epOf('1994-11-12'));
    expect(g).toHaveLength(1);
    expect([g[0].us, g[0].them, g[0].home, g[0].neutral]).toEqual([48, 3, true, false]);
  });
});

describe('coach stints', () => {
  const stints = (id: string, season: number) => {
    const hc = teams[idx(id)].hc ?? [];
    return hc.filter(([, se]) => se === season).map(([ci, , ord, interim]) => [P.coachNames[ci], ord, interim]);
  };
  test('Nebraska 2022: Mickey Joseph took over as interim after game 3', () => {
    expect(stints('nebraska', 2022)).toEqual([['Mickey Joseph', 3, 1]]);
  });
  test('Louisville 2018: Lorenzo Ward took over as interim after game 10', () => {
    expect(stints('louisville', 2018)).toEqual([['Lorenzo Ward', 10, 1]]);
  });
});

describe('team windows', () => {
  test('a season a team sat out doesn’t cut its list', () => {
    for (const [id, from] of [['uconn', 2000], ['old-dominion', 2013], ['uab', 1996]] as const) {
      expect(windowStartOf(idx(id))).toBe(from);
      expect(gamesOf(idx(id))[0].se).toBe(from);
    }
    for (const id of ['smu', 'new-mexico-state']) expect(gamesOf(idx(id))[0].se).toBe(1978);
  });

  test('New Mexico State’s spring 2021 games count as its 2020 season', () => {
    const g = gamesOf(idx('new-mexico-state')).filter((x) => x.se === 2020);
    expect(g.map((x) => [teams[x.oppIdx].id, x.r])).toEqual([['x:tarletonstate', 'L'], ['x:utahtech', 'W']]);
  });

  test('a team that moved up from FCS starts at its FBS entry', () => {
    expect(gamesOf(idx('appalachian-state'))[0].se).toBe(2014);
  });

  test('both Miamis have conference history from Howell', () => {
    expect(confOf(idx('miami-fl'), 1995)).toBe('Big East');
    expect(confOf(idx('miami-fl'), 1985)).toBe('Independent');
    expect(confOf(idx('miami-oh'), 1990)).toBe('MAC');
  });
});

describe('active board', () => {
  test('every row’s streak is the team’s trailing run of qualifying games', () => {
    for (const r of activeBoard([{ key: 'home' }], 'W', today)) {
      const tail = r.qual.slice(-r.s.len);
      expect(tail.every((x) => x.r === 'W')).toBe(true);
      if (!r.s.atEdge) expect(r.qual[r.qual.length - r.s.len - 1].r).not.toBe('W');
    }
  });
});
