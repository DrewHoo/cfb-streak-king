// Starred definitions, saved in localStorage from the dateline star. A quiet
// list: on a wide screen it sits in the margin to the right of the page; on
// narrower screens it sits in the flow above What to read next.

import { useMemo } from 'react';
import { teams, activeBoard } from '../lib/model.ts';
import { decodeChips, chipWord } from '../lib/definition.ts';
import { dirWord } from '../lib/format.ts';
import { StarIcon } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL;

export function Starred({ starred, todayEp, onApply, onRemove }) {
  const rows = useMemo(() => starred.map((f) => {
    const chips = decodeChips(f.c);
    const b = activeBoard(chips, f.dir, todayEp);
    const top = b[0];
    return { f, chips, leader: top ? teams[top.ti] : null, len: top ? `${top.s.len}${top.s.atEdge ? '+' : ''}` : '' };
  }), [starred, todayEp]);
  if (!rows.length) return null;
  return (
    <aside className="starred" aria-label="Starred streaks">
      <span className="starred-h"><StarIcon filled /> starred</span>
      {rows.map(({ f, chips, leader, len }) => (
        <div className="starred-row" key={f.c + f.dir}>
          <button className="starred-apply" onClick={() => onApply(f)} title={f.name}>
            {leader?.espn && <img src={`${BASE}logos-color/${leader.espn}.png`} alt="" loading="lazy" />}
            <b>{len}</b>
            <span>{dirWord(f.dir)} · {chips.map(chipWord).join(' · ') || 'all games'}</span>
          </button>
          <button className="starred-x" onClick={() => onRemove(f)} aria-label="Remove from starred">×</button>
        </div>
      ))}
    </aside>
  );
}
