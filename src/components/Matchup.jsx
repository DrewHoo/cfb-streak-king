// The open game: both teams' records and ranks, the line, and every streak
// either side puts on the line in it. A sheet over whatever is showing. A
// team's name leads to its page; a streak leads to its board.

import { useState } from 'react';
import { Drawer } from 'vaul';
import { P, teams, fbsNow, upcomingOf } from '../lib/model.ts';
import { chipByKey } from '../lib/chips.ts';
import { seasonRecord, recordText, atsText, teamStreaks, streaksOn, rankText, lastMeeting, h2hStreaksOn, LEN_FLOOR } from '../lib/team.ts';
import { dayOf, monthDay, kickOf, shortDate, siteWord, spreadText, gamesWord, oddsText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { CloseIcon } from './Icons.jsx';
import { useActiveCrowns } from '../hooks/useCrowns.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, Chevron } from './Icons.jsx';

const ON_LINE_CAP = { phone: 4, desk: 6 };
const bad = (dir) => baseDir(dir) === 'L' || dir === 'N';
// `vs` is a head-to-head streak's opponent, the choice its "vsteam" chip carries
export const streakWords = (chips, vs) => (chips.length
  ? chips.map((k) => (k === 'vsteam' && vs != null ? `vs ${teams[vs]?.name ?? '?'}` : chipByKey.get(k).label)).join(' · ')
  : 'all games');

/**
 * One streak with its place in the field, shaped like a crown in the King-of
 * list: the length, the words, then rank, start, odds. `next` adds its next
 * qualifying game, `tag` a word after the field.
 */
export function StreakRow({ s, onClick, next, tag }) {
  const n = next ? s.next : null;
  return (
    <button className="srow" onClick={onClick}>
      <span className={'srow-len' + (bad(s.dir) ? ' l' : '')}>{s.len}{s.atEdge ? '+' : ''}</span>
      <span className="srow-txt">
        <span>{gamesWord(s.dir, s.len)} · {streakWords(s.chips, s.vs)}</span>
        <small>
          <b className={s.vs == null && s.rank === 1 && s.tied === 1 ? 'k' : ''}>{s.vs != null ? 'head-to-head' : `${rankText(s)} of ${s.field}`}</b>
          {s.since != null && ` · since ${s.since}`}
          {s.chance != null && ` · ${oddsText(s.chance)} by chance`}
          {tag ? ` · ${tag}` : ''}
          {n ? <i> · next {monthDay(n.ep)} {siteWord(n)} {teams[n.oppIdx]?.name}</i> : null}
        </small>
      </span>
      <Chevron />
    </button>
  );
}

function Side({ ti, rank, onTeam }) {
  const t = teams[ti];
  const r = seasonRecord(ti);
  const body = (
    <>
      {t.espn ? <TeamMark ti={ti} className="mu-logo" /> : <b className="mu-logo mu-ini">{t.name[0]}</b>}
      <span className="mu-name">{rank > 0 && <i>#{rank} </i>}{t.name}{fbsNow.has(ti) && <Chevron />}</span>
      <span className="mu-rec">{recordText(r)}{fbsNow.has(ti) ? ` · ${atsText(r)} ATS` : ''}</span>
    </>
  );
  // a team below FBS has no page
  return fbsNow.has(ti)
    ? <button className="mu-side" onClick={() => onTeam(ti)} aria-label={`${t.name}: team page`}>{body}</button>
    : <span className="mu-side">{body}</span>;
}

const sameStreak = (a, b) => a.dir === b.dir && a.chips.length === b.chips.length && a.chips.every((k) => b.chips.includes(k));

// `pin` is the streak on the board underneath, when this game is its next: it
// leads the list. The team's crowns join it as soon as they're loaded.
function OnLine({ ti, game, crowns: seed, pin, todayEp, onStreak, cap }) {
  const [all, setAll] = useState(false);
  const crowns = useActiveCrowns(ti, seed);
  // the game puts the head-to-head runs in too, when they're worth telling
  const h2h = h2hStreaksOn(ti, game);
  const on = streaksOn(teamStreaks(ti, todayEp, crowns), game);
  const mine = h2h.length ? [...on, ...h2h].sort((a, b) => b.score - a.score || b.len - a.len) : on;
  const list = pin ? [pin, ...mine.filter((s) => !sameStreak(s, pin))] : mine;
  return (
    <div className="mu-on">
      <h3>On the line for {teams[ti].name} <span>{list.length}</span></h3>
      {!list.length && <p className="empty">No run of {LEN_FLOOR} or more that this game could end, and none {teams[ti].name} alone leads.</p>}
      {(all ? list : list.slice(0, cap)).map((s) => <StreakRow key={s.dir + s.chips.join()} s={s} tag={s === pin ? 'this board' : null} onClick={() => onStreak(s, ti)} />)}
      {list.length > cap && <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${list.length - cap} more`}</button>}
    </div>
  );
}

/**
 * `game` is the scheduled game from `ti`'s side (null closes the sheet);
 * `crowns` are that team's active crowns when the caller has them (each
 * side loads its own otherwise), `pin` its streak on the board underneath.
 */
export function Matchup({ ti, game, crowns, pin, todayEp, isMobile, onClose, onTeam, onStreak, onShare }) {
  const cap = isMobile ? ON_LINE_CAP.phone : ON_LINE_CAP.desk;
  const open = ti != null && !!game;
  const opp = open ? game.oppIdx : null;
  // the same game from the other side, when the opponent is an FBS team
  const theirs = open ? upcomingOf(opp).find((u) => u.i === game.i) ?? null : null;
  const last = open ? lastMeeting(ti, opp) : null;
  const fav = !open || game.sp == null ? null : game.sp === 0 ? 'PK' : `${teams[game.sp < 0 ? ti : opp].name} ${spreadText(-Math.abs(game.sp))}`;
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-ov" />
        <Drawer.Content className="sheet matchup" aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {open && (
            <>
              <div className="mu-head">
                <Drawer.Title className="sheet-title">{dayOf(game.ep)} {monthDay(game.ep)}{kickOf(game) ? ` · ${kickOf(game)}` : ''} · {game.neutral ? 'neutral site' : `at ${teams[game.home ? ti : opp].name}`}</Drawer.Title>
                <span className="mu-acts">
                  <button className="ico" onClick={onShare} aria-label="Share this matchup"><ShareIcon /></button>
                  <button className="ico mu-close" onClick={onClose} aria-label="Close the matchup"><CloseIcon /></button>
                </span>
              </div>
              <div className="sheet-body mu-body">
                <div className="mu-top">
                  <Side ti={ti} rank={game.ownRank} onTeam={onTeam} />
                  <span className="mu-line">
                    <b>{fav ?? '—'}</b>
                    <small>{fav ? `line as of ${monthDay(Math.floor(Date.parse(P.builtAt) / 86400000))}` : 'no line yet'}</small>
                  </span>
                  <Side ti={opp} rank={game.oppRank} onTeam={onTeam} />
                </div>
                <div className="mu-cols">
                  <OnLine ti={ti} game={game} crowns={crowns} pin={pin} todayEp={todayEp} onStreak={onStreak} cap={cap} />
                  {theirs && <OnLine ti={opp} game={theirs} crowns={null} todayEp={todayEp} onStreak={onStreak} cap={cap} />}
                </div>
                {last && (
                  <p className="mu-last">
                    Last meeting {shortDate(last.ep)}: {teams[last.r === 'L' ? opp : ti].name} {Math.max(last.us, last.them)}–{Math.min(last.us, last.them)}
                    {last.r === 'T' ? ' (tie)' : ''}{last.sp != null && last.cover ? `; ${teams[ti].name} ${spreadText(last.sp)}, ${last.cover === 'W' ? 'covered' : last.cover === 'L' ? "didn't cover" : 'push'}` : ''}
                  </p>
                )}
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
