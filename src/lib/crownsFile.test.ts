import { expect, test } from 'vitest';
import { fbsNow } from './model.ts';
import { mineCrowns } from './crowns.ts';
import { encodeCrowns, decodeCrowns } from './crownsFile.ts';

test('every team’s crowns survive the file encoding', async () => {
  const [active, all] = await Promise.all([mineCrowns('active'), mineCrowns('all')]);
  for (const ti of fbsNow) {
    const c = { active: active.get(ti) ?? [], all: all.get(ti) ?? [] };
    const back = decodeCrowns(JSON.parse(JSON.stringify(encodeCrowns(c))));
    const rounded = (list: typeof c.active) => list.map((x) => ({ ...x, chance: +x.chance.toPrecision(2) }));
    expect(back).toEqual(JSON.parse(JSON.stringify({ active: rounded(c.active), all: rounded(c.all) })));
  }
}, 60000);
