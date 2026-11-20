// The GTA boards' method, shown rather than told: one team's game after
// every mainline Grand Theft Auto release, counted the loose way (its next
// game, however late) beside ours (only a game in the release week). The
// team is San Diego State, whose 0-7 "right after a GTA release" went around
// on release day; the rows are computed from the games (gtaLedger), never
// typed. A native popover, so the prerendered page carries the table too.

import { useMemo } from 'react';
import { teams, gamesOf, upcomingOf } from '../lib/model.ts';
import { gtaLedger } from '../lib/gta.ts';
import { siteWord } from '../lib/format.ts';
import { track } from '../lib/analytics.ts';
import { COPY } from './gtaCopy.js';

const TEAM_ID = 'san-diego-state';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const date = (ep) => { const d = new Date(ep * 86400000); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
// "GTA 2", "Vice City": the subtitle where there is one
const shortTitle = (game) => game.replace(/^Grand Theft Auto: /, '').replace(/^Grand Theft Auto/, 'GTA');

const record = (rows) => {
  const w = rows.filter((r) => r.next?.r === 'W').length;
  const l = rows.filter((r) => r.next?.r === 'L').length;
  const t = rows.filter((r) => r.next?.r === 'T').length;
  return `${w}-${l}${t ? `-${t}` : ''}`;
};

export function GtaMethod() {
  const ti = useMemo(() => teams.findIndex((t) => t.id === TEAM_ID), []);
  const rows = useMemo(() => {
    if (ti < 0) return [];
    const played = gamesOf(ti).map((g) => ({ ep: g.ep, oppIdx: g.oppIdx, home: g.home, neutral: g.neutral, r: g.r, us: g.us, them: g.them }));
    const upcoming = upcomingOf(ti).map((u) => ({ ep: u.ep, oppIdx: u.oppIdx, home: u.home, neutral: u.neutral }));
    return gtaLedger([...played, ...upcoming]);
  }, [ti]);
  if (!rows.length) return null;
  const name = teams[ti].name;
  const decided = rows.filter((r) => r.next?.r);
  return (
    <>
      <button type="button" className="gta-method-btn" popoverTarget="gta-method">{COPY.button}</button>
      <div id="gta-method" className="gta-method" popover="auto" onToggle={(e) => { if (e.newState === 'open') track('gta method open'); }}>
        <h2>{COPY.heading}</h2>
        <p>{COPY.intro(name)}</p>
        <table>
          <thead>
            <tr><th>{COPY.colRelease}</th><th>{COPY.colGame(name)}</th><th className="num">{COPY.colDays}</th><th>{COPY.colCounts}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.game} className={r.inWeek ? 'in' : 'out'}>
                <td><b>{shortTitle(r.game)}</b><span>{date(r.releaseEp)}</span></td>
                <td>
                  {r.next ? <>{siteWord(r.next)} {teams[r.next.oppIdx].name}<span>{date(r.next.ep)}{r.next.r ? <>, <b className={`res res-${r.next.r}`}>{r.next.r} {r.next.us}-{r.next.them}</b></> : `, ${COPY.toPlay}`}</span></> : '—'}
                </td>
                <td className="num">{r.days ?? '—'}</td>
                <td>{r.inWeek ? COPY.yes : COPY.no}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="gta-method-sum">{COPY.sum(name, record(decided), record(decided.filter((r) => r.inWeek)))}</p>
        <p className="gta-method-why">{COPY.why}</p>
        <button type="button" className="gta-method-close" popoverTarget="gta-method" popoverTargetAction="hide" aria-label="Close">×</button>
      </div>
    </>
  );
}
