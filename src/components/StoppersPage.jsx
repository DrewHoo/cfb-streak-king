// Top Streak-Stoppers: every team by the streaks it ended by beating their
// owner this season, the most points first (stoppers.ts: a break of the
// all-time longest run under a definition is worth the most, of the run that
// led the active field less, of any other live run least, and fewer
// conditions are worth more). A row opens the team's page, at its breaks.

import { useMemo, useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { STOP, STOP_CATS, STOP_WORDS, stopCat, stopPoints, stopRanking, stopRows, stopSummary } from '../lib/stoppers.ts';
import { rankText } from '../lib/team.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron } from './Icons.jsx';
import { streakWords, StreakRow, Tellings } from './StreakRow.jsx';
import { dayOf, monthDay } from '../lib/format.ts';
import { marginWords } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';

export const STOPPERS_CAP = 25;
const STOPS_CAP = 12;
const PAST = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' };
const pts = (x) => (Math.round(x * 10) / 10).toFixed(1);
const fmt = (n) => n.toLocaleString('en-US');

// the break worth the most to a stopper, in words: "Alabama had won 14 straight at home vs ranked opponents"
function bestWords(b) {
  return `${teams[b.ti]?.name} ${PAST[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${streakWords(b.chips)}` : ''}`;
}

function Row({ s, rank, onStopper }) {
  const t = teams[s.ti];
  const share = (c) => (s.n ? Math.round((s.by[c] / s.n) * 100) : 0);
  const best = s.best;
  return (
    <button className="stp-row" onClick={() => onStopper(s.ti)} aria-label={`${t.name}: the streaks it broke`}>
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

/** One team's stopped streaks: whose they were (a tap filters), then the list, the all-time longest first. */
export function StopperPage({ ti, stoppers, copied, on }) {
  const t = teams[ti];
  const [all, setAll] = useState(false);
  const [victim, setVictim] = useState(null);
  const rows = useMemo(() => (stoppers ? stopRows(stoppers.teams.get(ti) ?? []) : null), [stoppers, ti]);
  const sum = useMemo(() => (rows ? stopSummary(ti, rows) : null), [rows, ti]);
  const rank = stoppers?.ranks.get(ti) ?? null;
  // whose streaks they were, the most first (standing rows only)
  const victims = useMemo(() => {
    const n = new Map();
    for (const b of rows ?? []) if (!b.dup) n.set(b.ti, (n.get(b.ti) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || teams[a[0]].name.localeCompare(teams[b[0]].name));
  }, [rows]);
  const shown = rows && victim != null ? rows.filter((b) => b.ti === victim) : rows;
  return (
    <div className="stp">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.stoppers}><Chevron left /> Top Streak-Stoppers</button>
        <span className="dateline-acts">
          <button className="ico" onClick={() => on.share(ti)} aria-label={`Share the streaks ${t.name} stopped`}><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className="gpg-h1 stp-h1">{t.espn ? <TeamMark ti={ti} className="stp-logo" /> : null}<span>Streaks {t.name} stopped <span className="stp-se">{stoppers?.season ?? P.currentSeason}</span></span></h1>
      <p className="tpg-note">
        {sum && sum.n > 0
          ? <>{t.name} ended <b>{sum.n}</b> {sum.n === 1 ? 'streak' : 'streaks'} by winning: {sum.by.alltime} all-time longest, {sum.by.leading} that led the field, {sum.by.active} other. <b>{pts(sum.points)}</b> points{rank != null ? `, #${rank} among streak-stoppers` : ''}. </>
          : sum ? <>{t.name} hasn’t broken a streak this season. </> : null}
        <button className="gp-wk" onClick={() => on.team(ti)}>{t.name}’s page ›</button>
      </p>
      {victims.length > 1 && (
        <div className="stp-vict" role="group" aria-label="Whose streaks, with a count each; one filters the list">
          {victims.map(([v, n]) => (
            <button key={v} className={'stp-v' + (victim === v ? ' on' : '')} onClick={() => setVictim(victim === v ? null : v)} aria-pressed={victim === v} title={teams[v].name}>
              {teams[v].espn ? <TeamMark ti={v} className="stp-logo" /> : <b className="stp-logo gm-ini">{teams[v].name[0]}</b>}<b>{n}</b>
            </button>
          ))}
        </div>
      )}
      <div className="tpg-streaks">
        {rows === null && <p className="empty">finding the streaks {t.name} broke…</p>}
        {shown !== null && <Tellings rows={shown} cap={STOPS_CAP} all={all} setAll={setAll} moreWord="broken" keyOf={(b) => `${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`} render={(b) => (
          <StreakRow s={b} mark={b.ti} lead={`${teams[b.ti].name}’s run · ${STOP_WORDS[stopCat(b)]}`} tag={`${dayOf(b.ender.ep)} ${monthDay(b.ender.ep)}`} onClick={() => on.streak(b, b.ti)} />
        )} />}
      </div>
    </div>
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
          {shown.map((s, i) => <Row key={s.ti} s={s} rank={i + 1} onStopper={on.stopper} />)}
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
    </div>
  );
}
