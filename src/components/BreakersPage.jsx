// Top Streak-Breakers: every team by the streaks it ended by beating their
// owner this season, in Streak King Rank order (breakers.ts: the points behind
// it count a break of the all-time longest run under a definition most, of
// the longest active run less, and fewer conditions more; the page shows only
// the order). A row opens the team's breaks, at /breakers/<id>/.

import { useEffect, useMemo, useRef, useState } from 'react';
import { P, teams } from '../lib/model.ts';
import { BREAK_WORDS, breakCat, breakOrder, breakRanking, breakRows, breakSummary } from '../lib/breakers.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron } from './Icons.jsx';
import { streakWords, StreakRow, Tellings } from './StreakRow.jsx';
import { dayOf, monthDay } from '../lib/format.ts';
import { marginWords } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';

export const BREAKERS_CAP = 25;
const BREAKS_CAP = 12;
const PAST = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' };
export const SKR_NOTE = 'Streak King Rank measures a team’s season by the rarity of the streaks they broke by beating other teams.';

// the break worth the most to a breaker, in words: "Alabama had won 14 straight at home vs ranked opponents"
function bestWords(b) {
  return `${teams[b.ti]?.name} ${PAST[baseDir(b.dir)]} ${b.len}${b.atEdge ? '+' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${streakWords(b.chips)}` : ''}`;
}

const Mark = ({ ti, className }) => (teams[ti].espn ? <TeamMark ti={ti} className={className} /> : <b className={className + ' gm-ini'} title={teams[ti].name}>{teams[ti].name[0]}</b>);

/** Whose streaks a team broke, a logo and a count each (the most first). */
const Victims = ({ victims }) => victims.map(([v, n]) => (
  <span key={v} className="bkr-v" title={`${teams[v].name}: ${n}`}><Mark ti={v} className="bkr-vlogo" /><b>{n}</b></span>
));

/** An ⓘ that says what SKR is: on hover, and on a tap for touch. */
export function SkrInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);
  return (
    <span className={'tip' + (open ? ' open' : '')} ref={ref}>
      <button className="tip-i" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-label="What is SKR?" aria-expanded={open}>i</button>
      <span className="tip-body" role="tooltip">{SKR_NOTE}</span>
    </span>
  );
}

function Row({ s, skr, onBreaker }) {
  const t = teams[s.ti];
  const best = s.best;
  return (
    <button className="bkr-row" onClick={() => onBreaker(s.ti)} aria-label={`${t.name}: the streaks it broke`}>
      <span className="bkr-team" title={t.name}><Mark ti={s.ti} className="bkr-logo" /></span>
      <span className="bkr-skr">{skr}</span>
      <span className="bkr-n">
        <b>{s.n}</b>
        <small><span className="bkr-alltime-t">{s.by.alltime}</span> all-time</small>
        <small><span className="bkr-leading-t">{s.by.leading}</span> longest active</small>
      </span>
      <span className="bkr-vs"><Victims victims={s.victims} /></span>
      <span className="bkr-best">
        {best && <span>{bestWords(best)}</span>}
        {best && <small className={`bkr-${breakCat(best)}-t`}>{BREAK_WORDS[breakCat(best)]}</small>}
      </span>
      <Chevron />
    </button>
  );
}

/** One team's broken streaks: whose they were (a tap filters), then the list, the all-time longest first. */
export function BreakerPage({ ti, breakers, copied, on }) {
  const t = teams[ti];
  const [all, setAll] = useState(false);
  const [victim, setVictim] = useState(null);
  const rows = useMemo(() => (breakers ? breakRows(breakers.teams.get(ti) ?? []) : null), [breakers, ti]);
  const sum = useMemo(() => (rows ? breakSummary(ti, rows) : null), [rows, ti]);
  const rank = breakers?.ranks.get(ti) ?? null;
  const victims = sum?.victims ?? [];
  const shown = rows && victim != null ? rows.filter((b) => b.ti === victim) : rows;
  return (
    <div className="bkr">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.breakers}><Chevron left /> Top Streak-Breakers</button>
        <span className="dateline-acts">
          <button className="ico" onClick={() => on.share(ti)} aria-label={`Share the streaks ${t.name} broke`}><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className="gpg-h1 bkr-h1">{t.espn ? <TeamMark ti={ti} className="bkr-logo" /> : null}<span>Streaks {t.name} broke <span className="bkr-se">{breakers?.season ?? P.currentSeason}</span></span></h1>
      <p className="tpg-note bkr-note">
        {sum && sum.n > 0
          ? <>{t.name} ended <b>{sum.n}</b> {sum.n === 1 ? 'streak' : 'streaks'} by winning: {sum.by.alltime} all-time longest, {sum.by.leading} longest active{rank != null ? <>. Streak King Rank <b>#{rank}</b> <SkrInfo /></> : ''}. </>
          : sum ? <>{t.name} hasn’t broken a streak this season. </> : null}
        <button className="gp-wk" onClick={() => on.team(ti)}>{t.name}’s page ›</button>
      </p>
      {victims.length > 1 && (
        <div className="bkr-vict" role="group" aria-label="Whose streaks, with a count each; one filters the list">
          {victims.map(([v, n]) => (
            <button key={v} className={'bkr-v' + (victim === v ? ' on' : '')} onClick={() => setVictim(victim === v ? null : v)} aria-pressed={victim === v} title={teams[v].name}>
              <Mark ti={v} className="bkr-vlogo" /><b>{n}</b>
            </button>
          ))}
        </div>
      )}
      <div className="tpg-streaks">
        {rows === null && <p className="empty">finding the streaks {t.name} broke…</p>}
        {shown !== null && <Tellings rows={shown} cap={BREAKS_CAP} all={all} setAll={setAll} moreWord="broken" order={breakOrder} keyOf={(b) => `${b.ti}|${b.dir}|${b.chips.join()}|${b.run}`} render={(b) => (
          <StreakRow s={b} mark={b.ti} lead={`${teams[b.ti].name}’s run · ${BREAK_WORDS[breakCat(b)]}`} tag={`${dayOf(b.ender.ep)} ${monthDay(b.ender.ep)}`} onClick={() => on.streak(b, b.ti)} />
        )} />}
      </div>
    </div>
  );
}

// a column's sort: its key, and which way first (SKR #1 first, the most breaks first, A to Z)
const SORTS = {
  skr: (a, b) => a.skr - b.skr,
  n: (a, b) => b.n - a.n || a.skr - b.skr,
  team: (a, b) => teams[a.ti].name.localeCompare(teams[b.ti].name),
};

export function BreakersPage({ breakers, copied, on }) {
  const [sort, setSort] = useState({ key: 'skr', rev: false });
  const [all, setAll] = useState(false);
  const ranking = useMemo(() => (breakers ? breakRanking(breakers).map((s, i) => ({ ...s, skr: breakers.ranks.get(s.ti) ?? i + 1 })) : []), [breakers]);
  const ordered = useMemo(() => {
    const out = [...ranking].sort(SORTS[sort.key]);
    return sort.rev ? out.reverse() : out;
  }, [ranking, sort]);
  const shown = all ? ordered : ordered.slice(0, BREAKERS_CAP);
  const season = breakers?.season ?? P.currentSeason;
  const head = (key, label) => (
    <button className={'bkr-sort' + (sort.key === key ? ' on' : '')} onClick={() => setSort((s) => ({ key, rev: s.key === key ? !s.rev : false }))}
      aria-label={`Sort by ${label}`} aria-pressed={sort.key === key}>
      {label}{sort.key === key ? <i aria-hidden="true">{sort.rev ? '↑' : '↓'}</i> : null}
    </button>
  );
  return (
    <div className="bkr">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <span className="dateline-acts">
          <button className="ico" onClick={on.share} aria-label="Share the streak-breakers"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className="gpg-h1">Top Streak-Breakers <span className="bkr-se">{season}</span></h1>
      <p className="tpg-note">Which fanbases are having the best time this season: every team that ended an all-time longest or the longest active streak by winning the game.</p>

      <div className="bkr-list">
        <div className="bkr-row bkr-head">
          <span>{head('team', 'team')}</span>
          <span className="bkr-skrh">{head('skr', 'SKR')}<SkrInfo /></span>
          <span>{head('n', 'streaks broken')}</span>
          <span className="bkr-vsh">whose</span>
          <span className="bkr-besth">biggest break</span>
          <span />
        </div>
        {!breakers && <p className="empty">finding the season’s breaks…</p>}
        {breakers && ranking.length === 0 && <p className="empty">No streak has been broken this season yet.</p>}
        {shown.map((s) => <Row key={s.ti} s={s} skr={s.skr} onBreaker={on.breaker} />)}
      </div>
      {ordered.length > BREAKERS_CAP && (
        <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${ordered.length - BREAKERS_CAP} more teams`}</button>
      )}
    </div>
  );
}
