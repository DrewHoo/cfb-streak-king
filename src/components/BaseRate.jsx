// The line under the sentence: how often the outcome happens under the
// definition, over every current FBS team's games. Hidden under 10 games,
// where a percentage says little.

import { useMemo } from 'react';
import { baseRate } from '../lib/model.ts';

const VERBS = { W: 'have won', L: 'have lost', U: 'have won or tied', C: 'have covered in', N: 'have failed to cover in' };

export function BaseRate({ active, dir }) {
  const r = useMemo(() => baseRate(active, dir), [active, dir]);
  if (!r || r.n < 10) return null;
  return (
    <p className="baserate">
      Teams {VERBS[dir]} <b>{Math.round((100 * r.hit) / r.n)}%</b> of these {r.n.toLocaleString('en-US')} games since {r.from}.
    </p>
  );
}
