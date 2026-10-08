// The line under the sentence: how often the outcome happens under the
// definition, over every current FBS team's games, each from that team's
// side. A game between two of them counts once each way; a game against
// anyone else counts once, so a symmetric condition sits a little above 50%
// (the notes say so). Hidden under 10 games, where a percentage says little.

import { useMemo } from 'react';
import { baseRate } from '../lib/model.ts';
import { definitionPhrase } from '../lib/sentence.ts';
import { baseDir, marginOf } from '../lib/outcome.ts';

const VERBS = { W: 'have won', L: 'have lost', U: 'have won or tied', C: 'have covered in', N: 'have failed to cover in' };
// "have won by 10+ in": the margin outcome's rate is over every qualifying game
const verb = (dir) => (marginOf(dir) ? `${VERBS[baseDir(dir)]} by ${marginOf(dir)}+ in` : VERBS[dir]);

export function BaseRate({ active, dir }) {
  const r = useMemo(() => baseRate(active, dir), [active, dir]);
  if (!r || r.n < 10) return null;
  return (
    <p className="baserate">
      Since {r.from}, FBS teams {verb(dir)} <b>{Math.round((100 * r.hit) / r.n)}%</b> of their {r.n.toLocaleString('en-US')} {definitionPhrase(active)}.
    </p>
  );
}
