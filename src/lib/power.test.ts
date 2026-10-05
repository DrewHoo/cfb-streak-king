import { describe, expect, test } from 'vitest';
import { POWER_FROM, isPowerConf, isPowerOpp } from './power.ts';
import { chipByKey } from './chips.ts';
import { P, teams, fbsNow, gamesOf } from './model.ts';

describe('era boundaries', () => {
  test('nothing is power before the BCS', () => {
    for (const conf of ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'Big East']) {
      expect(isPowerConf(conf, 1997), conf).toBe(false);
      expect(isPowerConf(conf, POWER_FROM), conf).toBe(true);
    }
  });
  test('the Big East hands its berth to the American for 2013 only', () => {
    expect(isPowerConf('Big East', 2012)).toBe(true);
    expect(isPowerConf('Big East', 2013)).toBe(false);
    expect(isPowerConf('American', 2012)).toBe(false);
    expect(isPowerConf('American', 2013)).toBe(true);
    expect(isPowerConf('American', 2014)).toBe(false);
  });
  test('the Pac-12 falls out of the club after 2023', () => {
    expect(isPowerConf('Pac-12', 2023)).toBe(true);
    expect(isPowerConf('Pac-12', 2024)).toBe(false);
    expect(isPowerConf('Pac-12', 2026)).toBe(false); // the Mountain West rebuild
  });
  test('never a power conference', () => {
    for (const conf of [null, 'Independent', 'Mountain West', 'C-USA', 'MAC', 'Sun Belt', 'WAC', 'SWC', 'Big 8']) {
      for (const se of [1998, 2013, 2020, 2025]) expect(isPowerConf(conf, se), `${conf} ${se}`).toBe(false);
    }
  });
  test('Notre Dame counts by team exception, era-wide but not before', () => {
    expect(isPowerOpp('notre-dame', 'Independent', 1997)).toBe(false);
    expect(isPowerOpp('notre-dame', 'Independent', 1998)).toBe(true);
    expect(isPowerOpp('notre-dame', 'ACC', 2020)).toBe(true);
    expect(isPowerOpp('notre-dame', 'Independent', 2025)).toBe(true);
  });
  test('Army never counts, whatever it was in', () => {
    expect(isPowerOpp('army', 'C-USA', 2000)).toBe(false);
    expect(isPowerOpp('army', 'Independent', 2010)).toBe(false);
    expect(isPowerOpp('army', 'American', 2025)).toBe(false);
  });
  test('the chip’s floor is the table’s first season', () => {
    expect(chipByKey.get('power')!.floor!.season).toBe(POWER_FROM);
  });
});

describe('against the payload', () => {
  const all = [...fbsNow].flatMap((ti) => gamesOf(ti));
  const vs = (id: string, se: number) => all.filter((g) => teams[g.oppIdx].id === id && g.se === se);

  test('a game against Notre Dame counts as power in any era season', () => {
    for (const se of [1998, 2015, 2021]) {
      const rows = vs('notre-dame', se);
      expect(rows.length, String(se)).toBeGreaterThan(0);
      expect(rows.every((g) => g.oppPower), String(se)).toBe(true);
    }
    const before = vs('notre-dame', 1997);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((g) => g.oppPower)).toBe(false);
  });
  test('a game against Army never does', () => {
    for (const se of [2000, 2010, 2025]) {
      const rows = vs('army', se);
      expect(rows.length, String(se)).toBeGreaterThan(0);
      expect(rows.some((g) => g.oppPower), String(se)).toBe(false);
    }
  });
  test('membership is strict: Notre Dame is a member only in 2020', () => {
    const nd = teams.findIndex((t) => t.id === 'notre-dame');
    const own = (se: number) => gamesOf(nd).filter((g) => g.se === se);
    expect(own(2020).every((g) => g.ownPower)).toBe(true);
    for (const se of [1998, 2015, 2021]) expect(own(se).some((g) => g.ownPower), String(se)).toBe(false);
    const vandy = teams.findIndex((t) => t.id === 'vanderbilt');
    const v = gamesOf(vandy);
    expect(v.filter((g) => g.se >= 1998).every((g) => g.ownPower)).toBe(true);
    expect(v.filter((g) => g.se < 1998).some((g) => g.ownPower)).toBe(false);
    const utep = teams.findIndex((t) => t.id === 'utep');
    expect(gamesOf(utep).some((g) => g.ownPower)).toBe(false);
  });
  test('the rump Pac-12 is not power', () => {
    const wsu2024 = vs('washington-state', 2024);
    expect(wsu2024.length).toBeGreaterThan(0);
    expect(wsu2024.some((g) => g.oppPower)).toBe(false);
  });
  test('oppPower only ever appears from the floor on, and does appear', () => {
    expect(all.filter((g) => g.se < POWER_FROM && g.oppPower)).toHaveLength(0);
    expect(all.some((g) => g.se === POWER_FROM && g.oppPower)).toBe(true);
  });
});
