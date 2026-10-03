// The line above the title: site, window, last update, and the find-a-team, schedule, star and share buttons.

import { P, firstSeason } from '../lib/model.ts';
import { ShareIcon, StarIcon, SearchIcon, CalendarIcon } from './Icons.jsx';
import { TeamPicker } from './TeamPicker.jsx';

export function Dateline({ isStarred, onStar, onShare, copied, onTeam, onGames, isMobile }) {
  return (
    <div className="dateline">
      <span>drewhoover.com · {firstSeason}–{P.currentSeason}<span className="dateline-upd"> · updated {String(P.builtAt).slice(0, 10)}</span></span>
      <span className="dateline-acts">
        <TeamPicker onPick={onTeam} isMobile={isMobile}>
          <button className="ico" aria-label="Find a team"><SearchIcon /></button>
        </TeamPicker>
        <button className="ico" onClick={onGames} aria-label="This week's games"><CalendarIcon /></button>
        <button className={'ico' + (isStarred ? ' on' : '')} onClick={onStar} aria-pressed={isStarred} aria-label={isStarred ? 'Saved' : 'Save this streak'}>
          <StarIcon filled={isStarred} />
        </button>
        <button className="ico" onClick={onShare} aria-label="Share"><ShareIcon /></button>
        {copied && <span className="toast">copied</span>}
      </span>
    </div>
  );
}
