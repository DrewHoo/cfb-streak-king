// One streak as a row in a list: the length, the words, then rank, start,
// odds. Shared by the team page, the game page and the schedule's digests.

import { Fragment, useMemo, useState } from 'react';
import { teams } from '../lib/model.ts';
import { chipLabel } from '../lib/minedChips.ts';
import { rankText } from '../lib/team.ts';
import { monthDay, siteWord, gamesWord, oddsText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { Chevron } from './Icons.jsx';
import { TeamMark } from './Chip.jsx';
import { useTune } from '../tune.ts';
import { Why } from './Tuner.jsx';

const bad = (dir) => baseDir(dir) === 'L' || dir === 'N';
/** A streak's conditions as words; a mined key ("vsteam:alabama") carries its choice. */
export const streakWords = (chips) => (chips.length ? chips.map(chipLabel).join(' · ') : 'all games');

/**
 * One streak with its place in the field, shaped like a crown in the King-of
 * list: the length, the words, then rank, start, odds. `next` adds its next
 * qualifying game, `tag` a word after the field, `lead` a line of its own
 * before the small print (a game page's "passed Georgia's 12"), `mark` a
 * team's logo before the words (whose streak it was, in a list of breaks).
 */
export function StreakRow({ s, onClick, next, tag, lead, mark }) {
  const n = next ? s.next : null;
  const mt = mark != null ? teams[mark] : null;
  const { on: tuning } = useTune();
  return (
    <Fragment>
    <button className={'srow' + (mt ? ' marked' : '')} onClick={onClick}>
      <span className={'srow-len' + (bad(s.dir) ? ' l' : '')}>{s.len}{s.unsure ? '†' : ''}</span>
      {mt && (mt.espn ? <TeamMark ti={mark} className="srow-mark" /> : <b className="srow-mark gm-ini">{mt.name[0]}</b>)}
      <span className="srow-txt">
        <span>{gamesWord(s.dir, s.len)} · {streakWords(s.chips)}</span>
        {lead && <span className="srow-lead">{lead}</span>}
        <small>
          <b className={s.rank === 1 && s.tied === 1 ? 'k' : ''}>{rankText(s)} of {s.field}</b>
          {s.since != null && ` · since ${s.since}`}
          {s.chance != null && ` · ${oddsText(s.chance)} by chance`}
          {s.other ? ` · ${rankText(s.other)} ${s.other.chips.length ? streakWords(s.other.chips) : 'overall'}` : ''}
          {tag ? ` · ${tag}` : ''}
          {n ? <i> · next {monthDay(n.ep)} {siteWord(n)} {teams[n.oppIdx]?.name}</i> : null}
        </small>
      </span>
      <Chevron />
    </button>
    {tuning && s.p != null && <Why s={s} />}
    </Fragment>
  );
}

const byScore = (a, b) => b.score - a.score || b.len - a.len;

/**
 * Each sub-streak (a row flagged subStreak: a run the team tells at least as long
 * under fewer conditions) under the run it is a sub-streak of: the standing
 * row of the same team and outcome whose conditions are a subset of its own
 * and whose run is no shorter, the nearest one (most conditions, then best
 * score). A sub-streak with no standing ancestor in the list stands itself.
 * The standing rows come back best score first, or in the caller's `order`.
 */
export function subsByParent(rows, order = byScore) {
  const standing = rows.filter((r) => !r.subStreak);
  const subs = new Map();
  const loose = [];
  for (const r of rows) {
    if (!r.subStreak) continue;
    const parent = standing
      .filter((o) => (o.ti ?? null) === (r.ti ?? null) && o.dir === r.dir && o.len >= r.len && o.chips.length < r.chips.length && o.chips.every((k) => r.chips.includes(k)))
      .sort((a, b) => b.chips.length - a.chips.length || b.score - a.score)[0];
    if (parent) (subs.get(parent) ?? subs.set(parent, []).get(parent)).push(r);
    else loose.push(r);
  }
  return { standing: [...standing, ...loose].sort(order), subs };
}

/**
 * A row's sub-streaks, grouped beneath it: "show N sub-streaks" opens them,
 * indented, in score order. `open` and `setOpen` hold the open rows' keys.
 */
export function Subs({ parent, subs, k, open, setOpen, render }) {
  if (!subs?.length) return null;
  const on = open.has(k);
  return (
    <div className="subs-wrap">
      <button className="subbtn" onClick={() => setOpen((cur) => { const next = new Set(cur); if (on) next.delete(k); else next.add(k); return next; })} aria-expanded={on}>
        {on ? 'hide sub-streaks' : `show ${subs.length} sub-streak${subs.length === 1 ? '' : 's'}`}
      </button>
      {on && <div className="subs">{subs.map((r) => render(r, parent))}</div>}
    </div>
  );
}

/** How many more rows a "see more" adds. */
export const PAGE = 25;

/** "see 25 more · 340 left": the paging button under a long list. */
export const MoreButton = ({ shown, total, onMore }) => (total > shown
  ? <button className="morebtn" onClick={onMore}>see {Math.min(PAGE, total - shown)} more · {total - shown} left</button>
  : null);

/** The dagger's footnote, under a list when a row it shows carries one (dagger.ts); a row is a run, or holds one in `s`. */
export const DaggerNote = ({ rows }) => (rows.some((r) => r.unsure ?? r.s?.unsure)
  ? <p className="dagger-note">† Missing data could change this streak’s length. Open it for what’s missing.</p>
  : null);

/**
 * A list of streaks: the standing rows up to `cap`, then "see more" pages
 * through the rest, PAGE at a time (a new list starts over); each row's
 * sub-streaks grouped beneath it. `keyOf` names a row.
 */
export function Tellings({ rows, cap, render, keyOf, order }) {
  const [open, setOpen] = useState(() => new Set());
  const [paged, setPaged] = useState({ rows, n: cap });
  const n = paged.rows === rows ? paged.n : cap;
  const { standing, subs } = useMemo(() => subsByParent(rows, order), [rows, order]);
  const list = standing.slice(0, n);
  return (
    <Fragment>
      {list.map((r) => (
        <Fragment key={keyOf(r)}>
          {render(r)}
          <Subs parent={r} subs={subs.get(r)} k={keyOf(r)} open={open} setOpen={setOpen} render={(x) => <Fragment key={keyOf(x)}>{render(x)}</Fragment>} />
        </Fragment>
      ))}
      <MoreButton shown={n} total={standing.length} onMore={() => setPaged({ rows, n: n + PAGE })} />
      <DaggerNote rows={list} />
    </Fragment>
  );
}
