import { expect, test } from 'vitest';
import { P, builtEpochDay, fbsNow } from './model.ts';
import { mineBroken, mineCrowns } from './crowns.ts';
import { buildDigests, encodeDigests, decodeDigests } from './digests.ts';
import type { DigestsFile } from './digests.ts';
import { scheduledGames } from './team.ts';
import { listCrowns } from './list.ts';

test('the schedule’s digests survive the file encoding', async () => {
  const [mined, crowns] = await Promise.all([mineBroken(), mineCrowns('active')]);
  const listed = new Map<number, ReturnType<typeof listCrowns>>();
  const d = buildDigests(builtEpochDay, mined, (ti) => crowns.get(ti) ?? [], (ti) => listed.get(ti) ?? listed.set(ti, listCrowns(crowns.get(ti) ?? [])).get(ti)!);
  const back = decodeDigests(JSON.parse(JSON.stringify(encodeDigests(d))));
  // what the file rounds
  const r4 = (x: number) => +x.toFixed(4);
  for (const [wk, w] of Object.entries(d.broken)) {
    const b = back.broken[Number(wk)];
    expect(b.rows.length).toBe(w.rows.length);
    for (const [i, x] of w.rows.entries()) {
      const y = b.rows[i];
      const label = `week ${wk} row ${i}: ${x.chips.join('+')} ${x.dir} ${x.len}`;
      const want = { ti: x.ti, chips: x.chips, dir: x.dir, len: x.len, rank: x.rank, tied: x.tied, field: x.field, since: x.since, run: x.run, p: r4(x.p), n: x.n, hT: x.hT, nT: x.nT, everLen: x.everLen };
      for (const [k, v] of Object.entries(want)) expect(y[k as keyof typeof y], `${label} ${k}`).toEqual(v);
      expect(y.ender, `${label} ender`).toBe(x.ender);
    }
  }
  if (d.atRisk) {
    expect(back.atRisk!.wk).toBe(d.atRisk.wk);
    expect(back.atRisk!.rows.length).toBe(d.atRisk.rows.length);
    for (const [i, x] of d.atRisk.rows.entries()) {
      const y = back.atRisk!.rows[i];
      expect(y.ti).toBe(x.ti);
      expect(y.game).toBe(x.game);
      expect(y.row).toBe(x.row);
      expect(y.p).toBeCloseTo(x.p, 3);
      expect(y.s).toMatchObject({ chips: x.s.chips, dir: x.s.dir, len: x.s.len, rank: x.s.rank, since: x.s.since });
      expect(y.s.next).toBe(x.s.next);
    }
  }
  const games = scheduledGames();
  expect(Object.keys(d.onLine).length).toBeGreaterThan(0);
  for (const [i, top] of Object.entries(d.onLine)) {
    const y = back.onLine[Number(i)];
    expect(games.some((g) => g.i === Number(i))).toBe(true);
    expect(y.ti).toBe(top.ti);
    expect(y.s).toMatchObject({ chips: top.s.chips, dir: top.s.dir, len: top.s.len, rank: top.s.rank, field: top.s.field });
    expect(y.s.next?.i).toBe(Number(i));
    // the top is a longest active streak, and the count holds it
    expect(top.s.rank).toBe(1);
    expect(top.n).toBeGreaterThanOrEqual(1);
    expect(y.n).toBe(top.n);
  }
}, 600000);

test('a file from another build keeps no picks per game: a rebuild renumbers the games', () => {
  const g = scheduledGames()[0];
  const row: DigestsFile['onLine'][number][1] = ['home', 'W', 5, 0, 40, 1, 1, 4, 2025, null, 1, 0, 0.6, 20, 0, 0, 0, 0, 0];
  const f = (builtAt: string): DigestsFile => ({ v: 2, builtAt, broken: {}, atRisk: { wk: g.wk, lo: g.ep, hi: g.ep, rows: [] }, onLine: { [g.i]: [g.sides[0].ti, row, 1] } });
  const stale = decodeDigests(f('2001-01-01T00:00:00.000Z'));
  expect(stale.onLine).toEqual({});
  expect(stale.atRisk).toBeNull();
  // a pick whose team doesn't play the game is dropped too
  const fresh = f(P.builtAt);
  const other = [...fbsNow].find((ti) => !g.sides.some((x) => x.ti === ti))!;
  fresh.onLine[g.i][0] = other;
  expect(decodeDigests(fresh).onLine).toEqual({});
});
