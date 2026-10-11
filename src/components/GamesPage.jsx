// The schedule: every scheduled game with an FBS team, by week, as a ledger:
// kickoff, away, home, the line as of the build, and beneath a row the most
// interesting streak on the line in it, said in a line. The first week (the
// one with games still unrecorded) is open; later weeks open on a tap. A row
// opens the game's matchup.

import { useEffect, useMemo, useRef, useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { scheduledGames, lineText, rankText } from '../lib/team.ts';
import { completedWeeks } from '../lib/weeks.ts';
import { dayOf, monthDay, kickOf, marginWords, siteWord, spreadText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron, LinkIcon } from './Icons.jsx';
import { streakWords } from './Matchup.jsx';
import { Picker } from './Picker.jsx';

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

// the digest of one completed week's broken runs: the week before the
// selected one, so it sits above that week's at-risk streaks and games
function Broken({ wk, digests, onOpen, onLink }) {
  const broken = digests?.broken[wk];
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
          {broken.wk != null && <button className="lnk" onClick={() => onLink('broken', broken.wk)} aria-label={`Link to Week ${broken.wk}’s broken streaks`} title="link to this"><LinkIcon /></button>}
        </small>
      </div>
      <div className="gbk-list">
        {rows.map((b) => (
          <BrokenRow key={`${b.ti}|${b.dir}|${b.chips.join()}`} b={b} onOpen={onOpen} />
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
function AtRisk({ wk, games, risk, onGame, onLink, focus }) {
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
          {span(games[0].ep, games[games.length - 1].ep)} · by what the game can take away
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

// the ledger's row: kickoff, away, home, the line; beneath it the most
// interesting streak either side puts on the line, as a compressed claim
function Row({ g, top, onGame }) {
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
          {teams[top.ti].name} {VERB(top.s.dir)} <b className={baseDir(top.s.dir) === 'L' || top.s.dir === 'N' ? 'l' : ''}>{top.s.len}{top.s.atEdge ? '+' : ''}</b> straight{marginWords(top.s.dir)}{top.s.chips.length ? ` ${streakWords(top.s.chips)}` : ''}
          <small> · {rankText(top.s)} of {top.s.field}</small>
        </span>
      )}
    </button>
  );
}

// a week's games under day dividers
function Week({ games, digests, onGame }) {
  const out = [];
  let last = null;
  for (const g of games) {
    if (g.ep !== last) { out.push(<div key={'d' + g.ep} className="gm-day">{dayOf(g.ep)} {monthDay(g.ep)}</div>); last = g.ep; }
    out.push(<Row key={g.i} g={g} top={digests?.onLine[g.i]} onGame={onGame} />);
  }
  return <div className="gwk-list"><div className="gm gm-head" aria-hidden="true"><span>kick</span><span>away</span><span /><span>home</span><span className="gm-line">line</span></div>{out}</div>;
}

/**
 * The weeks the page can open on: every week with games scheduled, and the
 * week after each completed one (so its broken digest is reachable). The
 * default is the first scheduled week, the one about to be played.
 */
export function gameWeeks() {
  const byWk = new Map();
  for (const g of scheduledGames()) (byWk.get(g.wk) ?? byWk.set(g.wk, []).get(g.wk)).push(g);
  const scheduled = [...byWk.entries()].sort((a, b) => a[0] - b[0]);
  const options = new Set(scheduled.map(([wk]) => wk));
  for (const w of completedWeeks()) if (w.wk != null) options.add(w.wk + 1);
  return { scheduled, options: [...options].sort((a, b) => a - b), first: scheduled[0]?.[0] ?? Math.max(0, ...options) };
}

export function GamesPage({ digests, bwk, risk, copied, on }) {
  const { scheduled: weeks, options, first } = useMemo(gameWeeks, []);
  // the selected week: its at-risk streaks and games, and the week before it's broken runs
  const sel = bwk ?? first;
  const selGames = weeks.find(([wk]) => wk === sel)?.[1];
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
      <h1 className="gpg-h1">
        {P.currentSeason} games
        {options.length > 1 && (
          <span className="gbk-wk"> · <Picker value={sel} options={options.map((wk) => ({ value: wk, label: `Week ${wk}` }))} onChange={on.week} ariaLabel="Pick a week" /></span>
        )}
      </h1>
      <p className="tpg-note">Every scheduled game with an FBS team, the line as of {monthDay(Math.floor(Date.parse(P.builtAt) / 86400000))}, and the streak most on the line in it. Results land with the weekly rebuild.</p>
      {!digests && <p className="empty">finding the week’s streaks…</p>}
      <Broken wk={sel - 1} digests={digests} onOpen={on.streak} onLink={on.link} />
      {selGames && digests?.atRisk?.wk === sel && <AtRisk wk={sel} games={selGames} risk={digests.atRisk} onGame={on.game} onLink={on.link} focus={risk} />}
      {weeks.length === 0 && <p className="empty">No games are scheduled.</p>}
      {weeks.map(([wk, games]) => {
        const shown = wk === sel || open.has(wk);
        return (
          <section key={wk} className="gwk">
            <button className={'gwk-h' + (shown ? ' on' : '')} onClick={() => toggle(wk)} aria-expanded={shown} disabled={wk === sel}>
              <span>Week {wk}</span>
              <small>{span(games[0].ep, games[games.length - 1].ep)} · {games.length} games</small>
              {wk !== sel && <Chevron />}
            </button>
            {shown && <Week games={games} digests={digests} onGame={on.game} />}
          </section>
        );
      })}
    </div>
  );
}
