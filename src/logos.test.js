// Every team the payload gives an ESPN id must have both marks committed: the
// one-color mark for result squares and the color mark for column heads,
// next-game chips and the ledger. build-current drops the id of a team whose
// marks aren't there, so a failure here means the payload and public/ are out
// of step: run scripts/gen-logos.mjs.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { teams } from './lib/model.ts';

describe('logos', () => {
  it('has a one-color and a color mark for every team with an ESPN id', () => {
    const missing = teams
      .filter((t) => t.espn)
      .flatMap((t) => ['logos', 'logos-color'].filter((d) => !existsSync(`public/${d}/${t.espn}.png`)).map((d) => `${t.id}: public/${d}/${t.espn}.png`));
    expect(missing).toEqual([]);
  });
});
