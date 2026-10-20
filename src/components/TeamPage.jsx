// A team's page: its record and rank, its next game, its schedule, and its
// current streaks, the most surprising first (its active crowns, under any
// mined definition, each with its place in the field). The name is a picker for
// any other team. A streak row opens that streak on the board; a scheduled
// game opens its matchup.

import { useEffect, useMemo, useRef, useState } from 'react';
import { P, teams, confOf, gamesOf, upcomingOf, asBoard, windowStartOf } from '../lib/model.ts';
import { asH1, asLead } from '../lib/asTeam.ts';
import { leadRows } from '../lib/landing.ts';
import { asUrl, hrefOf } from '../lib/url.ts';
import { yearOf } from '../lib/format.ts';
import { seasonRecord, recordText, atsText, apRank, nextGameOf, teamStreaks, streaksOn } from '../lib/team.ts';
import { dayOf, monthDay, kickOf, spreadText } from '../lib/format.ts';
import { TeamMark } from './Chip.jsx';
import { Caret, Chevron } from './Icons.jsx';
import { NavIcons } from './Dateline.jsx';
import { TeamPicker } from './TeamPicker.jsx';
import { StreakRow, Tellings } from './StreakRow.jsx';
import { useTeamCrowns } from '../hooks/useCrowns.ts';
import { track } from '../lib/analytics.ts';
import { breakOrder, breakRows, breakSummary, listBreaks } from '../lib/breakers.ts';
import { listCrowns } from '../lib/list.ts';
import { useKnobs } from '../tune.ts';
import { LedgerHead, LedgerRow, NextRow } from './TeamPanel.jsx';
import { SkrInfo } from './BreakersPage.jsx';
import { BrokenRow } from './BrokenRow.jsx';

const STREAKS_CAP = 10;
const BREAKS_CAP = 6;
const OPP_CAP = 5;
const BASE = import.meta.env.BASE_URL;

/**
 * A team's streaks against each opponent, one way: its all-time board by
 * opponent (asBoard), one row per opponent (its longest run; a tie, the
 * latest), with where the series stands now (the team's current run that
 * way). The lead sentence is the page's (asTeam.ts).
 */
function byOpponent(ti, dir, todayEp) {
  const all = asBoard(ti, [], dir, 'all', todayEp);
  const now = new Map(asBoard(ti, [], dir, 'active', todayEp).map((r) => [r.vs, r.s.len]));
  const rows = [];
  const seen = new Set();
  for (const r of all) {
    if (seen.has(r.vs)) continue;
    seen.add(r.vs);
    rows.push({ ...r, now: now.get(r.vs) ?? 0 });
  }
  return { rows, lead: asLead(teams[ti].name, dir, leadRows(all.map((r) => ({ ...r, ti: r.vs })), (x) => teams[x].name), windowStartOf(ti)) };
}

/** One opponent's row: the run's length, the opponent, its years, and the series now. */
function OppRow({ ti, r, dir, onOpen }) {
  const o = teams[r.vs];
  // the + on the length says a run at the window's edge may be older than the data; the years are the games in it
  const years = yearOf(r.s.start.ep) === yearOf(r.s.end.ep) ? String(yearOf(r.s.end.ep)) : `${yearOf(r.s.start.ep)}–${yearOf(r.s.end.ep)}`;
  const now = r.live ? 'still going' : r.now > 0 ? `now ${r.now} straight` : null;
  return (
    <button className="srow marked" onClick={() => onOpen(ti, dir, r)} aria-label={`${o.name}: ${r.s.len}${r.s.atEdge ? '+' : ''} straight, ${years}; the streak`}>
      <span className={'srow-len' + (dir === 'L' ? ' l' : '')}>{r.s.len}{r.s.atEdge ? '+' : ''}</span>
      {o.espn ? <TeamMark ti={r.vs} className="srow-mark" /> : <b className="srow-mark gm-ini">{o.name[0]}</b>}
      <span className="srow-txt">
        <span>{o.name}</span>
        <small>{years}{now ? <> · <i>{now}</i></> : ''}</small>
      </span>
      <Chevron />
    </button>
  );
}

/**
 * Whom the team has beaten the most times in a row: its winning streaks by
 * opponent, the top rows, heading to its page; the other question (who has
 * beaten it the most in a row) is a link under them. Fans come to see what
 * their team is good at (Drew, 2026-10-20).
 */
function ByOpponent({ ti, todayEp, on }) {
  const t = teams[ti];
  const W = useMemo(() => byOpponent(ti, 'W', todayEp), [ti, todayEp]);
  const link = (dir, text) => <a href={hrefOf(BASE, asUrl(ti, dir))} onClick={(e) => { e.preventDefault(); on.as(ti, dir, null); }}>{text}</a>;
  return (
    <>
      <h2>Streaks by opponent</h2>
      <div className="tpg-opp">
        <h3>{link('W', asH1(t.name, 'W'))}</h3>
        <p className="tpg-note">{W.lead || `${t.name} has no winning streak against any opponent since ${windowStartOf(ti)}.`}</p>
        <div className="tpg-streaks">
          {W.rows.slice(0, OPP_CAP).map((r) => <OppRow key={r.vs} ti={ti} r={r} dir="W" onOpen={on.as} />)}
        </div>
        <p className="tpg-opp-more">
          {W.rows.length > OPP_CAP && <>{link('W', `all ${W.rows.length} opponents ›`)} · </>}
          {link('L', `${asH1(t.name, 'L')} ›`)}
        </p>
      </div>
    </>
  );
}

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

export function TeamPage({ ti, todayEp, initial, breakers, focus, isMobile, copied, on, nav }) {
  const t = teams[ti];
  // the streaks the team leads its field with: active (the default) or all-time
  const [scope, setScope] = useState('active');
  const raw = useTeamCrowns(ti, scope, initial);
  // the list rule over the team's file, under the knobs in force (the shipped ones, or the tuner's)
  const knobs = useKnobs();
  const crowns = useMemo(() => ({
    active: raw.active && listCrowns(raw.active, undefined, knobs),
    crowns: raw.crowns && (scope === 'active' && raw.crowns === raw.active ? null : listCrowns(raw.crowns, undefined, knobs)),
  }), [raw.active, raw.crowns, scope, knobs]);
  if (crowns.crowns === null && crowns.active) crowns.crowns = crowns.active;
  // the streaks the team broke this season (breakers.ts), the all-time longest first; opened from the breakers page, the section scrolls into view
  const breaks = useMemo(() => (breakers ? breakRows(listBreaks(breakers.teams.get(ti) ?? [], undefined, knobs)) : null), [breakers, ti, knobs]);
  const breakSum = useMemo(() => (breaks ? breakSummary(ti, breaks, undefined, knobs) : null), [breaks, ti, knobs]);
  const breakRank = breakers?.ranks.get(ti) ?? null;
  const breaksRef = useRef(null);
  const scrolledTo = useRef(null);
  // once the streaks above it have loaded too, so the section doesn't move after the scroll
  useEffect(() => {
    if (focus !== 'breaks' || !breaks || crowns.active === null || scrolledTo.current === ti) return;
    scrolledTo.current = ti;
    breaksRef.current?.scrollIntoView({ block: 'start' });
  }, [focus, breaks, crowns.active, ti]);
  const r = seasonRecord(ti);
  const rank = apRank(ti, todayEp);
  const next = nextGameOf(ti, todayEp);
  const streaks = useMemo(() => teamStreaks(ti, todayEp, crowns.active), [ti, todayEp, crowns.active]);
  // all-time: the runs it holds the record for, live or ended
  const records = useMemo(() => (scope === 'all' && crowns.crowns ? crowns.crowns.map((c) => ({ ...c, since: c.startSe })) : null), [scope, crowns.crowns]);
  const pickScope = (s) => { setScope(s); track('team streaks scope', { scope: s }); };
  const played = gamesOf(ti).filter((g) => g.se === P.currentSeason);
  const ahead = upcomingOf(ti);
  const meta = [confOf(ti, P.currentSeason), coachLine(ti)].filter(Boolean).join(' · ');
  return (
    <div className="tpg">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <NavIcons here="team page" nav={nav} onShare={() => on.share(ti)} shareLabel={`Share ${t.name}`} copied={copied} isMobile={isMobile} />
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

      <h2 className="tpg-h2-tabs">
        Streaks
        <span className="tpg-tabs" role="group" aria-label="Active or all-time streaks">
          <button className={'pill' + (scope === 'active' ? ' on' : '')} aria-pressed={scope === 'active'} onClick={() => pickScope('active')}>active</button>
          <button className={'pill' + (scope === 'all' ? ' on' : '')} aria-pressed={scope === 'all'} onClick={() => pickScope('all')}>all-time</button>
        </span>
      </h2>
      <p className="tpg-note">
        {scope === 'active'
          ? <>Every definition under which {t.name}’s current run is the longest active one, the ones furthest past chance first.</>
          : <>Every definition under which a run of {t.name}’s is the longest ever, the ones furthest past chance first.</>}
      </p>
      <div className="tpg-streaks">
        {crowns.crowns === null && <p className="empty">finding every streak {t.name} leads…</p>}
        {scope === 'active' && crowns.active !== null && streaks.length === 0 && <p className="empty">{t.name} doesn’t have the longest active streak under any definition.</p>}
        {scope === 'all' && records !== null && records.length === 0 && <p className="empty">{t.name} doesn’t hold an all-time longest streak under any definition.</p>}
        {scope === 'active'
          ? <Tellings rows={streaks} cap={STREAKS_CAP} keyOf={(s) => s.dir + s.chips.join()} render={(s) => <StreakRow s={s} next onClick={() => on.streak(s, ti)} />} />
          : records && <Tellings rows={records} cap={STREAKS_CAP} keyOf={(s) => `${s.dir}${s.chips.join()}|${s.startSe}`} render={(s) => (
            <StreakRow s={s} tag={s.live ? 'still going' : `ended ${s.endSe}`} onClick={() => on.streak(s, ti)} />
          )} />}
      </div>

      <ByOpponent ti={ti} todayEp={todayEp} on={on} />

      <h2 ref={breaksRef}>Streaks broken this season</h2>
      <p className="tpg-note bkr-note">
        {breakSum && breakSum.n > 0
          ? <>{t.name} ended <b>{breakSum.n}</b> {breakSum.n === 1 ? 'streak' : 'streaks'} by beating other teams: {breakSum.by.alltime} all-time longest, {breakSum.by.leading} longest active.{breakRank != null ? <> <button className="gp-wk" onClick={on.breakers}>Streak King Rank #{breakRank}</button> <SkrInfo /></> : ''} <button className="gp-wk" onClick={() => on.breaker(ti)}>All {breakSum.n} ›</button></>
          : <>The all-time longest and longest active streaks {t.name} ended by beating their owner.</>}
      </p>
      <div className="tpg-streaks">
        {breaks === null && <p className="empty">finding the streaks {t.name} broke…</p>}
        {breaks !== null && breakSum.n === 0 && <p className="empty">{t.name} hasn’t broken a streak this season.</p>}
        {breaks !== null && <Tellings rows={breaks} cap={BREAKS_CAP} order={breakOrder} keyOf={(b) => `${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`} render={(b) => (
          <BrokenRow b={b} onOpen={(x) => on.streak(x, x.ti)} onBoard={on.allTime} />
        )} />}
      </div>

    </div>
  );
}
