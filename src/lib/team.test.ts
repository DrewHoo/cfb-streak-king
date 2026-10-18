import { describe, expect, test } from 'vitest';
import { teams, builtEpochDay, upcomingOf, activeBoard, gamesOf, P } from './model.ts';
import { PLAIN_CHIPS, chipByKey } from './chips.ts';
import { mineCrowns, nearUniversalChips } from './crowns.ts';
import { refsOf } from './minedChips.ts';
import { seasonRecord, nextGameOf, gameVs, apRank, teamStreaks, streaksOn, rankText, teamList, nextQualifying, LEN_FLOOR, SHEET_DIRS } from './team.ts';
import { listCrowns } from './list.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const today = builtEpochDay;
const crowns = await mineCrowns('active');
// a team's list as its page shows it: the list rule over its file
const listed = new Map<number, ReturnType<typeof listCrowns>>();
const of = (ti: number) => listed.get(ti) ?? listed.set(ti, listCrowns(crowns.get(ti) ?? [])).get(ti)!;

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
    const list = teamStreaks(ti, today, of(ti));
    expect(list.length).toBeGreaterThan(5);
    for (const s of list.slice(0, 30)) {
      const rows = activeBoard(refsOf(s.chips), s.dir, today);
      const row = rows.find((r) => r.ti === ti)!;
      expect(row, s.chips.join('+')).toBeDefined();
      expect(s).toMatchObject({ len: row.s.len, field: rows.length, rank: rows.filter((r) => r.s.len > row.s.len).length + 1, tied: rows.filter((r) => r.s.len === row.s.len).length });
      expect(s.since).toBe(row.qual[row.qual.length - row.s.len].se);
      expect(s.chance).toBeGreaterThan(0);
      expect(s.chance).toBeLessThanOrEqual(1);
      expect(rankText(s)).toMatch(/^(T-)?\d+(st|nd|rd|th)$/);
    }
  });

  test('a team is on one side of each pair of outcomes, never both; only the sheet\'s outcomes show', () => {
    const list = teamStreaks(idx('alabama'), today, of(idx('alabama')));
    const under = (dir: string) => list.filter((s) => s.dir === dir).map((s) => s.chips.join());
    for (const k of under('W')) expect(under('L')).not.toContain(k);
    for (const k of under('C')) expect(under('N')).not.toContain(k);
    for (const s of list) expect(SHEET_DIRS).toContain(s.dir);
  });

  test('the list runs from the highest score down, as the King-of list does', () => {
    const list = teamStreaks(idx('georgia'), today, of(idx('georgia')));
    expect(list.length).toBeGreaterThan(1);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
  });

  test('an empty list while the crowns load', () => {
    expect(teamStreaks(idx('georgia'), today, null)).toEqual([]);
  });

  test("a game puts on the line the streaks whose next qualifying game it is", () => {
    // a streak's next qualifying game may be a later one than the team's next game
    const ti = teamList().find((t) => { const n = nextGameOf(t, today); return n && teamStreaks(t, today, of(t)).some((s) => s.next?.i === n.i); })!;
    const next = nextGameOf(ti, today)!;
    const list = teamStreaks(ti, today, of(ti));
    const on = streaksOn(list, next);
    expect(on.length).toBeGreaterThan(0);
    expect(on.every((s) => s.next!.i === next.i)).toBe(true);
    for (const s of list) if (s.next && s.next.i !== next.i) expect(s.next.ep).toBeGreaterThanOrEqual(next.ep);
  });

  test('the next qualifying game reads every chip, choice included; a chip read from the game itself has none', () => {
    const ti = teamList().find((t) => upcomingOf(t).length)!;
    const ahead = upcomingOf(ti);
    expect(nextQualifying(ti, [], today)).toBe(ahead[0] ?? null); // past its date too: unrecorded, not gone
    const home = nextQualifying(ti, ['home'], today);
    if (home) expect(home.home && !home.neutral).toBe(true);
    const opp = ahead[0].oppIdx;
    const vs = nextQualifying(ti, [`vsteam:${teams[opp].id}`], today);
    if (vs) expect(vs.oppIdx).toBe(opp);
    expect(nextQualifying(ti, ['onescore'], today)).toBeNull();
    expect(nextQualifying(ti, ['home', 'leadhalf:1'], today)).toBeNull();
    expect(chipByKey.get('leadhalf')!.pregame).toBe(false);
  });

  test('a near-universal condition names no row, as it names no crown', () => {
    const loose = [...nearUniversalChips()].map((i) => PLAIN_CHIPS[i].key);
    expect(loose).toContain('weekend');
    for (const ti of teamList().slice(0, 30)) {
      for (const s of teamStreaks(ti, today, of(ti))) expect(s.chips.some((k) => loose.includes(k))).toBe(false);
    }
  });

  test(`no run under ${LEN_FLOOR} games, and every mined key decodes to a chip`, () => {
    for (const ti of teamList().slice(0, 20)) {
      for (const s of teamStreaks(ti, today, of(ti))) {
        expect(s.len).toBeGreaterThanOrEqual(LEN_FLOOR);
        expect(refsOf(s.chips).length).toBe(s.chips.length);
      }
    }
  });
});
