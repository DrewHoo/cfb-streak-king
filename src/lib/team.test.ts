import { describe, expect, test } from 'vitest';
import { teams, builtEpochDay, upcomingOf, activeBoard, gamesOf, P } from './model.ts';
import { seasonRecord, nextGameOf, gameVs, apRank, teamStreaks, streaksOn, rankText, teamList } from './team.ts';

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
      if (!row) { expect(s).toBeUndefined(); continue; }
      expect(s).toMatchObject({ len: row.s.len, field: rows.length, rank: rows.findIndex((r) => r.s.len === row.s.len) + 1 });
      expect(s!.tied).toBe(rows.filter((r) => r.s.len === row.s.len).length);
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
    const ti = teamList().find((t) => nextGameOf(t, today))!;
    const next = nextGameOf(ti, today)!;
    const on = streaksOn(teamStreaks(ti, today), next);
    // every game qualifies under no condition, so the plain streak is always there
    expect(on.some((s) => s.chips.length === 0)).toBe(true);
    expect(on.every((s) => s.next!.i === next.i)).toBe(true);
  });

  test("a multi-condition crown joins the list with the team's own row", () => {
    const ti = idx('georgia');
    const crown = { chips: ['home', 'unranked'], dir: 'W' as const, scope: 'active' as const, len: 1, atEdge: false, field: 1, live: true, also: 0, chance: 0.5 };
    const row = activeBoard([{ key: 'home' }, { key: 'unranked' }], 'W', today).find((r) => r.ti === ti);
    const s = teamStreaks(ti, today, [crown]).find((x) => x.chips.length === 2);
    expect(s?.len).toBe(row?.s.len);
  });
});
