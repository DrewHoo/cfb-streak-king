// The line above the title: site, window, last update, and the icon bar.
// NavIcons is that bar on every page: find a team, the schedule, the
// streak-breakers, the blog, ko-fi and share, less the icon for the page
// it's on; the star saves a board's definition, so only the board has it.

import { P, firstSeason } from '../lib/model.ts';
import { track } from '../lib/analytics.ts';
import { ShareIcon, StarIcon, SearchIcon, CalendarIcon, TrophyIcon, BlogIcon, CoffeeIcon } from './Icons.jsx';
import { TeamPicker } from './TeamPicker.jsx';
import { KOFI_URL } from './Notes.jsx';

const BLOG_URL = `${import.meta.env.BASE_URL}blog/`;

/** `here`: 'board', 'team page', 'game', 'games', 'breakers' or 'breaker' (also the `from` its clicks report). */
export function NavIcons({ here, nav, star, onShare, shareLabel = 'Share', copied, isMobile }) {
  return (
    <span className="dateline-acts">
      {here !== 'team page' && (
        <TeamPicker onPick={(ti) => nav.team(ti, here === 'board' ? 'find' : `find ${here}`)} isMobile={isMobile}>
          <button className="ico" aria-label="Find a team"><SearchIcon /></button>
        </TeamPicker>
      )}
      {here !== 'games' && <button className="ico" onClick={() => nav.games(here)} aria-label="This week's games"><CalendarIcon /></button>}
      {here !== 'breakers' && here !== 'breaker' && <button className="ico" onClick={() => nav.breakers(here)} aria-label="Top streak-breakers"><TrophyIcon /></button>}
      {star && (
        <button className={'ico' + (star.isStarred ? ' on' : '')} onClick={star.toggle} aria-pressed={star.isStarred} aria-label={star.isStarred ? 'Saved' : 'Save this streak'}>
          <StarIcon filled={star.isStarred} />
        </button>
      )}
      <a className="ico" href={BLOG_URL} onClick={() => track('blog', { from: here })} aria-label="The blog"><BlogIcon /></a>
      <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: `icons ${here}` })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
      <button className="ico" onClick={onShare} aria-label={shareLabel}><ShareIcon /></button>
      {copied && <span className="toast">copied</span>}
    </span>
  );
}

export function Dateline(props) {
  return (
    <div className="dateline">
      <span>drewhoover.com · {firstSeason}–{P.currentSeason}<span className="dateline-upd"> · updated {String(P.builtAt).slice(0, 10)}</span></span>
      <NavIcons here="board" {...props} />
    </div>
  );
}
