// The open streak: the claim in plain English, the ledger of the streak, and
// every streak the team is king of. The team's name leads to its page, and
// the next-game row to the matchup.

import { useState } from 'react';
import { teams, firstSeason } from '../lib/model.ts';
import { chipByKey } from '../lib/chips.ts';
import { streakGames, againstSpread } from '../lib/streaks.ts';
import { claim, noClaim, ordinal } from '../lib/sentence.ts';
import { encodeChips } from '../lib/definition.ts';
import { siteWord, shortDate, dayOf, kickOf, yearOf, count, dirWord, spreadText, oddsText } from '../lib/format.ts';
import { MINED_MARGIN, baseDir } from '../lib/outcome.ts';
import { seasonRecord, recordText } from '../lib/team.ts';
import { TeamMark } from './Chip.jsx';
import { ShareIcon, CloseIcon, Chevron } from './Icons.jsx';

const LEDGER_CAP = 8;
const CROWNS_CAP = 6;

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

export function LedgerRow({ ti, g, cls, cover }) {
  // a win reads in cream; in cover mode, a cover does
  const good = cover ? g.cover === 'W' : g.r === 'W';
  return (
    <div className={'xrow' + (cls ? ' ' + cls : '')}>
      <span className="xd">{shortDate(g.ep)}</span>
      <OwnRank ti={ti} g={g} />
      <Opp g={g} />
      <span className={'xsc' + (good ? ' w' : '')}><i className="xr">{g.r}</i>{g.us}–{g.them}{cover && g.sp != null ? <i className="xsp"> {spreadText(g.sp)}</i> : null}</span>
    </div>
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

/**
 * "{Team} is the King of N [active|all-time] [winning|losing] Streaks", the
 * two words being selects, then the list. `crowns` is null while that scope
 * is still mining.
 */
export function Crowns({ ti, crowns, crownsScope, crownsDir, onCrownsScope, onCrownsDir, dir, scope, active, onApply, onShare }) {
  const [all, setAll] = useState(false);
  const name = teams[ti].name;
  const list0 = crowns ? crowns.filter((c) => c.dir === crownsDir) : [];
  const list = all ? list0 : list0.slice(0, CROWNS_CAP);
  const defC = encodeChips(active);
  return (
    <div className="leads">
      <p className="leads-lead">
        {name} is the King of{' '}
        <b className={baseDir(crownsDir) === 'L' || crownsDir === 'N' ? 'l' : 'w'}>{crowns ? list0.length : '…'}</b>{' '}
        <select className="leads-sel" value={crownsScope} onChange={(e) => onCrownsScope(e.target.value)} aria-label="Active or all-time">
          <option value="active">Active</option>
          <option value="all">All-time</option>
        </select>{' '}
        <select className="leads-sel" value={crownsDir} onChange={(e) => onCrownsDir(e.target.value)} aria-label="Winning or losing">
          <option value="W">Winning</option>
          <option value="L">Losing</option>
          <option value="U">Undefeated</option>
          <option value="C">Covering</option>
          <option value="N">Not covering</option>
          <option value={`W${MINED_MARGIN}`}>Winning by {MINED_MARGIN}+</option>
          <option value={`L${MINED_MARGIN}`}>Losing by {MINED_MARGIN}+</option>
        </select>{' '}
        Streaks
      </p>
      {crowns === null && <p className="empty">finding every streak {name} is king of…</p>}
      {crowns !== null && list0.length === 0 && (
        <p className="empty">No {crownsScope === 'all' ? 'all-time' : 'active'} {dirWord(crownsDir)} streak {name} alone holds stands out from chance.</p>
      )}
      {list.map((cr) => {
        const here = cr.dir === dir && cr.scope === scope && encodeChips(cr.chips.map((key) => ({ key }))) === defC;
        const span = cr.scope === 'all' && cr.startSe != null
          ? (cr.live ? `since ${cr.startSe}` : cr.startSe === cr.endSe ? String(cr.startSe) : `${cr.startSe}–${cr.endSe}`)
          : cr.startSe ? `since ${cr.startSe}` : '';
        return (
          <div className={'lead' + (here ? ' here' : '')} key={cr.dir + cr.chips.join()}>
            <button className="lead-apply" onClick={() => onApply(cr)}>
              <span className={'lead-len' + (baseDir(cr.dir) === 'L' || cr.dir === 'N' ? ' l' : '')}>{cr.len}{cr.atEdge ? '+' : ''}</span>
              <span className="lead-txt">{cr.chips.length ? cr.chips.map((k) => chipByKey.get(k).label).join(' · ') : 'all games'}</span>
              <span className="lead-meta">longest of {cr.field}{span ? ` · ${span}` : ''} · {oddsText(cr.chance)} by chance{here ? ' · shown above' : ''}</span>
            </button>
            <button className="ico lead-share" onClick={() => onShare(cr)} aria-label="Share this streak"><ShareIcon /></button>
          </div>
        );
      })}
      {list0.length > CROWNS_CAP && (
        <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `all ${list0.length}`}</button>
      )}
    </div>
  );
}

export function TeamPanel({ ti, row, rank, field, active, dir, scope, edge, crowns, crownsScope, crownsDir, onCrownsScope, onCrownsDir, onShare, onShareCrown, onClose, onApplyCrown, onTeam, onGame }) {
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
        </p>
      )}
      {row && <Ledger row={row} edge={edge} cover={againstSpread(dir)} onGame={onGame} />}
      <Crowns
        ti={ti} crowns={crowns} crownsScope={crownsScope} crownsDir={crownsDir} onCrownsScope={onCrownsScope} onCrownsDir={onCrownsDir}
        dir={dir} scope={scope} active={active} onApply={onApplyCrown} onShare={onShareCrown}
      />
    </div>
  );
}
