// One broken run, the way every list of them reads (the schedule's week
// digest, a breaker's page, a team page's breaks): the length, the team's
// mark, the claim in past tense, then what the run was (the all-time longest
// a link to its all-time board, no team open), since when, and the game that
// ended it. The row opens the run's all-time board at the team.

import { teams } from '../lib/model.ts';
import { everText } from '../lib/broken.ts';
import { boardUrl, hrefOf } from '../lib/url.ts';
import { marginWords } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { TeamMark } from './Chip.jsx';
import { Chevron } from './Icons.jsx';
import { streakWords } from './StreakRow.jsx';
import { useTune } from '../tune.ts';
import { Why } from './Tuner.jsx';
import { rankText } from '../lib/team.ts';

const BASE = import.meta.env.BASE_URL;
const PAST = { W: 'had won', L: 'had lost', C: 'had covered', N: 'had missed' };

// how the run ended, from the team's side: the game that broke it
function enderWords(b) {
  const g = b.ender;
  const opp = teams[g.oppIdx]?.name ?? '?';
  if (b.dir === 'C' || b.dir === 'N') return `${g.cover === 'P' ? 'pushed' : g.cover === 'W' ? 'covered' : 'didn’t cover'} vs ${opp}`;
  if (g.r === 'T') return `tied ${opp} ${g.us}–${g.them}`;
  return g.r === 'W' ? `beat ${opp} ${g.us}–${g.them}` : `lost to ${opp} ${g.them}–${g.us}`;
}

/** What the run was, as the week began: the all-time longest, else the active field's leader. */
const leadWords = (b) => everText(b) ?? (b.tied > 1 ? 'was tied for the longest active streak' : 'was the longest active streak');

/** `onOpen(b)` opens the run at its team; `onBoard(b)` its definition's all-time board, no team open. */
export function BrokenRow({ b, onOpen, onBoard }) {
  const t = teams[b.ti];
  const claim = `${t?.name} ${PAST[baseDir(b.dir)]} ${b.len}${b.unsure ? '†' : ''} straight${marginWords(b.dir)}${b.chips.length ? ` ${streakWords(b.chips)}` : ''}`;
  const ever = everText(b);
  const { on: tuning } = useTune();
  return (
    <>
    <div className="bk">
      <button className="bk-hit" onClick={() => onOpen(b)} aria-label={claim} />
      <span className={'bk-len' + (baseDir(b.dir) === 'L' || b.dir === 'N' ? ' l' : '')}>{b.len}{b.unsure ? '†' : ''}</span>
      {t?.espn ? <TeamMark ti={b.ti} className="bk-logo" /> : <b className="bk-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
      <span className="bk-txt">
        <span>{claim}</span>
        <small>
          {ever
            ? <a className="bk-lede" href={hrefOf(BASE, boardUrl(b.chips, b.dir, 'all'))} onClick={(e) => { e.preventDefault(); onBoard(b); }}>{ever}</a>
            : <b className="k">{leadWords(b)}</b>}
          {' · since '}{b.since}{' · '}{enderWords(b)}
          {b.other ? ` · ${rankText(b.other)} ${b.other.chips.length ? streakWords(b.other.chips) : 'overall'}` : ''}
        </small>
      </span>
      <Chevron />
    </div>
    {tuning && b.p != null && <Why s={b} />}
    </>
  );
}
