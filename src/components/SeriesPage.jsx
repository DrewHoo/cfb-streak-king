// A series: "Alabama vs Tennessee all-time record". The record from one
// team's side, at each site, the run it's on and the longest run each way,
// the next meeting, every game as a square, then every game newest first.
// A meeting since 1936 opens its game page; the ones before are jhowell.net's
// and have none. The other team's side is its own page.

import { useMemo } from 'react';
import { teams, firstSeason } from '../lib/model.ts';
import { seriesOf } from '../lib/series.ts';
import { seriesH1, seriesLead, recText } from '../lib/seriesWords.ts';
import { shortDate, yearOf } from '../lib/format.ts';
import { hrefOf, seriesUrl, teamUrl, asUrl } from '../lib/url.ts';
import { TeamMark } from './Chip.jsx';
import { NextRow } from './TeamPanel.jsx';
import { NavIcons } from './Dateline.jsx';
import { Chevron } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL;

// a meeting as a ledger row, from ti's side: the date, ti's rank, the site
// and the opponent with its rank, the score. One since 1936 opens its game
// page, from whichever side's row the series has it from.
function SeriesRow({ ti, oi, g, onGame }) {
  const opp = teams[oi];
  const Row = g.row ? 'button' : 'div';
  return (
    <Row className={'xrow' + (g.row ? ' game-row' : '')} onClick={g.row ? () => onGame(g.side, g.row) : undefined} aria-label={g.row ? `${teams[ti].name} ${g.site === 'away' ? 'at' : 'vs'} ${opp.name}, ${yearOf(g.ep)}: the game` : undefined}>
      <span className="xd">{shortDate(g.ep)}</span>
      <span className="xown">{g.ownRank > 0 ? `#${g.ownRank}` : ''}</span>
      <span className="xn"><i>{g.site === 'neutral' ? 'N' : g.site === 'home' ? 'vs' : '@'}</i>{opp.espn ? <TeamMark ti={oi} className="xlogo" /> : <b className="xini">{opp.name[0]}</b>}{g.oppRank > 0 && <b>#{g.oppRank} </b>}{opp.name}</span>
      <span className={'xsc' + (g.r === 'W' ? ' w' : '')}><i className="xr">{g.r}</i>{g.us}–{g.them}</span>
    </Row>
  );
}

const span = (run) => (run.from === run.to ? String(run.from) : `${run.from}–${run.to}`);

export function SeriesPage({ ti, oi, todayEp, isMobile, copied, on, nav }) {
  const s = useMemo(() => seriesOf(ti, oi), [ti, oi]);
  const t = teams[ti], o = teams[oi];
  const last = s.games[s.games.length - 1];
  const lead = seriesLead(t.name, o.name, s.rec, s.since, s.now, last);
  const link = (url, onClick, text) => <a href={hrefOf(BASE, url)} onClick={(e) => { e.preventDefault(); onClick(); }}>{text}</a>;
  return (
    <div className="tpg ser">
      <div className="tpg-bar">
        <button className="crumb" onClick={() => on.team(ti)}><Chevron left /> {t.name}</button>
        <NavIcons here="series" nav={nav} onShare={() => on.share(ti, oi)} shareLabel={`Share ${t.name} vs ${o.name}`} copied={copied} isMobile={isMobile} />
      </div>

      <div className="ser-head">
        <TeamMark ti={ti} className="ser-logo" />
        <h1 className="ser-h1">{seriesH1(t.name, o.name)}</h1>
        <TeamMark ti={oi} className="ser-logo" />
      </div>
      <p className="landing-line ser-lead">{lead}</p>

      <div className="tpg-stats ser-stats">
        <span><b>{recText(s.rec)}</b>all games</span>
        <span><b>{recText(s.site.home)}</b>at {t.name}</span>
        <span><b>{recText(s.site.away)}</b>at {o.name}</span>
        <span><b>{recText(s.site.neutral)}</b>neutral site</span>
      </div>

      <h2>Streaks</h2>
      <div className="ser-runs">
        {['W', 'L'].map((r) => {
          const run = s.longest[r];
          const who = r === 'W' ? t.name : o.name;
          return (
            <p key={r}>
              <b className={'srow-len' + (r === 'L' ? ' l' : '')}>{run ? run.len : 0}</b>
              <span>{run ? <>{who}’s longest run of wins, {span(run)}</> : <>{who} has never beaten {r === 'W' ? o.name : t.name}</>}</span>
            </p>
          );
        })}
        {s.now.r !== 'T' && (
          <p>
            <b className={'srow-len' + (s.now.r === 'L' ? ' l' : '')}>{s.now.len}</b>
            <span>{s.now.r === 'W' ? t.name : o.name}’s run now, since {s.games[s.games.length - s.now.len].se}</span>
          </p>
        )}
      </div>

      {s.next && (
        <div className="ledger ser-next">
          <NextRow ti={ti} g={s.next} onGame={on.game} />
        </div>
      )}

      <h2>Every game <span>{s.games.length}</span></h2>
      <div className="ser-squares" aria-hidden="true">
        {/* the board's squares without the mark, since every one would be the same team's: cream for a win, dashed for a tie */}
        {s.games.map((g) => <span key={g.ep} className={'sq s ' + g.r.toLowerCase()} title={`${g.se}: ${g.r} ${g.us}–${g.them}`} />)}
      </div>
      <div className="ledger ser-ledger">
        {[...s.games].reverse().map((g) => <SeriesRow key={g.ep} ti={ti} oi={oi} g={g} onGame={on.game} />)}
      </div>

      <p className="tpg-note ser-note">
        The record is the scores as played, so a forfeit or a vacated win counts the way the game ended, and a school’s own count can differ.
        Since {firstSeason} the games are Streak King’s ledger; before that they’re <a href="https://www.jhowell.net/cf/scores/byname.htm">jhowell.net</a>’s
        team pages, which start in the season Howell counts a school as major (1902 for most of the South), so a series that began earlier reads from {yearOf(s.games[0].ep)}, the first meeting there.
      </p>
      <p className="tpg-opp-more">
        {link(seriesUrl(oi, ti), () => on.series(oi, ti), `${seriesH1(o.name, t.name)} ›`)} · {link(asUrl(ti, 'W'), () => on.as(ti, 'W'), `${t.name}’s streaks by opponent ›`)} · {link(teamUrl(oi), () => on.team(oi), `${o.name} ›`)}
      </p>
    </div>
  );
}
