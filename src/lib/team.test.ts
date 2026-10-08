import { describe, expect, test } from 'vitest';
import { teams, builtEpochDay, upcomingOf, activeBoard, gamesOf, P } from './model.ts';
import { PLAIN_CHIPS } from './chips.ts';
import { nearUniversalChips } from './crowns.ts';
import { seasonRecord, nextGameOf, gameVs, apRank, teamStreaks, streaksOn, rankText, teamList, h2hStreaksOn, h2hRate, fitsSite, LEN_FLOOR, worthShowing } from './team.ts';

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

  test('the next game is the first one scheduled, past its date or not; a matchup falls back to it', () => {
    const ti = teamList().find((t) => upcomingOf(t).length)!;
    const next = nextGameOf(ti, today)!;
    expect(next).toBe(upcomingOf(ti)[0]);
    // a game played but not yet recorded is still the next one, not gone
    expect(nextGameOf(ti, next.ep + 3)).toBe(next);
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
      // a winning run every game of which was won by 10+ is told once, by its margin
      const retold = dir === 'W' && list.some((x) => x.dir === 'W10' && x.chips.join() === chips.join() && x.len === row.s.len);
      if (retold) { expect(s).toBeUndefined(); continue; }
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

  test('the list runs from the highest score down, as the King-of list does', () => {
    const list = teamStreaks(idx('georgia'), today);
    expect(list.length).toBeGreaterThan(1);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
  });

  test('a crown that only retells a single-condition run on the list is left out', () => {
    const ti = idx('georgia');
    const base = teamStreaks(ti, today).find((s) => s.chips.length === 1 && s.dir === 'W' && s.len >= LEN_FLOOR);
    if (!base) return;
    // the same run under one more condition: whichever of the pair every game of it meets has the same length and start
    const pair = (['weekend', 'weekday'] as const).map((k) => ({ chips: [base.chips[0], k], dir: 'W' as const, scope: 'active' as const, len: base.len, atEdge: base.atEdge, field: base.field, live: true, also: 0, chance: 0.5 }));
    const withCrowns = teamStreaks(ti, today, pair);
    for (const s of withCrowns.filter((s) => s.chips.length === 2)) expect(s.len === base.len && s.since === base.since).toBe(false);
  });

  test("a game puts on the line the streaks whose next qualifying game it is", () => {
    const ti = teamList().find((t) => nextGameOf(t, today) && teamStreaks(t, today).some((s) => s.next))!;
    const next = nextGameOf(ti, today)!;
    const on = streaksOn(teamStreaks(ti, today), next);
    expect(on.every((s) => s.next!.i === next.i)).toBe(true);
  });

  test('a near-universal condition names no row, as it names no crown', () => {
    const loose = [...nearUniversalChips()].map((i) => PLAIN_CHIPS[i].key);
    expect(loose).toContain('weekend');
    for (const ti of teamList().slice(0, 30)) {
      for (const s of teamStreaks(ti, today)) expect(s.chips.some((k) => loose.includes(k))).toBe(false);
    }
  });

  test(`a run under ${LEN_FLOOR} games shows only when the team alone leads with it`, () => {
    for (const ti of teamList().slice(0, 20)) {
      for (const s of teamStreaks(ti, today)) expect(s.len >= LEN_FLOOR || (s.rank === 1 && s.tied === 1)).toBe(true);
    }
    expect(worthShowing({ len: 1, rank: 1, tied: 1 })).toBe(true);
    expect(worthShowing({ len: 3, rank: 1, tied: 2 })).toBe(false);
  });

  test('every head-to-head run re-derives from the meetings its chips keep', () => {
    let seen = 0;
    let sited = 0;
    for (const ti of teamList()) {
      const next = nextGameOf(ti, today);
      if (!next) continue;
      const list = h2hStreaksOn(ti, next);
      for (const s of list) {
        const site = s.chips.includes('home') ? 'home' : s.chips.includes('road') ? 'road' : null;
        if (site) {
          sited++;
          // a site run is only on the line when the game sits at that site
          expect(fitsSite(site, next)).toBe(true);
        }
        const ms = gamesOf(ti).filter((g) => g.oppIdx === next.oppIdx && fitsSite(site, g));
        let i = ms.length - 1;
        while (i >= 0 && ms[i].r === s.dir) i--;
        seen++;
        expect(s.vs).toBe(next.oppIdx);
        expect(s.dir).toBe(ms.at(-1)!.r);
        expect(s.len).toBe(ms.length - 1 - i);
        expect(s.len).toBeGreaterThanOrEqual(LEN_FLOOR);
        expect(s.next).toBe(next);
        expect(s.since).toBe(ms[i + 1].se);
      }
      // the site variant never retells the overall run
      if (list.length === 2) expect(list[0].len === list[1].len && list[0].since === list[1].since).toBe(false);
    }
    expect(seen).toBeGreaterThan(0); // some pair somewhere has a run going
    expect(sited).toBeGreaterThan(0); // and some of them hold at one stadium
  });

  test('the h2h rate mirrors the opponent and stays clamped', () => {
    for (const ti of teamList().slice(0, 10)) {
      for (const dir of ['W', 'L'] as const) {
        const p = h2hRate(ti, dir);
        expect(p).toBeGreaterThanOrEqual(0.05);
        expect(p).toBeLessThanOrEqual(0.995);
      }
    }
  });

  test("a multi-condition crown joins the list with the team's own row", () => {
    const ti = idx('georgia');
    const crown = { chips: ['home', 'unranked'], dir: 'W' as const, scope: 'active' as const, len: 1, atEdge: false, field: 1, live: true, also: 0, chance: 0.5 };
    const row = activeBoard([{ key: 'home' }, { key: 'unranked' }], 'W', today).find((r) => r.ti === ti);
    const s = teamStreaks(ti, today, [crown]).find((x) => x.chips.length === 2);
    expect(s?.len).toBe(row?.s.len);
  });
});
