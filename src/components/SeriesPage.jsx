// A series: "Alabama vs Tennessee all-time record" (specs/series-page.spec.md).
// The page is the series', not either team's: every fact names its team with
// a word or a mark, and the address only decides who's on the left. The
// record as a scoreboard, every game as the winner's mark on a calendar (a
// row per decade, a slot per season), the record at each site, and the
// longest run each way. A mark shows its game in the line above the grid and
// opens the game's page; a meeting before 1936 is jhowell.net's and has none.

import { useMemo, useRef, useState } from 'react';
import { teams } from '../lib/model.ts';
import { seriesOf } from '../lib/series.ts';
import { seriesH1, seriesLead } from '../lib/seriesWords.ts';
import { fullDate, dayOf, monthDay, kickOf, spreadText } from '../lib/format.ts';
import { keyOf } from '../lib/game.ts';
import { hrefOf, gameUrl, teamUrl } from '../lib/url.ts';
import { TeamMark } from './Chip.jsx';
import { NavIcons } from './Dateline.jsx';
import { Chevron } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL;

/** A team's one-color mark drawn in the page's cream (a CSS mask), or its initial when no mark is committed. */
function Mono({ ti }) {
  const t = teams[ti];
  if (!t.espn) return <b className="ser-ini" aria-hidden="true">{t.name[0]}</b>;
  const url = `url(${BASE}logos/${t.espn}.png)`;
  return <i className="ser-mono" aria-hidden="true" style={{ WebkitMaskImage: url, maskImage: url }} />;
}

/** A game's two sides, the winner on the field first: [team, points, rank] each; a tie in the page's order. */
function sides(ti, oi, g) {
  const a = [ti, g.us, g.ownRank], b = [oi, g.them, g.oppRank];
  return g.us < g.them ? [b, a] : [a, b];
}
/** "Tulane by forfeit", "Alabama's win vacated": the ruling on a game, or null. */
function rulingText(ti, oi, g) {
  if (g.ruling === 'forfeit') return `${teams[g.r === 'W' ? ti : oi].name} by forfeit`;
  if (g.ruling === 'vacated') return `${teams[g.us > g.them ? ti : oi].name}'s win vacated`;
  return null;
}
const siteText = (ti, oi, g) => (g.site === 'neutral' ? 'neutral site' : `at ${teams[g.site === 'home' ? ti : oi].name}`);
/** "1922: Utah 49, BYU 0, at Utah", a mark's words for a screen reader and a crawler. */
function gameWords(ti, oi, g) {
  const [w, l] = sides(ti, oi, g);
  const rk = (n) => (n > 0 ? `#${n} ` : '');
  const ruled = rulingText(ti, oi, g);
  return `${g.se}: ${rk(w[2])}${teams[w[0]].name} ${w[1]}, ${rk(l[2])}${teams[l[0]].name} ${l[1]}${g.us === g.them ? ', a tie' : ''}${ruled ? `, ${ruled}` : ''}, ${siteText(ti, oi, g)}.`;
}

/** The line above the grid: the game a mark shows, winner first, and a way into its page. */
function GameLine({ ti, oi, g, href, onOpen }) {
  const [w, l] = sides(ti, oi, g);
  const rk = (n) => (n > 0 ? <em>#{n} </em> : null);
  const tie = g.us === g.them, ruled = rulingText(ti, oi, g);
  const body = (
    <>
      <span className="ser-ld">{fullDate(g.ep)}</span>
      <span className="ser-lt">
        {rk(w[2])}{tie || ruled ? `${teams[w[0]].name} ${w[1]}` : <strong>{teams[w[0]].name} {w[1]}</strong>}, {rk(l[2])}{teams[l[0]].name} {l[1]}{tie && !ruled && <small> tie</small>}{ruled && <small> · {ruled}</small>}
      </span>
      <span className="ser-ls">{siteText(ti, oi, g)}</span>
      {href && <Chevron />}
    </>
  );
  return href
    ? <a className="ser-line" href={href} onClick={(e) => { e.preventDefault(); onOpen(); }} aria-live="polite">{body}</a>
    : <div className="ser-line" aria-live="polite">{body}</div>;
}

/**
 * The calendar: a row per decade and a slot per season, the winner's mark in
 * each, a dashed square for a tie, a faint dot for a season they didn't meet.
 * Two or more empty decades in a row are one line. Each row's slots hold the
 * games' indices into s.games.
 */
function decades(games) {
  const first = games[0].se, last = games[games.length - 1].se;
  const bySe = new Map();
  games.forEach((g, i) => (bySe.get(g.se) ?? bySe.set(g.se, []).get(g.se)).push(i));
  const rows = [];
  for (let d = Math.floor(first / 10) * 10; d <= last; d += 10) {
    const slots = [];
    for (let y = d; y < d + 10; y++) slots.push({ se: y, games: bySe.get(y) ?? [], inSpan: y >= first && y <= last });
    const empty = slots.every((x) => !x.games.length);
    const prev = rows[rows.length - 1];
    if (empty && prev?.empty) { prev.to = d + 9; continue; }
    rows.push({ d, slots, empty, to: d + 9 });
  }
  // a run of one empty decade keeps its dots; two or more are one line, from the season after the last meeting to the season before the next
  return rows.map((r, k) => (r.empty && r.to > r.d + 9 ? { ...r, gap: [rows[k - 1].slots.findLast((x) => x.games.length).se + 1, rows[k + 1].slots.find((x) => x.games.length).se - 1] } : r));
}

function Games({ ti, oi, s, onGame }) {
  const n = s.games.length;
  const rows = useMemo(() => decades(s.games), [s]);
  // the game the line shows: the one a mouse is over, else the one picked (a tap, the keys), the last meeting at first
  const [sel, setSel] = useState(n - 1);
  const [hov, setHov] = useState(null);
  const shown = hov ?? sel;
  const pointer = useRef('mouse');
  const marks = useRef([]);
  const hrefOf_ = (g) => (g.row ? hrefOf(BASE, gameUrl(keyOf(g.side, g.row))) : null);
  const open = (g) => onGame(g.side, g.row);

  function move(e, i) {
    const g = s.games[i];
    const near = (se) => s.games.reduce((best, x, j) => (Math.abs(x.se - se) < Math.abs(s.games[best].se - se) ? j : best), i);
    const j = { ArrowLeft: i - 1, ArrowRight: i + 1, ArrowUp: near(g.se - 10), ArrowDown: near(g.se + 10), Home: 0, End: n - 1 }[e.key];
    if (j == null) return;
    e.preventDefault();
    const k = Math.max(0, Math.min(n - 1, j));
    setSel(k);
    marks.current[k]?.focus();
  }

  function mark(i) {
    const g = s.games[i];
    const href = hrefOf_(g);
    const props = {
      ref: (el) => { marks.current[i] = el; },
      className: 'ser-mk' + (g.r === 'T' && g.ruling !== 'vacated' ? ' tie' : '') + (g.ruling === 'vacated' ? ' vac' : '') + (i === shown ? ' on' : '') + (href ? '' : ' early'),
      tabIndex: i === sel ? 0 : -1,
      title: `${g.se}: ${g.us}–${g.them}`,
      onPointerDown: (e) => { pointer.current = e.pointerType; },
      onPointerEnter: (e) => { if (e.pointerType === 'mouse') setHov(i); },
      onKeyDown: (e) => move(e, i),
      onClick: (e) => {
        e.preventDefault();
        // a mouse or the keyboard (detail 0) opens the game; a finger shows it first, and a second tap on the same mark opens it
        const direct = e.detail === 0 || pointer.current !== 'touch';
        if (href && (direct || i === sel)) open(g);
        else { setSel(i); setHov(null); }
      },
    };
    const inner = (
      <>
        {g.ruling === 'vacated' ? <Mono ti={g.us > g.them ? ti : oi} /> : g.r === 'T' ? null : <Mono ti={g.r === 'W' ? ti : oi} />}
        <span className="sr-only">{gameWords(ti, oi, g)}</span>
      </>
    );
    return href ? <a key={g.ep} href={href} {...props}>{inner}</a> : <span key={g.ep} {...props}>{inner}</span>;
  }

  const g = s.games[shown];
  return (
    <>
      <h2>Games <span>{n}</span></h2>
      <GameLine ti={ti} oi={oi} g={g} href={hrefOf_(g)} onOpen={() => open(g)} />
      <div className="ser-grid" role="group" aria-label={`Every game, oldest first: ${teams[ti].name} vs ${teams[oi].name}`} onPointerLeave={() => setHov(null)}>
        {rows.map((r) => (r.gap ? (
          <div key={r.d} className="ser-dec gap"><span className="ser-dl" /><span className="ser-gap">No games {r.gap[0]}–{r.gap[1]}</span></div>
        ) : (
          <div key={r.d} className="ser-dec">
            <span className="ser-dl">{r.d}s</span>
            {r.slots.map((x) => (
              <span key={x.se} className={'ser-slot' + (x.games.length > 1 ? ' two' : '')}>
                {x.games.length ? x.games.map(mark) : x.inSpan ? <i className="ser-none" /> : null}
              </span>
            ))}
          </div>
        )))}
      </div>
    </>
  );
}

/** The next meeting, worded the way its game page's h1 is: "BYU at Utah", the day, the line. */
function NextMeeting({ ti, oi, u, onGame }) {
  const [home, away] = u.home ? [ti, oi] : [oi, ti];
  const sp = u.sp ?? null;
  const fav = sp == null ? null : sp === 0 ? 'PK' : `${teams[sp < 0 ? ti : oi].name} ${spreadText(-Math.abs(sp))}`;
  return (
    <button className="ser-next" onClick={() => onGame(ti, u)}>
      <span className="ser-nh">Next</span>
      <span className="ser-nt">{teams[away].name} {u.neutral ? 'vs' : 'at'} {teams[home].name}</span>
      <span className="ser-nw">{dayOf(u.ep)} {monthDay(u.ep)} {kickOf(u)}{fav && <> · {fav}</>}</span>
      <Chevron />
    </button>
  );
}

const span = (run) => (run.from === run.to ? String(run.from) : `${run.from}–${run.to}`);
const recTotal = ([w, l, t]) => w + l + t;

export function SeriesPage({ ti, oi, isMobile, copied, on, nav }) {
  const s = useMemo(() => seriesOf(ti, oi), [ti, oi]);
  const t = teams[ti], o = teams[oi];
  const last = s.games[s.games.length - 1];
  const lead = seriesLead(t.name, o.name, s.rec, s.games.length, s.since, s.now, last);
  const [w, l, ties] = s.rec;
  const side = (x) => (
    <a className="ser-side" href={hrefOf(BASE, teamUrl(x))} onClick={(e) => { e.preventDefault(); on.team(x); }}>
      {teams[x].espn ? <TeamMark ti={x} className="ser-logo" hidden /> : <b className="ser-logo ser-ini">{teams[x].name[0]}</b>}
      <span>{teams[x].name}</span>
    </a>
  );
  const cols = [['All games', s.rec], [`At ${t.name}`, s.site.home], [`At ${o.name}`, s.site.away], ['Neutral', s.site.neutral]].filter(([, r], k) => k === 0 || recTotal(r) > 0);
  const cell = (h, r, k) => <td key={h} className={r[k] > r[1 - k] ? 'hi' : undefined}>{r[k]}</td>;
  const nowWho = s.now.r === 'W' ? ti : oi;

  return (
    <div className="tpg ser">
      <div className="tpg-bar">
        <button className="crumb" onClick={on.board}><Chevron left /> Streak King</button>
        <NavIcons here="series" nav={nav} onShare={() => on.share(ti, oi)} shareLabel={`Share ${t.name} vs ${o.name}`} copied={copied} isMobile={isMobile} />
      </div>

      <h1 className="ser-h1">{seriesH1(t.name, o.name)}</h1>
      <div className="ser-score">
        {side(ti)}
        <b className={w >= l ? 'hi' : undefined}><span className="sr-only">{t.name} </span>{w}</b>
        <span className="ser-mid">{ties ? `${ties} ${ties === 1 ? 'tie' : 'ties'}` : 'wins'}</span>
        <b className={l >= w ? 'hi' : undefined}><span className="sr-only">{o.name} </span>{l}</b>
        {side(oi)}
      </div>
      <p className="landing-line ser-lead">{lead}</p>
      {s.next && <NextMeeting ti={ti} oi={oi} u={s.next} onGame={on.game} />}

      <Games ti={ti} oi={oi} s={s} onGame={on.game} />

      <h2>By site</h2>
      <table className="ser-site">
        <thead><tr><th><span className="sr-only">Team</span></th>{cols.map(([h]) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {[ti, oi].map((x, k) => (
            <tr key={x}>
              <th scope="row">{teams[x].espn ? <TeamMark ti={x} className="ser-tlogo" hidden /> : <b className="ser-tlogo ser-ini">{teams[x].name[0]}</b>}{teams[x].name}</th>
              {cols.map(([h, r]) => cell(h, r, k))}
            </tr>
          ))}
          <tr className="ties"><th scope="row">Ties</th>{cols.map(([h, r]) => <td key={h}>{r[2]}</td>)}</tr>
        </tbody>
      </table>

      <h2>Longest streaks</h2>
      <div className="ser-runs">
        {[[ti, oi, s.longest.W], [oi, ti, s.longest.L]].map(([x, y, run]) => (
          <p key={x}>
            <b>{run ? run.len : 0}</b>
            {teams[x].espn ? <TeamMark ti={x} className="ser-tlogo" hidden /> : <b className="ser-tlogo ser-ini">{teams[x].name[0]}</b>}
            <span>{run ? `${teams[x].name} won ${run.len} in a row, ${span(run)}` : `${teams[x].name} has never beaten ${teams[y].name}`}</span>
          </p>
        ))}
        {s.now.r !== 'T' && s.now.len >= 2 && (
          <p>
            <b>{s.now.len}</b>
            {teams[nowWho].espn ? <TeamMark ti={nowWho} className="ser-tlogo" hidden /> : <b className="ser-tlogo ser-ini">{teams[nowWho].name[0]}</b>}
            <span>{teams[nowWho].name} has won the last {s.now.len}, since {s.games[s.games.length - s.now.len].se}</span>
          </p>
        )}
      </div>
    </div>
  );
}
