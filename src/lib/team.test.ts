import { describe, expect, test } from 'vitest';
import { teams, builtEpochDay, upcomingOf, activeBoard, gamesOf, P } from './model.ts';
import { seasonRecord, nextGameOf, gameVs, apRank, teamStreaks, streaksOn, rankText, teamList, LEN_FLOOR, worthShowing } from './team.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const today = builtEpochDay;

describe('team', () => {
  test('the season record counts this season only, straight up and against the spread', () => {
    const ti = idx('georgia');
    const r = seasonRecord(ti);
    const games = gamesOf(ti).filter((g) => g.se === P.currentSeason);
    expect(r.w + r.l + r.t).toBe(games.length);
    expect(r.cw + r.cl + r.cp).toBe(games.filter((g) => g.cover != null).length);
  });

  test('the next game is the first one scheduled; a matchup falls back to it', () => {
    const ti = teamList().find((t) => upcomingOf(t).some((u) => u.ep >= today))!;
    const next = nextGameOf(ti, today)!;
    expect(next).toBe(upcomingOf(ti).find((u) => u.ep >= today));
    expect(gameVs(ti, next.oppIdx, today)).toBe(next);
    expect(gameVs(ti, ti, today)).toBe(next); // nobody plays itself
    expect(gameVs(ti, null, today)).toBe(next);
    expect(apRank(ti, today)).toBe(next.ownRank);
  });

  test("a team's streaks carry its place on the same board the app shows", () => {
    const ti = idx('georgia');
    const list = teamStreaks(ti, today);
    for (const [chips, dir] of [[[], 'W'], [['home'], 'C'], [['unranked'], 'W']] as const) {
      const rows = activeBoard(chips.map((key) => ({ key })), dir, today);
      const row = rows.find((r) => r.ti === ti);
      const s = list.find((x) => x.dir === dir && x.chips.join() === chips.join());
      const level = row ? rows.filter((r) => r.s.len === row.s.len).length : 0;
      if (!row || !worthShowing({ len: row.s.len, rank: rows.findIndex((r) => r.s.len === row.s.len) + 1, tied: level })) { expect(s).toBeUndefined(); continue; }
      expect(s).toMatchObject({ len: row.s.len, field: rows.length, rank: rows.findIndex((r) => r.s.len === row.s.len) + 1, tied: level });
      expect(s!.since).toBe(row.qual[row.qual.length - row.s.len].se);
      expect(s!.chance).toBeGreaterThan(0);
      expect(s!.chance).toBeLessThanOrEqual(1);
      expect(rankText(s!)).toMatch(/^(T-)?\d+(st|nd|rd|th)$/);
    }
  });

  test('a team is on one side of each pair of outcomes, never both', () => {
    const list = teamStreaks(idx('alabama'), today);
    const under = (dir: string) => list.filter((s) => s.dir === dir).map((s) => s.chips.join());
    for (const k of under('W')) expect(under('L')).not.toContain(k);
    for (const k of under('C')) expect(under('N')).not.toContain(k);
  });

  test('streaks with a scheduled qualifying game come first, then the higher score', () => {
    const list = teamStreaks(idx('georgia'), today);
    const firstWithout = list.findIndex((s) => !s.next);
    if (firstWithout >= 0) expect(list.slice(firstWithout).every((s) => !s.next)).toBe(true);
    const ahead = list.filter((s) => s.next);
    for (let i = 1; i < ahead.length; i++) expect(ahead[i - 1].score).toBeGreaterThanOrEqual(ahead[i].score);
  });

  test("a game puts on the line the streaks whose next qualifying game it is", () => {
    const ti = teamList().find((t) => nextGameOf(t, today) && teamStreaks(t, today).some((s) => s.next))!;
    const next = nextGameOf(ti, today)!;
    const on = streaksOn(teamStreaks(ti, today), next);
    expect(on.every((s) => s.next!.i === next.i)).toBe(true);
  });

  test(`a run under ${LEN_FLOOR} games shows only when the team alone leads with it`, () => {
    for (const ti of teamList().slice(0, 20)) {
      for (const s of teamStreaks(ti, today)) expect(s.len >= LEN_FLOOR || (s.rank === 1 && s.tied === 1)).toBe(true);
    }
    expect(worthShowing({ len: 1, rank: 1, tied: 1 })).toBe(true);
    expect(worthShowing({ len: 3, rank: 1, tied: 2 })).toBe(false);
  });

  test("a multi-condition crown joins the list with the team's own row", () => {
    const ti = idx('georgia');
    const crown = { chips: ['home', 'unranked'], dir: 'W' as const, scope: 'active' as const, len: 1, atEdge: false, field: 1, live: true, also: 0, chance: 0.5 };
    const row = activeBoard([{ key: 'home' }, { key: 'unranked' }], 'W', today).find((r) => r.ti === ti);
    const s = teamStreaks(ti, today, [crown]).find((x) => x.chips.length === 2);
    expect(s?.len).toBe(row?.s.len);
  });
});
