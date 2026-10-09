// The schedule: every scheduled game with an FBS team, by week, as a ledger:
// kickoff, away, home, the line as of the build, and beneath a row the most
// interesting streak on the line in it, said in a line. The first week (the
// one with games still unrecorded) is open; later weeks open on a tap. A row
// opens the game's matchup.

import { useMemo, useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { scheduledGames, lineText, topOnLine, rankText } from '../lib/team.ts';
import { brokenLastWeek, brokenWeek, completedWeeks } from '../lib/broken.ts';
import { atRiskWeek } from '../lib/atRisk.ts';
import { dayOf, monthDay, kickOf, marginWords, siteWord, spreadText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron, Caret } from './Icons.jsx';
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
        <span>{t?.name} {PAST(b.dir)} {b.len}{b.atEdge ? '+' : ''} straight{marginWords(b.dir)}{b.chips.length ? ` ${streakWords(b.chips, b.vs)}` : ''}</span>
        <small>
          {b.vs != null ? <b>head-to-head</b> : <b className={b.rank === 1 && b.tied === 1 ? 'k' : ''}>was {rankText(b)} of {b.field}</b>}
          {' · since '}{b.since}{' · '}{enderWords(b)}
        </small>
      </span>
      <Chevron />
    </button>
  );
}

// the digest of a completed week's broken runs, above the schedule; the
// week is a picker, each choice its own address (/games/week/<n>/), and
// the default (/games/) is the latest completed week
function Broken({ bwk, onOpen, onWeek }) {
  const weeks = useMemo(() => completedWeeks().filter((w) => w.wk != null), []);
  const broken = useMemo(() => (bwk != null ? brokenWeek(bwk) : null) ?? brokenLastWeek(), [bwk]);
  // "more" opens per week, so flipping weeks folds it back up
  const [moreWk, setMoreWk] = useState(null);
  if (!broken) return null;
  const all = moreWk === broken.wk;
  const rows = all ? [...broken.list, ...broken.more] : broken.list;
  return (
    <section className="gwk">
      <div className="gwk-h gbk-h">
        <span className="gbk-ttl">
          Streaks broken{broken.wk != null && weeks.length > 0 ? ' in' : ''}
          {broken.wk != null && weeks.length > 0 && (
            <span className="gbk-wk">
              <select value={broken.wk} onChange={(e) => onWeek(Number(e.target.value))} aria-label="Pick a week of broken streaks">
                {weeks.map((w) => <option key={w.wk} value={w.wk}>Week {w.wk}</option>)}
              </select>
              <Caret />
            </span>
          )}
        </span>
        <small>{span(broken.lo, broken.hi)} · {broken.list.length ? `${broken.list.length} of note` : 'none of note'}</small>
      </div>
      <div className="gbk-list">
        {rows.map((b) => (
          <BrokenRow key={`${b.ti}|${b.dir}|${b.chips.join()}|${b.vs ?? ''}`} b={b} onOpen={onOpen} />
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
// it, the game and the line, and where the run ranks; opens the matchup
function AtRiskRow({ r, onGame }) {
  const t = teams[r.ti];
  const opp = teams[r.row.oppIdx];
  const bad = baseDir(r.s.dir) === 'L' || r.s.dir === 'N';
  return (
    <button className="bk" onClick={() => onGame(r.ti, r.row)}>
      <span className={'bk-len' + (bad ? ' l' : '')}>{r.s.len}{r.s.atEdge ? '+' : ''}</span>
      {t?.espn ? <TeamMark ti={r.ti} className="bk-logo" /> : <b className="bk-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      <span className="bk-txt">
        <span>{t?.name} {VERB(r.s.dir)} {r.s.len}{r.s.atEdge ? '+' : ''} straight{marginWords(r.s.dir)}{r.s.chips.length ? ` ${streakWords(r.s.chips, r.s.vs)}` : ''}</span>
        <small>
          <b className="k">{Math.round(100 * r.p)}% to end</b>
          {' · '}{dayOf(r.row.ep)} {monthDay(r.row.ep)} {siteWord(r.row)} {opp?.name} {spreadText(r.row.sp)}
          {' · '}{r.s.vs != null ? 'head-to-head' : `${rankText(r.s)} of ${r.s.field}`}
        </small>
      </span>
      <Chevron />
    </button>
  );
}

// the week's streaks most at risk, above its games: what the games can take
// away (atRisk.ts), the most first, the rest behind "more"
function AtRisk({ wk, games, todayEp, onGame }) {
  const risk = useMemo(() => atRiskWeek(games, todayEp), [games, todayEp]);
  const [all, setAll] = useState(false);
  if (!risk.list.length) return null;
  const rows = all ? [...risk.list, ...risk.more] : risk.list;
  return (
    <section className="gwk">
      <div className="gwk-h gbk-h">
        <span className="gbk-ttl">Week {wk} at-risk streaks</span>
        <small>{span(games[0].ep, games[games.length - 1].ep)} · by what the game can take away</small>
      </div>
      <div className="gbk-list">
        {rows.map((r) => <AtRiskRow key={`${r.ti}|${r.s.dir}|${r.s.chips.join()}|${r.s.vs ?? ''}`} r={r} onGame={onGame} />)}
        {risk.more.length > 0 && (
          <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${risk.more.length} more at risk`}</button>
        )}
      </div>
    </section>
  );
}

// the ledger's row: kickoff, away, home, the line; beneath it the most
// interesting streak either side puts on the line, as a compressed claim
function Row({ g, todayEp, onGame }) {
  const top = topOnLine(g, todayEp);
  const line = lineText(g);
  // the matchup from an FBS side, the home one when both are
  const side = g.sides.find((s) => s.ti === g.home) ?? g.sides[0];
  return (
    <button className="gm" onClick={() => onGame(side.ti, side.row)} aria-label={`${teams[g.away].name} ${g.neutral ? 'vs' : 'at'} ${teams[g.home].name}: the matchup`}>
      <span className="gm-kick">{kickOf(g) || 'TBA'}</span>
      <Side ti={g.away} rank={g.awayRank} />
      <i className="gm-at">{g.neutral ? 'vs' : '@'}</i>
      <Side ti={g.home} rank={g.homeRank} />
      <span className="gm-line">{line}</span>
      {top && (
        <span className="gm-claim">
          {teams[top.ti].name} {VERB(top.s.dir)} <b className={baseDir(top.s.dir) === 'L' || top.s.dir === 'N' ? 'l' : ''}>{top.s.len}{top.s.atEdge ? '+' : ''}</b> straight{marginWords(top.s.dir)}{top.s.chips.length ? ` ${streakWords(top.s.chips, top.s.vs)}` : ''}
          <small> · {top.s.vs != null ? 'head-to-head' : `${rankText(top.s)} of ${top.s.field}`}</small>
        </span>
      )}
    </button>
  );
}

// a week's games under day dividers
function Week({ games, todayEp, onGame }) {
  const out = [];
  let last = null;
  for (const g of games) {
    if (g.ep !== last) { out.push(<div key={'d' + g.ep} className="gm-day">{dayOf(g.ep)} {monthDay(g.ep)}</div>); last = g.ep; }
    out.push(<Row key={g.i} g={g} todayEp={todayEp} onGame={onGame} />);
  }
  return <div className="gwk-list"><div className="gm gm-head" aria-hidden="true"><span>kick</span><span>away</span><span /><span>home</span><span className="gm-line">line</span></div>{out}</div>;
}

export function GamesPage({ todayEp, bwk, copied, on }) {
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
      <Broken bwk={bwk} onOpen={on.streak} onWeek={on.week} />
      {weeks.length > 0 && <AtRisk wk={weeks[0][0]} games={weeks[0][1]} todayEp={todayEp} onGame={on.game} />}
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
            {shown && <Week games={games} todayEp={todayEp} onGame={on.game} />}
          </section>
        );
      })}
    </div>
  );
}
