// The schedule: one week of one season at a time. A year picker and a week
// picker in the title select it; above the week's games sit the broken-
// streaks digest of the week before and, for the running week, its at-risk
// streaks. A played week is a results ledger (score, and the game's top
// broken run beneath), a scheduled week the schedule (kickoff, the line as
// of the build, and the streak most on the line beneath). A row opens the
// game's page.

import { useEffect, useMemo, useRef, useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { lineText, rankText } from '../lib/team.ts';
import { seasons, seasonWeeks, scoreOf, keyString } from '../lib/game.ts';
import { digestOf, BROKEN_CAP, BROKEN_CUTOFF } from '../lib/broken.ts';
import { dayOf, monthDay, kickOf, marginWords, siteWord, spreadText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron, LinkIcon } from './Icons.jsx';
import { streakWords } from './StreakRow.jsx';
import { Picker } from './Picker.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ep) => MONTHS[new Date(ep * 86400000).getUTCMonth()];
const dayNum = (ep) => new Date(ep * 86400000).getUTCDate();
// "Oct 1–4", "Oct 29 – Nov 1"
function span(a, b) {
  if (a === b) return `${monthName(a)} ${dayNum(a)}`;
  return monthName(a) === monthName(b) ? `${monthName(a)} ${dayNum(a)}–${dayNum(b)}` : `${monthName(a)} ${dayNum(a)} – ${monthName(b)} ${dayNum(b)}`;
}

// on a phone a team with a mark is its mark and rank; the name stays for one without
function Side({ ti, rank }) {
  const t = teams[ti];
  return (
    <span className={'gm-team' + (t?.espn ? ' marked' : '')} title={t?.name}>
      {t?.espn ? <TeamMark ti={ti} className="gm-logo" /> : <b className="gm-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      {rank > 0 && <i className="gm-rank">#{rank}</i>}
      <span className="gm-nm">{t?.name ?? '?'}</span>
    </span>
  );
}

const VERBS = { W: 'has won', L: 'has lost', C: 'has covered', N: 'has missed' };
const PASTS = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' };
const VERB = (dir) => VERBS[baseDir(dir)];
const PAST = (dir) => PASTS[baseDir(dir)];

// how the run ended, from the team's side: the game that broke it
function enderWords(b) {
  const g = b.ender;
  const opp = teams[g.oppIdx]?.name ?? '?';
  const when = `${dayOf(g.ep)} ${monthDay(g.ep)}`;
  if (b.dir === 'C' || b.dir === 'N') {
    const did = g.cover === 'P' ? 'pushed' : g.cover === 'W' ? 'covered' : 'didn’t cover';
    return `${did} vs ${opp} ${when}`;
  }
  if (g.r === 'T') return `tied ${opp} ${g.us}–${g.them} ${when}`;
  return g.r === 'W' ? `beat ${opp} ${g.us}–${g.them} ${when}` : `lost to ${opp} ${g.them}–${g.us} ${when}`;
}

// one broken run: the length, the claim in past tense, where it ranked as
// the week began, and the game that ended it; opens the run's all-time board
function BrokenRow({ b, onOpen }) {
  const t = teams[b.ti];
  return (
    <button className="bk" onClick={() => onOpen(b)}>
      <span className={'bk-len' + (baseDir(b.dir) === 'L' || b.dir === 'N' ? ' l' : '')}>{b.len}{b.atEdge ? '+' : ''}</span>
      {t?.espn ? <TeamMark ti={b.ti} className="bk-logo" /> : <b className="bk-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      <span className="bk-txt">
        <span>{t?.name} {PAST(b.dir)} {b.len}{b.atEdge ? '+' : ''} straight{marginWords(b.dir)}{b.chips.length ? ` ${streakWords(b.chips)}` : ''}</span>
        <small>
          <b className={b.rank === 1 && b.tied === 1 ? 'k' : ''}>was {rankText(b)} of {b.field}</b>
          {' · since '}{b.since}{' · '}{enderWords(b)}
        </small>
      </span>
      <Chevron />
    </button>
  );
}

/**
 * A past season's week digest, from the season file's rows: every run the
 * week's games ended (rank 1 as the week began, by construction), the
 * best first, one per team in the top six.
 */
export function brokenFromRows(seasonRows, week) {
  if (!seasonRows || !week) return null;
  const all = week.games.flatMap((g) => seasonRows.games.get(keyString(g.key))?.ended ?? []).sort((a, b) => b.score - a.score || b.len - a.len);
  const { list, more } = digestOf(all, (b) => b.score >= BROKEN_CUTOFF, BROKEN_CAP);
  return { wk: week.wk, lo: week.lo, hi: week.hi, list, more };
}

// the digest of one completed week's broken runs: the week before the
// selected one, so it sits above that week's at-risk streaks and games
function Broken({ broken, onOpen, onLink }) {
  // "more" opens per week, so flipping weeks folds it back up
  const [moreWk, setMoreWk] = useState(null);
  if (!broken) return null;
  const all = moreWk === broken.wk;
  const rows = all ? [...broken.list, ...broken.more] : broken.list;
  return (
    <section className="gwk">
      <div className="gwk-h gbk-h">
        <span className="gbk-ttl">Streaks broken{broken.wk != null ? ` in Week ${broken.wk}` : ''}</span>
        <small>
          {span(broken.lo, broken.hi)} · {broken.list.length ? `${broken.list.length} of note` : 'none of note'}
          {broken.wk != null && onLink && <button className="lnk" onClick={() => onLink('broken', broken.wk)} aria-label={`Link to Week ${broken.wk}’s broken streaks`} title="link to this"><LinkIcon /></button>}
        </small>
      </div>
      <div className="gbk-list">
        {rows.map((b) => (
          <BrokenRow key={`${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`} b={b} onOpen={onOpen} />
        ))}
        {broken.more.length > 0 && (
          <button className="morebtn" onClick={() => setMoreWk(all ? null : broken.wk)}>
            {all ? 'fewer' : `${broken.more.length} more broken`}
          </button>
        )}
      </div>
    </section>
  );
}

// one streak at risk: the length, the claim, then the chance the game ends
// it, the game and the line, and where the run ranks; opens the game
function AtRiskRow({ r, onGame }) {
  const t = teams[r.ti];
  const opp = teams[r.row.oppIdx];
  const bad = baseDir(r.s.dir) === 'L' || r.s.dir === 'N';
  return (
    <button className="bk" onClick={() => onGame({ ep: r.game.ep, home: r.game.home, away: r.game.away, neutral: r.game.neutral })}>
      <span className={'bk-len' + (bad ? ' l' : '')}>{r.s.len}{r.s.atEdge ? '+' : ''}</span>
      {t?.espn ? <TeamMark ti={r.ti} className="bk-logo" /> : <b className="bk-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      <span className="bk-txt">
        <span>{t?.name} {VERB(r.s.dir)} {r.s.len}{r.s.atEdge ? '+' : ''} straight{marginWords(r.s.dir)}{r.s.chips.length ? ` ${streakWords(r.s.chips)}` : ''}</span>
        <small>
          <b className="k">{Math.round(100 * r.p)}% to end</b>
          {' · '}{dayOf(r.row.ep)} {monthDay(r.row.ep)} {siteWord(r.row)} {opp?.name} {spreadText(r.row.sp)}
          {' · '}{rankText(r.s)} of {r.s.field}
        </small>
      </span>
      <Chevron />
    </button>
  );
}

// the week's streaks most at risk, above its games: what the games can take
// away (atRisk.ts, worked out by the build for the first scheduled week),
// the most first, the rest behind "more"
function AtRisk({ wk, lo, hi, risk, onGame, onLink, focus }) {
  const [all, setAll] = useState(false);
  // its own address lands on it
  const ref = useRef(null);
  useEffect(() => { if (focus && risk) ref.current?.scrollIntoView({ block: 'start' }); }, [focus, risk]);
  if (!risk || !risk.list.length) return null;
  const rows = all ? [...risk.list, ...risk.more] : risk.list;
  return (
    <section className="gwk" ref={ref}>
      <div className="gwk-h gbk-h">
        <span className="gbk-ttl">Week {wk} at-risk streaks</span>
        <small>
          {span(lo, hi)} · by what the game can take away
          <button className="lnk" onClick={() => onLink('risk', wk)} aria-label="Link to this week’s at-risk streaks" title="link to this"><LinkIcon /></button>
        </small>
      </div>
      <div className="gbk-list">
        {rows.map((r) => <AtRiskRow key={`${r.ti}|${r.s.dir}|${r.s.chips.join()}`} r={r} onGame={onGame} />)}
        {risk.more.length > 0 && (
          <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${risk.more.length} more at risk`}</button>
        )}
      </div>
    </section>
  );
}

// a scheduled game's row: kickoff, away, home, the line; beneath it the most
// interesting streak either side puts on the line, as a compressed claim
function ScheduledRow({ g, top, onGame }) {
  const line = lineText(g);
  return (
    <button className="gm" onClick={() => onGame({ ep: g.ep, home: g.home, away: g.away, neutral: g.neutral })} aria-label={`${teams[g.away].name} ${g.neutral ? 'vs' : 'at'} ${teams[g.home].name}: the game`}>
      <span className="gm-kick">{kickOf(g) || 'TBA'}</span>
      <Side ti={g.away} rank={g.awayRank} />
      <i className="gm-at">{g.neutral ? 'vs' : '@'}</i>
      <Side ti={g.home} rank={g.homeRank} />
      <span className="gm-line">{line}</span>
      {top && (
        <span className="gm-claim">
          {teams[top.ti].name} {VERB(top.s.dir)} <b className={baseDir(top.s.dir) === 'L' || top.s.dir === 'N' ? 'l' : ''}>{top.s.len}{top.s.atEdge ? '+' : ''}</b> straight{marginWords(top.s.dir)}{top.s.chips.length ? ` ${streakWords(top.s.chips)}` : ''}
          <small> · {rankText(top.s)} of {top.s.field}</small>
        </span>
      )}
    </button>
  );
}

// a played game's row: the score, away, home; beneath it the game's top
// broken run, when the season's rows have one
function PlayedRow({ item, rows, onGame }) {
  const { key, played } = item;
  const [hs, as] = scoreOf(played);
  const r = played.row;
  const homeRank = played.ti === key.home ? r.ownRank : r.oppRank;
  const awayRank = played.ti === key.away ? r.ownRank : r.oppRank;
  const top = rows?.ended[0];
  return (
    <button className={'gm played' + (hs === as ? '' : hs > as ? ' home-won' : ' away-won')} onClick={() => onGame(key)} aria-label={`${teams[key.away].name} ${key.neutral ? 'vs' : 'at'} ${teams[key.home].name}: the game`}>
      <span className="gm-kick gm-score"><b className="as">{as}</b>–<b className="hs">{hs}</b></span>
      <Side ti={key.away} rank={awayRank} />
      <i className="gm-at">{key.neutral ? 'vs' : '@'}</i>
      <Side ti={key.home} rank={homeRank} />
      <span className="gm-line">{rows ? `${rows.ended.length} ended` : ''}</span>
      {top && (
        <span className="gm-claim">
          {teams[top.ti].name} {PAST(top.dir)} <b className={baseDir(top.dir) === 'L' || top.dir === 'N' ? 'l' : ''}>{top.len}{top.atEdge ? '+' : ''}</b> straight{marginWords(top.dir)}{top.chips.length ? ` ${streakWords(top.chips)}` : ''}
          <small> · was {rankText(top)} of {top.field}</small>
        </span>
      )}
    </button>
  );
}

// a week's games under day dividers
function Week({ week, digests, seasonRows, onGame }) {
  const out = [];
  let last = null;
  for (const item of week.games) {
    const ep = item.key.ep;
    if (ep !== last) { out.push(<div key={'d' + ep} className="gm-day">{dayOf(ep)} {monthDay(ep)}</div>); last = ep; }
    const k = keyString(item.key);
    out.push(item.scheduled
      ? <ScheduledRow key={k} g={item.scheduled} top={digests?.onLine[item.scheduled.i]} onGame={onGame} />
      : <PlayedRow key={k} item={item} rows={seasonRows?.games.get(k) ?? (seasonRows ? { ended: [], leaders: [] } : null)} onGame={onGame} />);
  }
  const played = week.games.some((g) => g.played);
  return (
    <div className="gwk-list">
      <div className="gm gm-head" aria-hidden="true"><span>{played ? 'final' : 'kick'}</span><span>away</span><span /><span>home</span><span className="gm-line">{played ? 'streaks' : 'line'}</span></div>
      {out}
    </div>
  );
}

/**
 * The week a season's schedule opens on: the running season's first
 * scheduled week (the one about to be played), a past season's first week.
 */
export function defaultWeek(season, weeks) {
  if (season === P.currentSeason) return weeks.find((w) => w.games.some((g) => g.scheduled))?.wk ?? weeks.at(-1)?.wk ?? null;
  return weeks[0]?.wk ?? null;
}

export function GamesPage({ digests, seasonRows, season, bwk, risk, copied, on }) {
  const weeks = useMemo(() => seasonWeeks(season), [season]);
  // the selected week: its at-risk streaks and games, and the week before it's broken runs
  const sel = bwk ?? defaultWeek(season, weeks);
  const week = weeks.find((w) => w.wk === sel) ?? null;
  const before = weeks.find((w) => w.wk === sel - 1) ?? null;
  const current = season === P.currentSeason;
  const broken = current ? digests?.broken[sel - 1] ?? null : brokenFromRows(seasonRows, before);
  const atRisk = current && digests?.atRisk?.wk === sel ? digests.atRisk : null;
  const loading = current ? !digests : !seasonRows;
  return (
    <div className="gpg">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <span className="dateline-acts">
          <button className="ico" onClick={on.share} aria-label="Share the schedule"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className="gpg-h1">
        <span className="gbk-wk"><Picker value={season} options={seasons().map((se) => ({ value: se, label: String(se) }))} onChange={on.year} ariaLabel="Pick a season" /></span>
        {' games'}
        {weeks.length > 1 && (
          <span className="gbk-wk"> · <Picker value={sel} options={weeks.map((w) => ({ value: w.wk, label: `Week ${w.wk}` }))} onChange={on.week} ariaLabel="Pick a week" /></span>
        )}
      </h1>
      <p className="tpg-note">
        {current
          ? <>Every game with an FBS team, the line as of {monthDay(Math.floor(Date.parse(P.builtAt) / 86400000))}, and the streak most on the line in it. Results land with the weekly rebuild.</>
          : <>Every game with a current FBS team, and the streaks it ended: the runs of up to two conditions whose team led the field.</>}
      </p>
      {loading && <p className="empty">finding the week’s streaks…</p>}
      <Broken broken={broken} onOpen={on.streak} onLink={current ? on.link : null} />
      {week && atRisk && <AtRisk wk={sel} lo={week.lo} hi={week.hi} risk={atRisk} onGame={on.game} onLink={on.link} focus={risk} />}
      {!week && <p className="empty">No games in this week.</p>}
      {week && (
        <section className="gwk">
          <div className="gwk-h on">
            <span>Week {week.wk}</span>
            <small>{span(week.lo, week.hi)} · {week.games.length} games</small>
          </div>
          <Week week={week} digests={digests} seasonRows={seasonRows} onGame={on.game} />
        </section>
      )}
    </div>
  );
}
