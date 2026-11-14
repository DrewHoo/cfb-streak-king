import { describe, expect, test } from 'vitest';
import { P, teams, fbsNow, builtEpochDay, gamesOf, upcomingOf, nextGame } from './model.ts';
import { mineCrowns } from './crowns.ts';
import { CTX, LIST, listCrowns } from './list.ts';
import { scheduledGames, teamStreaks } from './team.ts';
import { atRiskRows, atRiskWeek } from './atRisk.ts';
import { FRONT, SOON, currentStreaks, frontBest, frontList, frontNext, frontPage, frontRuns, frontStreaks, frontWeek, encodeFront, decodeFront } from './front.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const today = builtEpochDay;
const crowns = await mineCrowns('active');
const all = () => [...fbsNow].map((ti) => [ti, crowns.get(ti) ?? []] as [number, typeof crowns extends Map<number, infer V> ? V : never]);
const key = (s: { dir: string; len: number; chips: readonly string[]; startSe?: number }) => `${s.dir}|${s.len}|${s.startSe}|${s.chips.join('+')}`;

describe('the front page', () => {
  const rows = frontList(all(), today);

  test('every row is on the line in the team’s next game; a run no game tests this week isn’t, however long', () => {
    for (const r of frontBest(all(), today)) {
      const n = frontNext(r.ti, r.s, today);
      expect(n.kind).toBe('on');
      expect(n.kind === 'on' && n.game).toBe(upcomingOf(r.ti)[0]);
      // the heading's week, whatever today's date reaches
      expect(r.s.next!.wk).toBe(frontWeek());
    }
    for (const r of frontBest(all(), today + 7)) expect(r.s.next!.wk).toBe(frontWeek());
    // Alabama's 90 straight at home against unranked opponents is its best current run, and its next game isn't one
    const al = idx('alabama');
    const best = currentStreaks(al, crowns.get(al) ?? [], today)[0];
    expect([best.len, best.chips.slice().sort()]).toEqual([90, ['home', 'unranked']]);
    expect(rows.some((r) => r.ti === al && r.s.len === 90)).toBe(false);
    // with the knob off, the page is every team's best current run, and Alabama's 90 leads it
    const off = frontList(all(), today, CTX, LIST, { ...FRONT, onLine: false });
    expect([teams[off[0].ti].id, off[0].s.len]).toEqual(['alabama', 90]);
  });

  test('one row per team, the first ten by default, best first', () => {
    const best = frontBest(all(), today);
    expect(rows.length).toBe(Math.min(FRONT.top, best.length));
    expect(new Set(best.map((r) => r.ti)).size).toBe(best.length);
    for (let i = 1; i < best.length; i++) expect(best[i - 1].s.score).toBeGreaterThanOrEqual(best[i].s.score);
    expect(best.slice(0, rows.length)).toEqual(rows);
  });

  test('nothing is cut: the rows past the first ten page behind "see more", in the same order', () => {
    const { list, more } = frontPage(all(), today);
    expect(list).toEqual(rows);
    expect([...list, ...more]).toEqual(frontBest(all(), today));
  });

  test('every row is its team page’s Active row, in the same words and place', () => {
    for (const { ti, s } of rows) {
      const page = teamStreaks(ti, today, listCrowns(crowns.get(ti) ?? []));
      const same = page.find((x) => key(x) === key(s));
      expect(same, `${teams[ti].name} ${key(s)}`).toBeDefined();
      expect([same!.rank, same!.tied, same!.field]).toEqual([s.rank, s.tied, s.field]);
      expect(same!.subStreak).toBe(false);
    }
  });

  test('a run whose last game was before last season is never on it', () => {
    for (const { s } of frontBest(all(), today)) expect(s.endSe!).toBeGreaterThanOrEqual(P.currentSeason - FRONT.seasons);
    // Boise State's run over unranked WAC opponents (last played 2011) leads the raw list, and isn't here
    const boise = idx('boise-state');
    const raw = teamStreaks(boise, today, listCrowns(crowns.get(boise) ?? [])).filter((s) => !s.subStreak);
    expect(raw.some((s) => s.endSe! < P.currentSeason - FRONT.seasons)).toBe(true);
    for (const s of currentStreaks(boise, crowns.get(boise) ?? [], today)) expect(s.endSe!).toBeGreaterThanOrEqual(P.currentSeason - FRONT.seasons);
  });

  test('the file the build writes lists the same page', () => {
    const file = encodeFront(all().map(([ti, list]) => [ti, frontRuns(ti, list, today)]));
    const back = decodeFront(JSON.parse(JSON.stringify(file)));
    const again = frontList(back, today);
    expect(again.map((r) => [r.ti, key(r.s)])).toEqual(rows.map((r) => [r.ti, key(r.s)]));
    // each team keeps its best few rows, in the same order its page lists them
    for (const ti of rows.map((r) => r.ti)) {
      expect(frontStreaks(ti, back.get(ti) ?? [], today).map(key)).toEqual(frontStreaks(ti, crowns.get(ti) ?? [], today).slice(0, FRONT.keep).map(key));
    }
  });

  test('a row on the line this week is a row of the week’s at-risk digest', () => {
    const games = scheduledGames();
    const wk = games[0]?.wk;
    const week = games.filter((g) => g.wk === wk);
    const risk = atRiskWeek(atRiskRows(week, today, (ti) => crowns.get(ti) ?? []), CTX, LIST);
    const atRisk = new Set([...risk.list, ...risk.more, ...risk.subStreaks].map((r) => `${r.ti}|${key(r.s)}`));
    for (const r of frontBest(all(), today)) {
      const n = frontNext(r.ti, r.s, today);
      if (n.kind === 'on' && n.game.sp != null && n.game.wk === wk) expect(atRisk.has(`${r.ti}|${key(r.s)}`), `${teams[r.ti].name} ${key(r.s)}`).toBe(true);
    }
  });

  test('what each row says about the next game agrees with the schedule', () => {
    for (const { ti, s } of frontBest(all(), today)) {
      const n = frontNext(ti, s, today);
      const up = upcomingOf(ti)[0];
      if (n.kind === 'on' || n.kind === 'maybe') {
        expect(n.game.ep - today).toBeLessThanOrEqual(SOON);
        // only the team's next game is on the line
        expect(n.game).toBe(up);
      }
      if (n.kind === 'later') expect(n.then).toBe(s.next ?? s.maybe);
      if (n.kind === 'none') expect(s.next ?? s.maybe).toBeNull();
      if (n.kind !== 'none' && n.kind !== 'unknown' && n.game) expect(upcomingOf(ti)).toContain(n.game);
      // a team with nothing scheduled has nothing that counts
      if (!up) expect(n.kind).toBe('none');
    }
  });
});

test('a later game is never on the line while an earlier one is unrecorded, whatever the date', () => {
  const ti = [...fbsNow].find((t) => upcomingOf(t).length >= 2)!;
  const [first, second] = upcomingOf(ti);
  const s = { chips: [], next: second, how: 'sure' as const, maybe: null };
  // days after the first game, with the second a few days out: still not on the line
  const n = frontNext(ti, s, second.ep - 2);
  expect(n.kind).toBe('later');
  expect(n.kind === 'later' && n.game).toBe(first);
});

describe('nextGame: conditions settled before kickoff', () => {
  const lined = [...fbsNow].filter((ti) => upcomingOf(ti)[0]?.sp != null);

  test('after a loss, a win or a bye reads the team’s last result for its next game only', () => {
    for (const ti of [...fbsNow].filter((t) => upcomingOf(t).length >= 2).slice(0, 40)) {
      const last = gamesOf(ti).at(-1)!;
      const up = upcomingOf(ti)[0];
      const prev = last.se >= up.se - 1 ? last.r : null;
      const n = nextGame(ti, [{ key: 'afterloss' }]);
      if (prev === 'L') expect(n).toEqual({ next: up, how: 'sure' });
      // after a win, the next game doesn't count, and the one after it can't be told yet
      else expect(n).toBeNull();
      const bye = nextGame(ti, [{ key: 'afterbye' }]);
      if (up.ep - last.ep >= 13) expect(bye?.next).toBe(up); else expect(bye).toBeNull();
    }
  });

  test('a betting condition reads the line as of the build, and says the game is only likely', () => {
    expect(lined.length).toBeGreaterThan(0);
    for (const ti of lined) {
      const up = upcomingOf(ti)[0];
      const fav = nextGame(ti, [{ key: 'fav' }]);
      if (up.sp! < 0) expect(fav).toEqual({ next: up, how: 'likely' });
      // not the favorite this week: a later lined game where it is, or nothing (no line yet)
      else if (fav) expect([fav.how, fav.next.sp! < 0, fav.next.ep > up.ep]).toEqual(['likely', true, true]);
    }
  });

  test('a condition settled during the game leaves the game open, and the at-risk list leaves it out', () => {
    const ti = [...fbsNow].find((t) => upcomingOf(t).length)!;
    const up = upcomingOf(ti)[0];
    expect(nextGame(ti, [{ key: 'onescore' }])).toEqual({ next: up, how: 'open' });
    const s = teamStreaks(ti, today, [{ ...(crowns.get(ti) ?? [])[0], chips: ['onescore'], scope: 'active', dir: 'W' }])[0];
    expect(s.next).toBeNull();
    expect(s.maybe).toBe(up);
    expect(s.how).toBe('open');
  });
});
