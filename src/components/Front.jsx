// The front page (specs/front-page.spec.md), the page at /: the streaks
// this week's games put on the line that stand out from the rest (each
// team's best, front.ts), a way into the builder, and the category pages.

import { teams } from '../lib/model.ts';
import { frontNext, frontWeek } from '../lib/front.ts';
import { keyOf } from '../lib/game.ts';
import { gameUrl, hrefOf } from '../lib/url.ts';
import { chipLabel, refsOf } from '../lib/minedChips.ts';
import { definitionPhrase } from '../lib/sentence.ts';
import { dayOf, monthDay, siteWord, spreadText } from '../lib/format.ts';
import { baseDir } from '../lib/outcome.ts';
import { useState } from 'react';
import { TeamMark } from './Chip.jsx';
import { DaggerNote, MoreButton, PAGE } from './StreakRow.jsx';
import { Chevron } from './Icons.jsx';
import { TeamPicker } from './TeamPicker.jsx';
import { NavIcons } from './Dateline.jsx';
import { useTune } from '../tune.ts';
import { Why } from './Tuner.jsx';
import { P, firstSeason } from '../lib/model.ts';

const BASE = import.meta.env.BASE_URL;
// the builder's verbs (sentence.ts): "missed" reads as missed games
const VERBS = { W: 'has won', L: 'has lost', C: 'has covered', N: 'has failed to cover' };
const bad = (dir) => baseDir(dir) === 'L' || dir === 'N';

/** "Alabama has won 90 straight games against unranked opponents at home": the builder's sentence (sentence.ts). */
export const frontClaim = (ti, s) => `${teams[ti]?.name} ${VERBS[baseDir(s.dir)]} ${s.len}${s.unsure ? '†' : ''} straight ${definitionPhrase(refsOf(s.chips), s.dir)}`;

// "Sat 11/15 vs Ball State" and the line from the team's side
const gameWords = (u, line = false) => `${dayOf(u.ep)} ${monthDay(u.ep)} ${siteWord(u)} ${teams[u.oppIdx]?.name ?? '?'}${line && u.sp != null ? ` ${spreadText(u.sp)}` : ''}`;

/** What the team's next game does to the streak, as words; the game the words name opens its page. */
export function nextWords(n) {
  switch (n.kind) {
    case 'on': return { lead: n.likely ? 'Likely on the line' : 'On the line', game: n.game, words: gameWords(n.game, true), on: true, likely: n.likely };
    case 'maybe': return { lead: 'Might be on the line', game: n.game, words: gameWords(n.game, true), tail: `counts if ${n.ifs.map(chipLabel).join(' and ')}` };
    case 'later': return n.game
      ? { lead: 'Not on the line', game: n.game, words: gameWords(n.game), tail: `next ${monthDay(n.then.ep)} ${siteWord(n.then)} ${teams[n.then.oppIdx]?.name ?? '?'}` }
      : { lead: 'Next on the line', game: n.then, words: `${monthDay(n.then.ep)} ${siteWord(n.then)} ${teams[n.then.oppIdx]?.name ?? '?'}` };
    case 'unknown': return n.game
      ? { lead: 'Not on the line', game: n.game, words: gameWords(n.game), tail: 'the next game that counts depends on results' }
      : { lead: 'The next game that counts depends on results' };
    default: return { lead: 'No scheduled game counts' };
  }
}

function FrontRow({ i, ti, s, todayEp, on }) {
  const t = teams[ti];
  const claim = frontClaim(ti, s);
  const w = nextWords(frontNext(ti, s, todayEp));
  const { on: tuning } = useTune();
  return (
    <li>
      <div className="bk fr-row">
        <button className="bk-hit" onClick={() => on.streak(s, ti)} aria-label={claim} />
        <span className="fr-place">{i + 1}</span>
        <span className={'bk-len fr-len' + (bad(s.dir) ? ' l' : '')}>{s.len}{s.unsure ? '†' : ''}</span>
        {t?.espn ? <TeamMark ti={ti} className="bk-logo fr-logo" /> : <b className="bk-logo fr-logo gm-ini">{t?.name?.[0] ?? '?'}</b>}
        <span className="bk-txt fr-txt">
          <span>{claim}</span>
          <small>
            {'since '}{s.since}{' · '}
            {w.on
              // every row is on the line (the heading says so): the game, and whether the line could still move it
              ? <><a className="fr-game" href={hrefOf(BASE, gameUrl(keyOf(ti, w.game)))} onClick={(e) => { e.preventDefault(); on.game(ti, w.game); }}>{w.words}</a>{w.likely ? ' · if the line holds' : ''}</>
              : w.game
              ? <a className="fr-game" href={hrefOf(BASE, gameUrl(keyOf(ti, w.game)))} onClick={(e) => { e.preventDefault(); on.game(ti, w.game); }}>
                  {w.on ? <i>{w.lead}</i> : w.lead} {w.words}
                </a>
              : w.lead}
            {!w.on && w.tail ? ` · ${w.tail}` : ''}
          </small>
        </span>
        <Chevron />
      </div>
      {tuning && s.p != null && <Why s={s} />}
    </li>
  );
}

/** The list: the first ten `rows` and `more` behind "see more" (front.ts frontPage), null while they load. */
export function FrontList({ rows, more, todayEp, on }) {
  const [n, setN] = useState(0);
  if (!rows) return <div className="fr-list fr-loading" aria-busy="true" />;
  if (!rows.length) return <p className="fr-empty">No streak that stands out is on the line this week.</p>;
  const shown = [...rows, ...(more ?? []).slice(0, n)];
  return (
    <>
      <ol className="fr-list">
        {shown.map((r, i) => <FrontRow key={`${r.ti}|${r.s.dir}|${r.s.chips.join('+')}`} i={i} ti={r.ti} s={r.s} todayEp={todayEp} on={on} />)}
      </ol>
      <div className="fr-more">
        <MoreButton shown={n} total={more?.length ?? 0} onMore={() => { setN(n + PAGE); on.more?.(n + PAGE); }} />
        <DaggerNote rows={shown.map((r) => r.s)} />
      </div>
    </>
  );
}

/** "On the line in Week 10": the running week's, or this week's when no game is scheduled. */
export const frontHeading = () => { const wk = frontWeek(); return wk != null ? `On the line in Week ${wk}` : 'On the line this week'; };

/** The page at /. */
export function FrontPage({ rows, more, todayEp, on, nav, onShare, copied, isMobile, landings }) {
  return (
    <>
      <div className="dateline">
        <span>drewhoover.com · {firstSeason}–{P.currentSeason}<span className="dateline-upd"> · updated {String(P.builtAt).slice(0, 10)}</span></span>
        <NavIcons here="front" nav={nav} onShare={onShare} copied={copied} isMobile={isMobile} />
      </div>
      <h1>Streak King</h1>
      <p className="landing-line fr-lede">Every college football streak you can possibly think of. Win, lose, draw, or cover!</p>
      <h2 className="fr-h">{frontHeading()}</h2>
      <FrontList rows={rows} more={more} todayEp={todayEp} on={on} />
      <div className="fr-acts">
        <a className="fr-build" href={`${BASE}build/`} onClick={(e) => { e.preventDefault(); on.build(); }}>Build your own streak <Chevron /></a>
        <TeamPicker onPick={(ti) => nav.team(ti, 'front')} isMobile={isMobile}>
          <button className="fr-teams">Every team’s streaks</button>
        </TeamPicker>
      </div>
      {landings}
    </>
  );
}
