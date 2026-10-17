// The named definition boards (landing.ts), listed under the grid: one row
// per definition ("home win streaks"), with its active and all-time pages
// side by side, so the two scopes line up and the row says the noun phrase
// once. Each link leads with the mark of the team that holds that board
// today. Every link is the page's real address, so a crawler reaches
// every one from the board, and a tap opens the definition in place.

import { useMemo } from 'react';
import { LANDINGS } from '../lib/landing.ts';
import { landingView } from '../lib/url.ts';
import { DEFAULT_CHIPS, encodeChips } from '../lib/definition.ts';
import { activeBoard, allTimeBoard } from '../lib/model.ts';
import { TeamMark } from './Chip.jsx';

const BASE = import.meta.env.BASE_URL;

// the default definition's all-time board is the root page, not a landing
// (landing.ts); its row links there under the same words
const ROOT_C = encodeChips(DEFAULT_CHIPS);

// rows in the table's order, keyed by the noun phrase the two scopes share
function rowsOf() {
  const rows = new Map();
  for (const l of LANDINGS) {
    if (!rows.has(l.what)) rows.set(l.what, { what: l.what, active: null, all: null });
    rows.get(l.what)[l.scope === 'active' ? 'active' : 'all'] = l;
  }
  for (const r of rows.values()) {
    if (!r.all && r.active?.c === ROOT_C && r.active.dir === 'W') r.all = { slug: '', c: ROOT_C, dir: 'W', scope: 'all', what: r.what };
  }
  return [...rows.values()];
}
const ROWS = rowsOf();

// the team at the top of a landing's board (ties: the board's first)
function leaderOf(l, todayEp) {
  const v = landingView(l);
  const board = l.scope === 'all' ? allTimeBoard(v.active, v.dir, todayEp) : activeBoard(v.active, v.dir, todayEp);
  return board.length ? board[0].ti : null;
}

const Mark = ({ ti }) => (ti != null ? <TeamMark ti={ti} className="landings-mark" /> : null);

export function Landings({ current, todayEp, hrefOf, onOpen }) {
  const leaders = useMemo(() => new Map(ROWS.flatMap((r) => [r.active, r.all].filter(Boolean).map((l) => [l.slug, leaderOf(l, todayEp)]))), [todayEp]);
  const link = (l, text) => (
    <a href={hrefOf(l)} aria-current={current?.slug === l.slug ? 'page' : undefined} onClick={(e) => { e.preventDefault(); onOpen(l); }}>
      <Mark ti={leaders.get(l.slug)} />{text}
    </a>
  );
  return (
    <nav className="landings" aria-label="Streak boards">
      <h2>Streak boards</h2>
      <div className="landings-rows">
        {ROWS.map((r) => (
          <div className="landings-row" key={r.what}>
            <span className="landings-what">{r.what}</span>
            <span className="landings-scope">{r.active ? link(r.active, 'active') : <i>—</i>}</span>
            <span className="landings-scope">{r.all ? link(r.all, 'all-time') : <i>—</i>}</span>
          </div>
        ))}
      </div>
      <p className="landings-more"><a href={`${BASE}blog/`}>Weekly posts</a>: the streaks at stake in the coming week's games, and the ones its results broke. <a href={`${BASE}data/`}>The data</a>: every file the site reads, free to use with credit.</p>
    </nav>
  );
}
