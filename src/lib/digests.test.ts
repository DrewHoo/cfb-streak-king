import { expect, test } from 'vitest';
import { builtEpochDay } from './model.ts';
import { mineBroken, mineCrowns } from './crowns.ts';
import { buildDigests, encodeDigests, decodeDigests } from './digests.ts';
import { scheduledGames } from './team.ts';

test('the schedule’s digests survive the file encoding', async () => {
  const [mined, crowns] = await Promise.all([mineBroken(), mineCrowns('active')]);
  const d = buildDigests(builtEpochDay, mined, (ti) => crowns.get(ti) ?? []);
  const back = decodeDigests(JSON.parse(JSON.stringify(encodeDigests(d))));
  // what the file rounds
  const r2 = (x: number) => +x.toPrecision(2);
  const r = (x: number, k: number) => +x.toFixed(k) || 0;
  for (const [wk, w] of Object.entries(d.broken)) {
    const b = back.broken[Number(wk)];
    expect(b.list.length).toBe(w.list.length);
    expect(b.more.length).toBe(w.more.length);
    for (const [i, x] of [...w.list, ...w.more].entries()) {
      const y = [...b.list, ...b.more][i];
      const label = `week ${wk} row ${i}: ${x.chips.join('+')} ${x.dir} ${x.len}`;
      const want = { ti: x.ti, chips: x.chips, dir: x.dir, len: x.len, rank: x.rank, tied: x.tied, field: x.field, since: x.since, run: x.run, chance: r2(x.chance), score: r(x.score, 2) };
      for (const [k, v] of Object.entries(want)) expect(y[k as keyof typeof y], `${label} ${k}`).toEqual(v);
      expect(y.ender, `${label} ender`).toBe(x.ender);
    }
  }
  if (d.atRisk) {
    expect(back.atRisk!.wk).toBe(d.atRisk.wk);
    expect(back.atRisk!.list.length).toBe(d.atRisk.list.length);
    for (const [i, x] of d.atRisk.list.entries()) {
      const y = back.atRisk!.list[i];
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
  }
}, 600000);
