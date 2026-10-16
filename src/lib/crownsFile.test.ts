import { expect, test } from 'vitest';
import { fbsNow, teams } from './model.ts';
import { mineCrowns } from './crowns.ts';
import { encodeCrowns, decodeCrowns, crownsPath } from './crownsFile.ts';

test('every team’s crowns survive the file encoding, a scope a file', async () => {
  const [active, all] = await Promise.all([mineCrowns('active'), mineCrowns('all')]);
  // what the file rounds: a rate to four decimals
  const rounded = (list: ReturnType<typeof decodeCrowns>['rows']) => list.map((x) => ({ ...x, p: +x.p.toFixed(4), ...(x.highest ? { highest: { ...x.highest, p: +x.highest.p.toFixed(4) } } : {}) }));
  for (const ti of fbsNow) {
    for (const [scope, m] of [['active', active], ['all', all]] as const) {
      const rows = m.get(ti) ?? [];
      const back = decodeCrowns(JSON.parse(JSON.stringify(encodeCrowns(scope, rows))));
      expect(back.scope).toBe(scope);
      expect(back.rows).toEqual(JSON.parse(JSON.stringify(rounded(rows))));
    }
  }
}, 600000);

test('the active file is the plain name, the all-time one carries .all', () => {
  expect(crownsPath(teams[0].id, 'active')).toBe(`crowns/${teams[0].id}.json`);
  expect(crownsPath(teams[0].id, 'all')).toBe(`crowns/${teams[0].id}.all.json`);
});
