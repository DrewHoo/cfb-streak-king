// The line above the title: site, window, last update, and the star and share buttons.

import { P, firstSeason } from '../lib/model.ts';
import { ShareIcon, StarIcon } from './Icons.jsx';

export function Dateline({ isStarred, onStar, onShare, copied }) {
  return (
    <div className="dateline">
      <span>drewhoover.com · {firstSeason}–{P.currentSeason}<span className="dateline-upd"> · updated {String(P.builtAt).slice(0, 10)}</span></span>
      <span className="dateline-acts">
        <button className={'ico' + (isStarred ? ' on' : '')} onClick={onStar} aria-pressed={isStarred} aria-label={isStarred ? 'Saved' : 'Save this streak'}>
          <StarIcon filled={isStarred} />
        </button>
        <button className="ico" onClick={onShare} aria-label="Share"><ShareIcon /></button>
        {copied && <span className="toast">copied</span>}
      </span>
    </div>
  );
}
