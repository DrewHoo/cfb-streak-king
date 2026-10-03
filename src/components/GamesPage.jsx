// The schedule: every scheduled game with an FBS team, by week, with the
// line as of the build and the streak most on the line in it. The first week
// (the one with games still unrecorded) is open; later weeks open on a tap.
// A row opens the game's matchup.

import { useMemo, useState } from 'react';
import { P, teams, fbsNow } from '../lib/model.ts';
import { scheduledGames, lineText, topOnLine, seasonRecord, recordText, rankText } from '../lib/team.ts';
import { dayOf, monthDay, kickOf, gamesWord } from '../lib/format.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron } from './Icons.jsx';
import { streakWords } from './Matchup.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ep) => MONTHS[new Date(ep * 86400000).getUTCMonth()];
const dayNum = (ep) => new Date(ep * 86400000).getUTCDate();
// "Oct 1–4", "Oct 29 – Nov 1"
function span(a, b) {
  if (a === b) return `${monthName(a)} ${dayNum(a)}`;
  return monthName(a) === monthName(b) ? `${monthName(a)} ${dayNum(a)}–${dayNum(b)}` : `${monthName(a)} ${dayNum(a)} – ${monthName(b)} ${dayNum(b)}`;
}

// on a phone a team with a mark is its mark, rank and record; the name stays for one without
function Side({ ti, rank }) {
  const t = teams[ti];
  return (
    <span className={'gm-team' + (t?.espn ? ' marked' : '')} title={t?.name}>
      {t?.espn ? <TeamMark ti={ti} className="gm-logo" /> : <b className="gm-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      <span className="gm-name">{rank > 0 && <i>#{rank} </i>}<span className="gm-nm">{t?.name ?? '?'}</span></span>
      {fbsNow.has(ti) && <small>{recordText(seasonRecord(ti))}</small>}
    </span>
  );
}

function Row({ g, todayEp, onGame }) {
  const top = topOnLine(g, todayEp);
  const line = lineText(g);
  // the matchup from an FBS side, the home one when both are
  const side = g.sides.find((s) => s.ti === g.home) ?? g.sides[0];
  return (
    <button className="gm" onClick={() => onGame(side.ti, side.row)} aria-label={`${teams[g.away].name} ${g.neutral ? 'vs' : 'at'} ${teams[g.home].name}: the matchup`}>
      <span className="gm-when">{dayOf(g.ep)} {monthDay(g.ep)}<small>{kickOf(g) || 'TBA'}</small></span>
      <span className="gm-teams">
        <Side ti={g.away} rank={g.awayRank} />
        <i>{g.neutral ? 'vs' : 'at'}</i>
        <Side ti={g.home} rank={g.homeRank} />
      </span>
      <span className="gm-line">{line ?? <small>no line</small>}</span>
      <span className="gm-tease">
        {top
          ? <><b>{teams[top.ti].name}</b> · {top.s.len}{top.s.atEdge ? '+' : ''} {gamesWord(top.s.dir, top.s.len)} · {streakWords(top.s.chips)} · {rankText(top.s)} of {top.s.field}</>
          : 'no streak of 4 or more on the line'}
      </span>
      <Chevron />
    </button>
  );
}

export function GamesPage({ todayEp, copied, on }) {
  const weeks = useMemo(() => {
    const byWk = new Map();
    for (const g of scheduledGames()) (byWk.get(g.wk) ?? byWk.set(g.wk, []).get(g.wk)).push(g);
    return [...byWk.entries()].sort((a, b) => a[0] - b[0]);
  }, []);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (wk) => setOpen((cur) => { const next = new Set(cur); if (next.has(wk)) next.delete(wk); else next.add(wk); return next; });
  return (
    <div className="gpg">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <span className="dateline-acts">
          <button className="ico" onClick={on.share} aria-label="Share the schedule"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className="gpg-h1">{P.currentSeason} games</h1>
      <p className="tpg-note">Every scheduled game with an FBS team, the line as of {monthDay(Math.floor(Date.parse(P.builtAt) / 86400000))}, and the streak most on the line in it. Results land with the weekly rebuild.</p>
      {weeks.length === 0 && <p className="empty">No games are scheduled.</p>}
      {weeks.map(([wk, games], i) => {
        const shown = i === 0 || open.has(wk);
        return (
          <section key={wk} className="gwk">
            <button className={'gwk-h' + (shown ? ' on' : '')} onClick={() => toggle(wk)} aria-expanded={shown} disabled={i === 0}>
              <span>Week {wk}</span>
              <small>{span(games[0].ep, games[games.length - 1].ep)} · {games.length} games</small>
              {i > 0 && <Chevron />}
            </button>
            {shown && <div className="gwk-list">{games.map((g) => <Row key={g.i} g={g} todayEp={todayEp} onGame={on.game} />)}</div>}
          </section>
        );
      })}
    </div>
  );
}
