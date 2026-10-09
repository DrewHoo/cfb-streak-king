import { describe, expect, test } from 'vitest';
import { P } from './model.ts';
import { scheduledGames, streaksOn, teamStreaks, h2hStreaksOn } from './team.ts';
import { Phi, pBreak, atRiskWeek, AT_RISK_CAP, AT_RISK_FLOOR } from './atRisk.ts';

const today = Math.floor(Date.parse(P.builtAt) / 86400000);

describe('pBreak', () => {
  test('a pick’em breaks a winning or losing streak about half the time; a big favorite almost never', () => {
    expect(pBreak('W', 0)).toBeCloseTo(0.515, 2);
    expect(pBreak('L', 0)).toBeCloseTo(0.515, 2);
    expect(pBreak('W', -38)!).toBeLessThan(0.01);
    expect(pBreak('L', 38)!).toBeLessThan(0.01);
    expect(pBreak('W', 7)!).toBeGreaterThan(0.6);
    expect(pBreak('L', -7)!).toBeGreaterThan(0.6);
  });
  test('a margin outcome breaks more easily than its plain one; the spread is a coin flip; no line, no answer', () => {
    expect(pBreak('W10', -7)!).toBeGreaterThan(pBreak('W', -7)!);
    expect(pBreak('L10', 7)!).toBeGreaterThan(pBreak('L', 7)!);
    expect(pBreak('W10', -38)!).toBeLessThan(0.05);
    expect(pBreak('C', -20)).toBe(0.5);
    expect(pBreak('N', 20)).toBe(0.5);
    // an undefeated run survives a tie, so it breaks a touch less often than a winning one
    expect(pBreak('U', 3)!).toBeLessThan(pBreak('W', 3)!);
    expect(pBreak('W', 3)! - pBreak('U', 3)!).toBeLessThan(0.05);
    expect(pBreak('W', null)).toBeNull();
  });
  test('Phi is a CDF', () => {
    expect(Phi(0)).toBeCloseTo(0.5, 6);
    expect(Phi(1.96)).toBeCloseTo(0.975, 3);
    expect(Phi(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe('atRiskWeek', () => {
  const games = scheduledGames();
  const wk = games[0]?.wk;
  const week = games.filter((g) => g.wk === wk);
  test('ranks every lined streak on the line by score × chance, once each, a team once in the list, with the cap and floor', () => {
    if (!week.length) return;
    const { list, more } = atRiskWeek(week, today);
    const all = [...list, ...more];
    expect(list.length).toBeLessThanOrEqual(AT_RISK_CAP);
    expect(new Set(list.map((r) => r.ti)).size).toBe(list.length);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].stake).toBeGreaterThanOrEqual(list[i].stake);
    for (let i = 1; i < more.length; i++) expect(more[i - 1].stake).toBeGreaterThanOrEqual(more[i].stake);
    const listed = new Set(list.map((r) => r.ti));
    for (const r of more) expect(list.length === AT_RISK_CAP || listed.has(r.ti)).toBe(true);
    for (const r of all) {
      expect(r.stake).toBeCloseTo(r.s.score * r.p, 9);
      expect(r.stake).toBeGreaterThanOrEqual(AT_RISK_FLOOR);
      expect(r.row.sp).not.toBeNull();
      expect(r.game.sides.some((x) => x.ti === r.ti && x.row === r.row)).toBe(true);
      // the streak really is on the line in that game
      const on = [...streaksOn(teamStreaks(r.ti, today), r.row), ...h2hStreaksOn(r.ti, r.row)];
      expect(on.some((s) => s.dir === r.s.dir && s.len === r.s.len && s.since === r.s.since)).toBe(true);
    }
    const keys = all.map((r) => `${r.ti}|${r.s.dir}|${r.s.len}|${r.s.since}|${r.s.vs ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
