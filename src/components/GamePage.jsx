// A game's page: the score (or the kickoff and the line), both teams, and
// what the game did to the streaks. Played: the runs it ended whose team
// led the field when it was played, and the definitions under which a team
// became the leader because of it. Unplayed: every streak either side puts
// on the line, ranked by what the game can take away. A team's name leads
// to its page; a streak row leads to its board.

import { useMemo, useState } from 'react';
import { P, teams, fbsNow, gamesOf } from '../lib/model.ts';
import { seasonRecord, recordText, atsText, teamStreaks, streaksOn } from '../lib/team.ts';
import { pBreak } from '../lib/atRisk.ts';
import { rowsOf, listLeaders } from '../lib/seasonFile.ts';
import { everText, listBroken } from '../lib/broken.ts';
import { listCrowns } from '../lib/list.ts';
import { useKnobs } from '../tune.ts';
import { scoreOf } from '../lib/game.ts';
import { dayOf, monthDay, kickOf, shortDate, spreadText } from '../lib/format.ts';
import { useActiveCrowns } from '../hooks/useCrowns.ts';
import { TeamMark } from './Chip.jsx';
import { Chevron } from './Icons.jsx';
import { NavIcons } from './Dateline.jsx';
import { StreakRow, Tellings, TriviaFold } from './StreakRow.jsx';

const CAP = { phone: 4, desk: 6 };
const year = (ep) => new Date(ep * 86400000).getUTCFullYear();

function Side({ ti, rank, score, onTeam }) {
  const t = teams[ti];
  const r = seasonRecord(ti);
  const body = (
    <>
      {t.espn ? <TeamMark ti={ti} className="mu-logo" /> : <b className="mu-logo mu-ini">{t.name[0]}</b>}
      <span className="mu-name">{rank > 0 && <i>#{rank} </i>}{t.name}{fbsNow.has(ti) && <Chevron />}</span>
      {score != null ? <b className="mu-score">{score}</b> : <span className="mu-rec">{recordText(r)}{fbsNow.has(ti) ? ` · ${atsText(r)} ATS` : ''}</span>}
    </>
  );
  // a team below FBS has no page
  return fbsNow.has(ti)
    ? <button className="mu-side" onClick={() => onTeam(ti)} aria-label={`${t.name}: team page`}>{body}</button>
    : <span className="mu-side">{body}</span>;
}

// a list of six, the rest a page at a time behind "see more", the sub-streaks behind their own button; the trivia streaks one folded line
function Rows({ title, rows, cap, empty, keyOf, render, trivia, triviaWhat }) {
  const full = rows.filter((r) => !r.subStreak);
  return (
    <section className="gp-sec">
      <h2>{title} <span>{full.length}</span></h2>
      {!rows.length && <p className="empty">{empty}</p>}
      <Tellings rows={rows} cap={cap} keyOf={keyOf} render={render} />
      {trivia && <TriviaFold rows={trivia} what={triviaWhat} cap={cap} keyOf={keyOf} render={render} />}
    </section>
  );
}

/**
 * `found` is what the address names (game.ts findGame); `season` that
 * season's rows, null while loading; `todayEp` the day the page is read.
 */
export function GamePage({ found, season, todayEp, isMobile, copied, on, nav }) {
  const { key, played, scheduled } = found;
  const cap = isMobile ? CAP.phone : CAP.desk;
  const home = teams[key.home], away = teams[key.away];
  // the game from the home side when it's FBS, else the away side
  const side = played ? (played.sides.find((s) => s.ti === key.home) ?? played.sides[0]) : scheduled ? (scheduled.sides.find((s) => s.ti === key.home) ?? scheduled.sides[0]) : null;
  const row = side?.row ?? null;
  const homeRank = played ? (side.ti === key.home ? row.ownRank : row.oppRank) : scheduled?.homeRank ?? null;
  const awayRank = played ? (side.ti === key.away ? row.ownRank : row.oppRank) : scheduled?.awayRank ?? null;
  const [hs, as] = played ? scoreOf(side) : [null, null];
  // the line from the home side
  const sp = played ? (row.sp == null ? null : side.ti === key.home ? row.sp : -row.sp) : scheduled?.sp ?? null;
  const fav = sp == null ? null : sp === 0 ? 'PK' : `${teams[sp < 0 ? key.home : key.away].name} ${spreadText(-Math.abs(sp))}`;
  const homeCover = played && row.cover ? (side.ti === key.home ? row.cover : row.cover === 'W' ? 'L' : row.cover === 'L' ? 'W' : 'P') : null;
  const knobs = useKnobs();
  // the game's rows under the list rule: what it ended, and who it made a leader
  const raw = rowsOf(season, key);
  const rows = useMemo(() => ({ ended: listBroken(raw.ended, undefined, knobs), endedTrivia: listBroken(raw.ended, undefined, knobs, 'trivia'), leaders: listLeaders(raw.leaders, undefined, knobs) }), [raw, knobs]);
  // the meeting before this one, from the home side (the away side when the home team is below FBS)
  const lastSide = fbsNow.has(key.home) ? key.home : key.away;
  const last = gamesOf(lastSide).findLast((g) => g.oppIdx === (lastSide === key.home ? key.away : key.home) && g.ep < key.ep) ?? null;

  // unplayed: both sides' streaks on the line, by what the game can take away
  const homeRaw = useActiveCrowns(scheduled && fbsNow.has(key.home) ? key.home : null);
  const awayRaw = useActiveCrowns(scheduled && fbsNow.has(key.away) ? key.away : null);
  const homeCrowns = useMemo(() => homeRaw && { simple: listCrowns(homeRaw, undefined, knobs), trivia: listCrowns(homeRaw, undefined, knobs, 'trivia') }, [homeRaw, knobs]);
  const awayCrowns = useMemo(() => awayRaw && { simple: listCrowns(awayRaw, undefined, knobs), trivia: listCrowns(awayRaw, undefined, knobs, 'trivia') }, [awayRaw, knobs]);
  const onLineOf = (part) => {
    if (!scheduled) return [];
    const out = [];
    for (const { ti, row: r } of scheduled.sides) {
      const crowns = (ti === key.home ? homeCrowns : awayCrowns)?.[part] ?? null;
      for (const s of streaksOn(teamStreaks(ti, todayEp, crowns), r)) out.push({ ti, s, p: pBreak(s.dir, r.sp), stake: (pBreak(s.dir, r.sp) ?? 0.5) * s.score, subStreak: s.subStreak, dir: s.dir, len: s.len, chips: s.chips, score: s.score });
    }
    return out.sort((a, b) => b.stake - a.stake || b.s.len - a.s.len);
  };
  const onLine = useMemo(() => onLineOf('simple'), [scheduled, homeCrowns, awayCrowns, todayEp, key.home]);
  const onLineTrivia = useMemo(() => onLineOf('trivia'), [scheduled, homeCrowns, awayCrowns, todayEp, key.home]);
  const loading = scheduled ? scheduled.sides.some(({ ti }) => (ti === key.home ? homeCrowns : awayCrowns) === null) : season === null;

  const when = `${dayOf(key.ep)} ${monthDay(key.ep)}, ${year(key.ep)}${row && kickOf(row) ? ` · ${kickOf(row)}` : ''}`;
  const wk = played?.wk ?? scheduled?.wk ?? null;
  const seasonOf = played ? row.se : P.currentSeason;
  return (
    <div className="gp">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <NavIcons here="game" nav={nav} onShare={() => on.share(key)} shareLabel="Share this game" copied={copied} isMobile={isMobile} />
      </div>
      <h1 className="gp-h1">{away.name} {key.neutral ? 'vs' : 'at'} {home.name}</h1>
      <p className="gp-when">
        {when}{key.neutral ? ' · neutral site' : ''}
        {wk != null && <> · <button className="lnk gp-wk" onClick={() => on.week(seasonOf, wk)}>Week {wk}, {seasonOf}</button></>}
      </p>

      <div className="mu-top gp-top">
        <Side ti={key.away} rank={awayRank} score={as} onTeam={on.team} />
        <span className="mu-line">
          {played ? (
            <>
              <b>{hs > as ? home.name : as > hs ? away.name : 'Tie'}{hs === as ? '' : ' won'}</b>
              <small>{fav ? `${fav} · ${homeCover === 'P' ? 'push' : `${teams[homeCover === 'W' ? key.home : key.away].name} covered`}` : 'no line'}</small>
            </>
          ) : (
            <>
              <b>{fav ?? '—'}</b>
              <small>{fav ? `line as of ${monthDay(Math.floor(Date.parse(P.builtAt) / 86400000))}` : 'no line yet'}</small>
            </>
          )}
        </span>
        <Side ti={key.home} rank={homeRank} score={hs} onTeam={on.team} />
      </div>

      {played ? (
        <>
          <Rows
            title="Streaks this game ended" cap={cap} rows={rows.ended} trivia={rows.endedTrivia} triviaWhat="ended here"
            empty={loading ? 'finding the streaks…' : `No ${rows.endedTrivia.length ? 'simple ' : ''}streak that led its field ended here.`}
            keyOf={(b) => `${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`}
            render={(b) => (
              <StreakRow s={b} mark={b.ti} lead={`${teams[b.ti].name}’s run${everText(b) ? ` · ${everText(b)}` : ''}`} onClick={() => on.streak(b, b.ti)} />
            )}
          />
          <Rows
            title="New leaders" cap={cap} rows={rows.leaders}
            empty={loading ? 'finding the streaks…' : 'Nobody took over a field because of this game.'}
            keyOf={(l) => `${l.ti}|${l.dir}|${l.chips.join()}`}
            render={(l) => (
              <StreakRow
                s={l}
                mark={l.ti}
                lead={`${teams[l.ti].name} now leads${l.prev != null ? (l.ended ? `: ${teams[l.prev].name}’s ${l.prevLen} ended` : `, past ${teams[l.prev].name}’s ${l.prevLen}`) : ', breaking a tie'}`}
                onClick={() => on.streak(l, l.ti)}
              />
            )}
          />
        </>
      ) : (
        <Rows
          title="On the line" cap={cap} rows={onLine} trivia={onLineTrivia} triviaWhat="on the line"
          empty={loading ? 'finding the streaks…' : `Neither team has a longest active ${onLineTrivia.length ? 'simple ' : ''}streak this game could end.`}
          keyOf={({ ti, s }) => `${ti}|${s.dir}|${s.chips.join()}`}
          render={({ ti, s, p }) => (
            <StreakRow s={s} mark={ti} lead={`${teams[ti].name}${p != null ? ` · ${Math.round(100 * p)}% to end` : ''}`} onClick={() => on.streak(s, ti)} />
          )}
        />
      )}

      {last && (
        <p className="mu-last">
          Last meeting {shortDate(last.ep)}: {teams[last.r === 'L' ? last.oppIdx : lastSide].name} {Math.max(last.us, last.them)}–{Math.min(last.us, last.them)}{last.r === 'T' ? ' (tie)' : ''}
        </p>
      )}
    </div>
  );
}
