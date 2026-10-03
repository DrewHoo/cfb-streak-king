// A team's page: its record and rank, its next game, its schedule, and its
// current streaks, the most surprising first (the single conditions it
// stands out under, and the streaks it is king of). The name is a picker for
// any other team. A streak row opens that streak on the board; a scheduled
// game opens its matchup.

import { useMemo, useState } from 'react';
import { P, teams, confOf, gamesOf, upcomingOf } from '../lib/model.ts';
import { seasonRecord, recordText, atsText, apRank, nextGameOf, teamStreaks, streaksOn } from '../lib/team.ts';
import { dayOf, monthDay, kickOf, spreadText } from '../lib/format.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Caret, Chevron } from './Icons.jsx';
import { TeamPicker } from './TeamPicker.jsx';
import { StreakRow } from './Matchup.jsx';
import { LedgerHead, LedgerRow, NextRow } from './TeamPanel.jsx';

const STREAKS_CAP = 10;

function coachLine(ti) {
  const stint = teams[ti].hc?.at(-1);
  if (!stint || stint[0] < 0) return null;
  const year = P.currentSeason - stint[1] + 1;
  return `${P.coachNames[stint[0]]}, year ${year}`;
}

function NextCard({ ti, game, onLine, onGame }) {
  const opp = teams[game.oppIdx];
  const r = seasonRecord(game.oppIdx);
  return (
    <button className="nextcard" onClick={() => onGame(ti, game)} aria-label={`${teams[ti].name} ${game.home ? 'vs' : 'at'} ${opp?.name}: the matchup`}>
      <span className="nc-h"><span>next · {dayOf(game.ep)} {monthDay(game.ep)}{kickOf(game) ? ` · ${kickOf(game)}` : ''}</span><span>matchup <Chevron /></span></span>
      <span className="nc-row">
        <i>{game.neutral ? 'vs' : game.home ? 'vs' : 'at'}</i>
        {opp?.espn ? <TeamMark ti={game.oppIdx} className="nc-logo" /> : <b className="nc-logo mu-ini">{opp?.name?.[0]}</b>}
        <span className="nc-opp">
          <b>{game.oppRank > 0 && <em>#{game.oppRank} </em>}{opp?.name}</b>
          <small>{recordText(r)} · {atsText(r)} ATS{game.oppRank === 0 ? ' · unranked' : ''}</small>
        </span>
        <span className="nc-line">
          <b>{game.sp != null ? spreadText(game.sp) : '—'}</b>
          <small>{game.sp != null ? `${teams[ti].name} line` : 'no line yet'}</small>
        </span>
      </span>
      <span className="nc-f"><i className="otl-dot" />{onLine} {onLine === 1 ? 'streak' : 'streaks'} on the line</span>
    </button>
  );
}

export function TeamPage({ ti, todayEp, crowns, isMobile, copied, on }) {
  const t = teams[ti];
  const [all, setAll] = useState(false);
  const r = seasonRecord(ti);
  const rank = apRank(ti, todayEp);
  const next = nextGameOf(ti, todayEp);
  const streaks = useMemo(() => teamStreaks(ti, todayEp, crowns.active), [ti, todayEp, crowns.active]);
  const played = gamesOf(ti).filter((g) => g.se === P.currentSeason);
  const ahead = upcomingOf(ti).filter((u) => u.ep >= todayEp);
  const meta = [confOf(ti, P.currentSeason), coachLine(ti)].filter(Boolean).join(' · ');
  return (
    <div className="tpg">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <span className="dateline-acts">
          <button className="ico" onClick={() => on.share(ti)} aria-label={`Share ${t.name}`}><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>

      <div className="tpg-head">
        <TeamMark ti={ti} className="tpg-logo" />
        <div>
          <h1 className="tpg-name">
            <TeamPicker current={ti} onPick={on.team} isMobile={isMobile}>
              <button className="tpg-pick" aria-label={`${t.name}: pick another team`}>{t.name}<Caret /></button>
            </TeamPicker>
          </h1>
          <div className="tpg-meta">{meta}</div>
        </div>
      </div>
      <div className="tpg-stats">
        <span><b>{recordText(r)}</b>record</span>
        <span><b>{atsText(r)}</b>vs spread</span>
        <span><b>{rank == null ? '—' : rank > 0 ? `#${rank}` : 'NR'}</b>AP poll</span>
      </div>

      {next && <NextCard ti={ti} game={next} onLine={streaksOn(streaks, next).length} onGame={on.game} />}

      {(played.length > 0 || ahead.length > 0) && (
        <>
          <h2>{P.currentSeason} schedule</h2>
          <div className="ledger tpg-sched">
            <LedgerHead />
            {played.map((g) => <LedgerRow key={g.i} ti={ti} g={g} />)}
            {ahead.map((g) => <NextRow key={g.i} ti={ti} g={g} onGame={on.game} />)}
          </div>
        </>
      )}

      <h2>Streaks</h2>
      <p className="tpg-note">{t.name}’s current runs and where each ranks, the ones furthest past chance first.</p>
      <div className="tpg-streaks">
        {(all ? streaks : streaks.slice(0, STREAKS_CAP)).map((s) => (
          <StreakRow key={s.dir + s.chips.join()} s={s} next onClick={() => on.streak(s, ti)} />
        ))}
        {streaks.length > STREAKS_CAP && <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `all ${streaks.length}`}</button>}
      </div>

    </div>
  );
}
