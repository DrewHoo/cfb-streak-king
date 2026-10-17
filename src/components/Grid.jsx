// The grid: teams as columns, one square per game, newest on top. A column
// opens its streak's panel; when the run has a qualifying game scheduled,
// everything above the settled games (count, mark, next opponent) is a second
// button that opens that game's matchup. When a team is open, desktop joins
// its column and the panel in one card in the row, the panel to the column's
// right (the detail where the eye already is; the later columns wrap on), and
// ← → move the card to the previous or next column, Escape closes it. A
// phone keeps the rail as it is, the open column lit and scrolled into view,
// and puts the panel in a bottom sheet (vaul, the + menu's) over it, so the
// board stays in sight behind the streak: a shared link lands on the board
// with the streak rising over it, and a drag down or the × is the way back.
//
// Opening and closing animate. On desktop the columns glide from where they
// were to where the new layout puts them (FLIP, below), and the card's panel
// fades in beside its column and out again before the card goes (phase
// machine below). On a phone the sheet slides; the panel it shows is kept
// through the slide out.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { teams } from '../lib/model.ts';
import { streakGames, againstSpread } from '../lib/streaks.ts';
import { count, yy, yyOfYear, dirWord, gamesWord, rowKey, dayOf, monthDay, monthYear, yearOf, siteWord, kickOf } from '../lib/format.ts';
import { track } from '../lib/analytics.ts';
import { DESKTOP_CAP } from '../lib/view.ts';
import { Chip, NextChip, TeamMark } from './Chip.jsx';

const CHIP_CAP = 12;
const MOBILE_ALLTIME_CAP = 40;
const EXIT_MS = 280;

// how many columns the rail fits per row: the children sharing the first
// column's offsetTop. Measured at click time, so a row holding a card
// counts as it is.
function columnsPerRow(rail) {
  const kids = rail ? [...rail.children].filter((el) => el.classList.contains('colbtn')) : [];
  if (!kids.length) return DESKTOP_CAP;
  const top = kids[0].offsetTop;
  return Math.max(1, kids.filter((el) => el.offsetTop === top).length);
}

// What a column says, as text: the logos and squares are pictures, so a
// screen reader (and anything that reads the page as text, a search engine's
// or a chat app's fetcher) gets the run in words instead. It says only what
// the column shows: the team, the length, when it started, and how it ended.
// A run at the window's edge may be older than the data, so it says so.
export function columnWords(row, dir, edgeYear) {
  const t = teams[row.ti];
  const run = `${t.name}: ${count(row.s)} ${gamesWord(dir, row.s.len)} in a row`;
  // the run's first game: an all-time row carries it, an active one is its
  // oldest qualifying game (landing.ts reads the lead sentence's the same way)
  const first = row.s.start ?? (row.qual?.length >= row.s.len ? row.qual[row.qual.length - row.s.len] : undefined);
  if (row.s.atEdge && edgeYear) {
    return row.live === false ? `${run}, ${edgeYear} or earlier–${yearOf(row.s.end.ep)}.` : `${run}, since ${edgeYear} or earlier.`;
  }
  if (row.live === false) {
    const by = row.ended && teams[row.ended.oppIdx]?.name;
    return `${run}${first ? `, ${yearOf(first.ep)}–${yearOf(row.s.end.ep)}` : ''}${by ? `, ended ${siteWord(row.ended)} ${by}` : ''}.`;
  }
  return `${run}${first ? `, since ${monthYear(first.ep)}` : ''}.`;
}

function Column({ row, edgeFor, onOpen, onGame, hi, cover, slot, otl, flipKey, dir }) {
  const t = teams[row.ti];
  const games = streakGames(row);
  const shown = games.slice(0, CHIP_CAP);
  const ended = row.live === false;
  const nextTitle = row.next && `next: ${dayOf(row.next.ep)} ${monthDay(row.next.ep)}${kickOf(row.next) ? ' ' + kickOf(row.next) : ''} ${siteWord(row.next)} ${teams[row.next.oppIdx]?.name}`;
  const head = (
    <>
      <span className={'colcount' + (otl && row.onTheLine ? ' is-otl' : '') + (ended ? ' is-ended' : '')} aria-hidden="true">{count(row.s)}</span>
      {row.s.start && <span className="colspan" aria-hidden="true">{yy(row.s.start.ep)}–{ended ? yy(row.s.end.ep) : 'now'}</span>}
      <TeamMark ti={row.ti} hidden />
      {!ended && slot && (
        // a live run keeps the slot an ended run's breaker takes, so the
        // stacks line up; the next qualifying game fills it when one is
        // scheduled, in color, else the same chip and date hold it open, unseen
        <span className={'colnext' + (row.next ? '' : ' open')} aria-hidden="true">
          {row.next
            ? <NextChip u={row.next} color small title={nextTitle} />
            : <span className="sq p s" />}
          <span className="colyr">{row.next ? monthDay(row.next.ep) : '0/0'}</span>
        </span>
      )}
    </>
  );
  const body = (
    <>
      {ended && (
        <span className="colbrk" aria-hidden="true"><Chip g={row.ended} small cover={cover} /><span className="colyr">{yy(row.ended.ep)}</span></span>
      )}
      <span className={'colstack' + (games.length > shown.length ? ' fade' : '')} aria-hidden="true">
        {shown.map((g) => <Chip key={g.i} g={g} cover={cover} />)}
      </span>
      {row.s.atEdge
        ? <span className="coledge" aria-hidden="true">{yyOfYear(edgeFor(row.ti).year)}</span>
        : <span className="colender" aria-hidden="true"><Chip g={row.s.ender} small cover={cover} /><span className="colyr">{yy(row.s.ender.ep)}</span></span>}
    </>
  );
  // the words are the buttons' text, so they're their names too (no aria-label)
  const words = <span className="sr-only">{columnWords(row, dir, row.s.atEdge ? edgeFor(row.ti).year : null)}</span>;
  // no game to open: the whole column is the streak's button, as it always was
  if (!row.next) {
    return <button className={'colbtn' + (hi ? ' hi' : '')} data-flip={flipKey} onClick={onOpen} aria-pressed={hi}>{words}{head}{body}</button>;
  }
  return (
    <div className={'colbtn two' + (hi ? ' hi' : '')} data-flip={flipKey}>
      <button className="colhead" onClick={() => onGame(row.ti, row.next)}><span className="sr-only">{t.name} {nextTitle}: the game.</span>{head}</button>
      <button className="colbody" onClick={onOpen} aria-pressed={hi}>{words}{body}</button>
    </div>
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

// a column's place on the page, ignoring transforms, so a column caught
// mid-glide still measures where the layout put it
function pagePos(el) {
  let x = 0;
  let y = 0;
  for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
  return [x, y];
}
const measure = (root) => new Map([...root.querySelectorAll('[data-flip]')].map((el) => [el.dataset.flip, pagePos(el)]));

/**
 * Desktop: when the layout changes (a card opens, closes or moves to another
 * column), every column glides from its old place to its new one. Positions
 * are kept current after each render and on resize, so a later switch starts
 * from the truth.
 */
function useColumnGlide(ref, mode) {
  const last = useRef({ pos: null, mode: null });
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = measure(root);
    const { pos, mode: was } = last.current;
    last.current = { pos: next, mode };
    if (!pos || was === mode || mode === 'rail' || was === 'rail') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const el of root.querySelectorAll('[data-flip]')) {
      const from = pos.get(el.dataset.flip);
      const to = next.get(el.dataset.flip);
      if (!from) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }); continue; }
      const dx = from[0] - to[0];
      const dy = from[1] - to[1];
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 440, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    }
  });
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { last.current.pos = measure(root); });
    ro.observe(root);
    return () => ro.disconnect();
    // each mode renders its own wrapper, so observe the new one
  }, [ref, mode]);
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

export function Grid({ rows, curTeam, openKey, onPick, onGame, onClose, edgeFor, isMobile, limit, setLimit, week, scope, dir, panel }) {
  // a phone shows every active streak; the all-time list runs to thousands,
  // so it grows a chunk at a time there and a full row at a time on desktop
  const cap = isMobile ? (scope === 'all' ? Math.max(limit, MOBILE_ALLTIME_CAP) : rows.length) : limit;
  const visible = rows.slice(0, cap);
  const [shownKey, phase] = usePanelPhase(openKey);
  const lastPanel = useRef(null);
  // the lit column: on desktop the one the panel shows, through its exit; on
  // a phone the open one, the sheet does its own exit
  const litKey = isMobile ? openKey : shownKey;
  const railRef = useRef(null);
  const wrapRef = useRef(null);
  useColumnGlide(wrapRef, isMobile ? 'rail' : shownKey ?? 'grid');

  // desktop: ← → open the previous or next column's streak, Escape closes.
  // Not while a menu or a field has the keys (a Radix menu claims them first).
  const viaKey = useRef(false);
  useEffect(() => {
    if (isMobile || openKey == null) return;
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = visible.findIndex((r) => rowKey(r) === openKey);
      if (i < 0) return;
      const next = visible[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (!next) return;
      e.preventDefault();
      viaKey.current = true;
      onPick(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, openKey, visible, onPick, onClose]);

  // a card reached by the keys is brought into view; a clicked one is already there
  useEffect(() => {
    if (isMobile || openKey == null || !viaKey.current) return;
    viaKey.current = false;
    wrapRef.current?.querySelector('.card')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [isMobile, openKey]);

  // a phone: bring the open column to the middle of the rail (never the
  // page), so what the sheet is about shows above it
  useEffect(() => {
    if (!isMobile || openKey == null) return;
    const rail = railRef.current;
    const el = rail?.querySelector('.colbtn.hi');
    if (!rail || !el) return;
    const left = el.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft - (rail.clientWidth - el.offsetWidth) / 2;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // (optional-chained for jsdom, which has no element scrollTo)
    rail.scrollTo?.({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [isMobile, openKey]);

  // the top slot: always on the all-time board, where ended runs fill it with
  // their breaker; on the active board only when some run has a game coming
  const slot = scope === 'all' || visible.some((r) => r.next);
  // the all-time board marks a live run that's on the line this week with a
  // rust count; on the active board the next-game chip already says so
  const col = (row) => (
    <Column key={rowKey(row)} flipKey={rowKey(row)} row={row} edgeFor={edgeFor} hi={rowKey(row) === litKey} onOpen={() => onPick(row)} onGame={onGame} cover={againstSpread(dir)} slot={slot} otl={scope === 'all'} dir={dir} />
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

  if (isMobile) {
    return (
      <div ref={wrapRef}>
        <div className="colwrap" ref={railRef}>{empty}{visible.map(col)}{railMore}</div>
        <StreakSheet open={curTeam != null} name={curTeam != null ? teams[curTeam].name : ''} onClose={onClose}>{panel}</StreakSheet>
      </div>
    );
  }

  if (shownKey == null) return <div ref={wrapRef}><div className="colwrap" ref={railRef}>{empty}{visible.map(col)}</div>{more}</div>;

  // the open column and the panel, one card in the row; the panel last shown
  // stays in it through the exit, so it has something to fade out
  if (panel) lastPanel.current = panel;
  const card = (row) => (
    <div key={'card:' + rowKey(row)} className={'card ' + phase}>
      {col(row)}
      <div className="card-panel">{panel ?? lastPanel.current}</div>
    </div>
  );
  // a streak opened from elsewhere than the grid (the + menu's kings, a link)
  // whose column is past "more": its card leads the grid, the column with it
  const shownRow = rows.find((r) => rowKey(r) === shownKey);
  const floating = shownRow && !visible.some((r) => rowKey(r) === shownKey) ? card(shownRow) : null;
  return (
    <div ref={wrapRef}>
      <div className="colwrap" ref={railRef}>
        {empty}
        {floating}
        {visible.map((row) => (rowKey(row) === shownKey ? card(row) : col(row)))}
      </div>
      {more}
    </div>
  );
}

// the sheet's two heights: open at the first, the rail's heads still showing
// above it; dragged up to the second to read a long ledger
const SHEET_SNAPS = [0.62, 0.94];

/**
 * A phone's streak panel: a bottom sheet over the board. Closing (a drag
 * down, the overlay, the panel's ×, Escape) goes through `onClose`, so Back
 * and the sheet agree; the panel last shown stays in the sheet while it
 * slides out. Each opening starts at the lower height.
 */
function StreakSheet({ open, name, onClose, children }) {
  const last = useRef(null);
  if (children) last.current = children;
  const [snap, setSnap] = useState(SHEET_SNAPS[0]);
  useEffect(() => { if (open) setSnap(SHEET_SNAPS[0]); }, [open]);
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} snapPoints={SHEET_SNAPS} activeSnapPoint={snap} setActiveSnapPoint={setSnap} fadeFromIndex={0}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-ov" />
        <Drawer.Content className="sheet streak" aria-describedby={undefined}>
          <Drawer.Title className="sr-only">{name ? `${name}'s streak` : 'Streak'}</Drawer.Title>
          <div className="sheet-body">{children ?? last.current}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
