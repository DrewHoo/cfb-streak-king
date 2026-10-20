// The line under the sentence: how often the outcome happens under the
// definition, over every current FBS team's games, each from that team's
// side. A game between two of them counts once each way; a game against
// anyone else counts once, so a symmetric condition sits a little above 50%
// (the notes say so). Hidden under 10 games, where a percentage says little.

import { useMemo } from 'react';
import { baseRate, teams, gamesOf } from '../lib/model.ts';
import { qualifies, chipByKey } from '../lib/chips.ts';
import { matches, decided } from '../lib/streaks.ts';
import { definitionPhrase } from '../lib/sentence.ts';
import { baseDir, marginOf } from '../lib/outcome.ts';

const VERBS = { W: 'have won', L: 'have lost', U: 'have won or tied', C: 'have covered in', N: 'have failed to cover in' };
// "have won by 10+ in": the margin outcome's rate is over every qualifying game
const verb = (dir) => (marginOf(dir) ? `${VERBS[baseDir(dir)]} by ${marginOf(dir)}+ in` : VERBS[dir]);

// one team's own rate under the definition, for a by-opponent board: its columns are all its games
function ownRate(ti, active, dir) {
  let n = 0, hit = 0, from = Infinity;
  for (const g of gamesOf(ti)) {
    if (!decided(dir, g) || !active.every((a) => qualifies(chipByKey.get(a.key), g, a.param))) continue;
    n++;
    if (matches(dir, g)) hit++;
    if (g.se < from) from = g.se;
  }
  return n ? { hit, n, from } : null;
}

export function BaseRate({ active, dir, as = null }) {
  const r = useMemo(() => (as != null ? ownRate(as, active, dir) : baseRate(active, dir)), [as, active, dir]);
  if (!r || r.n < 10) return null;
  const who = as != null ? teams[as].name : 'FBS teams';
  const have = as != null ? verb(dir).replace(/^have/, 'has') : verb(dir);
  return (
    <p className="baserate">
      Since {r.from}, {who} {have} <b>{Math.round((100 * r.hit) / r.n)}%</b> of {as != null ? 'its' : 'their'} {r.n.toLocaleString('en-US')} {definitionPhrase(active)}.
    </p>
  );
}
