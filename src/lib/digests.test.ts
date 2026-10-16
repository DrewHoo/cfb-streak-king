import { expect, test } from 'vitest';
import { builtEpochDay } from './model.ts';
import { mineBroken, mineCrowns } from './crowns.ts';
import { buildDigests, encodeDigests, decodeDigests } from './digests.ts';
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
