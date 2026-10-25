// The schedule: one week of one season at a time. A year picker and a week
// picker in the title select it; above the week's games sit its broken-
// streaks digest (a completed week) or its at-risk streaks (the running
// week), only runs that led the active field or were the all-time longest.
// A played week is a results ledger, the games that broke the most streaks
// first (score, the count, and the game's top broken run beneath); a
// scheduled week the schedule by day (kickoff, the line as of the build,
// how many streaks it puts on the line, and the one most on the line
// beneath). A row opens the game's page.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { lineText } from '../lib/team.ts';
import { boardUrl, hrefOf } from '../lib/url.ts';
import { seasons, seasonWeeks, scoreOf, keyString } from '../lib/game.ts';
import { BROKEN_CAP, brokenDigest, listBroken } from '../lib/broken.ts';
import { AT_RISK_CAP, atRiskWeek } from '../lib/atRisk.ts';
import { useKnobs } from '../tune.ts';
import { dayOf, monthDay, kickOf, marginWords, siteWord, spreadText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { TeamMark } from './Chip.jsx';
import { Chevron, LinkIcon } from './Icons.jsx';
import { NavIcons } from './Dateline.jsx';
import { streakWords, subsByParent, Subs, MoreButton, DaggerNote, PAGE, TriviaFold } from './StreakRow.jsx';
import { BrokenRow } from './BrokenRow.jsx';
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

/**
 * A past season's week digest, from the season file's rows: every run the
 * week's games ended that the list rule admits, the best first, one per
 * team in the top six.
 */
export function brokenFromRows(seasonRows, week, knobs) {
  if (!seasonRows || !week) return null;
  const rows = week.games.flatMap((g) => seasonRows.games.get(keyString(g.key))?.ended ?? []);
  return brokenDigest({ wk: week.wk, lo: week.lo, hi: week.hi, rows }, undefined, knobs);
}

// the digest of the selected week's broken runs, above its results
function Broken({ broken, onOpen, onBoard, onLink }) {
  // "see more" pages and the sub-streaks open per week, so flipping weeks groups them back up
  const [paged, setPaged] = useState({ wk: null, n: 0 });
  const [open, setOpen] = useState(() => new Set());
  if (!broken) return null;
  const n = paged.wk === broken.wk ? paged.n : 0;
  const rows = [...broken.list, ...broken.more.slice(0, n)];
  const { subs } = subsByParent([...broken.list, ...broken.more, ...broken.subStreaks]);
  const keyOf = (b) => `${broken.wk}|${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`;
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
          <Fragment key={keyOf(b)}>
            <BrokenRow b={b} onOpen={onOpen} onBoard={onBoard} />
            <Subs parent={b} subs={subs.get(b)} k={keyOf(b)} open={open} setOpen={setOpen} render={(x) => <BrokenRow key={keyOf(x)} b={x} onOpen={onOpen} onBoard={onBoard} />} />
          </Fragment>
        ))}
        <MoreButton shown={n} total={broken.more.length} onMore={() => setPaged({ wk: broken.wk, n: n + PAGE })} />
        <DaggerNote rows={rows} />
        <TriviaFold key={broken.wk} rows={broken.trivia} what="ended this week" cap={BROKEN_CAP} keyOf={keyOf} render={(b) => <BrokenRow b={b} onOpen={onOpen} onBoard={onBoard} />} />
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
      <span className={'bk-len' + (bad ? ' l' : '')}>{r.s.len}{r.s.unsure ? '†' : ''}</span>
      {t?.espn ? <TeamMark ti={r.ti} className="bk-logo" /> : <b className="bk-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      <span className="bk-txt">
        <span>{t?.name} {VERB(r.s.dir)} {r.s.len}{r.s.unsure ? '†' : ''} straight{marginWords(r.s.dir)}{r.s.chips.length ? ` ${streakWords(r.s.chips)}` : ''}</span>
        <small>
          <b className="k">{Math.round(100 * r.p)}% to end</b>
          {' · '}{dayOf(r.row.ep)} {monthDay(r.row.ep)} {siteWord(r.row)} {opp?.name} {spreadText(r.row.sp)}
        </small>
      </span>
      <Chevron />
    </button>
  );
}

const byStake = (a, b) => b.stake - a.stake || b.s.len - a.s.len;

// the week's streaks most at risk, above its games: what the games can take
// away (atRisk.ts, worked out by the build for the first scheduled week),
// the most first, the rest behind "more"
function AtRisk({ wk, lo, hi, risk, onGame, onLink, focus }) {
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(() => new Set());
  // its own address lands on it
  const ref = useRef(null);
  useEffect(() => { if (focus && risk) ref.current?.scrollIntoView({ block: 'start' }); }, [focus, risk]);
  if (!risk || !risk.list.length) return null;
  const rows = [...risk.list, ...risk.more.slice(0, n)];
  // a row at risk carries its streak; the grouping reads the streak's fields
  const flat = (r) => ({ ...r, dir: r.s.dir, len: r.s.len, chips: r.s.chips, score: r.s.score });
  const { subs } = subsByParent([...risk.list, ...risk.more, ...risk.subStreaks].map(flat));
  const subsOf = (r) => [...subs.entries()].find(([p]) => p.s === r.s)?.[1];
  const keyOf = (r) => `${r.ti}|${r.s.dir}|${r.s.chips.join()}`;
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
        {rows.map((r) => (
          <Fragment key={keyOf(r)}>
            <AtRiskRow r={r} onGame={onGame} />
            <Subs parent={r} subs={subsOf(r)} k={keyOf(r)} open={open} setOpen={setOpen} render={(x) => <AtRiskRow key={keyOf(x)} r={x} onGame={onGame} />} />
          </Fragment>
        ))}
        <MoreButton shown={n} total={risk.more.length} onMore={() => setN(n + PAGE)} />
        <DaggerNote rows={rows} />
        <TriviaFold rows={risk.trivia.map(flat)} what="on the line this week" cap={AT_RISK_CAP} order={byStake} keyOf={keyOf} render={(r) => <AtRiskRow r={r} onGame={onGame} />} />
      </div>
    </section>
  );
}

// a scheduled game's row: kickoff, away, home, the line; beneath it the most
// interesting streak either side puts on the line, as a compressed claim, and
// how many longest active streaks the game puts on the line
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
          {teams[top.ti].name} {VERB(top.s.dir)} <b className={baseDir(top.s.dir) === 'L' || top.s.dir === 'N' ? 'l' : ''}>{top.s.len}{top.s.unsure ? '†' : ''}</b> straight{marginWords(top.s.dir)}{top.s.chips.length ? ` ${streakWords(top.s.chips)}` : ''}
        </span>
      )}
      {top && <span className="gm-n">{top.n} on the line</span>}
    </button>
  );
}

/** How many streaks a played game broke: one row per run. */
const brokenCount = (rows) => rows.ended.reduce((a, b) => a + (b.subStreak ? 0 : 1), 0);

// a played game's row: the score, away, home, how many streaks it broke;
// beneath it the game's top broken run, when the season's rows have one
function PlayedRow({ item, rows, onGame }) {
  const { key, played } = item;
  const [hs, as] = scoreOf(played);
  const r = played.row;
  const homeRank = played.ti === key.home ? r.ownRank : r.oppRank;
  const awayRank = played.ti === key.away ? r.ownRank : r.oppRank;
  const top = rows?.ended[0];
  const n = rows ? brokenCount(rows) : null;
  return (
    <button className={'gm played' + (hs === as ? '' : hs > as ? ' home-won' : ' away-won')} onClick={() => onGame(key)} aria-label={`${teams[key.away].name} ${key.neutral ? 'vs' : 'at'} ${teams[key.home].name}: the game`}>
      <span className="gm-kick gm-score"><b className="as">{as}</b>–<b className="hs">{hs}</b></span>
      <Side ti={key.away} rank={awayRank} />
      <i className="gm-at">{key.neutral ? 'vs' : '@'}</i>
      <Side ti={key.home} rank={homeRank} />
      <span className="gm-line">{n != null ? `${n} broken` : ''}</span>
      {top && (
        <span className="gm-claim">
          {teams[top.ti].name} {PAST(top.dir)} <b className={baseDir(top.dir) === 'L' || top.dir === 'N' ? 'l' : ''}>{top.len}{top.unsure ? '†' : ''}</b> straight{marginWords(top.dir)}{top.chips.length ? ` ${streakWords(top.chips)}` : ''}
          <small> · {top.len >= top.everLen ? 'all-time longest' : 'longest active'}</small>
        </span>
      )}
    </button>
  );
}

const plain = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** The week's games with a team whose name has what was typed; all of them when nothing was. */
export function matchingGames(games, q) {
  const want = plain(q);
  return want ? games.filter((g) => plain(teams[g.key.home]?.name ?? '').includes(want) || plain(teams[g.key.away]?.name ?? '').includes(want)) : games;
}

// a week's games: the played ones, the most streaks broken first; the
// scheduled ones under day dividers
function Week({ week, games, digests, seasonRows, onGame }) {
  const knobs = useKnobs();
  const out = [];
  // each played game's broken runs as the list rule lists them
  const rowsOf = (k) => { const r = seasonRows?.games.get(k); return r ? { ended: listBroken(r.ended, undefined, knobs) } : seasonRows ? { ended: [] } : null; };
  const played = games.filter((g) => !g.scheduled).map((item) => ({ item, k: keyString(item.key) })).map((x) => ({ ...x, rows: rowsOf(x.k) }));
  played.sort((a, b) => (b.rows ? brokenCount(b.rows) : 0) - (a.rows ? brokenCount(a.rows) : 0)); // stable: kickoff order within a count
  for (const { item, k, rows } of played) out.push(<PlayedRow key={k} item={item} rows={rows} onGame={onGame} />);
  let last = null;
  for (const item of games) {
    if (!item.scheduled) continue;
    const ep = item.key.ep;
    if (ep !== last) { out.push(<div key={'d' + ep} className="gm-day">{dayOf(ep)} {monthDay(ep)}</div>); last = ep; }
    out.push(<ScheduledRow key={keyString(item.key)} g={item.scheduled} top={digests?.onLine[item.scheduled.i]} onGame={onGame} />);
  }
  const anyPlayed = week.games.some((g) => g.played);
  if (!games.length) return <p className="empty">No game this week has a team by that name.</p>;
  return (
    <div className="gwk-list">
      <div className="gm gm-head" aria-hidden="true"><span>{anyPlayed ? 'final' : 'kick'}</span><span>away</span><span /><span>home</span><span className="gm-line">{anyPlayed ? 'streaks' : 'line'}</span></div>
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

export function GamesPage({ digests, seasonRows, season, bwk, risk, copied, on, nav, isMobile }) {
  const weeks = useMemo(() => seasonWeeks(season), [season]);
  // the selected week: its broken runs (once played) or its at-risk streaks (the running week), and its games
  const sel = bwk ?? defaultWeek(season, weeks);
  const week = weeks.find((w) => w.wk === sel) ?? null;
  const current = season === P.currentSeason;
  const knobs = useKnobs();
  // the week's digests under the list rule: the build's rows, picked, scored and ordered here
  const broken = useMemo(() => (current ? (digests?.broken[sel] ? brokenDigest(digests.broken[sel], undefined, knobs) : null) : brokenFromRows(seasonRows, week, knobs)), [current, digests, sel, seasonRows, week, knobs]);
  // the schedule's filter: a team's name, kept across weeks to follow a team through the season
  const [q, setQ] = useState('');
  const shown = useMemo(() => (week ? matchingGames(week.games, q) : []), [week, q]);
  const atRisk = useMemo(() => (current && digests?.atRisk?.wk === sel ? atRiskWeek(digests.atRisk, undefined, knobs) : null), [current, digests, sel, knobs]);
  const loading = current ? !digests : !seasonRows;
  return (
    <div className="gpg">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <NavIcons here="games" nav={nav} onShare={on.share} shareLabel="Share the schedule" copied={copied} isMobile={isMobile} />
      </div>
      <h1 className="gpg-h1">
        <span className="gbk-wk"><Picker value={season} options={seasons().map((se) => ({ value: se, label: String(se) }))} onChange={on.year} ariaLabel="Pick a season" /></span>
        {' games'}
        {weeks.length > 1 && (
          <span className="gbk-wk"> · <Picker value={sel} options={weeks.map((w) => ({ value: w.wk, label: `Week ${w.wk}`, hint: span(w.lo, w.hi) }))} onChange={on.week} ariaLabel="Pick a week" /></span>
        )}
      </h1>
      <p className="tpg-note">
        {current
          ? <>Every game with an FBS team, the line as of {monthDay(Math.floor(Date.parse(P.builtAt) / 86400000))}, and the streak most on the line in it. Results land with the weekly rebuild.</>
          : <>Every game with a current FBS team, and the streaks it ended: the runs of up to two conditions whose team led the field.</>}
      </p>
      {loading && <p className="empty">finding the week’s streaks…</p>}
      <Broken broken={broken} onOpen={on.streak} onBoard={on.allTime} onLink={current ? on.link : null} />
      {week && atRisk && <AtRisk wk={sel} lo={week.lo} hi={week.hi} risk={atRisk} onGame={on.game} onLink={on.link} focus={risk} />}
      {!week && <p className="empty">No games in this week.</p>}
      {week && (
        <section className="gwk">
          <div className="gwk-h on filtered">
            <span>Week {week.wk}</span>
            <small>{span(week.lo, week.hi)} · {q ? `${shown.length} of ${week.games.length}` : week.games.length} games</small>
            <input className="gwk-find" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter by team" aria-label="Filter the week's games by team name" />
          </div>
          <Week week={week} games={shown} digests={digests} seasonRows={seasonRows} onGame={on.game} />
        </section>
      )}
    </div>
  );
}
