// A team's page: its record and rank, its next game, its schedule, and its
// current streaks, the most surprising first (its active crowns, under any
// mined definition, each with its place in the field). The name is a picker for
// any other team. A streak row opens that streak on the board; a scheduled
// game opens its matchup.

import { useEffect, useMemo, useRef, useState } from 'react';
import { P, teams, confOf, gamesOf, upcomingOf } from '../lib/model.ts';
import { seasonRecord, recordText, atsText, apRank, nextGameOf, teamStreaks, streaksOn } from '../lib/team.ts';
import { dayOf, monthDay, kickOf, spreadText } from '../lib/format.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Caret, Chevron } from './Icons.jsx';
import { TeamPicker } from './TeamPicker.jsx';
import { StreakRow, Tellings } from './StreakRow.jsx';
import { STOP_WORDS, stopCat, stopRows, stopSummary } from '../lib/stoppers.ts';
import { LedgerHead, LedgerRow, NextRow } from './TeamPanel.jsx';

const STREAKS_CAP = 10;
const STOPS_CAP = 6;
const pts = (x) => (Math.round(x * 10) / 10).toFixed(1);

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

export function TeamPage({ ti, todayEp, crowns, stoppers, focus, isMobile, copied, on }) {
  const t = teams[ti];
  const [all, setAll] = useState(false);
  const [allStops, setAllStops] = useState(false);
  // the streaks the team broke this season (stoppers.ts), the all-time longest first; opened from the stoppers page, the section scrolls into view
  const stops = useMemo(() => (stoppers ? stopRows(stoppers.teams.get(ti) ?? []) : null), [stoppers, ti]);
  const stopSum = useMemo(() => (stops ? stopSummary(ti, stops) : null), [stops, ti]);
  const stopRank = stoppers?.ranks.get(ti) ?? null;
  const stopsRef = useRef(null);
  const scrolledTo = useRef(null);
  // once the streaks above it have loaded too, so the section doesn't move after the scroll
  useEffect(() => {
    if (focus !== 'stops' || !stops || crowns.active === null || scrolledTo.current === ti) return;
    scrolledTo.current = ti;
    stopsRef.current?.scrollIntoView({ block: 'start' });
  }, [focus, stops, crowns.active, ti]);
  const r = seasonRecord(ti);
  const rank = apRank(ti, todayEp);
  const next = nextGameOf(ti, todayEp);
  const streaks = useMemo(() => teamStreaks(ti, todayEp, crowns.active), [ti, todayEp, crowns.active]);
  const played = gamesOf(ti).filter((g) => g.se === P.currentSeason);
  const ahead = upcomingOf(ti);
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
            {played.map((g) => <LedgerRow key={g.i} ti={ti} g={g} onGame={on.game} />)}
            {ahead.map((g) => <NextRow key={g.i} ti={ti} g={g} onGame={on.game} />)}
          </div>
        </>
      )}

      <h2>Streaks</h2>
      <p className="tpg-note">{t.name}’s current runs and where each ranks, the ones furthest past chance first.</p>
      <div className="tpg-streaks">
        {crowns.active === null && <p className="empty">finding every streak {t.name} is on…</p>}
        {crowns.active !== null && streaks.length === 0 && <p className="empty">No current run of {t.name}’s stands out from chance.</p>}
        <Tellings rows={streaks} cap={STREAKS_CAP} all={all} setAll={setAll} keyOf={(s) => s.dir + s.chips.join()} render={(s) => (
          <StreakRow s={s} next onClick={() => on.streak(s, ti)} />
        )} />
      </div>

      <h2 ref={stopsRef}>Streaks broken this season</h2>
      <p className="tpg-note">
        {stopSum && stopSum.n > 0
          ? <>{t.name} ended <b>{stopSum.n}</b> {stopSum.n === 1 ? 'streak' : 'streaks'} by winning: {stopSum.by.alltime} all-time longest, {stopSum.by.leading} that led the field, {stopSum.by.active} other. <b>{pts(stopSum.points)}</b> points{stopRank != null ? <>, <button className="gp-wk" onClick={on.stoppers}>#{stopRank} among streak-stoppers</button></> : ''}.</>
          : <>The streaks {t.name} ended by beating their owner, the all-time longest first.</>}
      </p>
      <div className="tpg-streaks">
        {stops === null && <p className="empty">finding the streaks {t.name} broke…</p>}
        {stops !== null && stopSum.n === 0 && <p className="empty">{t.name} hasn’t broken a streak this season.</p>}
        {stops !== null && <Tellings rows={stops} cap={STOPS_CAP} all={allStops} setAll={setAllStops} moreWord="broken" keyOf={(b) => `${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`} render={(b) => (
          <StreakRow s={b} lead={`${teams[b.ti].name}’s run · ${STOP_WORDS[stopCat(b)]}`} tag={`${dayOf(b.ender.ep)} ${monthDay(b.ender.ep)}`} onClick={() => on.streak(b, b.ti)} />
        )} />}
      </div>

    </div>
  );
}
