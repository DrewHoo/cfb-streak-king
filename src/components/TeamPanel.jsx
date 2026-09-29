// The open team: the claim in plain English, the ledger of the streak, and
// every streak the team is king of.

import { useState } from 'react';
import { teams, firstSeason } from '../lib/model.ts';
import { chipByKey } from '../lib/chips.ts';
import { streakGames } from '../lib/streaks.ts';
import { claim, noClaim, ordinal } from '../lib/sentence.ts';
import { encodeChips } from '../lib/definition.ts';
import { siteMark, siteWord, shortDate, dayOf, kickOf, yearOf, count, dirWord } from '../lib/format.ts';
import { Chip, NextChip, TeamMark } from './Chip.jsx';
import { ShareIcon } from './Icons.jsx';

const LEDGER_CAP = 8;
const CROWNS_CAP = 6;

function LedgerRow({ g, cls, win }) {
  return (
    <div className={'xrow' + (cls ? ' ' + cls : '')}>
      <Chip g={g} />
      <span className="xd">{shortDate(g.ep)}</span>
      <span className="xn">{siteMark(g) ? <i>{siteMark(g)}</i> : null}{teams[g.oppIdx]?.name ?? '?'}</span>
      <span className="xopp">{g.oppRank > 0 ? `#${g.oppRank}` : ''}</span>
      <span className={'xsc' + (win ? ' w' : '')}>{g.us}–{g.them}</span>
    </div>
  );
}

function Ledger({ row, edge }) {
  const [all, setAll] = useState(false);
  const games = streakGames(row);
  const list = all ? games : games.slice(0, LEDGER_CAP);
  const nxt = row.onTheLine ? row.next : null;
  return (
    <div className="ledger">
      {nxt && (
        <div className="xrow next-row">
          <NextChip u={nxt} />
          <span className="xd">{shortDate(nxt.ep)}</span>
          <span className="xn">{siteMark(nxt) ? <i>{siteMark(nxt)}</i> : null}{teams[nxt.oppIdx]?.name}</span>
          <span className="xopp">{nxt.oppRank > 0 ? `#${nxt.oppRank}` : ''}</span>
          <span className="xnext">{dayOf(nxt.ep)} {kickOf(nxt)}</span>
        </div>
      )}
      {row.live === false && <LedgerRow g={row.ended} cls="brk-row" win />}
      {list.map((g) => <LedgerRow key={g.i + '-' + g.ep} g={g} />)}
      {games.length > LEDGER_CAP && (
        <button className="morebtn" onClick={() => setAll((v) => !v)}>{all ? 'fewer' : `${games.length - LEDGER_CAP} more`}</button>
      )}
      {row.s.atEdge
        ? (
          <div className="log-note">
            {edge.word
              ? `earliest ${edge.word} data is ${edge.year}; this streak may be longer than we can show`
              : edge.joined
                ? `${teams[row.ti].name} joined FBS in ${edge.year}; every qualifying game since is in this streak, and its FCS years don't count`
                : `every qualifying game in the data (${firstSeason} on) is in this streak; the one before it is older than the data`}
          </div>
        )
        : <LedgerRow g={row.s.ender} cls="ender-row" win />}
    </div>
  );
}

/**
 * "{Team} is the King of N [active|all-time] [winning|losing] Streaks", the
 * two words being selects, then the list. `crowns` is null while that scope
 * is still mining.
 */
function Crowns({ ti, crowns, crownsScope, crownsDir, onCrownsScope, onCrownsDir, dir, scope, active, onApply, onShare }) {
  const [all, setAll] = useState(false);
  const name = teams[ti].name;
  const list0 = crowns ? crowns.filter((c) => c.dir === crownsDir) : [];
  const list = all ? list0 : list0.slice(0, CROWNS_CAP);
  const defC = encodeChips(active);
  return (
    <div className="leads">
      <p className="leads-lead">
        {name} is the King of{' '}
        <b className={crownsDir === 'L' ? 'l' : 'w'}>{crowns ? list0.length : '…'}</b>{' '}
        <select className="leads-sel" value={crownsScope} onChange={(e) => onCrownsScope(e.target.value)} aria-label="Active or all-time">
          <option value="active">Active</option>
          <option value="all">All-time</option>
        </select>{' '}
        <select className="leads-sel" value={crownsDir} onChange={(e) => onCrownsDir(e.target.value)} aria-label="Winning or losing">
          <option value="W">Winning</option>
          <option value="L">Losing</option>
          <option value="U">Unbeaten</option>
        </select>{' '}
        Streaks
      </p>
      {crowns === null && <p className="empty">finding every streak {name} is king of…</p>}
      {crowns !== null && list0.length === 0 && (
        <p className="empty">No {crownsScope === 'all' ? 'all-time' : 'active'} {dirWord(crownsDir)} streak of 4+ games that {name} alone holds.</p>
      )}
      {list.map((cr) => {
        const here = cr.dir === dir && cr.scope === scope && encodeChips(cr.chips.map((key) => ({ key }))) === defC;
        const span = cr.scope === 'all' && cr.startSe != null
          ? (cr.live ? `since ${cr.startSe}` : cr.startSe === cr.endSe ? String(cr.startSe) : `${cr.startSe}–${cr.endSe}`)
          : cr.startSe ? `since ${cr.startSe}` : '';
        return (
          <div className={'lead' + (here ? ' here' : '')} key={cr.dir + cr.chips.join()}>
            <button className="lead-apply" onClick={() => onApply(cr)}>
              <span className={'lead-len' + (cr.dir === 'L' ? ' l' : '')}>{cr.len}{cr.atEdge ? '+' : ''}</span>
              <span className="lead-txt">{cr.chips.length ? cr.chips.map((k) => chipByKey.get(k).label).join(' · ') : 'all games'}</span>
              <span className="lead-meta">longest of {cr.field}{span ? ` · ${span}` : ''}{here ? ' · shown above' : ''}</span>
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

export function TeamPanel({ ti, row, rank, field, active, dir, scope, edge, crowns, crownsScope, crownsDir, onCrownsScope, onCrownsDir, onShare, onShareCrown, onClose, onApplyCrown }) {
  const t = teams[ti];
  const sentence = row ? claim(row, active, dir) : noClaim(ti, active, dir);
  return (
    <div className="panel">
      <div className="panel-head">
        <TeamMark ti={ti} />
        <div className="panel-id">
          <span className="panel-name">{t.name}</span>
          <span className="panel-meta">
            {row ? `${ordinal(rank)} of ${field}${row.live === false ? ` · ended ${yearOf(row.ended.ep)}` : ''}` : `not among the ${field}`}
          </span>
        </div>
        <button className="ico" onClick={() => onShare(sentence)} aria-label={`Share ${t.name}`}><ShareIcon /></button>
        <button className="ico" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="claim">{sentence}</p>
      {row && (
        <p className="claim-meta">
          {row.onTheLine && row.next && (
            <span className="otl">could be broken {dayOf(row.next.ep)} {siteWord(row.next)} {row.next.oppRank > 0 ? `#${row.next.oppRank} ` : ''}{teams[row.next.oppIdx]?.name}</span>
          )}
          {row.live === false && `ended by ${teams[row.ended.oppIdx]?.name}, ${row.ended.us}–${row.ended.them}`}
          {row.s.atEdge && !row.onTheLine && row.live !== false && (edge?.joined
            ? `${count(row.s)} means the streak runs back to ${t.name}'s first FBS season, ${edge.year}`
            : `${count(row.s)} means the streak runs past the start of the data`)}
        </p>
      )}
      {row && <Ledger row={row} edge={edge} />}
      <Crowns
        ti={ti} crowns={crowns} crownsScope={crownsScope} crownsDir={crownsDir} onCrownsScope={onCrownsScope} onCrownsDir={onCrownsDir}
        dir={dir} scope={scope} active={active} onApply={onApplyCrown} onShare={onShareCrown}
      />
    </div>
  );
}
