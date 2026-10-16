// The open streak: the claim in plain English and the ledger of the streak.
// The team's name leads to its page (its every streak is there), and the
// next-game row to the matchup.

import { useState } from 'react';
import { teams, firstSeason } from '../lib/model.ts';
import { streakGames, againstSpread } from '../lib/streaks.ts';
import { claim, noClaim, ordinal } from '../lib/sentence.ts';
import { siteWord, shortDate, dayOf, kickOf, yearOf, count, spreadText } from '../lib/format.ts';
import { seasonRecord, recordText } from '../lib/team.ts';
import { unplayedInRun, classOf, KIND_WORDS } from '../lib/unplayed.ts';
import { TeamMark } from './Chip.jsx';
import { Cite } from './Cite.jsx';
import { ShareIcon, CloseIcon, Chevron } from './Icons.jsx';

const LEDGER_CAP = 8;

// the ledger reads like a schedule page: date, the team's own AP rank, the
// opponent (site, result square, its rank, name), the score
const siteTag = (g) => (g.neutral ? 'N' : g.home ? 'vs' : '@');
// `record` adds the opponent's season record, for a game not yet played
export function Opp({ g, record }) {
  const t = teams[g.oppIdx];
  return (
    <span className="xn">
      <i>{siteTag(g)}</i>
      {t?.espn ? <TeamMark ti={g.oppIdx} className="xlogo" /> : <b className="xini">{t?.name?.[0] ?? '?'}</b>}
      {g.oppRank > 0 && <b>#{g.oppRank} </b>}{t?.name ?? '?'}
      {record && <em className="xrec">{recordText(seasonRecord(g.oppIdx))}</em>}
    </span>
  );
}
function OwnRank({ ti, g }) {
  return <span className="xown" title={`${teams[ti].name} ${g.ownRank > 0 ? `ranked #${g.ownRank}` : 'unranked'} at kickoff`}>{g.ownRank > 0 ? `#${g.ownRank}` : ''}</span>;
}
export function LedgerHead() {
  return (
    <div className="xrow xhead" aria-hidden="true">
      <span>date</span><span className="xown">rank</span><span className="xn">opponent</span><span className="xsc">score</span>
    </div>
  );
}

export function LedgerRow({ ti, g, cls, cover, onGame }) {
  // a win reads in cream; in cover mode, a cover does
  const good = cover ? g.cover === 'W' : g.r === 'W';
  // with onGame the row is a button to the game's page
  const Row = onGame ? 'button' : 'div';
  return (
    <Row className={'xrow' + (cls ? ' ' + cls : '') + (onGame ? ' game-row' : '')} onClick={onGame ? () => onGame(ti, g) : undefined} aria-label={onGame ? `${teams[ti].name} ${siteWord(g)} ${teams[g.oppIdx]?.name}: the game` : undefined}>
      <span className="xd">{shortDate(g.ep)}</span>
      <OwnRank ti={ti} g={g} />
      <Opp g={g} />
      <span className={'xsc' + (good ? ' w' : '')}><i className="xr">{g.r}</i>{g.us}–{g.them}{cover && g.sp != null ? <i className="xsp"> {spreadText(g.sp)}</i> : null}</span>
    </Row>
  );
}

/** A scheduled game as a row: the opponent with its record, the line as of the build, and the way into the matchup. */
export function NextRow({ ti, g, onGame }) {
  return (
    <button className="xrow next-row" onClick={() => onGame(ti, g)} aria-label={`${teams[ti].name} ${siteWord(g)} ${teams[g.oppIdx]?.name}: the matchup`}>
      <span className="xd">{shortDate(g.ep)}</span>
      <OwnRank ti={ti} g={g} />
      <Opp g={g} record />
      <span className="xnext">{g.sp != null && <b className="xline">{spreadText(g.sp)}</b>}{dayOf(g.ep)} {kickOf(g)}<Chevron /></span>
    </button>
  );
}

/**
 * The postseasons this run lived through without playing (unplayed.ts), said
 * by whose call it was: a bowl the team turned down, or a rule that kept it
 * home. A run can hold both kinds.
 */
function Unplayed({ row, games }) {
  const list = unplayedInRun(row.ti, games, row.live === false ? row.ended.se : null);
  if (!list.length) return null;
  const chose = list.filter((r) => classOf(r.kind) === 'chose').length;
  const lead = chose === list.length
    ? (list.length === 1 ? 'this streak lived through a bowl the team chose not to play' : `this streak lived through ${list.length} postseasons the team chose not to play`)
    : chose === 0
      ? (list.length === 1 ? 'this streak lived through a postseason a rule kept the team out of' : `this streak lived through ${list.length} postseasons rules kept the team out of`)
      : `this streak lived through ${list.length} postseasons not played, by the team’s call and under a rule`;
  return (
    <div className="log-note">
      {lead}:{' '}
      {list.map((r, i) => (
        <span key={r.season}>
          {i > 0 ? '; ' : ''}{r.season}, {r.summary}{' '}
          <a href={r.receipts[0].url} title={r.receipts[0].quote} rel="noopener">[{KIND_WORDS[r.kind]}{r.confidence === 'low' ? ', thinly sourced' : ''}]</a>
        </span>
      ))}
    </div>
  );
}

function Ledger({ row, edge, cover, onGame }) {
  const [all, setAll] = useState(false);
  const games = streakGames(row);
  const list = all ? games : games.slice(0, LEDGER_CAP);
  const nxt = row.onTheLine ? row.next : null;
  return (
    <div className="ledger">
      <LedgerHead />
      {nxt && <NextRow ti={row.ti} g={nxt} onGame={onGame} />}
      {row.live === false && <LedgerRow ti={row.ti} g={row.ended} cls="brk-row" cover={cover} />}
      {list.map((g) => <LedgerRow key={g.i + '-' + g.ep} ti={row.ti} g={g} cover={cover} />)}
      {games.length > LEDGER_CAP && (
        <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${games.length - LEDGER_CAP} more`}</button>
      )}
      <Unplayed row={row} games={games} />
      {row.s.atEdge
        ? (
          <div className="log-note">
            {edge.word
              ? `earliest ${edge.word} data is ${edge.year}; this streak may be longer than we can show`
              : edge.joined
                ? `${teams[row.ti].name} ${edge.year < 1978 ? 'became a major-college program' : 'joined FBS'} in ${edge.year}; every qualifying game since is in this streak, and its lower-division years don't count`
                : `every qualifying game in the data (${firstSeason} on) is in this streak; the one before it is older than the data`}
          </div>
        )
        : <LedgerRow ti={row.ti} g={row.s.ender} cls="ender-row" cover={cover} />}
    </div>
  );
}

export function TeamPanel({ ti, row, rank, field, active, dir, scope, edge, onShare, onCite, onClose, onTeam, onGame }) {
  const t = teams[ti];
  const sentence = row ? claim(row, active, dir) : noClaim(ti, active, dir);
  return (
    <div className="panel">
      <div className="panel-head">
        <TeamMark ti={ti} />
        <div className="panel-id">
          <button className="panel-name namelink" onClick={() => onTeam(ti)} aria-label={`${t.name}: team page`}>{t.name}<Chevron /></button>
          <span className="panel-meta">
            {row ? `${ordinal(rank)} of ${field}${row.live === false ? ` · ended ${yearOf(row.ended.ep)}` : ''}` : `not among the ${field}`}
          </span>
        </div>
        <button className="ico" onClick={() => onShare(sentence)} aria-label={`Share ${t.name}`}><ShareIcon /></button>
        <button className="ico panel-close" onClick={onClose} aria-label="Close team view"><CloseIcon /></button>
      </div>
      <p className="claim">{sentence}</p>
      {row && (
        <p className="claim-meta">
          {row.onTheLine && row.next && (
            <span className="otl">could be broken {dayOf(row.next.ep)} {siteWord(row.next)} {row.next.oppRank > 0 ? `#${row.next.oppRank} ` : ''}{teams[row.next.oppIdx]?.name}</span>
          )}
          {row.live === false && `ended by ${teams[row.ended.oppIdx]?.name}, ${row.ended.us}–${row.ended.them}${againstSpread(dir) && row.ended.sp != null ? ` (${spreadText(row.ended.sp)})` : ''}`}
          {row.s.atEdge && !row.onTheLine && row.live !== false && (edge?.joined
            ? `${count(row.s)} means the streak runs back to ${t.name}'s first ${edge.year < 1978 ? 'major-college' : 'FBS'} season, ${edge.year}`
            : `${count(row.s)} means the streak runs past the start of the data`)}
          {onCite && <Cite onCopy={(embed) => onCite(sentence, embed)} />}
        </p>
      )}
      {row && <Ledger row={row} edge={edge} cover={againstSpread(dir)} onGame={onGame} />}
    </div>
  );
}
