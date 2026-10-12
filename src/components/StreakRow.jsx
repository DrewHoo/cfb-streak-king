// One streak as a row in a list: the length, the words, then rank, start,
// odds. Shared by the team page, the game page and the schedule's digests.

import { teams } from '../lib/model.ts';
import { chipLabel } from '../lib/minedChips.ts';
import { rankText } from '../lib/team.ts';
import { monthDay, siteWord, gamesWord, oddsText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { Chevron } from './Icons.jsx';

const bad = (dir) => baseDir(dir) === 'L' || dir === 'N';
/** A streak's conditions as words; a mined key ("vsteam:alabama") carries its choice. */
export const streakWords = (chips) => (chips.length ? chips.map(chipLabel).join(' · ') : 'all games');

/**
 * One streak with its place in the field, shaped like a crown in the King-of
 * list: the length, the words, then rank, start, odds. `next` adds its next
 * qualifying game, `tag` a word after the field, `lead` a line of its own
 * before the small print (a game page's "passed Georgia's 12").
 */
export function StreakRow({ s, onClick, next, tag, lead }) {
  const n = next ? s.next : null;
  return (
    <button className="srow" onClick={onClick}>
      <span className={'srow-len' + (bad(s.dir) ? ' l' : '')}>{s.len}{s.atEdge ? '+' : ''}</span>
      <span className="srow-txt">
        <span>{gamesWord(s.dir, s.len)} · {streakWords(s.chips)}</span>
        {lead && <span className="srow-lead">{lead}</span>}
        <small>
          <b className={s.rank === 1 && s.tied === 1 ? 'k' : ''}>{rankText(s)} of {s.field}</b>
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
