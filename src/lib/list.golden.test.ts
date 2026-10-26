// The list rule against the build's mine: the orderings that matter
// (golden orderings: each one a complaint the rule once earned), and that
// every view nests in the rule. A knob change that the tuner settles is
// committed with its golden lines, so a turn that fixes one page can't
// silently break another.

import { describe, expect, test } from 'vitest';
import type { Crown, Dir } from './types.ts';
import { P, teams, builtEpochDay } from './model.ts';
import { mineCrowns, mineBroken } from './crowns.ts';
import { LIST, listCrowns, withKnobs, admits, isSimple, topListed, topRuns } from './list.ts';
import type { Knobs } from './list.ts';
import { brokenWeeks, brokenDigest, listBroken } from './broken.ts';
import { buildSeasons } from './seasons.ts';
import { atRiskRows, atRiskWeek } from './atRisk.ts';
import { scheduledGames } from './team.ts';
import { keyOf, keyString } from './game.ts';
import { breakersFromSeason, listBreaks, breakRows, breakRanking } from './breakers.ts';
import { listLeaders } from './seasonFile.ts';
import { baseDir, isMargin } from './outcome.ts';

const idx = (id: string) => teams.findIndex((t) => t.id === id);
const [active, all, mined] = await Promise.all([mineCrowns('active'), mineCrowns('all'), mineBroken()]);
const today = builtEpochDay;
const words = (c: { dir: string; len: number; chips: string[] }) => `${c.dir} ${c.len} ${c.chips.join('+') || 'all games'}`;
const MEDAL = withKnobs({ 'admit.rank': 3 });
const KNOBS: [string, Knobs][] = [['the shipped knobs', LIST], ['the medal rule', MEDAL]];

describe('golden orderings', () => {
  test('Oklahoma, all-time: the plain 47-game winning streak of 1953–57 is on the list, in its top five', () => {
    const list = listCrowns(all.get(idx('oklahoma'))!).filter((c) => !c.subStreak);
    const at = list.findIndex((c) => c.dir === 'W' && c.chips.length === 0 && c.len === 47 && c.startSe === 1953);
    expect(at, list.slice(0, 8).map(words).join(' | ')).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(5);
  });

  test('Notre Dame, active: a conference or non-conference run reads only its 2020 ACC season, and its plain run is in the file at its true place', () => {
    const rows = active.get(idx('notre-dame'))!;
    const conf = (t: { chips: string[] }) => t.chips.includes('nonconf') || t.chips.includes('confgame');
    for (const r of rows) {
      if (conf(r) || (r.highest && conf(r.highest))) { expect(r.startSe, words(r)).toBe(2020); expect(r.endSe, words(r)).toBe(2020); }
    }
    // the team's current run under no condition: on the page as "N straight" once the admit knob reaches its place
    const plain = rows.find((r) => r.chips.length === 0 && (r.dir === 'W' || r.dir === 'L'));
    if (!plain) return; // a run too short, or placed past what the file keeps
    // under no condition, or as the same games told by their margin ("16 straight by 10+" says "16 straight" and more)
    const told = listCrowns(rows, undefined, withKnobs({ 'admit.rank': plain.rank })).find((c) => baseDir(c.dir) === plain.dir && c.len === plain.len && c.startSe === plain.startSe && c.chips.length === 0);
    expect(told, words(plain)).toBeDefined();
    if (!isMargin(told!.dir)) expect(told!.rank).toBe(plain.rank);
  });

  test('every team: a run is never shown with more words than a placing of the same run that admits', () => {
    for (const [scope, m] of [['active', active], ['all', all]] as const) {
      for (const [ti, rows] of m) {
        for (const c of listCrowns(rows)) {
          if (c.other && c.other.chips.length < c.chips.length) expect(admits(c.other, c.len), `${teams[ti].id} ${scope} ${words(c)}`).toBe(false);
        }
      }
    }
  }, 180_000); // 272 lists through the rule: ~19s on a laptop, past the 30s default on a CI runner

  test('every team: its current run under no condition is in the file at its true place, and told plainly once the admit knob reaches it', () => {
    let n = 0;
    for (const [ti, rows] of active) {
      for (const plain of rows.filter((r) => r.chips.length === 0 && (r.dir === 'W' || r.dir === 'L'))) {
        const told = listCrowns(rows, undefined, withKnobs({ 'admit.rank': plain.rank })).find((c) => baseDir(c.dir) === plain.dir && c.len === plain.len && c.startSe === plain.startSe && c.chips.length === 0);
        expect(told, `${teams[ti].id} ${words(plain)}`).toBeDefined();
        if (!isMargin(told!.dir)) expect(told!.rank).toBe(plain.rank);
        n++;
      }
    }
    expect(n).toBeGreaterThan(3); // a place in the plain field is rare: the file keeps a run placed third or better, so a handful of teams
  });

  test('the medal rule admits more, never less; an active run admitted both ways stays (told simpler when its simpler placing now admits; all-time, a newly admitted simpler run may absorb a run a stricter outcome covers)', () => {
    for (const rows of [all.get(idx('alabama'))!, active.get(idx('georgia'))!]) {
      const one = listCrowns(rows), three = listCrowns(rows, undefined, MEDAL);
      expect(three.length).toBeGreaterThanOrEqual(one.length);
      if (rows[0]?.scope !== 'active') continue;
      // the same run: the same games under the definition with the fewest conditions, which names a run once (or under its by-10 outcome, once that admits too)
      const fewestWords = (x: Crown) => [x.chips, ...(x.other ? [x.other.chips] : [])].map((w) => w.join()).sort((a, b) => a.split(',').length - b.split(',').length || a.localeCompare(b))[0];
      const same = (x: Crown, c: Crown) => baseDir(x.dir) === baseDir(c.dir) && x.len === c.len && x.startSe === c.startSe && x.endSe === c.endSe && fewestWords(x) === fewestWords(c);
      for (const c of one) {
        const m = three.find((x) => same(x, c));
        expect(m, words(c)).toBeDefined();
        expect(m!.chips.length).toBeLessThanOrEqual(c.chips.length);
      }
    }
  });
});

describe('simple and trivia (specs/trivia.spec.md)', () => {
  const season = buildSeasons(mined).get(P.currentSeason);
  const weeks = brokenWeeks(mined);
  const games = scheduledGames();
  const week = games.filter((g) => g.wk === games[0]?.wk);

  test('no simple list carries a row past the rule: a team page, a game page, the digests, the breakers', () => {
    const past = (c: { chips: string[]; dir: Dir }) => !isSimple(c);
    for (const m of [active, all]) for (const [ti, rows] of m) for (const c of listCrowns(rows)) expect(past(c), `${teams[ti].id} ${words(c)}`).toBe(false);
    if (season) {
      for (const [k, g] of season.games) {
        for (const b of listBroken(g.ended)) expect(past(b), `${k} ${words(b)}`).toBe(false);
        for (const l of listLeaders(g.leaders)) expect(past(l), `${k} ${words(l)}`).toBe(false);
      }
      const breakers = breakersFromSeason(season);
      for (const [, rows] of breakers.teams) for (const b of listBreaks(rows)) expect(past(b), words(b)).toBe(false);
    }
    for (const w of weeks.values()) {
      const d = brokenDigest(w);
      for (const b of [...d.list, ...d.more, ...d.subStreaks]) expect(past(b), words(b)).toBe(false);
    }
    if (week.length) {
      const r = atRiskWeek(atRiskRows(week, today, (ti) => active.get(ti) ?? []));
      for (const x of [...r.list, ...r.more, ...r.subStreaks]) expect(past(x.s), words(x.s)).toBe(false);
    }
  }, 180_000);

  test('a trivia row is never shown with fewer conditions than makes it trivia, and the two parts cover every standing row', () => {
    for (const m of [active, all]) {
      for (const [ti, rows] of m) {
        const trivia = listCrowns(rows, undefined, LIST, 'trivia');
        for (const c of trivia) expect(isSimple(c), `${teams[ti].id} ${words(c)}`).toBe(false);
        // every standing row of the whole list is on one of the two
        const simple = listCrowns(rows);
        const key = (c: Crown) => `${c.dir}|${c.chips.join()}|${c.len}|${c.startSe}`;
        const parts = new Set([...simple, ...trivia].map(key));
        for (const c of listCrowns(rows, undefined, LIST, 'any')) if (!c.subStreak) expect(parts.has(key(c)), `${teams[ti].id} ${words(c)}`).toBe(true);
      }
    }
  }, 180_000);

  test('every team: the all-time top a team page embeds lists the same rows, words, scores and flags as the whole file\'s top', () => {
    const shown = (c: Crown) => `${words(c)}|${c.startSe}|${c.rank}|${c.score.toFixed(9)}|${c.subStreak}`;
    for (const m of [all, active]) {
      for (const [ti, rows] of m) {
        const full = topListed(listCrowns(rows)).map(shown);
        expect(topListed(listCrowns(topRuns(rows))).map(shown), teams[ti].id).toEqual(full);
      }
    }
  }, 180_000);

  test('trivia is off the breakers board: a trivia break earns nothing and counts nowhere', () => {
    if (!season) return;
    const breakers = breakersFromSeason(season);
    const triviaBreaks = [...breakers.teams.values()].flatMap((rows) => listBroken(rows, undefined, LIST, 'trivia'));
    expect(triviaBreaks.length).toBeGreaterThan(0); // the file still carries them, for a team page's folded line
    for (const s of breakRanking(breakers)) {
      const rows = breakRows(listBreaks(breakers.teams.get(s.ti)!)).filter((b) => !b.subStreak);
      expect(s.n).toBe(rows.length);
    }
  });

  test('a game\'s rows nest in its week\'s digest, part by part: every simple row is in the simple digest, every trivia row in its trivia line', () => {
    const last = [...weeks.values()].at(-1);
    if (!last || !season) return;
    const d = brokenDigest(last);
    const id = (b: { ti: number; dir: string; len: number; run: number; chips: string[] }) => `${b.ti}|${b.dir}|${b.len}|${b.run}|${b.chips.join()}`;
    const simple = new Set([...d.list, ...d.more, ...d.subStreaks].map(id));
    const trivia = new Set(d.trivia.map(id));
    const keys = new Set(last.rows.map((b) => keyString(keyOf(b.ti, b.ender))));
    let n = 0;
    for (const k of keys) {
      const g = season.games.get(k);
      if (!g) continue;
      for (const b of listBroken(g.ended)) { expect(simple.has(id(b)), `${k} ${words(b)}`).toBe(true); n++; }
      for (const b of listBroken(g.ended, undefined, LIST, 'trivia')) expect(trivia.has(id(b)), `${k} ${words(b)}`).toBe(true);
    }
    expect(n).toBeGreaterThan(0);
  });
});

describe('every view nests in the rule', () => {
  const games = scheduledGames();
  const wk = games[0]?.wk;
  const week = games.filter((g) => g.wk === wk);
  const season = buildSeasons(mined).get(P.currentSeason);
  const weeks = brokenWeeks(mined);

  test.each(KNOBS)('at risk, under %s: each row is on its team’s list with the same words, place and score', (_n, w) => {
    if (!week.length) return;
    const lists = new Map<number, Crown[]>();
    const listOf = (ti: number) => lists.get(ti) ?? lists.set(ti, listCrowns(active.get(ti) ?? [], undefined, w)).get(ti)!;
    const { list, more, subStreaks } = atRiskWeek(atRiskRows(week, today, (ti) => active.get(ti) ?? []), undefined, w);
    expect(list.length).toBeGreaterThan(0);
    for (const r of [...list, ...more, ...subStreaks]) {
      const own = listOf(r.ti).find((c) => c.dir === r.s.dir && c.len === r.s.len && c.startSe === r.s.startSe && c.chips.join() === r.s.chips.join());
      expect(own, `${teams[r.ti].id} ${words(r.s)}`).toBeDefined();
      expect(own!.rank).toBe(r.s.rank);
      expect(own!.score).toBeCloseTo(r.s.score, 9);
    }
  });

  test.each(KNOBS)('a week’s broken digest, under %s: each row is on its game’s page with the same words, score and flag', (_n, w) => {
    const last = [...weeks.values()].at(-1);
    if (!last || !season) return;
    const d = brokenDigest(last, undefined, w);
    expect(d.list.length).toBeGreaterThan(0);
    const listed = new Map<string, ReturnType<typeof listBroken>>();
    for (const b of [...d.list, ...d.more, ...d.subStreaks]) {
      const k = keyString(keyOf(b.ti, b.ender));
      const rows = listed.get(k) ?? listed.set(k, listBroken(season.games.get(k)!.ended, undefined, w)).get(k)!;
      const same = rows.find((x) => x.ti === b.ti && x.dir === b.dir && x.len === b.len && x.run === b.run && x.chips.join() === b.chips.join());
      expect(same, `${teams[b.ti].id} ${words(b)}`).toBeDefined();
      expect(same!.score).toBeCloseTo(b.score, 9);
      expect(same!.subStreak).toBe(b.subStreak);
    }
  });

  test.each(KNOBS)('the breakers, under %s: a game’s standing breaks by its winner are exactly what the winner is credited for it', (_n, w) => {
    if (!season) return;
    const breakers = breakersFromSeason(season);
    const credits = new Map<string, number>(); // breaker|game -> count
    for (const [breaker, rows] of breakers.teams) {
      for (const b of breakRows(listBreaks(rows, undefined, w))) {
        if (b.subStreak) continue;
        const k = `${breaker}|${b.ender.i}`;
        credits.set(k, (credits.get(k) ?? 0) + 1);
      }
    }
    let checked = 0;
    for (const [, g] of season.games) {
      const byWinner = new Map<string, number>();
      for (const b of listBroken(g.ended, undefined, w)) {
        if (b.subStreak || b.dir === 'C' || b.dir === 'N' || baseDir(b.dir) !== 'W' || b.ender.r !== 'L') continue;
        const k = `${b.ender.oppIdx}|${b.ender.i}`;
        byWinner.set(k, (byWinner.get(k) ?? 0) + 1);
      }
      for (const [k, n] of byWinner) { expect(credits.get(k), k).toBe(n); checked++; }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
