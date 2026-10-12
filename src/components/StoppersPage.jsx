// Top Streak-Stoppers: every team by the streaks it ended by beating their
// owner this season, the most points first (stoppers.ts: a break of the
// all-time longest run under a definition is worth the most, of the run that
// led the active field less, of any other live run least, and fewer
// conditions are worth more). A row opens the team's page, at its breaks.

import { useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { STOP, STOP_CATS, STOP_WORDS, stopCat, stopPoints, stopRanking } from '../lib/stoppers.ts';
import { rankText } from '../lib/team.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron } from './Icons.jsx';
import { streakWords } from './StreakRow.jsx';
import { marginWords } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';

export const STOPPERS_CAP = 25;
const PAST = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' };
const pts = (x) => (Math.round(x * 10) / 10).toFixed(1);
const fmt = (n) => n.toLocaleString('en-US');

// the break worth the most to a stopper, in words: "Alabama had won 14 straight at home vs ranked opponents"
function bestWords(b) {
  return `${teams[b.ti]?.name} ${PAST[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${streakWords(b.chips)}` : ''}`;
}

function Row({ s, rank, onTeam }) {
  const t = teams[s.ti];
  const share = (c) => (s.n ? Math.round((s.by[c] / s.n) * 100) : 0);
  const best = s.best;
  return (
    <button className="stp-row" onClick={() => onTeam(s.ti)} aria-label={`${t.name}: the streaks it broke`}>
      <span className="stp-rank">{rank}</span>
      <span className="stp-team">
        {t.espn ? <TeamMark ti={s.ti} className="stp-logo" /> : <b className="stp-logo gm-ini">{t.name[0]}</b>}
        <span className="stp-name">{t.name}</span>
      </span>
      <span className="stp-pts">{pts(s.points)}</span>
      <span className="stp-n">{s.n}</span>
      <span className="stp-split">
        <span className="stp-stack" aria-hidden="true">
          {STOP_CATS.map((c) => <i key={c} className={`stp-${c}`} style={{ width: `${share(c)}%` }} />)}
        </span>
        <small>{STOP_CATS.map((c) => s.by[c]).join(' · ')}</small>
      </span>
      <span className="stp-best">
        {best && <span>{bestWords(best)}</span>}
        {best && <small>{pts(stopPoints(best))} pts · {STOP_WORDS[stopCat(best)]} · was {rankText(best)} of {best.field} · {best.chips.length} condition{best.chips.length === 1 ? '' : 's'}</small>}
      </span>
      <Chevron />
    </button>
  );
}

export function StoppersPage({ stoppers, copied, on }) {
  const [sort, setSort] = useState('points');
  const [all, setAll] = useState(false);
  const ranking = stoppers ? stopRanking(stoppers) : [];
  const ordered = sort === 'points' ? ranking : [...ranking].sort((a, b) => (sort === 'alltime' ? b.by.alltime - a.by.alltime : b.n - a.n) || b.points - a.points);
  const shown = all ? ordered : ordered.slice(0, STOPPERS_CAP);
  const total = (c) => ranking.reduce((a, s) => a + (c ? s.by[c] : s.n), 0);
  const season = stoppers?.season ?? P.currentSeason;
  const w = (c, n) => pts(STOP.points[c] / (1 + STOP.discount * n));
  return (
    <div className="stp">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <span className="dateline-acts">
          <button className="ico" onClick={on.share} aria-label="Share the streak-stoppers"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className="gpg-h1">Top Streak-Stoppers <span className="stp-se">{season}</span></h1>
      <p className="tpg-note">High scores are a good proxy for which fanbases are having the best time this season. A team gets credit for every streak it ended by winning the game. Breaking an all-time record is worth the most, breaking the longest active streak less, and breaking any other active streak the least. Streaks with fewer conditions are worth more.</p>

      <div className="stp-stats">
        <span><b>{fmt(total())}</b>streaks broken</span>
        <span><b className="stp-alltime-t">{fmt(total('alltime'))}</b>all-time longest</span>
        <span><b className="stp-leading-t">{fmt(total('leading'))}</b>led the field</span>
        <span><b className="stp-active-t">{fmt(total('active'))}</b>other active</span>
        <span><b>{ranking.length}</b>teams with one</span>
      </div>

      <div className="stp-sort">
        <span>rank by</span>
        <button className={'pill' + (sort === 'points' ? ' on' : '')} onClick={() => setSort('points')}>points</button>
        <button className={'pill' + (sort === 'n' ? ' on' : '')} onClick={() => setSort('n')}>streaks broken</button>
        <button className={'pill' + (sort === 'alltime' ? ' on' : '')} onClick={() => setSort('alltime')}>all-time longest</button>
      </div>

      <div className="stp-wrap">
        <div className="stp-list">
          <div className="stp-row stp-head" aria-hidden="true">
            <span>#</span><span>team</span><span>points</span><span>broke</span><span>all-time · led · other</span><span>biggest break</span><span />
          </div>
          {!stoppers && <p className="empty">finding the season’s breaks…</p>}
          {stoppers && ranking.length === 0 && <p className="empty">No streak has been broken this season yet.</p>}
          {shown.map((s, i) => <Row key={s.ti} s={s} rank={i + 1} onTeam={on.team} />)}
        </div>
      </div>
      {ordered.length > STOPPERS_CAP && (
        <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${ordered.length - STOPPERS_CAP} more teams`}</button>
      )}

      <h2>Points</h2>
      <p className="tpg-note">What a break is worth, by what kind of streak it was and how many conditions it had. Each condition divides the base by another {STOP.discount}.</p>
      <div className="stp-wrap">
        <table className="stp-weights">
          <thead><tr><th>break of a run that…</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th></tr></thead>
          <tbody>
            {STOP_CATS.map((c) => (
              <tr key={c} className={`stp-${c}-t`}><th>{c === 'alltime' ? 'was the all-time longest' : c === 'leading' ? 'led the active field' : 'was active, 2nd or lower'}</th>{[0, 1, 2, 3, 4].map((n) => <td key={n}>{w(c, n)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tpg-note">A streak counts once, however many ways the site can describe it. Losing streaks don’t count: you have to win the game. {STOP.covers ? 'Streaks against the spread count when the stopper covers.' : 'Streaks against the spread are left out for now.'}</p>
    </div>
  );
}
