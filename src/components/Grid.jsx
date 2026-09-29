// The grid: teams as columns, one square per game, newest on top. When a team
// is open, desktop splits into panel | grid and a phone puts the panel in the
// team's slot of the rail with the next two columns peeking beside it.
//
// Opening and closing animate: the slot grows out of the 40px column and
// shrinks back into it, so nothing jumps and the neighbours slide rather than
// snap. The panel stays mounted through the exit (phase machine below).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { teams } from '../lib/model.ts';
import { streakGames } from '../lib/streaks.ts';
import { count, yy, yyOfYear, dirWord, rowKey, dayOf, monthDay, siteWord, kickOf } from '../lib/format.ts';
import { track } from '../lib/analytics.ts';
import { DESKTOP_CAP } from '../lib/view.ts';
import { Chip, NextChip, TeamMark } from './Chip.jsx';

const CHIP_CAP = 12;
const MOBILE_ALLTIME_CAP = 40;
const EXIT_MS = 280;

// how many columns the rail fits per row: the children sharing the first
// column's offsetTop. Measured at click time, so the split view's narrower
// rail counts too.
function columnsPerRow(rail) {
  const kids = rail ? [...rail.children].filter((el) => el.classList.contains('colbtn')) : [];
  if (!kids.length) return DESKTOP_CAP;
  const top = kids[0].offsetTop;
  return Math.max(1, kids.filter((el) => el.offsetTop === top).length);
}

function Column({ row, edgeFor, onOpen, hi, cover }) {
  const t = teams[row.ti];
  const games = streakGames(row);
  const shown = games.slice(0, CHIP_CAP);
  const ended = row.live === false;
  return (
    <button className={'colbtn' + (hi ? ' hi' : '')} onClick={onOpen} aria-label={`${t.name}: ${count(row.s)} straight`} aria-pressed={hi}>
      <span className={'colcount' + (row.onTheLine ? ' is-otl' : '') + (ended ? ' is-ended' : '')}>{count(row.s)}</span>
      {row.s.start && <span className="colspan">{yy(row.s.start.ep)}–{ended ? yy(row.s.end.ep) : 'now'}</span>}
      <TeamMark ti={row.ti} />
      {ended && (
        <span className="colbrk"><Chip g={row.ended} small cover={cover} /><span className="colyr">{yy(row.ended.ep)}</span></span>
      )}
      {!ended && row.s.start && (
        // all-time mode: a live run keeps the slot an ended run's breaker
        // takes, so the stacks line up; the next qualifying game fills it
        // when one is scheduled, in color, else it stays open-ended
        <span className={'colnext' + (row.next ? '' : ' open')}>
          {row.next && (
            <>
              <NextChip u={row.next} color small title={`next: ${dayOf(row.next.ep)} ${monthDay(row.next.ep)}${kickOf(row.next) ? ' ' + kickOf(row.next) : ''} ${siteWord(row.next)} ${teams[row.next.oppIdx]?.name}`} />
              <span className="colyr">{monthDay(row.next.ep)}</span>
            </>
          )}
        </span>
      )}
      <span className={'colstack' + (games.length > shown.length ? ' fade' : '')}>
        {shown.map((g) => <Chip key={g.i} g={g} cover={cover} />)}
      </span>
      {row.s.atEdge
        ? <span className="coledge">{yyOfYear(edgeFor(row.ti).year)}</span>
        : <span className="colender"><Chip g={row.s.ender} small cover={cover} /><span className="colyr">{yy(row.s.ender.ep)}</span></span>}
    </button>
  );
}

function Empty({ week, scope, dir }) {
  return (
    <p className="empty">
      {week
        ? `No ${dirWord(dir)} streak under this definition could be broken this week.`
        : `No team holds a${scope === 'all' ? '' : 'n active'} ${dirWord(dir)} streak under this definition.`}
    </p>
  );
}

/**
 * Which team the panel shows and which animation phase it is in. The panel
 * outlives `curTeam` by one exit animation so it can shrink away.
 */
function usePanelPhase(curTeam) {
  const [shown, setShown] = useState(curTeam);
  const [phase, setPhase] = useState(curTeam != null ? 'open' : 'idle');
  useLayoutEffect(() => {
    if (curTeam != null) {
      const fresh = shown == null || phase === 'exit';
      setShown(curTeam);
      if (!fresh) { setPhase('open'); return; }
      setPhase('enter');
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
      return () => cancelAnimationFrame(id);
    }
    if (shown == null) return;
    setPhase('exit');
    const id = setTimeout(() => { setShown(null); setPhase('idle'); }, EXIT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curTeam]);
  return [shown, phase];
}

export function Grid({ rows, curTeam, openKey, onPick, edgeFor, isMobile, limit, setLimit, week, scope, dir, panel }) {
  // a phone shows every active streak; the all-time list runs to thousands,
  // so it grows a chunk at a time there and a full row at a time on desktop
  const cap = isMobile ? (scope === 'all' ? Math.max(limit, MOBILE_ALLTIME_CAP) : rows.length) : limit;
  const visible = rows.slice(0, cap);
  const [shownKey, phase] = usePanelPhase(openKey);
  const shownTeam = shownKey == null ? null : curTeam;
  const railRef = useRef(null);
  const slotRef = useRef(null);

  // a phone: slide the rail sideways (never the page) so the slot sits at the
  // left edge with the next columns peeking
  useEffect(() => {
    // keyed on the shown team, not the phase: the phase flips enter -> open
    // within two frames and re-running here would cancel the pending slide
    if (!isMobile || shownKey == null) return;
    const rail = railRef.current;
    const slot = slotRef.current;
    if (!rail || !slot) return;
    // tweened by hand, in step with the width transition: a smooth scrollTo
    // would be clamped by the rail's not-yet-grown content and restart on
    // every call
    const from = rail.scrollLeft;
    const to = slot.getBoundingClientRect().left - rail.getBoundingClientRect().left + from;
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 320);
      const eased = 1 - (1 - t) ** 3;
      rail.scrollLeft = Math.min(from + (to - from) * eased, rail.scrollWidth - rail.clientWidth);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isMobile, shownKey]);

  const col = (row) => (
    <Column key={rowKey(row)} row={row} edgeFor={edgeFor} hi={rowKey(row) === shownKey} onOpen={() => onPick(row)} cover={dir === 'C'} />
  );
  const empty = rows.length === 0 && <Empty week={week} scope={scope} dir={dir} />;
  const what = scope === 'all' ? 'streaks' : 'teams';
  // desktop: complete the current row and add one more; phone: another chunk of the rail
  const showMore = () => { track('show more', { scope }); setLimit((l) => {
    if (isMobile) return Math.max(l, MOBILE_ALLTIME_CAP) + MOBILE_ALLTIME_CAP;
    const per = columnsPerRow(railRef.current);
    return (Math.floor(l / per) + 1) * per;
  }); };
  const more = !isMobile && (rows.length > visible.length || limit > DESKTOP_CAP) && (
    <div className="showmore">
      <span className="showmore-n">{visible.length.toLocaleString()} of {rows.length.toLocaleString()} {what}</span>
      {rows.length > visible.length && <button onClick={showMore}>more</button>}
      {limit > DESKTOP_CAP && <button onClick={() => setLimit(DESKTOP_CAP)}>fewer</button>}
    </div>
  );
  const railMore = isMobile && rows.length > visible.length && (
    <button key="more" className="colmore" onClick={showMore} aria-label={`Show more ${what}`}>
      <b>{(rows.length - visible.length).toLocaleString()}</b><span>more</span>
    </button>
  );

  if (shownKey == null) return <><div className="colwrap" ref={railRef}>{empty}{visible.map(col)}{railMore}</div>{more}</>;

  if (isMobile) {
    const inRail = visible.some((r) => rowKey(r) === shownKey);
    const slot = <div key="panel" className={'railslot ' + phase} ref={slotRef}>{panel}</div>;
    return (
      <div className="colwrap" ref={railRef}>
        {empty}
        {!inRail && slot}
        {visible.map((row) => (rowKey(row) === shownKey ? slot : col(row)))}
        {railMore}
      </div>
    );
  }

  return (
    <div className={'split ' + phase}>
      <div className="split-panel">{panel}</div>
      <div className="split-grid">
        <div className="colwrap" ref={railRef}>{empty}{visible.map(col)}</div>
        {more}
      </div>
    </div>
  );
}
